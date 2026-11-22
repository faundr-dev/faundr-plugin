// Segurança (S-n): faundr security-scan, security-show, security-resolve, security-ignore, security-context,
// security-finding, security-review-done, skill-report, security-import, security-supabase e security-report.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { faundrPath } from './paths.mjs'
import { databaseInventory, fileScoped, findSecrets, isEnvFile, mask, projectFiles, projectMap, reviewFiles, scanProject } from './security.mjs'
import { parseImports, supabaseAdvisors } from './security-import.mjs'
import { branchInfo } from './quality-git.mjs'
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

/**
 * Manda o resultado da checagem ao painel. Com ele vão a branch (uma branch de trabalho não fecha o que só existe
 * na principal) e `readAt`, a hora em que a leitura dos arquivos começou (o que foi corrigido depois não reabre).
 */
const sendReport = (root, result, sid) =>
  securityApi({
    action: 'report',
    scopes: result.scopes,
    findings: result.findings,
    stats: result.stats,
    errors: result.errors,
    packages: result.snapshot,
    agent: AGENT,
    agentSessionId: sid,
    ...branchInfo(root),
    readAt: result.readAt,
  })

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
  const result = await scanProject(root, { only: only ?? null, history: historyPlan(root, only, args.includes('--history')) })
  if (args.includes('--json')) return console.log(JSON.stringify(result, null, 2))

  const sent = args.includes('--no-send') ? null : await sendReport(root, result, sid)
  // Só depois de o painel receber: se o envio falhar (sem rede, servidor fora), a próxima checagem olha de novo
  // os mesmos arquivos e os mesmos commits em vez de dá-los por conferidos.
  if (sent) {
    if (sid) writeState(root, { securityChecked: { session: sid, lines: editedLines } })
    saveHistory(root, result)
  }
  if (sent?.newSerious?.length && sid && args.includes('--edited')) {
    const prev = readJson(securityAlertFile(sid)) ?? []
    fs.writeFileSync(securityAlertFile(sid), JSON.stringify([...prev, ...sent.newSerious]))
  }
  const visible = result.findings.filter((f) => !f.suppressed)
  if (quiet)
    return log(
      `security: ${visible.length} finding(s) (${result.findings.length - visible.length} suppressed) in ${result.stats.files} files, ${result.stats.ms} ms${sent?.truncated ? '; more than 2000 findings, nothing closed' : ''}${result.errors.length ? `; ${result.errors.join('; ')}` : ''}`,
    )
  printSecurityScan(result, sent, visible, printGaps(root, 'seguranca', '/faundr:security'))
}

// Linguagens do projeto que a checagem não lê (ou só lê em parte): sem isto, "nenhum problema" engana. Devolve se havia alguma.
export function printGaps(root, feature, command) {
  const gaps = gapLines(detectStack(root).stack, feature)
  if (gaps.length) console.log([`Outside the automatic check (the AI reviews it with ${command}):`, ...gaps].join('\n'))
  return gaps.length > 0
}

// Histórico do git: só na checagem completa. Inteiro uma vez por semana (ou com --history, ou na primeira vez); nas
// outras, só os commits novos desde a última leitura — segundos, em vez de reler tudo a cada vez.
function historyPlan(root, only, whole = false) {
  if (only) return false
  const state = readState(root)
  const last = state.securityHistory
  const fullDue = whole || !last?.tips?.length || !state.securityHistoryAt || Date.now() - new Date(state.securityHistoryAt).getTime() > 7 * 86_400_000
  return { tips: fullDue ? null : last.tips, commits: last?.commits ?? 0 }
}

// Até onde o histórico foi lido (depois de o painel receber os achados dele).
function saveHistory(root, result) {
  if (!result.history) return
  const { tips, commits, full } = result.history
  writeState(root, { securityHistory: { tips, commits }, ...(full ? { securityHistoryAt: new Date().toISOString() } : {}) })
}

