// Funcionalidades, tarefas e decisões: faundr feature, task, start, done, criteria, decision, rule, concern, resolve,
// claim/release, own/disown, focus, board, feature-discard/restore e memory-edit.

import path from 'node:path'
import { readMemoryIndex, readRules, writeMemoryIndex, writeRules } from './rules.mjs'
import { statusFromBoard } from './statusline.mjs'
import { t } from './i18n.mjs'
import { AGENT_SESSION_ID, currentFeature, firstOf, flag, flags, gitHead, linkedProject, log, MARK, readState, setCurrentFeature, textArg, uncommittedChanges, writeState } from './cli-core.mjs'
import { sessionEditedFiles } from './hook-stop.mjs'

// ---- funcionalidades, tarefas e decisões ----------------------------------------------------

export async function memoryApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/memory`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  // Seguiu com o OK na funcionalidade de outra pessoa: o servidor mandou um recado ao dono.
  if (data.notified) console.log(`Faundr sent ${data.notified} a message saying what you changed (it reaches them at their next question). Tell the user.`)
  return data
}

// "ontem", "há 3 dias": quando o dono mexeu e quando esteve no projeto (o servidor manda as datas).
function ago(iso) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
function recency(r) {
  const parts = [r?.changedAt && `last change on it ${ago(r.changedAt)}`, r?.ownerSeenAt && `the owner was last in the project ${ago(r.ownerSeenAt)}`].filter(Boolean)
  return parts.length ? ` (${parts.join('; ')})` : ''
}

// Funcionalidade pelo nome (ou "atual"), para --after e --feature.
export async function findFeature(query, current) {
  const { allFeatures, features } = await memoryApi({ action: 'board' })
  const list = allFeatures ?? features
  if (query === 'current' || query === 'atual') {
    const f = list.find((x) => x.id === current)
    if (!f) throw new Error('There is no current feature in this folder. Use the name of the previous stage.')
    return f
  }
  const q = query.toLowerCase()
  const f = list.find((x) => x.id === query) ?? list.find((x) => x.title.toLowerCase() === q) ?? list.find((x) => x.title.toLowerCase().includes(q))
  if (!f) throw new Error(`No feature found for "${query}". Existing: ${list.map((x) => x.title).join('; ') || '(none)'}`)
  return f
}

function printFeature(f, byId, people) {
  const done = f.tasks.filter((t) => t.task_status === 'completed').length
  const prev = f.after && byId?.get(f.after)
  const name = (id) => (id && people?.[id]) || null
  console.log(
    `${f.title}  (${done}/${f.tasks.length} done)${f.planned ? '  [planned]' : ''}${name(f.assignee_id) ? `  · owner: ${name(f.assignee_id)}` : ''}${prev ? `  · comes after "${prev.title}"` : ''}`,
  )
  // Tarefa passada para outra pessoa (não a dona da funcionalidade) mostra com quem está.
  f.tasks.forEach((t, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${MARK[t.task_status] ?? '[ ]'} ${t.title}${t.done_dirty ? '  (not committed)' : ''}${t.assignee_id && t.assignee_id !== f.assignee_id && name(t.assignee_id) ? `  (with ${name(t.assignee_id)})` : ''}`,
    ),
  )
  if (!f.tasks.length) console.log('  (no tasks yet — faundr task "<description>")')
  if (f.criteria?.length)
    console.log(`  Done when: ${f.criteria.map((c, i) => `${i + 1}. ${c.text}${firstOf([[c.met === true, ' [met]'], [c.met === false, ' [not met]']], '')}`).join(' ')}`)
  const next = (f.next ?? []).map((id) => byId?.get(id)).filter(Boolean)
  if (next.length) console.log(`  → next stage: ${next.map((n) => `"${n.title}"${n.finished ? ' (done)' : ''}`).join(', ')}`)
}

