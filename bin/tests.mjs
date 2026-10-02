// Seção Testes (fase 1), sem IA: quais executores o projeto usa (Vitest, Jest, Playwright), o inventário dos
// arquivos e testes, o que já está no disco sem rodar nada, o aviso de banco de produção e a rodada pedida
// (faundr tests-run) com um leitor só para os relatórios JSON. Formatos e comandos em
// docs/research/testes-vitest-playwright.md. Os testes nunca rodam sozinhos (decisão do dono).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { COVERAGE_DIR, coverageArgs } from './coverage.mjs'
import { findSecrets, mask, projectFiles } from './security.mjs'

export const TEST_FILE = /(^|\/)(__tests__|tests?|e2e|spec)\/.*\.[cm]?[jt]sx?$|\.(test|spec)\.[cm]?[jt]sx?$/
const OUT_DIR = path.join('.faundr', 'tests')
const RUN_TIMEOUT = 15 * 60_000

// Onde fica o executável de cada um dentro de node_modules (roda com o node atual: funciona igual no Windows).
const RUNNERS = {
  vitest: { pkg: 'vitest', bin: ['node_modules/vitest/vitest.mjs'], config: /^vitest\.config\.[cm]?[jt]s$/ },
  jest: { pkg: 'jest', bin: ['node_modules/jest/bin/jest.js'], config: /^jest\.config\.([cm]?[jt]s|json)$/ },
  playwright: { pkg: '@playwright/test', bin: ['node_modules/@playwright/test/cli.js', 'node_modules/playwright/cli.js'], config: /^playwright\.config\.[cm]?[jt]s$/ },
}
// Detectados, mas o Faundr ainda não roda nem lê (aparecem no inventário).
const OTHERS = { cypress: 'Cypress', mocha: 'Mocha', ava: 'AVA', pytest: 'pytest' }

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

