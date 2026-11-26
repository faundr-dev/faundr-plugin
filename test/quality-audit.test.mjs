// Achados da auditoria da Qualidade (11/2026): o que a checagem diz que olhou (escopo), o que o quality-resolve
// refaz, os falsos positivos e o contexto da revisão com IA. Rodar: node --test plugin/test
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { analyzeQuality } from '../dist/graph.mjs'
import { bugFindings } from '../bin/bug-rules.mjs'
import { readState } from '../bin/cli-core.mjs'
import { setLang } from '../bin/i18n.mjs'
import { ruleScope } from '../bin/quality-common.mjs'
import { changedFiles, changedLines, projectFileLines, recordedLines } from '../bin/quality-context.mjs'
import { houseRules } from '../bin/quality-house.mjs'
import { blameLines, branchInfo, codeStateKey } from '../bin/quality-git.mjs'
import { oldTodos, styleRules, toolsCovered } from '../bin/quality-project.mjs'
import { RULES, runQuality } from '../bin/quality-rules.mjs'
import { ruleScope as serverRuleScope } from '../../src/lib/quality-scope.ts'

setLang('pt')

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `faundr-${name}-`))
const write = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
const git = (root, ...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.t', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' })
const scopeOf = (result, kind) => result.scopes.find((s) => s.kind === kind)

