// Mod do Faundr: quando o contexto ou uma janela de uso (5 horas, semana) passa de 80% e de 95%, um aviso rápido no
// terminal, uma vez cada; e, se o projeto ligar no painel (Terminal → "Faixa acima do prompt"), uma faixa com as
// barras logo acima de onde se digita. As escolhas vêm de .faundr/painel/bar.json, que o plugin do Faundr grava no
// início de cada sessão; sem o arquivo, vale o padrão (avisos ligados, faixa desligada).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Measure } from '../types'
import { alertsFor, bandRows, type Prefs } from './alerts.ts'

const last = atom({ plugin: 'faundr-mod', key: 'measure' } as const, null)
const seen = atom({ plugin: 'faundr-mod', key: 'seen' } as const, [])

async function readPrefs($: EngineInterface): Promise<Prefs> {
  try {
    return JSON.parse(await $.fs.read(`${await $.session.root()}/.faundr/painel/bar.json`)) as Prefs
  } catch {
    return {}
  }
}

export const register: Register = (on) => {
  let prefs: Prefs = {}

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    prefs = await readPrefs($)
    return r
  })

  on('session.measure', async ($, e, next) => {
    // O plugin do Faundr regrava as escolhas no início da sessão: relê aqui para pegar a mudança sem reiniciar.
    prefs = await readPrefs($)
    const m: Measure = { context: { percent: e.context.percent }, rateLimits: e.rateLimits }
    await update($, last, () => m)
    const r = alertsFor(m, prefs, await read($, seen))
    if (r.toasts.length) {
      await update($, seen, () => r.seen)
      for (const t of r.toasts) $.ui.toast(t, { timeoutMs: 8000 })
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const m = await read($, last)
    if (e.props.hasSurvey || prefs.items?.faixa !== true || !m) return next(e)
    const rows = bandRows(m, prefs)
    if (!rows.length) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {rows.map((r) => (
          <Box key={r.label}>
            <Text dimColor={!r.high} bold={r.high}>
              {`${r.label.padEnd(4)}${r.bar} ${r.pct.padStart(4)}${r.note ? `  ${r.note}` : ''}`}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
