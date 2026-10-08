// Detector de loop: o agente tentando consertar a mesma coisa de novo e de novo (e gastando créditos).
//
//   o mesmo erro volta 3 vezes seguidas no mesmo comando (build, testes, tipos…)
//   ou um arquivo é mudado pela 6ª vez na sessão enquanto algum comando continua falhando
//
// O mesmo arquivo guarda quando o código mudou e quando uma checagem passou por último (para o fim da resposta
// pedir a prova de que funciona).
//
// O aviso é guardado em ~/.faundr/loop-<sessão>.json e entregue ao agente no próximo PreToolUse (o hook que vê
// a falha roda em segundo plano, e o Claude Code descarta o que ele devolve). Cada aviso uma vez por sessão.

import fs from 'node:fs'
import path from 'node:path'

export const SAME_ERROR_TIMES = 3
export const SAME_FILE_EDITS = 6

const loopFile = (configDir, sid) => path.join(configDir, `loop-${String(sid).replace(/[^\w-]/g, '')}.json`)

function read(configDir, sid) {
  try {
    return JSON.parse(fs.readFileSync(loopFile(configDir, sid), 'utf8'))
  } catch {
    return { checks: {}, alerts: [], warned: [] }
  }
}

function write(configDir, sid, state) {
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(loopFile(configDir, sid), JSON.stringify(state))
}

// Mensagem do erro sem números que mudam a cada tentativa (linha, tempo, endereço).
const norm = (m) => String(m ?? '').replace(/\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim().slice(0, 300)

const short = (t, n = 140) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

/** Registra o resultado de um comando de checagem. Com o mesmo erro pela 3ª vez seguida, guarda um aviso. */
export function recordCheck(configDir, sid, { checkKey, passed, issues = [], now = Date.now() }) {
  if (!configDir || !sid || !checkKey) return null
  const state = read(configDir, sid)
  if (passed) {
    delete state.checks[checkKey]
    state.lastPass = now
    write(configDir, sid, state)
    return null
  }
  const messages = [...new Set(issues.map((i) => norm(i.message)).filter(Boolean))].slice(0, 20)
  const prev = state.checks[checkKey]
  const same = prev ? messages.filter((m) => prev.messages.includes(m)) : []
  const streak = prev && same.length ? prev.streak + 1 : 1
  state.checks[checkKey] = { streak, messages: same.length ? same : messages }
  let alert = null
  if (streak === SAME_ERROR_TIMES && !state.warned.includes(`check:${checkKey}`)) {
    const example = issues.find((i) => norm(i.message) === (same[0] ?? messages[0]))
    alert = `[Faundr] Loop: o mesmo erro apareceu ${streak} vezes seguidas em \`${short(checkKey, 80)}\` nesta sessão${example ? ` (${short(example.message)}${example.file ? `, em ${example.file}` : ''})` : ''}. Pare de tentar consertos parecidos: diga ao usuário, em linguagem simples, o que está falhando e o que você já tentou; procure a causa (não o sintoma), lendo o erro inteiro e o código ao redor; e, se as tentativas deixaram o código pior, sugira voltar a um ponto de volta (/faundr:undo) e planejar antes de seguir.`
    state.alerts.push(alert)
    state.warned.push(`check:${checkKey}`)
  }
  write(configDir, sid, state)
  return alert
}

/** Antes de mudar um arquivo: com 6+ mudanças nele nesta sessão e algum comando ainda falhando, avisa uma vez. */
export function editLoopNote(configDir, sid, { rel, priorEdits }) {
  if (!configDir || !sid || priorEdits < SAME_FILE_EDITS) return null
  const state = read(configDir, sid)
  const failing = Object.keys(state.checks)
  if (!failing.length || state.warned.includes(`file:${rel}`)) return null
  state.warned.push(`file:${rel}`)
  write(configDir, sid, state)
  return `[Faundr] Loop: esta é a ${priorEdits + 1}ª mudança em ${rel} nesta sessão, e \`${short(failing[0], 80)}\` continua falhando. Se você está consertando a mesma coisa de novo, pare um momento: explique ao usuário o que está tentando e o que já tentou, procure a causa (não o sintoma) e, se as tentativas pioraram o código, sugira voltar a um ponto de volta (/faundr:undo).`
}

// ---- Prova de que funciona: no fim da resposta, código mudado sem nenhuma checagem passando depois ----------

const CODE_FILE = /\.(m?[jt]sx?|c[jt]s|py|rb|go|rs|java|kt|php|cs|swift|vue|svelte|astro|sql)$/i

/** Depois de cada edição: guarda a hora da última mudança em código. */
export function recordEdit(configDir, sid, file, now = Date.now()) {
  if (!configDir || !sid || !CODE_FILE.test(file ?? '')) return
  const state = read(configDir, sid)
  state.lastCodeEdit = now
  write(configDir, sid, state)
}

/**
 * O código mudou depois da última checagem que passou (build, testes, tipos, lint ou script)? Pede uma vez por
 * leva de mudanças. Devolve null ou { failing: [comandos ainda falhando] }.
 */
export function proofNeeded(configDir, sid) {
  if (!configDir || !sid) return null
  const state = read(configDir, sid)
  if (!state.lastCodeEdit || (state.lastPass && state.lastPass >= state.lastCodeEdit) || state.proofAsked === state.lastCodeEdit) return null
  state.proofAsked = state.lastCodeEdit
  write(configDir, sid, state)
  return { failing: Object.keys(state.checks) }
}

/** Avisos guardados (o próximo hook síncrono entrega e apaga). */
export function takeLoopAlerts(configDir, sid) {
  if (!configDir || !sid) return []
  const state = read(configDir, sid)
  if (!state.alerts.length) return []
  const alerts = state.alerts
  write(configDir, sid, { ...state, alerts: [] })
  return alerts
}
