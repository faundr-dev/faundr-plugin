import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { editLoopNote, recordCheck, takeLoopAlerts } from '../bin/loop.mjs'

const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-loop-'))
const fail = (message, file = 'src/a.ts') => ({ checkKey: 'npx tsc --noEmit', passed: false, issues: [{ message, file }] })

test('o mesmo erro 3 vezes seguidas vira um aviso, entregue uma vez', () => {
  const d = dir()
  assert.equal(recordCheck(d, 's', fail("Property 'x' does not exist on type 'User'. (linha 10)")), null)
  assert.equal(recordCheck(d, 's', fail("Property 'x' does not exist on type 'User'. (linha 12)")), null)
  const alert = recordCheck(d, 's', fail("Property 'x' does not exist on type 'User'. (linha 14)"))
  assert.match(alert, /Loop: o mesmo erro apareceu 3 vezes seguidas em `npx tsc --noEmit`/)
  assert.match(alert, /\/faundr:undo/)
  assert.deepEqual(takeLoopAlerts(d, 's'), [alert])
  assert.deepEqual(takeLoopAlerts(d, 's'), [], 'já entregue')
  // Continua falhando: não repete o aviso na mesma sessão.
  assert.equal(recordCheck(d, 's', fail("Property 'x' does not exist on type 'User'.")), null)
})

test('erro diferente recomeça a contagem; passar zera', () => {
  const d = dir()
  recordCheck(d, 's', fail('erro A'))
  recordCheck(d, 's', fail('erro A'))
  recordCheck(d, 's', fail('erro B'))
  assert.equal(recordCheck(d, 's', fail('erro B')), null)
  recordCheck(d, 's', { checkKey: 'npx tsc --noEmit', passed: true })
  assert.equal(recordCheck(d, 's', fail('erro B')), null)
  assert.deepEqual(takeLoopAlerts(d, 's'), [])
})

test('muitas mudanças no mesmo arquivo só viram aviso com algo falhando', () => {
  const d = dir()
  assert.equal(editLoopNote(d, 's', { rel: 'src/a.ts', priorEdits: 9 }), null, 'nada falhando: é só trabalho')
  recordCheck(d, 's', fail('erro A'))
  assert.equal(editLoopNote(d, 's', { rel: 'src/a.ts', priorEdits: 5 }), null)
  const note = editLoopNote(d, 's', { rel: 'src/a.ts', priorEdits: 6 })
  assert.match(note, /7ª mudança em src\/a\.ts/)
  assert.equal(editLoopNote(d, 's', { rel: 'src/a.ts', priorEdits: 7 }), null, 'uma vez por arquivo')
})

test('prova: código mudou sem checagem passando depois → pede uma vez por leva de mudanças', async () => {
  const { proofNeeded, recordEdit } = await import('../bin/loop.mjs')
  const d = dir()
  assert.equal(proofNeeded(d, 's'), null, 'sem edição')
  recordEdit(d, 's', 'README.md', 1000)
  assert.equal(proofNeeded(d, 's'), null, 'só documentação')
  recordEdit(d, 's', 'src/a.ts', 2000)
  assert.deepEqual(proofNeeded(d, 's'), { failing: [] })
  assert.equal(proofNeeded(d, 's'), null, 'já pediu para esta leva')
  recordCheck(d, 's', { checkKey: 'npm test', passed: true, now: 3000 })
  recordEdit(d, 's', 'src/b.ts', 4000)
  recordCheck(d, 's', { checkKey: 'npm test', passed: true, now: 5000 })
  assert.equal(proofNeeded(d, 's'), null, 'testes passaram depois da mudança')
  recordEdit(d, 's', 'src/c.ts', 6000)
  recordCheck(d, 's', fail('erro C'))
  assert.deepEqual(proofNeeded(d, 's'), { failing: ['npx tsc --noEmit'] })
})
