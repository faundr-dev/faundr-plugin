// Achados da auditoria da Segurança (11/2026): o que a checagem diz que olhou (escopo), o que o security-resolve
// refaz e responde, os pacotes, o histórico do git, a importação e o contexto da revisão com IA.
// Rodar: node --test plugin/test
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `faundr-${name}-`))
// A pasta do usuário é trocada ANTES de carregar o plugin: o cache do OSV e a configuração ficam numa pasta de teste.
const HOME = tmp('home')
process.env.HOME = HOME
process.env.USERPROFILE = HOME

const base = await import('../bin/security-base.mjs')
const deps = await import('../bin/security-deps.mjs')
const security = await import('../bin/security.mjs')
const imports = await import('../bin/security-import.mjs')
const { hookPayload } = await import('../bin/hook-payload.mjs')
const { maskPayload } = await import('../bin/security-secrets.mjs')
const { readState } = await import('../bin/cli-core.mjs')
const { setLang } = await import('../bin/i18n.mjs')
const scopeLib = await import('../../src/lib/security-scope.ts')

setLang('pt')

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')
const write = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
const git = (root, ...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' })
const scopeOf = (result, source) => result.scopes.find((s) => s.source === source)
// Chaves de mentira, montadas aqui para o arquivo de teste não ter nenhuma inteira.
const STRIPE = 'sk_live_' + '4eC39HqLyjWDarjtT1zdp7dcQ8xY'
const GITHUB = 'ghp_' + 'R4nd0mT0k3nV4lu3Xy7Zq9Lm2Np5Kd8Hs1Jw'

function folder(files, link = true) {
  const root = tmp('sec')
  if (link) write(root, '.faundr.json', JSON.stringify({ projectId: 'p1' }))
  for (const [rel, text] of Object.entries(files)) write(root, rel, text)
  return root
}

function repo(files) {
  const root = folder(files)
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'início')
  return root
}

// Roda um comando de cmd-security.mjs noutro processo, na pasta do projeto, falando com um servidor de mentira.
function cli(command, args, cwd, env) {
  const { CLAUDE_CODE_SESSION_ID: _, ...parent } = process.env
  const code = `import * as s from ${JSON.stringify(pathToFileURL(path.join(BIN, 'cmd-security.mjs')).href)}
    try { await s[${JSON.stringify(command)}](${JSON.stringify(args)}) } catch (err) { console.log('ERRO: ' + err.message) }`
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd, env: { ...parent, ...env } })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.on('close', () => resolve(out))
  })
}

// Servidor de mentira da API: `answer(body)` devolve [status, json]; guarda os pedidos recebidos.
async function fakeApi(answer) {
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}')
      calls.push(parsed)
      const [status, json] = answer(parsed, calls)
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(json))
    })
  })
  await new Promise((r) => server.listen(0, r))
  const home = tmp('home')
  return { calls, home, close: () => server.close(), env: { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: `http://127.0.0.1:${server.address().port}` } }
}

// Servidor que guarda um achado e fecha como o de verdade: só o que o relatório olhou e não mandou de novo.
async function findingApi(finding, { held = null } = {}) {
  const state = { current: finding }
  const api = await fakeApi((body) => {
    const f = state.current
    if (body.action === 'get') return [200, f]
    if (body.action === 'verify' || body.action === 'rotated') {
      state.current = { ...f, status: 'fixed' }
      return [200, { ref: f.ref, title: f.title }]
    }
    if (body.action !== 'report') return [200, {}]
    const seen = body.findings.some((x) => x.fingerprint === f.fingerprint)
    const scope = body.scopes.find((s) => s.source === f.source)
    const looked = !!scope && (scope.files === null || scope.files.includes(f.file)) && !scope.skipped?.includes(f.file)
    const gone = !seen && looked
    if (gone && !held) state.current = { ...f, status: 'fixed' }
    return [200, { added: 0, fixed: gone && !held ? 1 : 0, reopened: 0, ...(gone && held ? { [held]: [f.ref] } : {}) }]
  })
  return Object.assign(api, { state })
}

const reportOf = (api) => api.calls.find((c) => c.action === 'report')
const FINDING = { ref: 7, status: 'open', origin: 'scan', source: 'code', severity: 'high', title: 'Problema', rule_id: 'regra', file: 'src/a.ts', fingerprint: 'code|regra|src/a.ts', detail: '', impact: '', fix: '' }

// ---- As mesmas regras no plugin e no servidor ----

