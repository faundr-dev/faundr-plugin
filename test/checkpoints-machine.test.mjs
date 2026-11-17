import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkpointMachine } from '../bin/cmd-checkpoints.mjs'

test('checkpoint por computador: nome do computador + pedaço da pasta, igual para a mesma pasta', () => {
  const a = checkpointMachine('C:/proj/app', { machine: 'notebook' })
  assert.match(a, /^notebook#[0-9a-f]{4}$/)
  // Mesma pasta com letras diferentes (Windows) dá o mesmo computador; outra pasta (worktree) é outra linha.
  assert.equal(checkpointMachine('c:/PROJ/app', { machine: 'notebook' }), a)
  assert.notEqual(checkpointMachine('C:/proj/app-wt', { machine: 'notebook' }), a)
})