// Arquivos que esta sessão editou, para ligar a decisão a eles: só quando são poucos (1 a 5) e específicos. Arquivo
// que já tem 3+ regras e decisões ligadas é central demais (mexe-se nele o tempo todo) e fica de fora.
const AUTO_ANCHOR_MAX = 5
function autoAnchor(root) {
  // A sessão que rodou o comando; o sessionStart é da última sessão aberta na pasta (pode ser outra).
  const sid = AGENT_SESSION_ID ?? readState(root).sessionStart?.session
  if (!sid) return []
  const crowded = new Map()
  for (const m of readMemoryIndex(root)) for (const p of m.paths ?? []) crowded.set(p, (crowded.get(p) ?? 0) + 1)
  const files = sessionEditedFiles(sid)
    .map((f) => path.relative(root, path.resolve(f)).split(path.sep).join('/'))
    .filter((rel) => rel && !rel.startsWith('..') && !rel.startsWith('.faundr/') && !/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(rel))
    .filter((rel) => (crowded.get(rel) ?? 0) < 3)
  const unique = [...new Set(files)]
  return unique.length >= 1 && unique.length <= AUTO_ANCHOR_MAX ? unique : []
}

// Mudar uma regra ou decisão já registrada: virar regra (vale sempre) ou decisão, ligar a arquivos, voltar a valer
// para o projeto todo ou aposentar.
export async function memoryEdit(args) {
  const { root } = linkedProject()
  const query = textArg(args)
  const files = flags(args, '--file')
  const kind = firstOf([[args.includes('--rule'), 'rule'], [args.includes('--decision'), 'decision']], undefined)
  const obsolete = args.includes('--obsolete')
  const paths = firstOf([[args.includes('--global'), []], [files.length, files]], undefined)
  if (!query || (!kind && !obsolete && paths === undefined))
    throw new Error('usage: faundr memory-edit "<id or title snippet>" [--rule | --decision] [--file "<path>"]... [--global] [--obsolete]')
  const r = await memoryApi({ action: 'memory-edit', query, kind, paths, obsolete })
  // Cópias locais: o guard e o hook do pedido passam a ver a mudança já nesta sessão.
  const index = readMemoryIndex(root)
  const item = index.find((m) => m.id === r.id)
  writeMemoryIndex(root, obsolete ? index.filter((m) => m.id !== r.id) : index.map((m) => (m.id === r.id ? { ...m, kind: r.kind, paths: r.paths } : m)))
  const rules = readRules(root).filter((x) => x.id !== r.id)
  if (!obsolete && r.paths.length) rules.push({ id: r.id, kind: r.kind, title: r.title, body: item?.body ?? '', paths: r.paths })
  writeRules(root, rules)
  const name = r.kind === 'rule' ? 'Rule' : 'Decision'
  if (obsolete) return console.log(`Retired: ${r.title}`)
  console.log(`${name}: ${r.title}\n${memoryReach(r)}`)
}

// Quando a regra ou decisão chega ao agente.
function memoryReach(r) {
  if (r.paths.length) return `Linked to ${r.paths.join(', ')}: reaches the agent before it edits those files and when the request is about the subject.`
  return r.kind === 'rule'
    ? 'Applies to the whole project: goes in at the start of every session and in subagents.'
    : 'Applies to the whole project: goes in at the start of the session while it is recent, and when the request is about the subject.'
}

export async function work(command, args) {
  await workCommand(command, args)
  // A barra de status lê o resumo do arquivo de estado: atualiza depois de mexer no quadro.
  if (['feature', 'task', 'done', 'start', 'claim', 'own', 'disown', 'focus', 'concern', 'resolve', 'feature-discard', 'feature-restore'].includes(command)) await refreshStatus().catch((err) => log(`status: ${err?.message ?? err}`))
}

/** Guarda em .faundr/state.json o resumo que a barra de status mostra (projeto, funcionalidade, passo, preocupações). */
export async function refreshStatus() {
  const { root } = linkedProject()
  const current = currentFeature(root)
  const b = await memoryApi({ action: 'board' })
  writeState(root, { status: statusFromBoard(b, current, b.projectName) })
}

async function workCommand(command, args) {
  const { root } = linkedProject()
  const current = currentFeature(root)
  const text = textArg(args)
  // Último registro de trabalho: o fim da resposta só cobra o registro quando a sessão mudou muito e nada veio.
  if (['feature', 'task', 'done', 'start', 'focus'].includes(command)) writeState(root, { workAt: Date.now() })
  if (Object.hasOwn(WORK_HANDLERS, command)) return WORK_HANDLERS[command]({ command, args, root, current, text })
}

