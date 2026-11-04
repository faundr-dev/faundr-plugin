// Segurança (S-n): faundr security-scan, security-show, security-resolve, security-ignore, security-context,
// security-finding, security-review-done, skill-report, security-import, security-supabase e security-report.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { faundrPath } from './paths.mjs'
import { findSecrets, mask, projectMap, scanProject } from './security.mjs'
import { parseImport, supabaseAdvisors } from './security-import.mjs'
import { detectStack } from './stack.mjs'
import { gapLines } from './language-support.mjs'
import { AGENT, AGENT_SESSION_ID, CONFIG_DIR, firstOf, flag, linkedProject, log, readJson, readState, textArg, writeState } from './cli-core.mjs'
import { editedFile, editedLineCount, sessionEditedFiles } from './hook-stop.mjs'
import { contentLangNote } from './hook-events.mjs'
import { patternLines } from './patterns.mjs'

// ---- Segurança -------------------------------------------------------------------------------

// O trecho do código de cada achado (snippet) não sai do computador: o painel mostra arquivo e linha.
export const withoutSnippets = (findings) => findings.map(({ snippet: _snippet, ...f }) => f)

export async function securityApi(body) {
  const { projectId, config } = linkedProject()
  const sent = Array.isArray(body.findings) ? { ...body, findings: withoutSnippets(body.findings) } : body
  const res = await fetch(`${config.apiUrl}/api/cli/security`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...sent }),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

// Skills conectadas: o resultado de uma skill de outra pessoa vira S-n, Q-n, T-n ou E-n, com "via /nome".
const SKILL_AREAS = ['seguranca', 'qualidade', 'testes', 'erros']
const SKILL_REPORT_USAGE =
  'usage: faundr skill-report "<skill name>" --areas seguranca,qualidade,testes,erros (--file <findings.json> | --none) [--scope a.ts,b.ts]\n  (areas: seguranca = security, qualidade = quality, testes = tests, erros = errors)\n  findings.json: list of {"area","status":"open|fixed","title","severity","file","line","detail","impact","fix"}'

export async function skillReport(args) {
  const skill = textArg(args)
  const areas = (flag(args, '--areas') ?? '').split(',').map((a) => a.trim()).filter(Boolean)
  const file = flag(args, '--file')
  if (!skill || (!file && !args.includes('--none')) || areas.some((a) => !SKILL_AREAS.includes(a))) throw new Error(SKILL_REPORT_USAGE)
  const raw = file ? JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) : []
  const list = Array.isArray(raw) ? raw : (raw.findings ?? [])
  // Só os campos que o painel usa (um trecho de código que a skill tenha posto no JSON fica aqui) e nunca a chave
  // inteira: o mesmo mascaramento da revisão de segurança.
  const findings = list.map((f) => ({
    area: f.area,
    status: f.status,
    title: f.title,
    severity: f.severity,
    file: f.file,
    line: f.line,
    fingerprint: f.fingerprint,
    detail: f.detail && maskSecretsIn(String(f.detail)),
    impact: f.impact && maskSecretsIn(String(f.impact)),
    fix: f.fix && maskSecretsIn(String(f.fix)),
  }))
  const scope = flag(args, '--scope')?.split(',').map((f) => f.trim()).filter(Boolean) ?? null
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/skill-report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, action: 'report', skill, findings, areas, scope, agent: AGENT, agentSessionId: AGENT_SESSION_ID ?? null }),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  const SECTION = { seguranca: 'Security', qualidade: 'Quality', testes: 'Tests', erros: 'Errors' }
  const lines = Object.entries(data.summary).map(([area, s]) => `${SECTION[area]}: ${s.added} new, ${s.open} open from this skill, ${s.fixed} fixed`)
  console.log(`Result of /${data.skill} recorded on the dashboard (via /${data.skill}).\n${lines.join('\n')}`)
}

export function maskSecretsIn(text) {
  let out = text
  for (const s of findSecrets(text)) out = out.replace(s.secret, mask(s.secret))
  return out
}

const SEVERITY_TEXT = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' }
const SOURCE_TEXT = { history: 'git history', secret: 'key or password', dependency: 'package', database: 'database', code: 'code', config: 'configuration', review: 'AI review' }

