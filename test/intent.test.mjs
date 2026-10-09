import assert from 'node:assert/strict'
import { test } from 'node:test'
import { featureIntent, featureNudge } from '../bin/intent.mjs'

// Pedidos reais (ou quase) de quem usa o Faundr.
const FEATURE = [
  'Vamos criar uma nova função aqui: tem que ter uma nova aba para as configurações do projeto',
  'muito bom, agora quero criar um modo claro do faundr, cuidado com o branco 100%',
  'as abas que dividem visão geral, design... etc... tem que ser um menu lateral agora',
  'Falta um comando para o faundr resolver todas as pendências de uma parte de uma vez',
  'Agora vamos iniciar um projeto novo pra parte de design, será o refinamento máximo',
  'blz, agora quero fazer umas modificações de design no app',
  'pode ir para a fase 2 do plano',
  'siga para a próxima etapa da funcionalidade',
  'Quero ir para uma nova funcionalidade antes de refinar as que já temos, sobre qualidade do código',
]
const NOT_FEATURE = [
  'pode',
  'qual o comando para rodar o faundr em outro lugar?',
  'como funciona o login do plugin hoje?',
  'faz o commit de tudo e publica o plugin',
  'faça o commit e rode o handoff pra atualizar o bilhete',
  'o botão de salvar não funciona quando clico duas vezes',
  'corrige o erro do npm run dev que apareceu agora',
  'This session is being continued from a previous conversation that ran out of context.',
  '/faundr:feature criar o carrinho de compras',
  'quero saber o que a gente utilizou do repositório novo, o que foi adicionado?',
]

test('pedido de funcionalidade nova: avisa', () => {
  for (const p of FEATURE) assert.equal(featureIntent(p), 'feature', p)
})

test('pergunta, rotina e conserto: não avisa', () => {
  for (const p of NOT_FEATURE) assert.equal(featureIntent(p), null, p)
})

test('aviso: cita a funcionalidade atual só quando há uma, e pede critério de pronto e etapas', () => {
  assert.match(featureNudge('Carrinho'), /continuação da funcionalidade atual \("Carrinho"\)/)
  assert.doesNotMatch(featureNudge(null), /funcionalidade atual/)
  assert.match(featureNudge(null), /--done-when/)
  assert.match(featureNudge(null), /--after atual/)
  assert.match(featureNudge(null), /2 a 3 perguntas/)
})
