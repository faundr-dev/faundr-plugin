// faundr setup (configura o Faundr de uma vez), statusline-install e config.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { findDesignMd } from './design.mjs'
import { projectFiles } from './security.mjs'
import { writeFlows } from './flows.mjs'
import { installStatusline } from './statusline.mjs'
import { gitignoreCoversFaundr, guessProject, nodeOk, setupSummary, withFaundrIgnored } from './setup.mjs'
import { AI_ITEMS, costText, estimate, projectSize, windowShare } from './ai-cost.mjs'
import { supabaseTarget } from './db-test.mjs'
import { lang, LANGS, locale, setLang, t } from './i18n.mjs'
import { codexRulesFile, syncCodexRules } from './codex-rules.mjs'
import { AGENT, FAUNDR_FILE, findUp, flag, LINK_FILE, linkedProject, loadConfig, log, readJson, readState, saveConfig, writeState } from './cli-core.mjs'
import { PLUGIN_ROOT } from './hook-events.mjs'
import { errorsApi } from './cmd-dev-errors.mjs'
import { fetchProjects } from './cmd-account.mjs'

// ---- faundr setup ------------------------------------------------------------------------------------------------
// Configura o Faundr de uma vez: faz o seguro e devolve o que pede o OK do dono (com o comando de cada um). No terminal
// de verdade pergunta na hora; dentro do Claude, a skill /faundr:setup pergunta com opções e roda --apply.

const SETUP_APPLY = ['git', 'gitignore', 'statusline', 'agents-md', 'codex-rules']
const SETUP_SKIP = ['agents-md', 'supabase-token', 'errors', 'statusline', 'codex-rules']
// Primeiras checagens, todas pelo próprio CLI (um processo cada: uma que falha não derruba as outras).
const SETUP_JOBS = [
  ['graph', () => t('Code map', 'Mapa do código')],
  ['stack-scan', () => t('Project stack', 'Stack')],
  ['security-scan', () => t('Security check', 'Checagem de segurança')],
  ['quality-scan', () => t('Quality check', 'Checagem de qualidade')],
  ['tests-scan', () => t('Test inventory', 'Inventário dos testes')],
  ['design-lint', () => t('Design check', 'Checagem de design')],
]

export async function setup(args) {
  const apply = new Set((flag(args, '--apply') ?? '').split(',').map((a) => a.trim()).filter(Boolean))
  const skip = (flag(args, '--skip') ?? '').split(',').map((a) => a.trim()).filter(Boolean)
  const bad = [...apply].filter((a) => !SETUP_APPLY.includes(a)).concat(skip.filter((s) => !SETUP_SKIP.includes(s)))
  if (bad.length) throw new Error(t('usage', 'uso') + `: faundr setup [--apply ${SETUP_APPLY.join(',')}] [--skip ${SETUP_SKIP.join(',')}] [--refresh] [--no-ask]`)
  const items = await setupItems({ apply, skip, refresh: args.includes('--refresh') })
  console.log(setupSummary(items))
  // Com o projeto ligado: o que usa IA (com o custo) e o gasto do fim das respostas.
  if (findUp(process.cwd(), LINK_FILE)) {
    const economy = flag(args, '--economy')
    if (economy || args.includes('--no-economy')) await setEconomy(economy, args.includes('--no-economy'))
    console.log(`\n${await aiSection(items)}`)
  }
  // Terminal de verdade: pergunta cada item que tem como aplicar e roda de novo só com os aprovados.
  const askable = items.filter((i) => i.status === 'pedir' && i.applyId)
  if (!askable.length || args.includes('--no-ask') || !process.stdin.isTTY || !process.stdout.isTTY) return
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const yes = []
  for (const i of askable) if (/^[sy]/i.test((await rl.question(`\n${i.title}: ${i.why} ${t('Apply now? (y/N)', 'Aplicar agora? (s/N)')} `)).trim())) yes.push(i.applyId)
  rl.close()
  if (yes.length) {
    console.log('')
    console.log(setupSummary(await setupItems({ apply: new Set(yes), skip: [], refresh: false })))
  }
}

