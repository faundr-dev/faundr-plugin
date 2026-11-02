// O hook principal (faundr hook claude|codex): gatilhos por evento (push, deploy), registro das edições, comandos e
// respostas, contexto do início da sessão (Codex, design, inventário, língua do conteúdo), grafo pendente e o reenvio
// do uso das sessões (faundr usage-sync).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findDesignMd, uiFiles } from './design.mjs'
import { ensureFaundrPath, faundrPath, organizeFaundrDir } from './paths.mjs'
import { maskPayload } from './security.mjs'
import { rememberTranscript, transcriptUsage, transcriptsToSync } from './usage.mjs'
import { onlyUser, readSkillIndex, skillMoment, writeSkillIndex } from './skills.mjs'
import { readWorkflows, workflowMoment, writeWorkflows } from './workflows.mjs'
import { stepOff, writeFlows } from './flows.mjs'
import { writeMemoryIndex, writeRules } from './rules.mjs'
import { recordEdit } from './loop.mjs'
import { machineName } from './live.mjs'
import { writeTeam } from './team.mjs'
import { addSessionNotes, takeAcks, writeInbox } from './inbox.mjs'
import { lang } from './i18n.mjs'
import { contentLangLine, ensureContentLang, languageGuidance, validContentLang } from './content-lang.mjs'
import { toolEdits } from './agent.mjs'
import { codexLauncher, syncCodexRules } from './codex-rules.mjs'
import { isCodexRollout, rolloutMeters } from './codex-transcript.mjs'
import { AGENT, CONFIG_DIR, CONFIG_FILE, CONTEXT_EVENTS, currentFeature, DESIGN_GUIDANCE, EDIT_TOOLS, findUp, flag, gitBranch, gitHead, GRAPH_GUIDANCE, LINK_FILE, linkedProject, loadConfig, log, NO_DESIGN_GUIDANCE, pinSessionFeature, readJson, readState, readStdin, setCurrentFeature, spawnBackground, WORK_GUIDANCE, writeState } from './cli-core.mjs'
import { editedFile, markSessionEdited } from './hook-stop.mjs'
import { captureErrors } from './cmd-dev-errors.mjs'
import { checkPending } from './cmd-security.mjs'
import { takeDesignDirty } from './cmd-design.mjs'

// ---- Gatilhos por evento ----------------------------------------------------------------------------------------
// O hook depois de cada comando (em segundo plano) guarda o evento; o fim da resposta pede as skills e os workflows
// que o time ligou nele e esvazia a lista. Push ou deploy que falhou não chega aqui (é PostToolUseFailure).

const DEPLOY = /\b(git\s+push|(npm|pnpm|yarn|bun)\s+(run\s+)?deploy|vercel(\s+--prod|\s+deploy)?|wrangler\s+(pages\s+)?deploy|fly(ctl)?\s+deploy|supabase\s+functions\s+deploy|netlify\s+deploy)\b/

/** Comando que vira evento quando dá certo: 'commit', 'push' (push ou deploy) ou null. */
function commandEvent(command) {
  const cmd = String(command ?? '')
  if (/\bgit\s+commit\b/.test(cmd) && !/--dry-run/.test(cmd)) return 'commit'
  if (DEPLOY.test(cmd) && !/--dry-run/.test(cmd)) return 'push'
  return null
}

export function pushEvent(root, sid, event) {
  if (!sid) return
  const pending = readState(root).eventsPending
  const list = pending?.session === sid ? pending.list : []
  writeState(root, { eventsPending: { session: sid, list: [...new Set([...list, event])] } })
}

const EVENT_TEXT = { commit: 'after the commit', push: 'after the push or deploy', error: 'on the new error in the commands' }

/** Passos do fim da resposta para os eventos desta sessão; esvazia a lista (cada evento pede uma vez). */
export function eventTriggers(root, sid) {
  const pending = readState(root).eventsPending
  if (pending?.session !== sid || !pending.list?.length) return []
  writeState(root, { eventsPending: { session: sid, list: [] } })
  return pending.list.flatMap((ev) => [
    ...readSkillIndex(root)
      .filter((s) => skillMoment(s, ev))
      .map((s) =>
        onlyUser(s)
          ? `the team asks for /${s.name} ${EVENT_TEXT[ev]}, but only the person calls it: ask in one line "worth running /${s.name} now?" (do not run it)`
          : `run the ${s.name} skill${s.when ? ` (${s.when})` : ''}: the team asked for it ${EVENT_TEXT[ev]}`,
      ),
    ...readWorkflows(root)
      .filter((w) => workflowMoment(w, ev))
      .map((w) =>
        w.call === 'user'
          ? `the team has the workflow ${w.ref} ${w.name} ${EVENT_TEXT[ev]}, but only when the person asks: ask in one line whether they want to follow it`
          : `follow the workflow ${w.ref} ${w.name} (faundr workflow show ${w.ref}): the team asked for it ${EVENT_TEXT[ev]}`,
      ),
  ])
}

