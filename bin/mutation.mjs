// Seção Testes (fase 4, opcional): teste de mutação. O Stryker estraga o código de propósito (troca > por >=,
// apaga um bloco, esvazia um texto) e vê se algum teste percebe. Defeito que ninguém percebe vira um achado T-n,
// escrito para quem não programa. Só roda quando pedido, só nos arquivos que a sessão mexeu, com orçamento de
// tempo e com a suíte verde. Conceitos e formato em docs/research/testes-mutacao-cobertura.md (Stryker, Apache-2.0).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join('.faundr', 'tests', 'mutation')
const BIN = 'node_modules/@stryker-mutator/core/bin/stryker.js'
const RUNNER_PLUGIN = { vitest: '@stryker-mutator/vitest-runner', jest: '@stryker-mutator/jest-runner' }
const CODE = /\.(m?[jt]sx?|cjs)$/
const NOT_LOGIC = /(^|\/)(node_modules|dist|build|\.faundr|coverage)\/|\.(test|spec)\.|\.d\.ts$|\.config\.|(^|\/)(routes|pages|app)\/.*\.(tsx|jsx)$/

const majorOf = (v) => Number(String(v ?? '').replace(/^[^\d]*/, '').split('.')[0]) || null
const installedVersion = (root, pkg) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'node_modules', pkg, 'package.json'), 'utf8'))
  } catch {
    // Pacote não instalado.
    return null
  }
}

/**
 * O que falta para rodar a mutação com este executor (o Faundr nunca instala sozinho) e se as versões combinam:
 * o plugin do Stryker para Vitest 4 com o Vitest 5 roda sem erro, mas não liga os defeitos (tudo "escapa"),
 * então uma versão mais nova que a testada pelo plugin é recusada em vez de dar resultado falso.
 */
export function mutationSetup(root, runner) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const need = ['@stryker-mutator/core', RUNNER_PLUGIN[runner]].filter((p) => p && !deps[p])
  if (need.length || !fs.existsSync(path.join(root, BIN))) return { ready: false, install: `npm install -D ${(need.length ? need : ['@stryker-mutator/core']).join(' ')}` }
  const plugin = RUNNER_PLUGIN[runner] ? installedVersion(root, RUNNER_PLUGIN[runner]) : null
  const tested = majorOf(plugin?.devDependencies?.[runner])
  const mine = majorOf(installedVersion(root, runner)?.version)
  if (tested && mine && mine > tested)
    return {
      ready: false,
      incompatible: `o plugin do Stryker para ${runner} (versão ${plugin.version}) foi feito para o ${runner} ${tested} e o projeto usa o ${mine}: os resultados sairiam falsos (todo defeito "escaparia"). Espere uma versão nova do plugin (npm install -D ${RUNNER_PLUGIN[runner]}@latest) ou rode com o ${runner} ${tested}.`,
    }
  return { ready: true, install: null }
}

/** Arquivos de lógica que a sessão mudou, com as faixas de linhas mudadas (o Stryker aceita arquivo:início-fim). */
export function mutateTargets(changed, files = null) {
  if (files?.length) return files
  const out = []
  for (const [file, lines] of changed) {
    if (!CODE.test(file) || NOT_LOGIC.test(file) || !lines.size) continue
    const sorted = [...lines].sort((a, b) => a - b)
    out.push(`${file}:${sorted[0]}-${sorted[sorted.length - 1]}`)
  }
  return out.slice(0, 20)
}

/** Roda o Stryker com uma configuração própria do Faundr (não mexe na do projeto) e lê o relatório. */
export function runMutation(root, { runner, targets, budgetMinutes = 5, testCommand = null }) {
  const dir = path.join(root, DIR)
  fs.mkdirSync(dir, { recursive: true })
  const rel = (p) => path.join(DIR, p).split(path.sep).join('/')
  const config = {
    $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
    mutate: targets,
    testRunner: runner === 'vitest' || runner === 'jest' ? runner : 'command',
    ...(runner === 'vitest' || runner === 'jest' ? {} : { commandRunner: { command: testCommand ?? 'npm test' }, coverageAnalysis: 'off' }),
    reporters: ['json'],
    jsonReporter: { fileName: rel('mutation.json') },
    incremental: true,
    // Cache por versão do executor: resultado de uma versão incompatível nunca é reaproveitado.
    incrementalFile: rel(`incremental-${runner}-${installedVersion(root, runner === 'node' ? '@stryker-mutator/core' : runner)?.version ?? 'x'}.json`),
    tempDirName: rel('.stryker-tmp'),
    cleanTempDir: 'always',
    logLevel: 'error',
    fileLogLevel: 'off',
    // Nunca derruba a rodada pela nota: quem decide é o dono, olhando o painel.
    thresholds: { high: 80, low: 60, break: null },
  }
  const configFile = path.join(dir, 'stryker.config.json')
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2))
  fs.rmSync(path.join(dir, 'mutation.json'), { force: true })
  const started = Date.now()
  const r = spawnSync(process.execPath, [path.join(root, BIN), 'run', rel('stryker.config.json')], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: budgetMinutes * 60_000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  })
  const durationMs = Date.now() - started
  let report = null
  try {
    report = JSON.parse(fs.readFileSync(path.join(dir, 'mutation.json'), 'utf8'))
  } catch {
    // Sem relatório: a rodada foi interrompida (orçamento) ou o Stryker falhou antes.
  }
  if (!report) {
    const reason = r.error?.code === 'ETIMEDOUT' ? `passou do orçamento de ${budgetMinutes} min (o modo incremental guarda o que já rodou; rode de novo para continuar)` : (r.stderr || r.stdout || '').split('\n').find((l) => /error|erro|failed/i.test(l))?.trim().slice(0, 300) || `o Stryker terminou sem relatório (código ${r.status})`
    return { durationMs, error: reason }
  }
  return { durationMs, ...readReport(report, root) }
}