// Arquivos que o agente editou desde a última checagem desta sessão (relativos à raiz). `key` é o marcador
// no estado da pasta: securityChecked, qualityChecked…
export function editedSinceCheck(root, sid, key) {
  const last = readState(root)[key]
  const from = last?.session === sid ? last.lines : 0
  return sessionEditedFiles(sid, from)
    .map((f) => path.relative(root, path.resolve(root, f)).split(path.sep).join('/'))
    .filter((rel) => rel && !rel.startsWith('..'))
}

export function checkPending(root, sid, key) {
  if (!sid || !fs.existsSync(editedFile(sid))) return false
  const last = readState(root)[key]
  return last?.session !== sid || editedLineCount(sid) - 1 > last.lines
}

// Problemas graves que a checagem em segundo plano achou: o agente fica sabendo no próximo pedido.
const securityAlertFile = (sid) => path.join(CONFIG_DIR, `security-alert-${String(sid).replace(/[^\w-]/g, '')}.json`)

export function takeSecurityAlert(sid) {
  if (!sid) return null
  const file = securityAlertFile(sid)
  const alert = readJson(file)
  if (!alert?.length) return null
  try {
    fs.unlinkSync(file)
  } catch {
    // Não deu para apagar: o aviso pode voltar na próxima vez, melhor do que se perder.
  }
  return [
    '[Faundr] Security: the automatic check found new problem(s) in the edited files:',
    ...alert.map((a) => `  S-${a.ref} [${SEVERITY_TEXT[a.severity]}] ${a.title}`),
    'Tell the user in one line and ask whether they want to fix it now (Faundr\'s "security-fix" skill). Details: faundr security-show S-<n>.',
  ].join('\n')
}

export async function securityScan(args) {
  const { root } = linkedProject()
  const quiet = args.includes('--quiet')
  const sid = flag(args, '--session') ?? AGENT_SESSION_ID ?? null
  let only = flag(args, '--files')
    ?.split(',')
    .map((f) => f.trim().replace(/\\/g, '/'))
    .filter(Boolean)
  // --edited: só o que o agente editou desde a última checagem (fim da resposta).
  const editedLines = sid && fs.existsSync(editedFile(sid)) ? editedLineCount(sid) - 1 : 0
  if (args.includes('--edited')) {
    only = editedSinceCheck(root, sid, 'securityChecked')
    if (!only.length) return
  }
  const history = securityHistoryDue(root, args, only)
  const result = await scanProject(root, { only: only ?? null, history })
  if (sid) writeState(root, { securityChecked: { session: sid, lines: editedLines } })
  if (history && !result.errors.some((e) => /^(git history|histórico|history)/i.test(e))) writeState(root, { securityHistoryAt: new Date().toISOString() })
  if (args.includes('--json')) return console.log(JSON.stringify(result, null, 2))

  let sent = null
  if (!args.includes('--no-send'))
    sent = await securityApi({
      action: 'report',
      scopes: result.scopes,
      findings: result.findings,
      stats: result.stats,
      errors: result.errors,
      packages: result.snapshot,
      agent: AGENT,
      agentSessionId: sid,
    })
  if (sent?.newSerious?.length && sid && args.includes('--edited')) {
    const prev = readJson(securityAlertFile(sid)) ?? []
    fs.writeFileSync(securityAlertFile(sid), JSON.stringify([...prev, ...sent.newSerious]))
  }
  const visible = result.findings.filter((f) => !f.suppressed)
  if (quiet)
    return log(
      `security: ${visible.length} finding(s) (${result.findings.length - visible.length} suppressed) in ${result.stats.files} files, ${result.stats.ms} ms${result.errors.length ? `; ${result.errors.join('; ')}` : ''}`,
    )
  printSecurityScan(result, sent, visible, printGaps(root, 'seguranca', '/faundr:security'))
}

// Linguagens do projeto que a checagem não lê (ou só lê em parte): sem isto, "nenhum problema" engana. Devolve se havia alguma.
export function printGaps(root, feature, command) {
  const gaps = gapLines(detectStack(root).stack, feature)
  if (gaps.length) console.log([`Outside the automatic check (the AI reviews it with ${command}):`, ...gaps].join('\n'))
  return gaps.length > 0
}

// Histórico do git: na checagem completa, no máximo uma vez por semana (ou com --history).
function securityHistoryDue(root, args, only) {
  const lastHistory = readState(root).securityHistoryAt
  return !only && (args.includes('--history') || !lastHistory || Date.now() - new Date(lastHistory).getTime() > 7 * 86_400_000)
}

