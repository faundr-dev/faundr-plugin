// Lógica pura do mod do Faundr (sem o Claude Code nem o Node, para dar para testar com node --test): quais avisos
// mostrar quando o contexto ou uma janela de uso passa de 80% e de 95%, e as linhas da faixa acima do prompt.

/** Uma janela de uso como o Claude Code entrega ao mod (`five_hour`, `seven_day`). */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Measure = { context?: { percent?: number }; rateLimits?: Limit[] }
/** Escolhas do painel (.faundr/painel/bar.json): os itens e se avisa. */
export type Prefs = { items?: Record<string, boolean>; alerts?: boolean }

export const THRESHOLDS = [80, 95] as const

const LABEL: Record<string, string> = { five_hour: 'Janela de 5 horas', seven_day: 'Limite da semana' }
const ITEM: Record<string, string> = { five_hour: 'cinco_horas', seven_day: 'semana' }

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** "18:40" se zera hoje, "sáb 09:00" se não. */
export function resetText(iso: string | undefined, now: number) {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return new Date(now).toDateString() === d.toDateString() ? hm : `${WEEKDAY[d.getDay()]} ${hm}`
}

const on = (prefs: Prefs, item: string, fallback = true) => (typeof prefs.items?.[item] === 'boolean' ? prefs.items[item] : fallback)

/**
 * Avisos a mostrar agora. `seen` guarda os já mostrados ("ctx:80", "five_hour:95:<quando zera>"): cada um aparece
 * uma vez; o do contexto volta a valer quando ele cai abaixo de 50% (depois de /compact), o de uma janela quando ela
 * zera (outro horário). Devolve os textos e o novo `seen`.
 */
export function alertsFor(m: Measure, prefs: Prefs, seen: string[], now = Date.now()) {
  if (prefs.alerts === false) return { toasts: [] as string[], seen }
  const next = new Set(seen)
  const toasts: string[] = []
  const ctx = m.context?.percent
  if (typeof ctx === 'number') {
    if (ctx < 50) for (const k of [...next]) if (k.startsWith('ctx:')) next.delete(k)
    const hit = [...THRESHOLDS].reverse().find((t) => ctx >= t)
    if (hit && on(prefs, 'contexto') && !next.has(`ctx:${hit}`)) {
      toasts.push(hit >= 95 ? `Contexto em ${Math.round(ctx)}%: use /compact já, ou o Claude vai resumir a conversa sozinho` : `Contexto em ${Math.round(ctx)}%: hora de /compact`)
      for (const t of THRESHOLDS) if (t <= hit) next.add(`ctx:${t}`)
    }
  }
  for (const l of m.rateLimits ?? []) {
    const label = LABEL[l.kind]
    const item = ITEM[l.kind]
    if (!label || !item || !on(prefs, item)) continue
    const hit = [...THRESHOLDS].reverse().find((t) => l.percentUsed >= t)
    const key = (t: number) => `${l.kind}:${t}:${l.resetsAt ?? ''}`
    if (!hit || next.has(key(hit))) continue
    const at = resetText(l.resetsAt, now)
    toasts.push(`${label} em ${Math.round(l.percentUsed)}%${at ? `: zera ${at.includes(' ') ? at : `às ${at}`}` : ''}`)
    for (const t of THRESHOLDS) if (t <= hit) next.add(key(t))
  }
  return { toasts, seen: [...next] }
}

/** Barra de 5 blocos (a mesma da linha de status). */
export const bar = (pct: number) => {
  const n = Math.min(5, Math.max(0, Math.ceil(Math.round(pct) / 20)))
  return '█'.repeat(n) + '░'.repeat(5 - n)
}

/** Linhas da faixa acima do prompt: rótulo, barra, porcentagem, quando zera e se está alto (80%+). */
export function bandRows(m: Measure, prefs: Prefs, now = Date.now()) {
  const rows: { label: string; bar: string; pct: string; note: string; high: boolean }[] = []
  const ctx = m.context?.percent
  if (typeof ctx === 'number' && on(prefs, 'contexto')) rows.push({ label: 'ctx', bar: bar(ctx), pct: `${Math.round(ctx)}%`, note: ctx >= 80 ? 'hora de /compact' : '', high: ctx >= 80 })
  for (const [kind, item, short] of [['five_hour', 'cinco_horas', '5h'], ['seven_day', 'semana', 'sem']] as const) {
    const l = m.rateLimits?.find((x) => x.kind === kind)
    if (!l || !on(prefs, item)) continue
    const at = resetText(l.resetsAt, now)
    rows.push({ label: short, bar: bar(l.percentUsed), pct: `${Math.round(l.percentUsed)}%`, note: at ? `zera ${at}` : '', high: l.percentUsed >= 80 })
  }
  return rows
}
