// Seção Testes (fase 2): cobertura = por quais linhas do código os testes passaram. Lê o formato completo do
// istanbul (coverage-final.json: Vitest e Jest) e o lcov (node --test), cruza com o git diff desde o início da
// sessão ("o que mudou hoje está tão coberto quanto o resto?") e aponta arquivo que perdeu cobertura sem ser
// mexido (quase sempre um teste apagado). Conceitos do estudo em docs/research/testes-mutacao-cobertura.md.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { relPath } from './paths.mjs'

export const COVERAGE_DIR = path.join(relPath('tests'), 'coverage')
const PREV_FILE = path.join(relPath('tests'), 'coverage-prev.json')
const JACOCO = 'org.jacoco:jacoco-maven-plugin:0.8.13'
const readText = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    // Arquivo que não existe: vazio.
    return ''
  }
}
const NOT_CODE =/(^|\/)(node_modules|dist|build|coverage|\.faundr)\/|\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/

/** Argumentos extras para ligar a cobertura sem mexer na configuração do projeto (null = não dá). */
export function coverageArgs(runner, root, sub = '') {
  // Executor numa subpasta (ex.: frontend/): o relatório vai para a pasta do Faundr na raiz, pelo caminho completo.
  const dir = (sub ? path.join(root, COVERAGE_DIR) : COVERAGE_DIR).split(path.sep).join('/')
  // Sem "include", só aparecem arquivos que algum teste importou; com src/, aparece também o que não tem teste nenhum.
  const src = fs.existsSync(path.join(root, sub, 'src'))
  if (runner === 'vitest')
    return ['--coverage.enabled', '--coverage.reporter=json', `--coverage.reportsDirectory=${dir}`, '--coverage.reportOnFailure', ...(src ? ['--coverage.include=src/**'] : [])]
  if (runner === 'jest') return ['--coverage', '--coverageReporters=json', `--coverageDirectory=${dir}`, ...(src ? ['--collectCoverageFrom=src/**/*.{js,jsx,ts,tsx,mjs}'] : [])]
  if (runner === 'node') return ['--experimental-test-coverage', '--test-reporter=lcov', `--test-reporter-destination=${dir}/lcov.info`]
  // pytest com pytest-cov, flutter test e PHPUnit/Pest (que precisam do Xdebug ou do PCOV ligado no PHP).
  if (runner === 'pytest') return ['--cov=.', `--cov-report=lcov:${dir}/lcov.info`]
  if (runner === 'flutter') return ['--coverage', `--coverage-path=${dir}/lcov.info`]
  if (runner === 'phpunit' || runner === 'pest') return ['--coverage-clover', `${dir}/clover.xml`]
  if (runner === 'go') return [`-coverprofile=${path.resolve(root, COVERAGE_DIR, 'cover.out')}`]
  // cargo: o cargo-llvm-cov (instalado à parte) roda os testes e grava o lcov.
  if (runner === 'cargo') return ['--lcov', '--output-path', path.resolve(root, COVERAGE_DIR, 'lcov.info')]
  // CTest: o gcovr (instalado à parte) lê o que o build com --coverage gravou e escreve o lcov.
  if (runner === 'ctest') return ['--lcov', path.resolve(root, COVERAGE_DIR, 'lcov.info')]
  // dotnet: precisa do coverlet.collector no projeto de teste; o Cobertura vai para a pasta do Faundr depois.
  if (runner === 'dotnet') return ['--collect', 'XPlat Code Coverage']
  // Maven: o JaCoCo pelo nome completo do plugin, sem mexer no pom.xml (antes e depois do test).
  if (runner === 'maven') return [`${JACOCO}:prepare-agent`, `${JACOCO}:report`]
  // Gradle: só se o projeto já aplica o plugin jacoco (o Faundr não muda o build.gradle).
  if (runner === 'gradle') return /\bjacoco\b/.test(['build.gradle', 'build.gradle.kts'].map((f) => readText(path.join(root, sub, f))).join('\n')) ? ['jacocoTestReport'] : null
  return null
}