async function workFeature({ args, root, current, text }) {
  if (!text) throw new Error('usage: faundr feature "<title>" [--desc "..."] [--done-when "a; b"] [--after current|"<name of the previous stage>"] [--existing --parts "a; b"]')
  const after = flag(args, '--after')
  if (!args.includes('--existing') && (await reusePlannedStage(root, args, text, after))) return
  if (after) {
    // Próxima etapa: fica planejada, ligada à anterior; a funcionalidade atual não muda.
    const prev = await findFeature(after, current)
    const { id } = await memoryApi({ action: 'add', kind: 'feature', title: text, body: flag(args, '--desc'), afterId: prev.id })
    writeState(root, { lastStepId: id })
    return console.log(`Next stage recorded (after "${prev.title}"): ${text}\nIts tasks: faundr task "<step>" --feature "${text}". To start it: faundr focus "${text}".`)
  }
  if (args.includes('--existing')) return workExistingFeature(args, text)
  const criteria = (flag(args, '--done-when') ?? '').split(';').map((c) => c.trim()).filter(Boolean)
  const { id } = await memoryApi({ action: 'add', kind: 'feature', title: text, body: flag(args, '--desc'), criteria })
  setCurrentFeature(root, id)
  console.log(`Feature created and set as current: ${text}`)
  if (criteria.length) console.log(`Done when: ${criteria.map((c, i) => `${i + 1}. ${c}`).join(' ')}`)
}

// Já existe uma etapa com esse nome, ainda sem terminar: usa ela em vez de criar outra igual (a etapa planejada ficava
// vazia no quadro, ao lado da cópia com o trabalho). Com --after, só avisa; sem, ela vira a atual.
async function reusePlannedStage(root, args, text, after) {
  const { allFeatures = [] } = await memoryApi({ action: 'board' })
  const same = allFeatures.find((f) => !f.finished && f.title.trim().toLowerCase() === text.trim().toLowerCase())
  if (!same) return false
  if (after) {
    console.log(`Already recorded: "${same.title}" (${same.planned ? 'planned stage' : 'in progress'}). Nothing new created.`)
    return true
  }
  setCurrentFeature(root, same.id)
  const criteria = (flag(args, '--done-when') ?? '').split(';').map((c) => c.trim()).filter(Boolean)
  for (const c of criteria) await memoryApi({ action: 'criteria', featureId: same.id, text: c })
  console.log(`"${same.title}" was already on the board${same.planned ? ' as a planned stage' : ''}: it is now the current feature (no copy created).`)
  if (criteria.length) console.log(`Done when added: ${criteria.map((c, i) => `${i + 1}. ${c}`).join(' ')}`)
  return true
}

// Inventário de projeto antigo: o que já funcionava antes do Faundr entra pronto e não vira a atual.
async function workExistingFeature(args, text) {
  const parts = (flag(args, '--parts') ?? '').split(';').map((p) => p.trim()).filter(Boolean)
  const desc = [flag(args, '--desc'), t('Already existed before Faundr (code inventory).', 'Já existia antes do Faundr (inventário do código).')].filter(Boolean).join(' ')
  const { id } = await memoryApi({ action: 'add', kind: 'feature', title: text, body: desc })
  const tasks = parts.length ? parts : [t('Already existed before Faundr', 'Já existia antes do Faundr')]
  for (const title of tasks) {
    const task = await memoryApi({ action: 'add', kind: 'task', title, parentId: id })
    await memoryApi({ action: 'task-status', query: task.id, status: 'completed', featureId: id })
  }
  return console.log(`Existing feature recorded as done: ${text} (${tasks.length} part(s))`)
}

// A funcionalidade de --feature "<nome>" ou, sem ele, a atual (null se não há nenhuma).
async function targetFeature(args, current) {
  const target = flag(args, '--feature')
  if (target) return findFeature(target, current)
  return current ? { id: current } : null
}

function criterionMark(c) {
  if (c.met === true) return '[met]'
  return c.met === false ? '[not met]' : '[to check]'
}