// Fim da resposta barrado: o agente faz os passos antes de encerrar. A resposta anterior fica acima deste aviso no
// chat, e quem lê costuma ler só a última: por isso a última sai completa. No Codex o aviso vira um novo pedido logo
// abaixo da resposta, que continua à vista: basta contar o que os passos mudaram.
export function blockStop(steps) {
  const then =
    AGENT === 'codex'
      ? 'Then reply in a few lines with what these steps changed, without mentioning this note.'
      : 'Then write the complete final response: the previous one is hidden above this note, so repeat from it what the user needs to know (result, pending items, questions) together with what these steps changed, without mentioning this note.'
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `[Faundr] Before finishing: ${steps.map((t, i) => (steps.length > 1 ? `(${i + 1}) ${t}` : t)).join('; ')}. ` +
        '(Automatic, set up by the project owner in Faundr.) ' +
        then,
    }),
  )
}

export async function hook(agent) {
  const startedAt = Date.now()
  // Os processos de segundo plano herdam o agente (no Codex eles não recebem CODEX_SESSION_ID).
  process.env.FAUNDR_AGENT = agent
  const payload = JSON.parse(await readStdin())
  const event = payload.hook_event_name
  const cwd = payload.cwd ?? process.cwd()

  if (agent === 'codex' && event === 'SessionStart') syncCodexOnStart()
  const linkFile = findUp(cwd, LINK_FILE)
  // Pasta não ligada a nenhum projeto. No Codex, o setup e o link ainda precisam saber como rodar o Faundr.
  if (!linkFile) {
    if (agent === 'codex' && event === 'SessionStart')
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: CODEX_GUIDANCE() } }))
    return
  }
  const root = path.dirname(linkFile)
  // Projetos do plugin antigo tinham tudo solto em .faundr/: passa para as subpastas antes de qualquer leitura.
  if (event === 'SessionStart') organizeFaundrDir(root)
  const { projectId } = readJson(linkFile) ?? {}
  const { token, apiUrl } = loadConfig()
  if (!projectId || !token) return log(`ignored ${event}: no projectId or token`)

  // Grafo do projeto: marca "sujo" quando o agente edita arquivos e, ao fim da resposta,
  // refaz o grafo num processo destacado (o hook responde na hora).
  if (event === 'PostToolUse' && EDIT_TOOLS.has(payload.tool_name)) trackEdit(payload, projectId)
  const background = hookBackground(agent, event, payload, root, projectId)
  if (event === 'SessionStart') sessionStartState(root, payload.session_id)
  await bashEvents(event, payload, root, projectId, { token, apiUrl })
  saveCodexMeters(agent, event, payload, root)
  const usage = event === 'Stop' || event === 'SessionEnd' ? sessionUsage(payload, root) : null
  const request = fetch(`${apiUrl}/api/hooks/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      agent,
      projectId,
      git: { branch: gitBranch(cwd) },
      machine: machineName(readJson(CONFIG_FILE)),
      at: startedAt,
      ack: takeAcks(root, payload.session_id),
      currentFeatureId: currentFeature(root, payload.session_id),
      payload: maskPayload(payload),
      usage,
    }),
    signal: AbortSignal.timeout(hookTimeout(event)),
  })
  // As checagens em segundo plano nascem enquanto o servidor responde (abrir um processo leva ~1 s no Windows).
  if (background.length) spawnBackground(background, root)
  const res = await request
  if (!res.ok) return log(`${event}: HTTP ${res.status} ${await res.text()}`)

  const answer = await res.json()
  await deliverAnswer(answer, event, root, payload.session_id, { apiUrl, token, projectId })
}

// Atalho do Codex para a versão atual do plugin (o caminho muda a cada versão; a regra libera só o atalho).
function syncCodexOnStart() {
  try {
    syncCodexRules(PLUGIN_ROOT)
  } catch (err) {
    log(`codex rules: ${err?.message ?? err}`)
  }
}

// Trabalhos em segundo plano deste evento, todos num processo só (ver spawnBackground).
function hookBackground(agent, event, payload, root, projectId) {
  // As checagens "do início da sessão" nascem na primeira pergunta: esse hook roda em segundo plano, e no do início
  // abrir o processo delas custava ~1 s de espera no Windows. Elas só alimentam o painel e as próximas sessões.
  const startJobs = event === 'UserPromptSubmit' && readState(root).startJobsSession !== payload.session_id
  if (startJobs) writeState(root, { startJobsSession: payload.session_id })
  const syncUsage = rememberUsage(agent, event, payload, root, startJobs)
  if (startJobs) return startBackground(agent, root, payload.session_id, syncUsage)
  if (event === 'Stop') return stopBackground(agent, root, projectId, payload)
  return []
}

// Codex: sem a barra do Faundr, o contexto e a % do plano vêm da própria conversa (o custo das skills compara com eles).
function saveCodexMeters(agent, event, payload, root) {
  if (agent !== 'codex' || (event !== 'UserPromptSubmit' && event !== 'Stop') || !payload.transcript_path) return
  const meters = rolloutMeters(payload.transcript_path, payload.session_id)
  if (meters) fs.writeFileSync(ensureFaundrPath(root, 'meters'), JSON.stringify(meters))
}

// Resposta do painel: guarda o que veio e passa o contexto ao agente (no início da sessão, com o resumo local).
async function deliverAnswer(answer, event, root, sessionId, project) {
  saveAnswer(answer, root, sessionId)
  let { additionalContext } = answer
  if (event === 'SessionStart') {
    const contentLang = await resolveContentLang(answer.contentLang, root, project, 3_000)
    additionalContext = sessionStartContext(answer, root, sessionId, additionalContext, contentLang)
  }
  if (additionalContext && CONTEXT_EVENTS.has(event)) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext } }))
  }
}

// O agente editou um arquivo: grafo pendente, arquivo da sessão e a prova (o que precisa ser conferido).
function trackEdit(payload, projectId) {
  markGraphDirty(projectId)
  for (const edit of toolEdits(payload.tool_name, payload.tool_input)) {
    const file = path.resolve(payload.cwd ?? process.cwd(), edit.file)
    markSessionEdited(payload.session_id, file)
    try {
      recordEdit(CONFIG_DIR, payload.session_id, file)
    } catch (err) {
      log(`proof: ${err?.message ?? err}`)
    }
  }
}

// Impacto: lembra a conversa desta sessão; devolve se há uso de conversas anteriores para reenviar (o fim delas
// costuma se perder). Só reenvia junto com as checagens do início.
function rememberUsage(agent, event, payload, root, startJobs) {
  if (!CONTEXT_EVENTS.has(event) || !payload.transcript_path) return false
  const pending = readState(root).usageTranscripts ?? {}
  if (pending[payload.session_id]?.path !== payload.transcript_path)
    writeState(root, { usageTranscripts: rememberTranscript(pending, payload.session_id, payload.transcript_path) })
  return startJobs && transcriptsToSync(pending, payload.session_id).length > 0
}

// Checagens do início da sessão (rodam na primeira pergunta), na ordem em que entram no processo de segundo plano.
function startBackground(agent, root, sid, syncUsage) {
  // Checagem de design sem IA.
  const jobs = [['design-lint', '--quiet', '--session', sid]]
  // Projeto sem mapa: gera já na primeira pergunta, sem esperar a primeira edição (é o mapa que liga a orientação de
  // consultá-lo, a Visão e o inventário do que já existe).
  if (!fs.existsSync(faundrPath(root, 'graph'))) jobs.push(['graph', '--quiet', '--agent', agent, '--session', sid])
  // Segurança sem IA: checagem completa no início da sessão.
  jobs.push(['security-scan', '--quiet', '--session', sid])
  // Testes: só o inventário (sem rodar nada; os testes só rodam quando pedirem).
  jobs.push(['tests-scan', '--quiet'], ['status-refresh'])
  // Skills conectadas: relê as do computador (projeto, pessoais e plugins) e só envia quando a lista mudou.
  jobs.push(['skills', 'scan', '--quiet'])
  if (readState(root).agentsMd?.length) jobs.push(['agents-md', '--sync', '--quiet'])
  // Stack sem IA: pacotes, deploy e variáveis mudam pouco; só envia quando a impressão digital muda.
  jobs.push(['stack-scan', '--quiet'], ['env-check', '--quiet'], ['architecture-check', '--quiet', '--session', sid])
  // Pontos de volta no painel: o que mudou desde o último.
  jobs.push(['checkpoints-sync', '--quiet'])
  if (syncUsage) jobs.push(['usage-sync', '--quiet', '--session', sid])
  // Qualidade sem IA: completa no início da sessão. Nunca trava.
  jobs.push(['quality-scan', '--quiet', '--session', sid])
  return jobs
}

// Checagens do fim da resposta: só o que o agente mexeu.
function stopBackground(agent, root, projectId, payload) {
  const sid = payload.session_id
  const jobs = []
  // Design: quando o agente mexeu em telas.
  if (takeDesignDirty(projectId, payload)) jobs.push(['design-lint', '--quiet', '--session', sid])
  if (takeGraphDirty(projectId)) jobs.push(['graph', '--quiet', '--agent', agent, '--session', sid])
  // Pontos de volta no painel: no fim das respostas que mudaram arquivos.
  if (fs.existsSync(editedFile(sid))) jobs.push(['checkpoints-sync', '--quiet'])
  if (checkPending(root, sid, 'securityChecked')) jobs.push(['security-scan', '--quiet', '--session', sid, '--edited'])
  if (checkPending(root, sid, 'qualityChecked')) jobs.push(['quality-scan', '--quiet', '--session', sid, '--edited'])
  return jobs
}

// Começo da sessão: base do "tamanho da mudança" e do registro de trabalho (uma sessão retomada mantém a base).
function sessionStartState(root, sid) {
  // Início da sessão: o fim da resposta compara com o último registro de trabalho (feature, task, done).
  if (readState(root).sessionStart?.session !== sid) writeState(root, { sessionStart: { session: sid, at: Date.now() } })
  pinSessionFeature(root, sid)
  // Commit em que a sessão começou.
  const head = gitHead(root)
  if (head && readState(root).qualityBase?.session !== sid) writeState(root, { qualityBase: { session: sid, head } })
}

// Comandos do terminal: commit, push ou deploy que deram certo viram evento; build, tipos, testes ou lint que
// falharam (ou voltaram a passar) viram erro no painel.
async function bashEvents(event, payload, root, projectId, cfg) {
  if (payload.tool_name !== 'Bash') return
  // Gatilhos por evento (o fim da resposta pede o que o time ligou neles).
  if (event === 'PostToolUse') {
    const done = commandEvent(payload.tool_input?.command)
    if (done) pushEvent(root, payload.session_id, done)
    // Commit ou push: o fim da resposta pede para marcar as tarefas que ele terminou.
    if (done && payload.session_id) writeState(root, { committedTasks: payload.session_id })
  }
  if ((event === 'PostToolUse' || event === 'PostToolUseFailure') && !stepOff(root, 'run.errors'))
    await captureErrors(payload, root, projectId, cfg).catch((err) => log(`errors: ${err.message}`))
}

// SessionEnd: o hooks.json dá 5 s de orçamento ao hook (o padrão do Claude Code é 1,5 s).
function hookTimeout(event) {
  // O Codex corta o SessionEnd em 3 s.
  if (event === 'SessionEnd') return AGENT === 'codex' ? 2500 : 4000
  return CONTEXT_EVENTS.has(event) ? 8000 : 5000
}

// Impacto: tokens e uso da sessão, lidos da conversa no fim de cada resposta (só números).
function sessionUsage(payload, root) {
  let usage = null
  try {
    usage = transcriptUsage(payload.transcript_path)
  } catch (err) {
    log(`usage: ${err.message}`)
  }
  // Contexto e janelas de 5 h e da semana que a barra viu nesta sessão (só com a barra do Faundr ligada).
  const meters = readJson(faundrPath(root, 'meters'))
  if (usage && meters && (!meters.session_id || meters.session_id === payload.session_id)) usage.meters = meters
  return usage
}

// Cópias locais do que o painel mandou: os hooks do pedido, da edição, do push e do fim da resposta leem sem rede.
function saveAnswer(answer, root, sid) {
  // Foto do time: cópia local para os avisos do pedido, da edição e do push (que não usam a rede).
  if (answer.team) writeTeam(root, answer.team)
  if (Array.isArray(answer.inbox)) writeInbox(root, answer.inbox)
  // Avisos desta sessão (workflow parado pelo painel ou mudado no meio): o hook do próximo pedido entrega.
  if (Array.isArray(answer.sessionNotes)) addSessionNotes(root, sid, answer.sessionNotes)
  // Escolhas da barra do terminal (o painel liga e desliga cada item): chegam no início, a cada pedido e no fim da
  // resposta, para uma mudança no painel valer sem reiniciar; a barra lê sem rede a cada atualização.
  if (answer.bar !== undefined) fs.writeFileSync(ensureFaundrPath(root, 'bar'), JSON.stringify(answer.bar ?? {}))
  // Passos dos workflows padrão desligados no painel: o pedido seguinte e o fim da resposta leem sem rede.
  if (Array.isArray(answer.flows)) writeFlows(root, answer.flows)
  // Workflows ativos e skills ligadas, com o gatilho: chegam no início, a cada pedido e no fim da resposta, para uma
  // mudança no painel valer no próximo pedido; o hook do pedido, o guard e o fim da resposta leem sem rede.
  if (Array.isArray(answer.workflows)) writeWorkflows(root, answer.workflows)
  if (Array.isArray(answer.skills)) writeSkillIndex(root, answer.skills)
  // Plano aprovado virou funcionalidade: passa a ser a atual desta pasta.
  if (answer.currentFeatureId) setCurrentFeature(root, answer.currentFeatureId, sid)
  // Língua do conteúdo do projeto: chega no início e a cada pedido (o painel pode trocar no meio da sessão); os
  // comandos *-context leem a cópia local sem rede.
  if (answer.contentLang !== undefined) writeState(root, { contentLang: validContentLang(answer.contentLang) })
}

// Grava a língua do conteúdo só se o projeto ainda não tiver uma; devolve a que vale no servidor.
async function setContentLangApi({ apiUrl, token, projectId }, value, timeout) {
  const res = await fetch(`${apiUrl}/api/cli/memory`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, action: 'content-lang', set: value }),
    signal: AbortSignal.timeout(timeout),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data.contentLang ?? null
}

// A língua do conteúdo que vale. Projeto sem ela (criado antes dela existir): grava a língua da pessoa, uma vez.
async function resolveContentLang(projectLang, root, conn, timeout = 10_000) {
  const { lang: contentLang } = await ensureContentLang(projectLang, lang(), (value) => setContentLangApi(conn, value, timeout))
  writeState(root, { contentLang })
  return contentLang
}

// Linha do começo dos comandos *-context: a língua em que o agente grava o que gerar. `projectLang` é a que o
// servidor acabou de mandar (overview-context, stack-context); sem ela, vale a cópia local do último hook.
export async function contentLangNote(root, projectLang) {
  const known = validContentLang(projectLang) ?? validContentLang(readState(root).contentLang)
  if (known) return contentLangLine(known)
  const { projectId, config } = linkedProject()
  return contentLangLine(await resolveContentLang(null, root, { apiUrl: config.apiUrl, token: config.token, projectId }))
}

// Início da sessão: regras locais e as orientações que entram no contexto (trabalho, mapa, design, inventário).
function sessionStartContext(answer, root, sid, additionalContext, contentLang) {
  const hasGraph = fs.existsSync(faundrPath(root, 'graph'))
  // Regras ligadas a arquivos: cópia local para o guard entregar antes de cada edição (ele não usa a rede).
  if (Array.isArray(answer.anchoredRules)) writeRules(root, answer.anchoredRules)
  // Todas as regras e decisões: o hook do pedido entrega as do assunto; as que o início já levou não se repetem.
  if (Array.isArray(answer.memoryIndex)) {
    writeMemoryIndex(root, answer.memoryIndex)
    writeState(root, { rulesShown: { session: sid, ids: answer.memoryShown ?? [] } })
  }
  return [AGENT === 'codex' && CODEX_GUIDANCE(), additionalContext, languageGuidance(contentLang), WORK_GUIDANCE, hasGraph && GRAPH_GUIDANCE, designNote(root), inventoryNote(root)].filter(Boolean).join('\n\n')
}

// As skills e os avisos do Faundr foram escritos para o Claude Code: no Codex, o comando faundr não está no PATH e
// a skill não roda as linhas !`...` nem troca ${CLAUDE_PLUGIN_ROOT} e $ARGUMENTS sozinha.
export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// O comando passa pelo atalho de caminho fixo, o único que a regra do Codex libera para a rede (ver codex-rules.mjs).
const CODEX_GUIDANCE = () => {
  const cli = `node "${codexLauncher()}"`
  return `[Faundr] You are running in Codex. How to read Faundr's notes and skills here:
- "faundr <args>" means: ${cli} <args> (the faundr command is not on the PATH). In Faundr's skills, node "\${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" <args> means the same command.
- Elsewhere in Faundr's skills, \${CLAUDE_PLUGIN_ROOT} is ${PLUGIN_ROOT}; a line like !\`command\` is a command to run first with the shell, using its output as the text that would be there; $ARGUMENTS is what the user wrote after the skill name (empty if nothing).
- A skill name with a slash in front (as Claude Code writes it, inside the SKILL.md files) is the Faundr skill faundr:<name>: open its SKILL.md and follow it. When you tell the user to run a skill, write it the Codex way: $faundr:<name>. "AskUserQuestion" means asking the user in chat, with numbered options and the recommended one first.
- Faundr's commands talk to the dashboard over the network: if one fails for lack of network in the sandbox, ask to run it again with network access.`
}