test('ecossistemas do OSV e "relê só o arquivo": o plugin espelha o servidor', () => {
  assert.deepEqual([...deps.OSV_ECOSYSTEMS], [...scopeLib.OSV_ECOSYSTEMS])
  const samples = [
    { source: 'secret', file: 'src/a.ts' },
    { source: 'secret', file: null },
    { source: 'code', file: 'src/a.ts' },
    { source: 'dependency', file: 'package-lock.json' },
    { source: 'database', file: 'supabase/migrations/1.sql' },
    { source: 'config', file: '.env' },
    { source: 'history', file: 'src/a.ts' },
    { source: 'review', file: 'src/a.ts' },
  ]
  for (const f of samples) assert.equal(base.fileScoped(f), scopeLib.fileScoped(f), JSON.stringify(f))
  assert.deepEqual(samples.map(base.fileScoped), [true, false, true, false, false, false, false, false])
})

// ---- Item 1: arquivo pulado ----

test('arquivo que a checagem não leu (acima de 1 MB, binário) vai em "skipped" e sai da lista da parcial', async () => {
  const root = folder({
    'a.ts': 'export const a = 1\n',
    'grande.ts': `export const k = "${STRIPE}"\n// ${'x'.repeat(1_050_000)}\n`,
    'binario.ts': `const k = "${STRIPE}"\0\0`,
  }, false)
  const full = await security.scanProject(root, { deps: false })
  assert.deepEqual(scopeOf(full, 'secret'), { source: 'secret', files: null, skipped: ['binario.ts', 'grande.ts'] })
  assert.deepEqual(scopeOf(full, 'code').skipped, ['binario.ts', 'grande.ts'])
  assert.deepEqual(scopeOf(full, 'config').skipped, ['binario.ts', 'grande.ts'])

  // Parcial: o pulado sai da lista; o que foi apagado entra (o que havia nele sumiu de verdade).
  const partial = await security.scanProject(root, { only: ['a.ts', 'grande.ts', 'apagado.ts'], deps: false })
  assert.deepEqual(scopeOf(partial, 'secret'), { source: 'secret', files: ['a.ts', 'apagado.ts'], skipped: ['grande.ts'] })
  assert.deepEqual(scopeOf(partial, 'code').files, ['a.ts', 'apagado.ts'])

  // Sem nada pulado, o escopo não muda de forma.
  fs.rmSync(path.join(root, 'grande.ts'))
  fs.rmSync(path.join(root, 'binario.ts'))
  assert.deepEqual(scopeOf(await security.scanProject(root, { deps: false }), 'secret'), { source: 'secret', files: null })
})

test('checagem parcial não diz que leu um arquivo que existe mas não é do projeto (ignorado pelo git)', async () => {
  const root = repo({ 'a.ts': 'export const a = 1\n', '.gitignore': '.env.local\n' })
  write(root, '.env.local', 'VITE_X=1\n')
  const partial = await security.scanProject(root, { only: ['a.ts', '.env.local'], deps: false })
  assert.deepEqual(scopeOf(partial, 'secret').files, ['a.ts'])
})

test('variável pública com segredo num .env fora do git é marcada como achado local', async () => {
  const root = repo({ 'a.ts': 'export const a = 1\n', '.gitignore': '.env.local\n', '.env': 'VITE_SUPABASE_SERVICE_ROLE_KEY=abc123456789\n' })
  write(root, '.env.local', 'VITE_STRIPE_SECRET_KEY=abc123456789\n')
  const { findings } = await security.scanProject(root, { deps: false })
  const env = findings.filter((f) => f.rule_id === 'public-env-secret')
  assert.deepEqual(env.map((f) => [f.file, f.local === true]).sort(), [['.env', false], ['.env.local', true]])
})

// ---- Itens 2 e 3: pacotes ----

const LOCK = (extra = '') => `${JSON.stringify({ name: 'app', lockfileVersion: 3, packages: { '': { name: 'app', dependencies: { lodash: '4.17.20' } }, 'node_modules/lodash': { version: '4.17.20' } } })}${extra}`
const VULN = (id) => ({ id, modified: '2026-01-01T00:00:00Z', summary: `Falha ${id}`, details: 'Detalhe.', aliases: [], database_specific: { severity: 'HIGH' }, affected: [{ package: { name: 'lodash', ecosystem: 'npm' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '4.17.21' }] }] }] })

