// Barra de status do Faundr no Claude Code (ideia do Graft, claude/statusline.ts). Roda a cada atualização da barra,
// então só lê arquivos locais: o resumo que o plugin guarda em .faundr/state.json e a marca de grafo para refazer.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { t } from './i18n.mjs'

/** Resumo para a barra a partir do quadro (faundr board): funcionalidade atual, progresso, próximo passo, preocupações. */
export function statusFromBoard(board, currentFeatureId, projectName, now = Date.now()) {
  const all = board.allFeatures ?? board.features ?? []
  const f = all.find((x) => x.id === currentFeatureId)
  const tasks = f?.tasks ?? []
  const next = tasks.find((t) => t.task_status === 'in_progress') ?? tasks.find((t) => t.task_status === 'pending')
  return {
    projectName: projectName ?? null,
    feature: f ? { title: f.title, done: tasks.filter((t) => t.task_status === 'completed').length, total: tasks.length, next: next?.title ?? null } : null,
    concerns: (board.concerns ?? []).length,
    // Quantas funcionalidades o projeto tem: sem nenhuma num projeto com código, o início da sessão oferece o inventário.
    features: all.length,
    at: now,
  }
}

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// ---- itens da barra (o dono liga e desliga no painel, por projeto) -------------------------------------------

/** Itens da barra e o padrão de cada um (o custo fica desligado: em plano Pro/Max ele não é o que se paga). */
export const STATUS_ITEMS = {
  projeto: true,
  funcionalidade: true,
  passo: true,
  grafo: true,
  preocupacoes: true,
  contexto: true,
  cinco_horas: true,
  semana: true,
  custo: false,
  // Faixa acima do prompt: quem desenha é o mod do Faundr (faundr-mod), não esta linha.
  faixa: false,
}
export const DEFAULT_BAR = { items: STATUS_ITEMS, alerts: true }

/** Escolhas do painel por cima do padrão (item desconhecido ou valor estranho fica de fora). */
export function barPrefs(raw) {
  const items = { ...STATUS_ITEMS }
  for (const k of Object.keys(STATUS_ITEMS)) if (typeof raw?.items?.[k] === 'boolean') items[k] = raw.items[k]
  return { items, alerts: typeof raw?.alerts === 'boolean' ? raw.alerts : true }
}

