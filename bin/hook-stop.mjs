// Fim da resposta (faundr gate e o hook Stop): arquivos que a sessão editou, Visão desatualizada, nota de passagem,
// checagens pendentes e os passos que o Faundr pede ao agente antes de encerrar.

import fs from 'node:fs'
import path from 'node:path'
import { allScripts } from './parts.mjs'
import { projectFiles } from './security.mjs'
import { onlyUser, readSkillIndex, skillMoment, takeSkillsRan } from './skills.mjs'
import { readWorkflows, workflowMoment } from './workflows.mjs'
import { stepOff } from './flows.mjs'
import { matchesPath } from './rules.mjs'
import { proofNeeded } from './loop.mjs'
import { projectSize, takeSkillCosts } from './ai-cost.mjs'
import { takeInbox } from './inbox.mjs'
import { AGENT, CONFIG_DIR, currentFeature, findUp, LINK_FILE, loadConfig, log, readJson, readState, readStdin, writeState } from './cli-core.mjs'
import { blockStop, eventTriggers } from './hook-events.mjs'
import { designAuditFiles, newDesignFindings } from './cmd-design.mjs'

// ---- Visão automática: no fim da resposta, se a sessão editou arquivos e a Visão está desatualizada,
// pede ao agente para atualizá-la antes de encerrar (uma vez por sessão).

export const editedFile = (sessionId) => path.join(CONFIG_DIR, `edited-${String(sessionId).replace(/[^\w-]/g, '')}`)

// O marcador guarda, uma por linha, os arquivos que o agente editou na sessão.
export function markSessionEdited(sessionId, filePath) {
  if (!sessionId) return
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.appendFileSync(editedFile(sessionId), `${filePath ?? ''}\n`)
}

export const editedLineCount = (sessionId) => {
  try {
    return fs.readFileSync(editedFile(sessionId), 'utf8').split('\n').length
  } catch {
    return 0
  }
}

export function sessionEditedFiles(sessionId, fromLine = 0) {
  try {
    const lines = fs.readFileSync(editedFile(sessionId), 'utf8').split('\n').slice(fromLine)
    return [...new Set(lines.map((l) => l.trim()).filter((l) => l && !/^\d{4}-\d{2}-\d{2}T/.test(l)))]
  } catch {
    // Sessão sem edições (sem marcador): nenhum arquivo.
    return []
  }
}

// Marcadores de sessões antigas não servem mais.
function cleanEditedMarkers() {
  try {
    for (const f of fs.readdirSync(CONFIG_DIR)) {
      if (!/^(edited|loop)-/.test(f)) continue
      const file = path.join(CONFIG_DIR, f)
      if (Date.now() - fs.statSync(file).mtimeMs > 2 * 24 * 3600_000) fs.unlinkSync(file)
    }
  } catch {
    // Limpeza dos marcadores antigos é só faxina: falhar não muda nada agora.
  }
}

// Bilhete de passagem: só em sessão que mudou algo importante (vários arquivos, ou edições espalhadas por bastante
// tempo); nas pequenas, o diário automático (pedidos, arquivos, commits) já basta e o bilhete custaria mais do que
// ajuda. Depois do primeiro, de novo se houve edições 30 min depois do último.
const HANDOFF_EVERY_MS = 30 * 60_000
const HANDOFF_MIN_FILES = 4
const HANDOFF_MIN_WORK_MS = 20 * 60_000

function needsHandoff(root, sid) {
  const last = readState(root).lastHandoff
  if (last?.session !== sid) {
    const st = fs.statSync(editedFile(sid))
    const worked = st.mtimeMs - (st.birthtimeMs || st.ctimeMs)
    return sessionEditedFiles(sid).length >= HANDOFF_MIN_FILES || worked >= HANDOFF_MIN_WORK_MS
  }
  const edited = fs.statSync(editedFile(sid)).mtimeMs
  const at = new Date(last.at).getTime()
  return edited > at && Date.now() - at > HANDOFF_EVERY_MS
}

