// Tarefa aberta de OUTRA funcionalidade que o trabalho desta sessão terminou. O aviso de depois do commit só olhava
// as tarefas da funcionalidade atual: o que era feito "de passagem" (uma tarefa de outra funcionalidade, resolvida no
// meio de outro pedido) ia para o git e a tarefa ficava aberta para sempre. Aqui, sem IA e sem rede: o texto do que a
// sessão fez (mensagens de commit e últimos pedidos) contra os títulos das tarefas abertas.
import { readJsonObject, writeJsonAtomic } from './json-file.mjs'
import { faundrPath } from './paths.mjs'
import { stemsOf } from './rules.mjs'

const MAX_COMMITS = 10

const read = (root) => readJsonObject(faundrPath(root, 'state'))
const write = (root, patch) => writeJsonAtomic(faundrPath(root, 'state'), { ...read(root), ...patch }, 2)

/** Guarda a mensagem de um commit desta sessão (só no computador). */
export function noteCommit(root, sid, message) {
  const text = String(message ?? '').trim()
  if (!sid || !text) return
  const kept = read(root).sessionCommits
  const list = kept?.session === sid ? kept.list : []
  write(root, { sessionCommits: { session: sid, list: [...list, text].slice(-MAX_COMMITS) } })
}

/** O que a sessão fez, em texto: as mensagens dos commits dela e os últimos pedidos da pessoa. */
export function sessionWorkText(root, sid) {
  const state = read(root)
  const commits = state.sessionCommits?.session === sid ? state.sessionCommits.list : []
  const prompts = state.prompts?.session === sid ? state.prompts.list.slice(-3).map((p) => String(p.text ?? '').slice(0, 600)) : []
  return [...commits, ...prompts].join('\n').trim()
}

/** Tarefas já apontadas nesta sessão e o texto conferido da última vez (o mesmo texto não é conferido de novo). */
export function hintsSeen(root, sid) {
  const kept = read(root).taskHints
  return kept?.session === sid ? { ids: kept.ids ?? [], text: kept.text ?? '' } : { ids: [], text: '' }
}

export function rememberHints(root, sid, ids, text) {
  if (!sid) return
  write(root, { taskHints: { session: sid, ids: [...new Set([...hintsSeen(root, sid).ids, ...ids])], text } })
}

/**
 * As tarefas abertas (de construir, fora da funcionalidade atual) cujo título bate com o texto do que a sessão fez.
 * Bate = metade das palavras do título em comum (ou 4+), com pelo menos duas que são raras entre as tarefas abertas:
 * palavra que aparece em muitas ("painel", "plugin") não diz qual é a tarefa. No máximo 3, as mais parecidas primeiro.
 * `tasks`: [{ id, title, feature, featureId }].
 */
export function matchOpenTasks(tasks, { currentId = null, text = '', skip = [], max = 3 } = {}) {
  const asked = stemsOf(text)
  if (asked.size < 2) return []
  const open = (tasks ?? []).filter((t) => t?.id && t.title).map((t) => ({ ...t, stems: stemsOf(t.title) }))
  const df = new Map()
  for (const t of open) for (const s of t.stems) df.set(s, (df.get(s) ?? 0) + 1)
  const rare = (s) => (df.get(s) ?? 0) <= Math.max(2, Math.ceil(open.length * 0.1))
  return open
    .filter((t) => t.featureId !== currentId && !skip.includes(t.id) && t.stems.size >= 2)
    .map((t) => {
      const hits = [...t.stems].filter((s) => asked.has(s))
      return { t, hits: hits.length, strong: hits.filter(rare).length, ratio: hits.length / t.stems.size }
    })
    .filter((r) => r.strong >= 2 && (r.ratio >= 0.5 || r.hits >= 4))
    .sort((a, b) => b.ratio - a.ratio || b.hits - a.hits)
    .slice(0, max)
    .map(({ t }) => ({ id: t.id, title: t.title, feature: t.feature ?? null }))
}
