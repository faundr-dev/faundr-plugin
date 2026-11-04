// Workflows do projeto (como o time quer que o Faundr trabalhe aqui). O início da sessão traz os ativos e o plugin
// guarda em .faundr/painel/workflows.json; o hook do pedido (sem rede) avisa quando o pedido fala do assunto de um
// deles (em todo pedido do assunto, não só no primeiro) e o guard quando o arquivo editado bate com os arquivos dele
// (uma vez por sessão). Pedido que só parece ser do assunto recebe um aviso leve, para o Claude julgar.
import fs from 'node:fs'
import path from 'node:path'
import { faundrPath } from './paths.mjs'
import { matchesPath, stemsOf } from './rules.mjs'

const file = (root) => faundrPath(root, 'workflows')

export function readWorkflows(root) {
  try {
    const list = JSON.parse(fs.readFileSync(file(root), 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    // Sem cópia local dos workflows (ou ilegível): nenhum workflow.
    return []
  }
}

export function writeWorkflows(root, list) {
  fs.mkdirSync(path.dirname(file(root)), { recursive: true })
  fs.writeFileSync(file(root), JSON.stringify(list ?? []))
}

const words = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/**
 * O assunto bate quando todas as palavras de um dos assuntos do workflow aparecem no pedido ("design", "copiar
 * funcionalidade"). Palavra curta ("ui", "css") vale inteira; as outras pelo radical (stemsOf), sem plural nem acento.
 */
export function topicHit(topic, prompt) {
  const asked = stemsOf(prompt)
  const raw = new Set(words(prompt))
  // Palavra comum ("outro", "para") não diz o assunto: fica de fora, mas o assunto precisa de pelo menos uma que diga.
  const parts = words(topic).filter((w) => w.length < 4 || stemsOf(w).size)
  if (!parts.length) return false
  return parts.every((w) => (w.length < 4 ? raw.has(w) : [...stemsOf(w)].every((s) => asked.has(s))))
}

/** Momentos do gatilho do workflow (painel): sem a lista (índice antigo), o assunto do pedido e os arquivos. */
export const workflowMoment = (w, m) => (w.moments ?? ['prompt', 'edit']).includes(m)

// Link de um repositório (GitHub, GitLab, Bitbucket) diz "repositório" mesmo sem a palavra.
const REPO_URL = /\b(?:github\.com|gitlab\.com|bitbucket\.org)\/[\w.-]+\/[\w.-]+/i
const REPO_WORD = /^(?:repo|reposit|github|gitlab|clon)/

/** O pedido sem o texto colado (que não é o pedido), com "repositório" quando tem link de um. */
function askedText(prompt) {
  const clean = String(prompt ?? '').replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' ')
  return REPO_URL.test(clean) ? `${clean} repo repositorio` : clean
}

export function workflowsForPrompt(list, prompt, shownIds = []) {
  const asked = askedText(prompt)
  return list.filter((w) => !shownIds.includes(w.id) && workflowMoment(w, 'prompt') && (w.topics ?? []).some((t) => topicHit(t, asked)))
}

/**
 * Pedido que talvez seja do assunto: a palavra que diz o assunto (a primeira que conta de cada assunto: "copiar" em
 * "copiar funcionalidade") aparece em outra forma ("copia", "copiei"), ou o pedido traz o link de um repositório e o
 * workflow fala de repositório. Não basta para seguir: o Claude confere o "quando" e decide.
 */
export function workflowsMaybe(list, prompt, exceptIds = []) {
  const asked = askedText(prompt)
  const head = (w) => w.slice(0, 5)
  const said = new Set(words(asked).filter((w) => w.length >= 4 && stemsOf(w).size).map(head))
  return list.filter((w) => {
    if (exceptIds.includes(w.id) || !workflowMoment(w, 'prompt')) return false
    const keys = (w.topics ?? []).map((t) => words(t).find((x) => x.length >= 4 && stemsOf(x).size)).filter(Boolean)
    if (keys.some((k) => said.has(head(k)))) return true
    return REPO_URL.test(String(prompt ?? '')) && words([...(w.topics ?? []), w.trigger ?? ''].join(' ')).some((x) => REPO_WORD.test(x))
  })
}

export const workflowsForFile = (list, rel, shownIds = []) =>
  list.filter((w) => !shownIds.includes(w.id) && workflowMoment(w, 'edit') && (w.paths ?? []).some((p) => matchesPath(p, rel)))

export function workflowNote(items, where) {
  if (!items.length) return null
  return [
    `[Faundr] ${where} matches ${items.length > 1 ? 'project workflows' : 'a project workflow'} (it is how the team wants you to work on this). Before going on, read the steps and follow them in order, marking progress (show explains how; the team follows along on the canvas):`,
    ...items.map(
      (w) =>
        `- ${w.ref} ${w.name}${w.trigger ? ` — when: ${w.trigger}` : ''} → ${
          w.call === 'user' ? `only when the person asks: do not follow it on your own; ask in one line whether they want to follow ${w.ref}` : `faundr workflow show ${w.ref}`
        }`,
    ),
  ].join('\n')
}

const readState = (root) => {
  try {
    return JSON.parse(fs.readFileSync(faundrPath(root, 'state'), 'utf8'))
  } catch {
    // Sem estado salvo (ou ilegível): começa do zero.
    return {}
  }
}

/**
 * Aviso dos workflows do pedido. O que bate chega em todo pedido do assunto (no segundo, mais curto: segue de novo
 * para este pedido); o que talvez bata chega uma vez por sessão, como aviso leve.
 */
export function workflowsForRequest(root, sid, prompt) {
  if (!sid) return null
  const state = readState(root)
  const seen = state.workflowsShown?.session === sid ? state.workflowsShown : { ids: [], maybe: [] }
  const list = readWorkflows(root)
  const hits = workflowsForPrompt(list, prompt)
  const fresh = hits.filter((w) => !seen.ids.includes(w.id))
  const again = hits.filter((w) => seen.ids.includes(w.id))
  const maybe = workflowsMaybe(list, prompt, [...hits.map((w) => w.id), ...(seen.maybe ?? [])])
  if (!hits.length && !maybe.length) return null
  fs.writeFileSync(
    faundrPath(root, 'state'),
    JSON.stringify(
      { ...readState(root), workflowsShown: { session: sid, ids: [...new Set([...seen.ids, ...fresh.map((w) => w.id)])], maybe: [...(seen.maybe ?? []), ...maybe.map((w) => w.id)] } },
      null,
      2,
    ),
  )
  return [workflowNote(fresh, 'This request'), againNote(again), maybeNote(maybe)].filter(Boolean).join('\n\n')
}

function againNote(items) {
  if (!items.length) return null
  return items
    .map((w) =>
      w.call === 'user'
        ? `[Faundr] This request matches ${w.ref} ${w.name} again, which only runs when the person asks: ask in one line whether they want to follow it.`
        : `[Faundr] This request matches ${w.ref} ${w.name} again: follow its steps for this request too (faundr workflow run ${w.ref} --why "<request>"), unless it is the same request you are already following.`,
    )
    .join('\n')
}

function maybeNote(items) {
  if (!items.length) return null
  return [
    "[Faundr] This request may be a case for a project workflow. Check its \"when\": if it fits, follow it as the team asked; if not, ignore this note.",
    ...items.map((w) => `- ${w.ref} ${w.name}${w.trigger ? ` — when: ${w.trigger}` : ''} → ${w.call === 'user' ? 'only when the person asks: ask in one line whether they want it' : `faundr workflow show ${w.ref}`}`),
  ].join('\n')
}

/** Entrega cada workflow uma vez por sessão: devolve o aviso e marca como mostrado (arquivos editados). */
export function workflowsOnce(root, sid, pick, where) {
  if (!sid) return null
  const state = readState(root)
  const shown = state.workflowsShown?.session === sid ? state.workflowsShown : { ids: [] }
  const items = pick(readWorkflows(root), shown.ids)
  if (!items.length) return null
  fs.writeFileSync(
    faundrPath(root, 'state'),
    JSON.stringify({ ...readState(root), workflowsShown: { ...shown, session: sid, ids: [...shown.ids, ...items.map((w) => w.id)] } }, null, 2),
  )
  return workflowNote(items, where)
}

const STEP_KINDS = [
  [/^skill$/i, 'skill'],
  [/^(agentes?|agents?)$/i, 'agents'],
  [/^(comando|command)$/i, 'command'],
  [/^(perguntar|pergunta|ask)$/i, 'ask'],
  [/^(esperar|espera|aguardar|wait)$/i, 'wait'],
  [/^(tarefa|instrucao|instrução|task|instruction|step)$/i, 'step'],
]

/** Item do draft: "parallel: skill: faundr:design | command: npm test" (ou "paralelo: …") vira um grupo que roda ao mesmo tempo. */
export function parseItem(raw) {
  const m = String(raw ?? '').trim().match(/^(?:paralelo|parallel)\s*:\s*(.+)$/is)
  if (!m) return parseStep(raw)
  const parallel = m[1].split(/\s+\|\s+/).map(parseStep).filter(Boolean)
  return parallel.length > 1 ? { parallel } : parallel[0] ?? null
}

/** Passo do `faundr workflow draft --step`: "skill: /faundr:design — detalhe", "agentes 3: ler o código", texto livre. */
export function parseStep(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const m = text.match(/^([\p{L}]+)(?:\s+(\d+))?\s*:\s*(.+)$/su)
  const kind = m && STEP_KINDS.find(([re]) => re.test(m[1]))?.[1]
  const rest = kind ? m[3] : text
  const [title, ...body] = rest.split(/\s+—\s+/)
  return {
    type: kind ?? 'step',
    title: title.trim(),
    body: body.join(' — ').trim(),
    ...(kind === 'agents' && { count: Number(m[2]) || 2 }),
  }
}