// Passos opcionais do fim da resposta que o modo econômico desliga (os mesmos interruptores do painel).
const ECONOMY = {
  'stop.design': () => t('quick design audit', 'auditoria rápida de design'),
  'stop.overview': () => t('updating the Project overview', 'atualizar a Visão'),
  'stop.stack': () => t('updating the Project stack', 'atualizar a Stack'),
}

async function setupApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

async function setEconomy(list, restore) {
  const keys = (list === 'all' || list === 'tudo' ? Object.keys(ECONOMY) : String(list ?? '').split(',').map((k) => k.trim()).filter(Boolean)).map((k) => (k.startsWith('stop.') ? k : `stop.${k}`))
  const bad = keys.filter((k) => !(k in ECONOMY))
  if (bad.length) throw new Error(t(`You can only turn off: ${Object.keys(ECONOMY).join(', ')} (or "all").`, `Só dá para desligar: ${Object.keys(ECONOMY).join(', ')} (ou "all").`))
  const r = restore ? await setupApi({ action: 'economy', off: [], on: keys.length ? keys : Object.keys(ECONOMY) }) : await setupApi({ action: 'economy', off: keys })
  writeFlows(linkedProject().root, r.off)
}

/** O que usa IA, com o custo estimado de cada um, e o gasto do fim das respostas. */
async function aiSection(items) {
  const { root } = linkedProject()
  let status
  try {
    status = await setupApi({ action: 'status' })
  } catch (err) {
    return t(`With AI: could not read the cost history (${err.message}).`, `Com IA: não consegui ler o histórico de custo (${err.message}).`)
  }
  const size = projectSize(root, projectFiles(root).files)
  const share = windowShare(status.runs)
  const done = { ...status.done, design: !!findDesignMd(root), skills: items.some((i) => i.title === 'Skills' && i.status === 'ok') }
  const k = Math.round(size.code / 1000)
  const out = [
    t(
      `With AI (uses your Claude or Codex plan) — this project's code has ~${k}k tokens${share ? '' : "; the % of the plan shows up after the first measurements with Faundr's status line on"}:`,
      `Com IA (usa o seu plano do Claude ou do Codex) — o código deste projeto tem ~${k} mil tokens${share ? '' : '; a % do plano aparece depois das primeiras medições com a barra do Faundr ligada'}:`,
    ),
  ]
  const pending = []
  for (const item of AI_ITEMS) {
    const e = estimate(item, size, status.runs)
    const mark = done[item.id] ? '✓' : '○'
    if (!done[item.id]) pending.push({ ...item, tokens: e.tokens })
    out.push(
      `${mark} ${item.title}${item.essential ? t(' [essential]', ' [essencial]') : ''} (/${item.skill}): ${done[item.id] ? t('already done; to redo it, ', 'já feito; para refazer, ') : ''}${costText(e.tokens, share)} — ${e.source}`,
    )
  }
  const essential = pending.filter((p) => p.essential)
  const sum = (list) => list.reduce((s, p) => s + p.tokens, 0)
  const essentialList = essential.map((p) => `/${p.skill}`).join(', ') || t('already done', 'já feito')
  const essentialCost = essential.length ? costText(sum(essential), share) : t('nothing to spend', 'nada a gastar')
  if (pending.length)
    out.push(
      '',
      t('To generate (in order), in your AI agent:', 'Para gerar (em ordem), no seu agente de IA:'),
      t(`- only the essentials (${essentialList}): ${essentialCost}`, `- só o essencial (${essentialList}): ${essentialCost}`),
      t(`- everything that is missing (${pending.length}): ${costText(sum(pending), share)}`, `- tudo o que falta (${pending.length}): ${costText(sum(pending), share)}`),
      t('- or one by one, or nothing now (you can generate them later, when needed).', '- ou um por um, ou nada agora (dá para gerar depois, quando precisar).'),
    )
  else out.push('', t('Everything that uses AI has already been generated.', 'Tudo o que usa IA já foi gerado.'))
  // Fim das respostas: o gasto de todo dia, medido nas sessões dos últimos 30 dias.
  const g = status.gate
  const off = Object.keys(ECONOMY).filter((key) => status.off.includes(key))
  out.push('', t('Everyday spending (end-of-response check: handoff note, quick design audit, Project overview, Project stack…):', 'Gasto de todo dia (fim das respostas: bilhete, auditoria rápida de design, Visão, Stack…):'))
  if (g.total > 0 && g.blocks > 0) {
    const pct = Math.round((g.gate / g.total) * 100)
    const each = Math.round(g.gate / g.blocks / 1000)
    out.push(
      t(
        `  ${pct}% of what this project's sessions spent in the last 30 days (${g.blocks} times; ~${each}k tokens each).`,
        `  ${pct}% do que as sessões deste projeto gastaram nos últimos 30 dias (${g.blocks} vezes; ~${each} mil tokens cada).`,
      ),
    )
  } else out.push(t('  not measured in this project yet.', '  ainda sem medição neste projeto.'))
  const stillOn = Object.entries(ECONOMY).filter(([key]) => !off.includes(key)).map(([, v]) => v()).join(', ')
  const alreadyOff = off.map((key) => ECONOMY[key]()).join(', ')
  out.push(
    off.length === Object.keys(ECONOMY).length
      ? t(
          '  Economy mode on: design audit, Project overview and Project stack only when you ask (to go back: faundr setup --no-economy).',
          '  Modo econômico ligado: auditoria de design, Visão e Stack só quando você pedir (para voltar: faundr setup --no-economy).',
        )
      : t(
          `  Economy mode (turns off ${stillOn}; proof, handoff note and security stay on): faundr setup --economy all${off.length ? ` (already off: ${alreadyOff})` : ''}`,
          `  Modo econômico (desliga ${stillOn}; prova, bilhete e segurança continuam): faundr setup --economy all${off.length ? ` (já desligado: ${alreadyOff})` : ''}`,
        ),
  )
  return out.join('\n')
}