/** Executores de teste do projeto: pelo package.json, pelos arquivos de configuração e pelos scripts. */
export function detectRunners(root) {
  const pkg = readJson(root, 'package.json') ?? {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const top = fs.readdirSync(root)
  const scripts = Object.entries(pkg.scripts ?? {})
  const runners = []
  for (const [runner, r] of Object.entries(RUNNERS)) {
    const config = top.find((f) => r.config.test(f)) ?? (runner === 'vitest' && top.some((f) => /^vite\.config\./.test(f) && /\btest\s*:/.test(read(root, f) ?? '')) ? 'vite.config' : null)
    const inPkg = !!deps[r.pkg] || (runner === 'jest' && !!pkg.jest)
    if (!inPkg && !config) continue
    const word = runner === 'playwright' ? /playwright\s+test/ : new RegExp(`\\b${runner}\\b`)
    const script = scripts.find(([, cmd]) => word.test(cmd))?.[0] ?? null
    const bin = r.bin.find((b) => fs.existsSync(path.join(root, b))) ?? null
    runners.push({ runner, config, script, installed: !!bin, coverage: runner === 'vitest' ? !!(deps['@vitest/coverage-v8'] || deps['@vitest/coverage-istanbul']) : runner === 'jest' })
  }
  const pyproject = read(root, 'pyproject.toml') ?? read(root, 'requirements.txt') ?? ''
  const others = Object.entries(OTHERS)
    .filter(([name]) => deps[name] || (name === 'pytest' && /\bpytest\b/.test(pyproject)))
    .map(([, label]) => label)
  const nodeScript = scripts.find(([, cmd]) => /\bnode\s+(?:[^|&;]*\s)?--test\b/.test(cmd))
  if (nodeScript) runners.push({ runner: 'node', config: null, script: nodeScript[0], installed: true, coverage: false, args: nodeTestArgs(nodeScript[1]) })
  return { runners, others }
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
  const testFiles = files.filter((f) => TEST_FILE.test(f) && !/(^|\/)(node_modules|dist|build)\//.test(f))
  let cases = 0
  let skipped = 0
  let e2eFiles = 0
  for (const rel of testFiles) {
    const text = read(root, rel) ?? ''
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
const LOCAL = /localhost|127\.0\.0\.1|0\.0\.0\.0|:54321|host\.docker\.internal/

/**
 * Sinais de que os testes usam o banco de produção: um teste lê a variável ou importa o cliente do banco,
 * não há .env de teste, e o .env do projeto aponta para um endereço que não é local. Sem sinal: lista vazia.
 */
export function productionDbSignals(root, files = projectFiles(root).files) {
  const testFiles = files.filter((f) => TEST_FILE.test(f))
  const hasTestEnv = fs.readdirSync(root).some((f) => /^\.env\.test(\.local)?$/.test(f))
  if (hasTestEnv) return []
  const envText = ['.env', '.env.local', '.dev.vars'].map((f) => read(root, f) ?? '').join('\n')
  const reasons = []
  for (const rel of testFiles) {
    const text = read(root, rel) ?? ''
    const vars = [...new Set([...text.matchAll(DB_ENV)].filter((m) => !insideString(text, m.index)).map((m) => m[1]))]
    const remote = vars.filter((v) => {
      const value = envText.match(new RegExp(`^${v}\\s*=\\s*["']?([^\\s"']+)`, 'm'))?.[1]
      return value && !LOCAL.test(value)
    })
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

function commandFor(runner, out, { changed, files, nodeArgs }) {
  const extra = files?.length ? files : []
  if (runner === 'node') return ['--test', '--test-reporter=junit', `--test-reporter-destination=${out}`, ...(extra.length ? extra : nodeArgs ?? [])]
  if (runner === 'vitest') return ['run', '--reporter=json', `--outputFile.json=${out}`, '--passWithNoTests', ...(changed ? ['--changed'] : []), ...extra]
  if (runner === 'jest') return ['--ci', '--json', `--outputFile=${out}`, '--passWithNoTests', ...(changed ? ['--onlyChanged'] : []), ...extra]
  return ['test', '--reporter=json', '--pass-with-no-tests', ...(changed ? ['--only-changed'] : []), ...extra]
}

/** Roda um executor com saída JSON em .faundr/tests/, sem mexer na configuração do projeto. */
export function runTests(root, runner, { changed = false, files = null, timeout = RUN_TIMEOUT, nodeArgs = null, coverage = false } = {}) {
  const bin = runner === 'node' ? null : RUNNERS[runner].bin.find((b) => fs.existsSync(path.join(root, b)))
  if (!bin && runner !== 'node') return { runner, error: `${runner} não está instalado (rode npm install no projeto)` }
  fs.mkdirSync(path.join(root, OUT_DIR), { recursive: true })
  const out = path.join(OUT_DIR, `${runner}.${runner === 'node' ? 'xml' : 'json'}`).split(path.sep).join('/')
  try {
    fs.rmSync(path.join(root, out), { force: true })
  } catch {
    // Relatório antigo preso por outro processo: o novo sobrescreve.
  }
  const started = Date.now()
  // Cobertura: pasta própria do Faundr (o Vitest apaga a pasta de relatório antes de rodar), limpa a cada rodada.
  const covArgs = coverage ? (coverageArgs(runner, root) ?? []) : []
  if (covArgs.length) {
    fs.rmSync(path.join(root, COVERAGE_DIR), { recursive: true, force: true })
    // O node --test não cria a pasta do relatório sozinho.
    fs.mkdirSync(path.join(root, COVERAGE_DIR), { recursive: true })
  }
  const args = commandFor(runner, out, { changed, files, nodeArgs })
  // node --test: os reporters vêm em pares com o destino; os arquivos ficam no fim.
  const full = runner === 'node' ? [...args.slice(0, 3), ...covArgs, ...args.slice(3)] : [...args.slice(0, files?.length ? -files.length : undefined), ...covArgs, ...(files ?? [])]
  const r = spawnSync(process.execPath, [...(bin ? [bin] : []), ...full], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    // CI: sem modo observação, sem perguntas, .only esquecido falha. HTML_OPEN=never: o Playwright não trava servindo o relatório.
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(root, out), PLAYWRIGHT_HTML_OPEN: 'never' },
  })
  const durationMs = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') return { runner, durationMs, error: `passou do tempo limite (${Math.round(timeout / 60000)} min)` }
  if (runner === 'node') {
    const xml = read(root, out)
    if (!xml) return { runner, durationMs, error: firstLine(r.stderr || r.stdout) || `o node --test terminou sem relatório (código ${r.status})` }
    return { runner, durationMs, cases: fromJUnit(xml, root), error: null }
  }
  const json = readJson(root, out)
  if (!json) return { runner, durationMs, error: firstLine(r.stderr || r.stdout) || `o ${runner} terminou sem relatório (código ${r.status})` }
  const cases = runner === 'playwright' ? fromPlaywright(json, root) : fromJestLike(json, root)
  const fileErrors = runner === 'playwright' ? (json.errors ?? []).map((e) => clean(e.message)) : (json.testResults ?? []).filter((t) => t.message).map((t) => `${rel(root, t.name)}: ${clean(t.message)}`)
  return { runner, durationMs, cases, error: fileErrors.length && !cases.length ? fileErrors[0].slice(0, 1000) : null }
}

const rel = (root, file) => (file ? path.relative(root, path.resolve(root, file)).split(path.sep).join('/') : null)
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
