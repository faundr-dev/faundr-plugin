import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pluginFrames } from '../bin/failures.mjs'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')

function node(args, { input = '', env = {}, cwd } = {}) {
  const { CLAUDE_CODE_SESSION_ID: _, ...parent } = process.env
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...parent, ...env } })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('close', (code) => resolve({ code, out, err }))
    child.stdin.end(input)
  })
}

async function fakeServer() {
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      calls.push({ url: req.url, body: body ? JSON.parse(body) : {} })
      res.setHeader('content-type', 'application/json')
      res.end('{}')
    })
  })
  await new Promise((r) => server.listen(0, r))
  return { server, calls, url: `http://127.0.0.1:${server.address().port}` }
}

function project(projectId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-fail-'))
  fs.writeFileSync(path.join(root, '.faundr.json'), JSON.stringify({ projectId }))
  return root
}

const record = (root, home, command) =>
  node(
    [
      '--input-type=module',
      '-e',
      `import { recordFailure } from ${JSON.stringify(pathToFileURL(path.join(BIN, 'failures.mjs')).href)}
       const err = new TypeError('falhou ao ler C:/Users/ana/projeto-secreto/src/pagamento.ts: const chave = "sk_live"')
       err.code = 'ERR_INVALID_ARG_TYPE'
       recordFailure(${JSON.stringify(command)}, 'crash', err, 1234)`,
    ],
    { cwd: root, env: { HOME: home, USERPROFILE: home } },
  )

test('linhas do stack: só as de dentro do plugin, sem o caminho do computador', () => {
  const plugin = path.join(BIN, 'cmd-security.mjs')
  const stack = [
    'TypeError: x',
    `    at scanFile (${plugin}:42:7)`,
    '    at readProjectFile (C:\\Users\\ana\\projeto-secreto\\src\\pagamento.ts:9:1)',
    `    at async ${pathToFileURL(path.join(BIN, 'faundr.mjs')).href}:200:5`,
    '    at node:internal/process/task_queues:95:5',
  ].join('\n')
  assert.deepEqual(pluginFrames(stack), ['bin/cmd-security.mjs:42 scanFile', 'bin/faundr.mjs:200'])
  assert.deepEqual(pluginFrames(undefined), [])
})

test('falha anotada sem a mensagem e enviada no próximo evento do hook, só a do projeto ligado', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  const root = project('p1')
  const other = project('p2')
  const { server, calls, url } = await fakeServer()
  try {
    await record(root, home, 'security-scan')
    await record(other, home, 'quality-scan')
    const file = path.join(home, '.faundr', 'failures.json')
    const saved = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(saved, /projeto-secreto|sk_live|pagamento/)
    assert.equal(JSON.parse(saved).length, 2)

    const env = { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: url, FAUNDR_LANG: 'pt' }
    const input = JSON.stringify({ hook_event_name: 'Notification', session_id: 's1', cwd: root, message: 'oi' })
    const r = await node([path.join(BIN, 'faundr.mjs'), 'hook', 'claude'], { input, env, cwd: root })
    assert.equal(r.code, 0, r.err)

    const sent = calls.find((c) => c.url === '/api/hooks/event').body.failures
    assert.equal(sent.length, 1)
    assert.equal(sent[0].command, 'security-scan')
    assert.equal(sent[0].kind, 'crash')
    assert.equal(sent[0].errorName, 'TypeError')
    assert.equal(sent[0].errorCode, 'ERR_INVALID_ARG_TYPE')
    assert.equal(sent[0].ms, 1234)
    assert.match(sent[0].version, /^\d+\.\d+\.\d+$/)
    assert.equal(sent[0].projectId, undefined)
    assert.ok(!('message' in sent[0]))
    // A do outro projeto fica para quando ele mandar um evento.
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).map((f) => f.command), ['quality-scan'])
  } finally {
    server.close()
  }
})