function printSecurityScan(result, sent, visible, gaps = false) {
  const { stats } = result
  console.log(
    `Security check: ${stats.files} files${stats.commits ? `, ${stats.commits} commits` : ''}${stats.packages ? `, ${stats.packages} packages` : ''}${stats.tables ? `, ${stats.tables} tables` : ''} in ${(stats.ms / 1000).toFixed(1)} s.`,
  )
  for (const e of result.errors) console.log(`Warning: ${e}`)
  if (stats.history_truncated) console.log('Warning: the git history has more commits than one check reads (3000); the older ones were not checked for keys.')
  if (sent?.truncated) console.log('Warning: more than 2000 findings; the dashboard kept the first 2000 and did not close any finding in this check.')
  if (sent) console.log(`Dashboard: ${sent.added} new, ${sent.fixed} fixed, ${sent.reopened} reopened.`)
  if (sent?.branchHeld?.length) console.log(`${sent.branchHeld.length} finding(s) from another branch were not found here; they stay open on the dashboard until the check runs on the main branch.`)
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
  if (security?.checked_at) console.log(`Last check: ${security.checked_at}`)
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
  out.push(...databaseLines(databaseInventory(root)))
  try {
    const { security, findings } = await securityApi({ action: 'list' })
    pushReview(out, root, security?.review, onlyFiles)
    const order = ['critical', 'high', 'medium', 'low']
    const bySeverity = (list) => [...list].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.ref - b.ref)
    // Achados de revisões anteriores (e os "a conferir"): nenhuma checagem automática os fecha. Vão todos, com a
    // marca de que o arquivo mudou ou sumiu, para esta revisão decidir de novo cada um.
    const earlier = findings.filter((f) => f.origin === 'audit' || f.verdict === 'needs_check')
    if (earlier.length) {
      const mark = fileMarks(root)
      out.push('', `## Open findings from earlier AI reviews (${earlier.length}) — check every one of them again in the code as it is now`)
      for (const f of bySeverity(earlier)) out.push(`- S-${f.ref} [${severityLabel(f)}] ${f.file ?? '(no file)'} — ${f.title}${mark(f)}`)
      out.push(
        'For each one: still true, leave it as it is (do not record it again). The text changed: record it again with the same title and file. A "needs check" you can settle now: record it again without --needs-check. It no longer applies (the code is gone, it was fixed, it was never real): close it with faundr security-resolve S-n --verified "<why it no longer applies>".',
      )
    }
    const packages = findings.filter((f) => f.origin !== 'audit' && f.source === 'dependency' && !f.suppressed && (f.severity === 'critical' || f.severity === 'high'))
    if (packages.length) {
      out.push('', `## Open package problems, high or critical (${packages.length}) — check whether the code reaches the vulnerable part`)
      for (const f of bySeverity(packages)) out.push(`- S-${f.ref} [${SEVERITY_TEXT[f.severity]}] ${f.package ?? f.title}${f.version ? ` ${f.version}` : ''} — ${f.rule_id ?? 'advisory'}`)
    }
    const automatic = findings.filter((f) => !earlier.includes(f))
    out.push('', `## Open problems from the automatic check (${automatic.length}) — do not record them again`)
    for (const f of bySeverity(automatic)) out.push(securityFindingLine(f))
  } catch (err) {
    out.push(`(could not read the problems already recorded: ${err.message})`)
  }
  out.push(...(await patternLines('security')))
  console.log(out.join('\n'))
}

// O que o banco tem (lido das migrações): onde a revisão precisa olhar as regras de acesso.
function databaseLines(db) {
  const out = []
  if (db.definers.length) out.push(`## Database: "security definer" functions (${db.definers.length})`, ...db.definers.map((f) => `- ${f.name} — ${f.where}`), '')
  if (db.policies.length)
    out.push(
      `## Database: policies by table (${db.policies.length} tables)`,
      ...db.policies.map((t) => `- ${t.table}: ${t.policies.map((p) => `${p.command} — ${p.where}`).join('; ')}`),
      '',
    )
  if (db.triggers.length) out.push(`## Database: triggers (${db.triggers.length})`, ...db.triggers.map((t) => `- ${t.name} — ${t.where}`), '')
  if (db.buckets.length) out.push(`## Database: storage buckets (${db.buckets.length})`, ...db.buckets.map((b) => `- ${b.name} (${b.public ? 'public' : 'private'}) — ${b.where}`), '')
  return out
}