// Com design.md: a orientação de seguir o guia; sem ele, mas com telas: a sugestão de criar um.
function designNote(root) {
  const designMd = findDesignMd(root)
  if (designMd) return DESIGN_GUIDANCE(designMd)
  return uiFiles(root).length ? NO_DESIGN_GUIDANCE : null
}

// Projeto que já tinha código antes do Faundr: oferecer, uma vez, o inventário do que já existe.
const INVENTORY_MIN_FILES = 15
const CODE_FILE = /\.(m?[jt]sx?|cjs|py|rb|go|rs|java|kt|php|cs|swift|vue|svelte|dart|astro)$/
const INVENTORY_GUIDANCE = `[Faundr] This project already has code, but no feature recorded in Faundr: the Features board would only show what gets done from now on. In your first response, offer the user in one line to map what already exists (Faundr's "inventory" skill, /faundr:inventory: lists the features from the code map and records them as done, with their OK). Do not do it unless they ask; if they decline, do not offer again.`

function inventoryNote(root) {
  const state = readState(root)
  // Sem status ainda (pasta recém-ligada) ou com zero funcionalidades; status de um plugin antigo (sem a contagem) não vale.
  if (state.inventoryOffered || (state.status && state.status.features !== 0)) return null
  const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', windowsHide: true })
  const files = tracked.status === 0 ? tracked.stdout.split('\n').filter((f) => CODE_FILE.test(f)).length : uiFiles(root).length
  if (files < INVENTORY_MIN_FILES) return null
  writeState(root, { inventoryOffered: new Date().toISOString() })
  return INVENTORY_GUIDANCE
}

