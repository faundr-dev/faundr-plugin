// Custo da IA do Faundr: quanto cada coisa que o Claude escreve (Visão, revisões, design.md…) gasta do plano de quem
// usa. Antes de rodar: estimativa pelo tamanho do código (o que o Claude teria que ler) ou pelo histórico medido. Depois
// de rodar: a medição de verdade (tokens da conversa depois que a skill começou e a janela do plano na barra), que vira
// histórico. Aqui fica a regra, sem rede.
import fs from 'node:fs'
import path from 'node:path'
import { faundrPath } from './paths.mjs'
import { transcriptMark, usageSince } from './usage.mjs'
import { t } from './i18n.mjs'

/**
 * O que o setup oferece com IA. Conta inicial (sem histórico): `base` + `per` × tokens do código lido (`reads`), até
 * `cap`. Os números são o tamanho típico do que cada skill lê e escreve; a medição de verdade substitui.
 */
export const AI_ITEMS = [
  { id: 'overview', skill: 'faundr:overview', title: t('Project overview', 'Visão do projeto'), essential: true, base: 60_000, per: 0.03, reads: 'code', cap: 250_000 },
  { id: 'skills', skill: 'faundr:skills', title: t('Classify your skills', 'Classificar as suas skills'), essential: true, base: 15_000, per: 0, reads: 'code', cap: 150_000 },
  { id: 'stack', skill: 'faundr:stack', title: t('Project stack, explained', 'Stack explicada'), essential: false, base: 40_000, per: 0, reads: 'code', cap: 80_000 },
  { id: 'inventario', skill: 'faundr:inventory', title: t('Inventory of the features that already exist', 'Inventário das funcionalidades que já existem'), essential: false, base: 50_000, per: 0.03, reads: 'code', cap: 250_000 },
  { id: 'design', skill: 'faundr:design', title: t('design.md and screen audit', 'design.md e auditoria das telas'), essential: false, base: 80_000, per: 0.1, reads: 'ui', cap: 600_000 },
  { id: 'showcase', skill: 'faundr:design-showcase', title: t('Component Showcase', 'Vitrine dos componentes'), essential: false, base: 120_000, per: 0.05, reads: 'ui', cap: 400_000 },
  { id: 'security', skill: 'faundr:security', title: t('Full security review', 'Revisão de segurança completa'), essential: false, base: 200_000, per: 0.6, reads: 'code', cap: 3_000_000 },
  { id: 'quality', skill: 'faundr:quality', title: t('Full quality review', 'Revisão de qualidade completa'), essential: false, base: 150_000, per: 0.5, reads: 'code', cap: 2_500_000 },
]

const CODE = /\.(m?[jt]sx?|cjs|py|rb|go|php|rs|java|kts?|cs|swift|dart|c|cc|cpp|h|hpp|vue|svelte|astro|sql|prisma)$/i
const UI = /\.(jsx|tsx|vue|svelte|astro|html|css|scss|dart)$/i
const NOT_CODE = /(^|\/)(node_modules|dist|build|\.next|coverage|vendor|\.faundr)\/|\.(min|d)\.[jt]s$|(^|\/)(package-lock\.json|pnpm-lock\.yaml)$/

/** Tamanho do que o Claude teria que ler, em tokens (~4 caracteres cada): o código e só as telas. */
export function projectSize(root, files) {
  let code = 0
  let ui = 0
  for (const f of files) {
    if (!CODE.test(f) && !UI.test(f)) continue
    if (NOT_CODE.test(f)) continue
    let bytes = 0
    try {
      bytes = fs.statSync(path.join(root, f)).size
    } catch {
      continue
    }
    if (bytes > 400_000) continue // gerado ou dado, não código que alguém lê
    const tokens = Math.round(bytes / 4)
    if (CODE.test(f)) code += tokens
    if (UI.test(f)) ui += tokens
  }
  return { code, ui }
}

/**
 * Tokens que pesam no plano: os de entrada, saída e gravação no cache valem inteiros; a leitura do cache vale 1/10
 * (é o que ela custa na API, e os planos contam o uso pelo mesmo peso).
 */
export const planTokens = (t) => Math.round((t?.input ?? 0) + (t?.output ?? 0) + (t?.cache_creation ?? 0) + 0.1 * (t?.cache_read ?? 0))

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null
}

/**
 * Estimativa de um item. `runs`: o histórico do time ({ skill, plan_tokens, code_tokens, here }), mais recente primeiro.
 * Ordem: medido neste projeto → medido em outro (proporcional ao tamanho, de 0,5x a 3x) → conta inicial.
 */
export function estimate(item, size, runs = []) {
  const mine = runs.filter((r) => r.skill === item.skill && r.plan_tokens > 0)
  const here = mine.filter((r) => r.here).slice(0, 5)
  if (here.length) return { tokens: Math.round(median(here.map((r) => r.plan_tokens))), source: here.length === 1 ? t('measured once in this project', 'medido 1 vez neste projeto') : t(`measured ${here.length} times in this project`, `medido ${here.length} vezes neste projeto`) }
  if (mine.length) {
    const read = item.reads === 'ui' ? size.ui : size.code
    const scaled = mine.slice(0, 10).map((r) => r.plan_tokens * Math.min(3, Math.max(0.5, r.code_tokens > 0 ? read / r.code_tokens : 1)))
    return { tokens: Math.round(median(scaled)), source: t("measured in the team's other projects", 'medido em outros projetos do time') }
  }
  const read = item.reads === 'ui' ? size.ui : size.code
  return { tokens: Math.min(item.cap, Math.round(item.base + item.per * read)), source: t('initial estimate (not measured yet)', 'estimativa inicial (ainda sem medição)') }
}

