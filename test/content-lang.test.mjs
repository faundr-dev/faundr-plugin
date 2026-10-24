import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { contentLangLine, ensureContentLang, languageGuidance } from '../bin/content-lang.mjs'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')

test('contentLangLine: diz a língua do projeto e manda responder na língua da pessoa', () => {
  assert.equal(
    contentLangLine('pt'),
    '[Faundr] Faundr content language: Portuguese — write everything you record in Faundr (features, tasks, decisions, rules, concerns, findings, handoff, Overview, Stack, Architecture, design.md) in Portuguese, even when the user writes in another language. Reply to the user in their own language.',
  )
  assert.match(contentLangLine('en'), /content language: English — .* in English, even when/)
  assert.match(languageGuidance('pt'), /content language: Portuguese[^]*Command names, flags and IDs stay as they are/)
})

test('ensureContentLang: projeto com língua não grava nada', async () => {
  let calls = 0
  const r = await ensureContentLang('en', 'pt', async () => calls++)
  assert.deepEqual(r, { lang: 'en', saved: false })
  assert.equal(calls, 0)
})

test('ensureContentLang: sem língua, grava a da pessoa e vale a que o servidor devolve', async () => {
  const sent = []
  assert.deepEqual(await ensureContentLang(null, 'pt', async (l) => (sent.push(l), l)), { lang: 'pt', saved: true })
  // Outra pessoa gravou antes: o servidor não troca e devolve a dela.
  assert.deepEqual(await ensureContentLang(null, 'pt', async () => 'en'), { lang: 'en', saved: true })
  assert.deepEqual(sent, ['pt'])
})

test('ensureContentLang: sem rede ou sem a coluna, vale a da pessoa nesta vez', async () => {
  assert.deepEqual(await ensureContentLang(undefined, 'pt', async () => { throw new Error('offline') }), { lang: 'pt', saved: false })
  assert.deepEqual(await ensureContentLang(null, 'pt', async () => null), { lang: 'pt', saved: false })
})

function run(args, { input = '', env = {}, cwd } = {}) {
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

// Servidor falso: o projeto começa sem língua (ou com `initial`) e só grava quando ainda está vazia.
async function fakeServer(initial = null) {
  let stored = initial
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const b = body ? JSON.parse(body) : {}
      calls.push({ url: req.url, body: b })
      res.setHeader('content-type', 'application/json')
      if (req.url === '/api/cli/memory' && b.action === 'content-lang') {
        if (b.set && stored === null) stored = b.set
        return res.end(JSON.stringify({ contentLang: stored }))
      }
      if (req.url === '/api/hooks/event') return res.end(JSON.stringify({ additionalContext: '[Faundr] Project: Teste', contentLang: stored }))
      res.end('{}')
    })
  })
  await new Promise((r) => server.listen(0, r))
  return { server, calls, url: `http://127.0.0.1:${server.address().port}` }
}

function project(state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-lang-'))
  fs.writeFileSync(path.join(root, '.faundr.json'), JSON.stringify({ projectId: 'p1' }))
  if (state) {
    fs.mkdirSync(path.join(root, '.faundr'), { recursive: true })
    fs.writeFileSync(path.join(root, '.faundr', 'state.json'), JSON.stringify(state))
  }
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  return { root, home }
}

const setCalls = (calls) => calls.filter((c) => c.body.action === 'content-lang' && c.body.set)

test('início da sessão: projeto sem língua grava a da pessoa uma vez e o contexto já sai nela', async () => {
  const { root, home } = project()
  const { server, calls, url } = await fakeServer(null)
  const env = { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: url, FAUNDR_LANG: 'pt' }
  const start = (sid) => run(['hook', 'claude'], { input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: sid, cwd: root, source: 'startup' }), env, cwd: root })
  try {
    const first = await start('s1')
    const ctx = JSON.parse(first.out).hookSpecificOutput.additionalContext
    assert.match(ctx, /Faundr content language: Portuguese/, first.err)
    assert.deepEqual(setCalls(calls).map((c) => c.body.set), ['pt'])
    // Na sessão seguinte o servidor já manda a língua: nada é gravado de novo.
    const second = await start('s2')
    assert.match(JSON.parse(second.out).hookSpecificOutput.additionalContext, /content language: Portuguese/)
    assert.equal(setCalls(calls).length, 1)
  } finally {
    server.close()
  }
})

test('início da sessão: língua escolhida no painel vale mesmo para quem usa outra', async () => {
  const { root, home } = project()
  const { server, calls, url } = await fakeServer('en')
  const env = { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: url, FAUNDR_LANG: 'pt' }
  try {
    const { out, err } = await run(['hook', 'claude'], { input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 's1', cwd: root, source: 'startup' }), env, cwd: root })
    assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Faundr content language: English — .* in English/, err)
    assert.equal(setCalls(calls).length, 0)
  } finally {
    server.close()
  }
})

test('design-context: usa a cópia local; sem ela, grava a língua da pessoa só se o projeto não tiver', async () => {
  const local = project({ contentLang: 'pt' })
  const { server, calls, url } = await fakeServer('en')
  const env = (home) => ({ HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: url, FAUNDR_LANG: 'pt' })
  try {
    const a = await run(['design-context'], { cwd: local.root, env: env(local.home) })
    assert.match(a.out, /Faundr content language: Portuguese/, a.err)
    assert.equal(calls.filter((c) => c.body.action === 'content-lang').length, 0, 'com a cópia local, não pergunta a língua ao servidor')

    // Sem cópia local: pede para gravar 'pt', mas o projeto já tem 'en' e o servidor não troca.
    const fresh = project()
    const b = await run(['design-context'], { cwd: fresh.root, env: env(fresh.home) })
    assert.match(b.out, /Faundr content language: English/, b.err)
    assert.deepEqual(setCalls(calls).map((c) => c.body.set), ['pt'])
  } finally {
    server.close()
  }
})
