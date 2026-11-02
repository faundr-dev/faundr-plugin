import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')

function run(args, { input = '', env = {}, cwd } = {}) {
  // Rodando dentro do Claude Code, a sessão de quem roda os testes não pode vazar para o comando.
  const { CLAUDE_CODE_SESSION_ID: _, ...parent } = process.env
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(BIN, 'faundr.mjs'), ...args], { cwd, env: { ...parent, ...env } })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('close', (code) => resolve({ code, out, err }))
    child.stdin.end(input)
  })
}

const done = (title) => ({ id: title, title, task_status: 'completed' })
// Quadro de exemplo: "Org" terminou e a próxima etapa "Multiplayer" está vazia; "Figurinhas" tem tarefas abertas.
const BOARD = [
  { id: 'org', title: 'Org', finished: true, planned: false, next: ['mp'], tasks: [done('a'), done('b')] },
  { id: 'mp', title: 'Multiplayer', finished: false, planned: true, next: [], tasks: [] },
  {
    id: 'fig',
    title: 'Figurinhas',
    finished: false,
    planned: false,
    next: [],
    tasks: [done('Artes'), { id: 'p', title: 'Pódio com moldura', task_status: 'pending' }, { id: 'b', title: 'Brasão', task_status: 'in_progress' }],
  },
]

async function setup(state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-board-'))
  fs.writeFileSync(path.join(root, '.faundr.json'), JSON.stringify({ projectId: 'p1' }))
  fs.mkdirSync(path.join(root, '.faundr'), { recursive: true })
  fs.writeFileSync(path.join(root, '.faundr', 'state.json'), JSON.stringify(state))
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  fs.mkdirSync(path.join(home, '.faundr'))
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const b = body ? JSON.parse(body) : {}
      calls.push(b)
      res.setHeader('content-type', 'application/json')
      if (b.action === 'board') {
        const features = b.featureId ? BOARD.filter((f) => f.id === b.featureId) : BOARD
        return res.end(JSON.stringify({ features, allFeatures: BOARD }))
      }
      res.end(JSON.stringify({ id: 'new', criteria: [], title: 'x' }))
    })
  })
  await new Promise((r) => server.listen(0, r))
  const env = { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: `http://127.0.0.1:${server.address().port}` }
  const adds = () => calls.filter((c) => c.action === 'add')
  return { root, env, calls, adds, close: () => server.close() }
}

test('faundr task: funcionalidade pronta com próxima etapa vazia não grava sem --force', async () => {
  const s = await setup({ currentFeatureId: 'org' })
  try {
    const a = await run(['task', 'API do time inteiro'], { cwd: s.root, env: s.env })
    assert.match(a.out, /Nothing saved: "Org" is already finished/, a.err)
    assert.match(a.out, /faundr focus "Multiplayer"/)
    assert.equal(s.adds().length, 0)
    await run(['task', 'API do time inteiro', '--force'], { cwd: s.root, env: s.env })
    assert.equal(s.adds()[0].parentId, 'org')
    // Funcionalidade ainda aberta: grava direto.
    fs.writeFileSync(path.join(s.root, '.faundr', 'state.json'), JSON.stringify({ currentFeatureId: 'fig' }))
    await run(['task', 'Moldura'], { cwd: s.root, env: s.env })
    assert.equal(s.adds()[1].parentId, 'fig')
  } finally {
    s.close()
  }
})

test('faundr feature: nome de etapa planejada vira a atual em vez de criar outra igual', async () => {
  const s = await setup({})
  try {
    const a = await run(['feature', 'multiplayer', '--done-when', 'time inteiro'], { cwd: s.root, env: s.env })
    assert.match(a.out, /"Multiplayer" was already on the board as a planned stage/, a.err)
    assert.equal(s.adds().length, 0)
    assert.equal(s.calls.find((c) => c.action === 'criteria')?.featureId, 'mp')
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.root, '.faundr', 'state.json'), 'utf8')).currentFeatureId, 'mp')
    const again = await run(['feature', 'Multiplayer', '--after', 'Org'], { cwd: s.root, env: s.env })
    assert.match(again.out, /Already recorded/)
    assert.equal(s.adds().length, 0)
  } finally {
    s.close()
  }
})

test('fim da resposta depois do commit: pede para marcar as tarefas abertas, uma vez', async () => {
  const s = await setup({ currentFeatureId: 'fig', committedTasks: 's1' })
  const gate = () => run(['gate', 'claude'], { cwd: s.root, env: s.env, input: JSON.stringify({ session_id: 's1', cwd: s.root }) })
  try {
    const a = await gate()
    const reason = JSON.parse(a.out).reason
    assert.match(reason, /"Figurinhas" still has open tasks: 2\. Pódio com moldura; 3\. Brasão/, a.err)
    assert.doesNotMatch(reason, /Artes/)
    assert.equal((await gate()).out, '')
  } finally {
    s.close()
  }
})