// Troca o fetch por um OSV de mentira durante `run`.
async function withOsv(handler, run) {
  const real = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null
    calls.push({ url: String(url), body })
    const [status, json] = handler(String(url), body, calls)
    return { ok: status >= 200 && status < 300, status, json: async () => json }
  }
  try {
    return await run(calls)
  } finally {
    globalThis.fetch = real
  }
}
const osvOk = (ids) => (url, body) => (url.endsWith('/querybatch') ? [200, { results: body.queries.map(() => ({ vulns: ids.map((id) => ({ id, modified: '2026-01-01T00:00:00Z' })) })) }] : [200, VULN(decodeURIComponent(url.split('/').pop()))])

test('lockfile acima de 1 MB é lido: os pacotes dele entram na checagem', async () => {
  const root = folder({ 'package-lock.json': LOCK(' '.repeat(1_100_000)), 'package.json': '{"name":"app","dependencies":{"lodash":"4.17.20"}}' }, false)
  await withOsv(osvOk(['GHSA-aaaa-0001-big0']), async () => {
    const result = await security.scanProject(root)
    assert.equal(result.stats.packages, 1)
    assert.deepEqual(result.findings.filter((f) => f.source === 'dependency').map((f) => f.rule_id), ['GHSA-aaaa-0001-big0'])
    assert.ok(scopeOf(result, 'dependency'))
    assert.equal(result.snapshot.packages.length, 1)
  })
})

test('lockfile corrompido vira aviso: não manda o escopo dos pacotes nem a lista vazia', async () => {
  const root = folder({ 'package-lock.json': '{ "lockfileVersion": 3, "packages": {', 'package.json': '{"name":"app"}' }, false)
  await withOsv(osvOk([]), async () => {
    const result = await security.scanProject(root)
    assert.equal(scopeOf(result, 'dependency'), undefined)
    assert.equal(result.snapshot, null)
    assert.match(result.errors.join('\n'), /package-lock\.json/)
  })
  // Com outro lockfile bom ao lado: os achados dele ainda entram, mas o escopo continua de fora.
  write(root, 'api/package-lock.json', LOCK())
  await withOsv(osvOk(['GHSA-aaaa-0002-mix0']), async () => {
    const result = await security.scanProject(root)
    assert.deepEqual(result.findings.filter((f) => f.source === 'dependency').map((f) => f.file), ['api/package-lock.json'])
    assert.equal(scopeOf(result, 'dependency'), undefined)
    assert.equal(result.snapshot, null)
  })
  // Projeto sem lockfile nenhum: os pacotes foram olhados (não há nenhum) e o escopo vai.
  const empty = folder({ 'a.ts': 'export const a = 1\n' }, false)
  const clean = await security.scanProject(empty)
  assert.ok(scopeOf(clean, 'dependency'))
  assert.deepEqual(clean.snapshot, { packages: [], known: [] })
})

test('OSV sem o detalhe de uma falha (429/500): a checagem de pacotes falha em vez de fechar os achados', async () => {
  const root = folder({ 'package-lock.json': LOCK(), 'package.json': '{"name":"app"}' }, false)
  const ids = ['GHSA-aaaa-0003-ok00', 'GHSA-aaaa-0003-fail']
  await withOsv((url, body) => (url.endsWith('/querybatch') ? osvOk(ids)(url, body) : url.endsWith('fail') ? [429, {}] : [200, VULN(decodeURIComponent(url.split('/').pop()))]), async () => {
    const result = await security.scanProject(root)
    assert.equal(scopeOf(result, 'dependency'), undefined)
    assert.equal(result.snapshot, null)
    assert.match(result.errors.join('\n'), /OSV/)
  })
})

test('OSV com mais de uma página de falhas para um pacote (next_page_token): todas entram', async () => {
  const root = folder({ 'package-lock.json': LOCK(), 'package.json': '{"name":"app"}' }, false)
  const handler = (url, body) => {
    if (!url.endsWith('/querybatch')) return [200, VULN(decodeURIComponent(url.split('/').pop()))]
    const second = body.queries[0].page_token === 'pagina-2'
    return [200, { results: [{ vulns: [{ id: second ? 'GHSA-aaaa-0004-pg02' : 'GHSA-aaaa-0004-pg01', modified: '2026-01-01T00:00:00Z' }], ...(second ? {} : { next_page_token: 'pagina-2' }) }] }]
  }
  await withOsv(handler, async () => {
    const result = await security.scanProject(root)
    assert.deepEqual(result.findings.filter((f) => f.source === 'dependency').map((f) => f.rule_id).sort(), ['GHSA-aaaa-0004-pg01', 'GHSA-aaaa-0004-pg02'])
    assert.deepEqual(result.snapshot.known.sort(), ['GHSA-aaaa-0004-pg01', 'GHSA-aaaa-0004-pg02'])
  })
})

