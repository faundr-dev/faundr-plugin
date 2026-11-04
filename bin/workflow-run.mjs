// Execução de workflow seguida de verdade, sem rede: as mensagens da pessoa nesta sessão (para conferir a frase que
// respondeu uma pergunta ou autorizou pular um passo) e os passos da execução aberta (para avisar, antes de rodar,
// quando um comando é de um passo à frente dos que ainda estão abertos). Tudo fica só no computador, em
// .faundr/painel/state.json, e some na próxima sessão.
import fs from 'node:fs'
import { faundrPath } from './paths.mjs'

const MAX_PROMPTS = 30

function read(root) {
  try {
    return JSON.parse(fs.readFileSync(faundrPath(root, 'state'), 'utf8'))
  } catch {
    // Sem estado salvo (ou ilegível): começa do zero.
    return {}
  }
}

function write(root, patch) {
  fs.writeFileSync(faundrPath(root, 'state'), JSON.stringify({ ...read(root), ...patch }, null, 2))
}

const plain = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Cada pedido da pessoa (hook do pedido): só o texto dela, sem o que foi colado. */
export function rememberPrompt(root, sid, prompt) {
  if (!sid || typeof prompt !== 'string') return
  const text = prompt.replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' ').slice(0, 4000)
  // Mensagem que o próprio Claude Code injeta (resposta de subagente, aviso de tarefa) não é a pessoa falando.
  if (/^\s*<(?:agent-message|task-notification|system-reminder)\b/.test(text)) return
  const state = read(root)
  const list = state.prompts?.session === sid ? state.prompts.list : []
  write(root, { prompts: { session: sid, list: [...list, { at: Date.now(), text }].slice(-MAX_PROMPTS) } })
}

/**
 * A frase está numa mensagem da pessoa desta sessão, a partir do pedido que fez o workflow começar? Sem acento,
 * maiúscula nem pontuação; precisa ser a frase inteira (palavras completas), não um pedaço de palavra.
 */
export function ownerSaid(root, sid, answer, since = 0) {
  const want = plain(answer)
  if (!want || !sid) return false
  const state = read(root)
  if (state.prompts?.session !== sid) return false
  const list = state.prompts.list
  // O pedido que fez o workflow começar conta: é o último antes do começo.
  const first = Math.max(0, list.findLastIndex((p) => p.at <= since))
  return list.slice(first).some((p) => ` ${plain(p.text)} `.includes(` ${want} `))
}

/** Guarda os passos da execução (o que o servidor devolve depois de run/step). `startedAt`: só no run. */
export function saveRun(root, sid, ref, outline, { startedAt, closed = false } = {}) {
  if (!sid || !ref) return
  const state = read(root)
  const runs = state.workflowRuns?.session === sid ? { ...state.workflowRuns.runs } : {}
  if (closed) delete runs[ref]
  else runs[ref] = { startedAt: startedAt ?? runs[ref]?.startedAt ?? Date.now(), outline: outline ?? runs[ref]?.outline ?? [] }
  write(root, { workflowRuns: { session: sid, runs } })
}

export function runOf(root, sid, ref) {
  const state = read(root)
  return state.workflowRuns?.session === sid ? (state.workflowRuns.runs[ref] ?? null) : null
}

// O mesmo jeito do painel de dizer que o comando do passo é o que rodou (src/lib/workflows.ts, commandHit).
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim()
const bare = (cmd) =>
  norm(cmd)
    .split(/\s*(?:&&|;)\s*/)
    .filter((part) => !/^cd\s/.test(part))
    .join(' && ')
    .replace(/^(?:[a-z_][a-z0-9_]*=\S*\s+)+/i, '')

function commandIs(stepTitle, ran) {
  const want = norm(stepTitle).split('<')[0].trim()
  if (want.length < 4) return false
  const got = bare(ran)
  return got === want || got.startsWith(`${want} `) || got.includes(` && ${want}`)
}

const settled = (state) => state === 'done' || state === 'skipped'

/**
 * Antes de rodar um comando: se ele é de um passo de uma execução aberta e há passos antes dele ainda abertos, o
 * aviso para o Claude (só avisa; o comando roda). null quando está tudo em ordem.
 */
export function outOfOrderNote(root, sid, command) {
  const state = read(root)
  if (state.workflowRuns?.session !== sid) return null
  const notes = []
  for (const [ref, run] of Object.entries(state.workflowRuns.runs ?? {})) {
    const steps = run.outline ?? []
    const hit = steps.find((s) => s.type === 'command' && !settled(s.state) && commandIs(s.title, command))
    if (!hit) continue
    const open = steps.filter((s) => hit.before.includes(s.n) && !settled(s.state))
    if (!open.length) continue
    const list = open.map((s) => `${s.n}. ${s.title}${s.type === 'ask' ? ' (a question for the owner)' : ''}`).join('; ')
    notes.push(
      `[Faundr] This command is step ${hit.n} of workflow ${ref}, but steps before it are still open: ${list}. The team asked to follow the order: do them first (ask the owner, if it is a question), or tell the user you are going ahead of them and why.`,
    )
  }
  return notes.length ? notes.join('\n') : null
}