// Roda um comando de cmd-quality.mjs noutro processo, na pasta do projeto, falando com um servidor de mentira.
function cli(command, args, cwd, env) {
  const { CLAUDE_CODE_SESSION_ID: _, ...parent } = process.env
  const code = `import * as q from ${JSON.stringify(pathToFileURL(path.join(BIN, 'cmd-quality.mjs')).href)}
    try { await q[${JSON.stringify(command)}](${JSON.stringify(args)}) } catch (err) { console.log('ERRO: ' + err.message) }`
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

function linkedFolder(files) {
  const root = tmp('audit')
  write(root, '.faundr.json', JSON.stringify({ projectId: 'p1' }))
  for (const [rel, text] of Object.entries(files)) write(root, rel, text)
  return root
}

// ---- E1: o plugin e o servidor decidem o escopo da regra do mesmo jeito ----

test('escopo de cada regra: o plugin espelha o servidor', () => {
  const samples = [...Object.keys(RULES), 'casa/sem-axios', 'memoria/1234abcd', 'ia/falha', 'skill:revisor', 'demais/dependencia-nova', 'morto/outra', 'desempenho/outra', 'docker/outra', 'css/outra', 'ts/x', 'eslint/x']
  for (const rule of samples) assert.equal(ruleScope(rule), serverRuleScope(rule), rule)
  assert.deepEqual(['morto/export-sem-uso', 'demais/duplicado', 'desempenho/consulta-em-laco', 'docker/run-cd', 'css/regra-vazia'].map(ruleScope), Array(5).fill('project'))
  assert.deepEqual(['ts/erro-de-tipo', 'eslint/erro'].map(ruleScope), ['tool', 'tool'])
  assert.equal(ruleScope('falha/catch-vazio'), 'code')
})

test('quality-resolve: regra do projeto inteiro refaz a checagem completa; achado de skill ganha a mensagem dele', async () => {
  const root = linkedFolder({ 'src/a.ts': 'export const a = 1\n', Dockerfile: 'FROM node:22\n' })
  const finding = { ref: 7, status: 'open', origin: 'scan', kind: 'excess', severity: 'low', title: 'Export sem uso', rule_id: 'morto/export-sem-uso', file: 'src/a.ts' }
  let current = finding
  // Como o servidor: depois de um relatório que olhou o projeto inteiro, o achado fecha.
  const api = await fakeApi((body) => {
    if (body.action === 'report' && body.scopes.some((s) => s.kind === 'project' && s.files === null)) current = { ...current, status: 'fixed' }
    return [200, body.action === 'get' ? current : { added: 0, fixed: 0, reopened: 0 }]
  })
  try {
    for (const [rule, file] of [['morto/export-sem-uso', 'src/a.ts'], ['demais/duplicado', 'src/a.ts'], ['desempenho/consulta-sem-limite', 'src/a.ts'], ['docker/run-cd', 'Dockerfile'], ['ts/erro-de-tipo', 'src/a.ts']]) {
      current = { ...finding, rule_id: rule, file }
      api.calls.length = 0
      const out = await cli('qualityResolve', ['Q-7'], root, api.env)
      assert.match(out, /Q-7 fixed: the check no longer finds the problem/, `${rule}: ${out}`)
      assert.deepEqual(scopeOf(api.calls.find((c) => c.action === 'report'), 'code').files, null, rule)
    }

    // Regra por arquivo: só o arquivo.
    current = { ...finding, rule_id: 'tipos/any' }
    api.calls.length = 0
    assert.match(await cli('qualityResolve', ['Q-7'], root, api.env), /could not look at it again|still shows up/)
    assert.deepEqual(api.calls.find((c) => c.action === 'report').scopes, [{ kind: 'code', files: ['src/a.ts'] }])

    // Skill conectada: nada de "ainda aparece" (a skill de correção desfazia o conserto) e nenhuma checagem à toa.
    current = { ...finding, origin: 'skill', rule_id: 'skill:revisor' }
    api.calls.length = 0
    const out = await cli('qualityResolve', ['Q-7'], root, api.env)
    assert.match(out, /Q-7 came from a connected skill \(revisor\)/)
    assert.doesNotMatch(out, /still shows up/)
    assert.deepEqual(api.calls.map((c) => c.action), ['get'])
  } finally {
    api.close()
  }
})

// ---- E2 e E10: arquivo pulado sai do escopo; arquivo apagado entra ----

test('arquivo pulado (acima de 400 KB) não entra no escopo: os achados dele não fecham', async () => {
  const root = tmp('skip')
  write(root, 'a.ts', 'export const a = 1\n')
  write(root, 'grande.ts', `export const big = '${'x'.repeat(410_000)}'\n`)
  const full = await runQuality(root, { history: false, tools: false })
  assert.deepEqual(scopeOf(full, 'code'), { kind: 'code', files: null, skipped: ['grande.ts'] })
  assert.deepEqual(scopeOf(full, 'project').skipped, ['grande.ts'])
  const partial = await runQuality(root, { only: ['a.ts', 'grande.ts'] })
  assert.deepEqual(partial.scopes, [{ kind: 'code', files: ['a.ts'] }])
  // Sem nada pulado, o escopo não muda de forma.
  fs.rmSync(path.join(root, 'grande.ts'))
  assert.deepEqual(scopeOf(await runQuality(root, { history: false, tools: false }), 'code'), { kind: 'code', files: null })
})

test('checagem parcial: o arquivo editado que foi apagado ou renomeado entra no escopo', async () => {
  const root = tmp('gone')
  write(root, 'a.ts', 'export const a = 1\n')
  write(root, 'notas.txt', 'não é código')
  const { scopes } = await runQuality(root, { only: ['a.ts', 'src/apagado.ts', 'notas.txt', '../fora.ts'] })
  assert.deepEqual(scopes, [{ kind: 'code', files: ['a.ts', 'src/apagado.ts'] }])
})

test('quality-scan: a checagem só fica marcada como feita depois de o envio dar certo', async () => {
  const root = linkedFolder({ 'a.ts': 'export const a = 1\n' })
  let status = 500
  const api = await fakeApi(() => [status, status === 200 ? { added: 0, fixed: 0, reopened: 0 } : { error: 'fora do ar' }])
  try {
    write(api.home, '.faundr/edited-s1', `${path.join(root, 'a.ts')}\n`)
    const args = ['--quiet', '--session', 's1', '--edited']
    assert.match(await cli('qualityScan', args, root, api.env), /ERRO: fora do ar/)
    assert.equal(readState(root).qualityChecked, undefined)
    status = 200
    assert.doesNotMatch(await cli('qualityScan', args, root, api.env), /ERRO/)
    assert.deepEqual(readState(root).qualityChecked, { session: 's1', lines: 1 })
    assert.deepEqual(api.calls.at(-1).scopes, [{ kind: 'code', files: ['a.ts'] }])
  } finally {
    api.close()
  }
})

// ---- E3: só fecha o que a ferramenta ou a regra olhou de fato ----

test('ferramentas no escopo: só as que rodaram sem falhar', () => {
  assert.deepEqual(toolsCovered(['tsc', 'eslint'], []), ['ts', 'eslint'])
  assert.deepEqual(toolsCovered(['tsc'], []), ['ts'])
  assert.deepEqual(toolsCovered(['tsc', 'eslint em frontend/'], ['eslint']), ['ts'])
  assert.deepEqual(toolsCovered(['tsc em api/', 'eslint em frontend/'], ['ts']), ['eslint'])
  assert.deepEqual(toolsCovered([], []), [])
})

test('TODOs antigos: sem o git a regra não rodou e o escopo avisa; com o git, roda', async () => {
  const root = tmp('todos')
  write(root, 'a.ts', '// TODO: arrumar\nexport const a = 1\n')
  const noGit = await runQuality(root, { tools: false })
  assert.deepEqual(scopeOf(noGit, 'project'), { kind: 'project', files: null, unchecked: ['limpeza/todo-antigo'] })
  assert.deepEqual(scopeOf(await runQuality(root, { history: false, tools: false }), 'project').unchecked, ['limpeza/todo-antigo'])

  git(root, 'init', '-q')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'x')
  const withGit = await runQuality(root, { tools: false })
  assert.deepEqual(scopeOf(withGit, 'project'), { kind: 'project', files: null })
  // Nenhum TODO (o git grep sai com 1): a regra rodou e não achou nada.
  write(root, 'a.ts', 'export const a = 1\n')
  assert.deepEqual(scopeOf(await runQuality(root, { tools: false }), 'project'), { kind: 'project', files: null })
})

// ---- E11: regra CSS vazia sem releitura ----

