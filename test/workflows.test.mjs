import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { parseItem, parseStep, topicHit, workflowsForFile, workflowsForPrompt, workflowsOnce, writeWorkflows } from '../bin/workflows.mjs'

const LIST = [
  { id: 'w1', ref: 'W-1', name: 'Estudar outro projeto', trigger: 'copiar funções de outro repositório', topics: ['copiar funcionalidade', 'repositório', 'repo'], paths: [] },
  { id: 'w2', ref: 'W-2', name: 'Design', trigger: 'telas e componentes', topics: ['design', 'ui'], paths: ['src/components/**'] },
]

test('assunto bate pelo radical, sem acento e sem plural', () => {
  assert.ok(topicHit('design', 'arruma o Design da tela de login'))
  assert.ok(topicHit('copiar funcionalidade', 'quero copiar as funcionalidades daquele app'))
  assert.ok(topicHit('repositório', 'clona esses repositorios'))
  assert.ok(!topicHit('copiar funcionalidade', 'copiar o arquivo'))
})

test('palavra comum fica de fora do assunto', () => {
  assert.ok(topicHit('outro projeto', 'copiar de outro projeto'))
  assert.ok(!topicHit('outro projeto', 'o login do outro'))
  assert.ok(!topicHit('para isso', 'qualquer pedido para isso'))
})

test('palavra curta vale inteira', () => {
  assert.ok(topicHit('ui', 'melhora a UI do painel'))
  assert.ok(!topicHit('ui', 'o build fuiu'))
})

test('workflows do pedido: ignora o já mostrado e o texto colado', () => {
  assert.deepEqual(workflowsForPrompt(LIST, 'mexe no design do header').map((w) => w.id), ['w2'])
  assert.deepEqual(workflowsForPrompt(LIST, 'mexe no design do header', ['w2']), [])
  assert.deepEqual(workflowsForPrompt(LIST, 'veja isso <pasted_content id="x">design design</pasted_content>'), [])
  assert.deepEqual(workflowsForPrompt(LIST, 'veja esse repo e copie o que der').map((w) => w.id), ['w1'])
})

test('workflows do arquivo pelos padrões', () => {
  assert.deepEqual(workflowsForFile(LIST, 'src/components/ui/Button.tsx').map((w) => w.id), ['w2'])
  assert.deepEqual(workflowsForFile(LIST, 'src/server/x.ts'), [])
})

test('cada workflow chega uma vez por sessão', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-wf-'))
  writeWorkflows(root, LIST)
  const pick = (list, ids) => workflowsForPrompt(list, 'design da home', ids)
  const first = workflowsOnce(root, 's1', pick, 'This request')
  assert.match(first, /W-2 Design/)
  assert.match(first, /faundr workflow show W-2/)
  assert.equal(workflowsOnce(root, 's1', pick, 'This request'), null)
  assert.match(workflowsOnce(root, 's2', pick, 'This request'), /W-2/)
})

test('passo do draft: tipo na frente e detalhe depois do travessão', () => {
  assert.deepEqual(parseStep('skill: /faundr:design — auditar as telas'), { type: 'skill', title: '/faundr:design', body: 'auditar as telas' })
  assert.deepEqual(parseStep('agentes 3: ler o código'), { type: 'agents', title: 'ler o código', body: '', count: 3 })
  assert.deepEqual(parseStep('comando: npm test'), { type: 'command', title: 'npm test', body: '' })
  assert.deepEqual(parseStep('perguntar: qual repositório?'), { type: 'ask', title: 'qual repositório?', body: '' })
  assert.deepEqual(parseStep('Buscar repositórios parecidos no GitHub'), { type: 'step', title: 'Buscar repositórios parecidos no GitHub', body: '' })
  assert.equal(parseStep('Nota: isso é texto').type, 'step')
  assert.equal(parseStep('  '), null)
})

test('item do draft: esperar e grupo em paralelo', () => {
  assert.deepEqual(parseItem('esperar: os testes passarem'), { type: 'wait', title: 'os testes passarem', body: '' })
  assert.deepEqual(parseItem('paralelo: skill: faundr:design | comando: npm test'), {
    parallel: [
      { type: 'skill', title: 'faundr:design', body: '' },
      { type: 'command', title: 'npm test', body: '' },
    ],
  })
  assert.deepEqual(parseItem('paralelo: só um'), { type: 'step', title: 'só um', body: '' })
})
