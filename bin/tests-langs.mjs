// Executores de teste fora do Node e do Python: Flutter (flutter test), Dart (dart test), PHPUnit, Pest, Go
// (go test), Maven e Gradle (JUnit), .NET (dotnet test), Rust (cargo test) e C/C++ (CTest ou make test). Detecta
// pela pasta (pubspec.yaml, composer.json, go.mod, pom.xml, build.gradle, .sln/.csproj, Cargo.toml, CMakeLists.txt,
// Makefile), conta os testes sem rodar e, quando pedido, roda e lê o relatório: o JSON por linha do package:test
// (Flutter e Dart) e do go test, o JUnit do PHPUnit/Pest/Maven/Gradle/CTest/GoogleTest, o TRX do .NET e o texto do cargo test.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { COVERAGE_DIR } from './coverage.mjs'
import { t as tr } from './i18n.mjs'
import { karmaRunner, runKarma } from './tests-karma.mjs'

export const DART_TEST_FILE = /_test\.dart$/
export const PHP_TEST_FILE = /(^|\/)tests?\/.*\.php$/
export const GO_TEST_FILE = /_test\.go$/
export const JVM_TEST_FILE = /(^|\/)src\/test\/.*\.(java|kt)$/
export const CS_TEST_FILE = /^(?!.*(^|\/)(bin|obj)\/).*(Tests?\.cs$|(^|\/)[^/]*\.Tests?\/.*\.cs$)/
// Rust: os testes de integração ficam em tests/; os de unidade, dentro do próprio arquivo (#[test]), ver RUST_INLINE_TEST.
export const RUST_TEST_FILE = /(^|\/)tests\/.*\.rs$/
export const RUST_INLINE_TEST = /#\[(\w+::)?test\]/
export const C_TEST_FILE = /^(?!.*(^|\/)(build|cmake-build-[^/]+)\/).*((^|\/)(tests?|unittests?)\/.*|_(unit)?tests?|(^|\/)test_[^/]*)\.(c|cc|cpp|cxx)$/

const WIN = process.platform === 'win32'
// O wrapper do projeto (mvnw, gradlew) vence o programa instalado: fixa a versão que o projeto usa.
const WRAPPER = { maven: WIN ? 'mvnw.cmd' : 'mvnw', gradle: WIN ? 'gradlew.bat' : 'gradlew' }
const INSTALLED_CMD = { maven: 'mvn', gradle: 'gradle' }
const SKIP_DIR = /^(node_modules|bin|obj|target|build|dist|vendor|\..*)$/

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    // Arquivo que não existe: tratado como vazio.
    return ''
  }
}

const list = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    // Pasta que não existe ou sem permissão: sem nada dentro.
    return []
  }
}

// O programa está no PATH? (flutter, dart, php, go, mvn, gradle, dotnet)
const onPath = (cmd) => spawnSync(WIN ? 'where' : 'which', [cmd], { encoding: 'utf8', windowsHide: true }).status === 0

/** Pasta com projeto de outra linguagem (para procurar executores nas subpastas). */
export const isLangProjectDir = (root, dir) =>
  ['pubspec.yaml', 'composer.json', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'Cargo.toml', 'CMakeLists.txt', 'Makefile'].some((f) => fs.existsSync(path.join(root, dir, f))) ||
  list(path.join(root, dir)).some((e) => e.isFile() && /\.(slnx?|csproj)$/.test(e.name))

/** Executores numa pasta (raiz = ''). */
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
  if (fs.existsSync(path.join(root, dir, 'go.mod'))) found.push({ runner: 'go', dir, config: 'go.mod', script: null, installed: onPath('go'), coverage: true })
  const jvm = jvmRunner(root, dir)
  if (jvm) found.push(jvm)
  const dotnet = dotnetRunner(root, dir)
  if (dotnet) found.push(dotnet)
  const cargo = cargoRunner(root, dir)
  if (cargo) found.push(cargo)
  const ctest = ctestRunner(root, dir)
  if (ctest) found.push(ctest)
  const make = makeRunner(root, dir)
  if (make) found.push(make)
  const karma = karmaRunner(root, dir)
  if (karma) found.push(karma)
  return found
}

// Makefile de C/C++: compila com $(CC)/$(CXX), gcc, g++ ou clang, ou fala de arquivos .c/.cpp.
const C_MAKEFILE = /\$\((CC|CXX)\)|\b(gcc|g\+\+|clang\+\+|clang|cc)\b|\.(c|cc|cpp|cxx)\b/

/** make test (ou make check): projeto C/C++ só com Makefile. Com CMake, quem roda é o CTest. */
function makeRunner(root, dir) {
  const file = ['Makefile', 'makefile', 'GNUmakefile'].find((f) => fs.existsSync(path.join(root, dir, f)))
  if (!file || fs.existsSync(path.join(root, dir, 'CMakeLists.txt'))) return null
  const text = read(path.join(root, dir, file))
  const target = ['test', 'check'].find((t) => new RegExp(`^${t}\\s*:`, 'm').test(text))
  if (!target || !C_MAKEFILE.test(text)) return null
  return { runner: 'make', dir, config: file, script: null, target, installed: onPath('make'), coverage: false }
}

