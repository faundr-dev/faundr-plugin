// Envios ao painel que não chegaram: ficam guardados aqui e vão depois, num processo de segundo plano que ninguém
// espera. Dois tipos:
// - 'event': evento de hook que passou do prazo ou ficou sem rede (rede ruim do lado da pessoa). Sem isto, o diário e
//   a sessão perdiam o que aconteceu naquele momento;
// - 'command': no Codex, a área protegida roda os comandos do agente sem rede. Um comando do Faundr que grava no painel
//   (feature, task, done, handoff…) fica guardado em vez de falhar, e o próximo hook (que roda fora da área protegida,
//   com rede) roda o mesmo comando de novo. O agente não precisa repetir nem pedir permissão.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_DIR } from './cli-core.mjs'
import { readJsonForUpdate, writeJsonAtomic } from './json-file.mjs'

export const PENDING_FILE = path.join(CONFIG_DIR, 'pending.json')
export const PENDING_REPORT_FILE = path.join(CONFIG_DIR, 'pending-report.json')
const FAUNDR_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'faundr.mjs')
const MAX_ENTRIES = 200
const MAX_TRIES = 5
const MAX_AGE_MS = 24 * 60 * 60_000
// Um envio que travou não segura a fila para sempre: a trava vence depois disso.
const LOCK_STALE_MS = 2 * 60_000

// Eventos só do estado ao vivo (antes da ferramenta, avisos): reenviados depois já não dizem nada.
const LIVE_ONLY = new Set(['PreToolUse', 'Notification', 'PermissionRequest'])

// Comandos que só gravam no painel. Os de leitura (board, resume, *-context) não entram: a resposta só vale na hora.
const WRITE_COMMANDS = new Set([
  'feature', 'task', 'decision', 'rule', 'concern', 'done', 'start', 'claim', 'release', 'own', 'disown',
  'criteria-check', 'feature-discard', 'feature-restore', 'feature-done', 'task-remove', 'task-review', 'memory-edit',
  'handoff', 'overview-save', 'stack-save',
])

/** O comando grava no painel e pode esperar a rede (sem argumento, criteria/resolve/workflow só listam). */
export function queueableCommand(command, args = []) {
  if (args.includes('--help') || args.includes('-h')) return false
  if (WRITE_COMMANDS.has(command)) return true
  if (command === 'criteria' || command === 'resolve') return args.length > 0
  if (command === 'workflow') return ['draft', 'link', 'run', 'step', 'done', 'stop'].includes(args[0])
  return false
}

/** Evento de hook que vale a pena reenviar. */
export function queueableEvent(type) {
  return typeof type === 'string' && !LIVE_ONLY.has(type)
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Guarda um envio. Devolve false se não deu para gravar (arquivo preso por outro processo). */
export function addPending(entry, { file = PENDING_FILE, now = Date.now() } = {}) {
  try {
    const all = readJsonForUpdate(file, [])
    if (all === undefined) return false
    const list = Array.isArray(all) ? all : []
    return writeJsonAtomic(file, [...list, { id: newId(), at: now, tries: 0, ...entry }].slice(-MAX_ENTRIES)) !== false
  } catch {
    return false
  }
}

/** Há algo esperando (sem ler o arquivo inteiro: o hook pergunta isso a cada evento). */
export function hasPending(file = PENDING_FILE) {
  try {
    return fs.statSync(file).size > 2
  } catch {
    return false
  }
}

function takeLock(file, now) {
  const lock = `${file}.lock`
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' })
    return lock
  } catch {
    try {
      if (now - fs.statSync(lock).mtimeMs < LOCK_STALE_MS) return null
      fs.rmSync(lock, { force: true })
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' })
      return lock
    } catch {
      return null
    }
  }
}

/**
 * Manda o que está guardado, na ordem (uma funcionalidade criada antes da tarefa dela). `postEvent(entry)` e
 * `runCommand(entry)` devolvem 'ok', 'retry' (sem rede de novo: para e tenta no próximo hook) ou { drop: motivo }
 * (o próprio comando recusou: repetir não adianta; o motivo vai para o relatório que o agente recebe).
 */