// ---- Item 5: histórico do git ----

test('histórico: a leitura inteira cobre o escopo; a incremental lê só os commits novos e não fecha nada', async () => {
  const root = repo({ 'a.ts': `export const k = "${STRIPE}"\n` })
  const first = security.scanHistory(root)
  assert.deepEqual(first.findings.map((f) => f.rule_id), ['stripe-access-token'])
  assert.equal(first.commits, 1)
  assert.equal(first.complete, true)
  assert.ok(first.tips.length >= 1)

  write(root, 'b.ts', `export const g = "${GITHUB}"\n`)
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'segundo')
  const next = security.scanHistory(root, { since: first.tips })
  assert.deepEqual(next.findings.map((f) => f.rule_id), ['github-pat'])
  assert.equal(next.commits, 1)
  assert.equal(next.complete, false)

  // Nada novo: nenhum commit lido.
  assert.equal(security.scanHistory(root, { since: next.tips }).commits, 0)
  // Pontas que não existem mais (histórico reescrito): volta a ler tudo.
  const rewritten = security.scanHistory(root, { since: ['0'.repeat(40)] })
  assert.deepEqual([rewritten.commits, rewritten.complete], [2, true])
  // Bateu no teto: o que ficou de fora não foi lido, então o escopo não vale como coberto.
  const capped = security.scanHistory(root, { maxCommits: 1 })
  assert.deepEqual([capped.commits, capped.complete, capped.truncated], [1, false, true])

  const whole = await security.scanProject(root, { deps: false, history: { tips: null, commits: 0 } })
  assert.ok(scopeOf(whole, 'history'))
  assert.equal(whole.stats.commits, 2)
  assert.equal(whole.history.full, true)
  const inc = await security.scanProject(root, { deps: false, history: { tips: first.tips, commits: 1 } })
  assert.equal(scopeOf(inc, 'history'), undefined)
  assert.equal(inc.stats.commits, 2)
  assert.deepEqual(inc.findings.filter((f) => f.source === 'history').map((f) => f.rule_id), ['github-pat'])
  assert.deepEqual([inc.history.full, inc.history.commits], [false, 2])
})

// ---- Itens 10, 11 e 19: o que o security-scan manda e quando marca os arquivos como conferidos ----

test('security-scan manda a branch e a hora da leitura, e só marca como conferido depois de o painel receber', async () => {
  const root = repo({ 'src/a.ts': 'export const a = 1\n' })
  let fail = true
  const api = await fakeApi((body) => (body.action === 'report' && fail ? [500, { error: 'fora do ar' }] : [200, { added: 0, fixed: 0, reopened: 0 }]))
  try {
    const before = Date.now()
    await cli('securityScan', ['--session', 's1', '--quiet'], root, api.env)
    assert.equal(readState(root).securityChecked, undefined)
    assert.equal(readState(root).securityHistory, undefined)

    fail = false
    api.calls.length = 0
    await cli('securityScan', ['--session', 's1', '--quiet'], root, api.env)
    const sent = reportOf(api)
    assert.deepEqual([sent.branch, sent.defaultBranch], ['main', true])
    assert.ok(Date.parse(sent.readAt) >= before - 1000 && Date.parse(sent.readAt) <= Date.now())
    assert.ok(sent.scopes.some((s) => s.source === 'history'))
    assert.equal(readState(root).securityChecked.session, 's1')
    assert.equal(readState(root).securityHistory.commits, 1)

    // Da segunda vez o histórico é incremental: não vai como coberto.
    api.calls.length = 0
    await cli('securityScan', ['--session', 's1', '--quiet'], root, api.env)
    assert.equal(reportOf(api).scopes.some((s) => s.source === 'history'), false)
    assert.equal(reportOf(api).stats.commits, 1)
  } finally {
    api.close()
  }
})

// ---- Itens 6, 7 e 10: security-resolve ----