async function setupItems({ apply, skip, refresh }) {
  const items = []
  const add = (i) => items.push(i)
  const self = FAUNDR_FILE
  const cwd = process.cwd()
  const version = t(`version ${process.versions.node}`, `versão ${process.versions.node}`)
  add(nodeOk() ? { title: 'Node', status: 'ok', detail: version } : { title: 'Node', status: 'falta', detail: version, why: t('Faundr needs Node 20 or newer: https://nodejs.org', 'o Faundr precisa do Node 20 ou mais novo: https://nodejs.org') })

  const linkFile0 = findUp(cwd, LINK_FILE)
  const gitRoot = setupGit(add, { cwd, linkFile0, apply })

  // Login: sem ele, nada do resto funciona.
  const config = loadConfig()
  const projects = await setupLogin(add, config)
  if (!projects) return items

  const linkFile = setupProject(add, { linkFile0, root: gitRoot, projects, config })
  if (!linkFile) return items
  const root = path.dirname(linkFile)
  const skipped = new Set([...(readState(root).setupSkipped ?? []), ...skip])
  if (skip.length) writeState(root, { setupSkipped: [...skipped] })
  const declined = (id, title) => skipped.has(id) && add({ title, status: 'ok', detail: t(`you chose to leave it out (to turn it on: faundr setup --apply ${id})`, `você preferiu deixar de fora (para ligar: faundr setup --apply ${id})`) })

  setupGitignore(add, root, apply)
  setupStatusline(add, { self, apply, declined })
  setupChecks(add, { root, self, refresh })
  setupSkills(add, root, self)
  setupCodexRules(add, { apply, declined })
  setupAgentsMd(add, { root, self, apply, declined })
  setupSupabase(add, root, declined)
  await setupErrors(add, { root, linkFile, config, declined })
  return items
}

