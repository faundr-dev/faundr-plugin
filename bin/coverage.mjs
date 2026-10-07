// Seção Testes (fase 2): cobertura = por quais linhas do código os testes passaram. Lê o formato completo do
// istanbul (coverage-final.json: Vitest e Jest) e o lcov (node --test), cruza com o git diff desde o início da
// sessão ("o que mudou hoje está tão coberto quanto o resto?") e aponta arquivo que perdeu cobertura sem ser
// mexido (quase sempre um teste apagado). Conceitos do estudo em docs/research/testes-mutacao-cobertura.md.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const COVERAGE_DIR = path.join('.faundr', 'tests', 'coverage')
const PREV_FILE = path.join('.faundr', 'tests', 'coverage-prev.json')
const NOT_CODE = /(^|\/)(node_modules|dist|build|coverage|\.faundr)\/|\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/

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
  return null
}

/** Linhas de cada arquivo: 'c' coberta, 'p' parcial (um caminho do if sem teste), 'u' sem teste. */
export function readCoverage(root) {
  const dir = path.join(root, COVERAGE_DIR)
  const istanbul = path.join(dir, 'coverage-final.json')
  if (fs.existsSync(istanbul)) return fromIstanbul(JSON.parse(fs.readFileSync(istanbul, 'utf8')), root)
  const lcov = path.join(dir, 'lcov.info')
  if (fs.existsSync(lcov)) return fromLcov(fs.readFileSync(lcov, 'utf8'), root)
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
