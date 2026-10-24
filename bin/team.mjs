// Multiplayer 2: avisos de quem mais está no projeto, lidos da cópia local da foto do time (.faundr/cache/team.json).
// O servidor manda a foto no início da sessão, a cada pedido e no fim de cada resposta (hooks em segundo plano); os
// avisos daqui rodam antes do pedido, da edição e do push e nunca usam a rede. Aviso, nunca trava.
import fs from 'node:fs'
import { ensureFaundrPath, faundrPath } from './paths.mjs'

// Sessão sem notícia há 15 min provavelmente morreu; foto com mais de 30 min já não diz quem está agora.
const STALE_MS = 15 * 60_000
const OLD_SNAPSHOT_MS = 30 * 60_000
const MAIN_BRANCHES = new Set(['main', 'master'])
const AGENT_LABEL = { claude: 'Claude Code', codex: 'Codex' }

export function readTeam(root) {
  try {
    return JSON.parse(fs.readFileSync(faundrPath(root, 'team'), 'utf8'))
  } catch {
    // Sem foto local do time (ou ilegível): ninguém mais no projeto.
    return null
  }
}

export function writeTeam(root, team) {
  fs.writeFileSync(ensureFaundrPath(root, 'team'), JSON.stringify(team, null, 2))
}

/** Outras sessões vivas (não a minha), pela foto local. */
export function liveOthers(team, sid, now = Date.now()) {
  if (!team?.sessions || now - Date.parse(team.at) > OLD_SNAPSHOT_MS) return []
  return team.sessions.filter((s) => s.id !== sid && s.status !== 'ended' && now - Date.parse(s.lastAt) < STALE_MS)
}

const minutes = (iso, now) => Math.max(1, Math.round((now - Date.parse(iso)) / 60_000))

function where(s) {
  return [AGENT_LABEL[s.agent] ?? s.agent, s.machine && `on ${s.machine}`, s.branch && `on branch ${s.branch}`].filter(Boolean).join(' ')
}

function doing(s) {
  if (s.status === 'editing' && s.detail) return `editing ${s.detail}`
  if (s.files?.length) return `working on ${s.files.slice(0, 3).map((f) => f.path).join(', ')}`
  if (s.status === 'running') return 'running a command'
  return s.status === 'idle' ? 'idle, waiting for the next request' : 'working'
}

const signature = (others) => others.map((s) => `${s.id}:${(s.files ?? []).slice(0, 3).map((f) => f.path).join(',')}`).sort().join('|')

/**
 * Aviso do pedido: só quando o time mudou desde o último aviso desta sessão (alguém entrou, saiu ou passou a mexer em
 * outros arquivos). Devolve { note, sig } para o chamador guardar a assinatura.
 */
export function teamPromptNote(team, sid, lastSig, now = Date.now()) {
  const others = liveOthers(team, sid, now)
  const sig = signature(others)
  if (sig === (lastSig ?? '')) return { note: null, sig }
  const seen = new Set((lastSig ?? '').split('|').filter(Boolean).map((x) => x.split(':')[0]))
  if (!others.length) return { note: seen.size ? '[Faundr] Team: nobody else is working on the project right now.' : null, sig }
  const lines = others.map((s) => `${seen.has(s.id) ? '' : 'joined: '}${s.name} (${where(s)}): ${doing(s)}`)
  const age = minutes(team.at, now)
  const text = `[Faundr] Team now${age > 5 ? ` (snapshot from ${age} min ago)` : ''}: ${lines.join('; ')}. Avoid touching the same files without agreeing first; if you need to, tell the user.`
  return { note: text.length > 700 ? `${text.slice(0, 690)}…` : text, sig }
}

/** Aviso antes de editar: outra sessão viva mexeu neste arquivo na última hora. */
export function fileWarning(team, sid, rel, now = Date.now()) {
  const hits = liveOthers(team, sid, now)
    .map((s) => ({ s, f: (s.files ?? []).find((f) => f.path === rel) ?? (s.status === 'editing' && s.detail === rel ? { path: rel, at: s.lastAt } : null) }))
    .filter((h) => h.f)
  if (!hits.length) return null
  const who = hits.map(({ s, f }) => `${s.name}${s.user === team.you ? ' (another session of yours)' : ''}, ${where(s)}, changed it ${minutes(f.at, now)} min ago and is now ${doing(s)}`).join('; ')
  return `[Faundr] Warning: ${rel} is being changed by another session: ${who}. If you both change the same lines, one change can wipe out the other. Change only what is needed, tell the user this file is also being worked on by someone else and, if the change is large, ask whether they want to coordinate first.`
}

/** Push direto na main com outra pessoa ativa: pede o OK do usuário (o combinado é juntar pela mesa de trabalho). */
export function pushWarning(team, sid, command, branch, now = Date.now()) {
  if (!/\bgit\b[^\n|;&]*\bpush\b/.test(command)) return null
  const target = command.match(/\bpush\b(?:\s+-\S+)*\s+\S+\s+(?:\S+:)?(\S+)/)?.[1] ?? branch
  if (!MAIN_BRANCHES.has(target ?? '')) return null
  const people = liveOthers(team, sid, now).filter((s) => s.user !== team.you)
  if (!people.length) return null
  return `[Faundr] ${people.map((s) => s.name).join(', ')} ${people.length === 1 ? 'is' : 'are'} working on the project right now. Pushing straight to the main project (${target}) can get in the way of their work; the agreement is to merge through the workbench (Faundr "merge" skill). Confirm with the user first.`
}

/** Linhas do `faundr team`. */
export function teamLines(team, sid, now = Date.now()) {
  const others = (team?.sessions ?? []).filter((s) => s.id !== sid)
  if (!others.length) return ['Nobody else is working on the project right now.']
  return others.map((s) => {
    const files = (s.files ?? []).map((f) => f.path)
    return `- ${s.name}${s.user === team.you ? ' (you, another session)' : ''} · ${where(s)} · ${doing(s)} · last seen ${minutes(s.lastAt, now)} min ago${files.length ? `\n  files from the last hour: ${files.join(', ')}` : ''}`
  })
}