// A última revisão com IA e, numa revisão completa, o que mudou desde a última COMPLETA (a rápida entre as duas
// olhou só alguns arquivos e não zera a conta).
function pushReview(out, root, review, onlyFiles) {
  const line = (r) => `${r.at} (${r.mode === 'quick' ? 'quick' : 'full'}). Covered: ${(r.areas ?? []).join('; ') || '-'}. Clean: ${(r.clean ?? []).join('; ') || '-'}.`
  out.push('## Last AI review')
  if (!review) return out.push('None yet.')
  out.push(line(review))
  const full = review.full ?? (review.mode !== 'quick' ? review : null)
  if (review.mode === 'quick') out.push(full ? `Last full review: ${line(full)}` : 'No full review yet.')
  if (full?.files_total) {
    const left = [...(full.not_read ?? []), ...(full.not_read_more ? [`… and ${full.not_read_more} more`] : [])]
    out.push(`The last full review read ${full.files_read} of ${full.files_total} code files.${left.length ? ` Not read then: ${left.join(', ')}` : ''}`)
  }
  // Rodadas somam: a nova começa pelo que mudou desde a última e não trata o resto como "já visto e seguro".
  if (!full || onlyFiles?.length) return
  const changed = changedSince(root, full.at)
  if (changed)
    out.push(
      '',
      `## Changed since the last full review (${changed.length}) — start here and recheck what was "clean" in these files`,
      ...(changed.length ? changed.map((f) => `- ${f}`) : ['- (nothing: focus on what the last one did not cover)']),
    )
}

const severityLabel = (f) => (f.verdict === 'needs_check' ? `needs check, if confirmed ${SEVERITY_TEXT[f.severity]}` : SEVERITY_TEXT[f.severity])

/**
 * Marca de cada achado antigo: o arquivo sumiu, ou mudou depois da última vez que o achado foi gravado (o último
 * commit que mexeu nele, ou a data do arquivo quando ele tem mudança ainda não commitada ou a pasta não tem git).
 */
function fileMarks(root) {
  const run = (a) => spawnSync('git', ['-c', 'core.quotepath=false', ...a], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10_000 })
  const status = run(['status', '--porcelain', '--untracked-files=all'])
  const dirty = status.status === 0 ? new Set(status.stdout.split('\n').map((l) => l.slice(3).replace(/^.* -> /, '').trim().replace(/^"|"$/g, ''))) : null
  const changed = new Map()
  const lastChange = (file) => {
    if (changed.has(file)) return changed.get(file)
    let at = 0
    if (dirty && !dirty.has(file)) {
      const r = run(['log', '-1', '--format=%ct', '--', file])
      at = r.status === 0 ? Number(r.stdout.trim()) * 1000 || 0 : 0
    }
    if (!at) at = fs.statSync(path.join(root, file)).mtimeMs
    changed.set(file, at)
    return at
  }
  return (f) => {
    if (!f.file) return ''
    if (!fs.existsSync(path.join(root, f.file))) return ' [file missing]'
    const since = Date.parse(f.updated_at)
    return since && lastChange(f.file) > since ? ' [file changed since]' : ''
  }
}

// Uma linha por problema de segurança aberto: gravidade, origem, título e onde está.
function securityFindingLine(f) {
  const severity = severityLabel(f)
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
  // Um arquivo SARIF pode trazer várias ferramentas: cada uma entra com os próprios achados (e fecha só os dela).
  for (const { tool, findings } of parseImports(json, maskSecretsIn)) await sendImport(tool, findings)
}

