// Qualidade do código sem IA (fase 1): falha silenciosa, tipos fracos, complexidade, código demais, limpeza,
// testes pulados e instruções da IA quebradas. Critérios do Ponytail (MIT) e dos plugins oficiais da Anthropic
// (Apache-2.0), destilados em docs/research/qualidade-proposta.md. A leitura do código é pela árvore de sintaxe
// (tree-sitter, em dist/graph.mjs); aqui ficam a lista de arquivos, as regras do projeto inteiro e os textos.
//
// Um achado por arquivo por regra (com as linhas no detalhe) ou um por projeto. Exceção no código: comentário
// `faundr-ignore <regra>: motivo` na linha ou na anterior; `faundr-ignore-file <regra>` vale para o arquivo. Vale
// também para o que o tsc e o ESLint acusam, para a chave estrangeira sem índice (comentário no SQL) e para as
// instruções da IA (comentário no próprio .md). Pacotes: no package.json, "faundr": { "ignore": { "<regra>": ["pacote"] } }.

import path from 'node:path'
import { analyzeQuality, qualityGrammar, unusedCode } from '../dist/graph.mjs'
import { ignoreSet } from './design-rules.mjs'
import { projectFiles } from './security.mjs'
import { functionList, houseText, lineList, TEXT } from './quality-texts.mjs'
import { TEST_PATH, TEST_SUPPORT, GENERATED, exists, read } from './quality-common.mjs'
import { entryPoints, duplicates, projectTools, toolsCovered, dockerfileRules, styleRules, projectRules, oldTodos, performanceRules } from './quality-project.mjs'
import { blameLines, insideGit } from './quality-git.mjs'
import { memoryRules, houseRules, shortcutsIn } from './quality-house.mjs'
import { bugFindings } from './bug-rules.mjs'
import { faundrIgnore, ignoredBy } from './parts.mjs'
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
  // Defeitos da varredura de 10/11/2026 (bug-rules.mjs).
  'falha/limite-acima-de-1000': { kind: 'failure', severity: 'medium' },
  'falha/lista-cortada-em-1000': { kind: 'failure', severity: 'medium' },
  'falha/json-gravado-por-cima': { kind: 'failure', severity: 'medium' },
  'falha/caminho-do-modulo': { kind: 'failure', severity: 'medium' },
  'falha/rede-sem-prazo': { kind: 'failure', severity: 'low' },
  'falha/promessa-solta': { kind: 'failure', severity: 'high' },
  'falha/erro-vira-lista-vazia': { kind: 'failure', severity: 'low' },
  'falha/tamanho-sem-conferir': { kind: 'failure', severity: 'high' },
  'falha/randomuuid-sem-alternativa': { kind: 'failure', severity: 'medium' },
  'desempenho/realtime-sem-espera': { kind: 'performance', severity: 'low' },
  'desempenho/regex-de-email-lenta': { kind: 'performance', severity: 'medium' },
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
  // O que o dono tirou do Faundr no .faundrignore (exemplos, código de terceiros copiado) também fica fora da checagem.
  const ignored = faundrIgnore(root)
  return files.filter((f) => qualityGrammar(f) && !GENERATED.test(f) && !/\.blade\.php$/.test(f) && !ignoredBy(ignored, f))
}

/**
 * Roda as regras. `only`: só esses arquivos (checagem parcial: as regras do projeto inteiro, o código sem uso,
 * os duplicados e as ferramentas do projeto ficam de fora). `tools`: roda o tsc e o ESLint do projeto. `fresh`: não
 * aproveita o resultado guardado das ferramentas (a checagem que a pessoa pediu roda de verdade e renova o cache).
 */
export async function runQuality(root, { only = null, history = true, tools = true, fresh = false } = {}) {
  const started = Date.now()
  const all = qualityFiles(root)
  const files = only ? all.filter((f) => only.includes(f)) : all
  const c = makeCollector()
  const errors = []
  const parsed = await analyzeFiles(root, files, c, errors)

  // O escopo diz ao servidor o que foi olhado: o que estava aberto ali e não apareceu mais fecha como corrigido.
  // Arquivo pulado (grande demais, binário, erro de leitura) não foi olhado: fica de fora, e os achados dele ficam.
  const skipped = parsed.skipped.length ? { skipped: parsed.skipped } : {}
  const scopes = [{ kind: 'code', files: only ? partialScope(root, only, files, parsed.skipped) : null, ...(only ? {} : skipped) }]
  const stats = { files: files.length, lines: parsed.lines, ignored: parsed.ignored }
  if (!only) {
    const unchecked = wholeProject(root, all, parsed, c, { history, errors })
    scopes.push({ kind: 'project', files: null, ...skipped, ...(unchecked.length ? { unchecked } : {}) })
    stats.ranking = ranking(parsed.metrics)
    stats.shortcuts = withBlame(root, parsed.shortcuts)
    if (tools) {
      const failed = []
      const ran = projectTools(root, c, errors, failed, { fresh })
      // Só as ferramentas que rodaram de fato: com o tsc sozinho, os achados do ESLint não fecham.
      const covered = toolsCovered(ran, failed)
      if (covered.length) scopes.push({ kind: 'tool', files: null, tools: covered })
      stats.tools = ran
    }
  }
  return { findings: toFindings(c), scopes, stats: { ...stats, ignored: stats.ignored + c.ignored, ms: Date.now() - started }, errors }
}

