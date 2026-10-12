import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bgArgs, runPrompt, WARNING } from '../bin/listen.mjs'

test('sessão de fundo numa cópia separada da pasta, sem pular confirmações', () => {
  const args = bgArgs('abcdef1234567', 'Corrigir   o carrinho')
  assert.deepEqual(args.slice(0, 5), ['--bg', '--worktree', 'faundr-abcdef12', '--name', 'Faundr: Corrigir o carrinho'])
  assert.ok(!args.some((a) => /skip-permissions|bypass/i.test(a)))
})

test('o pedido diz como fechar e manda não juntar à main', () => {
  const text = runPrompt('abcdef1234567', 'Corrigir o carrinho')
  assert.match(text, /«Corrigir o carrinho»/)
  assert.match(text, /faundr fila --feito abcdef12/)
  assert.match(text, /Não junte o trabalho ao projeto principal/)
})

test('o aviso fala da assinatura e dos limites', () => {
  assert.match(WARNING, /SUA assinatura/)
  assert.match(WARNING, /No máximo 2 sessões/)
  assert.match(WARNING, /Anthropic ainda não confirmou/)
})