test('security-resolve: .env que saiu do git fecha (checagem do projeto inteiro), sem "still shows up"', async () => {
  const root = repo({ '.env': 'API_URL=https://exemplo.com\nSENHA=abc123\n', 'src/a.ts': 'export const a = 1\n' })
  write(root, '.gitignore', '.env\n')
  git(root, 'rm', '-q', '--cached', '.env')
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'tira o .env do git')
  const api = await findingApi({ ...FINDING, source: 'secret', rule_id: 'env-in-git', file: '.env', fingerprint: 'secret|env-file|.env' })
  try {
    const out = await cli('securityResolve', ['S-7'], root, api.env)
    assert.match(out, /S-7 fixed: the check no longer finds the problem/, out)
    assert.equal(scopeOf(reportOf(api), 'secret').files, null)
    assert.equal(typeof reportOf(api).readAt, 'string')
  } finally {
    api.close()
  }
})

test('security-resolve: arquivo que saiu do projeto fecha; problema que continua lá diz "still shows up"', async () => {
  const root = repo({ 'src/a.ts': `export const k = "${STRIPE}"\n`, 'src/b.ts': 'export const b = 1\n' })
  const real = (await security.scanProject(root, { only: ['src/a.ts'], deps: false })).findings.find((f) => f.source === 'secret')
  const api = await findingApi({ ...FINDING, source: 'secret', rule_id: real.rule_id, file: 'src/a.ts', fingerprint: real.fingerprint })
  try {
    const still = await cli('securityResolve', ['S-7'], root, api.env)
    assert.match(still, /S-7 still shows up in the check/, still)
    // Só o arquivo do achado foi relido.
    assert.deepEqual(scopeOf(reportOf(api), 'secret').files, ['src/a.ts'])

    fs.rmSync(path.join(root, 'src/a.ts'))
    api.calls.length = 0
    assert.match(await cli('securityResolve', ['S-7'], root, api.env), /S-7 fixed: the check no longer finds the problem/)
  } finally {
    api.close()
  }
})

test('security-resolve: quando a checagem não pôde olhar de novo, diz isso e manda manter a correção', async () => {
  // Pacote: o lockfile não pôde ser lido (corrompido), então os pacotes não foram conferidos.
  const root = repo({ 'package-lock.json': '{ "packages": {', 'package.json': '{"name":"app"}', 'src/a.ts': 'export const a = 1\n' })
  const api = await findingApi({ ...FINDING, source: 'dependency', rule_id: 'GHSA-aaaa-0005-dep0', file: 'package-lock.json', package: 'lodash', version: '4.17.20', fingerprint: 'dependency|package-lock.json|lodash|GHSA-aaaa-0005-dep0' })
  try {
    const out = await cli('securityResolve', ['S-7'], root, api.env)
    assert.match(out, /S-7 was not found by the check this time, but the check could not look at it again/, out)
    assert.match(out, /Keep the fix; do not undo it\./)
    assert.match(out, /package-lock\.json/)
    assert.doesNotMatch(out, /still shows up/)
  } finally {
    api.close()
  }
})

test('security-resolve: achado importado, de skill, ignorado e de outra branch ganham a mensagem deles', async () => {
  const root = repo({ 'src/a.ts': 'export const a = 1\n' })
  const run = async (finding, options, args = ['S-7']) => {
    const api = await findingApi({ ...FINDING, ...finding }, options)
    try {
      return { out: await cli('securityResolve', args, root, api.env), actions: api.calls.map((c) => c.action).filter(Boolean) }
    } finally {
      api.close()
    }
  }
  const imported = await run({ origin: 'import', fingerprint: 'sarif-semgrep|regra|x' })
  assert.match(imported.out, /S-7 came from an imported result \(sarif-semgrep\).*faundr security-import.*Keep the fix; do not undo it\./s)
  assert.deepEqual(imported.actions, ['get'])

  const skill = await run({ origin: 'skill', rule_id: 'skill:revisor' })
  assert.match(skill.out, /S-7 came from a connected skill \(revisor\).*faundr skill-report.*Keep the fix; do not undo it\./s)
  assert.deepEqual(skill.actions, ['get'])

  const ignored = await run({ status: 'ignored', ignore_reason: 'accepted_risk' })
  assert.match(ignored.out, /S-7 is ignored on the dashboard \(accepted risk\); nothing to close\./)
  assert.deepEqual(ignored.actions, ['get'])
  const ignoredAudit = await run({ origin: 'audit', status: 'ignored', ignore_reason: 'not_a_problem' }, {}, ['S-7', '--verified', 'A rota foi apagada, não existe mais'])
  assert.match(ignoredAudit.out, /is ignored on the dashboard/)
  assert.deepEqual(ignoredAudit.actions, ['get'])

  const branch = await run({}, { held: 'branchHeld' })
  assert.match(branch.out, /S-7 fixed on this branch; it closes on the dashboard when this reaches the main branch\. Keep the fix\./)
  const person = await run({ source: 'config', rule_id: 'local-env-remote-db', file: '.env', fingerprint: 'config|local-env-remote-db|db.exemplo.com' }, { held: 'reporterHeld' })
  assert.match(person.out, /S-7 depends on the \.env of the person who reported it.*Keep the fix\./s)
})