function printSecurityScan(result, sent, visible, gaps = false) {
  const { stats } = result
  console.log(
    `Security check: ${stats.files} files${stats.commits ? `, ${stats.commits} commits` : ''}${stats.packages ? `, ${stats.packages} packages` : ''}${stats.tables ? `, ${stats.tables} tables` : ''} in ${(stats.ms / 1000).toFixed(1)} s.`,
  )
  for (const e of result.errors) console.log(`Warning: ${e}`)
  if (sent) console.log(`Dashboard: ${sent.added} new, ${sent.fixed} fixed, ${sent.reopened} reopened.`)
  if (!visible.length) return console.log(gaps ? 'No problems in the parts the automatic check reads.' : 'No problems found by the automatic check.')
  const order = ['critical', 'high', 'medium', 'low']
  console.log(`\nProblems (${visible.length}; ${result.findings.length - visible.length} suppressed as noise):`)
  for (const f of visible.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)))
    console.log(`  [${SEVERITY_TEXT[f.severity]}] ${f.title}${f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : ''}`)
  console.log('\nSee the numbers (S-n) with: faundr security-show')
}

// Bloco no formato que a skill security-fix usa (título, severidade, regra, arquivo, trecho mascarado, correção).
// A gravidade mudou depois do detector (contexto do projeto): de quanto para quanto e por quê.
function severityAdjust(f) {
  if (f.severity_original && f.severity_original !== f.severity) return ` (the detector said ${SEVERITY_TEXT[f.severity_original]}: ${f.adjust_reason})`
  return f.adjust_reason ? ` (${f.adjust_reason})` : ''
}

function printSecurityFinding(f) {
  const lines = [
    `S-${f.ref} · ${f.title}`,
    `Status: ${{ open: 'open', fixed: 'fixed (the check no longer finds it)', ignored: `ignored (${f.ignore_reason === 'accepted_risk' ? 'accepted risk' : 'not an issue'}${f.ignore_until ? ` until ${f.ignore_until.slice(0, 10)}` : ''})` }[f.status]}`,
    f.verdict === 'needs_check'
      ? `Needs check (if confirmed: ${SEVERITY_TEXT[f.severity]}). Still unknown: ${f.blocker}${f.check_plan ? `\nHow to check: ${f.check_plan}` : ''}`
      : `Severity: ${SEVERITY_TEXT[f.severity]}${severityAdjust(f)}${f.suppressed ? ' — suppressed as noise' : ''}`,
    `Kind: ${SOURCE_TEXT[f.source]} · rule ${f.rule_id}${f.cwe?.length ? ` · ${f.cwe.join(', ')}` : ''}${f.cve?.length ? ` · ${f.cve.join(', ')}` : ''}`,
  ]
  if (f.file) lines.push(`File: ${f.file}${f.line ? `:${f.line}` : ''}`)
  if (f.package) lines.push(`Package: ${f.package} (current version ${f.version})${f.fixed_in ? ` · fixed from ${f.fixed_in}` : ' · no fixed version yet'}`)
  if (f.introduced_by) lines.push(`Comes from: ${f.introduced_by}`)
  if (f.snippet) lines.push('', 'Snippet (the key is masked):', '```', f.snippet, '```')
  lines.push('', `What it is: ${f.detail}`, `What can happen: ${f.impact}`, `How to fix: ${f.fix}`)
  if (f.advisory_url) lines.push(`Public advisory: ${f.advisory_url}`)
  console.log(lines.join('\n'))
}