/**
 * Quanto da janela do plano cada token pesa, pelas medições desta pessoa (rodadas com a janela medida pela barra). Sem
 * medição, null: aí o setup mostra só tokens e o equivalente em dólar.
 */
export function windowShare(runs) {
  const ratio = (key) => {
    const xs = runs.filter((r) => r.mine && r[key] > 0 && r.plan_tokens > 5_000).map((r) => r[key] / r.plan_tokens)
    return xs.length ? median(xs) : null
  }
  const five = ratio('five_pct')
  const week = ratio('week_pct')
  return five || week ? { five, week } : null
}

/** Equivalente na API, em dólar (Opus 5.5: US$ 4 a entrada e 20 a saída por milhão; a saída é ~5% do que pesa). */
export const usdOf = (tokens) => (tokens * (0.95 * 4 + 0.05 * 20)) / 1e6

/** Texto do custo de um item: "~120 mil tokens (≈ 9% da janela de 5 h, 2% da semana; ≈ US$ 0,58 na API)". */
export function costText(tokens, share) {
  const k =
    tokens >= 1e6
      ? t(`${(tokens / 1e6).toFixed(1)} million`, `${(tokens / 1e6).toFixed(1).replace('.', ',')} milhão(ões)`)
      : t(`${Math.max(1, Math.round(tokens / 1000))}k`, `${Math.max(1, Math.round(tokens / 1000))} mil`)
  const pct = (p) => (p >= 1 ? `${Math.round(p)}%` : t('less than 1%', 'menos de 1%'))
  const parts = []
  if (share?.five) parts.push(t(`${pct(tokens * share.five)} of the 5-hour window`, `${pct(tokens * share.five)} da janela de 5 h`))
  if (share?.week) parts.push(t(`${pct(tokens * share.week)} of the week`, `${pct(tokens * share.week)} da semana`))
  const usd = t(`US$ ${usdOf(tokens).toFixed(2)} on the API`, `US$ ${usdOf(tokens).toFixed(2).replace('.', ',')} na API`)
  return `~${k} tokens (${parts.length ? `≈ ${parts.join(', ')}; ` : ''}≈ ${usd})`
}

// ---- Medição de cada skill que roda ----------------------------------------------------------------------------
// O hook da ferramenta Skill (e o do /nome digitado) marca o começo; o fim da resposta mede e manda para o painel.

const stateFile = (root) => faundrPath(root, 'state')
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** A janela do plano agora, da última leitura da barra do Faundr (null sem a barra ou sem plano com limite). */
export function currentWindow(root) {
  const m = readJson(faundrPath(root, 'meters'))
  if (!m) return null
  return { five: m.five_hour?.pct ?? null, five_resets: m.five_hour?.resets_at ?? null, week: m.seven_day?.pct ?? null, week_resets: m.seven_day?.resets_at ?? null, at: m.at ?? null }
}

/** Só o que o setup oferece para gerar no painel é medido; as outras skills rodam sem medição. */
export const isMeasured = (name) => AI_ITEMS.some((i) => i.skill === String(name ?? '').replace(/^\//, ''))

/** Marca o começo de uma skill nesta sessão (uma marca por skill; a mesma skill de novo mantém a primeira). */
export function markSkillStart(root, sid, name, transcriptPath, now = Date.now()) {
  if (!sid || !name || !transcriptPath || !isMeasured(name)) return
  const state = readJson(stateFile(root)) ?? {}
  const open = state.skillCosts?.session === sid ? state.skillCosts.open : []
  if (open.some((o) => o.name === name)) return
  const entry = { name, at: now, transcript: transcriptPath, mark: transcriptMark(transcriptPath), window: currentWindow(root) }
  fs.mkdirSync(path.dirname(stateFile(root)), { recursive: true })
  fs.writeFileSync(stateFile(root), JSON.stringify({ ...state, skillCosts: { session: sid, open: [...open, entry] } }, null, 2))
}

/** Diferença da janela entre duas leituras (só quando a janela não virou no meio). */
export function windowDelta(before, after) {
  const d = (k, r) => (before?.[k] != null && after?.[k] != null && before[r] === after[r] && after[k] >= before[k] ? Math.round((after[k] - before[k]) * 10) / 10 : null)
  return { five_pct: d('five', 'five_resets'), week_pct: d('week', 'week_resets') }
}

/** No fim da resposta: mede cada skill marcada nesta sessão e esvazia a lista. Devolve as medições para o painel. */
export function takeSkillCosts(root, sid) {
  const state = readJson(stateFile(root)) ?? {}
  if (state.skillCosts?.session !== sid || !state.skillCosts.open?.length) return []
  fs.writeFileSync(stateFile(root), JSON.stringify({ ...state, skillCosts: { session: sid, open: [] } }, null, 2))
  const now = currentWindow(root)
  return state.skillCosts.open
    .map((o) => {
      const t = usageSince(o.transcript, o.mark)
      if (!t || !t.calls) return null
      return { skill: o.name, tokens: { input: t.input, output: t.output, cache_creation: t.cache_creation, cache_read: t.cache_read }, calls: t.calls, plan_tokens: planTokens(t), model: Object.keys(t.models)[0] ?? null, ...windowDelta(o.window, now), started_at: new Date(o.at).toISOString() }
    })
    .filter(Boolean)
}