test('css/regra-vazia: 300 KB sem chaves terminam em menos de 1 s, e as regras vazias continuam achadas', () => {
  const root = tmp('css')
  write(root, 'grande.css', 'a '.repeat(150_000))
  write(root, 'app.css', '.a { }\n.b { color: red }\n@media (min-width: 1px) { .c,\n.d {\n} }\n/* .e {} */\n')
  const hits = []
  const c = { add: (rule, file, line, ctx) => hits.push([rule, file, line, ctx?.selector]) }
  const started = Date.now()
  styleRules(root, ['grande.css', 'app.css'], c)
  assert.ok(Date.now() - started < 1000, `levou ${Date.now() - started} ms`)
  assert.deepEqual(hits, [['css/regra-vazia', 'app.css', 1, '.a'], ['css/regra-vazia', 'app.css', 3, '.c,\n.d']])
})

// ---- E12: regra da casa ----

test('regra da casa: padrão que trava fica de fora e $ casa em arquivo com fim de linha do Windows', () => {
  const root = tmp('casa')
  const rule = (pattern) => ['---', 'nome: "Regra"', `padrao: ${JSON.stringify(pattern)}`, 'arquivos: "**/*"', '---', 'Mensagem', ''].join('\r\n')
  write(root, '.faundr-regras/trava.md', rule('^(a+)+$'))
  write(root, '.faundr-regras/fim.md', rule('legado\\(\\);$'))
  const rules = houseRules(root)
  assert.deepEqual(rules.map((r) => r.rule), ['casa/fim'])
  assert.deepEqual(rules[0].lines('const a = 1\r\nlegado();\r\nlegado(); // ok\r\n'), [2])
  assert.deepEqual(rules[0].lines('legado();\nb()\n'), [1])
})

// ---- E13: falsos positivos ----

test('testes/sem-conferencia: assertEquals, node:assert pelo nome, t.equal e expectXxx contam como conferência', async () => {
  const found = async (body) => (await analyzeQuality('a.test.ts', `test('soma', () => { ${body} })`, { test: true })).hits.map((h) => h.rule)
  for (const body of ['assertEquals(soma(1, 2), 3)', 'strictEqual(soma(1, 2), 3)', 'deepEqual(lista(), [1])', 'ok(soma(1, 2))', 't.equal(soma(1, 2), 3)', 'expectSoma(1, 2, 3)', 'await rejects(falha())'])
    assert.deepEqual(await found(body), [], body)
  // Chamar o código sem conferir nada continua acusado (inclusive métodos com nome parecido).
  for (const body of ['soma(1, 2)', 'texto.match(/a/)', 'lista.equal(outra)', 'resposta.ok()']) assert.deepEqual(await found(body), ['testes/sem-conferencia'], body)
})

test('regras de defeito de JS não rodam em PHP', () => {
  const php = '<?php\n$row = $stmt->fetch();\n$user = User::fetch($id);\n'
  assert.deepEqual(bugFindings('api/users.php', php), [])
  assert.deepEqual(bugFindings('api/users.ts', 'export const get = (url: string) => fetch(url)\n').map((h) => h.rule), ['falha/rede-sem-prazo'])
})

test('falha/mock-em-producao: histórias do Storybook e preparação dos testes não contam', async () => {
  const root = tmp('mock')
  const code = "import { users } from './mocks/users'\nexport const list = users\n"
  for (const rel of ['src/Button.stories.tsx', 'vitest.setup.ts', '.storybook/preview.ts', 'src/app.ts']) write(root, rel, code)
  write(root, 'src/mocks/users.ts', 'export const users = []\n')
  const { findings } = await runQuality(root, { history: false, tools: false })
  assert.deepEqual(findings.filter((f) => f.rule_id === 'falha/mock-em-producao').map((f) => f.file), ['src/app.ts'])
})

test('falha/promessa-solta: o main() que fecha um script não é acusado; a promessa solta dentro de função continua', () => {
  const rules = (file, code) => bugFindings(file, code).map((h) => h.rule)
  const head = "import fs from 'node:fs'\nasync function main() {\n  await fs.promises.readFile('a')\n}\n"
  assert.deepEqual(rules('scripts/build.mjs', `${head}\nmain()\n`), [])
  assert.deepEqual(rules('scripts/build.mjs', `${head}\nmain()\nconsole.log('começou')\n`), [])
  // Outro nome, mas é o último comando do arquivo.
  assert.deepEqual(rules('bin/sync.mjs', "import fs from 'node:fs'\nasync function sync() {\n  await fs.promises.readFile('a')\n}\n\nsync()\n// fim\n"), [])
  assert.deepEqual(rules('src/server/a.ts', "import fs from 'node:fs'\nasync function save() { await x() }\nfunction handler() {\n  save()\n}\n"), ['falha/promessa-solta'])
  assert.deepEqual(rules('src/server/a.ts', "import fs from 'node:fs'\nasync function save() { await x() }\nsave()\nexport const b = 1\n"), ['falha/promessa-solta'])
})

// ---- N2: contexto da revisão com IA ----