export const dirtyFile = (projectId) => path.join(CONFIG_DIR, `graph-${projectId}.dirty`)
export const lockFile = (projectId) => path.join(CONFIG_DIR, `graph-${projectId}.lock`)

export function markGraphDirty(projectId) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(dirtyFile(projectId), new Date().toISOString())
}

function takeGraphDirty(projectId) {
  try {
    fs.unlinkSync(dirtyFile(projectId))
    return true
  } catch {
    // Sem marcador: o grafo não estava pendente.
    return false
  }
}

// Reenvia o uso das sessões anteriores desta pasta, relido da conversa (o último fim de resposta e o fim da
// sessão costumam se perder). O servidor só troca os números da sessão; nada entra no diário.
export async function usageSync(args) {
  const { root, projectId, config } = linkedProject()
  const current = flag(args, '--session') ?? null
  const sent = []
  for (const { sid, path: file } of transcriptsToSync(readState(root).usageTranscripts, current)) {
    const usage = transcriptUsage(file)
    if (usage) {
      const res = await fetch(`${config.apiUrl}/api/hooks/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
        body: JSON.stringify({ agent: isCodexRollout(file) ? 'codex' : 'claude', projectId, payload: { hook_event_name: 'UsageSync', session_id: sid, cwd: root }, usage }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        log(`usage-sync: HTTP ${res.status} ${await res.text()}`)
        continue
      }
    }
    sent.push(sid)
  }
  // Relê o estado: outra sessão pode ter se lembrado de uma conversa enquanto este envio rodava.
  const pending = { ...(readState(root).usageTranscripts ?? {}) }
  for (const sid of sent) delete pending[sid]
  writeState(root, { usageTranscripts: pending })
  if (!args.includes('--quiet')) console.log(`Usage resent: ${sent.length} session(s).`)
}
