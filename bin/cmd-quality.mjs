// Qualidade do código (Q-n): faundr quality-scan, quality-show, quality-resolve, quality-ignore, quality-reopen,
// quality-context, quality-finding, quality-review-done, quality-rule e quality-ladder.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findDesignMd } from './design.mjs'
import { detectStack } from './stack.mjs'
import { gapLines, SOURCE_FILE } from './language-support.mjs'
import { AGENT, AGENT_SESSION_ID, firstOf, flag, linkedProject, log, readState, textArg, writeState } from './cli-core.mjs'
import { editedFile, editedLineCount, sessionEditedFiles } from './hook-stop.mjs'
import { contentLangNote } from './hook-events.mjs'
import { editedSinceCheck, printGaps } from './cmd-security.mjs'
import { patternLines } from './patterns.mjs'

// ---- Qualidade do código ------------------------------------------------------------------------

async function qualityApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/quality`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

const QUALITY_SEVERITY_TEXT = { high: 'high', medium: 'medium', low: 'low' }
const QUALITY_KIND_TEXT = {
  failure: 'hidden failure',
  types: 'weak type',
  complexity: 'too complicated',
  excess: 'too much code',
  cleanup: 'cleanup',
  tests: 'tests',
  instructions: 'AI instructions',
  tool: 'project tool',
  review: 'AI review',
  performance: 'performance',
}
const QUALITY_ORDER = ['high', 'medium', 'low']
const qualityLine = (f) =>
  `[${QUALITY_SEVERITY_TEXT[f.severity]}] ${f.title}${f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : ''}`

export async function qualityScan(args) {
  const { root } = linkedProject()
  const sid = flag(args, '--session') ?? AGENT_SESSION_ID ?? null
  let only = flag(args, '--files')
    ?.split(',')
    .map((f) => f.trim().replace(/\\/g, '/'))
    .filter(Boolean)
  // --edited: só o que o agente editou desde a última checagem (fim da resposta).
  const editedLines = sid && fs.existsSync(editedFile(sid)) ? editedLineCount(sid) - 1 : 0
  if (args.includes('--edited')) {
    only = editedSinceCheck(root, sid, 'qualityChecked')
    if (!only.length) return
  }
  const { runQuality } = await import('./quality-rules.mjs')
  const result = await runQuality(root, { only: only ?? null })
  if (sid) writeState(root, { qualityChecked: { session: sid, lines: editedLines } })
  if (args.includes('--json')) return console.log(JSON.stringify(result, null, 2))

  const sent = args.includes('--no-send')
    ? null
    : await qualityApi({ action: 'report', scopes: result.scopes, findings: result.findings, stats: result.stats, errors: result.errors, agent: AGENT, agentSessionId: sid })
  if (sent && args.includes('--edited')) await sendSessionSize(root, sid).catch((err) => log(`quality: session size: ${err.message}`))
  if (args.includes('--quiet'))
    return log(`quality: ${result.findings.length} finding(s) in ${result.stats.files} files, ${result.stats.ms} ms${result.errors.length ? `; ${result.errors.length} error(s)` : ''}`)
  console.log(`Quality check: ${result.stats.files} files, ${result.stats.lines} lines of code in ${(result.stats.ms / 1000).toFixed(1)} s.`)
  for (const e of result.errors.slice(0, 5)) console.log(`Warning: ${e}`)
  if (sent) console.log(`Dashboard: ${sent.added} new, ${sent.fixed} fixed, ${sent.reopened} reopened.`)
  const gaps = printGaps(root, 'qualidade', '/faundr:quality --full')
  if (!result.findings.length) return console.log(gaps ? 'No problems in the parts the automatic check reads.' : 'Lean. No problems found by the automatic check.')
  const sorted = [...result.findings].sort((a, b) => QUALITY_ORDER.indexOf(a.severity) - QUALITY_ORDER.indexOf(b.severity))
  console.log(`\nProblems (${sorted.length}):`)
  for (const f of sorted.slice(0, 40)) console.log(`  ${qualityLine(f)}`)
  if (sorted.length > 40) console.log(`  … and ${sorted.length - 40} more`)
  console.log('\nSee the numbers (Q-n) with: faundr quality-show')
}

function printQualityFinding(f) {
  console.log(`Q-${f.ref} [${QUALITY_SEVERITY_TEXT[f.severity]}] ${f.title}`)
  console.log(`Kind: ${QUALITY_KIND_TEXT[f.kind] ?? f.kind} · rule: ${f.rule_id} · status: ${{ open: 'open', fixed: 'fixed', ignored: 'ignored' }[f.status]}`)
  if (f.origin === 'audit') console.log(`AI review · confidence ${f.confidence}${f.label ? ` · label ${f.label}` : ''}${f.saves ? ` · ${f.saves === 1 ? '1 line would go' : `${f.saves} lines would go`}` : ''}`)
  if (f.file) console.log(`File: ${f.file}${f.line ? `:${f.line}` : ''}`)
  if (f.detail) console.log(`\nWhat it is: ${f.detail}`)
  if (f.impact) console.log(`Why it matters: ${f.impact}`)
  if (f.fix) console.log(`How to fix: ${f.fix}`)
  if (f.status === 'ignored') console.log(`\nIgnored (${f.ignore_reason})${f.ignore_note ? `: ${f.ignore_note}` : ''}`)
}

export async function qualityShow(args) {
  const text = textArg(args)
  if (/^Q?-?\d+$/i.test(text ?? '')) return printQualityFinding(await qualityApi({ action: 'get', query: text }))
  const { quality, findings } = await qualityApi({ action: 'list' })
  if (!findings.length) console.log('No open quality problems.')
  for (const f of [...findings].sort((a, b) => QUALITY_ORDER.indexOf(a.severity) - QUALITY_ORDER.indexOf(b.severity) || a.ref - b.ref))
    console.log(`Q-${f.ref} ${qualityLine(f)}`)
  if (quality) console.log(`\nLast check: ${quality.checked_at}`)
  if (findings.length) console.log('Details: faundr quality-show Q-<n>')
}

export async function qualityResolve(args) {
  const text = textArg(args)
  if (!text) throw new Error('usage: faundr quality-resolve Q-<n> [--verified "how you checked (only for AI review findings)"]')
  const { root } = linkedProject()
  const f = await qualityApi({ action: 'get', query: text })
  if (f.status === 'fixed') return console.log(`Q-${f.ref} is already fixed.`)
  if (f.origin === 'audit') {
    const note = flag(args, '--verified')
    if (!note) throw new Error(`Q-${f.ref} came from the AI review: reread the fixed code and close it with --verified "what changed and how you checked".`)
    const r = await qualityApi({ action: 'verify', query: text, note })
    return console.log(`Q-${r.ref} fixed (verified: ${note}).`)
  }
  const { runQuality } = await import('./quality-rules.mjs')
  // Regra por arquivo: refaz só o arquivo; regra do projeto (pacotes, CLAUDE.md, TODOs): refaz tudo.
  const projectWide = /^(demais\/dependencia-|instrucoes\/|limpeza\/todo-antigo)/.test(f.rule_id)
  const result = await runQuality(root, { only: projectWide || !f.file ? null : [f.file] })
  await qualityApi({ action: 'report', scopes: result.scopes, findings: result.findings, stats: result.stats, errors: result.errors, agent: AGENT, agentSessionId: AGENT_SESSION_ID ?? null })
  const after = await qualityApi({ action: 'get', query: text })
  if (after.status === 'fixed') return console.log(`Q-${after.ref} fixed: the check no longer finds the problem.`)
  console.log(`Q-${after.ref} still shows up in the check. Review the fix:\n`)
  printQualityFinding(after)
}

export async function qualityIgnore(args) {
  const text = textArg(args)
  const r = (flag(args, '--reason') ?? '').toLowerCase()
  const reason = firstOf([[/falso|false/.test(r), 'falso-alarme'], [/prop[oó]sito|intenc|purpose/.test(r), 'de-proposito'], [/depois|later/.test(r), 'depois']], null)
  if (!text || !reason) throw new Error('usage: faundr quality-ignore Q-<n> --reason false-alarm|on-purpose|later [--note "why"]')
  const done = await qualityApi({ action: 'ignore', query: text, reason, note: flag(args, '--note') })
  console.log(`Q-${done.ref} ignored${done.ignore_until ? ` until ${done.ignore_until.slice(0, 10)} (then it shows up again)` : ''}: ${done.title}`)
}

// Arquivos mudados que ainda não foram commitados (git) somados aos que esta sessão editou.
function changedCodeFiles(root, sid) {
  const git = (a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', windowsHide: true }).stdout?.split('\n').filter(Boolean) ?? []
  const fromGit = [...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])]
  const fromSession = sid ? sessionEditedFiles(sid).map((f) => path.relative(root, path.resolve(root, f)).split(path.sep).join('/')) : []
  return [...new Set([...fromGit, ...fromSession])].filter((f) => !f.startsWith('..') && SOURCE_FILE.test(f) && fs.existsSync(path.join(root, f)))
}

// Pacote de contexto da revisão com IA (skill "quality"): o que revisar, o catálogo, as regras do projeto e o que já está aberto.
export async function qualityContext(args) {
  const { root } = linkedProject()
  const sid = AGENT_SESSION_ID ?? null
  const onlyFiles = flag(args, '--files')?.split(',').map((f) => f.trim()).filter(Boolean)
  const full = args.includes('--full')
  const files = onlyFiles ?? (full ? null : changedCodeFiles(root, sid))
  const catalog = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'quality', 'catalog.md')
  const mode = firstOf([[full, 'projeto'], [onlyFiles, 'arquivos']], 'sessao')
  const modeText = { projeto: () => 'whole project (inventory per theme)', arquivos: () => `only ${files.join(', ')}`, sessao: () => 'what changed (session and uncommitted changes)' }[mode]()
  const out = ['# Quality review context', await contentLangNote(root), `Mode: ${modeText}`, '']
  out.push(`Catalog (read it first, with the Read tool): ${catalog}`, '')
  const designMd = findDesignMd(root)
  const rules = [...['CLAUDE.md', 'AGENTS.md', '.claude/CLAUDE.md'].filter((f) => fs.existsSync(path.join(root, f))), ...(designMd ? [path.relative(root, designMd).split(path.sep).join('/')] : [])]
  out.push('## Project rules to read', ...(rules.length ? rules.map((f) => `- ${f}`) : ['- (no CLAUDE.md, AGENTS.md or design.md)']), '')
  // Linguagens em que a checagem automática (complexidade, duplicação, código sem uso) não roda: o Claude cobre lendo.
  const gaps = gapLines(detectStack(root).stack, 'qualidade')
  if (gaps.length) out.push('## Languages without a complete automatic check (the review is all yours there)', ...gaps, '- In them, look yourself for: long functions or ones with many paths, deep nesting, repeated code, unused code and swallowed errors.', '')
  if (files) {
    out.push(`## Files to review (${files.length})`, ...(files.length ? files.map((f) => `- ${f}`) : ['- Nothing changed since the last commit. Tell the user and offer the project review: /faundr:quality --full']), '')
  }
  try {
    const { quality, findings } = await qualityApi({ action: 'list' })
    const ranking = quality?.stats?.ranking ?? []
    if (full && ranking.length) {
      out.push('## Most complex files (start with them)')
      for (const r of ranking.slice(0, 8)) out.push(`- ${r.file}: ${r.complexity} paths, worst function ${r.worst?.name ?? '-'} (${r.worst?.complexity ?? '-'})`)
      out.push('')
    }
    const review = quality?.review
    out.push('## Last AI review', review ? `${review.at} (${review.mode}). Covered: ${review.areas.join('; ') || '-'}.` : 'None yet.', '')
    const relevant = files ? findings.filter((f) => !f.file || files.includes(f.file)) : findings
    out.push(`## Already recorded and open (${relevant.length}) — do not record them again`)
    for (const f of relevant.slice(0, 80)) out.push(`- Q-${f.ref} ${qualityLine(f)}`)
    if (relevant.length > 80) out.push(`- … and ${relevant.length - 80} more`)
  } catch (err) {
    out.push(`(could not read the findings already recorded: ${err.message})`)
  }
  out.push(...(await patternLines('quality')))
  console.log(out.join('\n'))
}