async function workCriteria({ args, current, text }) {
  const f = await targetFeature(args, current)
  if (!f) throw new Error('No current feature: use --feature "<name>" or faundr focus "<name>".')
  const remove = Number(flag(args, '--remove'))
  const force = args.includes('--force')
  if (remove) {
    const r = await memoryApi({ action: 'criteria-remove', featureId: f.id, index: remove, force })
    if (ownerBlocked(r.blocked, `faundr criteria --remove ${remove} --force`)) return
    return console.log(`Criterion ${remove} removed from "${r.title}" (${r.criteria.length} left).`)
  }
  if (!text) {
    const { features } = await memoryApi({ action: 'board', featureId: f.id })
    const list = features[0]?.criteria ?? []
    if (!list.length) return console.log('No Done when yet. To add one: faundr criteria "<how to tell it is done>"')
    console.log(`Done when (${features[0].title}):`)
    return list.forEach((c, i) => console.log(`  ${i + 1}. ${criterionMark(c)} ${c.text}${c.note ? ` (${c.note})` : ''}`))
  }
  const r = await memoryApi({ action: 'criteria', featureId: f.id, text, force })
  if (ownerBlocked(r.blocked, `faundr criteria "${text}" --force`)) return
  return console.log(`Done when criterion ${r.criteria.length} on "${r.title}": ${text}`)
}

// --met → true, --not-met → false, sem nenhum → null.
function metFlag(args) {
  if (args.includes('--met')) return true
  return args.includes('--not-met') ? false : null
}

async function workCriteriaCheck({ args, current, text }) {
  const n = Number(text)
  const met = metFlag(args)
  if (!n || met === null) throw new Error('usage: faundr criteria-check <#> --met|--not-met [--note "how you checked"] [--feature "<name>"]')
  const f = await targetFeature(args, current)
  if (!f) throw new Error('No current feature: use --feature "<name>".')
  const r = await memoryApi({ action: 'criteria-check', featureId: f.id, index: n, met, note: flag(args, '--note'), force: args.includes('--force') })
  if (ownerBlocked(r.blocked, `faundr criteria-check ${n} ${met ? '--met' : '--not-met'} --force`)) return
  const open = r.criteria.filter((c) => c.met !== true).length
  return console.log(`Criterion ${n} of "${r.title}": ${met ? 'met' : 'not met'}. ${open ? `${open} not met yet.` : 'All met.'}`)
}

async function workTask({ args, current, text }) {
  if (!text) throw new Error('usage: faundr task "<description>" [--feature "<stage name>"] [--force]')
  const target = flag(args, '--feature')
  const parent = target ? await findFeature(target, current) : null
  if (!parent && current && !args.includes('--force') && (await finishedWithEmptyNext(current, text))) return
  const r = await memoryApi({ action: 'add', kind: 'task', title: text, parentId: parent?.id ?? current, force: args.includes('--force') })
  if (ownerBlocked(r.blocked, `faundr task "${text}"${target ? ` --feature "${target}"` : ''} --force`)) return
  if (parent) return console.log(`Task added to "${parent.title}": ${text}`)
  return console.log(current ? `Task added: ${text}` : `Task added (no current feature — use faundr feature "<title>" to group it): ${text}`)
}

// A atual já terminou e a próxima etapa está vazia: a tarefa nova quase sempre é dessa etapa (o trabalho da etapa
// caía na funcionalidade pronta e a etapa ficava no quadro sem nada). Não grava; diz como seguir.
async function finishedWithEmptyNext(current, text) {
  const { allFeatures = [] } = await memoryApi({ action: 'board' })
  const byId = new Map(allFeatures.map((f) => [f.id, f]))
  const f = byId.get(current)
  const next = f?.finished && (f.next ?? []).map((id) => byId.get(id)).find((n) => n && !n.finished && !n.tasks.length)
  if (!next) return false
  console.log(
    `Nothing saved: "${f.title}" is already finished and its next stage "${next.title}" has no tasks yet. If this task is part of that stage, start it first: faundr focus "${next.title}" (then faundr task again). If it really belongs to "${f.title}": faundr task "${text}" --force`,
  )
  return true
}

// Arquivos da regra ou decisão: os de --file; com padrão proibido e sem arquivos, o projeto todo; senão, os automáticos.
function memoryPaths(explicit, forbid, auto) {
  if (explicit.length) return explicit
  return forbid ? ['**'] : auto
}

