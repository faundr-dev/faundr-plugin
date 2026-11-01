// Visão do projeto: faundr overview-context/overview-save, o desenho da funcionalidade ou da arquitetura
// (diagram-save, diagram-wait) e architecture-check.

import fs from 'node:fs'
import path from 'node:path'
import { ensureFaundrPath, faundrPath } from './paths.mjs'
import { projectFiles } from './security.mjs'
import { checkBuilt, newOffPlan, offPlan, readIgnore } from './architecture.mjs'
import { addSessionNotes } from './inbox.mjs'
import { AGENT, AGENT_SESSION_ID, currentFeature, flag, gitHead, linkedProject, MARK, readState, textArg, writeState } from './cli-core.mjs'
import { contentLangNote } from './hook-events.mjs'
import { loadEngine } from './cmd-graph.mjs'
import { findFeature, memoryApi } from './cmd-features.mjs'
import { openBrowser } from './cmd-account.mjs'

// ---- Visão do projeto ------------------------------------------------------------------------

async function overviewApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/overview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

const OVERVIEW_SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|\.claude|\.remember|graphify-out|\.wrangler|\.next)(\/|$)/

export function walkFiles(dir, root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    const rel = path.relative(root, abs).split(path.sep).join('/')
    if (OVERVIEW_SKIP.test(rel)) continue
    if (e.isDirectory()) walkFiles(abs, root, out)
    else out.push(rel)
  }
  return out
}

function stripFrontmatter(text) {
  return text.startsWith('---') ? text.replace(/^---[\s\S]*?\n---\s*\n/, '') : text
}


// Pacote de contexto que o agente lê para escrever/atualizar a Visão do projeto.
export async function overviewContext() {
  const { root } = linkedProject()
  const files = walkFiles(root, root)
  const out = []
  const say = (s = '') => out.push(s)

  const prev = await overviewApi({ action: 'get' })
  say(`# Context for the Project overview of "${prev.project}"`)
  say(await contentLangNote(root, prev.contentLang))
  say(`Current commit: ${gitHead(root) ?? '(no git)'}`)
  say()
  overviewPrevious(say, prev)
  overviewDocs(say, root, files)
  await overviewGraph(say, root)
  overviewCommands(say, root, files)
  overviewBoard(say, await memoryApi({ action: 'board' }))

  console.log(out.join('\n'))
}

function overviewPrevious(say, prev) {
  say('## Previous overview')
  if (prev.overview) {
    say(`Generated on ${prev.overview.created_at} (commit ${prev.overview.built_at_commit ?? '-'}). UPDATE this overview; keep what is still true.`)
    say('```json')
    // Em andamento e próximas vêm do quadro (o painel lê na hora): não entregar o texto velho para não ser copiado.
    const { in_progress: _i, next: _n, ...progress } = prev.overview.content.progress ?? {}
    say(JSON.stringify({ ...prev.overview.content, progress }, null, 1))
    say('```')
  } else say('(none — this is the first one)')
  say()
}

