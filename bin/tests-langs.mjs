// Executores de teste fora do Node e do Python: Flutter (flutter test), Dart (dart test), PHPUnit e Pest.
// Detecta pela pasta (pubspec.yaml, composer.json), conta os testes sem rodar e, quando pedido, roda e lê o
// relatório: o JSON por linha do package:test (Flutter e Dart) e o JUnit do PHPUnit/Pest.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const DART_TEST_FILE = /_test\.dart$/
export const PHP_TEST_FILE = /(^|\/)tests?\/.*\.php$/

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    // Arquivo que não existe: tratado como vazio.
    return ''
  }
}

// O programa está no PATH? (flutter, dart, php)
const onPath = (cmd) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8', windowsHide: true }).status === 0

/** Executores numa pasta (raiz = ''): flutter/dart pelo pubspec.yaml, phpunit/pest pelo composer.json. */
export function langRunnersIn(root, dir) {
  const found = []
  const pubspec = read(path.join(root, dir, 'pubspec.yaml'))
  if (pubspec && fs.existsSync(path.join(root, dir, 'test'))) {
    const flutter = /^\s+sdk:\s*flutter\b/m.test(pubspec)
    const runner = flutter ? 'flutter' : 'dart'
    found.push({ runner, dir, config: 'pubspec.yaml', script: null, installed: onPath(runner), coverage: flutter })
  }
  const composer = read(path.join(root, dir, 'composer.json'))
  if (composer) {
    const pest = /"pestphp\/pest"/.test(composer)
    const phpunit = pest || /"phpunit\/phpunit"/.test(composer) || ['phpunit.xml', 'phpunit.xml.dist'].some((f) => fs.existsSync(path.join(root, dir, f)))
    if (phpunit) {
      const runner = pest ? 'pest' : 'phpunit'
      const bin = path.join(root, dir, 'vendor', 'bin', runner)
      found.push({ runner, dir, config: 'composer.json', script: null, installed: fs.existsSync(bin) && onPath('php'), coverage: true })
    }
  }
  return found
}

/** Testes contados sem rodar: test()/testWidgets() no Dart; métodos test…/#[Test] e it()/test() do Pest no PHP. */
export function countLangCases(rel, text) {
  if (DART_TEST_FILE.test(rel)) {
    const cases = [...text.matchAll(/\b(?:test|testWidgets)\s*\(\s*['"]/g)].length
    return { cases, skipped: [...text.matchAll(/\bskip\s*:\s*(?:true|['"])/g)].length }
  }
  if (PHP_TEST_FILE.test(rel)) {
    const cases = [...text.matchAll(/function\s+test\w*\s*\(|#\[Test\]|@test\b|^\s*(?:it|test)\s*\(\s*['"]/gm)].length
    return { cases, skipped: [...text.matchAll(/markTestSkipped|->skip\s*\(/g)].length }
  }
  return null
}

/** Roda um dos executores daqui. Devolve { runner, durationMs, cases, error } como runTests. */
export function runLangTests(root, runner, { dir = '', files = null, out, timeout, coverageArgs = [] }) {
  const cwd = path.join(root, dir)
  const started = Date.now()
  const isPhp = runner === 'phpunit' || runner === 'pest'
  const args = isPhp
    ? [path.join('vendor', 'bin', runner), '--log-junit', out, '--colors=never', ...coverageArgs, ...(files ?? [])]
    : ['test', runner === 'flutter' ? '--machine' : '--reporter=json', ...coverageArgs, ...(files ?? [])]
  const cmd = isPhp ? 'php' : runner
  // flutter e dart são .bat no Windows: precisam do shell para abrir.
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' && !isPhp, env: { ...process.env, CI: '1', NO_COLOR: '1' } })
  const durationMs = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') return { runner, durationMs, error: `passou do tempo limite (${Math.round(timeout / 60000)} min)` }
  if (r.error?.code === 'ENOENT') return { runner, durationMs, error: `não consegui abrir o ${cmd} (ele está instalado e no PATH?)` }
  if (isPhp) {
    const xml = read(out)
    if (!xml) return { runner, durationMs, error: lastLine(r.stderr) || lastLine(r.stdout) || `o ${runner} terminou sem relatório (código ${r.status})` }
    return { runner, durationMs, cases: null, junit: xml, error: null }
  }
  const cases = fromDartJson(r.stdout, root, cwd)
  if (!cases.length) return { runner, durationMs, error: lastLine(r.stderr) || lastLine(r.stdout) || `o ${runner} test terminou sem resultados (código ${r.status})` }
  return { runner, durationMs, cases, error: null }
}

const lastLine = (text) => String(text ?? '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('{')).at(-1)?.slice(0, 300) ?? ''

/**
 * JSON do package:test (uma linha por evento): suite (arquivo), testStart (nome e linha), error (falha) e testDone
 * (result success/failure/error, skipped, hidden). Os "loading …" escondidos não contam.
 */
export function fromDartJson(stdout, root, cwd = root) {
  const suites = new Map()
  const tests = new Map()
  for (const line of String(stdout ?? '').split('\n')) {
    if (!line.startsWith('{')) continue
    let e
    try {
      e = JSON.parse(line)
    } catch {
      // Linha cortada no meio (saída truncada): só ela fica de fora.
      continue
    }
    if (e.type === 'suite') suites.set(e.suite.id, e.suite.path)
    else if (e.type === 'testStart') tests.set(e.test.id, { name: e.test.name, suite: e.test.suiteID, start: e.time, errors: [] })
    else if (e.type === 'error') tests.get(e.testID)?.errors.push(String(e.error ?? '').split('\n').slice(0, 8).join('\n'))
    else if (e.type === 'testDone') {
      const t = tests.get(e.testID)
      if (!t || e.hidden) {
        tests.delete(e.testID)
        continue
      }
      t.status = e.skipped ? 'skipped' : e.result === 'success' ? 'passed' : 'failed'
      t.durationMs = Math.max(0, (e.time ?? 0) - (t.start ?? 0))
    }
  }
  const relTo = (file) => (file ? path.relative(root, path.resolve(cwd, file)).split(path.sep).join('/') : null)
  return [...tests.values()]
    .filter((t) => t.status)
    .map((t) => ({ file: relTo(suites.get(t.suite)), name: t.name, status: t.status, durationMs: t.durationMs, message: t.status === 'failed' ? t.errors.join('\n').slice(0, 2000) || 'falhou' : null }))
}
