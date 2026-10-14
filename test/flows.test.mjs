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

// ---- Gatilho em campos e quem chama ---------------------------------------------------------------------------

import { blockedSkill, skillNote, skillsForFile, skillsForPrompt, writeSkillIndex } from '../bin/skills.mjs'
import { workflowsForFile, workflowsForPrompt } from '../bin/workflows.mjs'

test('skill "Só você": o guard barra o Claude e o aviso vira lembrete em uma linha', () => {
  const root = tmpProject()
  writeSkillIndex(root, [
    { name: 'code-review', manual: false, call: 'user', moments: ['prompt'], topics: ['revisar'], paths: [] },
    { name: 'copywriting', manual: false, call: 'both', moments: ['prompt'], topics: [], paths: [] },
  ])
  assert.equal(blockedSkill(root, 'code-review')?.name, 'code-review')
  assert.equal(blockedSkill(root, '/code-review')?.name, 'code-review')
  assert.equal(blockedSkill(root, 'copywriting'), null)
  const hook = fileURLToPath(new URL('../bin/skill-guard.mjs', import.meta.url))
  const out = spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, tool_input: { skill: 'code-review' } }), encoding: 'utf8' }).stdout
  assert.match(out, /"permissionDecision":"deny"/)
  assert.equal(spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, tool_input: { skill: 'copywriting' } }), encoding: 'utf8' }).stdout, '')
  assert.match(skillNote([{ name: 'code-review', call: 'user', when: '' }]), /não rode; diga em uma linha "isso parece trabalho para \/code-review, quer rodar\?"/)
})

test('momentos: o pedido só vale com "prompt", o arquivo só com "edit"', () => {
  const list = [
    { name: 'a', moments: ['prompt'], topics: ['tela'], paths: ['src/**'] },
    { name: 'b', moments: ['edit'], topics: ['tela'], paths: ['src/**'] },
  ]
  assert.deepEqual(skillsForPrompt(list, 'mude a tela de pedidos').map((s) => s.name), ['a'])
  assert.deepEqual(skillsForFile(list, 'src/x.tsx').map((s) => s.name), ['b'])
  const wf = [{ id: 'w', moments: ['stop'], topics: ['tela'], paths: ['src/**'] }]
  assert.deepEqual(workflowsForPrompt(wf, 'mude a tela'), [])
  assert.deepEqual(workflowsForFile(wf, 'src/x.tsx'), [])
  // Índice antigo, sem momentos: assunto (skills) e assunto + arquivos (workflows), como antes.
  assert.equal(skillsForPrompt([{ name: 'c', topics: ['tela'] }], 'a tela').length, 1)
  assert.equal(workflowsForFile([{ id: 'v', paths: ['src/**'] }], 'src/x.tsx').length, 1)
})

// ---- Passos desligados de dentro das skills do Faundr ---------------------------------------------------------

import { skillStepsNote } from '../bin/flows.mjs'

test('passo desligado numa skill do Faundr: o aviso chega pela ferramenta Skill e pelo /faundr:x digitado', () => {
  const root = tmpProject()
  writeSkillIndex(root, [])
  assert.equal(skillStepsNote(root, 'faundr:design'), null)
  writeFlows(root, ['skill.design.browser'])
  assert.match(skillStepsNote(root, 'faundr:design'), /desligou estes passos de \/faundr:design: medir as telas no navegador/)
  assert.equal(skillStepsNote(root, 'faundr:tests'), null)
  const guard = fileURLToPath(new URL('../bin/skill-guard.mjs', import.meta.url))
  const out = spawnSync(process.execPath, [guard], { input: JSON.stringify({ cwd: root, tool_input: { skill: 'faundr:design' } }), encoding: 'utf8' }).stdout
  assert.match(out, /"additionalContext":"\[Faundr\] Neste projeto/)
  const hook = fileURLToPath(new URL('../bin/prompt-check.mjs', import.meta.url))
  const typed = spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, session_id: 's9', prompt: '/faundr:design' }), encoding: 'utf8' }).stdout
  assert.match(typed, /medir as telas no navegador/)
})
