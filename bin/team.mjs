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
  return [AGENT_LABEL[s.agent] ?? s.agent, s.machine && `em ${s.machine}`, s.branch && `na branch ${s.branch}`].filter(Boolean).join(' ')
}

function doing(s) {
  if (s.status === 'editing' && s.detail) return `editando ${s.detail}`
  if (s.files?.length) return `mexendo em ${s.files.slice(0, 3).map((f) => f.path).join(', ')}`
  if (s.status === 'running') return 'rodando um comando'
  return s.status === 'idle' ? 'parado, esperando o próximo pedido' : 'trabalhando'
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
  if (!others.length) return { note: seen.size ? '[Faundr] Time: ninguém mais está trabalhando no projeto agora.' : null, sig }
  const lines = others.map((s) => `${seen.has(s.id) ? '' : 'entrou: '}${s.name} (${where(s)}): ${doing(s)}`)
  const age = minutes(team.at, now)
  const text = `[Faundr] Time agora${age > 5 ? ` (foto de ${age} min atrás)` : ''}: ${lines.join('; ')}. Evite mexer nos mesmos arquivos sem combinar; se precisar, avise o usuário.`
  return { note: text.length > 700 ? `${text.slice(0, 690)}…` : text, sig }
}

/** Aviso antes de editar: outra sessão viva mexeu neste arquivo na última hora. */
export function fileWarning(team, sid, rel, now = Date.now()) {
  const hits = liveOthers(team, sid, now)
    .map((s) => ({ s, f: (s.files ?? []).find((f) => f.path === rel) ?? (s.status === 'editing' && s.detail === rel ? { path: rel, at: s.lastAt } : null) }))
    .filter((h) => h.f)
  if (!hits.length) return null
  const who = hits.map(({ s, f }) => `${s.name}${s.user === team.you ? ' (outra sessão sua)' : ''}, ${where(s)}, mexeu nele há ${minutes(f.at, now)} min e agora está ${doing(s)}`).join('; ')
  return `[Faundr] Atenção: ${rel} está sendo mexido por outra sessão: ${who}. Se vocês mudarem as mesmas linhas, uma mudança pode apagar a outra. Mude só o necessário, diga ao usuário que este arquivo também está com outra pessoa e, se a mudança for grande, pergunte se ele quer combinar antes.`
}

/** Push direto na main com outra pessoa ativa: pede o OK do usuário (o combinado é juntar pela mesa de trabalho). */
export function pushWarning(team, sid, command, branch, now = Date.now()) {
  if (!/\bgit\b[^\n|;&]*\bpush\b/.test(command)) return null
  const target = command.match(/\bpush\b(?:\s+-\S+)*\s+\S+\s+(?:\S+:)?(\S+)/)?.[1] ?? branch
  if (!MAIN_BRANCHES.has(target ?? '')) return null
  const people = liveOthers(team, sid, now).filter((s) => s.user !== team.you)
  if (!people.length) return null
  return `[Faundr] ${people.map((s) => s.name).join(', ')} ${people.length === 1 ? 'está' : 'estão'} trabalhando no projeto agora. Mandar direto para o projeto principal (${target}) pode atrapalhar o trabalho ${people.length === 1 ? 'dela' : 'delas'}; o combinado é juntar pela mesa de trabalho (skill "mesa" do Faundr). Confirme com o usuário antes.`
}

/** Linhas do `faundr team`. */
export function teamLines(team, sid, now = Date.now()) {
  const others = (team?.sessions ?? []).filter((s) => s.id !== sid)
  if (!others.length) return ['Ninguém mais está trabalhando no projeto agora.']
  return others.map((s) => {
    const files = (s.files ?? []).map((f) => f.path)
    return `- ${s.name}${s.user === team.you ? ' (você, outra sessão)' : ''} · ${where(s)} · ${doing(s)} · última notícia há ${minutes(s.lastAt, now)} min${files.length ? `\n  arquivos da última hora: ${files.join(', ')}` : ''}`
  })
}
