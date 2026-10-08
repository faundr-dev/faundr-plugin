import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkPackage, guardInstall, installedPackages } from '../bin/package-guard.mjs'

test('acha os pacotes que o comando instala', () => {
  const names = (cmd) => installedPackages(cmd).map((p) => `${p.ecosystem}:${p.name}`)
  assert.deepEqual(names('npm install react@18 @tanstack/react-query --save-dev'), ['npm:react', 'npm:@tanstack/react-query'])
  assert.deepEqual(names('cd app && pnpm add zod'), ['npm:zod'])
  assert.deepEqual(names('yarn add lodash'), ['npm:lodash'])
  assert.deepEqual(names('bun add hono'), ['npm:hono'])
  assert.deepEqual(names('pip install requests==2.31 "fastapi[all]>=0.100" -r requirements.txt'), ['pypi:requests', 'pypi:fastapi'])
  assert.deepEqual(names('python -m pip install Flask_Login'), ['pypi:flask-login'])
  assert.deepEqual(names('uv add httpx'), ['pypi:httpx'])
  assert.deepEqual(names('poetry add pydantic'), ['pypi:pydantic'])
  // Sem nome do registro: nada a conferir.
  for (const cmd of ['npm install', 'npm ci', 'npm i ./pacote-local', 'npm i github:user/repo', 'npm i user/repo', 'pip install -e .', 'pip install -r req.txt', 'npm install --registry https://x.dev foo', 'npm run build'])
    assert.deepEqual(names(cmd), [], cmd)
})

// Registro falso: só responde o que o teste define.
function fakeRegistry(table) {
  return async (url) => {
    const hit = Object.entries(table).find(([k]) => url.endsWith(k))
    if (!hit) return { status: 404, ok: false, json: async () => ({ error: 'not_found' }) }
    const [, body] = hit
    if (body === 'down') throw new Error('sem rede')
    return { status: 200, ok: true, json: async () => body }
  }
}

const NOW = Date.parse('2026-10-08T12:00:00Z')

test('npm: existe e é usado, não existe, novo, quase sem uso, sem rede', async () => {
  const fetchImpl = fakeRegistry({
    'last-week/react': { downloads: 30_000_000 },
    'last-week/leftpad-pro': { downloads: 3 },
    'registry.npmjs.org/leftpad-pro': { versions: {}, time: { created: '2026-10-01T00:00:00Z' } },
    'last-week/velho-raro': { downloads: 12 },
    'registry.npmjs.org/velho-raro': { versions: {}, time: { created: '2019-01-01T00:00:00Z' } },
    'last-week/caiu': 'down',
  })
  assert.equal((await checkPackage({ ecosystem: 'npm', name: 'react' }, { fetchImpl, now: NOW })).status, 'ok')
  assert.equal((await checkPackage({ ecosystem: 'npm', name: 'react-utils-helper-ai' }, { fetchImpl, now: NOW })).status, 'missing')
  assert.equal((await checkPackage({ ecosystem: 'npm', name: 'leftpad-pro' }, { fetchImpl, now: NOW })).status, 'new')
  assert.equal((await checkPackage({ ecosystem: 'npm', name: 'velho-raro' }, { fetchImpl, now: NOW })).status, 'unpopular')
  assert.equal(await checkPackage({ ecosystem: 'npm', name: 'caiu' }, { fetchImpl, now: NOW }), null)
})

test('PyPI: não existe e novo', async () => {
  const fetchImpl = fakeRegistry({
    'pypi/requests/json': { releases: { '1.0': [{ upload_time_iso_8601: '2012-01-01T00:00:00Z' }] } },
    'pypi/fastapi-ai-tools/json': { releases: { '0.1': [{ upload_time_iso_8601: '2026-10-06T00:00:00Z' }] } },
  })
  assert.equal((await checkPackage({ ecosystem: 'pypi', name: 'requests' }, { fetchImpl, now: NOW })).status, 'ok')
  assert.equal((await checkPackage({ ecosystem: 'pypi', name: 'fastapi-ai-tools' }, { fetchImpl, now: NOW })).status, 'new')
  assert.equal((await checkPackage({ ecosystem: 'pypi', name: 'nao-existe-xyz' }, { fetchImpl, now: NOW })).status, 'missing')
})

test('guardInstall: barra o inexistente, pergunta do novo, cacheia o que passou, deixa passar sem rede', async () => {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-pkg-'))
  let calls = 0
  const table = {
    'last-week/react': { downloads: 30_000_000 },
    'last-week/leftpad-pro': { downloads: 3 },
    'registry.npmjs.org/leftpad-pro': { versions: {}, time: { created: '2026-10-01T00:00:00Z' } },
  }
  const base = fakeRegistry(table)
  const fetchImpl = (url, o) => (calls++, base(url, o))

  const deny = await guardInstall('npm i react supabase-auth-helpers-ai', { configDir, fetchImpl, now: NOW })
  assert.equal(deny.level, 'deny')
  assert.match(deny.message, /"supabase-auth-helpers-ai" não existe no npm/)

  const ask = await guardInstall('npm i leftpad-pro', { configDir, fetchImpl, now: NOW })
  assert.equal(ask.level, 'ask')
  assert.match(ask.message, /criado há 7 dia/)

  calls = 0
  assert.equal(await guardInstall('npm i react', { configDir, fetchImpl, now: NOW }), null)
  assert.equal(calls, 0, 'react veio do cache')

  const offline = fakeRegistry({ 'last-week/qualquer': 'down', 'registry.npmjs.org/qualquer': 'down' })
  assert.equal(await guardInstall('npm i qualquer', { configDir, fetchImpl: offline, now: NOW }), null)
})