export async function qualityFinding(args) {
  const title = textArg(args)
  const severity = flag(args, '--severity')
  const confidence = Number(flag(args, '--confidence'))
  if (!title || !['high', 'medium', 'low'].includes(severity) || !flag(args, '--theme') || !Number.isFinite(confidence))
    throw new Error(
      'usage: faundr quality-finding "<title>" --theme demais|falha|desempenho|tipos|complexidade|comentarios|testes|arquitetura|instrucoes [--label apagar|stdlib|nativo|yagni|encurtar] --severity high|medium|low --confidence 80-100 --file <path> [--line n] --detail "..." --impact "..." --fix "<concrete replacement>" [--saves <lines removed>]',
    )
  const line = Number(flag(args, '--line'))
  const saves = Number(flag(args, '--saves'))
  const r = await qualityApi({
    action: 'add',
    agent: AGENT,
    agentSessionId: AGENT_SESSION_ID ?? null,
    finding: {
      title,
      theme: flag(args, '--theme'),
      label: flag(args, '--label') ?? null,
      severity,
      confidence,
      file: flag(args, '--file'),
      line: Number.isInteger(line) && line > 0 ? line : null,
      detail: flag(args, '--detail'),
      impact: flag(args, '--impact'),
      fix: flag(args, '--fix'),
      saves: Number.isInteger(saves) && saves >= 0 ? saves : null,
    },
  })
  console.log(`Quality finding Q-${r.ref} recorded${r.status === 'ignored' ? ' (already ignored by the user)' : ''}: ${r.title}`)
}

