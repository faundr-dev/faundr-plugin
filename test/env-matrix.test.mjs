import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { configuredHosting, envMatrix, hostingFromCli } from '../bin/env-matrix.mjs'
import { publicSecretValueFindings } from '../bin/security.mjs'

function project(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-env-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true })
    fs.writeFileSync(path.join(d, rel), text)
  }
  return [d, Object.keys(files)]
}

test('matriz: código x exemplo x computador x hospedagem', () => {
  const [d, files] = project({
    'src/server/pay.ts': 'const k = process.env.STRIPE_SECRET_KEY\nconst u = process.env.SITE_URL ?? "http://localhost"\nconst m = `defina process.env.NOME_NO_TEXTO`',
    'src/lib/db.ts': 'createClient(import.meta.env.VITE_SUPABASE_URL)',
    'scripts/seed.ts': 'process.env.SEED_ONLY',
    'src/env.d.ts': 'interface Env { TIPO_SO: string }\nenv.TIPO_SO',
    '.env.example': 'VITE_SUPABASE_URL=\nVELHA=\n',
    '.env.local': 'VITE_SUPABASE_URL=https://x\nSTRIPE_SECRET_KEY=sk\n',
    'wrangler.jsonc': '{ "name": "app", // comentário\n "vars": { "SITE_URL": "https://app.dev" } }',
  })
  const m = envMatrix(d, files, { cache: { provider: 'cloudflare', at: 'x', names: [] } })
  const row = (n) => m.rows.find((r) => r.name === n)
  assert.deepEqual(m.rows.map((r) => r.name), ['SITE_URL', 'STRIPE_SECRET_KEY', 'VELHA', 'VITE_SUPABASE_URL'], 'sem scripts, .d.ts nem texto')
  assert.equal(row('STRIPE_SECRET_KEY').hosting, false, 'a CLI listou e ela não está')
  assert.equal(row('SITE_URL').hosting, true, 'definida no wrangler')
  assert.equal(row('SITE_URL').optional, true)
  assert.equal(row('VITE_SUPABASE_URL').scope, 'publica')
  assert.equal(row('VITE_SUPABASE_URL').hosting, null, 'pública vai no build: a lista de segredos não diz')
  const kinds = m.problems.map((p) => `${p.kind}:${p.name}`).sort()
  assert.deepEqual(kinds, ['falta-no-ar:STRIPE_SECRET_KEY', 'fora-do-exemplo:STRIPE_SECRET_KEY', 'sobrando:VELHA'])
})

test('sem a CLI da hospedagem, "no ar" fica como não sei', () => {
  const [d, files] = project({ 'src/a.ts': 'process.env.API_KEY', '.env': 'API_KEY=1' })
  const m = envMatrix(d, files, { cache: null })
  assert.equal(m.rows[0].hosting, null)
  assert.deepEqual(m.problems.map((p) => p.kind), ['fora-do-exemplo'])
})

test('hospedagem na configuração: wrangler, vercel, netlify e GitHub Actions de deploy', () => {
  const [d, files] = project({
    'wrangler.toml': 'name = "x"\n[vars]\nAPI_URL = "https://a"\n[env.prod.vars]\nMODE_X = "1"\n',
    'vercel.json': '{ "env": { "V_ONE": "1" } }',
    'netlify.toml': '[build.environment]\nN_ONE = "1"\n',
    '.github/workflows/deploy.yml': 'jobs:\n  d:\n    steps:\n      - run: npx wrangler deploy\n        env:\n          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}\n',
  })
  const { names } = configuredHosting(d, files)
  assert.deepEqual([...names].sort(), ['API_URL', 'CLOUDFLARE_API_TOKEN', 'MODE_X', 'N_ONE', 'VITE_SUPABASE_URL', 'V_ONE'])
})

test('CLI da hospedagem: lê só os nomes', () => {
  const run = (cmd) => ({ status: 0, stdout: cmd.includes('wrangler') ? 'aviso\n[{"name":"A_KEY","type":"secret_text"},{"name":"B"}]' : '' })
  assert.deepEqual(hostingFromCli('.', 'cloudflare', { run }), { provider: 'cloudflare', names: ['A_KEY', 'B'] })
  assert.match(hostingFromCli('.', 'cloudflare', { run: () => ({ status: 1, stderr: 'not logged in' }) }).error, /not logged in/)
})

test('chave secreta no valor de variável pública vira problema crítico (sem o valor)', () => {
  const service = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ role: 'service_role', iss: 'supabase' })).toString('base64url'), 'Kx8vQ2pLm9Zr4TnWb7YcHd3FgJs6VeAu1XiOq0RkPyM'].join('.')
  const anon = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ role: 'anon', iss: 'supabase' })).toString('base64url'), 'Kx8vQ2pLm9Zr4TnWb7YcHd3FgJs6VeAu1XiOq0RkPyM'].join('.')
  const [d] = project({ '.env.local': `VITE_SUPABASE_KEY=${service}\nVITE_SUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\n` })
  const f = publicSecretValueFindings(d)
  assert.equal(f.length, 1)
  assert.equal(f[0].severity, 'critical')
  assert.match(f[0].title, /VITE_SUPABASE_KEY/)
  assert.ok(!f[0].snippet.includes(service))
})