export async function securityShow(args) {
  const text = textArg(args)
  if (/^S?-?\d+$/i.test(text)) return printSecurityFinding(await securityApi({ action: 'get', query: text }))
  const { security, findings } = await securityApi({ action: 'list' })
  // Nome de pacote: todos os problemas abertos dele (a correção costuma ser uma atualização só).
  if (text) {
    const of = findings.filter((f) => f.package === text)
    if (!of.length) return console.log(`No open problems in the package "${text}".`)
    for (const f of of) {
      printSecurityFinding(await securityApi({ action: 'get', query: String(f.ref) }))
      console.log('\n---\n')
    }
    return
  }
  if (security) console.log(`Last check: ${security.checked_at}`)
  const pending = findings.filter((f) => !f.suppressed && f.verdict === 'needs_check')
  const visible = findings.filter((f) => !f.suppressed && f.verdict !== 'needs_check')
  const where = (f) => (f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : '')
  const order = ['critical', 'high', 'medium', 'low']
  if (!visible.length) console.log('No open security problems.')
  else {
    console.log(`Open security problems (${visible.length}; plus ${findings.length - visible.length - pending.length} suppressed as noise):`)
    for (const f of visible.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.ref - b.ref))
      console.log(`  S-${f.ref}  [${SEVERITY_TEXT[f.severity]}] ${f.title}${where(f)}`)
  }
  if (pending.length) {
    console.log(`Needs check (${pending.length}; not counted until someone checks):`)
    for (const f of pending) console.log(`  S-${f.ref}  [if confirmed: ${SEVERITY_TEXT[f.severity]}] ${f.title}${where(f)}`)
  }
  if (visible.length || pending.length) console.log('Details: faundr security-show S-<n>')
}

// Pacote de contexto da revisão com IA (skill "security"): stack, portas de entrada, temas do catálogo,
// o que a checagem automática já achou e a última revisão.
export async function securityContext(args) {
  const { root } = linkedProject()
  const onlyFiles = flag(args, '--files')
    ?.split(',')
    .map((f) => f.trim())
    .filter(Boolean)
  const map = projectMap(root)
  const catalog = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'security', 'catalog')
  const out = ['# Security review context', await contentLangNote(root), `Mode: ${onlyFiles?.length ? `quick (only ${onlyFiles.join(', ')})` : 'full'}`, '']
  out.push(`## Detected stack`, map.stack.length ? map.stack.join(', ') : "(not identified: read the project's manifests)", '')
  const gaps = gapLines(detectStack(root).stack, 'seguranca')
  if (gaps.length) out.push('## Languages without complete automatic rules (the review is all yours there)', ...gaps, '- In them, look yourself for: SQL built from user text, system commands with outside input, routes that do not check login or data owner, secrets in the code, uploads without limits and unsafe deserialization.', '')
  out.push('## Catalog topics to read (with the Read tool)')
  for (const t of map.topics) out.push(`- ${path.join(catalog, `${t}.md`)}`)
  out.push('')
  for (const [title, list] of Object.entries(map.entry)) {
    out.push(`## ${title} (${list.length})`)
    out.push(...(list.length ? list.map((f) => `- ${f}`) : ['- (none found)']), '')
  }
  try {
    const { security, findings } = await securityApi({ action: 'list' })
    pushReview(out, root, security?.review, onlyFiles)
    out.push('', `## Open problems (${findings.length}) — do not record them again; confirm, discard or complete them`)
    const order = ['critical', 'high', 'medium', 'low']
    for (const f of findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))) out.push(securityFindingLine(f))
  } catch (err) {
    out.push(`(could not read the problems already recorded: ${err.message})`)
  }
  out.push(...(await patternLines('security')))
  console.log(out.join('\n'))
}

// A última revisão com IA e, numa revisão completa, o que mudou desde ela.
function pushReview(out, root, review, onlyFiles) {
  out.push('## Last AI review')
  out.push(review ? `${review.at} (${review.mode === 'quick' ? 'quick' : 'full'}). Covered: ${review.areas.join('; ') || '-'}. Clean: ${review.clean.join('; ') || '-'}.` : 'None yet.')
  // Rodadas somam: a nova começa pelo que mudou desde a última e não trata o resto como "já visto e seguro".
  if (!review || onlyFiles?.length) return
  const changed = changedSince(root, review.at)
  if (changed)
    out.push(
      '',
      `## Changed since the last review (${changed.length}) — start here and recheck what was "clean" in these files`,
      ...(changed.length ? changed.slice(0, 80).map((f) => `- ${f}`) : ['- (nothing: focus on what the last one did not cover)']),
      ...(changed.length > 80 ? [`- … and ${changed.length - 80} more`] : []),
    )
}

// Uma linha por problema de segurança aberto: gravidade, origem, título e onde está.
function securityFindingLine(f) {
  const severity = f.verdict === 'needs_check' ? `needs check, if confirmed ${SEVERITY_TEXT[f.severity]}` : SEVERITY_TEXT[f.severity]
  const origin = f.origin === 'audit' ? 'AI review' : `automatic check: ${SOURCE_TEXT[f.source]}`
  const place = f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : ''
  return `- S-${f.ref} [${severity}${f.suppressed ? ', suppressed' : ''}] (${origin}) ${f.title}${place}`
}

