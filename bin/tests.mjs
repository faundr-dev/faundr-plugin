// Seção Testes (fase 1), sem IA: quais executores o projeto usa (Vitest, Jest, Playwright, node --test, pytest), na
// raiz ou numa subpasta (ex.: frontend/ com o próprio package.json), o inventário dos
// arquivos e testes, o que já está no disco sem rodar nada, o aviso de banco de produção e a rodada pedida
// (faundr tests-run) com um leitor só para os relatórios JSON. Formatos e comandos em
// docs/research/testes-vitest-playwright.md. Os testes nunca rodam sozinhos (decisão do dono).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { COVERAGE_DIR, coverageArgs } from './coverage.mjs'
import { subDirs } from './parts.mjs'
import { findSecrets, mask, projectFiles } from './security.mjs'

export const TEST_FILE = /(^|\/)(__tests__|tests?|e2e|spec)\/.*\.[cm]?[jt]sx?$|\.(test|spec)\.[cm]?[jt]sx?$/
export const PY_TEST_FILE = /(^|\/)(test_[^/]*|[^/]*_test)\.py$/
const NOT_PROJECT = /(^|\/)(node_modules|dist|build|site-packages|\.?venv|env)\//
const OUT_DIR = path.join('.faundr', 'tests')
const RUN_TIMEOUT = 15 * 60_000

// Onde fica o executável de cada um dentro de node_modules (roda com o node atual: funciona igual no Windows).
const RUNNERS = {
  vitest: { pkg: 'vitest', bin: ['node_modules/vitest/vitest.mjs'], config: /^vitest\.config\.[cm]?[jt]s$/ },
  jest: { pkg: 'jest', bin: ['node_modules/jest/bin/jest.js'], config: /^jest\.config\.([cm]?[jt]s|json)$/ },
  playwright: { pkg: '@playwright/test', bin: ['node_modules/@playwright/test/cli.js', 'node_modules/playwright/cli.js'], config: /^playwright\.config\.[cm]?[jt]s$/ },
}
// Detectados, mas o Faundr ainda não roda nem lê (aparecem no inventário).
const OTHERS = { cypress: 'Cypress', mocha: 'Mocha', ava: 'AVA' }
const PYTEST_CONFIG = (root, dir) =>
  fs.existsSync(path.join(root, dir, 'pytest.ini')) ||
  /^\[tool\.pytest/m.test(read(root, path.join(dir, 'pyproject.toml')) ?? '') ||
  /^\[(tool:)?pytest\]/m.test(read(root, path.join(dir, 'setup.cfg')) ?? '') ||
  /^\[pytest\]/m.test(read(root, path.join(dir, 'tox.ini')) ?? '')

const read = (root, rel) => {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8')
  } catch {
    // Arquivo que não existe ou não dá para ler: tratado como vazio.
    return null
  }
}
const readJson = (root, rel) => {
  try {
    return JSON.parse(read(root, rel) ?? 'null')
  } catch {
    // JSON quebrado (ex.: relatório interrompido no meio): ignorado.
    return null
  }
}

// Subpastas com package.json ou configuração do pytest: cada parte do projeto pode ter o seu executor.
const projectDirs = (root) => subDirs(root, (d) => fs.existsSync(path.join(root, d, 'package.json')) || PYTEST_CONFIG(root, d))