// Quantos arquivos a sessão mudou sem nenhum registro de trabalho desde que começou (null quando está em dia).
// Uma vez por sessão: é a rede para quando o agente não percebeu que o pedido era uma funcionalidade.
function untrackedWork(root, sid) {
  const state = readState(root)
  if (state.untrackedNudged === sid || state.sessionStart?.session !== sid) return null
  if ((state.workAt ?? 0) >= state.sessionStart.at) return null
  const files = new Set(sessionEditedFiles(sid).filter(Boolean)).size
  return files >= HANDOFF_MIN_FILES ? files : null
}

async function overviewStale(projectId, token, apiUrl, route = 'overview') {
  const res = await fetch(`${apiUrl}/api/cli/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, action: 'status' }),
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) {
    log(`gate: HTTP ${res.status} ${await res.text()}`)
    return null
  }
  return (await res.json()).stale ?? null
}

// Funcionalidade atual com o checklist e as próximas etapas registradas (para o fim da resposta).
async function currentStep(projectId, featureId, token, apiUrl) {
  if (!featureId) return null
  const res = await fetch(`${apiUrl}/api/cli/memory`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, action: 'board' }),
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return null
  const { allFeatures = [] } = await res.json()
  const byId = new Map(allFeatures.map((f) => [f.id, f]))
  const f = byId.get(featureId)
  if (!f) return null
  return { feature: f, next: (f.next ?? []).map((id) => byId.get(id)).filter((n) => n && !n.finished) }
}

// Há algo para provar que funciona (build, testes, tipos)? Sem isso, pedir a prova só gastaria tokens.
function hasChecks(root) {
  try {
    if (allScripts(root).some((s) => /^(build|test|typecheck|type-check|check|lint|tsc)/.test(s.name))) return true
  } catch {
    // package.json ilegível: confere os arquivos de configuração logo abaixo.
  }
  return ['tsconfig.json', 'pyproject.toml', 'pytest.ini', 'setup.cfg', 'Cargo.toml', 'go.mod'].some((f) => fs.existsSync(path.join(root, f)))
}

export async function gate() {
  const payload = JSON.parse(await readStdin())
  if (payload.stop_hook_active) return // já estamos continuando por causa de um Stop: não repetir
  const sid = payload.session_id
  const linkFile = findUp(payload.cwd ?? process.cwd(), LINK_FILE)
  const { inboxStep, eventSteps } = await earlyStopSteps(linkFile, sid)
  if (!linkFile || !sid || !fs.existsSync(editedFile(sid))) {
    const early = [inboxStep, ...eventSteps].filter(Boolean)
    return early.length ? blockStop(early) : undefined // o resto só quando a sessão mexeu em arquivos
  }
  const root = path.dirname(linkFile)
  const { projectId } = readJson(linkFile) ?? {}
  const { token, apiUrl } = loadConfig()
  if (!projectId || !token) return
  cleanEditedMarkers()
  const s = await stopSignals(root, sid, projectId, token, apiUrl)
  if (!inboxStep && !eventSteps.length && !hasStopWork(s)) return
  rememberNudges(root, sid, s)
  blockStop(stopSteps(root, sid, s, inboxStep, eventSteps))
}

// O que vale no fim da resposta mesmo sem arquivo mexido (nada sem projeto ligado ou sem sessão).
async function earlyStopSteps(linkFile, sid) {
  if (!linkFile || !sid) return { inboxStep: null, eventSteps: [] }
  const root = path.dirname(linkFile)
  // Custo da IA: quanto cada skill que rodou nesta resposta gastou (vira o histórico das estimativas do setup).
  await sendSkillCosts(root, sid)
  // Pedido, recado ou nota que chegou enquanto o agente trabalhava: entrega agora, mesmo sem arquivo mudado.
  const inbox = takeInbox(root, sid)
  const inboxStep = inbox.length ? `this arrived from the dashboard while you were working; handle it before finishing: ${inbox.join(' ')}` : null
  // Evento desta sessão (commit, push ou deploy, erro novo) com skill ou workflow ligado nele: vale mesmo sem arquivo mexido.
  // Skill conectada (segurança, testes, qualidade, erros) que rodou: registrar o resultado dela. Uma auditoria
  // costuma só ler, então vale mesmo sem arquivo mexido.
  const eventSteps = [...takeSkillsRan(root, sid), ...eventTriggers(root, sid)]
  const tasksStep = await committedTasksStep(root, sid)
  if (tasksStep) eventSteps.unshift(tasksStep)
  return { inboxStep, eventSteps }
}

// Depois de um commit ou push: as tarefas ainda abertas da funcionalidade atual, para marcar as que ele terminou.
// Sem isso o trabalho ia para o git e o quadro ficava parado (a tarefa só muda com faundr done).
async function committedTasksStep(root, sid) {
  if (readState(root).committedTasks !== sid) return null
  writeState(root, { committedTasks: null })
  const featureId = currentFeature(root, sid)
  const { projectId } = readJson(path.join(root, LINK_FILE)) ?? {}
  const { token, apiUrl } = loadConfig()
  if (!featureId || !projectId || !token) return null
  try {
    const res = await fetch(`${apiUrl}/api/cli/memory`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, action: 'board', featureId }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const f = (await res.json()).features?.[0]
    const open = (f?.tasks ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter((t) => t.task_status !== 'completed')
    return open.length ? committedTasksText(f.title, open) : null
  } catch (err) {
    // Sem rede ou painel fora do ar: o lembrete fica para o próximo commit.
    log(`committed tasks: ${err?.message ?? err}`)
    return null
  }
}

function committedTasksText(title, open) {
  return `you committed or pushed in this session and "${title}" still has open tasks: ${open.map((t) => `${t.n}. ${t.title}`).join('; ')}. Mark with faundr done <#> each one whose work is in that commit (only what is really done; if none is, mark nothing) and tell the user in one line what you marked`
}

// Marca nesta sessão os avisos que já foram dados (não repetir na próxima resposta).
function rememberNudges(root, sid, s) {
  if (s.untracked) writeState(root, { untrackedNudged: sid })
  if (s.stale) writeState(root, { overviewNudgedSession: sid })
  if (s.stackStale) writeState(root, { stackNudgedSession: sid })
}

async function sendSkillCosts(root, sid) {
  try {
    const runs = takeSkillCosts(root, sid)
    if (!runs.length) return
    const { projectId } = readJson(path.join(root, LINK_FILE)) ?? {}
    const { token, apiUrl } = loadConfig()
    if (!projectId || !token) return
    const codeTokens = projectSize(root, projectFiles(root).files).code
    await fetch(`${apiUrl}/api/cli/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, action: 'runs', runs, codeTokens, agent: AGENT, agentSessionId: sid }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    // Medição é extra: sem rede, esta rodada fica sem histórico.
    log(`skill costs: ${err?.message ?? err}`)
  }
}

/** O que pede um passo no fim da resposta, já sem os passos que o projeto desligou no painel. */
async function stopSignals(root, sid, projectId, token, apiUrl) {
  // Passos do workflow padrão "Fim da resposta" que o projeto desligou no painel.
  const on = (key) => !stepOff(root, key)

  const handoff = on('stop.handoff') && needsHandoff(root, sid)
  // Checklist da funcionalidade atual acabou de terminar: anunciar a próxima etapa (uma vez por funcionalidade).
  const featureId = currentFeature(root, sid)
  const step =
    featureId && readState(root).stepAnnounced !== featureId
      ? await currentStep(projectId, featureId, token, apiUrl).catch(() => {
          // Sem rede ou painel fora do ar: a próxima etapa fica para o próximo fim de resposta.
          return null
        })
      : null
  const finished = step?.feature.finished && (on('stop.criteria') || on('stop.next_step')) ? step : null
  if (finished) writeState(root, { stepAnnounced: featureId })
  const designFiles = on('stop.design') ? designAuditFiles(root, sid) : []
  if (designFiles.length || readState(root).designAudited?.session !== sid)
    writeState(root, { designAudited: { session: sid, lines: editedLineCount(sid) - 1 } })
  // Visão: uma vez por sessão.
  const stale = !on('stop.overview') || readState(root).overviewNudgedSession === sid ? null : await overviewStale(projectId, token, apiUrl)
  // Stack: só quando já foi revisada e a detecção mudou (pacote, deploy, serviço novo). Uma vez por sessão.
  const stackStale = !on('stop.stack') || readState(root).stackNudgedSession === sid ? null : await stackStaleness(projectId, token, apiUrl)
  // Prova: código mudou e nenhuma checagem passou depois (uma vez por leva de mudanças, só se há o que rodar).
  const proof = on('stop.proof') && hasChecks(root) ? proofNeeded(CONFIG_DIR, sid) : null
  const untracked = on('stop.untracked') ? untrackedWork(root, sid) : null
  const triggered = stopTriggers(root, sid)
  return { on, handoff, finished, designFiles, stale, stackStale, proof, untracked, triggered }
}

// A Stack está desatualizada? Sem rede ou painel fora do ar, não pede nada agora (tenta no próximo fim de resposta).
function stackStaleness(projectId, token, apiUrl) {
  return overviewStale(projectId, token, apiUrl, 'stack').catch(() => {
    // Sem resposta: a Stack não entra neste fim de resposta.
    return null
  })
}

const hasStopWork = (s) => !!(s.handoff || s.stale || s.stackStale || s.designFiles.length || s.finished || s.proof || s.untracked || s.triggered.length)

/** Os passos do fim da resposta, na ordem em que o agente deve fazer. */
function stopSteps(root, sid, s, inboxStep, eventSteps) {
  const steps = []
  if (inboxStep) steps.push(inboxStep)
  if (s.untracked)
    steps.push(
      `this session changed ${s.untracked} files and nothing was recorded in Faundr: if it was a feature, improvement or phase with several steps, record what was done now (faundr feature "<title>" --desc "<goal>", one faundr task "<step>" per step and faundr done "<step>" for what is already done; if it belongs to the current feature, only the tasks); if it was a small tweak, record nothing`,
    )
  if (s.proof)
    steps.push(
      (s.proof.failing.length ? `\`${s.proof.failing[0]}\` is still failing: fix it or tell the user clearly that it is not working. ` : '') +
        'check that what you changed works before saying it is done: run what makes sense here (build, tests, type check or the app itself) and tell the user the result in one line; if you cannot run anything, say so instead of claiming it works',
    )
  if (s.handoff)
    steps.push(
      "write the handoff note: 1 to 3 sentences, in plain language and in the user's language, saying what was left half done, what the next stage of the feature you are working on is (see faundr board; if it has recorded stages, name the next one) and anything the next person should watch out for (do not repeat the file list; if nothing is pending, say so). Run it with the Bash tool: faundr handoff \"<note>\"",
    )
  if (s.designFiles.length) steps.push(designStep(root, sid, s.designFiles))
  steps.push(...finishedSteps(s.finished, s.on))
  if (s.stackStale) steps.push(`update the Project stack (${s.stackStale}) using Faundr's "stack" skill and following its instructions`)
  steps.push(...s.triggered, ...eventSteps)
  if (s.stale) steps.push(`update the Project overview, which is out of date (${s.stale}), using Faundr's "overview" skill and following its instructions`)
  return steps
}

// Auditoria rápida de design nos arquivos de tela mexidos, com os problemas novos que a checagem automática achou.
function designStep(root, sid, designFiles) {
  const fresh = newDesignFindings(root, sid, designFiles)
  const base = `do the quick design audit only on the screen files you touched (${designFiles.join(', ')}), using Faundr's "design" skill with the arguments --files ${designFiles.join(',')} (quick mode): compare with design.md, record each real problem with faundr design-finding and fix on the spot whatever is simple (do not open the browser)`
  if (!fresh.length) return base
  const count = fresh.length === 1 ? '1 new problem' : `${fresh.length} new problems`
  const list = fresh
    .slice(0, 8)
    .map((f) => `${f.title} — ${f.file}${f.line ? `:${f.line}` : ''} [${f.rule}]`)
    .join('; ')
  return `${base}. The automatic check found ${count} in this conversation (they did not exist at its start): ${list}${fresh.length > 8 ? '; …' : ''}. Fix them; if one does not apply to this project, do not force it: tell the user (they archive it on the dashboard or turn the rule off with faundr design-scope --disable <rule>)`
}

// Checklist da funcionalidade terminou: conferir o critério de pronto e anunciar a próxima etapa.
function finishedSteps(finished, on) {
  if (!finished) return []
  const steps = []
  // Critério de pronto ainda não conferido: confere antes de dar a etapa como terminada.
  const unchecked = (finished.feature.criteria ?? []).map((c, i) => ({ ...c, n: i + 1 })).filter((c) => c.met !== true)
  if (on('stop.criteria') && unchecked.length)
    steps.push(
      `before calling "${finished.feature.title}" done, check the Done when agreed with the user: ${unchecked.map((c) => `${c.n}. ${c.text}`).join(' ')}. For each one, really check it (run, open, test) and record it with faundr criteria-check <#> --met or --not-met --note "<how you checked>"; tell the user what was met and what was not`,
    )
  if (on('stop.next_step'))
    steps.push(
      finished.next.length
        ? `the checklist of "${finished.feature.title}" is finished: tell the user, in 1 to 2 lines, that the next recorded stage is "${finished.next[0].title}"${finished.next[0].body ? ` (${finished.next[0].body})` : ''} and ask whether to go on with it (to start: faundr focus "${finished.next[0].title}")`
        : `the checklist of "${finished.feature.title}" is finished and there is no next stage recorded: if this work continues (another phase, something left out on purpose), record each stage with faundr feature "<stage>" --after current --desc "<what goes in>" and tell the user which one is next; if not, say the feature is complete`,
    )
  return steps
}

/**
 * Skills e workflows do time com o momento "no fim da resposta": entram quando a sessão mexeu em arquivos que batem com
 * os deles (sem arquivos escolhidos, qualquer um) e houve mudança nova desde a última vez que entraram.
 */
function stopTriggers(root, sid) {
  const files = sessionEditedFiles(sid).filter(Boolean).map((f) => path.relative(root, f).split(path.sep).join('/'))
  if (!files.length) return []
  const lastEdit = fs.statSync(editedFile(sid)).mtimeMs
  const seen = readState(root).stopTriggered?.session === sid ? readState(root).stopTriggered.at : {}
  const hits = (paths) => !paths?.length || files.some((f) => paths.some((p) => matchesPath(p, f)))
  const items = [
    ...readSkillIndex(root)
      .filter((s) => skillMoment(s, 'stop') && hits(s.paths))
      .map((s) => ({
        id: `skill:${s.name}`,
        text: onlyUser(s)
          ? `the team asks for /${s.name} at the end of responses that touch these files, but only the person calls it: ask in one line "worth running /${s.name} now?" (do not run it)`
          : `run the ${s.name} skill${s.when ? ` (${s.when})` : ''}: the team asked for it at the end of responses that touch these files`,
      })),
    ...readWorkflows(root)
      .filter((w) => workflowMoment(w, 'stop') && hits(w.paths))
      .map((w) => ({
        id: `workflow:${w.id}`,
        text:
          w.call === 'user'
            ? `the team has the workflow ${w.ref} ${w.name} for the end of these responses, but only when the person asks: ask in one line whether they want to follow it`
            : `follow the workflow ${w.ref} ${w.name} (faundr workflow show ${w.ref}): the team asked for it at the end of responses that touch these files`,
      })),
  ].filter((i) => (seen[i.id] ?? 0) < lastEdit)
  if (items.length) writeState(root, { stopTriggered: { session: sid, at: { ...seen, ...Object.fromEntries(items.map((i) => [i.id, lastEdit])) } } })
  return items.map((i) => i.text)
}
