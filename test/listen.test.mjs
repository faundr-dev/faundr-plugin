import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bgArgs, runPrompt, warning } from '../bin/listen.mjs'
import { setLang } from '../bin/i18n.mjs'

test('sessão de fundo numa cópia separada da pasta, sem pular confirmações', () => {
  const args = bgArgs('abcdef1234567', 'Corrigir   o carrinho')
  assert.deepEqual(args.slice(0, 5), ['--bg', '--worktree', 'faundr-abcdef12', '--name', 'Faundr: Corrigir o carrinho'])
  assert.ok(!args.some((a) => /skip-permissions|bypass/i.test(a)))
})

test('o pedido diz como fechar e manda não juntar à main', () => {
  const text = runPrompt('abcdef1234567', 'Corrigir o carrinho')
  assert.match(text, /«Corrigir o carrinho»/)
  assert.match(text, /faundr inbox --done abcdef12/)
  assert.match(text, /Do not merge the work into the main project/)
})

test('o aviso fala da assinatura e dos limites', () => {
  setLang('pt')
  assert.match(warning(), /SUA assinatura/)
  assert.match(warning(), /No máximo 2 sessões/)
  assert.match(warning(), /Anthropic ainda não confirmou/)
  setLang('en')
  assert.match(warning(), /YOUR Claude subscription/)
  assert.match(warning(), /At most 2 sessions/)
})