test('security-resolve: chave no histórico pede --rotated; com a nota, fecha sem reler nada', async () => {
  const root = repo({ 'src/a.ts': `export const k = "${STRIPE}"\n` })
  write(root, 'src/a.ts', 'export const k = process.env.STRIPE_KEY\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'tira a chave')
  const real = security.scanHistory(root).findings[0]
  const finding = { ...FINDING, source: 'history', rule_id: real.rule_id, file: 'src/a.ts', fingerprint: real.fingerprint }

  const api = await findingApi(finding)
  try {
    const out = await cli('securityResolve', ['S-7'], root, api.env)
    assert.match(out, /S-7 is a key in the git history/)
    assert.match(out, /faundr security-resolve S-7 --rotated "<what was rotated, where and when>"/)
    assert.doesNotMatch(out, /still shows up/)
    // A releitura foi a do histórico inteiro.
    assert.ok(scopeOf(reportOf(api), 'history'))

    api.calls.length = 0
    assert.match(await cli('securityResolve', ['S-7', '--rotated', 'curto'], root, api.env), /ERRO: .*at least 10 characters/)
    assert.deepEqual(api.calls.map((c) => c.action), [])
    const note = 'Chave trocada no painel do Stripe em 20/11/2026'
    const done = await cli('securityResolve', ['S-7', '--rotated', note], root, api.env)
    assert.match(done, /S-7 closed: key rotated/)
    assert.deepEqual(api.calls.map((c) => [c.action, c.note ?? null]), [['get', null], ['rotated', note]])
  } finally {
    api.close()
  }
  // --rotated num achado que não é do histórico: recusa antes de chamar o servidor para fechar.
  const other = await findingApi(FINDING)
  try {
    assert.match(await cli('securityResolve', ['S-7', '--rotated', 'Chave trocada no painel do Stripe'], root, other.env), /ERRO: .*only for keys found in the git history/)
    assert.deepEqual(other.calls.map((c) => c.action), ['get'])
  } finally {
    other.close()
  }
})

// ---- Itens 9, 13 e 20: contexto da revisão com IA ----

test('security-context: sem tetos, migrações da mais nova para a mais antiga, inventário do banco e achados antigos da IA marcados', async () => {
  const files = { 'package.json': '{"name":"app","dependencies":{"@supabase/supabase-js":"2"}}', 'src/a.ts': 'export const a = 1\n', 'src/b.ts': 'export const b = 1\n' }
  for (let i = 1; i <= 85; i++) files[`src/routes/api/r${String(i).padStart(3, '0')}.ts`] = 'export const GET = () => new Response("ok")\n'
  for (let i = 1; i <= 65; i++) files[`supabase/migrations/${String(i).padStart(4, '0')}_m.sql`] = `-- migração ${i}\n`
  files['supabase/migrations/0066_regras.sql'] = [
    'create table public.notas (id uuid primary key, dono uuid);',
    'alter table public.notas enable row level security;',
    'create policy "ler notas" on public.notas for select to authenticated using (dono = auth.uid());',
    'create policy "apagar notas" on public.notas for delete to authenticated using (dono = auth.uid());',
    'create function public.conta_notas() returns integer language sql security definer set search_path = \'\' as $$ select 1 $$;',
    'create function public.comum() returns integer language sql as $$ select 1 $$;',
    'create trigger notas_ref before insert on public.notas for each row execute function public.conta_notas();',
    "insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true);",
    '',
  ].join('\n')
  const root = repo(files)
  const findings = [
    { ref: 1, origin: 'audit', source: 'review', severity: 'high', verdict: 'confirmed', title: 'Rota sem login', file: 'src/a.ts', updated_at: '2020-01-01T00:00:00Z' },
    { ref: 2, origin: 'audit', source: 'review', severity: 'medium', verdict: 'needs_check', title: 'Webhook sem assinatura', file: 'src/sumiu.ts', updated_at: '2020-01-01T00:00:00Z' },
    { ref: 3, origin: 'audit', source: 'review', severity: 'low', verdict: 'confirmed', title: 'Log com e-mail', file: 'src/b.ts', updated_at: '2999-01-01T00:00:00Z' },
    { ref: 4, origin: 'scan', source: 'dependency', severity: 'high', verdict: 'confirmed', title: 'lodash 4.17.20: falha', file: 'package-lock.json', package: 'lodash', version: '4.17.20', rule_id: 'GHSA-aaaa-0006-ctx0', updated_at: '2026-01-01T00:00:00Z' },
    { ref: 5, origin: 'scan', source: 'dependency', severity: 'low', verdict: 'confirmed', title: 'ms 2.0.0: falha', file: 'package-lock.json', package: 'ms', version: '2.0.0', rule_id: 'GHSA-aaaa-0006-ctx1', updated_at: '2026-01-01T00:00:00Z' },
  ]
  const fullReview = { at: '2020-06-01T00:00:00Z', mode: 'full', areas: ['rotas'], clean: ['login'] }
  const review = { at: '2999-01-01T00:00:00Z', mode: 'quick', areas: ['src/a.ts'], clean: [], full: fullReview }
  const api = await fakeApi((body) => [200, body.action === 'list' ? { security: { review, checked_at: '2026-11-20T00:00:00Z' }, findings } : {}])
  try {
    const out = await cli('securityContext', [], root, api.env)
    // Todas as rotas e todas as migrações, com o total de verdade no título.
    assert.match(out, /## Server routes and functions \(85\)/)
    assert.ok(out.includes('- src/routes/api/r085.ts'))
    assert.match(out, /## Migrations and database rules \(66\)/)
    const newest = out.indexOf('- supabase/migrations/0066_regras.sql')
    const oldest = out.indexOf('- supabase/migrations/0001_m.sql')
    assert.ok(newest !== -1 && oldest !== -1 && newest < oldest, 'a mais nova vem antes')

    // O que o banco tem, tirado das migrações.
    assert.match(out, /security definer.*\(1\)\n- public\.conta_notas — supabase\/migrations\/0066_regras\.sql:5/)
    assert.match(out, /- notas: select — supabase\/migrations\/0066_regras\.sql:3; delete — supabase\/migrations\/0066_regras\.sql:4/)
    assert.match(out, /- notas_ref on notas — supabase\/migrations\/0066_regras\.sql:7/)
    assert.match(out, /- fotos \(public\) — supabase\/migrations\/0066_regras\.sql:8/)

    // Achados antigos da revisão com IA e "a conferir": todos, com a marca e como fechar.
    assert.match(out, /- S-1 \[high\] src\/a\.ts — Rota sem login \[file changed since\]/)
    assert.match(out, /- S-2 \[needs check, if confirmed medium\] src\/sumiu\.ts — Webhook sem assinatura \[file missing\]/)
    assert.match(out, /- S-3 \[low\] src\/b\.ts — Log com e-mail\n/)
    assert.ok(out.includes('faundr security-resolve S-n --verified "<why it no longer applies>"'))
    assert.doesNotMatch(out, /do not record them again; confirm, discard or complete them/)

    // Pacotes de gravidade alta ou crítica, para avaliar o alcance no código.
    assert.match(out, /- S-4 \[high\] lodash 4\.17\.20 — GHSA-aaaa-0006-ctx0/)
    assert.doesNotMatch(out, /S-5 \[low\] ms 2\.0\.0 — GHSA/)

    // "Mudou desde a última revisão" conta da última COMPLETA (2020), não da rápida (2999).
    assert.match(out, /## Changed since the last full review \(\d+\)/)
    assert.ok(out.includes('- src/a.ts'))
    assert.doesNotMatch(out, /… and \d+ more/)
  } finally {
    api.close()
  }
})

test('security-review-done: compara os arquivos lidos com os do projeto, imprime o que faltou e manda os números', async () => {
  const root = repo({ 'src/a.ts': 'export const a = 1\n', 'src/b.ts': 'export const b = 1\n', 'src/c.ts': 'export const c = 1\n', 'src/a.test.ts': 'export {}\n', 'supabase/migrations/0001_x.sql': 'select 1;\n', 'README.md': '# x\n' })
  const list = path.join(tmp('lidos'), 'lidos.txt')
  fs.writeFileSync(list, 'src/a.ts\r\n./src/b.ts\r\n\r\nsrc\\nao-existe.ts\r\n')
  const api = await fakeApi(() => [200, {}])
  try {
    const out = await cli('securityReviewDone', ['--areas', 'rotas; banco', '--summary', 'ok', '--files-read', list, '--verified', '3', '--ruled-out', '1'], root, api.env)
    assert.match(out, /Not read \(2\): src\/c\.ts, supabase\/migrations\/0001_x\.sql/, out)
    const sent = api.calls.find((c) => c.action === 'review-done')
    assert.deepEqual([sent.mode, sent.files_read, sent.files_total, sent.not_read, sent.verified, sent.ruled_out], ['full', 2, 4, ['src/c.ts', 'supabase/migrations/0001_x.sql'], 3, 1])

    // Sem a lista de arquivos: não inventa números.
    api.calls.length = 0
    await cli('securityReviewDone', ['--areas', 'rotas', '--quick'], root, api.env)
    const quick = api.calls.find((c) => c.action === 'review-done')
    assert.deepEqual([quick.mode, quick.files_read ?? null, quick.files_total ?? null], ['quick', null, null])
    assert.match(await cli('securityReviewDone', ['--areas', 'rotas', '--files-read', path.join(root, 'nao-existe.txt')], root, api.env), /ERRO: .*--files-read/)
  } finally {
    api.close()
  }
})

// ---- Item 22: importação com várias ferramentas ----

test('SARIF com várias execuções: cada ferramenta fica com os próprios achados', () => {
  const run = (name, results) => ({ tool: { driver: { name, rules: [] } }, results })
  const result = (ruleId, uri) => ({ ruleId, level: 'error', message: { text: `Problema ${ruleId}` }, locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: 1 } } }] })
  const doc = { runs: [run('Semgrep', [result('sql', 'a.ts')]), run('Gitleaks', [result('chave', 'b.ts')]), run('Semgrep', [result('xss', 'c.ts')]), run('Trivy', [])] }
  const groups = imports.parseImports(doc)
  assert.deepEqual(groups.map((g) => [g.tool, g.findings.map((f) => f.rule_id)]), [['sarif-semgrep', ['sql', 'xss']], ['sarif-gitleaks', ['chave']], ['sarif-trivy', []]])
  assert.equal(groups[1].findings[0].source, 'secret')
  // Uma execução só: como sempre foi.
  assert.deepEqual(imports.parseImports({ runs: [run('CodeQL', [result('sql', 'a.ts')])] }).map((g) => g.tool), ['sarif-codeql'])
  assert.equal(imports.parseImport({ runs: [run('CodeQL', [result('sql', 'a.ts')])] }).tool, 'sarif-codeql')
})

