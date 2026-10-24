import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { bar, barPrefs, installStatusline, launcherSource, meterItems, metersSnapshot, resetText, statusFromBoard, statusLine, visible } from '../bin/statusline.mjs'
import { setLang } from '../bin/i18n.mjs'

// A barra sai na língua da pessoa; os textos abaixo são os em português (a prévia do painel também).
setLang('pt')

const board = {
  projectName: 'Lojinha',
  concerns: [{ ref: 1 }, { ref: 2 }],
  allFeatures: [
    { id: 'f1', title: 'Frete grátis', tasks: [{ title: 'Regra', task_status: 'completed' }, { title: 'Testes', task_status: 'in_progress' }, { title: 'Painel', task_status: 'pending' }] },
    { id: 'f2', title: 'Outra', tasks: [] },
  ],
}

test('barra: projeto, funcionalidade com progresso, passo atual, grafo e preocupações', () => {
  const s = statusFromBoard(board, 'f1', board.projectName, 1)
  assert.deepEqual(s, { projectName: 'Lojinha', feature: { title: 'Frete grátis', done: 1, total: 3, next: 'Testes' }, concerns: 2, features: 2, at: 1 })
  assert.equal(statusLine(s, { graph: 'fresh' }), 'Faundr · Lojinha · Frete grátis 1/3 · agora: Testes · grafo em dia · 2 preocupação(ões)')
  assert.equal(statusLine(statusFromBoard(board, 'nada', null), { graph: null }), 'Faundr · sem funcionalidade atual · 2 preocupação(ões)')
  assert.equal(statusLine(undefined), 'Faundr · sem funcionalidade atual')
  setLang('en')
  assert.equal(statusLine(s, { graph: 'fresh' }), 'Faundr · Lojinha · Frete grátis 1/3 · now: Testes · map up to date · 2 concerns')
  assert.equal(statusLine(undefined), 'Faundr · no current feature')
  setLang('pt')
  assert.ok(statusLine(s, { width: 20 }).length <= 20)
})

test('instalar a barra: lançador fixo, não troca uma barra que já existe sem --force', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-s-'))
  const configDir = path.join(home, '.claude')
  const r = installStatusline({ pluginFile: '/x/bin/faundr.mjs', home, configDir })
  assert.equal(r.ok, true)
  const settings = JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8'))
  assert.equal(settings.statusLine.type, 'command')
  assert.match(settings.statusLine.command, /^node ".*\/\.faundr\/statusline\.mjs"$/)
  assert.equal(installStatusline({ pluginFile: '/x', home, configDir }).already, true)
  // Barra de outra ferramenta: não substitui sem --force, e mantém o resto das configurações.
  fs.writeFileSync(path.join(configDir, 'settings.json'), JSON.stringify({ model: 'opus', statusLine: { type: 'command', command: 'outra' } }))
  assert.equal(installStatusline({ pluginFile: '/x', home, configDir }).ok, false)
  const forced = installStatusline({ pluginFile: '/x', home, configDir, force: true })
  assert.equal(forced.replaced.command, 'outra')
  assert.equal(JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8')).model, 'opus')
  assert.match(launcherSource('/x/bin/faundr.mjs'), /process\.argv\.splice\(2, 0, 'statusline'\)/)
  fs.rmSync(home, { recursive: true, force: true })
})

// 12/10/2026 15:00 no fuso local; zera às 18:40 do mesmo dia e no sábado às 09:00.
const NOW = new Date(2026, 9, 12, 15, 0).getTime()
const sec = (d) => Math.round(d.getTime() / 1000)
const INPUT = {
  context_window: { used_percentage: 42, context_window_size: 200000 },
  rate_limits: { five_hour: { used_percentage: 23.5, resets_at: sec(new Date(2026, 9, 12, 18, 40)) }, seven_day: { used_percentage: 61, resets_at: sec(new Date(2026, 9, 17, 9, 0)) } },
  cost: { total_cost_usd: 1.234 },
}

test('medidores: barra de 5 blocos, horário em que zera e custo desligado por padrão', () => {
  assert.deepEqual([bar(0), bar(1), bar(20), bar(42), bar(100), bar(140)], ['░░░░░', '█░░░░', '█░░░░', '███░░', '█████', '█████'])
  assert.equal(resetText(sec(new Date(2026, 9, 12, 18, 40)), NOW), '18:40')
  assert.equal(resetText(sec(new Date(2026, 9, 17, 9, 0)), NOW), 'sáb 09:00')
  assert.equal(resetText('x', NOW), null)
  assert.deepEqual(meterItems(INPUT, undefined, NOW), ['ctx ███░░ 42%', '5h ██░░░ 24%', 'sem ████░ 61%'])
  assert.deepEqual(meterItems(INPUT, { items: { custo: true, semana: false } }, NOW), ['ctx ███░░ 42%', '5h ██░░░ 24%', 'US$ 1,23'])
  // Sem dados (começo da sessão, plano sem limites): nada aparece.
  assert.deepEqual(meterItems({ context_window: { used_percentage: null } }, undefined, NOW), [])
})