// Executores de JavaScript numa pasta (raiz = ''): pelo package.json, pelos arquivos de configuração e pelos scripts.
function jsRunnersIn(root, dir) {
  const pkg = readJson(root, path.join(dir, 'package.json')) ?? {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const top = fs.readdirSync(path.join(root, dir))
  const scripts = Object.entries(pkg.scripts ?? {})
  const found = []
  for (const [runner, r] of Object.entries(RUNNERS)) {
    const config = top.find((f) => r.config.test(f)) ?? (runner === 'vitest' && top.some((f) => /^vite\.config\./.test(f) && /\btest\s*:/.test(read(root, path.join(dir, f)) ?? '')) ? 'vite.config' : null)
    const inPkg = !!deps[r.pkg] || (runner === 'jest' && !!pkg.jest)
    if (!inPkg && !config) continue
    const word = runner === 'playwright' ? /playwright\s+test/ : new RegExp(`\\b${runner}\\b`)
    const script = scripts.find(([, cmd]) => word.test(cmd))?.[0] ?? null
    found.push({ runner, dir, config, script, installed: !!binFor(root, dir, runner), coverage: runner === 'vitest' ? !!(deps['@vitest/coverage-v8'] || deps['@vitest/coverage-istanbul']) : runner === 'jest' })
  }
  const nodeScript = scripts.find(([, cmd]) => /\bnode\s+(?:[^|&;]*\s)?--test\b/.test(cmd))
  if (nodeScript) found.push({ runner: 'node', dir, config: null, script: nodeScript[0], installed: true, coverage: false, args: nodeTestArgs(nodeScript[1]) })
  return { found, deps }
}

// O executável fica no node_modules da pasta ou, em monorepo, no da raiz.
function binFor(root, dir, runner) {
  for (const base of dir ? [dir, ''] : ['']) {
    const bin = RUNNERS[runner].bin.find((b) => fs.existsSync(path.join(root, base, b)))
    if (bin) return path.join(root, base, bin)
  }
  return null
}

/**
 * Executores de teste do projeto: os da raiz e os das subpastas (um executor que já roda na raiz não se repete
 * na subpasta, para não rodar os mesmos testes duas vezes). pytest: na pasta com a configuração dele ou, sem
 * configuração, na raiz quando há arquivos test_*.py.
 */
export function detectRunners(root, { files = null, python = null } = {}) {
  const dirs = projectDirs(root)
  const { found: atRoot, deps } = jsRunnersIn(root, '')
  const runners = [...atRoot]
  const allDeps = { ...deps }
  for (const dir of dirs.filter((d) => fs.existsSync(path.join(root, d, 'package.json')))) {
    const sub = jsRunnersIn(root, dir)
    Object.assign(allDeps, sub.deps)
    for (const r of sub.found) if (!atRoot.some((x) => x.runner === r.runner && (x.config || x.script))) runners.push(r)
  }
  const pyDirs = ['', ...dirs].filter((d) => PYTEST_CONFIG(root, d))
  const hasPyTests = pyDirs.length > 0 || (files ?? projectFiles(root).files).some((f) => PY_TEST_FILE.test(f) && !NOT_PROJECT.test(f))
  if (hasPyTests) {
    // Uma configuração na raiz (ou nenhuma) roda tudo a partir da raiz.
    for (const dir of pyDirs.includes('') || !pyDirs.length ? [''] : pyDirs) {
      const py = findPython(root, dir, python)
      runners.push({ runner: 'pytest', dir, config: pyDirs.includes(dir) ? 'pytest' : null, script: null, installed: !!py, python: py, coverage: false })
    }
  }
  const others = Object.entries(OTHERS)
    .filter(([name]) => allDeps[name])
    .map(([, label]) => label)
  return { runners, others }
}

// O Python que roda o pytest: o escolhido (--python ou guardado), o ambiente ativo, um .venv do projeto ou o do sistema.
export function findPython(root, dir = '', chosen = null) {
  const win = process.platform === 'win32'
  const inVenv = (base) => path.join(base, win ? 'Scripts/python.exe' : 'bin/python')
  const candidates = [
    chosen && path.resolve(root, chosen),
    process.env.FAUNDR_PYTHON,
    process.env.VIRTUAL_ENV && inVenv(process.env.VIRTUAL_ENV),
    ...[dir, ''].flatMap((d) => ['.venv', 'venv', 'env'].map((v) => inVenv(path.join(root, d, v)))),
  ].filter(Boolean)
  const found = candidates.find((p) => fs.existsSync(p))
  if (found) return found
  for (const cmd of win ? ['python', 'py'] : ['python3', 'python']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10_000 })
    // O "python" da Microsoft Store, que só abre a loja, não imprime versão.
    if (r.status === 0 && /Python \d/.test(`${r.stdout}${r.stderr}`)) return cmd
  }
  return null
}