// Git: sem ele não há pontos de volta nem "o que mudou". Devolve a raiz provável do projeto.
function setupGit(add, { cwd, linkFile0, apply }) {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', windowsHide: true })
  let root = cwd
  if (linkFile0) root = path.dirname(linkFile0)
  else if (top.status === 0) root = path.resolve(top.stdout.trim())
  if (top.status === 0) add({ title: 'Git', status: 'ok', detail: t('the folder is in a repository', 'a pasta está num repositório') })
  else if (apply.has('git')) {
    const r = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8', windowsHide: true })
    add({ title: 'Git', status: r.status === 0 ? 'feito' : 'erro', detail: r.status === 0 ? t('repository created (git init)', 'repositório criado (git init)') : (r.stderr || t('git init failed', 'git init falhou')).trim() })
  } else
    add({
      title: 'Git',
      status: 'pedir',
      applyId: 'git',
      detail: t('the folder is not in a git repository', 'a pasta não está num repositório git'),
      why: t('without git, Faundr cannot keep restore points or see what changed.', 'sem git, o Faundr não guarda pontos de volta nem vê o que mudou.'),
      apply: 'faundr setup --apply git',
    })
  return root
}

// Login: os projetos da conta, ou null (o item já diz o que fazer).
async function setupLogin(add, config) {
  if (!config.token) {
    add({
      title: 'Login',
      status: 'falta',
      detail: t('not signed in yet', 'ainda não entrou'),
      why: t('sign in: faundr login (opens the browser; inside your AI agent: /faundr:login).', 'faça o login: faundr login (abre o navegador; dentro do agente de IA: /faundr:login).'),
    })
    return null
  }
  const projects = await fetchProjects(config).catch((err) => {
    add({ title: 'Login', status: 'falta', detail: err.message, why: t('sign in again: faundr login (opens the browser).', 'entre de novo: faundr login (abre o navegador).') })
    return null
  })
  if (projects) add({ title: 'Login', status: 'ok', detail: t(`${projects.length} project(s) in your account`, `${projects.length} projeto(s) na sua conta`) })
  return projects
}

// Pasta ligada ao projeto do painel: pelo nome, quando um só bate. Devolve o arquivo da ligação, ou null.
function setupProject(add, { linkFile0, root, projects, config }) {
  if (linkFile0) {
    const id = readJson(linkFile0)?.projectId
    const p = projects.find((x) => x.id === id)
    add(
      p
        ? { title: t('Project', 'Projeto'), status: 'ok', detail: t(`linked to "${p.name}"`, `ligado a "${p.name}"`) }
        : {
            title: t('Project', 'Projeto'),
            status: 'falta',
            detail: t(`the linked project (${id}) is not in your account`, `o projeto ligado (${id}) não está na sua conta`),
            why: t('link it again: faundr link "<project name>".', 'ligue de novo: faundr link "<nome do projeto>".'),
          },
    )
    return p ? linkFile0 : null
  }
  const pkgName = readJson(path.join(root, 'package.json'))?.name
  const guess = guessProject(projects, [path.basename(root), pkgName])
  if (guess) {
    const linkFile = path.join(root, LINK_FILE)
    fs.writeFileSync(linkFile, JSON.stringify({ projectId: guess.id }, null, 2) + '\n')
    add({ title: t('Project', 'Projeto'), status: 'feito', detail: t(`folder linked to "${guess.name}" (the name matched)`, `pasta ligada a "${guess.name}" (o nome bateu)`) })
    return linkFile
  }
  const list = `${projects.slice(0, 8).map((p) => `"${p.name}"`).join(', ')}${projects.length > 8 ? ', …' : ''}`
  add({
    title: t('Project', 'Projeto'),
    status: 'falta',
    detail: t('the folder is not linked to any project', 'a pasta não está ligada a nenhum projeto'),
    why: projects.length
      ? t(`choose which one it is and run faundr link "<name>" (your projects: ${list}).`, `escolha qual é e rode faundr link "<nome>" (seus projetos: ${list}).`)
      : t(`create the project on the dashboard (${config.apiUrl}) and run faundr link "<name>".`, `crie o projeto no painel (${config.apiUrl}) e rode faundr link "<nome>".`),
  })
  return null
}