const ESC = '\u001b['
const BOLD = (s) => `${ESC}1m${s}${ESC}22m`
const INVERSE = (s) => `${ESC}7m ${s} ${ESC}27m`
/** Tamanho que aparece na tela (sem os códigos de cor). */
export const visible = (s) => s.replace(/\u001b\[[0-9;]*m/g, '').length

/** Barra de 5 blocos: cada um vale 20%; um pedaço já usado acende o bloco. */
export const bar = (pct) => {
  const on = Math.min(5, Math.max(0, Math.ceil(Math.round(pct) / 20)))
  return '█'.repeat(on) + '░'.repeat(5 - on)
}

const WEEKDAY_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Quando a janela zera: "18:40" se for hoje, "sáb 09:00" ("Sat 09:00") se não. `resetsAt` em segundos (como o Claude Code manda). */
export function resetText(resetsAt, now = Date.now()) {
  const d = new Date(Number(resetsAt) * 1000)
  if (!Number.isFinite(d.getTime())) return null
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return new Date(now).toDateString() === d.toDateString() ? hm : `${t(WEEKDAY_EN, WEEKDAY_PT)[d.getDay()]} ${hm}`
}

const pctOf = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const fmtPct = (p) => `${Math.round(p)}%`

/**
 * Um medidor: "ctx ███░░ 42%". Em 80% fica em negrito com a dica; em 95%, em destaque (fundo invertido). Sem cor de
 * propósito: o Faundr é preto e branco, e o negrito e o invertido aparecem em qualquer terminal.
 */
function meter(label, pct, { alerts, hint }) {
  const text = `${label} ${bar(pct)} ${fmtPct(pct)}`
  if (!alerts || pct < 80) return text
  return pct >= 95 ? INVERSE(`${text}${hint ? ` ${hint}` : ''}`) : BOLD(`${text}${hint ? ` ${hint}` : ''}`)
}

/** Medidores do que o Claude Code manda para a barra: contexto, janelas de 5 horas e da semana, custo. */
export function meterItems(input, prefs = DEFAULT_BAR, now = Date.now()) {
  const { items, alerts } = barPrefs(prefs)
  const out = []
  const ctx = pctOf(input?.context_window?.used_percentage)
  if (items.contexto && ctx !== null) out.push(meter('ctx', ctx, { alerts, hint: ctx >= 95 ? t('use /compact now', 'use /compact já') : t('time to /compact', 'hora de /compact') }))
  const limit = (key, label, show) => {
    const w = input?.rate_limits?.[key]
    const p = pctOf(w?.used_percentage)
    if (!show || p === null) return
    const at = resetText(w?.resets_at, now)
    out.push(meter(label, p, { alerts, hint: at ? t(`resets ${at}`, `zera ${at}`) : '' }))
  }
  limit('five_hour', '5h', items.cinco_horas)
  limit('seven_day', t('wk', 'sem'), items.semana)
  const usd = pctOf(input?.cost?.total_cost_usd)
  if (items.custo && usd !== null) out.push(t(`US$ ${usd.toFixed(2)}`, `US$ ${usd.toFixed(2).replace('.', ',')}`))
  return out
}

/**
 * Os medidores que o Claude Code mandou para a barra, para o painel (Insights): contexto e janelas de 5 horas e da
 * semana. A barra guarda em .faundr/cache/meters.json e o fim da resposta envia junto com o uso. Null sem nenhum.
 */
export function metersSnapshot(input, now = Date.now()) {
  const ctx = pctOf(input?.context_window?.used_percentage)
  const win = (key) => {
    const w = input?.rate_limits?.[key]
    const p = pctOf(w?.used_percentage)
    return p === null ? null : { pct: Math.round(p * 10) / 10, resets_at: pctOf(Number(w?.resets_at)) }
  }
  const five = win('five_hour')
  const week = win('seven_day')
  if (ctx === null && !five && !week) return null
  return {
    session_id: typeof input?.session_id === 'string' ? input.session_id : null,
    context_pct: ctx === null ? null : Math.round(ctx * 10) / 10,
    context_size: pctOf(input?.context_window?.context_window_size),
    five_hour: five,
    seven_day: week,
    model: typeof input?.model?.display_name === 'string' ? input.model.display_name.slice(0, 60) : null,
    at: now,
  }
}

/**
 * A barra. `graph`: 'fresh' | 'stale' | null (sem grafo). Com os dados do Claude Code (`input`), os medidores vão no
 * fim da linha; se não couberem na largura, descem para uma segunda linha.
 */
export function statusLine(status, { graph = null, width = 120, input = null, prefs = DEFAULT_BAR, now = Date.now() } = {}) {
  const { items } = barPrefs(prefs)
  const parts = []
  if (items.projeto) parts.push(`Faundr${status?.projectName ? ` · ${cut(status.projectName, 24)}` : ''}`)
  const f = status?.feature
  if (items.funcionalidade) {
    if (f) parts.push(`${cut(f.title, 40)}${f.total ? ` ${f.done}/${f.total}` : ''}`)
    else parts.push(t('no current feature', 'sem funcionalidade atual'))
  }
  if (items.passo && f?.next) parts.push(`${t('now', 'agora')}: ${cut(f.next, 40)}`)
  if (items.grafo && graph) parts.push(graph === 'fresh' ? t('map up to date', 'grafo em dia') : t('map updating', 'grafo atualizando'))
  if (items.preocupacoes && status?.concerns) parts.push(t(`${status.concerns} concern${status.concerns === 1 ? '' : 's'}`, `${status.concerns} preocupação(ões)`))
  const head = cut(parts.join(' · '), width)
  const meters = input ? meterItems(input, prefs, now) : []
  if (!meters.length) return head
  const tail = meters.join(' · ')
  if (!head) return tail
  return visible(head) + 3 + visible(tail) <= width ? `${head} · ${tail}` : `${head}\n${tail}`
}

// ---- instalação ---------------------------------------------------------------------------

/**
 * O caminho do plugin muda a cada versão; a barra aponta para um lançador fixo em ~/.faundr que procura a versão
 * mais nova instalada (e cai no caminho de quem instalou, se não achar).
 */
export function launcherSource(fallback) {
  return `// Gerado por "faundr statusline-install": chama a versão mais nova do plugin do Faundr.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const base = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'plugins', 'cache', 'faundr', 'faundr')
const num = (v) => v.split('.').map(Number)
const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0 }
let file = ${JSON.stringify(fallback)}
try {
  const versions = fs.readdirSync(base).filter((v) => /^\\d+\\.\\d+\\.\\d+$/.test(v) && fs.existsSync(path.join(base, v, 'bin', 'faundr.mjs'))).sort(newer)
  if (versions.length) file = path.join(base, versions.at(-1), 'bin', 'faundr.mjs')
} catch {}
process.argv.splice(2, 0, 'statusline')
await import(pathToFileURL(file).href)
`
}

/** Grava o lançador e liga a barra em ~/.claude/settings.json (sem trocar uma barra que já existe, a menos de force). */
export function installStatusline({ pluginFile, force = false, home = os.homedir(), configDir = process.env.CLAUDE_CONFIG_DIR }) {
  const launcher = path.join(home, '.faundr', 'statusline.mjs')
  fs.mkdirSync(path.dirname(launcher), { recursive: true })
  fs.writeFileSync(launcher, launcherSource(pluginFile))
  const settingsFile = path.join(configDir || path.join(home, '.claude'), 'settings.json')
  let settings = {}
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') return { ok: false, reason: t(`could not read ${settingsFile}: ${err.message}`, `não consegui ler ${settingsFile}: ${err.message}`) }
  }
  const command = `node "${launcher.split(path.sep).join('/')}"`
  const current = settings.statusLine
  if (current?.command === command) return { ok: true, already: true, settingsFile }
  if (current && !force) {
    const other = current.command ?? JSON.stringify(current)
    // `exists`: quem chama decide pelo campo, não pelo texto (que muda com a língua).
    return {
      ok: false,
      exists: true,
      reason: t(
        `a status line already exists (${other}). To replace it with Faundr's: faundr statusline-install --force`,
        `já existe uma barra de status (${other}). Para trocar pela do Faundr: faundr statusline-install --force`,
      ),
      settingsFile,
    }
  }
  settings.statusLine = { type: 'command', command, padding: 0 }
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true })
  fs.writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
  return { ok: true, replaced: current ?? null, settingsFile }
}