async function workMemory({ command, args, root, current, text }) {
  if (!text) throw new Error(`usage: faundr ${command} "<title>" [--why "<reason>"] [--file "<file or pattern, e.g. src/server/**>"]...`)
  const forbid = flag(args, '--forbid') ?? null
  if (forbid)
    try {
      new RegExp(forbid)
    } catch {
      throw new Error(`Invalid pattern in --forbid: ${forbid} (it is a regular expression; e.g. "console\\.log\\(" or "from ['\\"]axios['\\"]")`)
    }
  // Com padrão proibido e sem arquivos, vale para o projeto todo. Decisão sem --file: liga sozinha aos arquivos
  // que esta sessão editou (quando são poucos), para chegar na hora de mexer neles.
  const explicit = flags(args, '--file')
  const auto = !explicit.length && !forbid && command === 'decision' && !args.includes('--global') ? autoAnchor(root) : []
  const paths = memoryPaths(explicit, forbid, auto)
  const body = flag(args, '--why')
  const replaces = flag(args, '--replaces')
  const r = await memoryApi({ action: 'add', kind: command, title: text, body, parentId: command === 'decision' ? current : null, paths, forbid, replaces })
  const { id } = r
  // Já vale nesta sessão: entra nas cópias locais (o guard lê antes de cada edição; o hook do pedido, pelo assunto).
  if (paths.length) writeRules(root, [...readRules(root).filter((x) => x.id !== id), { id, kind: command, title: text, body: body ?? '', paths, forbid }])
  const index = readMemoryIndex(root).filter((m) => m.id !== id && m.id !== r.replaced?.id)
  writeMemoryIndex(root, [...index, { id, kind: command, title: text, body: (body ?? '').replace(/\s+/g, ' ').slice(0, 300), paths }])
  if (r.replaced) writeRules(root, readRules(root).filter((x) => x.id !== r.replaced.id))
  printMemoryAdded(command, r, { text, paths, auto, forbid })
}

function printMemoryAdded(command, r, { text, paths, auto, forbid }) {
  const name = command === 'rule' ? 'Rule' : 'Decision'
  const short = r.id.slice(0, 6)
  if (!paths.length) console.log(`${name} recorded (${short}): ${text}`)
  else if (auto.length)
    console.log(
      `${name} recorded (${short}), linked to the files this session edited: ${paths.join(', ')}.\nIt reaches the agent before it edits those files and when a request is about the subject. If it applies to the whole project: faundr memory-edit ${short} --global`,
    )
  else console.log(`${name} recorded (${short}), linked to ${paths.join(', ')}: ${text}\nIt no longer goes in at the start of the session; it reaches the agent before it edits one of those files.`)
  if (forbid) console.log(`The code must not contain: ${forbid}. Faundr warns before an edit that brings it in, and the quality check points out where it already exists.`)
  if (r.replaced) console.log(`Replaces "${r.replaced.title}", which is now obsolete.`)
  if (r.similar?.length)
    console.log(
      `Looks like: ${r.similar.map((m) => `${m.id.slice(0, 6)} "${m.title}"`).join('; ')}. If this one replaces one of them, retire the old one: faundr memory-edit <id> --obsolete (or record it again with --replaces <id>). If they are different things, nothing to do.`,
    )
}

async function workConcern({ args, text }) {
  if (!text) throw new Error('usage: faundr concern "<what worries you>" [--why "<details, what to review>"]')
  const r = await memoryApi({ action: 'add', kind: 'concern', title: text, body: flag(args, '--why') })
  console.log(`Concern P-${r.ref} recorded (open, to review later): ${text}`)
  return console.log(`To close it: faundr resolve P-${r.ref}`)
}

async function workResolve({ text }) {
  if (!text) {
    // Sem argumento: lista as abertas para escolher.
    const { concerns } = await memoryApi({ action: 'board' })
    if (!concerns?.length) return console.log('No open concerns.')
    console.log('Open concerns:')
    for (const c of concerns) console.log(`  P-${c.ref}  ${c.title}`)
    return console.log('To resolve one: faundr resolve P-<n>')
  }
  const r = await memoryApi({ action: 'resolve', query: text })
  return console.log(`Concern P-${r.ref} resolved: ${r.title}`)
}

// done e start: muda a situação da tarefa.
async function workTaskStatus({ command, args, root, current, text }) {
  if (!text) throw new Error(`usage: faundr ${command} "<snippet of the task name or #>"`)
  // Ao concluir: o commit do momento e se há mudanças fora de commit (a tarefa fica marcada até o próximo commit).
  // --already-committed: trabalho antigo, já no git (revisão do quadro); as mudanças de agora não são dele.
  const dirty = command === 'done' && !args.includes('--already-committed') ? uncommittedChanges(root) : 0
  const r = await memoryApi({
    action: 'task-status',
    query: text,
    status: command === 'done' ? 'completed' : 'in_progress',
    featureId: current,
    force: args.includes('--force'),
    ...(command === 'done' && { commit: gitHead(root), dirty: dirty > 0 }),
  })
  if (ownerBlocked(r.blocked, `faundr ${command} "${text}" --force`)) return
  console.log(`${command === 'done' ? 'Done' : 'In progress'}: ${r.title}`)
  if (dirty)
    console.log(
      `Note: ${dirty} file(s) with uncommitted changes. The task shows as "not committed" on the dashboard until the next git commit; if its work is in those changes, commit them (with the user's OK) or tell them it is still pending.`,
    )
}