// ---- Item 23: a máscara não trava num texto enorme ----

test('texto enorme no hook é cortado antes de mascarar; texto normal sai igual', () => {
  const key = 'sk-ant-api03-' + 'q7Wm2Zx9Lr4Tn8Vb1Hc6Jp3Ks5Df0Gy'.repeat(3).slice(0, 93) + 'AA'
  const payload = (prompt) => hookPayload({ session_id: 's1', cwd: '/proj', hook_event_name: 'UserPromptSubmit', prompt })
  const started = Date.now()
  const big = payload(`Arrume o login. ${'token'.repeat(60_000)}`)
  assert.ok(Date.now() - started < 4000, `levou ${Date.now() - started} ms`)
  assert.ok(big.prompt.startsWith('Arrume o login. token'))
  assert.equal(big.prompt.length, 501)

  // Texto normal (maior do que sai, menor do que o corte): a chave é mascarada e sai o mesmo de sempre.
  const text = `Minha chave é ${key}, pode usar. ${'palavra '.repeat(100)}`
  const normal = payload(text)
  assert.ok(!normal.prompt.includes(key))
  assert.equal(normal.prompt, `${maskPayload(text).slice(0, 500)}…`)
  assert.ok(normal.prompt.startsWith('Minha chave é sk-ant-'))
  assert.equal(payload('Só um pedido curto').prompt, 'Só um pedido curto')
  // Chave depois do corte não sai (nem inteira, nem em parte): só o começo do texto vai para o painel.
  assert.ok(!payload(`${'palavra '.repeat(10_000)}${key}`).prompt.includes('sk-ant'))
})