// Arquivos de código mudados desde a data (commits e o que ainda não foi commitado); null sem git.
const NOT_CODE = /\.(md|mdx|txt|pdf|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp[34]|webm|lock|map)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|bun\.lockb?)$/i
function changedSince(root, iso) {
  const run = (a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', windowsHide: true })
  const log = run(['log', `--since=${iso}`, '--name-only', '--format='])
  const status = run(['status', '--porcelain', '--untracked-files=normal'])
  if (log.status !== 0 || status.status !== 0) return null
  const files = [...log.stdout.split('\n'), ...status.stdout.split('\n').map((l) => l.slice(3).replace(/^.* -> /, ''))]
    .map((f) => f.trim().replace(/^"|"$/g, ''))
    .filter((f) => f && !/(^|\/)(node_modules|\.faundr|\.remember|\.claude)\//.test(f) && !NOT_CODE.test(f) && fs.existsSync(path.join(root, f)))
  return [...new Set(files)].sort()
}

export async function securityFinding(args) {
  const title = textArg(args)
  const severity = flag(args, '--severity')
  if (!title || !['critical', 'high', 'medium', 'low'].includes(severity))
    throw new Error(
      'usage: faundr security-finding "<title>" --severity critical|high|medium|low --category <catalog id> --file <path> [--line n] --detail "..." --impact "..." --fix "..." [--confidence high|medium|low] [--cwe CWE-639] [--source code|database|config|review] [--needs-check "<the missing fact>" --how-to-check "<how the owner checks>"]',
    )
  const line = Number(flag(args, '--line'))
  // "A conferir": o caminho está no código, mas o fato que decide não; a gravidade fica como "se confirmado".
  const blocker = flag(args, '--needs-check')
  const r = await securityApi({
    action: 'add',
    agent: AGENT,
    agentSessionId: AGENT_SESSION_ID ?? null,
    finding: {
      source: flag(args, '--source') ?? 'review',
      severity,
      category: flag(args, '--category'),
      rule_id: flag(args, '--category') ?? 'review',
      confidence: flag(args, '--confidence') ?? 'medium',
      title,
      detail: flag(args, '--detail'),
      impact: flag(args, '--impact'),
      fix: flag(args, '--fix'),
      file: flag(args, '--file'),
      line: Number.isInteger(line) && line > 0 ? line : null,
      cwe: flag(args, '--cwe')?.split(',').map((c) => c.trim()) ?? [],
      ...(blocker ? { verdict: 'needs_check', blocker, check_plan: flag(args, '--how-to-check') } : {}),
    },
  })
  const kind = r.verdict === 'needs_check' ? 'Needs check' : 'Security problem'
  console.log(`${kind} S-${r.ref} recorded${r.status === 'ignored' ? ' (already ignored by the user)' : ''}: ${r.title}`)
}

// Relatório em Markdown (para colar numa IA, abrir issue ou mostrar a um sócio).
export async function securityReport(args) {
  const { root } = linkedProject()
  const { markdown } = await securityApi({ action: 'export' })
  const out = flag(args, '--out') ?? faundrPath(root, 'securityReport')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, markdown)
  console.log(`Report saved to ${out}`)
}

// Importa resultados de outra ferramenta (Snyk, SARIF, Security Advisor do Supabase).
export async function securityImport(args) {
  const file = textArg(args)
  if (!file) throw new Error('usage: faundr security-import <file.json|file.sarif>  (snyk test --json, SARIF from any tool or the Supabase Security Advisor)')
  const json = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const { tool, findings } = parseImport(json, maskSecretsIn)
  await sendImport(tool, findings)
}

export async function sendImport(tool, findings) {
  const r = await securityApi({ action: 'report', tool, scopes: [], findings, agent: AGENT, agentSessionId: AGENT_SESSION_ID ?? null })
  console.log(`Imported from ${tool}: ${findings.length} problem(s); ${r.added} new, ${r.fixed} that no longer show up were closed. See them under Security on the dashboard.`)
}

// Security Advisor do Supabase pela API de gestão, com o token pessoal do usuário (nunca vai para o Faundr).
export async function securitySupabase(args) {
  const { root } = linkedProject()
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token)
    throw new Error(
      "The personal Supabase token is missing. Create one at https://supabase.com/dashboard/account/tokens and run with the SUPABASE_ACCESS_TOKEN variable set (it stays only on your computer). Alternative: use Supabase's MCP (get_advisors) and import the result with faundr security-import.",
    )
  let ref = flag(args, '--ref')
  if (!ref)
    for (const f of fs.readdirSync(root).filter((x) => /^\.env/.test(x))) {
      ref = fs.readFileSync(path.join(root, f), 'utf8').match(/https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1]
      if (ref) break
    }
  if (!ref) throw new Error('Could not find the Supabase project (URL https://<ref>.supabase.co in the .env files). Pass it with --ref <ref>.')
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/advisors/security`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const { tool, findings } = supabaseAdvisors((await res.json()).lints ?? [])
  await sendImport(tool, findings)
}

export async function securityReviewDone(args) {
  const list = (name) => flag(args, name)?.split(';').map((a) => a.trim()).filter(Boolean) ?? []
  const areas = list('--areas')
  if (!areas.length) throw new Error('usage: faundr security-review-done --areas "a; b; c" [--clean "x; y"] [--summary "..."] [--quick]')
  await securityApi({ action: 'review-done', areas, clean: list('--clean'), summary: flag(args, '--summary'), mode: args.includes('--quick') ? 'quick' : 'full' })
  console.log(`Review recorded: ${areas.length} area(s) covered. It shows in the Security section of the dashboard.`)
}

// Só fecha se a checagem não encontrar mais o problema (marcar à mão não vale). Achado da revisão com IA
// não tem checagem automática: fecha com --verified dizendo como a correção foi conferida.
// O que reler para conferir a correção: o arquivo do achado (pacote e banco sempre pelo arquivo); sem arquivo, tudo.
function recheckFiles(f) {
  if (f.source === 'dependency' || f.source === 'database') return [f.file]
  return f.file ? [f.file] : null
}

export async function securityResolve(args) {
  const text = textArg(args)
  if (!text) throw new Error('usage: faundr security-resolve S-<n> [--verified "how you checked (only for AI review findings)"]')
  const { root } = linkedProject()
  const f = await securityApi({ action: 'get', query: text })
  if (f.status === 'fixed') return console.log(`S-${f.ref} is already fixed.`)
  if (f.origin === 'audit') {
    const note = flag(args, '--verified')
    if (!note) throw new Error(`S-${f.ref} came from the AI review: reread the fixed code and close it with --verified "what changed and how you checked".`)
    const r = await securityApi({ action: 'verify', query: text, note })
    return console.log(`S-${r.ref} fixed (verified: ${note}).`)
  }
  const only = recheckFiles(f)
  const result = await scanProject(root, { only })
  await securityApi({ action: 'report', scopes: result.scopes, findings: result.findings, stats: result.stats, errors: result.errors, agent: AGENT, agentSessionId: AGENT_SESSION_ID ?? null })
  if (result.errors.length) console.log(`Warning: ${result.errors.join('; ')}`)
  const after = await securityApi({ action: 'get', query: text })
  if (after.status === 'fixed') console.log(`S-${after.ref} fixed: the check no longer finds the problem.`)
  else {
    console.log(`S-${after.ref} still shows up in the check. Review the fix:\n`)
    printSecurityFinding(after)
  }
}

export async function securityIgnore(args) {
  const text = textArg(args)
  const reasonArg = (flag(args, '--reason') ?? '').toLowerCase()
  const reason = firstOf([[/aceito|accepted|risk|risco/.test(reasonArg), 'accepted_risk'], [/nao|não|not/.test(reasonArg), 'not_a_problem']], null)
  if (!text || !reason)
    throw new Error('usage: faundr security-ignore S-<n> --reason not-an-issue|accepted-risk [--note "why"] [--days 30 | --days forever]')
  const daysArg = flag(args, '--days')
  const r = await securityApi({
    action: 'ignore',
    query: text,
    reason,
    note: flag(args, '--note'),
    days: firstOf([[daysArg === 'sempre' || daysArg === 'forever', null], [daysArg, Number(daysArg)]], 30),
  })
  console.log(`S-${r.ref} ignored${r.ignore_until ? ` until ${r.ignore_until.slice(0, 10)} (then it shows up again)` : ''}: ${r.title}`)
}
