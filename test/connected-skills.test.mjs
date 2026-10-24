import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { noteSkillRan, takeSkillsRan, typedSkill, writeSkillIndex } from '../bin/skills.mjs'

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cs-'))
  writeSkillIndex(root, [
    { name: 'auditor', kind: 'seguranca', topics: [] },
    { name: 'escritor', kind: null, topics: [] },
    { name: 'faundr:security', kind: 'seguranca', topics: [] },
    { name: 'outra', kind: 'nenhum', topics: [] },
  ])
  return root
}

test('/nome digitado vira o nome da skill; texto comum não', () => {
  assert.equal(typedSkill('/auditor src/api.ts'), 'auditor')
  assert.equal(typedSkill('  /plugin:revisor'), 'plugin:revisor')
  assert.equal(typedSkill('rode o auditor'), null)
})

test('só skill conectada (com tipo, fora do Faundr) entra; o fim da resposta pede o registro uma vez', () => {
  const root = project()
  for (const name of ['auditor', 'escritor', 'faundr:security', 'outra', 'auditor', '/auditor']) noteSkillRan(root, 's1', name)
  const steps = takeSkillsRan(root, 's1')
  assert.equal(steps.length, 1)
  assert.match(steps[0], /\/auditor skill \(connected to Faundr: security\)/)
  assert.match(steps[0], /faundr skill-report "auditor" --areas seguranca/)
  assert.deepEqual(takeSkillsRan(root, 's1'), [], 'esvazia depois de pedir')
})

test('a lista é da sessão: outra sessão não herda', () => {
  const root = project()
  noteSkillRan(root, 's1', 'auditor')
  assert.deepEqual(takeSkillsRan(root, 's2'), [])
})

test('faundr skill-report sem o nome ou sem achados explica o uso (e o CLI carrega)', async () => {
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const faundr = fileURLToPath(new URL('../bin/faundr.mjs', import.meta.url))
  const run = (...a) => {
    const r = spawnSync(process.execPath, [faundr, 'skill-report', ...a], { encoding: 'utf8' })
    return r.stdout + r.stderr
  }
  assert.match(run(), /usage: faundr skill-report/)
  assert.match(run('auditor', '--areas', 'seguranca'), /usage: faundr skill-report/)
  assert.match(run('auditor', '--areas', 'banco', '--none'), /usage: faundr skill-report/)
})

test('o que a pessoa lê direto sai na língua escolhida (FAUNDR_LANG); o que o Claude lê fica em inglês', async () => {
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const faundr = fileURLToPath(new URL('../bin/faundr.mjs', import.meta.url))
  // Pasta fora de qualquer git e um HOME sem config.json (a língua vem só do FAUNDR_LANG).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-lang-'))
  const run = (lang, ...a) => {
    const env = { ...process.env, FAUNDR_LANG: lang, HOME: dir, USERPROFILE: dir, FAUNDR_TOKEN: '' }
    const r = spawnSync(process.execPath, [faundr, ...a], { cwd: dir, encoding: 'utf8', env })
    return r.stdout + r.stderr
  }
  assert.match(run('en', 'checkpoints'), /This folder is not in a git repository/)
  assert.match(run('pt', 'checkpoints'), /Esta pasta não está num repositório git/)
  assert.match(run('en', 'status'), /\(folder not linked — use \/faundr:link\)/)
  assert.match(run('pt', 'status'), /\(pasta não ligada — use \/faundr:link\)/)
  // Uso de comando que só o Claude roda: inglês nas duas línguas.
  assert.match(run('pt', 'skill-report'), /usage: faundr skill-report/)
})