// .gitignore: a pasta local do Faundr não vai para o git.
function setupGitignore(add, root, apply) {
  const ignoreFile = path.join(root, '.gitignore')
  const ignore = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, 'utf8') : ''
  if (gitignoreCoversFaundr(ignore)) add({ title: '.gitignore', status: 'ok', detail: t('already leaves .faundr/ out', 'já deixa .faundr/ de fora') })
  else if (apply.has('gitignore')) {
    fs.writeFileSync(ignoreFile, withFaundrIgnored(ignore))
    add({ title: '.gitignore', status: 'feito', detail: t('.faundr/ added', '.faundr/ acrescentado') })
  } else
    add({
      title: '.gitignore',
      status: 'pedir',
      applyId: 'gitignore',
      detail: t('does not leave .faundr/ out', 'não deixa .faundr/ de fora'),
      why: t("the code map and Faundr's local reports would go to git.", 'o mapa do código e os relatórios locais do Faundr iriam para o git.'),
      apply: 'faundr setup --apply gitignore',
    })
}

// Linha de status: liga sozinha; se já existe outra, só troca com o OK.
function setupStatusline(add, { self, apply, declined }) {
  const statusTitle = t('Status line', 'Linha de status')
  if (AGENT === 'codex') {
    add({ title: statusTitle, status: 'ok', detail: t('only in Claude Code (Codex has no custom status line)', 'só no Claude Code (o Codex não tem barra de status própria)') })
    return
  }
  if (declined('statusline', statusTitle)) return
  const r = installStatusline({ pluginFile: self, force: apply.has('statusline') })
  if (r.ok) add({ title: statusTitle, status: r.already ? 'ok' : 'feito', detail: r.already ? t("Faundr's is on", 'a do Faundr está ligada') : t(`turned on in ${r.settingsFile}`, `ligada em ${r.settingsFile}`) })
  else if (r.exists || /já existe|already exists/.test(r.reason))
    add({
      title: statusTitle,
      status: 'pedir',
      applyId: 'statusline',
      detail: t('you already use another status line', 'você já usa outra barra de status'),
      why: t(
        "Faundr's shows the project, the stage and the warnings; switching replaces the one you use today.",
        'a do Faundr mostra o projeto, a etapa e os avisos; trocar substitui a que você usa hoje.',
      ),
      apply: t('faundr setup --apply statusline (or --skip statusline)', 'faundr setup --apply statusline (ou --skip statusline)'),
    })
  else add({ title: statusTitle, status: 'erro', detail: r.reason })
}

// Primeiras checagens: só na primeira vez (ou com --refresh), para o setup de novo ser rápido e não mudar nada.
function setupChecks(add, { root, self, refresh }) {
  const state = readState(root)
  if (state.setupAt && !refresh) {
    add({
      title: t('Map and checks', 'Mapa e checagens'),
      status: 'ok',
      detail: t(
        `done on ${new Date(state.setupAt).toLocaleDateString(locale())} (to redo them: faundr setup --refresh)`,
        `feitos em ${new Date(state.setupAt).toLocaleDateString(locale())} (para refazer: faundr setup --refresh)`,
      ),
    })
    return
  }
  for (const [cmd, label] of SETUP_JOBS) {
    const title = label()
    const r = spawnSync(process.execPath, [self, cmd, '--quiet'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 600_000 })
    add(r.status === 0 ? { title, status: 'feito', detail: t('sent to the dashboard', 'enviado ao painel') } : { title, status: 'erro', detail: (r.stdout || r.stderr || t('failed', 'falhou')).trim().split('\n').at(-1) })
  }
  writeState(root, { setupAt: new Date().toISOString() })
}

