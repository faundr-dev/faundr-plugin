// Workflows e skills ligados ao Faundr: faundr workflow e faundr skills.

import { createHash } from 'node:crypto'
import { readSkillIndex, scanSkills, writeSkillIndex } from './skills.mjs'
import { parseItem } from './workflows.mjs'
import { AGENT_SESSION_ID, flag, flags, linkedProject, readState, textArg, writeState } from './cli-core.mjs'
import { ownerSaid, runOf, saveRun } from './workflow-run.mjs'

// Workflows do projeto: o Claude lista, lê os passos e cria rascunho; aprovar e editar ficam com o dono no painel.
async function workflowApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/workflows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

const WORKFLOW_USAGE = `usage:
  faundr workflow list
  faundr workflow show <W-n or name>
  faundr workflow draft "<name>" --when "<when to use>" --topic "<subject>"... [--file "<path or pattern>"]... --step "<step>"...
  faundr workflow run <W-n> --why "<request in one line>"      (starts following it; step 1 in progress)
  faundr workflow step <W-n> <step> [--wait | --skip | --done] [--note "<note>"] [--answer "<the owner's words>"]
     (a question step only closes with --answer: the owner's reply after you asked, or the words of the request that
      already answered it; skipping any step needs --answer with the owner's OK. The words must be in their messages.)
  faundr workflow done <W-n> [--note "<result>"]   |   faundr workflow stop <W-n>
Step: free text (a task) or with a type in front: "skill: faundr:design", "agents 3: read the code", "command: npm test", "ask: which repository?", "wait: the tests pass". At the same time: "parallel: skill: faundr:design | command: npm test". Detail after " — ".`

export async function workflowCommand(args) {
  const [sub, ...rest] = args
  if (sub === 'list' || !sub) return workflowList()
  if (sub === 'show') return workflowShow(rest)
  if (sub === 'draft') return workflowDraft(rest)
  if (['run', 'step', 'done', 'stop'].includes(sub)) return workflowMark(sub, rest)
  throw new Error(WORKFLOW_USAGE)
}

async function workflowList() {
  const { workflows } = await workflowApi({ action: 'list' })
  if (!workflows.length) return console.log('No workflow in this project yet. The owner creates one on the dashboard (Workflows) or you propose one: faundr workflow draft.')
  const LABEL = { active: 'active', draft: 'draft', off: 'off' }
  for (const w of workflows)
    console.log(`${w.ref} ${w.name} [${LABEL[w.status] ?? w.status}, ${w.steps} step(s)]${w.trigger ? ` — when: ${w.trigger}` : ''}${w.topics.length ? ` · subjects: ${w.topics.join(', ')}` : ''}`)
}

async function workflowShow(rest) {
  const query = textArg(rest)
  if (!query) throw new Error(WORKFLOW_USAGE)
  const w = await workflowApi({ action: 'show', query })
  console.log(w.text)
  if (w.status === 'active')
    console.log(
      `\nFollow the steps in order, one at a time, and mark each one when you really do it (the team sees it on the canvas): start with faundr workflow run ${w.ref} --why "<request>", move on with faundr workflow step ${w.ref} <n> --done, and close with faundr workflow done ${w.ref}. A question step: ask it, mark it --wait, end your response and, when the owner answers, mark it --done --answer "<their words>" (if the request already answered it, quote those words). Skipping a step needs the owner's OK: --skip --answer "<their words>". Never mark a step you did not do.`,
    )
  if (w.status === 'draft') console.log('\n(Draft: not in effect yet. The owner approves it on the dashboard, in Workflows.)')
  if (w.status === 'off') console.log('\n(Turned off by the owner: do not follow it unless they ask.)')
}

async function workflowDraft(rest) {
  const name = textArg(rest)
  const steps = flags(rest, '--step').map(parseItem).filter(Boolean)
  if (!name || !steps.length) throw new Error(WORKFLOW_USAGE)
  const r = await workflowApi({
    action: 'draft',
    name,
    trigger: flag(rest, '--when') ?? '',
    topics: flags(rest, '--topic'),
    paths: flags(rest, '--file'),
    steps,
  })
  if (!r.created) return console.log(`A workflow with that name already exists (${r.ref}). Nothing changed: the owner edits it on the dashboard (Workflows).`)
  return console.log(`Draft saved: ${r.ref} ${name} (${steps.length} step(s)). It only takes effect when the owner approves it on the dashboard, in Workflows, where they can also edit the steps on the canvas.`)
}