const OK = new Set(['Killed', 'Timeout'])
const COUNTED = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage'])

/** Contas do relatório e um achado por defeito que escapou (sobreviveu ou nenhum teste passou por ali). */
export function readReport(report, root) {
  const counts = { killed: 0, timeout: 0, survived: 0, noCoverage: 0, ignored: 0, errors: 0 }
  const escaped = []
  for (const [file, data] of Object.entries(report.files ?? {})) {
    const relFile = path.relative(root, path.resolve(root, file)).split(path.sep).join('/')
    const lines = String(data.source ?? '').split('\n')
    for (const m of data.mutants ?? []) {
      if (m.status === 'Killed') counts.killed++
      else if (m.status === 'Timeout') counts.timeout++
      else if (m.status === 'Survived') counts.survived++
      else if (m.status === 'NoCoverage') counts.noCoverage++
      else if (m.status === 'Ignored') counts.ignored++
      else counts.errors++
      if (m.status !== 'Survived' && m.status !== 'NoCoverage') continue
      const line = m.location?.start?.line ?? null
      escaped.push({
        file: relFile,
        line,
        mutator: m.mutatorName,
        replacement: String(m.replacement ?? '').slice(0, 200),
        original: line ? (lines[line - 1] ?? '').trim().slice(0, 200) : '',
        noCoverage: m.status === 'NoCoverage',
      })
    }
  }
  const valid = counts.killed + counts.timeout + counts.survived + counts.noCoverage
  const covered = counts.killed + counts.timeout + counts.survived
  const caught = counts.killed + counts.timeout
  return {
    counts,
    // Nota geral: dos defeitos plantados, quantos algum teste pegou. "Onde existe teste": só os que algum teste visita.
    score: valid ? Math.round((caught / valid) * 1000) / 10 : null,
    coveredScore: covered ? Math.round((caught / covered) * 1000) / 10 : null,
    escaped: escaped.slice(0, 500),
  }
}

// Frase de leigo por tipo de defeito: o que o teste deixou passar.
const PHRASE = {
  EqualityOperator: (e) => `ninguém testou o caso exatamente no limite: trocar a comparação para "${e.replacement}" não fez nenhum teste falhar`,
  ConditionalExpression: (e) => `a condição pode ser trocada por "${e.replacement}" (sempre verdadeira ou sempre falsa) e nenhum teste percebe`,
  LogicalOperator: (e) => `trocar "e" por "ou" (ou o contrário) na condição não fez nenhum teste falhar ("${e.replacement}")`,
  ArithmeticOperator: (e) => `a conta pode ser feita errada ("${e.replacement}") e nenhum teste percebe`,
  BlockStatement: () => 'o trecho pode ser apagado inteiro e nenhum teste percebe: o que ele faz não é conferido',
  StringLiteral: (e) => `o texto pode virar ${e.replacement === '""' ? 'vazio' : `"${e.replacement}"`} e nenhum teste percebe`,
  BooleanLiteral: (e) => `inverter verdadeiro e falso ("${e.replacement}") não fez nenhum teste falhar`,
  ArrayDeclaration: () => 'a lista pode virar vazia e nenhum teste percebe',
  ObjectLiteral: () => 'o objeto pode virar vazio e nenhum teste percebe',
  ArrowFunction: () => 'a função pode não devolver nada e nenhum teste percebe',
  MethodExpression: (e) => `trocar o método por "${e.replacement}" não fez nenhum teste falhar`,
  UnaryOperator: (e) => `trocar o sinal ("${e.replacement}") não fez nenhum teste falhar`,
  UpdateOperator: (e) => `trocar o incremento ("${e.replacement}") não fez nenhum teste falhar`,
  AssignmentOperator: (e) => `trocar a atribuição ("${e.replacement}") não fez nenhum teste falhar`,
  OptionalChaining: () => 'tirar a proteção contra valor vazio (?.) não fez nenhum teste falhar: ninguém testou o caso sem o dado',
  Regex: (e) => `a expressão regular pode virar ${e.replacement} e nenhum teste percebe`,
  CallExpression: () => 'a chamada de função pode ser anulada e nenhum teste percebe',
}

/** Achados T-n no formato da API (um por defeito; identidade estável sem depender do número da linha mudar pouco). */
export function mutationFindings(escaped) {
  return escaped.map((e) => {
    const phrase = (PHRASE[e.mutator] ?? ((x) => `a troca "${x.replacement}" (${x.mutator}) não fez nenhum teste falhar`))(e)
    return {
      kind: e.noCoverage ? 'no_coverage' : 'survived',
      file: e.file,
      line: e.line,
      mutator: e.mutator,
      replacement: e.replacement,
      original: e.original,
      title: e.noCoverage ? `Nenhum teste passa por aqui (linha ${e.line})` : `Defeito que escapou na linha ${e.line}`,
      detail: e.noCoverage ? `Nenhum teste executa esta linha: ela pode quebrar de qualquer jeito sem ninguém saber. ${capital(phrase)}.` : `${capital(phrase)}.`,
      fingerprint: `mut|${e.file}|${e.mutator}|${e.original}|${e.replacement}`.slice(0, 600),
    }
  })
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1)
