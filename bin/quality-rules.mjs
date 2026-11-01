// Qualidade do código sem IA (fase 1): falha silenciosa, tipos fracos, complexidade, código demais, limpeza,
// testes pulados e instruções da IA quebradas. Critérios do Ponytail (MIT) e dos plugins oficiais da Anthropic
// (Apache-2.0), destilados em docs/research/qualidade-proposta.md. A leitura do código é pela árvore de sintaxe
// (tree-sitter, em dist/graph.mjs); aqui ficam a lista de arquivos, as regras do projeto inteiro e os textos.
//
// Um achado por arquivo por regra (com as linhas no detalhe) ou um por projeto. Exceção no código: comentário
// `faundr-ignore <regra>: motivo` na linha ou na anterior; `faundr-ignore-file <regra>` vale para o arquivo.

import { spawnSync } from 'node:child_process'
import { analyzeQuality, qualityGrammar, unusedCode } from '../dist/graph.mjs'
import { ignoreSet } from './design-rules.mjs'
import { projectFiles } from './security.mjs'
import { functionList, houseText, lineList, TEXT } from './quality-texts.mjs'
import { TEST_PATH, GENERATED, read } from './quality-common.mjs'
import { entryPoints, duplicates, projectTools, dockerfileRules, styleRules, projectRules, oldTodos, performanceRules } from './quality-project.mjs'
import { memoryRules, houseRules, shortcutsIn } from './quality-house.mjs'
export { memoryRules, houseRules, shortcutsIn } from './quality-house.mjs'

