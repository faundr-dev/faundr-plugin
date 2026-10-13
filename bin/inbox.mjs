// Multiplayer 3: cópia local da caixa de entrada (pedidos do painel, recados de outras sessões e notas do time).
// O hook em segundo plano grava o que o servidor mandou; o hook do pedido e o do fim da resposta entregam ao agente sem
// usar a rede; o hook seguinte da mesma sessão confirma a entrega ao servidor (ack).
// Duas sessões na mesma pasta: quem entrega primeiro marca aqui, e a outra não repete.
import fs from 'node:fs'
import { ensureFaundrPath, faundrPath } from './paths.mjs'

const KEEP_DELIVERED_MS = 24 * 60 * 60_000

function read(root) {
  try {
    return JSON.parse(fs.readFileSync(faundrPath(root, 'inbox'), 'utf8'))
  } catch {
    return { items: [], delivered: [] }
  }
}

function write(root, data) {
  fs.writeFileSync(ensureFaundrPath(root, 'inbox'), JSON.stringify(data, null, 2))
}

/** O servidor mandou o que está pendente: guarda (o que já foi entregue aqui continua marcado). */
export function writeInbox(root, items, now = Date.now()) {
  const data = read(root)
  write(root, {
    ...data,
    items: Array.isArray(items) ? items : [],
    delivered: (data.delivered ?? []).filter((d) => now - d.at < KEEP_DELIVERED_MS),
  })
}

/**
 * Avisos de uma sessão só (workflow parado pelo painel, workflow mudado no meio): o servidor manda uma vez, e o hook do
 * pedido seguinte da mesma sessão entrega. Outra sessão na mesma pasta não recebe.
 */
export function addSessionNotes(root, sid, texts, now = Date.now()) {
  const fresh = (Array.isArray(texts) ? texts : []).filter((t) => typeof t === 'string' && t.trim())
  if (!sid || !fresh.length) return
  const data = read(root)
  const kept = (data.sessionNotes ?? []).filter((n) => now - n.at < KEEP_DELIVERED_MS)
  write(root, { ...data, sessionNotes: [...kept, ...fresh.map((text) => ({ session: sid, text, at: now }))] })
}

/** Entrega: devolve o texto dos itens ainda não entregues nesta pasta e marca como entregues por esta sessão. */
export function takeInbox(root, sid, now = Date.now()) {
  if (!sid) return []
  const data = read(root)
  const delivered = data.delivered ?? []
  const done = new Set(delivered.map((d) => d.id))
  const fresh = (data.items ?? []).filter((i) => !done.has(i.id))
  const mine = (data.sessionNotes ?? []).filter((n) => n.session === sid)
  if (!fresh.length && !mine.length) return []
  write(root, {
    ...data,
    delivered: [...delivered, ...fresh.map((i) => ({ id: i.id, kind: i.kind, session: sid, at: now, acked: false }))],
    sessionNotes: (data.sessionNotes ?? []).filter((n) => n.session !== sid),
  })
  return [...fresh.map((i) => i.text), ...mine.map((n) => `[Faundr] ${n.text}`)].filter(Boolean)
}

/** Entregas desta sessão ainda não confirmadas ao servidor; marca como confirmadas (vão no corpo do hook). */
export function takeAcks(root, sid) {
  if (!sid) return []
  const data = read(root)
  const mine = (data.delivered ?? []).filter((d) => d.session === sid && !d.acked)
  if (!mine.length) return []
  write(root, { ...data, delivered: data.delivered.map((d) => (d.session === sid && !d.acked ? { ...d, acked: true } : d)) })
  return mine.map((d) => ({ id: d.id, kind: d.kind }))
}
