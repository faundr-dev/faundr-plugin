import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')

function lines(cwd, env, area, checkKey) {
  const { CLAUDE_CODE_SESSION_ID: _, ...parent } = process.env
  const code = `import { patternLines } from ${JSON.stringify(pathToFileURL(path.join(BIN, 'patterns.mjs')).href)}
    console.log(JSON.stringify(await patternLines(${JSON.stringify(area)}, ${JSON.stringify(checkKey)})))`
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd, env: { ...parent, ...env } })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.on('close', () => resolve(JSON.parse(out || '[]')))
  })
}

test('padrões aprovados entram no contexto da área; sem rede, a seção some', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-pat-'))
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  fs.writeFileSync(path.join(root, '.faundr.json'), JSON.stringify({ projectId: 'p1' }))
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      calls.push(JSON.parse(body))
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ lang: 'TypeScript', patterns: [{ area: 'security', check_key: 'xss-inner-html', title: 'HTML com texto do usuário', summary: 'Quebra a página.', tip: 'Use textContent.' }] }))
    })
  })
  await new Promise((r) => server.listen(0, r))
  const env = { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: `http://127.0.0.1:${server.address().port}` }
  try {
    const out = await lines(root, env, 'errors', 'typecheck:tsc')
    assert.deepEqual(calls[0], { projectId: 'p1', area: 'errors', checkKey: 'typecheck:tsc' })
    assert.match(out[0], /^## Seen and fixed in other projects with TypeScript/)
    assert.equal(out[1], '- HTML com texto do usuário: Quebra a página. Tip: Use textContent.')
  } finally {
    server.close()
  }
  // Servidor fora do ar: nenhuma linha, sem erro.
  assert.deepEqual(await lines(root, { ...env, FAUNDR_API_URL: 'http://127.0.0.1:9' }, 'security'), [])
})