// Linha só de comentário, por linguagem (não conta como linha de código).
const COMMENT_LINE = { js: /^\s*(\/\/|\*|\/\*)/, '.py': /^\s*#/, '.php': /^\s*(\/\/|#|\*|\/\*)/ }
const GENERATED_HEADER = /^(\/\/|\/\*)[^\n]*(@generated|auto-?generated|gerado por|do not edit|não edite)/i
// Telas: onde console.log é esquecimento (em CLI e servidor ele é a saída normal).
const UI_FILE = /\.(tsx|jsx|vue|svelte|astro|html?)$/
const SERVER_PATH = /(^|\/)(api|server|bin|scripts|cli|functions|workers?)(\/|$)/

// kind: grupo que o painel mostra; severity: a gravidade pela régua (não pelo modelo).
export const RULES = {
  'falha/catch-vazio': { kind: 'failure', severity: 'medium' },
  'falha/catch-so-loga': { kind: 'failure', severity: 'low' },
  'falha/catch-devolve-nulo': { kind: 'failure', severity: 'low' },
  'falha/mock-em-producao': { kind: 'failure', severity: 'high' },
  'falha/unwrap': { kind: 'failure', severity: 'low' },
  'tipos/any': { kind: 'types', severity: 'low' },
  'tipos/as-any': { kind: 'types', severity: 'medium' },
  'tipos/ts-ignore-sem-motivo': { kind: 'types', severity: 'medium' },
  'tipos/eslint-disable-sem-motivo': { kind: 'types', severity: 'low' },
  'tipos/non-null-em-excesso': { kind: 'types', severity: 'low' },
  'complexidade/funcao': { kind: 'complexity', severity: 'medium' },
  'complexidade/funcao-longa': { kind: 'complexity', severity: 'low' },
  'complexidade/aninhamento': { kind: 'complexity', severity: 'medium' },
  'complexidade/ternario-aninhado': { kind: 'complexity', severity: 'low' },
  'complexidade/arquivo-grande': { kind: 'complexity', severity: 'low' },
  'demais/dependencia-dispensavel': { kind: 'excess', severity: 'medium' },
  'demais/dependencia-sem-uso': { kind: 'excess', severity: 'low' },
  'demais/codigo-comentado': { kind: 'excess', severity: 'low' },
  'limpeza/console-log': { kind: 'cleanup', severity: 'low' },
  'limpeza/debugger': { kind: 'cleanup', severity: 'medium' },
  'limpeza/print-esquecido': { kind: 'cleanup', severity: 'low' },
  'limpeza/todo-antigo': { kind: 'cleanup', severity: 'low' },
  'testes/only': { kind: 'tests', severity: 'high' },
  'testes/pulado': { kind: 'tests', severity: 'low' },
  'testes/sem-conferencia': { kind: 'tests', severity: 'medium' },
  'testes/espera-fixa': { kind: 'tests', severity: 'medium' },
  'testes/hora-real': { kind: 'tests', severity: 'low' },
  'instrucoes/arquivo-inexistente': { kind: 'instructions', severity: 'medium' },
  'instrucoes/script-inexistente': { kind: 'instructions', severity: 'medium' },
  'limpeza/atalho-sem-prazo': { kind: 'cleanup', severity: 'low' },
  'docker/imagem-sem-versao': { kind: 'failure', severity: 'medium' },
  'docker/run-cd': { kind: 'cleanup', severity: 'low' },
  'docker/apt-sem-limpeza': { kind: 'excess', severity: 'low' },
  'css/important-em-excesso': { kind: 'complexity', severity: 'low' },
  'css/regra-vazia': { kind: 'cleanup', severity: 'low' },
  'css/aninhamento-fundo': { kind: 'complexity', severity: 'low' },
  'morto/arquivo-orfao': { kind: 'excess', severity: 'low' },
  'morto/export-sem-uso': { kind: 'excess', severity: 'low', ownLines: true },
  'demais/duplicado': { kind: 'excess', severity: 'medium', ownLines: true },
  'ts/erro-de-tipo': { kind: 'tool', severity: 'medium', ownLines: true },
  'eslint/erro': { kind: 'tool', severity: 'medium', ownLines: true },
  'eslint/aviso': { kind: 'tool', severity: 'low', ownLines: true },
  'desempenho/consulta-sem-limite': { kind: 'performance', severity: 'medium' },
  'desempenho/consulta-em-laco': { kind: 'performance', severity: 'medium' },
  'desempenho/fk-sem-indice': { kind: 'performance', severity: 'low' },
}

function makeCollector() {
  const hits = new Map()
  const ignoreCache = new Map()
  return {
    hits,
    ignored: 0,
    /** `text`: o arquivo, para respeitar o faundr-ignore (as regras por arquivo já filtram antes). */
    add(rule, file, line, ctx, text) {
      if (text) {
        if (!ignoreCache.has(file)) ignoreCache.set(file, ignoreSet(text))
        if (ignoreCache.get(file).ignored(rule, line)) return void this.ignored++
      }
      const key = `${rule}|${file ?? ''}`
      const h = hits.get(key) ?? { rule, file, lines: [], ctx, all: [] }
      if (line && !h.lines.includes(line)) h.lines.push(line)
      if (ctx) h.all.push({ line, ...ctx })
      hits.set(key, h)
    },
  }
}

/** Arquivos de código que entram na checagem (sem gerados, minificados e pastas de build). */
export function qualityFiles(root) {
  const { files } = projectFiles(root)
  // Templates Blade (.blade.php) são HTML com diretivas, não código PHP para medir.
  return files.filter((f) => qualityGrammar(f) && !GENERATED.test(f) && !/\.blade\.php$/.test(f))
}

/**
 * Roda as regras. `only`: só esses arquivos (checagem parcial: as regras do projeto inteiro, o código sem uso,
 * os duplicados e as ferramentas do projeto ficam de fora). `tools`: roda o tsc e o ESLint do projeto.
 */
export async function runQuality(root, { only = null, history = true, tools = true } = {}) {
  const started = Date.now()
  const all = qualityFiles(root)
  const files = only ? all.filter((f) => only.includes(f)) : all
  const c = makeCollector()
  const errors = []
  const parsed = await analyzeFiles(root, files, c, errors)

  const scopes = [{ kind: 'code', files: only ? files : null }]
  const stats = { files: files.length, lines: parsed.lines, ignored: parsed.ignored }
  if (!only) {
    wholeProject(root, all, parsed, c, { history, errors })
    scopes.push({ kind: 'project', files: null })
    stats.ranking = ranking(parsed.metrics)
    stats.shortcuts = withBlame(root, parsed.shortcuts)
    if (tools) {
      const ran = projectTools(root, c, errors)
      if (ran.length) scopes.push({ kind: 'tool', files: null, tools: ran })
      stats.tools = ran
    }
  }
  return { findings: toFindings(c), scopes, stats: { ...stats, ignored: stats.ignored + c.ignored, ms: Date.now() - started }, errors }
}

/** Lê cada arquivo pela árvore de sintaxe: achados por arquivo, medidas das funções e o que importa/exporta. */
async function analyzeFiles(root, files, c, errors) {
  const out = { lines: 0, ignored: 0, metrics: new Map(), modules: new Map(), texts: new Map(), shortcuts: [] }
  const house = [...houseRules(root), ...memoryRules(root)]
  for (const rel of files) {
    const text = read(root, rel)
    if (!text || GENERATED_HEADER.test(text.slice(0, 300))) continue
    const ign = ignoreSet(text)
    const add = (rule, line, ctx) => (ign.ignored(rule, line) ? out.ignored++ : c.add(rule, rel, line, ctx))
    const test = TEST_PATH.test(rel)
    let result
    try {
      result = await analyzeQuality(rel, text, { test })
    } catch (err) {
      errors.push(`${rel}: ${err.message}`)
      continue
    }
    for (const h of result.hits) if (keepHit(h, rel)) add(h.rule, h.line, h.ctx)
    for (const r of house) if (r.files.test(rel)) for (const line of r.lines(text)) add(r.rule, line, r.ctx)
    for (const s of shortcutsIn(text)) {
      out.shortcuts.push({ file: rel, ...s })
      if (!s.trigger) add('limpeza/atalho-sem-prazo', s.line, { text: s.text.slice(0, 80) })
    }
    const commentLine = COMMENT_LINE[rel.slice(rel.lastIndexOf('.'))] ?? COMMENT_LINE.js
    const codeLines = text.split('\n').filter((l) => l.trim() && !commentLine.test(l)).length
    out.lines += codeLines
    out.texts.set(rel, text)
    out.modules.set(rel, result.module)
    if (test) {
      realClockRule(text, add)
      continue
    }
    out.metrics.set(rel, { lines: codeLines, functions: result.functions })
    if (codeLines > 600) add('complexidade/arquivo-grande', null, { lines: codeLines })
  }
  return out
}

// Achados da árvore de sintaxe que valem para este arquivo.
function keepHit(h, rel) {
  if (h.rule === 'limpeza/console-log' && (!UI_FILE.test(rel) || SERVER_PATH.test(rel))) return false
  // Dart: print é esquecimento no app (lib/); em bin/ e tool/ é a saída normal do programa.
  if (h.rule === 'limpeza/print-esquecido' && rel.endsWith('.dart') && !/(^|\/)lib\//.test(rel)) return false
  return true
}

// Teste com data e hora reais sem relógio falso: o teste muda de resultado conforme o dia.
function realClockRule(text, add) {
  const clock = text.search(/\bnew Date\(\s*\)|\bDate\.now\(\)/)
  if (clock >= 0 && !/useFakeTimers|setSystemTime|mock\.timers|clock\.install|page\.clock|sinon\.useFakeTimers/.test(text))
    add('testes/hora-real', text.slice(0, clock).split('\n').length, {})
}

/** O que só dá para ver olhando o projeto inteiro: pacotes, instruções da IA, TODOs, código sem uso, duplicados. */
function wholeProject(root, all, parsed, c, { history, errors }) {
  projectRules(root, all, c)
  // O Dockerfile e as folhas de estilo não são código para a árvore de sintaxe: vêm da lista completa do projeto.
  const everything = projectFiles(root).files
  dockerfileRules(root, everything, c)
  styleRules(root, everything, c)
  performanceRules(root, parsed.texts, c)
  if (history) {
    try {
      oldTodos(root, c)
    } catch (err) {
      errors.push(`TODOs: ${err.message}`)
    }
  }
  const entry = entryPoints(root)
  const { orphans, exports } = unusedCode(root, parsed.modules, parsed.texts, (rel) => entry(rel) || TEST_PATH.test(rel))
  for (const rel of orphans) c.add('morto/arquivo-orfao', rel, null, {}, parsed.texts.get(rel))
  for (const e of exports) c.add('morto/export-sem-uso', e.file, e.line, { name: e.name }, parsed.texts.get(e.file))
  for (const d of duplicates(parsed.texts)) c.add('demais/duplicado', d.file, d.line, d, parsed.texts.get(d.file))
}

// Os 10 arquivos com mais caminhos possíveis somados (onde mexer dá mais trabalho e mais risco).
function ranking(metrics) {
  return [...metrics]
    .map(([file, m]) => {
      const worst = m.functions.reduce((a, b) => (b.complexity > (a?.complexity ?? 0) ? b : a), null)
      return {
        file,
        lines: m.lines,
        functions: m.functions.length,
        complexity: m.functions.reduce((s, f) => s + f.complexity, 0),
        worst: worst ? { name: worst.name, complexity: worst.complexity, line: worst.line } : null,
      }
    })
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 10)
}

function toFindings(c) {
  const findings = []
  for (const h of c.hits.values()) {
    const meta = RULES[h.rule] ?? { kind: 'instructions', severity: h.ctx?.severity ?? 'medium' }
    const [title, detail, impact, fix] = (TEXT[h.rule] ?? houseText)(h.ctx ?? {}, Math.max(1, h.lines.length), h.all)
    const severity = h.severity ?? (h.rule === 'complexidade/funcao' && h.all.some((x) => x.complexity >= 40) ? 'high' : meta.severity)
    // Complexidade: a lista de funções com o número de cada uma, da pior para a melhor.
    const measure = { 'complexidade/funcao': 'complexity', 'complexidade/funcao-longa': 'lines', 'complexidade/aninhamento': 'depth' }[h.rule]
    const list =
      measure && h.all.length > 1
        ? functionList([...h.all].sort((a, b) => b[measure] - a[measure]).slice(0, 10), measure)
        : ''
    findings.push({
      kind: meta.kind,
      rule_id: h.rule,
      severity,
      title,
      detail: `${detail}${list || (meta.ownLines ? '' : lineList(h.lines))}`.slice(0, 3000),
      impact,
      fix,
      file: h.file ?? null,
      line: h.lines[0] ?? null,
      lines: h.lines.slice(0, 200),
      fingerprint: `q:${h.rule}|${h.file ?? ''}`,
    })
  }
  return findings
}

// Dono e idade de cada atalho pelo git blame (até 100 atalhos).
function withBlame(root, shortcuts) {
  const now = Date.now() / 1000
  // faundr: só os 100 primeiros atalhos ganham dono e idade, paginar quando algum projeto passar disso
  return shortcuts.slice(0, 100).map((s) => {
    const blame = spawnSync('git', ['blame', '--porcelain', '-L', `${s.line},${s.line}`, '--', s.file], { cwd: root, encoding: 'utf8', windowsHide: true })
    const time = Number(blame.stdout?.match(/^author-time (\d+)/m)?.[1])
    const author = blame.stdout?.match(/^author (.+)$/m)?.[1]
    return { ...s, author: author && author !== 'Not Committed Yet' ? author : null, days: time ? Math.max(0, Math.floor((now - time) / 86400)) : 0 }
  })
}
