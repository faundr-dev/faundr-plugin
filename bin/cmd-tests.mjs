// Testes: faundr tests-scan, tests-run, tests-show, tests-context, tests-map, tests-mutation e tests-ignore.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectFiles } from './security.mjs'
import { AGENT, AGENT_SESSION_ID, firstOf, flag, linkedProject, log, readState, textArg, writeState } from './cli-core.mjs'
import { contentLangNote } from './hook-events.mjs'
import { memoryApi } from './cmd-features.mjs'

// ---- Testes ------------------------------------------------------------------------------------

async function testsApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/tests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(60_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

// Cobertura precisa da ferramenta no projeto; o Faundr nunca instala sozinho (decisão do dono): mostra o comando.
function coverageReady(runner, info) {
  if (runner === 'playwright') {
    console.log('  Coverage: Playwright (browser tests) does not measure coverage; running without it.')
    return false
  }
  if (runner === 'pytest' && !info?.coverage) {
    console.log('  Coverage: pytest-cov is missing from the project. Ask the user to approve: pip install pytest-cov (and add it to requirements). Running without coverage.')
    return false
  }
  if (runner === 'dart') {
    console.log('  Coverage: dart test does not produce the format Faundr reads without an extra tool; running without it.')
    return false
  }
  if (runner === 'phpunit' || runner === 'pest') console.log('  Coverage: PHP needs Xdebug or PCOV turned on; without them, the tests run and coverage does not show up.')
  if (runner === 'gradle' && !info?.coverage) {
    console.log("  Coverage: in Gradle it comes from the jacoco plugin, which the project does not apply. Ask the user to approve: add id(\"jacoco\") (or apply plugin: 'jacoco') to build.gradle. Running without coverage.")
    return false
  }
  if (runner === 'dotnet' && !info?.coverage) {
    console.log('  Coverage: coverlet.collector is missing from the test project. Ask the user to approve: dotnet add <test project> package coverlet.collector. Running without coverage.')
    return false
  }
  if (runner === 'cargo' && !info?.coverage) {
    console.log('  Coverage: in Rust it comes from cargo-llvm-cov, which is not installed. Ask the user to approve: cargo install cargo-llvm-cov. Running without coverage.')
    return false
  }
  if (runner === 'ctest' && !info?.coverage) {
    console.log('  Coverage: in C/C++ it comes from gcovr, which is not installed. Ask the user to approve: pip install gcovr (needs GCC or Clang; does not work with MSVC). Running without coverage.')
    return false
  }
  if (runner === 'karma') {
    console.log('  Coverage: Faundr does not read coverage from ng test (Karma) yet; running without it.')
    return false
  }
  if (runner === 'make') {
    console.log("  Coverage: with make, Faundr does not change the Makefile's compile flags; running without it.")
    return false
  }
  if (runner === 'vitest' && !info?.coverage) {
    console.log('  Coverage: the tool is missing from the project. Ask the user to approve: npm install -D @vitest/coverage-v8 (then run again with --coverage). Running without coverage.')
    return false
  }
  return true
}

async function coverageReport(root, runner, dir = '') {
  const { changedLines, lostCoverage, readCoverage, sessionCoverage, summarize } = await import('./coverage.mjs')
  const files = readCoverage(root)
  if (!files) return null
  const sid = AGENT_SESSION_ID ?? null
  const baseState = readState(root).qualityBase
  // Base: o commit em que esta sessão começou; fora de uma sessão, o último commit (só o que não foi commitado).
  const base = baseState?.session === sid && baseState?.head ? baseState.head : 'HEAD'
  const changed = changedLines(root, base)
  const summary = summarize(files)
  // node --test (e projetos sem src/) só medem os arquivos que algum teste carregou: o painel avisa.
  const onlyLoaded = runner === 'node' || !fs.existsSync(path.join(root, dir, 'src'))
  return { total: summary.total, files: summary.files.slice(0, 2000), session: sessionCoverage(files, changed), lost: lostCoverage(root, summary, changed), base: base === 'HEAD' ? null : base.slice(0, 12), onlyLoaded }
}

// Inventário sem rodar nada: executores, arquivos e testes, o que já está no disco e o aviso de banco de produção.
export async function testsScan(args) {
  const { root } = linkedProject()
  const { detectRunners, inventory, passiveResults, productionDbSignals } = await import('./tests.mjs')
  const { files } = projectFiles(root)
  const { runners, others } = detectRunners(root, { files, python: readState(root).python })
  // O caminho do Python fica só no computador (state.json); o painel recebe o resto.
  const inv = { ...inventory(root, files), runners: runners.map(({ python, args, ...r }) => r), others, productionDb: productionDbSignals(root, files) }
  await testsApi({ action: 'scan', inventory: inv, passive: passiveResults(root) })
  if (args.includes('--quiet')) return log(`tests: ${inv.testFiles} test files, ~${inv.cases} tests, runners: ${runners.map(runnerLabel).join(', ') || '-'}`)
  if (!runners.length && !inv.testFiles) return console.log('This project has no tests yet.')
  console.log(`Runners: ${runners.map((r) => `${runnerLabel(r)}${r.installed ? '' : ` (${notInstalled(r)})`}`).join(', ') || 'none supported'}${others.length ? ` · also: ${others.join(', ')} (not supported yet)` : ''}`)
  console.log(`${inv.testFiles} test files, about ${inv.cases} tests (${inv.skipped} skipped in the code, ${inv.e2eFiles} end-to-end files).`)
  for (const r of inv.productionDb) console.log(`Warning: ${r}`)
}

const runnerLabel = (r) => `${r.runner}${r.dir ? ` in ${r.dir}/` : ''}`
const NOT_INSTALLED = {
  pytest: () => 'Python not found: run with --python <path to python>',
  flutter: () => 'Flutter is not in the PATH of this computer',
  dart: () => 'Dart is not in the PATH of this computer',
  phpunit: (r) => `run composer install${r.dir ? ` in ${r.dir}/` : ''} (and check that php is in the PATH)`,
  pest: (r) => `run composer install${r.dir ? ` in ${r.dir}/` : ''} (and check that php is in the PATH)`,
  go: () => 'Go is not in the PATH of this computer',
  maven: () => 'Maven (mvn) is not in the PATH and the project has no mvnw',
  gradle: () => 'Gradle is not in the PATH and the project has no gradlew',
  dotnet: () => 'the .NET SDK (dotnet) is not in the PATH of this computer',
  cargo: () => 'Rust (cargo) is not in the PATH of this computer',
  ctest: () => 'CMake (cmake and ctest) is not in the PATH of this computer',
  make: () => 'make is not in the PATH of this computer',
  karma: (r) => `run npm install${r.dir ? ` in ${r.dir}/` : ''} (ng test needs the project's @angular/cli)`,
}
const notInstalled = (r) => NOT_INSTALLED[r.runner]?.(r) ?? `not installed: run npm install${r.dir ? ` in ${r.dir}/` : ''}`
const listArg = (args, name) => flag(args, name)?.split(',').map((f) => f.trim().replace(/\\/g, '/').replace(/^\.\//, '')).filter(Boolean) ?? null

// Roda os testes quando pedido (nunca sozinho). Banco de produção à vista: só com --confirm-db.
export async function testsRun(args) {
  const { root } = linkedProject()
  const { detectRunners, insideDir, productionDbSignals, runTests } = await import('./tests.mjs')
  // --python: o Python do projeto fora da pasta (ex.: um venv em outro lugar); fica guardado para as próximas rodadas.
  const pythonArg = flag(args, '--python')
  if (pythonArg) {
    const abs = path.resolve(process.cwd(), pythonArg)
    if (!fs.existsSync(abs)) throw new Error(`Could not find Python at ${pythonArg}.`)
    writeState(root, { python: abs })
  }
  const { runners } = detectRunners(root, { python: readState(root).python })
  const wanted = flag(args, '--runner')
  const chosen = pickRunners(runners, wanted)
  if (!chosen.length) throw new Error(wanted ? `${wanted} was not found in this project.` : 'No supported test runner (Vitest, Jest, Playwright, node --test, pytest, flutter test, dart test, PHPUnit or Pest) in this project or its subfolders.')
  const exclude = listArg(args, '--exclude') ?? []
  const signals = productionDbSignals(root, undefined, { exclude })
  if (signals.length && !args.includes('--confirm-db')) return refuseProductionDb(signals)
  const git = (a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', windowsHide: true }).stdout?.trim() || null
  const run = {
    files: listArg(args, '--files'),
    changed: args.includes('--changed'),
    wantCoverage: args.includes('--coverage'),
    minutes: Number(flag(args, '--timeout')),
    exclude,
    git,
    // Repositório sem commit: o git devolve o texto "HEAD"; só vale um hash de verdade.
    commit: /^[0-9a-f]{40}$/.test(git(['rev-parse', 'HEAD']) ?? '') ? git(['rev-parse', 'HEAD']) : null,
  }
  const results = []
  for (const info of chosen) {
    // --files de outra parte do projeto: este executor não tem o que rodar.
    if (run.files && !insideDir(info.dir, run.files).length) continue
    results.push(await runOneRunner(root, info, run, runTests))
  }
  return results
}

// Sem --runner: os executores que dá para rodar (com script, configuração ou pytest); se nenhum, todos os achados.
function pickRunners(runners, wanted) {
  if (wanted) return runners.filter((r) => r.runner === wanted)
  const runnable = runners.filter((r) => r.script || r.config || r.runner === 'pytest')
  return runnable.length ? runnable : runners
}

function refuseProductionDb(signals) {
  console.log('Did not run: the tests seem to use the real (production) database and may change or delete data.')
  for (const s of signals) console.log(`  - ${s}`)
  console.log('Ask the user. If they confirm, run again with --confirm-db. To leave those files out, use --exclude a,b. The safe way is to create a .env.test pointing to a test database.')
  process.exitCode = 2
}

// Alcance da rodada: só o que mudou, alguns arquivos ou tudo.
function testScope(changed, files) {
  if (changed) return 'changed'
  return files ? 'files' : 'all'
}

const SCOPE_NOTE = { changed: () => ' (only what changed)', files: (files) => ` (${files.length} file(s))`, all: () => '' }

// Roda um executor, manda o resultado ao painel e conta em poucas linhas.
async function runOneRunner(root, info, run, runTests) {
  const { runner, dir } = info
  const { files, changed, exclude, minutes } = run
  if (!['vitest', 'jest', 'playwright'].includes(runner) && changed) {
    console.log(`${runner === 'node' ? 'node --test' : runner} cannot run only what changed: running all of its tests.`)
  }
  const scope = testScope(changed, files)
  console.log(`Running ${runnerLabel(info)}${SCOPE_NOTE[scope](files)}…`)
  const coverage = run.wantCoverage && coverageReady(runner, info)
  const r = runTests(root, runner, { dir, python: info.python, changed, files, exclude, coverage, nodeArgs: info.args, ...(minutes > 0 ? { timeout: minutes * 60_000 } : {}) })
  const cov = coverage ? await coverageReport(root, runner, dir) : null
  const sent = await testsApi({
    action: 'run',
    runner,
    scope,
    commit: run.commit,
    branch: run.git(['rev-parse', '--abbrev-ref', 'HEAD']),
    durationMs: r.durationMs ?? null,
    error: r.error ?? null,
    cases: r.cases ?? [],
    coverage: cov,
    agent: AGENT,
    agentSessionId: AGENT_SESSION_ID ?? null,
  })
  const result = { runner: runnerLabel(info), passed: sent.passed, failed: sent.failed, error: r.error && !r.cases?.length ? r.error : null }
  if (result.error) {
    console.log(`  Did not finish: ${r.error}`)
    return result
  }
  console.log(`  ${sent.passed} passed, ${sent.failed} failed, ${sent.skipped} skipped${sent.todo ? `, ${sent.todo} todo` : ''}${sent.flaky ? `, ${sent.flaky} flaky` : ''} in ${((r.durationMs ?? 0) / 1000).toFixed(1)} s.`)
  for (const c of (r.cases ?? []).filter((x) => x.status === 'failed').slice(0, 10)) console.log(`  FAILED ${c.name}${c.file ? ` (${c.file})` : ''}\n    ${(c.message ?? '').split('\n')[0]}`)
  if (sent.closedErrors?.length) console.log(`  Errors closed because the test passed: ${sent.closedErrors.map((n) => `E-${n}`).join(', ')}`)
  if (cov) printCoverage(cov)
  return result
}

function printCoverage(cov) {
  const s = cov.session
  console.log(`  Project coverage: ${cov.total.pct ?? '-'}% of lines (${cov.total.covered} of ${cov.total.lines}).`)
  console.log(s.lines ? `  What changed since the session started: ${s.pct}% covered (${s.covered} of ${s.lines} lines)${s.pct >= (cov.total.pct ?? 0) ? ', not worse.' : ', below the rest of the project.'}` : '  What changed in this session has no lines the tests can run: coverage not affected.')
  for (const l of cov.lost.slice(0, 5)) console.log(`  Lost coverage without being touched: ${l.file} (${l.before} → ${l.now} covered lines)`)
}

// Pacote de contexto das skills "tests" e "tests-fix": guia, executores, última rodada, o que falha, lacunas de
// cobertura, funcionalidades e o mapa testes × funcionalidades.
export async function testsContext(args) {
  const { root } = linkedProject()
  const { detectRunners, productionDbSignals } = await import('./tests.mjs')
  const guide = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'tests', 'guide.md')
  const { runners, others } = detectRunners(root, { python: readState(root).python })
  const out = ['# Tests context', await contentLangNote(root), `Guide (read it first, with the Read tool): ${guide}`, '']
  out.push('## Runners', ...(runners.length ? runners.map((r) => `- ${runnerLabel(r)}${r.script ? ` (npm run ${r.script})` : ''}${r.installed ? '' : ` — ${notInstalled(r)}`}${r.runner === 'vitest' && !r.coverage ? ' — without the coverage tool (@vitest/coverage-v8)' : ''}`) : ['- none (Vitest, Jest, Playwright, node --test, pytest, flutter test, dart test, PHPUnit or Pest)']))
  if (others.length) out.push(`- also in the project, not read by Faundr: ${others.join(', ')}`)
  for (const s of productionDbSignals(root)) out.push(`- WARNING, production database: ${s}`)
  out.push('')
  try {
    const { tests, runs, cases } = await testsApi({ action: 'list' })
    const inv = tests?.inventory ?? {}
    out.push(`## Inventory`, `${inv.testFiles ?? 0} test files, about ${inv.cases ?? 0} tests, ${inv.e2eFiles ?? 0} end-to-end.`, '')
    out.push('## Last runs', ...(runs.length ? runs.slice(0, 3).map((r) => `- ${r.created_at} ${r.runner}: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped${r.error ? ` (${r.error})` : ''}`) : ['- none yet']), '')
    if (cases.length) {
      out.push('## Failing or flaky')
      for (const c of cases) out.push(`- ${c.status === 'failed' ? 'FAILING' : 'FLAKY'} ${c.name}${c.file ? ` (${c.file})` : ''}${c.message ? `\n    ${c.message.split('\n').slice(0, 3).join('\n    ')}` : ''}`)
      out.push('')
    }
    const cov = tests?.coverage
    if (cov) {
      out.push(`## Coverage (${cov.at}): project ${cov.total?.pct ?? '-'}%, what changed ${cov.session?.pct ?? '-'}%`)
      for (const f of (cov.session?.files ?? []).filter((x) => x.uncovered).slice(0, 10)) out.push(`- changed and untested: ${f.file} lines ${f.uncovered}`)
      for (const f of (cov.files ?? []).filter((x) => x.covered === 0).slice(0, 10)) out.push(`- no tests: ${f.file}`)
      out.push('')
    }
    const { allFeatures, features } = await memoryApi({ action: 'board', featureId: null })
    const titles = [...new Set((allFeatures ?? features ?? []).map((f) => f.title))].slice(0, 60)
    out.push("## Project features (for the map and to ask what can't break)", ...(titles.length ? titles.map((title) => `- ${title}`) : ['- (none recorded)']), '')
    const map = tests?.features ?? []
    out.push('## Tests × features map already recorded', ...(map.length ? map.map((m) => `- ${m.feature}: ${m.status}${m.critical ? " (can't break)" : ''}${m.tests?.length ? ` — ${m.tests.join(', ')}` : ''}`) : ['- empty']), '')
  } catch (err) {
    out.push(`(could not read the dashboard data: ${err.message})`)
  }
  if (args.includes('--fix')) out.push('Fix mode: work on the FAILING and FLAKY tests above (or on what the user pointed to).')
  console.log(out.join('\n'))
}

export async function testsMap(args) {
  const feature = textArg(args)
  if (!feature) throw new Error('usage: faundr tests-map "<feature>" [--status coberta|parcial|sem-testes] [--tests "a.test.ts,b.test.ts"] [--critical] [--note "..."] [--remove]\n  (--status: coberta = covered, parcial = partial, sem-testes = no tests)')
  const r = await testsApi({
    action: 'map',
    feature,
    status: flag(args, '--status') ?? undefined,
    tests: flag(args, '--tests')?.split(',').map((t) => t.trim()).filter(Boolean),
    critical: firstOf([[args.includes('--critical'), true], [args.includes('--not-critical'), false]], undefined),
    note: flag(args, '--note') ?? undefined,
    remove: args.includes('--remove'),
  })
  console.log(r.removed ? `Removed from the map: ${r.removed}` : `Map: ${r.feature} → ${r.status}${r.critical ? " (can't break)" : ''}${r.tests.length ? `, tests: ${r.tests.join(', ')}` : ''}`)
}

// Mutação (opcional, só quando pedida): nos arquivos que a sessão mexeu, com orçamento de tempo e suíte verde.
export async function testsMutation(args) {
  const { root } = linkedProject()
  const { detectRunners, productionDbSignals } = await import('./tests.mjs')
  const { mutateTargets, mutationFindings, mutationSetup, runMutation } = await import('./mutation.mjs')
  const { changedLines } = await import('./coverage.mjs')
  // O Stryker roda a partir da raiz: só os executores dela.
  const runners = detectRunners(root).runners.filter((r) => !r.dir)
  const pick = flag(args, '--runner')
  const runner = pick ? runners.find((r) => r.runner === pick) : (runners.find((r) => r.runner === 'vitest' || r.runner === 'jest') ?? runners.find((r) => r.runner === 'node'))
  if (!runner || runner.runner === 'pytest') throw new Error('Mutation testing needs JavaScript unit tests at the project root (Vitest, Jest or node --test); Playwright (browser) and pytest do not work.')
  const setup = mutationSetup(root, runner.runner)
  if (setup.incompatible) {
    console.log(`Did not run: ${setup.incompatible}`)
    process.exitCode = 2
    return
  }
  if (!setup.ready) {
    console.log(`Did not run: Stryker is missing from the project. Faundr does not install it by itself; ask the user's OK for: ${setup.install}`)
    process.exitCode = 2
    return
  }
  const signals = productionDbSignals(root)
  if (signals.length && !args.includes('--confirm-db')) {
    console.log('Did not run: the tests seem to use the production database and mutation testing runs the suite many times.')
    for (const s of signals) console.log(`  - ${s}`)
    console.log('Ask the user; with their OK, run again with --confirm-db.')
    process.exitCode = 2
    return
  }
  // Suíte verde: o Stryker não roda com teste falhando (e o resultado não faria sentido).
  const { runs } = await testsApi({ action: 'list' })
  const last = runs.find((r) => r.runner === runner.runner)
  if (last?.failed > 0) {
    console.log(`Did not run: the last ${runner.runner} run has ${last.failed} failing test(s). Fix them first ("tests-fix" skill) and run again.`)
    process.exitCode = 2
    return
  }
  const baseState = readState(root).qualityBase
  const sid = AGENT_SESSION_ID ?? null
  const base = baseState?.session === sid && baseState?.head ? baseState.head : 'HEAD'
  const files = flag(args, '--files')?.split(',').map((f) => f.trim()).filter(Boolean) ?? null
  const targets = mutateTargets(changedLines(root, base), files)
  if (!targets.length) return console.log('Nothing to mutate: this session did not change logic files. For a specific file: faundr tests-mutation --files src/file.ts')
  const budget = Number(flag(args, '--budget')) || 5
  console.log(`Mutation testing with ${runner.runner} on ${targets.length} snippet(s), budget of ${budget} min: ${targets.join(', ')}`)
  const r = runMutation(root, { runner: runner.runner, targets, budgetMinutes: budget, testCommand: runner.script ? `npm run ${runner.script}` : null })
  if (r.error) return console.log(`Did not finish: ${r.error}`)
  const findings = mutationFindings(r.escaped)
  const sent = await testsApi({
    action: 'mutation',
    summary: { runner: runner.runner, counts: r.counts, score: r.score, coveredScore: r.coveredScore, durationMs: r.durationMs },
    files: targets,
    findings,
    agent: AGENT,
    agentSessionId: sid,
  })
  const c = r.counts
  console.log(`In ${(r.durationMs / 1000).toFixed(0)} s: ${c.killed + c.timeout} defects caught by the tests, ${c.survived} escaped, ${c.noCoverage} on lines without tests.`)
  console.log(`Score: ${r.score ?? '-'}% of all planted defects; ${r.coveredScore ?? '-'}% where tests already exist.`)
  console.log(`Dashboard: ${sent.added} new, ${sent.fixed} now caught by the tests.`)
  for (const f of findings.slice(0, 10)) console.log(`  ${f.file}:${f.line} ${f.detail}`)
}

export async function testsIgnore(args) {
  const text = textArg(args)
  const r = (flag(args, '--reason') ?? '').toLowerCase()
  const reason = firstOf([[/equival/.test(r), 'equivalente'], [/falso|false/.test(r), 'falso-alarme'], [/depois|later/.test(r), 'depois']], null)
  if (!text || !reason) throw new Error('usage: faundr tests-ignore T-<n> --reason equivalent|false-alarm|later --note "why"')
  const done = await testsApi({ action: 'ignore', query: text, reason, note: flag(args, '--note') })
  console.log(`T-${done.ref} ignored: ${done.title}`)
}

export async function testsShow(args = []) {
  const ref = textArg(args)
  if (/^T-?\d+$/i.test(ref ?? '')) {
    const f = await testsApi({ action: 'get', query: ref })
    console.log(`T-${f.ref} ${f.title} (${{ open: 'open', fixed: 'now caught by the tests', ignored: 'ignored' }[f.status]})`)
    console.log(`File: ${f.file}${f.line ? `:${f.line}` : ''} · kind of damage: ${f.mutator}`)
    console.log(`What escaped: ${f.detail}`)
    if (f.original) console.log(`Code: ${f.original}`)
    if (f.replacement) console.log(`Damage no test noticed: ${f.replacement}`)
    return console.log(`To prove the new test: faundr tests-mutation --files ${f.file}${f.line ? `:${f.line}-${f.line}` : ''}`)
  }
  const { tests, runs, cases } = await testsApi({ action: 'list' })
  const inv = tests?.inventory ?? {}
  console.log(`Tests: ${inv.testFiles ?? 0} files, about ${inv.cases ?? 0} tests; runners: ${(inv.runners ?? []).map((r) => r.runner).join(', ') || '-'}.`)
  if (!runs.length) return console.log('No runs recorded yet. Run: faundr tests-run')
  for (const r of runs.slice(0, 3))
    console.log(`${r.created_at} ${r.runner}${r.scope !== 'all' ? ` (${r.scope === 'changed' ? 'only what changed' : 'files'})` : ''}: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped${r.error ? ` · ${r.error}` : ''}`)
  for (const c of cases) console.log(`${c.status === 'failed' ? 'FAILING' : 'FLAKY'} ${c.name}${c.file ? ` (${c.file})` : ''}`)
}
