import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actionSpace, parseBrowseArgs, stuck, validateChoice } from '../bin/browse.mjs'

test('argumentos: valores, aspas do objetivo e senha por variável', () => {
  const opts = parseBrowseArgs(
    ['--url', 'https://x.dev', '--goal', 'Busque "Zurique" e entre', '--value', 'ana', '--secret-env', 'PASS'],
    { PASS: 'segredo' },
  )
  assert.deepEqual(opts.values, ['ana', 'Zurique'])
  assert.deepEqual(opts.secrets, [{ name: 'PASS', value: 'segredo' }])
  assert.equal(opts.headless, true)
  assert.throws(() => parseBrowseArgs(['--url', 'https://x.dev', '--goal', 'g', '--secret-env', 'VAZIA'], {}), /VAZIA/)
  assert.throws(() => parseBrowseArgs(['--goal', 'g'], {}), /uso/)
})

test('cada elemento ganha um índice; cada operação, seus alvos', () => {
  const { elements, targets, controls } = actionSpace([
    { id: 'e1', node: 7, kind: 'fill', role: 'textbox', label: 'E-mail', value: '' },
    { id: 'e2', node: 7, kind: 'click', role: 'textbox', label: 'Open E-mail', value: '' },
    { id: 'e3', node: 9, kind: 'select', role: 'combobox', label: 'País → Brasil', value: 'br', current_value: 'Chile' },
    { id: 'wait', kind: 'wait', label: 'Wait' },
  ])
  assert.equal(elements.length, 2)
  assert.deepEqual(elements[0].operations, ['TYPE_TEXT', 'CLICK'])
  assert.deepEqual(Object.keys(targets.TYPE_TEXT), ['1'])
  assert.deepEqual(Object.keys(targets.SELECT), ['2:1'])
  assert.equal(elements[1].value, 'Chile')
  assert.ok(controls.WAIT)
})

test('resposta do Jev fora das opções não executa nada', () => {
  const ok = { choice: 'A', probabilities: { A: 0.8, B: 0.2 } }
  assert.equal(validateChoice(ok, ['A', 'B']), ok)
  assert.throws(() => validateChoice({ choice: 'C', probabilities: { A: 1, B: 0 } }, ['A', 'B']))
  assert.throws(() => validateChoice({ choice: 'A', probabilities: { A: 1 } }, ['A', 'B']))
  assert.throws(() => validateChoice(undefined, ['A']))
})

test('trava: a mesma ação 3 vezes sem a página mudar', () => {
  const same = { action: 'Usuário', text: 'ana', page_changed: false }
  assert.equal(stuck([same, same]), false)
  assert.equal(stuck([same, same, same]), true)
  assert.equal(stuck([same, { ...same, page_changed: true }, same]), false)
  assert.equal(stuck([same, same, { ...same, text: 'bia' }]), false)
})