test('revisão da sessão: o que a sessão já commitou continua na lista, com configuração e SQL, e os apagados à parte', () => {
  const root = tmp('ctx')
  write(root, 'src/a.ts', 'export const a = 1\n')
  write(root, 'src/velho.ts', 'export const v = 1\n')
  write(root, 'package-lock.json', '{}\n')
  git(root, 'init', '-q')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'base')
  const base = git(root, 'rev-parse', 'HEAD').stdout.trim()

  write(root, 'src/a.ts', 'export const a = 2\n')
  write(root, 'wrangler.jsonc', '{}\n')
  write(root, 'db/0001_init.sql', 'create table t (id int);\n')
  write(root, 'scripts/deploy.sh', 'echo oi\n')
  write(root, 'package-lock.json', '{"a":1}\n')
  write(root, 'logo.png', 'x')
  fs.rmSync(path.join(root, 'src/velho.ts'))
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'trabalho da sessão')
  write(root, 'src/novo.ts', 'export const n = 1\n')

  const changed = changedFiles(root, base)
  assert.deepEqual(changed.files.sort(), ['db/0001_init.sql', 'scripts/deploy.sh', 'src/a.ts', 'src/novo.ts', 'wrangler.jsonc'])
  assert.deepEqual(changed.deleted, ['src/velho.ts'])
  // Sem a base da sessão (ou com uma base que sumiu), vale o último commit: só o que não foi commitado.
  assert.deepEqual(changedFiles(root, null).files, ['src/novo.ts'])
  assert.deepEqual(changedFiles(root, 'f'.repeat(40)).files, ['src/novo.ts'])
  // Arquivo que a sessão editou e depois apagou: entra nos apagados.
  assert.deepEqual(changedFiles(root, null, ['src/sumiu.ts']).deleted, ['src/sumiu.ts'])

  assert.deepEqual(changedLines({ files: ['src/a.ts'], deleted: ['src/velho.ts'] }), [
    '## Files to review (1)',
    '- src/a.ts',
    '',
    '## Deleted files (1) — check that nothing still imports or mentions them',
    '- src/velho.ts',
    '',
  ])
  assert.match(changedLines({ files: [], deleted: [] })[1], /^- Nothing changed since the last commit/)
})

test('revisão do projeto: todos os arquivos por pasta e todos os achados da IA para reconferir', () => {
  const root = tmp('full')
  write(root, 'src/a.ts', 'a\nb\n')
  write(root, 'src/lib/b.ts', 'a\n')
  write(root, 'main.ts', 'a')
  assert.deepEqual(projectFileLines(root, ['src/lib/b.ts', 'src/a.ts', 'main.ts']), [
    '## All code files (3 files, 6 lines) — the review covers every folder',
    '- (root) (1 files, 1 lines): main.ts 1',
    '- src/ (1 files, 3 lines): a.ts 3',
    '- src/lib/ (1 files, 2 lines): b.ts 2',
    '',
  ])

  const line = (f) => `[${f.severity}] ${f.title}`
  const ai = Array.from({ length: 120 }, (_, i) => ({ ref: i + 1, rule_id: 'ia/falha', origin: 'audit', severity: 'high', title: `IA ${i + 1}`, file: 'src/a.ts' }))
  const scan = Array.from({ length: 90 }, (_, i) => ({ ref: 200 + i, rule_id: 'tipos/any', origin: 'scan', severity: 'low', title: `Regra ${i}`, file: 'src/b.ts' }))
  const full = recordedLines([...ai, ...scan], { full: true, line })
  assert.equal(full[0], '## Open findings from earlier AI reviews (120) — re-check every one against the code today')
  assert.deepEqual([full[1], full[120]], ['- Q-1 [high] IA 1', '- Q-120 [high] IA 120'])
  assert.match(full[121], /faundr quality-resolve Q-<n> --verified/)
  assert.equal(full[123], '## Already recorded and open (90) — do not record them again')
  assert.equal(full.at(-1), '- … and 10 more')
  assert.equal(full.length, 124 + 80 + 1)

  // Modo sessão: só o que é dos arquivos revisados; os da IA sem teto.
  const session = recordedLines([...ai, ...scan], { files: ['src/a.ts'], line })
  assert.equal(session[0], '## Already recorded and open (120) — do not record them again')
  assert.equal(session.length, 121)
  assert.deepEqual(recordedLines([], { full: true, line }), ['## Open findings from earlier AI reviews (0) — re-check every one against the code today', '- None.', '', '## Already recorded and open (0) — do not record them again'])
})

// ==== Segunda rodada da auditoria ====

const OLD = '2020-01-01T00:00:00Z'
// Repositório com um commit antigo (2020) de tudo o que está na pasta, na branch main.
function oldRepo(root) {
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '-A')
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'base'], { cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: OLD, GIT_COMMITTER_DATE: OLD } })
}
// Coletor mínimo: as linhas e o contexto de cada "regra|arquivo".
function collector() {
  const hits = new Map()
  return {
    hits,
    ignored: 0,
    add(rule, file, line, ctx) {
      const h = hits.get(`${rule}|${file}`) ?? { lines: [], ctx }
      h.lines.push(line)
      hits.set(`${rule}|${file}`, h)
    },
  }
}

// ---- A: branches ----

