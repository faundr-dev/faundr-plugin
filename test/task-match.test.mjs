import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { commitMessageOf, commitTextOf } from '../bin/hook-payload.mjs'
import { hintsSeen, matchOpenTasks, noteCommit, rememberHints, sessionWorkText } from '../bin/task-match.mjs'

// Tarefas de construir abertas, como o servidor manda (o caso real de 15/11/2026 e outras do mesmo quadro).
const FAQ = { id: 'd1ee4036-aaaa-bbbb-cccc-000000000001', title: "Trocar o 'Nada durante o beta' do FAQ da home (Quanto custa?) quando a cobrança abrir para todos", feature: 'Cobrança em produção', featureId: 'cob' }
const OPEN = [
  FAQ,
  { id: '24838777-aaaa-bbbb-cccc-000000000002', title: 'Checkout: a descrição do plano no resumo vem do produto no Stripe e só existe em português', feature: 'Cobrança em produção', featureId: 'cob' },
  { id: 'a1000000-aaaa-bbbb-cccc-000000000003', title: 'Alertas por e-mail (escolher o serviço de envio)', feature: 'Erros: contínuo e opcional (fase 3)', featureId: 'err' },
  { id: 'a2000000-aaaa-bbbb-cccc-000000000004', title: 'Limpeza: login novo e apagar os 6 tokens antigos', feature: 'Login seguro do plugin e lista de tokens', featureId: 'log' },
  { id: 'a3000000-aaaa-bbbb-cccc-000000000005', title: 'Passar tela por tela no celular: margens, grades empilhadas e tabelas', feature: 'App usável no celular', featureId: 'cel' },
  { id: 'a4000000-aaaa-bbbb-cccc-000000000006', title: 'Formato compacto no plugin: ligações sem os valores padrão', feature: 'Mapa do código leve para enviar e abrir', featureId: 'map' },
]
const COMMIT =
  'Home: o FAQ "Quanto custa?" deixa de dizer "Nada durante o beta", agora que a cobrança está aberta. Lista os planos com o preço na moeda do país e avisa do reembolso integral em até 7 dias da primeira cobrança'

test('o commit feito numa sessão de outra funcionalidade acha a tarefa aberta que ele terminou (o caso do FAQ)', () => {
  const hits = matchOpenTasks(OPEN, { currentId: 'emails', text: COMMIT })
  assert.deepEqual(hits.map((h) => h.id), [FAQ.id])
  assert.equal(hits[0].feature, 'Cobrança em produção')
})

test('não aponta tarefa da funcionalidade atual, nem a que já foi apontada, nem por uma palavra solta', () => {
  // Da funcionalidade atual: o aviso de depois do commit já lista as tarefas dela.
  assert.deepEqual(matchOpenTasks(OPEN, { currentId: 'cob', text: COMMIT }), [])
  assert.deepEqual(matchOpenTasks(OPEN, { currentId: 'emails', text: COMMIT, skip: [FAQ.id] }), [])
  // Uma palavra em comum ("plugin", "login") não é a mesma tarefa.
  assert.deepEqual(matchOpenTasks(OPEN, { text: 'Plugin: corrige o login com Google no painel' }), [])
  assert.deepEqual(matchOpenTasks(OPEN, { text: 'ok' }), [])
  assert.deepEqual(matchOpenTasks([], { text: COMMIT }), [])
})

test('o pedido da pessoa também acha a tarefa, e no máximo 3 saem', () => {
  const hits = matchOpenTasks(OPEN, { text: 'apaga os tokens antigos do plugin e faz o login novo, é a limpeza que ficou' })
  assert.deepEqual(hits.map((h) => h.featureId ?? h.feature), ['Login seguro do plugin e lista de tokens'])
  const many = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, title: `Trocar o texto beta do FAQ da home número ${i}`, feature: 'F', featureId: `f${i}` }))
  assert.equal(matchOpenTasks(many, { text: 'trocar texto beta FAQ home' }).length <= 3, true)
})

test('a mensagem inteira do commit sai do comando (heredoc ou -m), sem a linha de coautoria', () => {
  const heredoc = `cd repo && git commit -q -F - <<'EOF'\nHome: o FAQ deixa de dizer beta\n\n- lista os planos\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nEOF\ngit log -1`
  assert.equal(commitTextOf(heredoc), 'Home: o FAQ deixa de dizer beta - lista os planos')
  assert.equal(commitTextOf('git commit -m "Corrige o login" && git push'), 'Corrige o login')
  assert.equal(commitTextOf('git status'), '')
  assert.equal(commitTextOf('git commit -m "$(cat msg.txt)"'), '')
  // O título curto que vai ao painel continua igual.
  assert.equal(commitMessageOf(heredoc), 'Home: o FAQ deixa de dizer beta')
  assert.equal(commitMessageOf('git status'), null)
})

test('o texto da sessão junta os commits dela e os últimos pedidos; outra sessão começa vazia', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-match-'))
  fs.mkdirSync(path.join(root, '.faundr'))
  fs.writeFileSync(path.join(root, '.faundr', 'state.json'), JSON.stringify({ prompts: { session: 's1', list: [{ at: 1, text: 'troca o texto do FAQ' }] }, keep: 1 }))
  noteCommit(root, 's1', 'Home: FAQ sem beta')
  noteCommit(root, 's1', '')
  assert.equal(sessionWorkText(root, 's1'), 'Home: FAQ sem beta\ntroca o texto do FAQ')
  assert.equal(sessionWorkText(root, 's2'), '')
  // Guardar não apaga o resto do estado da pasta.
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'state.json'), 'utf8')).keep, 1)
  noteCommit(root, 's2', 'Outro commit')
  assert.equal(sessionWorkText(root, 's2'), 'Outro commit')
})

test('cada tarefa é apontada uma vez por sessão e o mesmo texto não é conferido de novo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-match-'))
  fs.mkdirSync(path.join(root, '.faundr'))
  assert.deepEqual(hintsSeen(root, 's1'), { ids: [], text: '' })
  rememberHints(root, 's1', ['a'], 'texto 1')
  rememberHints(root, 's1', ['b', 'a'], 'texto 2')
  assert.deepEqual(hintsSeen(root, 's1'), { ids: ['a', 'b'], text: 'texto 2' })
  assert.deepEqual(hintsSeen(root, 's2'), { ids: [], text: '' })
})