export async function sendImport(tool, findings) {
  const r = await securityApi({ action: 'report', tool, scopes: [], findings, agent: AGENT, agentSessionId: AGENT_SESSION_ID ?? null })
  console.log(`Imported from ${tool}: ${findings.length} problem(s); ${r.added} new, ${r.fixed} that no longer show up were closed. See them under Security on the dashboard.`)
  if (r.truncated) console.log('Warning: more than 2000 problems; the dashboard kept the first 2000 and did not close any earlier one from this tool.')
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

const REVIEW_DONE_USAGE =
  'usage: faundr security-review-done --areas "a; b; c" [--clean "x; y"] [--summary "..."] [--quick] [--files-read <text file with one project-relative path per line>] [--verified <n>] [--ruled-out <n>]'

// O que a revisão leu, comparado com os arquivos de código do projeto: o que ficou de fora vai para o painel.
function reviewCoverage(root, listFile, quick) {
  let text
  try {
    text = fs.readFileSync(path.resolve(listFile), 'utf8')
  } catch (err) {
    throw new Error(`--files-read: could not read ${listFile} (${err.message}). Write the paths you read to a text file, one per line.`)
  }
  const read = new Set(text.split(/\r?\n/).map((l) => l.trim().replace(/\\/g, '/').replace(/^\.\//, '')).filter(Boolean))
  const all = reviewFiles(root)
  const notRead = all.filter((f) => !read.has(f))
  const filesRead = all.length - notRead.length
  // Revisão rápida: olha só alguns arquivos de propósito; o resto do projeto não é "o que faltou".
  if (quick) return { files_read: filesRead, files_total: filesRead, not_read: [] }
  console.log(notRead.length ? `Not read (${notRead.length}): ${notRead.slice(0, 50).join(', ')}${notRead.length > 50 ? `, … and ${notRead.length - 50} more` : ''}` : `All ${all.length} code files were read.`)
  return { files_read: filesRead, files_total: all.length, not_read: notRead.slice(0, 50), ...(notRead.length > 50 ? { not_read_more: notRead.length - 50 } : {}) }
}

export async function securityReviewDone(args) {
  const list = (name) => flag(args, name)?.split(';').map((a) => a.trim()).filter(Boolean) ?? []
  const areas = list('--areas')
  if (!areas.length) throw new Error(REVIEW_DONE_USAGE)
  const quick = args.includes('--quick')
  const count = (name) => {
    const raw = flag(args, name)
    return raw != null && Number.isInteger(Number(raw)) && Number(raw) >= 0 ? Number(raw) : undefined
  }
  const listFile = flag(args, '--files-read')
  const coverage = listFile ? reviewCoverage(linkedProject().root, listFile, quick) : {}
  await securityApi({
    action: 'review-done',
    areas,
    clean: list('--clean'),
    summary: flag(args, '--summary'),
    mode: quick ? 'quick' : 'full',
    ...coverage,
    verified: count('--verified'),
    ruled_out: count('--ruled-out'),
  })
  console.log(`Review recorded: ${areas.length} area(s) covered. It shows in the Security section of the dashboard.`)
}

// Só fecha se a checagem não encontrar mais o problema (marcar à mão não vale). Achado da revisão com IA
// não tem checagem automática: fecha com --verified dizendo como a correção foi conferida.
// O que reler para conferir a correção, pela fonte do achado (a mesma regra do servidor, fileScoped): chave e
// código num arquivo que ainda é do projeto, só o arquivo. Pacote, banco, configuração, .env (o que está fora do
// git só a checagem completa lê) e arquivo que saiu do projeto: a checagem completa.
function recheckFiles(root, f) {
  if (!fileScoped(f) || isEnvFile(f.file)) return null
  return projectFiles(root).files.includes(f.file) ? [f.file] : null
}

const RESOLVE_USAGE =
  'usage: faundr security-resolve S-<n> [--verified "how you checked" (AI review findings)] [--rotated "<what was rotated, where and when>" (keys in the git history)]'
const IGNORE_TEXT = { accepted_risk: 'accepted risk', not_a_problem: 'not an issue' }

export async function securityResolve(args) {
  const text = textArg(args)
  if (!text) throw new Error(RESOLVE_USAGE)
  const rotated = flag(args, '--rotated')
  if (rotated != null && rotated.trim().length < 10) throw new Error('--rotated needs what was rotated, where and when (at least 10 characters), e.g. --rotated "Stripe secret key rolled on the Stripe dashboard on 2026-11-20"')
  const { root } = linkedProject()
  const f = await securityApi({ action: 'get', query: text })
  if (f.status === 'fixed') return console.log(`S-${f.ref} is already fixed.`)
  if (rotated != null && f.source !== 'history') throw new Error(`--rotated is only for keys found in the git history; S-${f.ref} is not one.`)
  if (f.status === 'ignored') return console.log(`S-${f.ref} is ignored on the dashboard (${IGNORE_TEXT[f.ignore_reason] ?? f.ignore_reason}); nothing to close.`)
  if (rotated != null) {
    // Chave do histórico já trocada no provedor: continua nos commits, mas não vale mais nada. Fecha com a nota e
    // a checagem do histórico não a reabre.
    const r = await securityApi({ action: 'rotated', query: text, note: rotated.trim() })
    return console.log(`S-${r.ref} closed: key rotated (${rotated.trim()}). The history check will not reopen it.`)
  }
  if (f.origin === 'audit') {
    const note = flag(args, '--verified')
    if (!note) throw new Error(`S-${f.ref} came from the AI review: reread the fixed code and close it with --verified "what changed and how you checked".`)
    const r = await securityApi({ action: 'verify', query: text, note })
    return console.log(`S-${r.ref} fixed (verified: ${note}).`)
  }
  // Achado que a checagem do Faundr não olha: ela nunca diria "corrigido", e "ainda aparece" faria desfazer o conserto.
  if (f.origin === 'skill')
    return console.log(
      `S-${f.ref} came from a connected skill (${String(f.rule_id).replace(/^skill:/, '')}): the automatic check does not look at it. It closes when that skill runs again and no longer reports it (faundr skill-report). Keep the fix; do not undo it.`,
    )
  if (f.origin === 'import')
    return console.log(
      `S-${f.ref} came from an imported result (${String(f.fingerprint ?? '').split('|')[0] || 'another tool'}): the automatic check does not look at it. It closes when you run that tool again and import the new result (faundr security-import <file>, or faundr security-supabase). Keep the fix; do not undo it.`,
    )
  const history = f.source === 'history'
  const sid = AGENT_SESSION_ID ?? null
  const result = await scanProject(root, { only: history ? null : recheckFiles(root, f), history: history ? { tips: null, commits: 0 } : false })
  const sent = await sendReport(root, result, sid)
  saveHistory(root, result)
  const after = await securityApi({ action: 'get', query: text })
  if (after.status === 'fixed') return console.log(`S-${after.ref} fixed: the check no longer finds the problem.`)
  if (after.status === 'ignored') return console.log(`S-${after.ref} is ignored on the dashboard (${IGNORE_TEXT[after.ignore_reason] ?? after.ignore_reason}); nothing to close.`)
  // "Reapareceu" é a checagem ter achado o mesmo problema de novo; não ter podido olhar é outra coisa.
  const stillThere = result.findings.some((x) => (f.fingerprint ? x.fingerprint === f.fingerprint : x.rule_id === f.rule_id && (x.file ?? null) === (f.file ?? null)))
  if (!stillThere) {
    // O achado é de outra branch (em geral a principal): aqui o problema sumiu, lá ainda existe até isto chegar.
    if (sent.branchHeld?.includes(after.ref)) return console.log(`S-${after.ref} fixed on this branch; it closes on the dashboard when this reaches the main branch. Keep the fix.`)
    // Depende do .env do computador de quem viu: a checagem daqui não lê o arquivo dessa pessoa.
    if (sent.reporterHeld?.includes(after.ref))
      return console.log(`S-${after.ref} depends on the .env of the person who reported it: this computer does not have that file, so only their check closes it. Keep the fix.`)
    // A checagem não achou mais o problema, mas não pôde olhar ali (sem rede para os pacotes, lockfile ou arquivo
    // que não deu para ler, histórico do git que falhou).
    const why = result.errors.length ? ` Check warnings: ${result.errors.slice(0, 3).join('; ')}.` : ''
    return console.log(`S-${after.ref} was not found by the check this time, but the check could not look at it again (no network for the packages, or a file that could not be read), so it stays open.${why} Keep the fix; do not undo it.`)
  }
  if (history)
    return console.log(
      `S-${after.ref} is a key in the git history: deleting it from the code does not remove it from the commits, so the check will keep finding it. What fixes it is replacing the key at the provider. After that, close it with: faundr security-resolve S-${after.ref} --rotated "<what was rotated, where and when>". Keep the fix; do not undo it.`,
    )
  console.log(`S-${after.ref} still shows up in the check. Review the fix:\n`)
  printSecurityFinding(after)
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