/**
 * Escopo da checagem parcial: os arquivos lidos e os pedidos que não existem mais (apagados ou renomeados: os
 * achados deles fecham). Os pulados ficam de fora.
 */
function partialScope(root, only, files, skipped) {
  const inside = (f) => !path.isAbsolute(f) && !f.split('/').includes('..')
  const gone = only.filter((f) => f && inside(f) && !exists(root, f))
  return [...new Set([...files.filter((f) => !skipped.includes(f)), ...gone])]
}

/** Lê cada arquivo pela árvore de sintaxe: achados por arquivo, medidas das funções e o que importa/exporta. */
async function analyzeFiles(root, files, c, errors) {
  const out = { lines: 0, ignored: 0, metrics: new Map(), modules: new Map(), texts: new Map(), shortcuts: [], skipped: [] }
  const house = [...houseRules(root), ...memoryRules(root)]
  for (const rel of files) {
    const text = read(root, rel)
    // Não deu para ler e o arquivo existe (acima de 400 KB, binário, sem permissão): pulado, não corrigido.
    if (text === null && exists(root, rel)) out.skipped.push(rel)
    if (!text || GENERATED_HEADER.test(text.slice(0, 300))) continue
    const ign = ignoreSet(text)
    const add = (rule, line, ctx) => (ign.ignored(rule, line) ? out.ignored++ : c.add(rule, rel, line, ctx))
    const test = TEST_PATH.test(rel)
    let result
    try {
      result = await analyzeQuality(rel, text, { test })
    } catch (err) {
      errors.push(`${rel}: ${err.message}`)
      out.skipped.push(rel)
      continue
    }
    for (const h of result.hits) if (keepHit(h, rel)) add(h.rule, h.line, h.ctx)
    for (const r of house) if (r.files.test(rel)) for (const line of r.lines(text)) add(r.rule, line, r.ctx)
    // Nos testes só o caminho do módulo (o teste quebra na pasta com acento); o resto é código que vai para o ar.
    for (const { rule, line, ...ctx } of bugFindings(rel, text)) if (!test || rule === 'falha/caminho-do-modulo') add(rule, line, ctx)
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
  // Histórias do Storybook e preparação dos testes (vitest.setup.ts, .storybook/) importam mock de propósito.
  if (h.rule === 'falha/mock-em-producao' && TEST_SUPPORT.test(rel)) return false
  return true
}

// Teste com data e hora reais sem relógio falso: o teste muda de resultado conforme o dia.
function realClockRule(text, add) {
  const clock = text.search(/\bnew Date\(\s*\)|\bDate\.now\(\)/)
  if (clock >= 0 && !/useFakeTimers|setSystemTime|mock\.timers|clock\.install|page\.clock|sinon\.useFakeTimers/.test(text))
    add('testes/hora-real', text.slice(0, clock).split('\n').length, {})
}

/**
 * O que só dá para ver olhando o projeto inteiro: pacotes, instruções da IA, TODOs, código sem uso, duplicados.
 * Devolve as regras que não rodaram (os achados antigos delas não fecham).
 */
function wholeProject(root, all, parsed, c, { history, errors }) {
  const unchecked = []
  projectRules(root, all, c)
  // O Dockerfile e as folhas de estilo não são código para a árvore de sintaxe: vêm da lista completa do projeto.
  const everything = projectFiles(root).files
  dockerfileRules(root, everything, c)
  styleRules(root, everything, c)
  performanceRules(root, parsed.texts, c)
  // Sem o histórico (ou com o git sem responder) os TODOs antigos não foram conferidos.
  let todosChecked = false
  if (history) {
    try {
      todosChecked = oldTodos(root, c)
    } catch (err) {
      errors.push(`TODOs: ${err.message}`)
    }
  }
  if (!todosChecked) unchecked.push('limpeza/todo-antigo')
  const entry = entryPoints(root)
  const { orphans, exports } = unusedCode(root, parsed.modules, parsed.texts, (rel) => entry(rel) || TEST_PATH.test(rel))
  for (const rel of orphans) c.add('morto/arquivo-orfao', rel, null, {}, parsed.texts.get(rel))
  for (const e of exports) c.add('morto/export-sem-uso', e.file, e.line, { name: e.name }, parsed.texts.get(e.file))
  for (const d of duplicates(parsed.texts)) c.add('demais/duplicado', d.file, d.line, d, parsed.texts.get(d.file))
  return unchecked
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

// Dono e idade de cada atalho pelo git blame (até 100 atalhos): um blame por arquivo, não um por atalho.
function withBlame(root, shortcuts) {
  const now = Date.now() / 1000
  // faundr: só os 100 primeiros atalhos ganham dono e idade, paginar quando algum projeto passar disso
  const listed = shortcuts.slice(0, 100)
  const byFile = new Map()
  // Sem git ninguém tem dono nem idade (e não vale abrir um processo por arquivo para descobrir isso).
  if (listed.length && insideGit(root)) {
    for (const file of new Set(listed.map((s) => s.file))) byFile.set(file, blameLines(root, file, listed.filter((s) => s.file === file).map((s) => s.line)))
  }
  return listed.map((s) => {
    const { author, time } = byFile.get(s.file)?.get(s.line) ?? {}
    return { ...s, author: author && author !== 'Not Committed Yet' ? author : null, days: time ? Math.max(0, Math.floor((now - time) / 86400)) : 0 }
  })
}