test('branch do relatório: o nome, se é a principal do repositório, e nenhuma com HEAD solto ou sem git', () => {
  const root = tmp('branch')
  assert.deepEqual(branchInfo(root), { branch: null, defaultBranch: false })
  write(root, 'a.ts', 'export const a = 1\n')
  oldRepo(root)
  assert.deepEqual(branchInfo(root), { branch: 'main', defaultBranch: true })
  git(root, 'checkout', '-q', '-b', 'mesa/x')
  assert.deepEqual(branchInfo(root), { branch: 'mesa/x', defaultBranch: false })
  // O remoto diz qual é a principal (origin/HEAD): aí main deixa de ser.
  git(root, 'update-ref', 'refs/remotes/origin/develop', 'HEAD')
  git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/develop')
  git(root, 'checkout', '-q', '-b', 'develop')
  assert.deepEqual(branchInfo(root), { branch: 'develop', defaultBranch: true })
  git(root, 'checkout', '-q', 'main')
  assert.deepEqual(branchInfo(root), { branch: 'main', defaultBranch: false })
  git(root, 'checkout', '-q', '--detach')
  assert.deepEqual(branchInfo(root), { branch: null, defaultBranch: false })
})

test('o relatório leva a branch e a hora da leitura; quality-resolve explica o achado que é de outra branch', async () => {
  const root = linkedFolder({ 'src/a.ts': 'export const a = 1\n' })
  oldRepo(root)
  git(root, 'checkout', '-q', '-b', 'mesa/x')
  const finding = { ref: 7, status: 'open', origin: 'scan', kind: 'types', severity: 'low', title: 'Tipo any', rule_id: 'tipos/any', file: 'src/a.ts', branch: 'main' }
  let held = [7]
  // Como o servidor: a checagem não achou mais, mas o achado é da principal e fica aberto.
  const api = await fakeApi((body) => [200, body.action === 'get' ? finding : { added: 0, fixed: 0, reopened: 0, ...(held.length ? { branchHeld: held } : {}) }])
  try {
    const before = Date.now()
    const out = await cli('qualityResolve', ['Q-7'], root, api.env)
    assert.match(out, /Q-7 fixed on this branch; it closes on the dashboard when this reaches the main branch\. Keep the fix\./)
    const report = api.calls.find((c) => c.action === 'report')
    assert.deepEqual([report.branch, report.defaultBranch], ['mesa/x', false])
    assert.ok(Date.parse(report.readAt) >= before - 1000 && Date.parse(report.readAt) <= Date.now(), report.readAt)

    // Não fechou por outro motivo (não por branch): a mensagem de antes.
    held = []
    assert.match(await cli('qualityResolve', ['Q-7'], root, api.env), /could not look at it again/)
  } finally {
    api.close()
  }
})

// ---- E: achado "a confirmar" ----

test('achado a confirmar: quality-finding manda o fato que falta e o quality-show lista à parte', async () => {
  const root = linkedFolder({})
  const listed = [
    { ref: 1, severity: 'low', title: 'Confirmado', file: 'a.ts', status: 'open', needs_check: null },
    { ref: 2, severity: 'high', title: 'Em dúvida', file: 'b.ts', status: 'open', needs_check: 'O provedor reenvia o aviso?' },
  ]
  const api = await fakeApi((body) => [200, body.action === 'list' ? { quality: null, findings: listed } : { ref: 9, title: body.finding?.title, status: 'open', needs_check: body.finding?.needs_check ?? null }])
  try {
    const base = ['Cobrança em dobro', '--theme', 'logica', '--severity', 'high', '--file', 'a.ts']
    const out = await cli('qualityFinding', [...base, '--confidence', '60', '--needs-check', 'O provedor reenvia o aviso?'], root, api.env)
    assert.match(out, /Quality finding Q-9 recorded as "to confirm": Cobrança em dobro/)
    assert.equal(api.calls.at(-1).finding.needs_check, 'O provedor reenvia o aviso?')
    assert.equal(api.calls.at(-1).finding.confidence, 60)

    // Sem a flag, 60 não passa (e nada vai ao servidor); com ela, abaixo de 50 também não.
    const sentSoFar = api.calls.length
    assert.match(await cli('qualityFinding', [...base, '--confidence', '60'], root, api.env), /ERRO: Confidence must be 80-100\..*--needs-check/)
    assert.match(await cli('qualityFinding', [...base, '--confidence', '40', '--needs-check', 'x'], root, api.env), /ERRO: Confidence must be 50-100/)
    assert.equal(api.calls.length, sentSoFar)
    assert.match(await cli('qualityFinding', [], root, api.env), /usage: .*--needs-check "<the exact missing fact>".*50-100/)
    // Confirmado continua como era.
    assert.match(await cli('qualityFinding', [...base, '--confidence', '90'], root, api.env), /Quality finding Q-9 recorded: Cobrança em dobro/)
    assert.equal(api.calls.at(-1).finding.needs_check, null)

    const show = await cli('qualityShow', [], root, api.env)
    assert.match(show, /^Q-1 \[low\] Confirmado — a\.ts\n\nTo confirm \(1\)[^\n]*\nQ-2 \[high\] Em dúvida — b\.ts\n {4}Missing fact: O provedor reenvia o aviso\?\n/)
  } finally {
    api.close()
  }
})