// Documentos: README e docs de primeiro nível com trecho; os demais só com títulos.
function overviewDocs(say, root, files) {
  say('## Project documents')
  const docs = files.filter((f) => /\.mdx?$/i.test(f) && !/(^|\/)SKILL\.md$/i.test(f))
  docs.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
  let budget = 14_000
  for (const rel of docs.slice(0, 40)) {
    const text = stripFrontmatter(fs.readFileSync(path.join(root, rel), 'utf8'))
    const headings = text.split(/\r?\n/).filter((l) => /^#{1,3}\s/.test(l)).slice(0, 25)
    const main = /^readme\.md$/i.test(rel) || rel.split('/').length <= 2
    say(`### ${rel}`)
    if (main && budget > 0) {
      const excerpt = text.slice(0, Math.min(2500, budget))
      budget -= excerpt.length
      say(excerpt.trim())
    } else say(headings.join('\n') || '(no headings)')
    say()
  }
}

// Estrutura do código a partir do grafo (gera se ainda não existe).
async function overviewGraph(say, root) {
  say("## Code structure (Faundr's graph)")
  const engine = await loadEngine()
  let graph
  try {
    graph = engine.loadGraphJson(root)
  } catch {
    const result = await engine.buildProjectGraph(root)
    engine.writeOutputs(root, result)
    graph = result.graph
  }
  const byRole = new Map()
  for (const n of graph.nodes) {
    if (!n.display_label || ['config', 'test', 'external'].includes(n.role)) continue
    byRole.set(n.role, [...(byRole.get(n.role) ?? []), `${n.display_label} (${n.source_file})`])
  }
  for (const [role, list] of byRole) say(`- ${role}: ${list.join('; ')}`)
  try {
    const report = fs.readFileSync(faundrPath(root, 'graphReport'), 'utf8')
    const gods = report.split('## Nós centrais')[1]?.split('\n## ')[0]
    if (gods) say(`Central nodes:${gods.trimEnd()}`)
  } catch {
    // Relatório do grafo ainda não gerado: segue sem os nós centrais.
  }
  say()
}

// Comandos e formas de uso que o próprio projeto oferece.
function overviewCommands(say, root, files) {
  say('## Commands, scripts and entry points')
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    if (pkg.description) say(`package.json description: ${pkg.description}`)
    for (const [k, v] of Object.entries(pkg.scripts ?? {})) say(`- npm run ${k}: ${v}`)
  } catch {
    // Sem package.json (ou ilegível): segue sem os scripts.
  }
  for (const rel of files.filter((f) => /(^|\/)SKILL\.md$/i.test(f))) {
    const fm = fs.readFileSync(path.join(root, rel), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
    const dir = rel.split('/').slice(-2, -1)[0]
    const desc = fm.match(/^description:\s*(.+)$/m)?.[1]
    const hint = fm.match(/^argument-hint:\s*(.+)$/m)?.[1]
    const plugin = rel.match(/^(.*?)\/skills\//)?.[1]
    let pluginName = ''
    try {
      pluginName = JSON.parse(fs.readFileSync(path.join(root, plugin ?? '', '.claude-plugin', 'plugin.json'), 'utf8')).name
    } catch {
      // Skill fora de um plugin (sem plugin.json): o comando sai sem o prefixo.
    }
    say(`- command /${pluginName ? `${pluginName}:` : ''}${dir}${hint ? ` ${hint}` : ''}: ${desc ?? ''} [${rel}]`)
  }
  say()
}

function overviewBoard(say, b) {
  say('## Recorded features, tasks and decisions')
  for (const f of b.features ?? []) {
    const done = f.tasks.filter((t) => t.task_status === 'completed').length
    say(`- Feature: ${f.title} (${done}/${f.tasks.length})`)
    for (const t of f.tasks) say(`  - ${MARK[t.task_status] ?? '[ ]'} ${t.title}`)
  }
  for (const d of b.decisions ?? []) say(`- ${d.kind === 'rule' ? 'Rule' : 'Decision'}: ${d.title}${d.body ? ` — ${d.body}` : ''}`)
  for (const c of b.concerns ?? []) say(`- Open concern P-${c.ref} (goes into "open items"): ${c.title}${c.body ? ` — ${c.body}` : ''}`)
  if (!(b.features ?? []).length && !(b.decisions ?? []).length && !(b.concerns ?? []).length) say('(nothing recorded yet)')
}

export async function overviewSave(args) {
  const { root } = linkedProject()
  const file = path.resolve(textArg(args) || faundrPath(root, 'overview'))
  let content
  try {
    content = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`Could not read ${file} as JSON: ${err.message}`)
  }
  const r = await overviewApi({
    action: 'save',
    content,
    commit: gitHead(root),
    agent: AGENT,
    agentSessionId: AGENT_SESSION_ID ?? null,
  })
  console.log(`Project overview saved: ${r.steps} steps in "how it works", ${r.parts} parts. It already shows under Project overview on the dashboard.`)
}

// Diagrama "como vai funcionar" da funcionalidade (skill planning, opcional): o servidor confere e devolve os erros
// em português, para o Claude corrigir só o que falhou.
export async function diagramSave(args) {
  const { root, projectId, config } = linkedProject()
  const file = path.resolve(textArg(args) || faundrPath(root, 'diagram'))
  let spec
  try {
    spec = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`Could not read ${file} as JSON: ${err.message}`)
  }
  // --architecture: a arquitetura do projeto inteiro (seção Arquitetura do painel); sem ela, o diagrama da funcionalidade.
  const architecture = args.includes('--architecture')
  const feature = architecture ? null : await findFeature(flag(args, '--feature') ?? 'current', currentFeature(root))
  const res = await fetch(`${config.apiUrl}/api/cli/diagrams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, action: 'save', kind: architecture ? 'architecture' : 'feature', featureId: feature?.id, spec }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  if (!data.saved) {
    console.log(`The diagram has ${data.errors.length} problem(s). Fix only these points in ${file} and run it again:`)
    for (const e of data.errors) console.log(`  - ${e}`)
    process.exitCode = 1
    return
  }
  if (architecture) {
    console.log(`Project architecture saved (version ${data.version}). It already shows on the dashboard, under Architecture (project menu).`)
    // Confere de novo na hora: a peça nova (ou a pasta acrescentada) já sai do "Fora do plano".
    return architectureCheck([]).catch((err) => console.log(`Could not check the code now: ${err.message}`))
  }
  console.log(`Diagram saved on "${data.feature}" (version ${data.version}).`)
  // Como um Artifact: abre o canvas para o dono e espera ele aprovar ou pedir mudanças (--no-wait: só salva).
  const url = `${config.apiUrl}/app/projects/${projectId}?secao=features&item=${data.featureId}&canvas=1`
  if (args.includes('--no-wait')) return console.log(`Canvas: ${url}`)
  openBrowser(url)
  console.log(`Opened the canvas in the browser for the owner to review: ${url}`)
  await waitReview(projectId, config, data.featureId)
}

// Espera a revisão do desenho no canvas (o comando do agente roda no máximo 10 min; diagram-wait continua).
const REVIEW_WAIT_MS = 9 * 60_000

export async function diagramWait(args) {
  const { root, projectId, config } = linkedProject()
  const feature = await findFeature(flag(args, '--feature') ?? 'current', currentFeature(root))
  await waitReview(projectId, config, feature.id)
}

async function waitReview(projectId, config, featureId) {
  console.log('Waiting for the owner to approve or ask for changes on the canvas…')
  const until = Date.now() + REVIEW_WAIT_MS
  while (Date.now() < until) {
    const res = await fetch(`${config.apiUrl}/api/cli/diagrams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ projectId, action: 'review', featureId }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {
      // Sem rede agora: tenta de novo na próxima volta da espera.
      return null
    })
    const data = res?.ok ? await res.json().catch(() => ({})) : {}
    const who = data.by ? ` (${data.by})` : ''
    if (data.status === 'approved')
      return console.log(`The owner APPROVED the drawing${who}. You can build: record what is missing in Faundr and start with the first step.`)
    if (data.status === 'changes') {
      console.log(`The owner ASKED FOR CHANGES to the drawing${who}: ${data.reason ? `"${data.reason}"` : '(no reason written; ask what to change)'}`)
      return console.log('Adjust the drawing (and the plan, if something changed) and save it again with faundr diagram-save: the canvas opens again for them to review. Do not build before the OK.')
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  console.log('No answer in 9 minutes. To keep waiting, run faundr diagram-wait; or ask the owner in the terminal whether they approve the drawing.')
}