/** cargo test: pelo Cargo.toml da pasta; membro de um workspace fica com a raiz do workspace. Cobertura com o cargo-llvm-cov. */
function cargoRunner(root, dir) {
  if (!fs.existsSync(path.join(root, dir, 'Cargo.toml'))) return null
  if (ancestors(dir).some((d) => /^\s*\[workspace\]/m.test(read(path.join(root, d, 'Cargo.toml'))))) return null
  return { runner: 'cargo', dir, config: 'Cargo.toml', script: null, installed: onPath('cargo'), coverage: onPath('cargo-llvm-cov') }
}

// O CMake do projeto (ou de uma subpasta dele) liga os testes do CTest.
const CTEST_SIGNS = /\b(enable_testing|add_test|gtest_discover_tests|gtest_add_tests|catch_discover_tests|doctest_discover_tests)\s*\(/

/** CTest: CMakeLists.txt que liga os testes (nele ou numa subpasta); subprojeto de um CMake maior fica com a raiz. */
function ctestRunner(root, dir) {
  if (!fs.existsSync(path.join(root, dir, 'CMakeLists.txt'))) return null
  if (ancestors(dir).some((d) => fs.existsSync(path.join(root, d, 'CMakeLists.txt')))) return null
  const lists = [path.join(dir, 'CMakeLists.txt'), ...['test', 'tests', 'unittests'].map((t) => path.join(dir, t, 'CMakeLists.txt'))]
  if (!lists.some((f) => CTEST_SIGNS.test(read(path.join(root, f))))) return null
  return { runner: 'ctest', dir, config: 'CMakeLists.txt', script: null, installed: onPath('cmake') && onPath('ctest'), coverage: onPath('gcovr') }
}

// As pastas acima de `dir`, até a raiz ('a/b' → ['', 'a']).
const ancestors = (dir) => (dir ? ['', ...dir.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))] : [])

/** Maven (pom.xml) ou Gradle (build.gradle), com testes em src/test ou em módulos. Módulo de um projeto maior fica com a raiz. */
function jvmRunner(root, dir) {
  const at = (d, f) => fs.existsSync(path.join(root, d, f))
  const aggregator = (d) => /<modules>/.test(read(path.join(root, d, 'pom.xml'))) || at(d, 'settings.gradle') || at(d, 'settings.gradle.kts')
  if (ancestors(dir).some(aggregator)) return null
  if (!at(dir, 'src/test') && !aggregator(dir)) return null
  if (at(dir, 'pom.xml')) return { runner: 'maven', dir, config: 'pom.xml', script: null, installed: at(dir, WRAPPER.maven) || onPath('mvn'), coverage: true }
  const gradle = ['build.gradle.kts', 'build.gradle'].find((f) => at(dir, f))
  const jacoco = /\bjacoco\b/.test(read(path.join(root, dir, gradle ?? '')))
  if (gradle) return { runner: 'gradle', dir, config: gradle, script: null, installed: at(dir, WRAPPER.gradle) || onPath('gradle'), coverage: jacoco }
  return null
}

/** Projetos de teste do .NET (o .csproj que usa o Microsoft.NET.Test.Sdk) dentro da pasta, até 3 níveis. */
function testProjects(root, dir, depth = 0) {
  const out = []
  for (const e of list(path.join(root, dir))) {
    const rel = dir ? `${dir}/${e.name}` : e.name
    if (e.isFile() && e.name.endsWith('.csproj') && /Microsoft\.NET\.Test\.Sdk|MSTest\.Sdk/.test(read(path.join(root, rel)))) out.push(rel)
    else if (e.isDirectory() && depth < 3 && !SKIP_DIR.test(e.name)) out.push(...testProjects(root, rel, depth + 1))
  }
  return out
}

/** dotnet test: pela solução (.sln) se houver; se não, por pasta com projeto de teste. */
function dotnetRunner(root, dir) {
  const hasSln = (d) => list(path.join(root, d)).some((e) => e.isFile() && /\.slnx?$/.test(e.name))
  if (ancestors(dir).some(hasSln)) return null
  const own = list(path.join(root, dir)).some((e) => e.isFile() && e.name.endsWith('.csproj'))
  if (!hasSln(dir) && !own) return null
  const projects = hasSln(dir) ? testProjects(root, dir) : testProjects(root, dir).filter((p) => path.posix.dirname(p) === (dir || '.'))
  if (!projects.length) return null
  const coverage = projects.some((p) => /coverlet\.collector/.test(read(path.join(root, p))))
  return { runner: 'dotnet', dir, config: hasSln(dir) ? 'sln' : path.posix.basename(projects[0]), script: null, installed: onPath('dotnet'), coverage }
}