// Como marcar o passo: --wait (esperando o dono), --skip (não se aplica), --done ou, sem nada, em andamento.
function stepMark(rest) {
  if (rest.includes('--wait')) return 'waiting'
  if (rest.includes('--skip')) return 'skip'
  return rest.includes('--done') ? 'done' : 'doing'
}

// run, step, done e stop: o progresso do workflow que o time vê no canvas.
async function workflowMark(sub, rest) {
  const [query, n] = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--why', '--note', '--answer'].includes(rest[i - 1])))
  if (!query || (sub === 'step' && !Number(n))) throw new Error(WORKFLOW_USAGE)
  const mark = stepMark(rest)
  const answer = flag(rest, '--answer') ?? ''
  if (sub === 'step' && answer) {
    // A frase precisa estar numa mensagem da pessoa nesta sessão (desde o pedido que fez o workflow começar).
    const { root } = linkedProject()
    const run = runOf(root, AGENT_SESSION_ID, query.toUpperCase())
    if (!ownerSaid(root, AGENT_SESSION_ID, answer, run?.startedAt ?? 0))
      throw new Error(
        `"${answer}" is not in the owner's messages in this session. Use their exact words (a question is answered by them, after you ask; skipping needs their OK). If they have not answered yet, mark the step --wait and ask.`,
      )
  }
  const r = await workflowApi({
    action: sub,
    query,
    ...(sub === 'run' && { reason: flag(rest, '--why') ?? '' }),
    ...(sub === 'step' && { step: Number(n), mark }),
    note: flag(rest, '--note') ?? '',
    ...(answer && { answer }),
    agentSessionId: AGENT_SESSION_ID ?? null,
  })
  // Os passos ficam no computador: o hook dos comandos avisa quando um comando passa na frente deles (sem rede).
  try {
    const { root } = linkedProject()
    saveRun(root, AGENT_SESSION_ID, r.ref, r.outline, { ...(sub === 'run' && { startedAt: Date.now() }), closed: sub === 'done' || sub === 'stop' })
  } catch {
    // Sem guardar, só o aviso antes do comando deixa de sair; o resto segue.
  }
  const STATUS = { running: 'in progress', waiting: 'waiting for the owner', done: 'done', stopped: 'stopped' }
  console.log(`${r.ref} ${STATUS[r.status] ?? r.status}: ${r.progress}.${r.status === 'waiting' ? " The canvas shows it is the owner's turn." : ''}`)
  // Avisos do time: outra pessoa seguindo o mesmo workflow agora, ou o workflow mudou no painel depois que começou.
  for (const note of r.notes ?? []) console.log(note)
}

