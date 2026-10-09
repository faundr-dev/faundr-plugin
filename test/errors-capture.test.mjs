import assert from 'node:assert/strict'
import { test } from 'node:test'
import { outputSaysFailed, parseErrors } from '../bin/errors.mjs'

// Saída real do node --test que passou (o resumo sempre escreve "fail 0").
const NODE_PASSED = `✔ wordsOf separa camelCase (1.2ms)
ℹ tests 126
ℹ suites 0
ℹ pass 126
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 28989.8584`

const NODE_FAILED = `✔ soma (0.5ms)
✖ aplica cupom (2.1ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  5 !== 4
ℹ tests 2
ℹ pass 1
ℹ fail 1
✖ failing tests:

test at plugin/test/cart.test.mjs:3:1
✖ aplica cupom (2.1ms)`

test('com pipe: resumo de zero falhas não é falha; falha de verdade é', () => {
  assert.equal(outputSaysFailed(NODE_PASSED), false)
  assert.equal(outputSaysFailed('Found 0 errors. Watching for file changes.'), false)
  assert.equal(outputSaysFailed('Tests  12 passed (12)\n0 failed'), false)
  assert.equal(outputSaysFailed('errors: 0, warnings: 2'), false)
  assert.equal(outputSaysFailed(NODE_FAILED), true)
  assert.equal(outputSaysFailed('error TS2322: Type string is not assignable'), true)
  assert.equal(outputSaysFailed('Tests  1 failed | 11 passed'), true)
})

test('node --test que passou não vira erro, nem a última linha do resumo', () => {
  assert.deepEqual(parseErrors(NODE_PASSED, { kind: 'test', root: '/p', failed: false }), [])
  // Mesmo se algo marcar como falha, o resumo ("ℹ duration_ms") não vira o título do erro.
  const forced = parseErrors(NODE_PASSED, { kind: 'test', root: '/p', failed: true })
  assert.ok(forced.every((i) => !/fail 0|duration_ms/.test(i.title)), JSON.stringify(forced))
})

test('node --test que falhou: um erro por teste, com o motivo, sem repetir a lista do fim', () => {
  const issues = parseErrors(NODE_FAILED, { kind: 'test', root: '/p', failed: true })
  assert.equal(issues.length, 1)
  assert.match(issues[0].title, /^Teste falhou: aplica cupom \(AssertionError/)
  // Saída no formato TAP também.
  const tap = parseErrors('ok 1 - soma\nnot ok 2 - aplica cupom\n  ---\n# fail 1', { kind: 'test', root: '/p', failed: true })
  assert.match(tap[0].title, /^Teste falhou: aplica cupom/)
})