export async function qualityReviewDone(args) {
  const list = (name) => (flag(args, name) ?? '').split(';').map((s) => s.trim()).filter(Boolean)
  const areas = list('--areas')
  if (!areas.length) throw new Error('usage: faundr quality-review-done --areas "a; b" [--clean "x; y"] [--summary "..."] [--net "-N lines, -M packages"] [--scores "demais=3; falha=2"] [--full]')
  // --scores "demais=3; falha=2": nota 0-4 por tema do catálogo.
  const scores = Object.fromEntries(list('--scores').map((s) => s.split('=').map((x) => x.trim())).map(([k, v]) => [k, Number(v)]))
  await qualityApi({ action: 'review-done', areas, clean: list('--clean'), summary: flag(args, '--summary'), net: flag(args, '--net'), scores, mode: args.includes('--full') ? 'projeto' : 'sessao' })
  console.log('Quality review recorded on the dashboard.')
}

// Regra da casa: o time escreve o que não quer ver no código, sem programar (vira um .md em .faundr-regras/).
export async function qualityRule(args) {
  const { root } = linkedProject()
  const name = textArg(args)
  const pattern = flag(args, '--pattern')
  const message = flag(args, '--message')
  if (!name || !pattern || !message)
    throw new Error('usage: faundr quality-rule "<name>" --pattern "<regular expression>" --message "<why and what to use instead>" [--files "src/**/*.tsx"] [--severity alta|media|baixa]')
  try {
    new RegExp(pattern)
  } catch (err) {
    throw new Error(`Invalid pattern: ${err.message}`)
  }
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  const dir = path.join(root, '.faundr-regras')
  fs.mkdirSync(dir, { recursive: true })
  const quote = (v) => JSON.stringify(v)
  const body = ['---', `nome: ${quote(name)}`, `padrao: ${quote(pattern)}`, `arquivos: ${quote(flag(args, '--files') ?? '**/*')}`, `gravidade: ${flag(args, '--severity') ?? 'media'}`, '---', message, ''].join('\n')
  fs.writeFileSync(path.join(dir, `${slug}.md`), body)
  console.log(`House rule created: .faundr-regras/${slug}.md (applies on the next check; commit it so the whole team uses it).`)
}

