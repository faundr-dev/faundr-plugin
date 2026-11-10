import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readJsonObject, writeJsonAtomic } from '../bin/json-file.mjs'
import { writeState } from '../bin/cli-core.mjs'
import { recordCheck } from '../bin/loop.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-json-'))

test('grava inteiro, sem deixar o temporário, e cria a pasta', () => {
  const file = path.join(tmp(), 'sub', 'state.json')
  assert.equal(writeJsonAtomic(file, { a: 1 }, 2), true)
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { a: 1 })
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['state.json'])
})

test('estado ilegível agora (outro hook gravando) não é zerado por cima', () => {
  const root = tmp()
  const file = path.join(root, '.faundr', 'state.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '{"currentFeatureId": "fig", "prompts": {"sess')
  writeState(root, { committedTasks: null })
  assert.equal(fs.readFileSync(file, 'utf8'), '{"currentFeatureId": "fig", "prompts": {"sess')
  const configDir = tmp()
  fs.writeFileSync(path.join(configDir, 'loop-s1.json'), '{"checks": {"build"')
  recordCheck(configDir, 's1', { checkKey: 'build', passed: true })
  assert.equal(fs.readFileSync(path.join(configDir, 'loop-s1.json'), 'utf8'), '{"checks": {"build"')
})

test('estado estragado de vez (parado há tempo) vai para .broken e o Faundr recomeça', () => {
  const root = tmp()
  const file = path.join(root, '.faundr', 'state.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '')
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(file, old, old)
  assert.deepEqual(readJsonObject(file), {})
  writeState(root, { currentFeatureId: 'fig' })
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { currentFeatureId: 'fig' })
  assert.ok(fs.existsSync(`${file}.broken`))
})