// Skills conectadas (/faundr:skills): lê as skills do computador e liga ao projeto no Faundr.
async function skillsApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/skills`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

const SKILLS_USAGE = `usage:
  faundr skills scan            (reads the project's skills, yours and the plugins' and links them to Faundr)
  faundr skills list            (the project's skills, with source and when to use)
  faundr skills when "<name>" [--when "<when to use, one sentence>"] [--topic "<subject>"...] [--kind seguranca|testes|qualidade|erros|nenhum]
  (--kind: seguranca = security, testes = tests, qualidade = code quality, erros = app errors, nenhum = none)`

const SOURCE_LABEL = { projeto: 'from the project', pessoal: 'personal', plugin: 'from plugins' }
// Skill conectada: o que ela acha vai para esta seção do painel (faundr skill-report).
const SKILL_KIND_LABEL = { seguranca: 'security', testes: 'tests', qualidade: 'code quality', erros: 'app errors' }

export async function skillsCommand(args) {
  const [sub, ...rest] = args
  const { root } = linkedProject()
  if (sub === 'scan') return skillsScan(root, rest)
  if (sub === 'list' || !sub) return skillsList()
  if (sub === 'when') return skillsWhen(root, rest)
  throw new Error(SKILLS_USAGE)
}

async function skillsScan(root, rest) {
  const found = scanSkills(root)
  // Só envia quando a lista mudou desde a última leitura nesta pasta (a cada sessão, sem gastar rede à toa).
  const sig = createHash('sha256').update(JSON.stringify(found)).digest('hex').slice(0, 16)
  if (rest.includes('--quiet') && readState(root).skillsSig === sig) return
  const r = await skillsApi({ action: 'sync', skills: found })
  writeState(root, { skillsSig: sig })
  if (rest.includes('--quiet')) return
  const by = (s) => found.filter((x) => x.source === s).length
  console.log(`${found.length} skills on this computer: ${by('projeto')} from the project, ${by('pessoal')} personal, ${by('plugin')} from plugins. In Faundr: ${r.total}.`)
  if (r.added.length) console.log(r.added.length > 15 ? `${r.added.length} new.` : `New: ${r.added.join(', ')}`)
  if (r.missing.length) console.log(`No longer here: ${r.missing.join(', ')}`)
  if (r.needWhen.length)
    console.log(`\nWithout "when to use" (${r.needWhen.length}): ${r.needWhen.slice(0, 40).join(', ')}${r.needWhen.length > 40 ? '…' : ''}\nFor each one, read the description (faundr skills list) and save: faundr skills when "<name>" --when "<when to use>" --topic "<subject>"`)
  if (r.needKind?.length)
    console.log(
      `\nWithout a kind (${r.needKind.length}): ${r.needKind.slice(0, 40).join(', ')}${r.needKind.length > 40 ? '…' : ''}\nFor each one, say whether it finds security issues, tests, code quality or app errors (or none): faundr skills when "<name>" --kind seguranca|testes|qualidade|erros|nenhum`,
    )
}

async function skillsList() {
  const { skills } = await skillsApi({ action: 'list' })
  if (!skills.length) return console.log('No connected skill yet. Run: faundr skills scan')
  for (const src of ['projeto', 'pessoal', 'plugin']) {
    const list = skills.filter((s) => s.source === src && !s.missing)
    if (!list.length) continue
    console.log(`\n## ${list.length} ${SOURCE_LABEL[src]}`)
    for (const s of list)
      console.log(
        `- ${s.name}${s.manual ? ' [only the person calls it]' : ''}${s.enabled ? '' : ' [off]'}${SKILL_KIND_LABEL[s.kind] ? ` [connected: ${SKILL_KIND_LABEL[s.kind]}]` : ''}${s.when_to_use ? ` — when: ${s.when_to_use}` : ` — ${s.description.slice(0, 140)}`}${s.topics.length ? ` · subjects: ${s.topics.join(', ')}` : ''}`,
      )
  }
}

async function skillsWhen(root, rest) {
  const name = textArg(rest)
  const when = flag(rest, '--when')
  const topics = flags(rest, '--topic')
  const kind = flag(rest, '--kind')
  if (kind !== undefined && !(kind in SKILL_KIND_LABEL) && kind !== 'nenhum') throw new Error(SKILLS_USAGE)
  if (!name || (when === undefined && !topics.length && kind === undefined)) throw new Error(SKILLS_USAGE)
  if (kind && kind !== 'nenhum' && /^faundr:/.test(name)) throw new Error("Faundr's own skills already record on the dashboard by themselves: they do not need a kind.")
  await skillsApi({ action: 'when', name, when, ...(topics.length && { topics }), ...(kind !== undefined && { kind }) })
  // A cópia local (aviso pelo assunto e skill conectada) passa a valer já nesta sessão.
  const local = kind === undefined ? {} : { kind: kind in SKILL_KIND_LABEL ? kind : null }
  writeSkillIndex(root, readSkillIndex(root).map((s) => (s.name === name ? { ...s, ...(when !== undefined && { when }), ...(topics.length && { topics }), ...local } : s)))
  return console.log(
    `${name}: ${when ? `when ${when}` : ''}${topics.length ? ` · subjects: ${topics.join(', ')}` : ''}${kind !== undefined ? ` · ${SKILL_KIND_LABEL[kind] ? `connected (${SKILL_KIND_LABEL[kind]})` : 'not connected'}` : ''}`,
  )
}