/** Linhas de cada arquivo: 'c' coberta, 'p' parcial (um caminho do if sem teste), 'u' sem teste. */
export function readCoverage(root) {
  const dir = path.join(root, COVERAGE_DIR)
  const istanbul = path.join(dir, 'coverage-final.json')
  if (fs.existsSync(istanbul)) return fromIstanbul(JSON.parse(fs.readFileSync(istanbul, 'utf8')), root)
  const lcov = path.join(dir, 'lcov.info')
  if (fs.existsSync(lcov)) return fromLcov(fs.readFileSync(lcov, 'utf8'), root)
  const clover = path.join(dir, 'clover.xml')
  if (fs.existsSync(clover)) return fromClover(fs.readFileSync(clover, 'utf8'), root)
  const goProfile = path.join(dir, 'cover.out')
  if (fs.existsSync(goProfile)) return fromGoCover(fs.readFileSync(goProfile, 'utf8'), root, readJson(path.join(dir, 'go-module.json')))
  const cobertura = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^cobertura-\d+\.xml$/.test(f)) : []
  if (cobertura.length) return fromCobertura(cobertura.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n'), root)
  const jacoco = readJson(path.join(dir, 'jacoco.json'))
  if (jacoco?.length) return fromJacoco(jacoco.map((r) => ({ xml: readText(path.join(dir, r.file)), module: r.module })), root)
  return null
}

const relative = (root, file) => path.relative(root, path.resolve(root, file.replace(/^file:\/\//, ''))).split(path.sep).join('/')

export function fromIstanbul(json, root) {
  const files = new Map()
  for (const data of Object.values(json)) {
    const file = relative(root, data.path)
    if (file.startsWith('..') || NOT_CODE.test(file)) continue
    const lines = new Map()
    for (const [id, loc] of Object.entries(data.statementMap ?? {})) {
      const line = loc.start.line
      const hit = (data.s?.[id] ?? 0) > 0
      if (hit) lines.set(line, 'c')
      else if (!lines.has(line)) lines.set(line, 'u')
    }
    // Ramo (if/else, ?:, &&) com um lado nunca executado: a linha fica parcial.
    for (const [id, branch] of Object.entries(data.branchMap ?? {})) {
      const counts = data.b?.[id] ?? []
      const line = branch.loc?.start?.line ?? branch.locations?.[0]?.start?.line
      if (line && lines.get(line) === 'c' && counts.some((n) => n === 0)) lines.set(line, 'p')
    }
    files.set(file, lines)
  }
  return files
}

export function fromLcov(text, root) {
  const files = new Map()
  let file = null
  let lines = null
  for (const raw of text.split('\n')) {
    const l = raw.trim()
    if (l.startsWith('SF:')) {
      file = relative(root, l.slice(3))
      lines = new Map()
    } else if (l.startsWith('DA:') && lines) {
      const [line, count] = l.slice(3).split(',').map(Number)
      lines.set(line, count > 0 ? 'c' : 'u')
    } else if (l.startsWith('BRDA:') && lines) {
      const [line, , , taken] = l.slice(5).split(',')
      if ((taken === '-' || taken === '0') && lines.get(Number(line)) === 'c') lines.set(Number(line), 'p')
    } else if (l === 'end_of_record' && file && lines) {
      if (!file.startsWith('..') && !NOT_CODE.test(file)) files.set(file, lines)
      file = null
      lines = null
    }
  }
  return files
}

// "12-15, 20, 31-33": linhas sem teste em faixas, para caber no painel.
export function ranges(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  const out = []
  for (const n of sorted) {
    const last = out[out.length - 1]
    if (last && n === last[1] + 1) last[1] = n
    else out.push([n, n])
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', ')
}

const pct = (covered, total) => (total ? Math.round((covered / total) * 1000) / 10 : null)

/** Resumo por arquivo e do projeto. Linha parcial conta como sem teste. */
export function summarize(files) {
  const list = []
  let total = 0
  let covered = 0
  for (const [file, lines] of files) {
    const values = [...lines.values()]
    const c = values.filter((v) => v === 'c').length
    const uncovered = [...lines].filter(([, v]) => v !== 'c').map(([n]) => n)
    total += values.length
    covered += c
    list.push({ file, lines: values.length, covered: c, partial: values.filter((v) => v === 'p').length, pct: pct(c, values.length), uncovered: ranges(uncovered).slice(0, 500) })
  }
  return { total: { lines: total, covered, pct: pct(covered, total) }, files: list.sort((a, b) => b.lines - b.covered - (a.lines - a.covered)) }
}

/** Linhas mudadas desde `base` (commit em que a sessão começou), mais arquivos novos ainda fora do git. */
export function changedLines(root, base) {
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }).stdout ?? ''
  const out = new Map()
  let file = null
  for (const l of git(['diff', '-U0', '--no-color', base ?? 'HEAD']).split('\n')) {
    if (l.startsWith('+++ ')) file = l === '+++ /dev/null' ? null : l.slice(6)
    const m = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (m && file) {
      const start = Number(m[1])
      const count = m[2] === undefined ? 1 : Number(m[2])
      const set = out.get(file) ?? new Set()
      for (let i = 0; i < count; i++) set.add(start + i)
      out.set(file, set)
    }
  }
  for (const f of git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)) {
    if (NOT_CODE.test(f) || !/\.[cm]?[jt]sx?$/.test(f)) continue
    try {
      const n = fs.readFileSync(path.join(root, f), 'utf8').split('\n').length
      out.set(f, new Set(Array.from({ length: n }, (_, i) => i + 1)))
    } catch {
      // Arquivo sumiu entre a listagem e a leitura: não conta.
    }
  }
  return out
}