// pegar e soltar: quem está com a tarefa.
async function workAssign({ command, args, current, text }) {
  if (!text) throw new Error(`usage: faundr ${command} "<snippet of the task name or #>" [--force]`)
  const release = command === 'release'
  const r = await memoryApi({ action: 'task-assign', query: text, featureId: current, release, force: args.includes('--force') })
  if (release)
    return console.log(
      r.released ? `Task released: ${r.title} (anyone can take it).` : `The task "${r.title}" belongs to ${r.by}: only they can release it. To release it anyway (with the user's OK): faundr release "${text}" --force`,
    )
  if (!r.taken)
    return console.log(
      `Note: the task "${r.title}" already belongs to ${r.by}${r.feature ? ` (owner of the feature "${r.feature}")` : ''}${r.at ? ` (taken on ${new Date(r.at).toLocaleString('en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})` : ''}${recency(r)}. Do not touch it without agreeing first: tell the user and, if they confirm it is fine, run faundr claim "${text}" --force.`,
    )
  return console.log(`Task taken: ${r.title}${r.from ? ` (was ${r.from}'s)` : ''}. It shows with your name on the dashboard; when you finish, faundr done "${text}".`)
}

// Funcionalidade (ou tarefa) de outra pessoa: o comando não gravou. Mostra o aviso e como seguir com o OK.
function ownerBlocked(b, retry) {
  if (!b) return false
  const day = b.since ? ` (owner since ${b.since.slice(0, 10)})` : ''
  console.log(
    `Note: "${b.title}" belongs to ${b.ownerName}${day}${recency(b)}. Nothing was saved. Do not touch it without agreeing first: tell the user (whose it is and when they last touched it) and, if they confirm it is fine, run: ${retry} — Faundr then sends ${b.ownerName} a message saying what changed.`,
  )
  return true
}

// dono e soltar-dono: quem é o dono da funcionalidade (sem nome, a atual).
async function workOwner({ command, args, current, text }) {
  const query = text || current
  if (!query) throw new Error(`usage: faundr ${command} "<feature name or id>"${command === 'own' ? ' [--force]' : ''}`)
  const release = command === 'disown'
  const r = await memoryApi({ action: 'feature-owner', query, release, force: args.includes('--force') })
  if (!r.done)
    return console.log(
      `Note: the feature "${r.title}" belongs to ${r.by}${recency(r)}. Do not ${release ? 'release' : 'take'} it without agreeing first: tell the user and, if they confirm, run faundr ${command} "${text || r.id.slice(0, 8)}" --force.`,
    )
  if (release) return console.log(`Feature without an owner: ${r.title} (whoever touches it first becomes the owner).`)
  return console.log(`You are the owner of "${r.title}"${r.from ? ` (was ${r.from}'s)` : ''}. Other people's agents will warn before touching it.`)
}

async function workFocus({ root, text }) {
  const { features, people, me } = await memoryApi({ action: 'board' })
  const q = text.toLowerCase()
  // Nome exato antes de "contém": "Stacks de startups" não pode cair em "Hub fase 2: stacks de startups e montador".
  const f = features.find((x) => x.id === text) ?? features.find((x) => x.title.toLowerCase() === q) ?? features.find((x) => x.title.toLowerCase().includes(q))
  if (!f) throw new Error(`No feature found for "${text}". Existing: ${features.map((x) => x.title).join('; ') || '(none)'}`)
  setCurrentFeature(root, f.id)
  console.log('Current feature:')
  printFeature(f, new Map(features.map((x) => [x.id, x])), people)
  if (f.assignee_id && f.assignee_id !== me)
    console.log(`\nNote: this feature belongs to ${people?.[f.assignee_id] ?? 'someone else'}. Agree with the user before touching it; the commands (task, done, start, criteria) warn and only save with --force.`)
}

async function workBoard({ args, current }) {
  const all = args.includes('--all') || !current
  const { features, orphanTasks, concerns, allFeatures, decisions, people } = await memoryApi({ action: 'board', featureId: all ? null : current })
  const byId = new Map((allFeatures ?? features).map((f) => [f.id, f]))
  // --memory: as regras e decisões confirmadas (para conferir o código contra elas).
  if (args.includes('--memory')) return printDecisions(decisions)
  if (args.includes('--review')) return printReview(allFeatures ?? features, current)
  if (concerns?.length) {
    console.log('Open concerns (to review):')
    concerns.forEach((c) => console.log(`  P-${c.ref}  ${c.title}${c.body ? ` — ${c.body}` : ''}`))
    console.log('')
  }
  if (!features.length && !orphanTasks?.length) return console.log('No features yet. Create one with: faundr feature "<title>"')
  for (const f of features) {
    if (f.id === current) console.log('>> current')
    printFeature(f, byId, people)
    console.log('')
  }
  if (orphanTasks?.length) printFeature({ title: 'Tasks without a feature', tasks: orphanTasks })
}

// Tudo o que está aberto no quadro (em andamento e próximas etapas), com datas e id curto, para a skill quadro
// conferir cada item contra os commits e o código.
function printReview(all, current) {
  const day = (iso) => (iso ? iso.slice(0, 10) : '?')
  const open = all.filter((f) => !f.finished)
  const byId = new Map(all.map((f) => [f.id, f]))
  if (!open.length) return console.log('Nothing open on the board: all features are done.')
  const groups = [
    ['In progress', open.filter((f) => !f.planned)],
    ['Next stages (planned)', open.filter((f) => f.planned)],
  ]
  for (const [label, list] of groups) {
    if (!list.length) continue
    console.log(`## ${label} (${list.length})`)
    for (const f of list) {
      const done = f.tasks.filter((t) => t.task_status === 'completed').length
      const prev = f.after && byId.get(f.after)
      const tags = [f.id === current && 'current', f.stale && 'stalled'].filter(Boolean)
      console.log(
        `[${f.id.slice(0, 8)}] ${f.title}  (${done}/${f.tasks.length})${tags.length ? `  [${tags.join(', ')}]` : ''}  created ${day(f.created_at)}, touched ${day(f.touched)}${prev ? `  · comes after "${prev.title}"` : ''}`,
      )
      if (f.body) console.log(`    ${f.body}`)
      f.tasks.filter((t) => t.task_status !== 'completed').forEach((t) => console.log(`    ${MARK[t.task_status] ?? '[ ]'} [${t.id.slice(0, 8)}] ${t.title}`))
      if (!f.tasks.length) console.log('    (no tasks)')
    }
    console.log('')
  }
}

async function workDiscard({ command, text }) {
  if (!text) throw new Error(`usage: faundr ${command} "<feature id or name>"`)
  const restore = command === 'feature-restore'
  const r = await memoryApi({ action: 'feature-discard', query: text, restore })
  return console.log(restore ? `Restored: ${r.title}` : `Discarded: ${r.title} (leaves the tabs; to bring it back: faundr feature-restore "${r.id.slice(0, 8)}")`)
}

function printDecisions(decisions) {
  if (!decisions?.length) return console.log('No rules or decisions recorded.')
  console.log('Confirmed rules and decisions:')
  decisions.forEach((d, i) =>
    console.log(
      `  ${i + 1}.${d.id ? ` [${d.id.slice(0, 6)}]` : ''} ${d.kind === 'rule' ? 'Rule' : 'Decision'}: ${d.title}${d.body ? ` — ${d.body}` : ''}${d.paths?.length ? ` [files: ${d.paths.join(', ')}]` : ''}${d.forbid ? ` [the code must not contain: ${d.forbid}]` : ''}`,
    ),
  )
}

// Cada comando do quadro de trabalho (faundr feature, task, done…) e quem cuida dele.
const WORK_HANDLERS = {
  feature: workFeature,
  criteria: workCriteria,
  'criteria-check': workCriteriaCheck,
  task: workTask,
  decision: workMemory,
  rule: workMemory,
  concern: workConcern,
  resolve: workResolve,
  done: workTaskStatus,
  start: workTaskStatus,
  claim: workAssign,
  release: workAssign,
  own: workOwner,
  disown: workOwner,
  focus: workFocus,
  board: workBoard,
  'feature-discard': workDiscard,
  'feature-restore': workDiscard,
}
