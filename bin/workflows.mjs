// Workflows do projeto (como o time quer que o Faundr trabalhe aqui). O início da sessão traz os ativos e o plugin
// guarda em .faundr/painel/workflows.json; o hook do pedido (sem rede) avisa quando o pedido fala do assunto de um
// deles, e o guard quando o arquivo editado bate com os arquivos dele. Cada workflow chega uma vez por sessão.
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

export function workflowsForPrompt(list, prompt, shownIds = []) {
  const clean = String(prompt ?? '').replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' ')
  return list.filter((w) => !shownIds.includes(w.id) && workflowMoment(w, 'prompt') && (w.topics ?? []).some((t) => topicHit(t, clean)))
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

/** Entrega cada workflow uma vez por sessão: devolve o aviso e marca como mostrado. */
export function workflowsOnce(root, sid, pick, where) {
  if (!sid) return null
  const state = readState(root)
  const ids = state.workflowsShown?.session === sid ? state.workflowsShown.ids : []
  const items = pick(readWorkflows(root), ids)
  if (!items.length) return null
  fs.writeFileSync(
    faundrPath(root, 'state'),
    JSON.stringify({ ...readState(root), workflowsShown: { session: sid, ids: [...ids, ...items.map((w) => w.id)] } }, null, 2),
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