// Skills: o Faundr lê sozinho; o "quando usar" e o tipo de cada uma o Claude escreve.
function setupSkills(add, root, self) {
  const skills = spawnSync(process.execPath, [self, 'skills', 'scan'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
  // Só o tipo muda o painel (skill conectada); o "quando usar" é um aviso a mais, que a mesma skill escreve.
  const pending = /Without a kind|Sem tipo/.test(skills.stdout ?? '')
  if (skills.status !== 0) add({ title: 'Skills', status: 'erro', detail: (skills.stdout || skills.stderr || t('failed', 'falhou')).trim().split('\n').at(-1) })
  else
    add(
      pending
        ? {
            title: 'Skills',
            status: 'falta',
            detail: t('read, but some skills have no kind', 'lidas, mas há skills sem tipo'),
            why: t(
              'run /faundr:skills in your AI agent: it writes when to use each one and links the ones that find problems to the dashboard.',
              'rode /faundr:skills no agente de IA: ele escreve quando usar cada uma e liga ao painel as que acham problemas.',
            ),
          }
        : { title: 'Skills', status: 'ok', detail: t('connected', 'conectadas') },
    )
}

// Codex: os comandos do agente rodam sem rede na área protegida; a regra deixa só os do Faundr falarem com o painel.
function setupCodexRules(add, { apply, declined }) {
  const rulesTitle = t('Codex rule', 'Regra do Codex')
  if (AGENT !== 'codex' || declined('codex-rules', rulesTitle)) return
  // Já aprovada antes: só reescreve se o texto mudou.
  if (fs.existsSync(codexRulesFile()) && syncCodexRules(PLUGIN_ROOT, { create: true })) add({ title: rulesTitle, status: 'ok', detail: t('Faundr commands can reach the dashboard', 'os comandos do Faundr falam com o painel') })
  else if (apply.has('codex-rules')) {
    syncCodexRules(PLUGIN_ROOT, { create: true })
    add({ title: rulesTitle, status: 'feito', detail: t(`created ${codexRulesFile()} (takes effect in the next Codex session)`, `criada em ${codexRulesFile()} (vale a partir da próxima sessão do Codex)`) })
  } else
    add({
      title: rulesTitle,
      status: 'pedir',
      applyId: 'codex-rules',
      detail: t('Faundr commands are blocked from the network', 'os comandos do Faundr ficam sem rede'),
      why: t(
        "Codex runs the agent's commands without network, so recording tasks and features on the dashboard fails. The rule lets only Faundr's command (node …/faundr.mjs) run outside the sandbox; the rest stays as it is.",
        'o Codex roda os comandos do agente sem rede, e gravar tarefas e funcionalidades no painel falha. A regra libera só o comando do Faundr (node …/faundr.mjs) fora da área protegida; o resto continua igual.',
      ),
      apply: t('faundr setup --apply codex-rules (or --skip codex-rules)', 'faundr setup --apply codex-rules (ou --skip codex-rules)'),
    })
}

// Bloco de regras no AGENTS.md: só para quem usa outro agente além do Claude Code.
function setupAgentsMd(add, { root, self, apply, declined }) {
  if (declined('agents-md', 'AGENTS.md')) return
  if (readState(root).agentsMd?.length) add({ title: 'AGENTS.md', status: 'ok', detail: t(`Faundr block in ${readState(root).agentsMd.join(', ')}`, `bloco do Faundr em ${readState(root).agentsMd.join(', ')}`) })
  else if (apply.has('agents-md')) {
    const r = spawnSync(process.execPath, [self, 'agents-md'], { cwd: root, encoding: 'utf8', windowsHide: true })
    add({
      title: 'AGENTS.md',
      status: r.status === 0 ? 'feito' : 'erro',
      detail: r.status === 0 ? t("block with the team's rules and decisions", 'bloco com as regras e decisões do time') : (r.stdout || r.stderr).trim().split('\n').at(-1),
    })
  } else
    add({
      title: 'AGENTS.md',
      status: 'pedir',
      applyId: 'agents-md',
      detail: t("without the team's rules block", 'sem o bloco de regras do time'),
      why: t(
        'only worth it if the team also uses an agent that does not run the plugin (Cursor, for example): the block takes the rules and decisions into AGENTS.md.',
        'só vale se o time também usa um agente que não roda o plugin (o Cursor, por exemplo): o bloco leva as regras e decisões para o AGENTS.md.',
      ),
      apply: t('faundr setup --apply agents-md (or --skip agents-md)', 'faundr setup --apply agents-md (ou --skip agents-md)'),
    })
}

// Supabase: o token pessoal confere backups e o Security Advisor (fica só no computador).
function setupSupabase(add, root, declined) {
  const supabaseTitle = t('Supabase token', 'Token do Supabase')
  if (declined('supabase-token', supabaseTitle) || !supabaseTarget(root)) return
  add(
    process.env.SUPABASE_ACCESS_TOKEN
      ? { title: supabaseTitle, status: 'ok', detail: t('SUPABASE_ACCESS_TOKEN set on this computer', 'SUPABASE_ACCESS_TOKEN definido neste computador') }
      : {
          title: supabaseTitle,
          status: 'falta',
          detail: t('the project uses Supabase and the personal token is not set', 'o projeto usa Supabase e o token pessoal não está definido'),
          why: t(
            "to check the backups and the Security Advisor: create one at https://supabase.com/dashboard/account/tokens and set SUPABASE_ACCESS_TOKEN in your computer's variables (never in the chat). To leave it out: faundr setup --skip supabase-token",
            'para conferir os backups e o Security Advisor: crie em https://supabase.com/dashboard/account/tokens e defina SUPABASE_ACCESS_TOKEN nas variáveis do seu computador (nunca no chat). Para deixar de fora: faundr setup --skip supabase-token',
          ),
        },
  )
}

// Erros do app publicado: chegam ao painel depois de ligar o SDK (skill errors-setup).
async function setupErrors(add, { root, linkFile, config, declined }) {
  const errorsTitle = t('Published app errors', 'Erros do app publicado')
  if (declined('errors', errorsTitle)) return
  const errors = await errorsApi({ action: 'dsn' }, { root, projectId: readJson(linkFile).projectId, config }).catch((err) => {
    // O item é só informativo: sem resposta do painel, fica de fora em vez de travar o setup; o motivo vai para o log.
    log(`setup errors: ${err?.message ?? err}`)
    return null
  })
  if (!errors) return
  add(
    errors.lastEventAt
      ? {
          title: errorsTitle,
          status: 'ok',
          detail: t(
            `arriving on the dashboard (last on ${new Date(errors.lastEventAt).toLocaleDateString(locale())})`,
            `chegando ao painel (último em ${new Date(errors.lastEventAt).toLocaleDateString(locale())})`,
          ),
        }
      : {
          title: errorsTitle,
          status: 'falta',
          detail: t('none has arrived yet', 'ainda não chegou nenhum'),
          why: t(
            'run /faundr:errors-setup in your AI agent so the errors of people using the app show up on the dashboard. To leave it out: faundr setup --skip errors',
            'rode /faundr:errors-setup no agente de IA para os erros de quem usa o app aparecerem no painel. Para deixar de fora: faundr setup --skip errors',
          ),
        },
  )
}

export function statuslineInstall(args) {
  const r = installStatusline({ pluginFile: FAUNDR_FILE, force: args.includes('--force') })
  if (!r.ok) throw new Error(t(`Status line not installed: ${r.reason}`, `Barra de status não instalada: ${r.reason}`))
  if (r.already) return console.log(t("Faundr's status line is already on.", 'A barra de status do Faundr já está ligada.'))
  const replaced = r.replaced ? t(` (replaced: ${r.replaced.command ?? 'the previous one'})`, ` (substituiu: ${r.replaced.command ?? 'a anterior'})`) : ''
  console.log(
    t(
      `Faundr's status line turned on in ${r.settingsFile}${replaced}. It shows up on the next status line refresh (or when you open Claude Code again).`,
      `Barra de status do Faundr ligada em ${r.settingsFile}${replaced}. Ela aparece na próxima atualização da barra (ou ao abrir o Claude Code de novo).`,
    ),
  )
  console.log(t('To remove it: delete the "statusLine" key from that file.', 'Para tirar: apague a chave "statusLine" desse arquivo.'))
}

// faundr config lang <en|pt|auto>: a língua do que o plugin mostra direto para a pessoa.
export function configCommand(args) {
  const usage = t('usage: faundr config lang <en|pt|auto>', 'uso: faundr config lang <en|pt|auto>')
  if (args[0] !== 'lang') throw new Error(usage)
  const value = args[1]
  if (!value) return console.log(t(`Faundr language: ${lang()}`, `Língua do Faundr: ${lang()}`))
  if (value !== 'auto' && !LANGS.includes(value)) throw new Error(usage)
  saveConfig({ lang: value === 'auto' ? undefined : value })
  setLang(value === 'auto' ? null : value)
  const auto = value === 'auto' ? t(' (detected from this computer)', ' (a deste computador)') : ''
  console.log(t(`Faundr language: ${lang()}${auto}.`, `Língua do Faundr: ${lang()}${auto}.`))
}