export async function qualityLadder(args) {
  const on = textArg(args)
  if (!['on', 'off', 'liga', 'desliga'].includes(on)) throw new Error('usage: faundr quality-ladder on|off')
  const r = await qualityApi({ action: 'settings', ladder: on === 'on' || on === 'liga' })
  console.log(r.ladder ? 'Quality reminder on: the agent gets the ladder at the start of every session.' : 'Quality reminder off.')
}

// Tamanho da mudança da sessão: tudo o que mudou desde o commit em que ela começou (commits + não commitado).
const NOT_CODE_CHANGE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|routeTree\.gen\.ts)$|(^|\/)(dist|build|out|\.output|node_modules)\/|\.(min\.js|map|svg|png|jpe?g|webp|ico|wasm)$/
const TEST_FILE = /(^|\/)(__tests__|tests?|e2e|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$/

function codeChange(root, base) {
  const git = (a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
  const change = { added: 0, removed: 0, testAdded: 0, testRemoved: 0, files: 0 }
  const count = (file, added, removed) => {
    if (NOT_CODE_CHANGE.test(file)) return
    const test = TEST_FILE.test(file)
    change[test ? 'testAdded' : 'added'] += added
    change[test ? 'testRemoved' : 'removed'] += removed
    change.files++
  }
  for (const row of git(['diff', '--numstat', base]).stdout?.split('\n') ?? []) {
    const [a, r, file] = row.split('\t')
    if (file && a !== '-') count(file, Number(a), Number(r))
  }
  for (const file of git(['ls-files', '--others', '--exclude-standard']).stdout?.split('\n').filter(Boolean) ?? []) {
    try {
      const st = fs.statSync(path.join(root, file))
      if (st.size < 1_000_000) count(file, fs.readFileSync(path.join(root, file), 'utf8').split('\n').length, 0)
    } catch {
      // Arquivo sumiu entre a listagem e a leitura: não conta.
    }
  }
  return change
}

async function sendSessionSize(root, sid) {
  const base = readState(root).qualityBase
  if (!sid || base?.session !== sid || !base.head) return
  await qualityApi({ action: 'session-size', agent: AGENT, agentSessionId: sid, change: codeChange(root, base.head) })
}

export async function qualityReopen(args) {
  const done = await qualityApi({ action: 'reopen', query: textArg(args) })
  console.log(`Reopened: Q-${done.ref} ${done.title}`)
}