/** Cobertura das linhas que a sessão mudou e que os testes podem executar (comentário e linha vazia não contam). */
export function sessionCoverage(files, changed) {
  let coverable = 0
  let covered = 0
  const list = []
  for (const [file, set] of changed) {
    const lines = files.get(file)
    if (!lines) continue
    const mine = [...set].filter((n) => lines.has(n))
    if (!mine.length) continue
    const c = mine.filter((n) => lines.get(n) === 'c').length
    coverable += mine.length
    covered += c
    list.push({ file, changed: mine.length, covered: c, pct: pct(c, mine.length), uncovered: ranges(mine.filter((n) => lines.get(n) !== 'c')).slice(0, 500) })
  }
  return { lines: coverable, covered, pct: pct(covered, coverable), files: list.sort((a, b) => b.changed - b.covered - (a.changed - a.covered)) }
}

/** Arquivos que ninguém mexeu nesta sessão mas perderam linhas cobertas desde a rodada anterior. */
export function lostCoverage(root, summary, changed) {
  let prev = null
  try {
    prev = JSON.parse(fs.readFileSync(path.join(root, PREV_FILE), 'utf8'))
  } catch {
    // Primeira rodada com cobertura: ainda não há com o que comparar.
  }
  fs.mkdirSync(path.dirname(path.join(root, PREV_FILE)), { recursive: true })
  fs.writeFileSync(path.join(root, PREV_FILE), JSON.stringify(Object.fromEntries(summary.files.map((f) => [f.file, f.covered]))))
  if (!prev) return []
  return summary.files
    .filter((f) => !changed.has(f.file) && prev[f.file] !== undefined && f.covered < prev[f.file])
    .map((f) => ({ file: f.file, before: prev[f.file], now: f.covered }))
}

/** Clover (PHPUnit/Pest): <file name="..."><line num="12" type="stmt" count="1"/>; count 0 = sem teste. */
export function fromClover(xml, root) {
  const files = new Map()
  for (const m of xml.matchAll(/<file\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/file>/g)) {
    const file = relative(root, m[1])
    if (file.startsWith('..') || NOT_CODE.test(file)) continue
    const lines = new Map()
    for (const l of m[2].matchAll(/<line\b[^>]*\bnum="(\d+)"[^>]*\btype="(stmt|cond)"[^>]*\bcount="(\d+)"/g)) lines.set(Number(l[1]), Number(l[3]) > 0 ? 'c' : 'u')
    files.set(file, lines)
  }
  return files
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // Sem o arquivo do módulo: os caminhos do perfil ficam sem tradução.
    return null
  }
}

/**
 * Perfil do `go test -coverprofile`: "módulo/pasta/arquivo.go:10.30,12.2 1 1" (trecho, comandos, vezes). O caminho
 * do pacote vira o arquivo do projeto pelo módulo do go.mod (go-module.json, escrito quando os testes rodam).
 */
