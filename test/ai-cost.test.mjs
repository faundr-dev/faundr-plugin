import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { AI_ITEMS, costText, estimate, markSkillStart, planTokens, takeSkillCosts, windowDelta, windowShare } from '../bin/ai-cost.mjs'
import { setLang } from '../bin/i18n.mjs'

setLang('pt')

const overview = AI_ITEMS.find((i) => i.id === 'overview')
const security = AI_ITEMS.find((i) => i.id === 'security')
const size = { code: 1_000_000, ui: 200_000 }

test('sem histórico: conta inicial pelo tamanho do código, com teto', () => {
  assert.deepEqual(estimate(overview, size), { tokens: 90_000, source: 'estimativa inicial (ainda sem medição)' })
  assert.equal(estimate(security, { code: 50_000_000, ui: 0 }).tokens, security.cap)
})

test('medido neste projeto vence; medido em outro projeto escala pelo tamanho (de 0,5x a 3x)', () => {
  const here = [{ skill: 'faundr:overview', plan_tokens: 70_000, code_tokens: 1_000_000, here: true }]
  assert.deepEqual(estimate(overview, size, here), { tokens: 70_000, source: 'medido 1 vez neste projeto' })
  const other = [{ skill: 'faundr:overview', plan_tokens: 40_000, code_tokens: 250_000, here: false }]
  assert.equal(estimate(overview, size, other).tokens, 120_000, 'projeto 4x maior: teto de 3x')
  assert.equal(estimate(overview, size, other).source, 'medido em outros projetos do time')
})

test('% da janela: só pelas medições da própria pessoa com a janela medida', () => {
  assert.equal(windowShare([]), null)
  const runs = [
    { mine: true, plan_tokens: 100_000, five_pct: 5, week_pct: 1 },
    { mine: true, plan_tokens: 200_000, five_pct: 10, week_pct: 2 },
    { mine: false, plan_tokens: 100_000, five_pct: 90, week_pct: 90 },
  ]
  const s = windowShare(runs)
  assert.equal(s.five, 5 / 100_000)
  assert.equal(s.week, 1 / 100_000)
  assert.match(costText(300_000, s), /~300 mil tokens \(≈ 15% da janela de 5 h, 3% da semana; ≈ US\$ 1,44 na API\)/)
  assert.match(costText(300_000, null), /^~300 mil tokens \(≈ US\$ 1,44 na API\)$/)
  setLang('en')
  assert.equal(costText(300_000, s), '~300k tokens (≈ 15% of the 5-hour window, 3% of the week; ≈ US$ 1.44 on the API)')
  setLang('pt')
})

test('peso no plano: leitura do cache vale 1/10', () => {
  assert.equal(planTokens({ input: 100, output: 50, cache_creation: 1000, cache_read: 10_000 }), 2150)
})

test('janela: só conta quando não virou no meio', () => {
  assert.deepEqual(windowDelta({ five: 10, five_resets: 1, week: 3, week_resets: 9 }, { five: 14.5, five_resets: 1, week: 4, week_resets: 9 }), { five_pct: 4.5, week_pct: 1 })
  assert.deepEqual(windowDelta({ five: 80, five_resets: 1 }, { five: 2, five_resets: 2 }), { five_pct: null, week_pct: null })
})

test('marca o começo da skill e, no fim da resposta, mede só o que veio depois', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cost-'))
  const transcript = path.join(root, 'conversa.jsonl')
  const answer = (id, input, output, cacheRead) =>
    JSON.stringify({ type: 'assistant', message: { id, model: 'claude-opus-5-5', usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: 0 } } }) + '\n'
  fs.writeFileSync(transcript, answer('antes', 999_999, 999_999, 0))
  markSkillStart(root, 's1', 'faundr:overview', transcript)
  markSkillStart(root, 's1', 'faundr:overview', transcript) // a mesma skill de novo mantém a primeira marca
  fs.appendFileSync(transcript, answer('a', 1000, 200, 50_000) + answer('b', 500, 100, 20_000))
  const [run, ...rest] = takeSkillCosts(root, 's1')
  assert.equal(rest.length, 0)
  assert.equal(run.skill, 'faundr:overview')
  assert.deepEqual(run.tokens, { input: 1500, output: 300, cache_creation: 0, cache_read: 70_000 })
  assert.equal(run.plan_tokens, 1500 + 300 + 7000)
  assert.equal(run.calls, 2)
  assert.deepEqual(takeSkillCosts(root, 's1'), [], 'mede uma vez')
})

test('só os itens do setup são medidos: outras skills (do Faundr ou de terceiros) não', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cost2-'))
  const transcript = path.join(root, 'conversa.jsonl')
  fs.writeFileSync(transcript, '')
  for (const name of ['faundr:resume', 'code-review', 'tdd']) markSkillStart(root, 's1', name, transcript)
  fs.appendFileSync(transcript, JSON.stringify({ type: 'assistant', message: { id: 'x', model: 'm', usage: { input_tokens: 10, output_tokens: 1 } } }) + '\n')
  assert.deepEqual(takeSkillCosts(root, 's1'), [])
})
