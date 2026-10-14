import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { stepOff, writeFlows } from '../bin/flows.mjs'

const tmpProject = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-flows-'))
  fs.writeFileSync(path.join(root, '.faundr.json'), JSON.stringify({ projectId: 'p1' }))
  return root
}

test('sem cópia local, tudo ligado; com a lista do painel, só o que foi desligado', () => {
  const root = tmpProject()
  assert.equal(stepOff(root, 'stop.design'), false)
  writeFlows(root, ['stop.design'])
  assert.equal(stepOff(root, 'stop.design'), true)
  assert.equal(stepOff(root, 'stop.proof'), false)
})

test('o hook do pedido não sugere planejar quando "prompt.feature" está desligado', () => {
  const root = tmpProject()
  const hook = fileURLToPath(new URL('../bin/prompt-check.mjs', import.meta.url))
  const run = () =>
    spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, session_id: 's1', prompt: 'quero criar uma tela nova de pedidos com filtros e exportar' }), encoding: 'utf8' }).stdout
  assert.match(run(), /trabalho novo/)
  writeFlows(root, ['prompt.feature'])
  assert.doesNotMatch(run(), /trabalho novo/)
})
