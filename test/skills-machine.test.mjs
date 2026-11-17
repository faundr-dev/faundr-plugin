import assert from 'node:assert/strict'
import { test } from 'node:test'
import { skillsMachine } from '../bin/cmd-workflows-skills.mjs'

test('computador das skills: nome da máquina e um pedaço da pasta (duas pastas na mesma máquina contam separado)', () => {
  const a = skillsMachine('C:/repo/main', { machine: 'notebook' })
  const b = skillsMachine('C:/repo/feature', { machine: 'notebook' })
  assert.match(a, /^notebook#[0-9a-f]{4}$/)
  assert.notEqual(a, b)
  // A mesma pasta escrita com outra caixa (Windows) é o mesmo computador.
  assert.equal(skillsMachine('c:/REPO/main', { machine: 'notebook' }), a)
})