test('contexto da revisão: os "a confirmar" vêm à parte, com o fato que falta', () => {
  const line = (f) => `[${f.severity}] ${f.title}`
  const findings = [
    { ref: 1, rule_id: 'ia/falha', origin: 'audit', severity: 'high', title: 'Certo', file: 'src/a.ts' },
    { ref: 2, rule_id: 'ia/logica', origin: 'audit', severity: 'high', title: 'Em dúvida', file: 'src/a.ts', needs_check: 'O provedor reenvia?' },
    { ref: 3, rule_id: 'ia/logica', origin: 'audit', severity: 'low', title: 'De outro arquivo', file: 'src/b.ts', needs_check: 'Outro fato?' },
  ]
  for (const options of [{ full: true, line }, { files: ['src/a.ts'], line }]) {
    const lines = recordedLines(findings, options)
    const at = lines.findIndex((l) => l.startsWith('## To confirm ('))
    assert.ok(at > 0, lines.join('\n'))
    // Fora da lista "não registre de novo": registrar de novo sem a dúvida é como se confirma.
    assert.ok(!lines.slice(0, at).some((l) => l.includes('Q-2')))
    assert.deepEqual(lines.slice(at + 1, at + 3), ['- Q-2 [high] Em dúvida', '  Missing fact: O provedor reenvia?'])
    assert.match(lines.at(-1), /without --needs-check/)
    assert.equal(lines.some((l) => l.includes('Q-3')), !!options.full)
  }
})

// ---- D2 e I: tsc e ESLint do projeto (cache e faundr-ignore) ----