// Os arquivos que o script passa ao node --test (ex.: "node --test plugin/test/*.test.mjs" → ['plugin/test/*.test.mjs']).
function nodeTestArgs(cmd) {
  const after = cmd.split(/\s--test\b/)[1] ?? ''
  return after.split(/[|&;]/)[0].trim().split(/\s+/).filter((t) => t && !t.startsWith('-'))
}

// Um teste por chamada it(...)/test(...) com nome (estimativa sem rodar nada).
const CASE_CALL = /\b(?:it|test)(?:\.(only|skip|todo|fixme|fail|concurrent|each\s*\([^)]*\)))?\s*\(\s*['"`]/g

/** Inventário: arquivos de teste, estimativa de testes, quais são de ponta a ponta (navegador). */
export function inventory(root, files = projectFiles(root).files) {
  const testFiles = files.filter((f) => (TEST_FILE.test(f) || PY_TEST_FILE.test(f)) && !NOT_PROJECT.test(f))
  let cases = 0
  let skipped = 0
  let e2eFiles = 0
  for (const rel of testFiles) {
    const text = read(root, rel) ?? ''
    if (rel.endsWith('.py')) {
      cases += [...text.matchAll(/^\s*(?:async\s+)?def\s+test\w*\s*\(/gm)].length
      skipped += [...text.matchAll(/^\s*@pytest\.mark\.(?:skip|xfail)\b/gm)].length
      continue
    }
    for (const m of text.matchAll(CASE_CALL)) {
      cases++
      if (m[1] === 'skip' || m[1] === 'todo' || m[1] === 'fixme') skipped++
    }
    // Só o import de verdade, no começo da linha (não o texto de exemplo dentro de um teste).
    if (/^\s*import\b[^\n]*from\s+['"]@playwright\/test['"]/m.test(text)) e2eFiles++
  }
  return { testFiles: testFiles.length, cases, skipped, e2eFiles, sample: testFiles.slice(0, 20) }
}

// Variáveis e clientes que costumam apontar para um banco ou serviço de verdade.
const DB_ENV = /\b(?:process\.env|import\.meta\.env)\.((?:\w*_)?(?:SUPABASE|DATABASE|DB|POSTGRES|PG|MONGO|REDIS|FIREBASE|NEON|TURSO|PLANETSCALE)\w*)/g
const DB_CLIENT = /from\s+['"](@supabase\/supabase-js|@prisma\/client|pg|postgres|mongoose|mongodb|drizzle-orm[^'"]*|firebase-admin[^'"]*)['"]/
// Python: os.environ["SUPABASE_URL"], os.getenv("DATABASE_URL") e os clientes de banco mais comuns.
const PY_DB_ENV = /\bos\.(?:environ(?:\.get)?\s*[[(]|getenv\s*\()\s*['"]((?:\w*_)?(?:SUPABASE|DATABASE|DB|POSTGRES|PG|MONGO|REDIS|FIREBASE|NEON|TURSO)\w*)['"]/g
const PY_DB_CLIENT = /^\s*(?:from|import)\s+(supabase|psycopg2?|asyncpg|sqlalchemy|pymongo|redis|firebase_admin)\b/m
const LOCAL = /localhost|127\.0\.0\.1|0\.0\.0\.0|:54321|host\.docker\.internal/

/**
 * Sinais de que os testes usam o banco de produção: um teste lê a variável ou importa o cliente do banco,
 * não há .env de teste, e o .env do projeto aponta para um endereço que não é local. Sem sinal: lista vazia.
 */
export function productionDbSignals(root, files = projectFiles(root).files, { exclude = [] } = {}) {
  const left = (f) => exclude.some((e) => f === e || f.startsWith(`${e.replace(/\/$/, '')}/`))
  const testFiles = files.filter((f) => (TEST_FILE.test(f) || PY_TEST_FILE.test(f)) && !NOT_PROJECT.test(f) && !left(f))
  const hasTestEnv = fs.readdirSync(root).some((f) => /^\.env\.test(\.local)?$/.test(f))
  if (hasTestEnv) return []
  // O .env da raiz e o de cada pasta de primeiro nível que tem teste (ex.: backend/.env).
  const envDirs = ['', ...new Set(testFiles.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))]
  const envText = envDirs.flatMap((d) => ['.env', '.env.local', '.dev.vars'].map((f) => read(root, path.join(d, f)) ?? '')).join('\n')
  const remoteVars = (vars) =>
    vars.filter((v) => {
      const value = envText.match(new RegExp(`^${v}\\s*=\\s*["']?([^\\s"']+)`, 'm'))?.[1]
      return value && !LOCAL.test(value)
    })
  const reasons = []
  for (const rel of testFiles) {
    const text = read(root, rel) ?? ''
    if (rel.endsWith('.py')) {
      const remote = remoteVars([...new Set([...text.matchAll(PY_DB_ENV)].map((m) => m[1]))])
      if (remote.length) reasons.push(`${rel} usa ${remote.join(', ')}, que no .env aponta para um servidor de verdade`)
      else if (PY_DB_CLIENT.test(text) && !/\bmock\b|MagicMock|monkeypatch|\bmocker\b/.test(text)) reasons.push(`${rel} importa o cliente do banco (${text.match(PY_DB_CLIENT)[1]}) sem simulação`)
      if (reasons.length >= 5) break
      continue
    }
    const remote = remoteVars([...new Set([...text.matchAll(DB_ENV)].filter((m) => !insideString(text, m.index)).map((m) => m[1]))])
    if (remote.length) reasons.push(`${rel} usa ${remote.join(', ')}, que no .env aponta para um servidor de verdade`)
    else if (DB_CLIENT.test(text) && !/vi\.mock|jest\.mock|createMock|msw/.test(text)) reasons.push(`${rel} importa o cliente do banco (${text.match(DB_CLIENT)[1]}) sem simulação`)
    // Endereço escrito no teste só conta se o teste também cria um cliente (senão é texto de exemplo).
    else if (/https:\/\/[a-z0-9]{10,}\.supabase\.co/.test(text) && /\bcreateClient\s*\(/.test(text)) reasons.push(`${rel} tem o endereço de um projeto Supabase escrito no teste`)
    if (reasons.length >= 5) break
  }
  return reasons
}

// A posição está dentro de um texto entre aspas na mesma linha? (exemplo num teste, não uso de verdade)
function insideString(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1
  const before = text.slice(lineStart, index)
  return ['"', "'", '`'].some((q) => (before.split(q).length - 1) % 2 === 1)
}

/** O que já está no disco, sem rodar nada: o resumo da última rodada do Playwright. */
export function passiveResults(root) {
  const rel = 'test-results/.last-run.json'
  const last = readJson(root, rel)
  if (!last?.status) return null
  return {
    playwright: {
      status: last.status,
      failed: Array.isArray(last.failedTests) ? last.failedTests.length : 0,
      at: fs.statSync(path.join(root, rel)).mtime.toISOString(),
    },
  }
}

// ---------- rodar ----------

function commandFor(runner, out, { changed, files, nodeArgs, exclude = [] }) {
  const extra = files?.length ? files : []
  // pytest: relatório JUnit no formato antigo (xunit1), o único que diz o arquivo de cada teste.
  if (runner === 'pytest') return ['-m', 'pytest', `--junitxml=${out}`, '-o', 'junit_family=xunit1', '-q', '--color=no', ...exclude.map((e) => `--ignore=${e}`), ...extra]
  if (runner === 'node') return ['--test', '--test-reporter=junit', `--test-reporter-destination=${out}`, ...(extra.length ? extra : nodeArgs ?? [])]
  if (runner === 'vitest') return ['run', '--reporter=json', `--outputFile.json=${out}`, '--passWithNoTests', ...(changed ? ['--changed'] : []), ...exclude.map((e) => `--exclude=${e}`), ...extra]
  if (runner === 'jest') return ['--ci', '--json', `--outputFile=${out}`, '--passWithNoTests', ...(changed ? ['--onlyChanged'] : []), ...(exclude.length ? ['--testPathIgnorePatterns', ...exclude] : []), ...extra]
  return ['test', '--reporter=json', '--pass-with-no-tests', ...(changed ? ['--only-changed'] : []), ...extra]
}

/** Caminhos relativos à raiz vistos de dentro da pasta do executor; os de fora dela ficam de fora. */
export function insideDir(dir, list) {
  if (!dir) return list
  return list.filter((f) => f === dir || f.startsWith(`${dir}/`)).map((f) => (f === dir ? '.' : f.slice(dir.length + 1)))
}

/**
 * Roda um executor na pasta dele (dir, relativa à raiz) com o relatório em .faundr/tests/ da raiz, sem mexer na
 * configuração do projeto. files e exclude vêm relativos à raiz.
 */
export function runTests(root, runner, { dir = '', python = null, changed = false, files = null, exclude = [], timeout = RUN_TIMEOUT, nodeArgs = null, coverage = false } = {}) {
  const bin = RUNNERS[runner] ? binFor(root, dir, runner) : null
  if (!bin && RUNNERS[runner]) return { runner, error: `${runner} não está instalado (rode npm install ${dir ? `em ${dir}/` : 'no projeto'})` }
  if (runner === 'pytest' && !python) return { runner, error: 'não achei o Python do projeto (passe o caminho com --python, ex.: --python .venv/Scripts/python.exe)' }
  fs.mkdirSync(path.join(root, OUT_DIR), { recursive: true })
  const tag = dir ? `-${dir.replace(/\//g, '_')}` : ''
  const out = path.join(root, OUT_DIR, `${runner}${tag}.${runner === 'node' || runner === 'pytest' ? 'xml' : 'json'}`).split(path.sep).join('/')
  try {
    fs.rmSync(out, { force: true })
  } catch {
    // Relatório antigo preso por outro processo: o novo sobrescreve.
  }
  const started = Date.now()
  // Cobertura: pasta própria do Faundr na raiz (o Vitest apaga a pasta de relatório antes de rodar), limpa a cada rodada.
  const covArgs = coverage ? (coverageArgs(runner, root, dir) ?? []) : []
  if (covArgs.length) {
    fs.rmSync(path.join(root, COVERAGE_DIR), { recursive: true, force: true })
    // O node --test não cria a pasta do relatório sozinho.
    fs.mkdirSync(path.join(root, COVERAGE_DIR), { recursive: true })
  }
  const local = files?.length ? insideDir(dir, files) : null
  const args = commandFor(runner, out, { changed, files: local, nodeArgs, exclude: insideDir(dir, exclude) })
  // node --test: os reporters vêm em pares com o destino; os arquivos ficam no fim.
  const full = runner === 'node' ? [...args.slice(0, 3), ...covArgs, ...args.slice(3)] : [...args.slice(0, local?.length ? -local.length : undefined), ...covArgs, ...(local ?? [])]
  const r = spawnSync(runner === 'pytest' ? python : process.execPath, [...(bin ? [bin] : []), ...full], {
    cwd: path.join(root, dir),
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    // CI: sem modo observação, sem perguntas, .only esquecido falha. HTML_OPEN=never: o Playwright não trava servindo o relatório.
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', PYTHONIOENCODING: 'utf-8', PLAYWRIGHT_JSON_OUTPUT_FILE: out, PLAYWRIGHT_HTML_OPEN: 'never' },
  })
  const durationMs = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') return { runner, durationMs, error: `passou do tempo limite (${Math.round(timeout / 60000)} min)` }
  if (r.error?.code === 'ENOENT') return { runner, durationMs, error: `não consegui abrir o ${runner === 'pytest' ? 'Python' : 'node'} (${path.basename(String(r.error.path ?? ''))})` }
  if (runner === 'node' || runner === 'pytest') {
    const xml = read(out, '')
    // pytest sem o pacote instalado ("No module named pytest") ou que nem coletou: a última linha diz o porquê.
    if (!xml) return { runner, durationMs, error: clean(lastLine(r.stderr) || lastLine(r.stdout)) || `o ${runner === 'node' ? 'node --test' : 'pytest'} terminou sem relatório (código ${r.status})` }
    return { runner, durationMs, cases: runner === 'pytest' ? fromPytest(xml, root, path.join(root, dir)) : fromJUnit(xml, root), error: null }
  }
  const json = readJson(out, '')
  if (!json) return { runner, durationMs, error: firstLine(r.stderr || r.stdout) || `o ${runner} terminou sem relatório (código ${r.status})` }
  const cases = runner === 'playwright' ? fromPlaywright(json, root) : fromJestLike(json, root)
  const fileErrors = runner === 'playwright' ? (json.errors ?? []).map((e) => clean(e.message)) : (json.testResults ?? []).filter((t) => t.message).map((t) => `${rel(root, t.name)}: ${clean(t.message)}`)
  return { runner, durationMs, cases, error: fileErrors.length && !cases.length ? fileErrors[0].slice(0, 1000) : null }
}

const rel = (root, file) => (file ? path.relative(root, path.resolve(root, file)).split(path.sep).join('/') : null)
const lastLine = (text) => String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).at(-1)?.slice(0, 300) ?? ''
const firstLine = (text) => String(text ?? '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 300) ?? ''

// Mensagem de falha: sem cores, sem as linhas de dentro das bibliotecas, caminhos relativos ao projeto (a pasta do
// computador da pessoa não sai daqui) e segredos mascarados.
let projectRoot = ''
function clean(message) {
  const roots = projectRoot ? [projectRoot, projectRoot.split(path.sep).join('/')].map((r) => r.replace(/[\\/]+$/, '')) : []
  let text = String(message ?? '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .filter((l) => !/node_modules|node:internal|^\s*at (async )?(Promise|processTicksAndRejections|new Promise)\b/.test(l))
    .slice(0, 12)
    .join('\n')
  for (const r of roots) text = text.split(`file:///${r.replace(/^\//, '')}/`).join('').split(`${r}/`).join('').split(`${r}\\`).join('')
  for (const s of findSecrets(text)) text = text.replace(s.secret, mask(s.secret))
  return text.slice(0, 2000)
}

const JEST_STATUS = { passed: 'passed', failed: 'failed', skipped: 'skipped', pending: 'skipped', disabled: 'skipped', todo: 'todo', focused: 'passed' }

/** Vitest e Jest: o mesmo JSON (testResults[] por arquivo, assertionResults[] por teste). */
export function fromJestLike(json, root) {
  projectRoot = root
  const out = []
  for (const file of json.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      const name = [...(t.ancestorTitles ?? []).filter(Boolean), t.title].join(' › ')
      out.push({
        file: rel(root, file.name),
        name,
        status: JEST_STATUS[t.status] ?? 'skipped',
        durationMs: Number.isFinite(t.duration) ? Math.round(t.duration) : null,
        message: t.failureMessages?.length ? clean(t.failureMessages.join('\n')) : null,
      })
    }
  }
  return out
}

const PW_STATUS = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' }

/** Playwright: suites → specs → tests (um por navegador) → results (uma por tentativa). */
export function fromPlaywright(json, root) {
  projectRoot = root
  const testDir = json.config?.projects?.[0]?.testDir ?? root
  const out = []
  const walk = (suite, titles) => {
    const here = suite.file && suite.title === suite.file ? titles : [...titles, suite.title].filter(Boolean)
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? []) {
        const results = t.results ?? []
        const failed = results.find((x) => x.errors?.length || x.error)
        const skip = t.annotations?.find((a) => a.type === 'skip' || a.type === 'fixme')
        out.push({
          file: rel(root, path.resolve(testDir, spec.file ?? suite.file ?? '')),
          name: [...here, spec.title].join(' › ') + (t.projectName ? ` [${t.projectName}]` : ''),
          status: PW_STATUS[t.status] ?? 'skipped',
          durationMs: results.reduce((s, x) => s + (x.duration ?? 0), 0),
          message: t.status === 'skipped' && skip?.description ? `Pulado: ${skip.description}` : failed ? clean((failed.errors?.[0] ?? failed.error)?.message) : null,
        })
      }
    for (const child of suite.suites ?? []) walk(child, here)
  }
  for (const s of json.suites ?? []) walk(s, [])
  return out
}

const unescapeXml = (v) => String(v ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&')
const attr = (tag, name) => unescapeXml(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '')

/** JUnit do node --test: <testsuite name="grupo"> aninhados com <testcase name file time> e <failure>/<skipped>. */
export function fromJUnit(xml, root) {
  projectRoot = root
  const out = []
  const suites = []
  const re = /<testsuite\b([^>]*)>|<\/testsuite>|<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g
  let m
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<testsuite')) suites.push(attr(m[1], 'name'))
    else if (m[0] === '</testsuite>') suites.pop()
    else {
      const tag = m[2]
      const body = m[4] ?? ''
      const skipped = body.match(/<skipped\b([^>]*)/)
      const failure = body.match(/<failure\b([^>]*)>([\s\S]*?)<\/failure>|<failure\b([^>]*)\/>/)
      const file = attr(tag, 'file')
      out.push({
        file: file ? rel(root, file) : null,
        name: [...suites.filter(Boolean), attr(tag, 'name')].join(' › '),
        status: skipped ? (attr(skipped[1], 'type') === 'todo' ? 'todo' : 'skipped') : failure ? 'failed' : 'passed',
        durationMs: Math.round(Number(attr(tag, 'time')) * 1000) || 0,
        message: failure ? clean(unescapeXml(failure[2] || attr(failure[1] ?? failure[3], 'message'))) : null,
      })
    }
  }
  return out
}

/**
 * JUnit do pytest (xunit1): <testcase classname="pasta.test_x.TestClasse" name="test_y" file="pasta/test_x.py">,
 * com <failure>, <error> (quebrou fora do teste, ex.: numa fixture) ou <skipped>. O arquivo vem relativo à pasta
 * em que o pytest rodou.
 */
export function fromPytest(xml, root, cwd = root) {
  projectRoot = root
  const out = []
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g
  let m
  while ((m = re.exec(xml))) {
    const tag = m[1]
    const body = m[3] ?? ''
    const skipped = body.match(/<skipped\b([^>]*)/)
    const failure = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/(?:failure|error)>|<(?:failure|error)\b([^>]*)\/>/)
    const file = attr(tag, 'file')
    const cls = attr(tag, 'classname').split('.').at(-1)
    const skipNote = skipped && attr(skipped[1], 'message')
    out.push({
      file: file ? rel(root, path.resolve(cwd, file)) : null,
      name: [/^[A-Z]/.test(cls) ? cls : null, attr(tag, 'name')].filter(Boolean).join(' › '),
      status: skipped ? 'skipped' : failure ? 'failed' : 'passed',
      durationMs: Math.round(Number(attr(tag, 'time')) * 1000) || 0,
      // O resumo (ex.: "assert 21 == 22") primeiro; depois o trecho do código em que quebrou.
      message: failure ? clean([attr(failure[2] ?? failure[4], 'message'), unescapeXml(failure[3] ?? '').replace(/\r/g, '')].filter(Boolean).join('\n')) : skipNote ? `Pulado: ${skipNote}` : null,
    })
  }
  return out
}