// Planejado x construído (sem IA): pega a arquitetura do projeto, confere os caminhos de cada peça nos arquivos e
// manda ao painel. Só envia quando o resultado muda.
export async function architectureCheck(args) {
  const { root, projectId, config } = linkedProject()
  const api = async (body) => {
    const res = await fetch(`${config.apiUrl}/api/cli/diagrams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ projectId, ...body }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
    return data
  }
  const quiet = args.includes('--quiet')
  const { spec, marked = [], autoFit = false } = await api({ action: 'architecture' })
  // --pull: grava a arquitetura atual para o agente editar (ex.: pôr uma pasta fora do plano nos paths de uma peça).
  if (args.includes('--pull')) {
    if (!spec) return console.log('The project has no architecture yet (Architecture (project menu)).')
    const file = ensureFaundrPath(root, 'architecture')
    fs.writeFileSync(file, JSON.stringify(spec, null, 2))
    const rel = path.relative(root, file).split(path.sep).join('/')
    return console.log(`Current architecture in ${rel}. Edit it and send it with: faundr diagram-save ${rel} --architecture`)
  }
  if (!spec?.nodes?.some((n) => Array.isArray(n.paths) && n.paths.length)) {
    if (!quiet) console.log('The project has no architecture with paths to check (Architecture (project menu)).')
    return
  }
  const files = projectFiles(root).files
  const built = checkBuilt(spec, files)
  let ignore = []
  try {
    ignore = readIgnore(fs.readFileSync(path.join(root, '.faundrignore'), 'utf8'))
  } catch {
    // Sem .faundrignore: nenhuma pasta marcada como fora.
  }
  // O painel recebe a lista completa e esconde as pastas marcadas como fora de propósito (assim "voltar" devolve a pasta
  // na hora); o aviso no terminal e o resumo daqui já pulam as marcadas.
  const { names: all, ...outside } = offPlan(spec, files, ignore)
  const { names, ...shown } = offPlan(spec, files, ignore, marked)
  // Pasta nova fora do plano: o próximo pedido desta sessão leva o aviso (uma vez; a seguinte já conhece a pasta).
  // As já vistas incluem as marcadas: desmarcar uma pasta no painel não a torna "nova".
  const fresh = newOffPlan(names, readState(root).offPlanSeen)
  const sid = flag(args, '--session')
  if (fresh.length && sid) addSessionNotes(root, sid, [offPlanNote(fresh, shown, autoFit)])
  writeState(root, { offPlanSeen: all })
  const key = JSON.stringify({ built, outside })
  if (readState(root).architectureChecked === key && quiet) return
  await api({ action: 'built', built, offPlan: outside })
  writeState(root, { architectureChecked: key })
  if (quiet) return
  const parts = Object.values(built)
  console.log(`Architecture checked: ${parts.filter((p) => p.built).length} of ${parts.length} parts with paths already exist in the code. It already shows under Architecture (project menu).`)
  if (shown.folders.length)
    console.log(`Outside the plan (${shown.total} code files in no part): ${shown.folders.map((f) => `${f.folder} (${f.files})`).join(', ')}${shown.more ? ` and ${shown.more} more folder(s)` : ''}.`)
}

function offPlanNote(fresh, outside, autoFit = false) {
  const count = new Map(outside.folders.map((f) => [f.folder, f.files]))
  const list = fresh
    .slice(0, 5)
    .map((f) => (count.has(f) ? `${f} (${count.get(f)} file${count.get(f) === 1 ? '' : 's'})` : f))
    .join(', ')
  // Encaixe sozinho (ligado pelo dono no painel): o Claude encaixa sem perguntar e só avisa onde pôs.
  if (autoFit)
    return (
      `code showed up outside the project architecture: ${list}${fresh.length > 5 ? ' and others' : ''}. The owner turned on auto-fit: ` +
      'look at the code in each folder and put it in the most likely part of the architecture, without asking (faundr architecture-check --pull, ' +
      'add the folder to the paths of the part and faundr diagram-save .faundr/painel/architecture.json --architecture). If no part fits, ' +
      'do not create a new part on your own: suggest it to the user. Then say in one line where you put each folder (they can ask to change it).'
    )
  return (
    `code showed up outside the project architecture: ${list}${fresh.length > 5 ? ' and others' : ''}. Tell the user in one line and suggest, ` +
    'looking at the code, whether it fits in an existing part (say which) or becomes a new part. Only change the architecture with their OK: ' +
    'faundr architecture-check --pull, add the folder to the paths of the part (or create the part) and faundr diagram-save .faundr/painel/architecture.json --architecture. ' +
    'If it is outside the plan on purpose, they mark the folder in Architecture → Outside the plan → On purpose.'
  )
}