test('aviso: 80% em negrito com a dica, 95% invertido; desligado, só a barra', () => {
  const hot = { context_window: { used_percentage: 85 }, rate_limits: { five_hour: { used_percentage: 96, resets_at: sec(new Date(2026, 9, 12, 18, 40)) } } }
  const [ctx, five] = meterItems(hot, undefined, NOW)
  assert.equal(ctx, '\u001b[1mctx █████ 85% hora de /compact\u001b[22m')
  assert.equal(five, '\u001b[7m 5h █████ 96% zera 18:40 \u001b[27m')
  assert.deepEqual(meterItems(hot, { alerts: false }, NOW), ['ctx █████ 85%', '5h █████ 96%'])
  assert.equal(visible(ctx), 'ctx █████ 85% hora de /compact'.length)
})

test('barra com medidores: no fim da linha se couber, senão na segunda linha; itens desligados somem', () => {
  const s = { projectName: 'Lojinha', feature: { title: 'Frete', done: 1, total: 3, next: 'Testes' }, concerns: 0 }
  assert.equal(statusLine(s, { input: INPUT, now: NOW }), 'Faundr · Lojinha · Frete 1/3 · agora: Testes · ctx ███░░ 42% · 5h ██░░░ 24% · sem ████░ 61%')
  assert.equal(statusLine(s, { input: INPUT, now: NOW, width: 50 }), 'Faundr · Lojinha · Frete 1/3 · agora: Testes\nctx ███░░ 42% · 5h ██░░░ 24% · sem ████░ 61%')
  const only = { items: { projeto: false, funcionalidade: false, passo: false, grafo: false, preocupacoes: false } }
  assert.equal(statusLine(s, { input: INPUT, now: NOW, prefs: only }), 'ctx ███░░ 42% · 5h ██░░░ 24% · sem ████░ 61%')
  assert.deepEqual(barPrefs({ items: { contexto: 'sim', nada: true }, alerts: 1 }), { items: barPrefs({}).items, alerts: true })
})

test('prévia do painel igual à barra do plugin (mesmos itens, mesmo texto)', async () => {
  const panel = await import('../../src/lib/statusbar.ts')
  assert.deepEqual(panel.BAR_ITEMS.map((i) => [i.key, i.on]), Object.entries(barPrefs({}).items))
  const s = panel.PREVIEW_SAMPLE
  const now = new Date(2026, 9, 12, 15, 0).getTime()
  const input = {
    context_window: { used_percentage: s.context },
    rate_limits: {
      five_hour: { used_percentage: s.fiveHour.pct, resets_at: Math.round(new Date(2026, 9, 12, 18, 40).getTime() / 1000) },
      seven_day: { used_percentage: s.week.pct, resets_at: Math.round(new Date(2026, 9, 17, 9, 0).getTime() / 1000) },
    },
    cost: { total_cost_usd: s.usd },
  }
  for (const prefs of [{}, { items: { custo: true, grafo: false } }, { alerts: false }]) {
    const plain = statusLine(s.status, { graph: s.graph, input, prefs, now, width: 400 }).replace(/\u001b\[7m (.*?) \u001b\[27m/g, '$1').replace(/\u001b\[[0-9;]*m/g, '')
    assert.equal(plain, panel.previewParts(panel.barPrefs(prefs)).map((p) => p.text).join(' · '))
  }
})

test('medidores para o painel: contexto e janelas arredondados; sem nenhum, null', () => {
  const snap = metersSnapshot(
    {
      session_id: 's1',
      model: { display_name: 'Opus' },
      context_window: { used_percentage: 42.37, context_window_size: 200000 },
      rate_limits: { five_hour: { used_percentage: 61.04, resets_at: 1760000000 } },
    },
    5,
  )
  assert.deepEqual(snap, {
    session_id: 's1',
    context_pct: 42.4,
    context_size: 200000,
    five_hour: { pct: 61, resets_at: 1760000000 },
    seven_day: null,
    model: 'Opus',
    at: 5,
  })
  assert.equal(metersSnapshot({ model: { display_name: 'Opus' } }), null)
})
