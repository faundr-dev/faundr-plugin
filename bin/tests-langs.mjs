// Executores de teste fora do Node e do Python: Flutter (flutter test), Dart (dart test), PHPUnit, Pest, Go
// (go test), Maven e Gradle (JUnit) e .NET (dotnet test). Detecta pela pasta (pubspec.yaml, composer.json,
// go.mod, pom.xml, build.gradle, .sln/.csproj), conta os testes sem rodar e, quando pedido, roda e lê o relatório:
// o JSON por linha do package:test (Flutter e Dart) e do go test, o JUnit do PHPUnit/Pest/Maven/Gradle e o TRX do .NET.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { COVERAGE_DIR } from './coverage.mjs'

export const DART_TEST_FILE = /_test\.dart$/
export const PHP_TEST_FILE = /(^|\/)tests?\/.*\.php$/
export const GO_TEST_FILE = /_test\.go$/
export const JVM_TEST_FILE = /(^|\/)src\/test\/.*\.(java|kt)$/
export const CS_TEST_FILE = /^(?!.*(^|\/)(bin|obj)\/).*(Tests?\.cs$|(^|\/)[^/]*\.Tests?\/.*\.cs$)/

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
  ['pubspec.yaml', 'composer.json', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts'].some((f) => fs.existsSync(path.join(root, dir, f))) ||
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
  return found
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
  return null
}

/** Roda um dos executores daqui. Devolve { runner, durationMs, cases | junit, error } como runTests. */
export function runLangTests(root, runner, { dir = '', files = null, out, timeout, coverageArgs = [] }) {
  const cwd = path.join(root, dir)
  const started = Date.now()
  const { cmd, args, shell } = commandFor(root, runner, cwd, { files, out, coverageArgs })
  // flutter, dart, mvnw.cmd e gradlew.bat são .bat/.cmd no Windows: precisam do shell para abrir.
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, shell, env: { ...process.env, CI: '1', NO_COLOR: '1' } })
  const durationMs = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') return { runner, durationMs, error: `passou do tempo limite (${Math.round(timeout / 60000)} min)` }
  if (r.error?.code === 'ENOENT') return { runner, durationMs, error: `não consegui abrir o ${cmd} (ele está instalado e no PATH?)` }
  const noResult = (what) => ({ runner, durationMs, error: lastLine(r.stderr) || lastLine(r.stdout) || `o ${runner} terminou sem ${what} (código ${r.status})` })
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
  const cases = runner === 'go' ? fromGoJson(r.stdout, root, cwd) : fromDartJson(r.stdout, root, cwd)
  if (!cases.length) return noResult('resultados')
  return { runner, durationMs, cases, error: null }
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
    .map((t) => ({ file: relTo(suites.get(t.suite)), name: t.name, status: t.status, durationMs: t.durationMs, message: t.status === 'failed' ? t.errors.join('\n').slice(0, 2000) || 'falhou' : null }))
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
  if (t.status === 'failed') return text.slice(0, 2000) || 'falhou'
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
      message: status === 'failed' ? message.slice(0, 2000) || 'falhou' : null,
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

/** Maven e Gradle: o JUnit não traz o arquivo, que sai do nome da classe. Os outros executores já trazem. */
export const junitCaseFiles = (runner, cases, root, dir) => (runner === 'maven' || runner === 'gradle' ? jvmCaseFiles(cases, root, dir) : cases)

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