/** Testes contados sem rodar, por linguagem. */
export function countLangCases(rel, text) {
  const count = (re) => [...text.matchAll(re)].length
  if (DART_TEST_FILE.test(rel)) return { cases: count(/\b(?:test|testWidgets)\s*\(\s*['"]/g), skipped: count(/\bskip\s*:\s*(?:true|['"])/g) }
  if (PHP_TEST_FILE.test(rel)) return { cases: count(/function\s+test\w*\s*\(|#\[Test\]|@test\b|^\s*(?:it|test)\s*\(\s*['"]/gm), skipped: count(/markTestSkipped|->skip\s*\(/g) }
  if (GO_TEST_FILE.test(rel)) return { cases: count(/^func\s+Test\w*\s*\(\s*\w+\s+\*testing\.T\s*\)/gm), skipped: count(/\bt\.Skip(Now|f)?\s*\(/g) }
  if (JVM_TEST_FILE.test(rel)) return { cases: count(/@(Test|ParameterizedTest|RepeatedTest)\b/g), skipped: count(/@(Disabled|Ignore)\b/g) }
  if (CS_TEST_FILE.test(rel)) return { cases: count(/\[\s*(Fact|Theory|Test|TestMethod)\b/g), skipped: count(/\[\s*(Fact|Theory)\s*\(\s*Skip\s*=|\[\s*Ignore\b/g) }
  if (rel.endsWith('.rs')) return { cases: count(/#\[(\w+::)?test\]/g), skipped: count(/#\[ignore\b/g) }
  if (C_TEST_FILE.test(rel))
    return {
      cases: count(/^\s*(TEST|TEST_F|TEST_P|TYPED_TEST|TEST_CASE|TEST_CASE_METHOD|SCENARIO|BOOST_AUTO_TEST_CASE)\s*\(/gm),
      skipped: count(/^\s*TEST(_F|_P)?\s*\(\s*\w+\s*,\s*DISABLED_|^\s*(TEST_CASE|SCENARIO)\s*\([^)]*"\[\.|\bGTEST_SKIP\s*\(/gm),
    }
  return null
}

/** Roda um dos executores daqui. Devolve { runner, durationMs, cases | junit, error } como runTests. */
export function runLangTests(root, runner, { dir = '', files = null, out, timeout, coverageArgs = [] }) {
  const cwd = path.join(root, dir)
  const started = Date.now()
  if (runner === 'ctest') return runCtest(cwd, { out, timeout, started, coverageArgs })
  if (runner === 'karma') return runKarma(root, dir, { out, timeout })
  if (runner === 'make') return runMake(cwd, { out, timeout, started, target: makeRunner(root, dir)?.target ?? 'test' })
  const { cmd, args, shell } = commandFor(root, runner, cwd, { files, out, coverageArgs })
  // flutter, dart, mvnw.cmd e gradlew.bat são .bat/.cmd no Windows: precisam do shell para abrir.
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, shell, env: { ...process.env, CI: '1', NO_COLOR: '1' } })
  const durationMs = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') return { runner, durationMs, error: tr(`went over the time limit (${Math.round(timeout / 60000)} min)`, `passou do tempo limite (${Math.round(timeout / 60000)} min)`) }
  if (r.error?.code === 'ENOENT') return { runner, durationMs, error: tr(`couldn't start ${cmd} (is it installed and on the PATH?)`, `não consegui abrir o ${cmd} (ele está instalado e no PATH?)`) }
  const noResult = (what) => ({ runner, durationMs, error: lastLine(r.stderr) || lastLine(r.stdout) || tr(`${runner} finished without ${what === 'relatório' ? 'a report' : 'results'} (code ${r.status})`, `o ${runner} terminou sem ${what} (código ${r.status})`) })
  if (runner === 'phpunit' || runner === 'pest') {
    const xml = read(out)
    return xml ? { runner, durationMs, cases: null, junit: xml, error: null } : noResult('relatório')
  }
  if (runner === 'maven' || runner === 'gradle') {
    const xml = freshReports(cwd, runner === 'maven' ? /(^|\/)target\/surefire-reports\/TEST-.*\.xml$/ : /(^|\/)build\/test-results\/[^/]+\/TEST-.*\.xml$/, started)
    if (coverageArgs.length) copyJacoco(root, dir, started)
    return xml ? { runner, durationMs, cases: null, junit: xml, error: null } : noResult('relatório')
  }
  if (runner === 'dotnet') {
    const trx = freshReports(trxDir(out), /\.trx$/, started)
    const cases = fromTrx(trx, root, cwd)
    if (coverageArgs.length) copyCobertura(trxDir(out), path.join(root, COVERAGE_DIR))
    return cases.length ? { runner, durationMs, cases, error: null } : noResult('resultados')
  }
  // go: o perfil de cobertura traz o caminho do pacote (módulo/pasta); guarda o módulo para achar o arquivo.
  if (runner === 'go' && coverageArgs.length) {
    const module = read(path.join(cwd, 'go.mod')).match(/^module\s+(\S+)/m)?.[1]
    if (module) fs.writeFileSync(path.join(root, COVERAGE_DIR, 'go-module.json'), JSON.stringify({ module, dir }))
  }
  const cases = runner === 'go' ? fromGoJson(r.stdout, root, cwd) : runner === 'cargo' ? fromCargoTest(r.stdout, root, cwd) : fromDartJson(r.stdout, root, cwd)
  if (!cases.length) return noResult('resultados')
  return { runner, durationMs, cases, error: null }
}

// CTest: a pasta de build que já tem os testes configurados (build/, out/build/…, cmake-build-*); senão, build/.
function ctestBuildDir(cwd) {
  const candidates = ['build', ...list(cwd).filter((e) => e.isDirectory() && /^cmake-build-/.test(e.name)).map((e) => e.name), ...list(path.join(cwd, 'out', 'build')).filter((e) => e.isDirectory()).map((e) => `out/build/${e.name}`)]
  return candidates.find((d) => fs.existsSync(path.join(cwd, d, 'CTestTestfile.cmake'))) ?? 'build'
}

// Com cobertura, o CTest compila com --coverage numa pasta dentro da do Faundr (ao lado do relatório): o build do
// projeto fica como está e nada sobra na pasta do projeto.
const coverageBuild = (out) => path.join(path.dirname(out), 'cmake-cobertura').split(path.sep).join('/')
const COVERAGE_FLAGS = ['-DCMAKE_C_FLAGS=--coverage', '-DCMAKE_CXX_FLAGS=--coverage', '-DCMAKE_EXE_LINKER_FLAGS=--coverage', '-DCMAKE_BUILD_TYPE=Debug']

// Um passo de um executor em várias etapas (cmake, ctest, gcovr, make), com o tempo que sobra da rodada.
function stepper(cwd, timeout, started, env = {}) {
  const left = () => Math.max(1000, timeout - (Date.now() - started))
  return (cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: left(), maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: '1', NO_COLOR: '1', ...env } })
}

function stepFailed(runner, what, r, { timeout, started }) {
  const tool = runner === 'make' ? 'make' : 'cmake'
  const error =
    r.error?.code === 'ETIMEDOUT'
      ? tr(`went over the time limit (${Math.round(timeout / 60000)} min)`, `passou do tempo limite (${Math.round(timeout / 60000)} min)`)
      : r.error?.code === 'ENOENT'
        ? tr(`couldn't start ${tool} (is it installed and on the PATH?)`, `não consegui abrir o ${tool} (ele está instalado e no PATH?)`)
        : `${tr(what.en, what.pt)} ${tr('failed', 'falhou')}: ${lastLine(r.stderr) || lastLine(r.stdout)}`
  return { runner, durationMs: Date.now() - started, error }
}

/**
 * CTest: configura (se ainda não tem build), compila e roda, com o resultado em JUnit (CMake 3.21 ou mais novo).
 * Com cobertura (coverageArgs = argumentos do gcovr), usa a pasta própria compilada com --coverage e grava o lcov.
 */
function runCtest(cwd, { out, timeout, started, coverageArgs = [] }) {
  const ctx = { timeout, started }
  const build = coverageArgs.length ? coverageBuild(out) : ctestBuildDir(cwd)
  const step = stepper(cwd, timeout, started)
  if (!fs.existsSync(path.join(cwd, build, 'CMakeCache.txt'))) {
    const conf = step('cmake', ['-S', '.', '-B', build, ...(coverageArgs.length ? COVERAGE_FLAGS : [])])
    if (conf.status !== 0) return stepFailed('ctest', { en: 'the CMake configuration', pt: 'a configuração do CMake' }, conf, ctx)
  }
  const compiled = step('cmake', ['--build', build])
  if (compiled.status !== 0) return stepFailed('ctest', { en: 'the build', pt: 'a compilação' }, compiled, ctx)
  const r = step('ctest', ['--test-dir', build, '--output-junit', out, '--output-on-failure'])
  if (r.error) return stepFailed('ctest', { en: 'ctest', pt: 'o ctest' }, r, ctx)
  // Cobertura: o gcovr junta os .gcda da pasta de build e grava o lcov; se falhar, os testes valem sem ela.
  if (coverageArgs.length) step('gcovr', ['--root', '.', '--object-directory', build, ...coverageArgs])
  const xml = read(out)
  return xml ? { runner: 'ctest', durationMs: Date.now() - started, cases: null, junit: xml, error: null } : stepFailed('ctest', { en: 'ctest', pt: 'o ctest' }, r, ctx)
}

/**
 * make test (ou check): roda com GTEST_OUTPUT, para o GoogleTest gravar o XML de cada programa de teste (com o
 * arquivo de cada teste). Sem XML (testes próprios, Unity, Check…), a rodada inteira vira um teste só.
 */
function runMake(cwd, { out, timeout, started, target }) {
  const xmlDir = out.replace(/\.\w+$/, '-gtest')
  fs.rmSync(xmlDir, { recursive: true, force: true })
  fs.mkdirSync(xmlDir, { recursive: true })
  const r = stepper(cwd, timeout, started, { GTEST_OUTPUT: `xml:${xmlDir}/` })('make', [target])
  if (r.error) return stepFailed('make', { en: `make ${target}`, pt: `o make ${target}` }, r, { timeout, started })
  const xml = freshReports(xmlDir, /\.xml$/, started)
  if (xml) return { runner: 'make', durationMs: Date.now() - started, cases: null, junit: xml, error: null }
  return { runner: 'make', durationMs: Date.now() - started, cases: makeCases({ status: r.status, output: `${r.stdout}\n${r.stderr}`, target }), error: null }
}

/** A rodada do make sem relatório: um teste só, que passou se o make terminou bem; na falha, o fim da saída. */
export function makeCases({ status, output, target }) {
  const lines = String(output ?? '').split('\n').map((l) => l.trimEnd()).filter(Boolean)
  return [
    {
      file: null,
      name: `make ${target}`,
      status: status === 0 ? 'passed' : 'failed',
      durationMs: 0,
      message: status === 0 ? null : lines.slice(-15).join('\n').slice(0, 2000) || tr('failed', 'falhou'),
    },
  ]
}

/** O comando de cada executor. `files`: só esses arquivos de teste (relativos à pasta do executor). */
function commandFor(root, runner, cwd, { files, out, coverageArgs }) {
  if (runner === 'phpunit' || runner === 'pest')
    return { cmd: 'php', args: [path.join('vendor', 'bin', runner), '--log-junit', out, '--colors=never', ...coverageArgs, ...(files ?? [])], shell: false }
  if (runner === 'go') {
    // Pacotes dos arquivos pedidos (./pasta), ou todos (./...).
    const pkgs = files?.length ? [...new Set(files.map((f) => `./${path.posix.dirname(f)}`))] : ['./...']
    return { cmd: 'go', args: ['test', '-json', ...coverageArgs, ...pkgs], shell: false }
  }
  if (runner === 'maven' || runner === 'gradle') {
    const wrapper = fs.existsSync(path.join(cwd, WRAPPER[runner]))
    const cmd = wrapper ? path.join(cwd, WRAPPER[runner]) : INSTALLED_CMD[runner]
    const classes = (files ?? []).map((f) => path.posix.basename(f).replace(/\.(java|kt)$/, ''))
    // Cobertura: no Maven, o JaCoCo antes (prepare-agent) e depois (report) do test; no Gradle, a tarefa jacocoTestReport.
    const [before = null, after = null] = runner === 'maven' ? coverageArgs : []
    const args =
      runner === 'maven'
        ? ['-B', ...(before ? [before] : []), 'test', ...(after ? [after] : []), '-Dmaven.test.failure.ignore=true', '-Dsurefire.failIfNoSpecifiedTests=false', ...(classes.length ? [`-Dtest=${classes.join(',')}`] : [])]
        : ['test', ...coverageArgs, '--continue', '--console=plain', ...classes.flatMap((c) => ['--tests', `*${c}`])]
    return { cmd, args, shell: WIN }
  }
  if (runner === 'dotnet') {
    fs.rmSync(trxDir(out), { recursive: true, force: true })
    const classes = (files ?? []).map((f) => path.posix.basename(f).replace(/\.cs$/, ''))
    const filter = classes.length ? ['--filter', classes.map((c) => `FullyQualifiedName~${c}`).join('|')] : []
    return { cmd: 'dotnet', args: ['test', '--logger', 'trx', '--results-directory', trxDir(out), ...coverageArgs, ...filter], shell: false }
  }
  if (runner === 'cargo') {
    // Só testes de integração pedidos (tests/x.rs) → --test x; teste dentro de src/ roda o projeto todo.
    const targets = files?.length && files.every((f) => RUST_TEST_FILE.test(f)) ? files.flatMap((f) => ['--test', path.posix.basename(f, '.rs')]) : []
    // Com cobertura, o cargo llvm-cov roda os mesmos testes e grava o lcov. O "Running <arquivo>" sai no stderr e os
    // resultados no stdout: o shell junta os dois na ordem (2>&1) para cada teste ficar com o arquivo certo.
    const quote = (a) => (/\s/.test(a) ? `"${a}"` : a)
    return { cmd: 'cargo', args: [coverageArgs.length ? 'llvm-cov' : 'test', '--no-fail-fast', ...coverageArgs.map(quote), ...targets, '2>&1'], shell: true }
  }
  return { cmd: runner, args: ['test', runner === 'flutter' ? '--machine' : '--reporter=json', ...coverageArgs, ...(files ?? [])], shell: WIN }
}

// dotnet: os .trx (um por projeto de teste) e a cobertura ficam numa pasta ao lado do relatório.
const trxDir = (out) => out.replace(/\.\w+$/, '-resultados')

/** Relatórios escritos nesta rodada (pelo horário), juntos num texto só. */
function freshReports(dir, pattern, since) {
  const out = []
  const walk = (rel, depth) => {
    for (const e of list(path.join(dir, rel))) {
      const sub = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory() && depth < 6 && !/^(node_modules|\.git|src)$/.test(e.name)) walk(sub, depth + 1)
      else if (e.isFile() && pattern.test(sub) && fs.statSync(path.join(dir, sub)).mtimeMs >= since - 1000) out.push(read(path.join(dir, sub)))
    }
  }
  walk('', 0)
  return out.join('\n')
}

/**
 * JaCoCo: um jacoco.xml por módulo (target/site/jacoco no Maven, build/reports/jacoco no Gradle). Vai para a pasta
 * de cobertura do Faundr com a lista de qual módulo é cada um (o caminho do arquivo depende do módulo).
 */
function copyJacoco(root, dir, since) {
  const target = path.join(root, COVERAGE_DIR)
  const found = []
  const walk = (rel, depth) => {
    for (const e of list(path.join(root, rel))) {
      const sub = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory() && depth < 7 && !/^(node_modules|\.git|src)$/.test(e.name)) walk(sub, depth + 1)
      else if (e.isFile() && e.name === 'jacoco.xml' && /(target\/site\/jacoco|build\/reports\/jacoco\/[^/]+)\/jacoco\.xml$/.test(sub) && fs.statSync(path.join(root, sub)).mtimeMs >= since - 1000) {
        const file = `jacoco-${found.length}.xml`
        fs.copyFileSync(path.join(root, sub), path.join(target, file))
        found.push({ file, module: sub.replace(/\/(target|build)\/.*$/, '').replace(/^(target|build)\/.*$/, '') })
      }
    }
  }
  fs.mkdirSync(target, { recursive: true })
  walk(dir, 0)
  if (found.length) fs.writeFileSync(path.join(target, 'jacoco.json'), JSON.stringify(found))
}

/** dotnet: a cobertura sai em <resultados>/<guid>/coverage.cobertura.xml; vai para a pasta de cobertura do Faundr. */
function copyCobertura(resultsDir, coverageDir) {
  let n = 0
  const walk = (dir) => {
    for (const e of list(dir)) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'coverage.cobertura.xml') fs.copyFileSync(p, path.join(coverageDir, `cobertura-${n++}.xml`))
    }
  }
  fs.mkdirSync(coverageDir, { recursive: true })
  walk(resultsDir)
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
    .map((t) => ({ file: relTo(suites.get(t.suite)), name: t.name, status: t.status, durationMs: t.durationMs, message: t.status === 'failed' ? t.errors.join('\n').slice(0, 2000) || tr('failed', 'falhou') : null }))
}

/**
 * JSON do `go test -json` (uma linha por evento): run, output, pass, fail e skip, por pacote e teste. Subtestes
 * (TestX/caso) contam; o teste-pai que só agrupa subtestes não. O arquivo é o _test.go do pacote que declara o teste.
 */
export function fromGoJson(stdout, root, cwd = root) {
  const tests = new Map()
  const module = read(path.join(cwd, 'go.mod')).match(/^module\s+(\S+)/m)?.[1] ?? ''
  for (const line of String(stdout ?? '').split('\n')) {
    if (!line.startsWith('{')) continue
    let e
    try {
      e = JSON.parse(line)
    } catch {
      // Linha cortada no meio (saída truncada): só ela fica de fora.
      continue
    }
    if (!e.Test) continue
    const key = `${e.Package}\u0000${e.Test}`
    const t = tests.get(key) ?? { pkg: e.Package, name: e.Test, output: [] }
    tests.set(key, t)
    if (e.Action === 'output' && !/^\s*(=== (RUN|PAUSE|CONT)|--- (PASS|FAIL|SKIP))/.test(e.Output ?? '')) t.output.push(String(e.Output ?? '').trimEnd())
    else if (['pass', 'fail', 'skip'].includes(e.Action)) {
      t.status = { pass: 'passed', fail: 'failed', skip: 'skipped' }[e.Action]
      t.durationMs = Math.round((e.Elapsed ?? 0) * 1000)
    }
  }
  const parents = new Set([...tests.values()].filter((t) => t.name.includes('/')).map((t) => `${t.pkg}\u0000${t.name.split('/')[0]}`))
  const fileCache = new Map()
  return [...tests.entries()]
    .filter(([key, t]) => t.status && !parents.has(key))
    .map(([, t]) => ({
      file: goTestFile(root, cwd, module, t.pkg, t.name.split('/')[0], fileCache),
      name: t.name.replace(/\//g, ' › '),
      status: t.status,
      durationMs: t.durationMs,
      message: goMessage(t),
    }))
}

/** O que o teste escreveu: o motivo da falha, ou o do t.Skip. */
function goMessage(t) {
  const text = t.output.filter(Boolean).join('\n')
  if (t.status === 'failed') return text.slice(0, 2000) || tr('failed', 'falhou')
  if (t.status === 'skipped') return text.slice(0, 300) || null
  return null
}

/** O _test.go do pacote que declara `func TestX(`. */
function goTestFile(root, cwd, module, pkg, test, cache) {
  const dir = module && (pkg === module || pkg.startsWith(`${module}/`)) ? path.join(cwd, pkg.slice(module.length + 1)) : null
  if (!dir) return null
  const files = cache.get(dir) ?? list(dir).filter((e) => e.isFile() && e.name.endsWith('_test.go')).map((e) => ({ name: e.name, text: read(path.join(dir, e.name)) }))
  cache.set(dir, files)
  const hit = files.find((f) => new RegExp(`^func\\s+${test}\\s*\\(`, 'm').test(f.text)) ?? files[0]
  return hit ? path.relative(root, path.join(dir, hit.name)).split(path.sep).join('/') : null
}

/**
 * TRX do dotnet test (VSTest): <UnitTestResult testName outcome duration> com <ErrorInfo><Message>/<StackTrace>, e
 * <UnitTest><TestMethod className name/>. O arquivo vem do rastro da falha ou do .cs com o nome da classe.
 */
export function fromTrx(xml, root, cwd = root) {
  const classOf = new Map()
  for (const m of String(xml ?? '').matchAll(/<UnitTest\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<TestMethod\b[^>]*\bclassName="([^"]+)"/g)) classOf.set(m[1], m[2])
  const fileCache = new Map()
  const out = []
  for (const m of String(xml ?? '').matchAll(/<UnitTestResult\b([^>]*?)(\/>|>([\s\S]*?)<\/UnitTestResult>)/g)) {
    const attrs = m[1]
    const get = (name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? ''
    const body = m[3] ?? ''
    const outcome = get('outcome')
    const status = TRX_STATUS[outcome] ?? 'failed'
    const cls = (classOf.get(get('testId')) ?? '').split(',')[0]
    const short = cls.split('.').pop() ?? ''
    const testName = unescapeXml(get('testName'))
    const method = cls && testName.startsWith(`${cls}.`) ? testName.slice(cls.length + 1) : testName
    const message = [body.match(/<Message>([\s\S]*?)<\/Message>/)?.[1], body.match(/<StackTrace>([\s\S]*?)<\/StackTrace>/)?.[1]].filter(Boolean).map(unescapeXml).join('\n')
    const fromTrace = message.match(/ in (.+?\.cs):line \d+/)?.[1]
    out.push({
      file: fromTrace ? relIfInside(root, fromTrace) : csClassFile(root, cwd, short, fileCache),
      name: short ? `${short} › ${method}` : method,
      status,
      durationMs: durationOf(get('duration')),
      message: status === 'failed' ? message.slice(0, 2000) || tr('failed', 'falhou') : null,
    })
  }
  return out
}

// Resultado do TRX → situação do Faundr (Failed, Error, Timeout e Aborted são falha).
const TRX_STATUS = { Passed: 'passed', NotExecuted: 'skipped', Inconclusive: 'skipped' }
const unescapeXml =(s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#xD;|&#13;/g, '').replace(/&#xA;|&#10;/g, '\n').replace(/&amp;/g, '&')
// "00:00:01.2345678" → ms
const durationOf = (d) => {
  const [h, m, s] = d.split(':').map(Number)
  return Number.isFinite(s) ? Math.round(((h * 60 + m) * 60 + s) * 1000) : 0
}
const relIfInside = (root, file) => {
  const rel = path.relative(root, file).split(path.sep).join('/')
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : rel
}

/** O .cs com o nome da classe de teste (procura na pasta do executor, fora de bin/ e obj/). */
function csClassFile(root, cwd, cls, cache) {
  if (!cls) return null
  if (!cache.has('')) {
    const all = []
    const walk = (dir, depth) => {
      for (const e of list(dir)) {
        if (e.isDirectory() && depth < 6 && !SKIP_DIR.test(e.name)) walk(path.join(dir, e.name), depth + 1)
        else if (e.isFile() && e.name.endsWith('.cs')) all.push(path.join(dir, e.name))
      }
    }
    walk(cwd, 0)
    cache.set('', all)
  }
  const files = cache.get('')
  const hit = files.find((f) => path.basename(f) === `${cls}.cs`) ?? files.find((f) => new RegExp(`\\bclass\\s+${cls}\\b`).test(read(f)))
  return hit ? relIfInside(root, hit) : null
}

/**
 * JUnit do Maven (surefire) e do Gradle: o teste vem como "com.acme.PedidoTest › salva", sem arquivo. Acha o
 * arquivo pela classe (src/test/java/com/acme/PedidoTest.java ou .kt) e encurta o nome para "PedidoTest › salva".
 */
export function jvmCaseFiles(cases, root, dir = '') {
  const cache = new Map()
  return cases.map((c) => {
    if (c.file) return c
    const [cls, ...rest] = c.name.split(' › ')
    if (!/^[\w$.]+$/.test(cls)) return c
    const top = cls.split('$')[0]
    let file = cache.get(top)
    if (file === undefined) {
      const rel = top.replace(/\./g, '/')
      file = null
      for (const base of ['src/test/java', 'src/test/kotlin', 'src/test/groovy'])
        for (const ext of ['.java', '.kt']) {
          const candidate = path.posix.join(dir, base, rel + ext)
          if (!file && fs.existsSync(path.join(root, candidate))) file = candidate
        }
      file ??= findInModules(root, dir, rel)
      cache.set(top, file)
    }
    return { ...c, file, name: [cls.split('.').pop(), ...rest].join(' › ') }
  })
}

/** Maven, Gradle e CTest: o JUnit não traz o arquivo, que sai do nome da classe ou do teste. Os outros executores já trazem. */
export function junitCaseFiles(runner, cases, root, dir) {
  if (runner === 'maven' || runner === 'gradle') return jvmCaseFiles(cases, root, dir)
  return runner === 'ctest' ? ctestCaseFiles(cases, root, dir) : cases
}

/**
 * JUnit do CTest: o teste vem como "<site> › Suite.Nome" (GoogleTest) ou "<site> › nome" (Catch2, doctest), sem
 * arquivo. Acha o arquivo de teste que declara TEST(Suite, Nome) ou TEST_CASE("nome") e tira o nome do site.
 */
export function ctestCaseFiles(cases, root, dir = '') {
  const sources = testSources(root, dir)
  return cases.map((c) => {
    if (c.file) return c
    const name = c.name.split(' › ').pop()
    const gtest = name.match(/^(?:\w+\/)?(\w+)\.(\w+)(?:\/\d+)?$/)
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const decl = gtest
      ? new RegExp(`\\b(TEST|TEST_F|TEST_P|TYPED_TEST)\\s*\\(\\s*${gtest[1]}\\s*,\\s*${gtest[2]}\\s*\\)`)
      : new RegExp(`\\b(TEST_CASE|SCENARIO|TEST_CASE_METHOD|BOOST_AUTO_TEST_CASE)\\s*\\([^"]*"?${esc(name)}"?\\s*[,)]`)
    const hit = sources.find((s) => decl.test(s.text))
    return { ...c, file: hit?.rel ?? null, name: gtest ? `${gtest[1]} › ${gtest[2]}` : name }
  })
}

// Arquivos de teste C/C++ da pasta (sem as pastas de build), lidos uma vez.
function testSources(root, dir) {
  const out = []
  const walk = (rel, depth) => {
    for (const e of list(path.join(root, rel))) {
      const sub = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory() && depth < 6 && !SKIP_DIR.test(e.name) && !/^cmake-build-/.test(e.name)) walk(sub, depth + 1)
      else if (e.isFile() && C_TEST_FILE.test(sub)) out.push({ rel: sub, text: read(path.join(root, sub)) })
    }
  }
  walk(dir, 0)
  return out
}

/**
 * Texto do `cargo test` (stdout e stderr juntos, na ordem): cada "Running <arquivo> (target/…/<nome>-<hash>)" abre um
 * bloco, "test a::b::c ... ok|FAILED|ignored" é um teste e "---- a::b::c stdout ----" traz o motivo da falha. O arquivo
 * sai do caminho do módulo (a/b.rs ou a/b/mod.rs a partir do src/ do crate); nos doc-tests, do próprio nome.
 */
export function fromCargoTest(text, root, cwd = root) {
  const crates = cargoCrates(cwd)
  const relTo = (abs) => path.relative(root, abs).split(path.sep).join('/')
  const tests = []
  const messages = new Map()
  let block = null
  let failing = null
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '')
    const running = line.match(/^\s+Running (?:unittests )?(\S+\.rs) \((?:.*[/\\])?([\w-]+?)-[0-9a-f]+(?:\.exe)?\)/)
    const doc = line.match(/^\s+Doc-tests ([\w-]+)/)
    if (running || doc) {
      failing = null
      const crateDir = running ? cargoCrateFor(cwd, crates, running[2], running[1]) : crates.get(doc[1].replace(/-/g, '_')) ?? cwd
      block = { crateDir, file: running ? path.join(crateDir, running[1]) : null }
      continue
    }
    const header = line.match(/^---- (\S+) stdout ----$/)
    if (header) {
      failing = header[1]
      messages.set(failing, [])
      continue
    }
    if (failing) {
      if (/^(failures:|test result:)/.test(line)) failing = null
      else if (!/^note: run with `RUST_BACKTRACE/.test(line)) messages.get(failing).push(line)
      continue
    }
    const t = line.match(/^test (.+?) \.\.\. (ok|FAILED|ignored)(?:, (.*))?$/)
    if (!t || !block) continue
    const status = { ok: 'passed', FAILED: 'failed', ignored: 'skipped' }[t[2]]
    const docTest = t[1].match(/^(.+\.rs) - (.+?) \(line (\d+)\)$/)
    if (docTest) {
      const abs = [path.join(cwd, docTest[1]), path.join(block.crateDir, docTest[1])].find((f) => fs.existsSync(f))
      tests.push({ file: abs ? relTo(abs) : null, name: `${docTest[2]} (doc-test, linha ${docTest[3]})`, status, durationMs: 0, key: t[1], note: t[3] })
      continue
    }
    tests.push({ file: block.file ? relTo(rustTestFile(block.file, t[1])) : null, name: t[1].split('::').join(' › '), status, durationMs: 0, key: t[1], note: t[3] })
  }
  return tests.map(({ key, note, ...c }) => ({
    ...c,
    message: c.status === 'failed' ? (messages.get(key) ?? []).join('\n').trim().slice(0, 2000) || tr('failed', 'falhou') : c.status === 'skipped' && note ? `${tr('Skipped', 'Pulado')}: ${note}` : null,
  }))
}

/** Crates da pasta (ela mesma e os membros de um workspace, até 3 níveis): nome com _ → pasta. */
function cargoCrates(cwd) {
  const crates = new Map()
  const walk = (dir, depth) => {
    const name = read(path.join(dir, 'Cargo.toml')).match(/^\s*name\s*=\s*"([\w-]+)"/m)?.[1]
    if (name) crates.set(name.replace(/-/g, '_'), dir)
    if (depth < 3) for (const e of list(dir)) if (e.isDirectory() && !SKIP_DIR.test(e.name)) walk(path.join(dir, e.name), depth + 1)
  }
  walk(cwd, 0)
  return crates
}

// O crate do bloco: pelo nome do binário (o do crate nos testes de unidade); senão, o primeiro que tem o arquivo.
function cargoCrateFor(cwd, crates, binary, file) {
  const byName = crates.get(binary.replace(/-/g, '_'))
  if (byName && fs.existsSync(path.join(byName, file))) return byName
  return [cwd, ...crates.values()].find((d) => fs.existsSync(path.join(d, file))) ?? cwd
}

// `pedido::tests::soma` num bloco de src/lib.rs → src/pedido.rs (o módulo mais longo que existe). Nos testes de
// integração (tests/x.rs) os módulos ficam dentro do próprio arquivo.
function rustTestFile(blockFile, name) {
  if (!/(^|[/\\])src[/\\]/.test(blockFile)) return blockFile
  const base = path.dirname(blockFile)
  const mods = name.split('::').slice(0, -1)
  for (let i = mods.length; i > 0; i--)
    for (const candidate of [path.join(base, ...mods.slice(0, i)) + '.rs', path.join(base, ...mods.slice(0, i), 'mod.rs')]) if (fs.existsSync(candidate)) return candidate
  return blockFile
}

// Projeto com módulos: <módulo>/src/test/java/<pacote>/<Classe>.java.
function findInModules(root, dir, rel) {
  for (const e of list(path.join(root, dir))) {
    if (!e.isDirectory() || SKIP_DIR.test(e.name)) continue
    for (const base of ['src/test/java', 'src/test/kotlin'])
      for (const ext of ['.java', '.kt']) {
        const candidate = path.posix.join(dir, e.name, base, rel + ext)
        if (fs.existsSync(path.join(root, candidate))) return candidate
      }
  }
  return null
}
