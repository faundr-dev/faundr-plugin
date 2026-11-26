import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { addPending, hasPending, queueableCommand, queueableEvent, sendPending, takePendingReport } from '../bin/pending.mjs'

const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-pending-'))
  return { dir, file: path.join(dir, 'pending.json'), reportFile: path.join(dir, 'report.json') }
}
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

test('fila: só comandos que gravam no painel; leitura e listagem precisam de rede na hora', () => {
  for (const c of ['feature', 'task', 'done', 'handoff', 'overview-save', 'stack-save', 'decision', 'concern']) assert.ok(queueableCommand(c, ['x']), c)
  for (const c of ['board', 'resume', 'stack-context', 'overview-context', 'graph-query']) assert.ok(!queueableCommand(c, []), c)
  // Sem argumento, criteria e resolve só listam; workflow list/show só leem.
  assert.ok(!queueableCommand('criteria', []))
  assert.ok(queueableCommand('criteria', ['a; b']))
  assert.ok(!queueableCommand('resolve', []))
  assert.ok(queueableCommand('workflow', ['draft', 'Registrar erros']))
  assert.ok(!queueableCommand('workflow', ['show', 'W-1']))
  assert.ok(!queueableCommand('task', ['--help']))
})

test('fila: eventos só do estado ao vivo não são reenviados', () => {
  assert.ok(queueableEvent('PostToolUse'))
  assert.ok(queueableEvent('SessionStart'))
  assert.ok(!queueableEvent('PreToolUse'))
  assert.ok(!queueableEvent('Notification'))
})

test('fila: manda na ordem em que foi guardado e esvazia', async () => {
  const { file, reportFile } = tmp()
  assert.equal(hasPending(file), false)
  addPending({ kind: 'command', command: 'feature', args: ['A'], cwd: '.' }, { file })
  addPending({ kind: 'event', projectId: 'p', body: { at: 1 } }, { file })
  addPending({ kind: 'command', command: 'task', args: ['B'], cwd: '.' }, { file })
  assert.equal(hasPending(file), true)
  const order = []
  const { sent } = await sendPending({
    file,
    reportFile,
    postEvent: async () => (order.push('event'), 'ok'),
    runCommand: (e) => (order.push(e.command), 'ok'),
  })
  assert.equal(sent, 3)
  assert.deepEqual(order, ['feature', 'event', 'task'])
  assert.deepEqual(read(file), [])
  assert.equal(hasPending(file), false)
})

test('fila: sem rede de novo, para no primeiro e guarda a tentativa; depois de 5 tentativas, sai e avisa', async () => {
  const { file, reportFile } = tmp()
  addPending({ kind: 'command', command: 'task', args: ['B'], cwd: '.' }, { file })
  addPending({ kind: 'command', command: 'done', args: ['B'], cwd: '.' }, { file })
  let calls = 0
  const retry = { file, reportFile, postEvent: async () => 'retry', runCommand: () => (calls++, 'retry') }
  await sendPending(retry)
  assert.equal(calls, 1)
  assert.equal(read(file).length, 2)
  assert.equal(read(file)[0].tries, 1)
  for (let i = 0; i < 4; i++) await sendPending(retry)
  // A quinta tentativa tira o primeiro e segue para o segundo, que também fica sem rede.
  assert.equal(read(file).length, 1)
  assert.equal(read(file)[0].command, 'done')
  const report = takePendingReport(reportFile)
  assert.equal(report.length, 1)
  assert.match(report[0].command, /^task B/)
  assert.deepEqual(takePendingReport(reportFile), [])
})

test('fila: comando recusado pelo painel não repete e vai para o relatório', async () => {
  const { file, reportFile } = tmp()
  addPending({ kind: 'command', command: 'done', args: ['tarefa que não existe'], cwd: '.' }, { file })
  addPending({ kind: 'command', command: 'task', args: ['C'], cwd: '.' }, { file })
  const ran = []
  await sendPending({ file, reportFile, postEvent: async () => 'ok', runCommand: (e) => (ran.push(e.command), e.command === 'done' ? { drop: 'No task matches' } : 'ok') })
  assert.deepEqual(ran, ['done', 'task'])
  assert.deepEqual(read(file), [])
  assert.equal(takePendingReport(reportFile)[0].reason, 'No task matches')
})

test('fila: guardado há mais de um dia sai sem ser mandado', async () => {
  const { file, reportFile } = tmp()
  addPending({ kind: 'event', projectId: 'p', body: {} }, { file, now: Date.now() - 25 * 60 * 60_000 })
  let posted = 0
  await sendPending({ file, reportFile, postEvent: async () => (posted++, 'ok'), runCommand: () => 'ok' })
  assert.equal(posted, 0)
  assert.deepEqual(read(file), [])
})

test('fila: dois envios ao mesmo tempo não mandam a mesma coisa duas vezes', async () => {
  const { file, reportFile } = tmp()
  addPending({ kind: 'event', projectId: 'p', body: {} }, { file })
  let posted = 0
  let release
  const slow = new Promise((r) => (release = r))
  const first = sendPending({ file, reportFile, postEvent: async () => (posted++, await slow, 'ok'), runCommand: () => 'ok' })
  const second = await sendPending({ file, reportFile, postEvent: async () => (posted++, 'ok'), runCommand: () => 'ok' })
  assert.equal(second.busy, true)
  release()
  await first
  assert.equal(posted, 1)
})