// Projeto com um tsc e um ESLint de mentira: cada um anota que rodou e acusa sempre as mesmas linhas.
function toolProject() {
  const root = tmp('tools')
  const counter = path.join(tmp('runs'), 'runs.txt')
  const note = (name) => `require('node:fs').appendFileSync(${JSON.stringify(counter)}, '${name}\\n')\n`
  write(root, 'node_modules/typescript/package.json', '{}')
  write(root, 'node_modules/typescript/bin/tsc', `${note('tsc')}process.stdout.write('a.ts(2,1): error TS2322: tipo errado\\r\\na.ts(4,1): error TS2322: outro\\r\\nb.ts(2,1): error TS2322: no arquivo todo\\r\\n')\nprocess.exitCode = 2\n`)
  write(root, 'node_modules/eslint/package.json', '{}')
  write(
    root,
    'node_modules/eslint/bin/eslint.js',
    `${note('eslint')}const file = require('node:path').join(process.cwd(), 'a.ts')\nprocess.stdout.write(JSON.stringify([{ filePath: file, messages: [{ severity: 2, line: 2, ruleId: 'no-x', message: 'erro' }, { severity: 1, line: 4, ruleId: 'no-y', message: 'aviso' }] }]))\n`,
  )
  write(root, '.gitignore', 'node_modules\n')
  write(root, 'tsconfig.json', '{}\n')
  write(root, 'eslint.config.mjs', 'export default []\n')
  write(root, 'a.ts', '// faundr-ignore ts/erro-de-tipo,eslint/erro: o tipo vem de fora\nexport const a: number = "1"\n\nexport const b: number = "2"\n')
  write(root, 'b.ts', '// faundr-ignore-file ts: arquivo gerado à mão\nexport const c: number = "3"\n')
  const runs = () => (fs.existsSync(counter) ? fs.readFileSync(counter, 'utf8').trim().split('\n') : [])
  return { root, runs }
}
const toolFindings = (result) => result.findings.filter((f) => /^(ts|eslint)\//.test(f.rule_id)).map((f) => [f.rule_id, f.file, f.lines]).sort()

test('faundr-ignore vale para o que o tsc e o ESLint acusam', async () => {
  const { root } = toolProject()
  const result = await runQuality(root, { history: false })
  assert.deepEqual(result.errors, [])
  // Linha 2 de a.ts (comentário na linha de cima) e o b.ts inteiro ficam de fora; a linha 4 continua.
  assert.deepEqual(toolFindings(result), [['eslint/aviso', 'a.ts', [4]], ['ts/erro-de-tipo', 'a.ts', [4]]])
  assert.ok(result.stats.ignored >= 3, `ignorados: ${result.stats.ignored}`)
})

test('tsc e ESLint: o que acusam numa pasta do .faundrignore não vira achado', async () => {
  const { root } = toolProject()
  write(root, 'node_modules/typescript/bin/tsc', `process.stdout.write('a.ts(4,1): error TS2322: outro\\r\\nexemplos/app/x.ts(1,1): error TS2304: Cannot find name Deno\\r\\nexemplos-reais.ts(1,1): error TS2322: fora da pasta\\r\\n')\nprocess.exitCode = 2\n`)
  write(root, 'exemplos/app/x.ts', 'Deno.serve()\n')
  write(root, 'exemplos-reais.ts', 'export const d: number = "4"\n')
  write(root, '.faundrignore', '# exemplos com defeitos de propósito\nexemplos/\n')
  const result = await runQuality(root, { history: false })
  assert.deepEqual(result.errors, [])
  // Só a pasta exemplos/ sai; um arquivo com nome parecido, fora dela, continua.
  assert.deepEqual(
    toolFindings(result).filter(([rule]) => rule === 'ts/erro-de-tipo'),
    [['ts/erro-de-tipo', 'a.ts', [4]], ['ts/erro-de-tipo', 'exemplos-reais.ts', [1]]],
  )
})

test('tsc e ESLint: com o código igual, a checagem em segundo plano aproveita o resultado guardado; a pedida roda de novo', async () => {
  const { root, runs } = toolProject()
  oldRepo(root)
  const first = await runQuality(root, { history: false })
  assert.deepEqual(runs(), ['tsc', 'eslint'])
  assert.ok(fs.existsSync(path.join(root, '.faundr', 'cache', 'quality-tools.json')))

  // Nada mudou: não roda, e o resultado (achados, ferramentas e escopo) é o mesmo.
  const again = await runQuality(root, { history: false })
  assert.equal(runs().length, 2)
  assert.deepEqual(toolFindings(again), toolFindings(first))
  assert.deepEqual(toolFindings(again), [['eslint/aviso', 'a.ts', [4]], ['ts/erro-de-tipo', 'a.ts', [4]]])
  assert.deepEqual(again.stats.tools, ['tsc', 'eslint'])
  assert.deepEqual(scopeOf(again, 'tool'), { kind: 'tool', files: null, tools: ['ts', 'eslint'] })

  // A checagem que a pessoa pediu roda de verdade.
  await runQuality(root, { history: false, fresh: true })
  assert.equal(runs().length, 4)
  // Arquivo alterado fora de commit: roda uma vez e volta a aproveitar.
  write(root, 'b.ts', '// faundr-ignore-file ts: arquivo gerado à mão\nexport const c: number = "33"\n')
  await runQuality(root, { history: false })
  await runQuality(root, { history: false })
  assert.equal(runs().length, 6)
  // Commit novo: roda de novo.
  git(root, 'commit', '-q', '-am', 'mudou')
  await runQuality(root, { history: false })
  assert.equal(runs().length, 8)

  // Sem git não há como saber se mudou: sempre roda.
  const loose = toolProject()
  await runQuality(loose.root, { history: false })
  await runQuality(loose.root, { history: false })
  assert.equal(loose.runs().length, 4)
})

test('impressão digital do código: muda com o commit, com arquivo alterado e com a versão do plugin; a pasta .faundr não conta', () => {
  const root = tmp('key')
  assert.equal(codeStateKey(root, '1.0.0'), null)
  write(root, 'a.ts', 'export const a = 1\n')
  oldRepo(root)
  const clean = codeStateKey(root, '1.0.0')
  assert.match(clean, /^[0-9a-f]{64}$/)
  assert.equal(codeStateKey(root, '1.0.0'), clean)
  assert.notEqual(codeStateKey(root, '1.0.1'), clean)
  write(root, '.faundr/cache/quality-tools.json', '{}')
  assert.equal(codeStateKey(root, '1.0.0'), clean)
  write(root, 'novo.ts', 'export const n = 1\n')
  const withNew = codeStateKey(root, '1.0.0')
  assert.notEqual(withNew, clean)
  write(root, 'novo.ts', 'export const n = 22\n')
  assert.notEqual(codeStateKey(root, '1.0.0'), withNew)
})

// ---- D3: um git blame por arquivo ----

test('autoria das linhas: um blame por arquivo; arquivo sem commit não é falha; linha que não existe é', () => {
  const root = tmp('blame')
  write(root, 'a.ts', '// um\n// dois\n// três\n')
  oldRepo(root)
  const lines = blameLines(root, 'a.ts', [1, 3, 3])
  assert.deepEqual([...lines.keys()].sort(), [1, 3])
  assert.deepEqual(lines.get(3), { author: 't', time: Date.parse(OLD) / 1000 })
  write(root, 'novo.ts', '// agora\n')
  assert.equal(blameLines(root, 'novo.ts', [1]).size, 0)
  // No índice, ainda sem commit: o git responde que a linha é de agora.
  git(root, 'add', 'novo.ts')
  assert.equal(blameLines(root, 'novo.ts', [1]).get(1).author, 'Not Committed Yet')
  assert.equal(blameLines(root, 'a.ts', [99]), null)
})

test('TODOs antigos: um blame por arquivo; se o blame de um arquivo falha, a regra fica como não conferida', async () => {
  const root = tmp('todos2')
  write(root, 'a.ts', '// TODO: um\nexport const a = 1\n// TODO: dois\n// faundr-ignore limpeza/todo-antigo: fica\n// FIXME: três\n')
  write(root, 'b.ts', '// TODO: outro\nexport const b = 1\n// faundr: sem paginação, paginar quando passar de 100 linhas\n')
  oldRepo(root)
  write(root, 'novo.ts', '// TODO: de agora\nexport const n = 1\n')
  git(root, 'add', 'novo.ts')

  const asked = []
  const c = collector()
  const counted = (r, file, lines) => {
    asked.push(file)
    return blameLines(r, file, lines)
  }
  assert.equal(oldTodos(root, c, { blame: counted }), true)
  assert.deepEqual(asked.sort(), ['a.ts', 'b.ts', 'novo.ts'])
  assert.deepEqual(c.hits.get('limpeza/todo-antigo|a.ts').lines, [1, 3])
  assert.ok(c.hits.get('limpeza/todo-antigo|a.ts').ctx.days > 365)
  assert.deepEqual(c.hits.get('limpeza/todo-antigo|b.ts').lines, [1])
  assert.equal(c.hits.has('limpeza/todo-antigo|novo.ts'), false)

  // O blame de b.ts falhou: os outros arquivos entram, mas a regra não foi conferida inteira.
  const partial = collector()
  assert.equal(oldTodos(root, partial, { blame: (r, file, lines) => (file === 'b.ts' ? null : blameLines(r, file, lines)) }), false)
  assert.deepEqual([...partial.hits.keys()], ['limpeza/todo-antigo|a.ts'])

  // Os atalhos (// faundr: …) continuam com dono e idade.
  const { stats } = await runQuality(root, { tools: false })
  assert.equal(stats.shortcuts.length, 1)
  assert.equal(stats.shortcuts[0].author, 't')
  assert.ok(stats.shortcuts[0].days > 365)
})

// ---- D4: comentários do CSS numa passada só ----

test('css: 300 KB de comentários abertos e nunca fechados terminam em menos de 1 s', () => {
  const root = tmp('css2')
  write(root, 'aberto.css', '/* '.repeat(100_000))
  write(root, 'app.css', '/* .x {} */ .a { }\n/* comentário\nde duas linhas { } */.b { }\n.c { color: red } // .d { }\n')
  const hits = []
  const c = { add: (rule, file, line, ctx) => hits.push([rule, file, line, ctx?.selector]) }
  const started = Date.now()
  styleRules(root, ['aberto.css', 'app.css'], c)
  assert.ok(Date.now() - started < 1000, `levou ${Date.now() - started} ms`)
  assert.deepEqual(hits, [['css/regra-vazia', 'app.css', 1, '.a'], ['css/regra-vazia', 'app.css', 3, '.b']])
})

// ---- I: faundr-ignore onde o achado nascia sem o texto do arquivo ----

test('faundr-ignore: chave estrangeira no SQL, instruções da IA e pacotes (chave "faundr" do package.json)', async () => {
  const root = tmp('ignore')
  write(
    root,
    'package.json',
    JSON.stringify({
      dependencies: { 'left-pad': '1.0.0', 'pacote-x': '1.0.0', 'pacote-y': '1.0.0' },
      scripts: { dev: 'node a.mjs' },
      faundr: { ignore: { 'demais/dependencia-sem-uso': ['pacote-x', 'left-pad'], 'demais/dependencia-dispensavel': ['left-pad'] } },
    }),
  )
  write(root, 'a.mjs', 'export const a = 1\n')
  write(root, 'CLAUDE.md', '<!-- faundr-ignore-file instrucoes/arquivo-inexistente: exemplo de caminho -->\nVeja `src/nao-existe.ts` e rode `npm run sumiu`.\n')
  write(
    root,
    'supabase/migrations/0001_inicio.sql',
    ['create table public.b (id int primary key);', 'create table public.a (', '  id int primary key,', '  -- faundr-ignore desempenho/fk-sem-indice: tabela de 10 linhas', '  b_id int references public.b (id),', '  c_id int references public.b (id)', ');', ''].join('\r\n'),
  )
  const { findings, stats } = await runQuality(root, { history: false, tools: false })
  const of = (rule) => findings.filter((f) => f.rule_id === rule)

  assert.deepEqual(of('desempenho/fk-sem-indice').map((f) => [f.file, f.lines]), [['supabase/migrations/0001_inicio.sql', [6]]])
  assert.deepEqual(of('instrucoes/arquivo-inexistente'), [])
  assert.equal(of('instrucoes/script-inexistente').length, 1)
  assert.deepEqual(of('demais/dependencia-dispensavel'), [])
  const [unused] = of('demais/dependencia-sem-uso')
  assert.match(unused.detail, /: pacote-y\./)
  assert.doesNotMatch(unused.detail, /pacote-x|left-pad/)
  // A ajuda da regra diz como abrir a exceção.
  assert.match(unused.fix, /"faundr": \{ "ignore": \{ "demais\/dependencia-sem-uso": \["pacote-y"\] \} \}/)
  assert.ok(stats.ignored >= 5, `ignorados: ${stats.ignored}`)
})

test('pasta do .faundrignore fica fora da checagem de qualidade', async () => {
  const { qualityFiles } = await import('../bin/quality-rules.mjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-ignore-'))
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir })
    fs.mkdirSync(path.join(dir, 'exemplos/app'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'src'))
    fs.writeFileSync(path.join(dir, 'exemplos/app/a.ts'), 'export const a = 1\n')
    fs.writeFileSync(path.join(dir, 'src/b.ts'), 'export const b = 1\n')
    assert.deepEqual(qualityFiles(dir).sort(), ['exemplos/app/a.ts', 'src/b.ts'])
    fs.writeFileSync(path.join(dir, '.faundrignore'), '# exemplos\r\nexemplos/\r\n')
    assert.deepEqual(qualityFiles(dir), ['src/b.ts'])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