export function fromGoCover(text, root, mod = null) {
  const files = new Map()
  for (const raw of text.split('\n')) {
    const m = raw.trim().match(/^(.+\.go):(\d+)\.\d+,(\d+)\.\d+ \d+ (\d+)$/)
    if (!m) continue
    let file = m[1]
    if (mod?.module && file.startsWith(`${mod.module}/`)) file = path.posix.join(mod.dir || '', file.slice(mod.module.length + 1))
    file = relative(root, file)
    if (file.startsWith('..') || NOT_CODE.test(file)) continue
    const lines = files.get(file) ?? new Map()
    for (let l = Number(m[2]); l <= Number(m[3]); l++) {
      if (Number(m[4]) > 0) lines.set(l, 'c')
      else if (!lines.has(l)) lines.set(l, 'u')
    }
    files.set(file, lines)
  }
  return files
}

/**
 * JaCoCo (Java/Kotlin): <package name="com/acme"><sourcefile name="Pedido.java"><line nr mi ci mb cb/>. mi/ci =
 * instruções perdidas/cobertas, mb/cb = ramos. O arquivo fica em <módulo>/src/main/java (ou kotlin)/<pacote>/<nome>.
 */
export function fromJacoco(reports, root) {
  const files = new Map()
  for (const { xml, module = '' } of reports) {
    // Cada <sourcefile> com o pacote em volta: [pacote, nome, conteúdo].
    const sources = [...xml.matchAll(/<package\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/package>/g)].flatMap((p) =>
      [...p[2].matchAll(/<sourcefile\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/sourcefile>/g)].map((s) => [p[1], s[1], s[2]]),
    )
    for (const [pkg, name, body] of sources) {
      const file = jacocoFile(root, module, path.posix.join(pkg, name))
      if (!NOT_CODE.test(file)) files.set(file, jacocoLines(body))
    }
  }
  return files
}

// <módulo>/src/main/java (ou kotlin, ou src)/<pacote>/<arquivo>: o que existir no projeto.
const jacocoFile = (root, module, tail) =>
  ['src/main/java', 'src/main/kotlin', 'src'].map((base) => path.posix.join(module, base, tail)).find((f) => fs.existsSync(path.join(root, f))) ??
  path.posix.join(module, 'src/main/java', tail)

/** Sem instrução coberta (ci = 0): sem teste; coberta mas com ramo perdido (mb > 0): parcial. */
function jacocoLines(body) {
  const lines = new Map()
  for (const l of body.matchAll(/<line\b[^>]*\bnr="(\d+)"[^>]*\bmi="(\d+)"[^>]*\bci="(\d+)"[^>]*\bmb="(\d+)"[^>]*\bcb="(\d+)"/g)) {
    const [, nr, , ci, mb] = l.map(Number)
    if (ci === 0) lines.set(nr, 'u')
    else lines.set(nr, mb > 0 ? 'p' : 'c')
  }
  return lines
}

/**
 * Cobertura (coverlet, no dotnet test): <source> com a pasta base e <class filename> com <line number hits
 * branch condition-coverage>. Ramo com parte não executada vira linha parcial.
 */
export function fromCobertura(xml, root) {
  const files = new Map()
  // Cada relatório tem as próprias <sources>; os caminhos das classes são relativos a elas.
  for (const report of xml.split(/(?=<\?xml|<coverage\b)/)) {
    const sources = [...report.matchAll(/<source>([^<]*)<\/source>/g)].map((m) => m[1].trim())
    for (const m of report.matchAll(/<class\b[^>]*\bfilename="([^"]+)"[^>]*>([\s\S]*?)<\/class>/g)) {
      const name = m[1].replace(/\\/g, '/')
      const abs = path.isAbsolute(name) ? name : (sources.map((s) => path.join(s, name)).find((p) => fs.existsSync(p)) ?? path.join(sources[0] ?? root, name))
      const file = relative(root, abs)
      if (file.startsWith('..') || NOT_CODE.test(file) || /(^|\/)(obj|bin)\//.test(file)) continue
      const lines = files.get(file) ?? new Map()
      for (const l of m[2].matchAll(/<line\b[^>]*\bnumber="(\d+)"[^>]*\bhits="(\d+)"([^>]*)/g)) {
        const n = Number(l[1])
        const partial = /condition-coverage="(?!100%)/.test(l[3])
        let state = 'u'
        if (Number(l[2]) > 0) state = partial ? 'p' : 'c'
        if (lines.get(n) !== 'c') lines.set(n, state)
      }
      files.set(file, lines)
    }
  }
  return files
}