export async function sendPending({ file = PENDING_FILE, reportFile = PENDING_REPORT_FILE, now = Date.now(), postEvent, runCommand }) {
  const lock = takeLock(file, now)
  if (!lock) return { sent: 0, busy: true }
  let sent = 0
  try {
    for (let guard = 0; guard < MAX_ENTRIES; guard++) {
      const all = readJsonForUpdate(file, [])
      if (!Array.isArray(all) || !all.length) break
      const entry = all[0]
      const old = now - (entry.at ?? 0) > MAX_AGE_MS
      const outcome = old ? { drop: 'expired' } : entry.kind === 'command' ? await runCommand(entry) : await postEvent(entry)
      const fresh = readJsonForUpdate(file, [])
      if (!Array.isArray(fresh)) break
      const rest = fresh.filter((e) => e.id !== entry.id)
      if (outcome === 'retry') {
        const tries = (entry.tries ?? 0) + 1
        if (tries >= MAX_TRIES) {
          if (entry.kind === 'command') report(reportFile, entry, 'no network after several tries')
          writeJsonAtomic(file, rest)
          continue
        }
        writeJsonAtomic(file, [{ ...entry, tries }, ...rest])
        break
      }
      if (outcome?.drop && entry.kind === 'command') report(reportFile, entry, outcome.drop)
      if (outcome === 'ok') sent++
      writeJsonAtomic(file, rest)
    }
  } finally {
    fs.rmSync(lock, { force: true })
  }
  return { sent }
}

function report(reportFile, entry, reason) {
  const all = readJsonForUpdate(reportFile, [])
  if (all === undefined) return
  const line = { command: [entry.command, ...(entry.args ?? [])].join(' ').slice(0, 200), reason: String(reason).slice(0, 300), at: Date.now() }
  writeJsonAtomic(reportFile, [...(Array.isArray(all) ? all : []), line].slice(-20))
}

/** Comandos guardados que não deu para mandar (lidos uma vez: o arquivo some). */
export function takePendingReport(reportFile = PENDING_REPORT_FILE) {
  try {
    const all = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
    fs.rmSync(reportFile, { force: true })
    return Array.isArray(all) ? all : []
  } catch {
    return []
  }
}

const NETWORK_TEXT = /fetch failed|sem rede|without network|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|TimeoutError|aborted/i

/** Roda de novo o comando guardado, na mesma pasta e como a mesma sessão do Codex. */
export function runQueuedCommand(entry) {
  if (!fs.existsSync(entry.cwd ?? '')) return { drop: 'folder no longer exists' }
  const env = { ...process.env, FAUNDR_AGENT: 'codex', FAUNDR_REPLAY: '1' }
  delete env.CODEX_SANDBOX_NETWORK_DISABLED
  if (entry.sessionId) env.CODEX_SESSION_ID = entry.sessionId
  const r = spawnSync(process.execPath, [FAUNDR_FILE, entry.command, ...(entry.args ?? [])], { cwd: entry.cwd, env, encoding: 'utf8', timeout: 60_000, windowsHide: true })
  if (r.status === 0) return 'ok'
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim()
  if (r.error || NETWORK_TEXT.test(out)) return 'retry'
  return { drop: out.split('\n').filter(Boolean).at(-1) ?? `exit ${r.status}` }
}

/** Reenvia um evento de hook. O servidor aceita o horário original de até 24 h atrás quando vem `resent`. */
export async function postQueuedEvent(entry, { apiUrl, token }) {
  try {
    const res = await fetch(`${apiUrl}/api/hooks/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...entry.body, resent: true }),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) return 'ok'
    // Servidor fora do ar ou limite do dia: tenta depois. Outro erro (token trocado, projeto apagado): descarta.
    return res.status >= 500 || res.status === 429 ? 'retry' : { drop: `HTTP ${res.status}` }
  } catch {
    return 'retry'
  }
}
