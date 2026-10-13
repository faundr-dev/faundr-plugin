import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { alertsFor, bandRows, resetText } from '../mod/hooks/alerts.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// 12/10/2026 15:00 no fuso local.
const NOW = new Date(2026, 9, 12, 15, 0).getTime()
const at = (d, h, m) => new Date(2026, 9, d, h, m).toISOString()

test('avisos: 80% e 95% uma vez cada, o maior engole o menor', () => {
  let r = alertsFor({ context: { percent: 82 } }, {}, [], NOW)
  assert.deepEqual(r.toasts, ['Contexto em 82%: hora de /compact'])
  r = alertsFor({ context: { percent: 85 } }, {}, r.seen, NOW)
  assert.deepEqual(r.toasts, [])
  r = alertsFor({ context: { percent: 96 } }, {}, r.seen, NOW)
  assert.match(r.toasts[0], /^Contexto em 96%: use \/compact já/)
  // Pulou direto para 97%: um aviso só, o de 95%, e o de 80% não vem depois.
  r = alertsFor({ context: { percent: 97 } }, {}, [], NOW)
  assert.equal(r.toasts.length, 1)
  assert.equal(alertsFor({ context: { percent: 83 } }, {}, r.seen, NOW).toasts.length, 0)
})

test('avisos: contexto volta a avisar depois de cair abaixo de 50%; janela, depois de zerar', () => {
  let r = alertsFor({ context: { percent: 90 } }, {}, [], NOW)
  r = alertsFor({ context: { percent: 12 } }, {}, r.seen, NOW)
  assert.deepEqual(alertsFor({ context: { percent: 81 } }, {}, r.seen, NOW).toasts, ['Contexto em 81%: hora de /compact'])
  const five = { kind: 'five_hour', percentUsed: 83, resetsAt: at(12, 18, 40) }
  r = alertsFor({ rateLimits: [five] }, {}, [], NOW)
  assert.deepEqual(r.toasts, ['Janela de 5 horas em 83%: zera às 18:40'])
  assert.equal(alertsFor({ rateLimits: [five] }, {}, r.seen, NOW).toasts.length, 0)
  assert.equal(alertsFor({ rateLimits: [{ ...five, resetsAt: at(12, 23, 40) }] }, {}, r.seen, NOW).toasts.length, 1)
  assert.deepEqual(alertsFor({ rateLimits: [{ kind: 'seven_day', percentUsed: 95.4, resetsAt: at(17, 9, 0) }] }, {}, [], NOW).toasts, ['Limite da semana em 95%: zera sáb 09:00'])
})

test('avisos: respeitam o painel (aviso desligado, item desligado) e ignoram janela desconhecida', () => {
  assert.deepEqual(alertsFor({ context: { percent: 99 } }, { alerts: false }, [], NOW).toasts, [])
  assert.deepEqual(alertsFor({ context: { percent: 99 } }, { items: { contexto: false } }, [], NOW).toasts, [])
  assert.deepEqual(alertsFor({ rateLimits: [{ kind: 'spend_limit', percentUsed: 99 }] }, {}, [], NOW).toasts, [])
})

test('faixa: uma linha por medidor ligado, com barra, quando zera e destaque em 80%+', () => {
  const rows = bandRows({ context: { percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 84, resetsAt: at(12, 18, 40) }, { kind: 'seven_day', percentUsed: 61 }] }, {}, NOW)
  assert.deepEqual(rows, [
    { label: 'ctx', bar: '███░░', pct: '42%', note: '', high: false },
    { label: '5h', bar: '█████', pct: '84%', note: 'zera 18:40', high: true },
    { label: 'sem', bar: '████░', pct: '61%', note: '', high: false },
  ])
  assert.deepEqual(bandRows({ context: { percent: 42 } }, { items: { contexto: false } }, NOW), [])
  assert.equal(resetText('x', NOW), null)
})

test('marketplace: o Faundr e o mod, cada um com o seu manifesto', () => {
  const market = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'))
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source]), [['faundr', './'], ['faundr-mod', './mod']])
  const mod = JSON.parse(fs.readFileSync(path.join(ROOT, 'mod', '.claude-plugin', 'plugin.json'), 'utf8'))
  assert.equal(mod.name, 'faundr-mod')
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT, 'mod', 'hooks', 'hooks.json'), 'utf8')), { modules: ['./register.tsx'] })
})
