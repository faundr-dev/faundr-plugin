import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { takeAcks, takeInbox, writeInbox } from '../bin/inbox.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-inbox-'))
const item = (id, kind = 'request') => ({ id, kind, text: `texto ${id}` })

test('entrega uma vez por pasta, mesmo com duas sessões', () => {
  const root = tmp()
  writeInbox(root, [item('a'), item('b', 'note')])
  assert.deepEqual(takeInbox(root, 's1'), ['texto a', 'texto b'])
  assert.deepEqual(takeInbox(root, 's2'), [])
  // O servidor ainda manda o mesmo item até receber a confirmação: não repete.
  writeInbox(root, [item('a'), item('c')])
  assert.deepEqual(takeInbox(root, 's2'), ['texto c'])
})

test('confirmação vai uma vez, só pela sessão que entregou', () => {
  const root = tmp()
  writeInbox(root, [item('a'), item('n', 'note')])
  takeInbox(root, 's1')
  assert.deepEqual(takeAcks(root, 's2'), [])
  assert.deepEqual(takeAcks(root, 's1'), [{ id: 'a', kind: 'request' }, { id: 'n', kind: 'note' }])
  assert.deepEqual(takeAcks(root, 's1'), [])
})

test('sem sessão ou sem arquivo: nada quebra', () => {
  const root = tmp()
  assert.deepEqual(takeInbox(root, null), [])
  assert.deepEqual(takeInbox(root, 's1'), [])
  assert.deepEqual(takeAcks(root, 's1'), [])
})
