// Design, parte 1: faundr design-lint, design-context, showcase-context, showcase-save, design-finding,
// design-archive e design-reopen.

import fs from 'node:fs'
import path from 'node:path'
import { findDesignMd, isUiFile, lintProject, uiFiles } from './design.mjs'
import { buildShowcase, detectRuntime, readShowcase, SHOWCASE_FILE, showcaseHashes, showcaseStatus } from './showcase.mjs'
import { allScripts } from './parts.mjs'
import { AGENT, AGENT_SESSION_ID, CONFIG_DIR, firstOf, flag, linkedProject, log, QUALITY_FLOOR, readState, textArg, writeState } from './cli-core.mjs'
import { editedFile, sessionEditedFiles } from './hook-stop.mjs'
import { contentLangNote } from './hook-events.mjs'
import { walkFiles } from './cmd-overview.mjs'
import { coverageLines } from './cmd-design-audit.mjs'
import { patternLines } from './patterns.mjs'

// ---- Design ----------------------------------------------------------------------------------

export async function designApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/design`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

export const KIND_LABEL = {
  off_spec: 'off the design',
  duplicate: 'repetition',
  visual: 'visual bug',
  practice: 'good practice',
  responsive: 'responsive',
  a11y: 'accessibility',
  motion: 'motion',
  content: 'content and states',
  identity: 'app identity',
}

export async function designLint(args) {
  const { root } = linkedProject()
  const result = lintProject(root)
  // Começo da conversa: o que já existia não é cobrado no fim da resposta (só o que for novo).
  const sid = flag(args, '--session')
  if (sid && readState(root).designBaseline?.session !== sid)
    writeState(root, { designBaseline: { session: sid, fingerprints: result.findings.map((f) => f.fingerprint) } })
  if (!args.includes('--no-send')) {
    const sent = await designApi({ action: 'report', ...result, agent: AGENT, agentSessionId: sid ?? AGENT_SESSION_ID ?? null })
    writeState(root, { designSkip: { archived: sent.archived ?? [], disabled: sent.disabled ?? [] } })
    // Vitrine: a impressão digital atual dos arquivos das réplicas (o painel marca as desatualizadas).
    let showcase = null
    try {
      showcase = readShowcase(root)
    } catch {
      // Sem vitrine (ou ilegível): não manda as impressões digitais.
    }
    if (showcase) await designApi({ action: 'hashes', fileHashes: showcaseHashes(root, showcase) })
  }
  if (args.includes('--quiet'))
    return log(`design: ${result.designMdPath ?? 'no design.md'}, ${result.findings.length} finding(s) in ${result.uiFiles} screen files`)
  if (args.includes('--json')) return console.log(JSON.stringify(result, null, 2))
  console.log(result.designMdPath ? `design.md: ${result.designMdPath}` : 'design.md: NOT FOUND — create one with /faundr:design')
  console.log(`Screen files: ${result.uiFiles}`)
  if (!result.findings.length) return console.log('No problems found by the automatic check.')
  console.log(`\nAutomatic check findings (${result.findings.length}):`)
  for (const f of result.findings) console.log(`  [${KIND_LABEL[f.kind]}] ${f.title}\n      ${f.file}:${f.line} — ${f.detail}`)
}

/**
 * Achados da checagem automática que surgiram nesta conversa, nos arquivos editados: não estavam na foto do
 * começo da sessão, não estão arquivados e a regra não foi desligada. Os antigos ficam só no painel.
 */
export function newDesignFindings(root, sid, files) {
  const state = readState(root)
  const baseline = state.designBaseline?.session === sid ? new Set(state.designBaseline.fingerprints) : null
  if (!baseline) return [] // sem foto do começo, não dá para separar o novo do antigo
  const archived = new Set(state.designSkip?.archived ?? [])
  const disabled = new Set(state.designSkip?.disabled ?? [])
  const off = (rule) => !!rule && (disabled.has(rule) || disabled.has(`${rule.split('/')[0]}/*`))
  const touched = new Set(files)
  try {
    return lintProject(root).findings.filter(
      (f) => f.file && touched.has(f.file) && !baseline.has(f.fingerprint) && !archived.has(f.fingerprint) && !off(f.rule),
    )
  } catch {
    // A checagem automática falhou: não barra o fim da resposta por isso (a completa roda com faundr design-lint).
    return []
  }
}

// Arquivos de tela editados nesta sessão que ainda não passaram pela auditoria rápida (só com design.md).
// Só o que foi editado depois da última auditoria: o marcador cresce uma linha por edição, e o estado
// guarda quantas linhas já tinham sido auditadas.
export function designAuditFiles(root, sid) {
  if (!findDesignMd(root)) return []
  const last = readState(root).designAudited
  const seen = last?.session === sid ? (last.lines ?? Infinity) : 0
  return sessionEditedFiles(sid, seen)
    .map((f) => path.relative(root, path.resolve(root, f)).split(path.sep).join('/'))
    .filter((rel) => !rel.startsWith('..') && isUiFile(rel))
    .slice(0, 15)
}

// No fim da resposta, refaz a checagem sem IA se algum arquivo de tela foi editado desde a última vez.
export function takeDesignDirty(projectId, payload) {
  const sid = payload.session_id
  if (!sid || !sessionEditedFiles(sid).some((f) => isUiFile(f.replace(/\\/g, '/')))) return false
  const marker = path.join(CONFIG_DIR, `design-${projectId}.checked`)
  let last = 0
  try {
    last = fs.statSync(marker).mtimeMs
  } catch {
    // Primeira checagem desta sessão: sem marcador.
  }
  if (fs.statSync(editedFile(sid)).mtimeMs <= last) return false
  fs.writeFileSync(marker, new Date().toISOString())
  return true
}

// O script "dev" da raiz ou, num projeto dividido, o de uma parte (ex.: frontend/package.json).
function devServerUrl(root) {
  for (const { cmd } of allScripts(root).filter((s) => s.name === 'dev')) {
    const port = cmd.match(/--port[= ](\d+)/)?.[1] ?? firstOf([[/next/.test(cmd), '3000'], [/vite/.test(cmd), '5173']], null)
    if (port) return `http://localhost:${port}`
  }
  return null
}

// Pacote de contexto que o agente lê para criar o design.md ou auditar as telas (skill "design").
export async function designContext(args) {
  const { root } = linkedProject()
  const onlyFiles = flag(args, '--files')
    ?.split(',')
    .map((f) => f.trim())
    .filter(Boolean)
  const result = lintProject(root)
  const files = uiFiles(root)
  const out = ['# Project design context', await contentLangNote(root)]
  out.push(`Mode: ${onlyFiles?.length ? `quick (only ${onlyFiles.join(', ')})` : 'full'}`)
  out.push(`Likely development server: ${devServerUrl(root) ?? '(not identified — see package.json)'}`)
  out.push(`Quality floor (read it before auditing or fixing): ${QUALITY_FLOOR}`)
  out.push('')
  if (result.designMdPath) {
    out.push(`## design.md (${result.designMdPath})`, '', fs.readFileSync(path.join(root, result.designMdPath), 'utf8').slice(0, 20_000))
  } else {
    out.push('## design.md', '', 'DOES NOT EXIST. The first step is to create one (see the skill).')
  }
  // Onde ficam os tokens hoje (css global / tema).
  const cssFiles = walkFiles(root, root)
    .filter((f) => /\.(css|scss)$/.test(f) && !f.startsWith('plugin/'))
    .slice(0, 5)
  for (const css of cssFiles) {
    out.push('', `## Global styles: ${css}`, '', '```css', fs.readFileSync(path.join(root, css), 'utf8').slice(0, 6000), '```')
  }
  out.push('', `## Screen files (${files.length})`, ...files.map((f) => `- ${f}`))
  out.push('', `## Automatic check (no AI): ${result.findings.length} finding(s)`)
  for (const f of result.findings) out.push(`- [${KIND_LABEL[f.kind]}] ${f.title} — ${f.file}:${f.line}. ${f.detail}`)
  try {
    const { findings, archived = [], design, disabled = [] } = await designApi({ action: 'list' })
    const audit = findings.filter((f) => f.origin !== 'lint')
    out.push('', `## Open findings from the audit and reported by the person (${audit.length})`)
    for (const f of audit)
      out.push(`- D-${f.ref} [${KIND_LABEL[f.kind]} · ${f.rule}] ${f.title}${f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : ''}`)
    // Escopo e arquivados: o que o dono decidiu que não vale aqui (não registre de novo).
    out.push('', '## Design scope (decided by the owner)', ...scopeLines({ scope: design?.scope, disabled }))
    if (!design?.scope?.mobile)
      out.push('- (scope not defined yet: in full mode, ask and save it with faundr design-scope)')
    out.push('', '## Last coverage of the full audit', ...coverageLines(design?.coverage))
    if (archived.length) {
      out.push('', `## Archived findings (${archived.length}) — do not record them again`)
      for (const f of archived)
        out.push(`- D-${f.ref} [${f.rule}] ${f.title}${f.file ? ` — ${f.file}` : ''} — ${ARCHIVE_REASON_LABEL[f.archive_reason] ?? f.archive_reason}${f.archive_note ? `: ${f.archive_note}` : ''}`)
    }
  } catch (err) {
    out.push('', `(could not read the previous findings: ${err.message})`)
  }
  out.push('', ...(await patternLines('design')))
  console.log(out.join('\n'))
}

const RUNTIME_NOTE = {
  tailwind4:
    "Tailwind 4: the replica runs with Tailwind in the browser and with the project's CSS (theme, @layer components, fonts). Copy the classes from the component's code as they are (including custom classes, e.g. .f-btn).",
  tailwind3:
    "Tailwind 3: the replica runs with Tailwind in the browser and with the project's CSS, but WITHOUT tailwind.config (the config's own colors and fonts do not exist there). For those, use arbitrary values (bg-[#151515]) or style=\"\".",
  css: "Plain CSS: the replica gets the project's global .css files (no CSS Modules or CSS-in-JS). Use the same global classes; whatever comes from CSS Modules or styled-components, write in style=\"\" with the values from design.md.",
}

// Pacote de contexto para o agente gerar as réplicas da Vitrine (skill "design-showcase").
export async function showcaseContext() {
  const { root } = linkedProject()
  const designMdPath = findDesignMd(root)
  const runtime = detectRuntime(root)
  const out = ['# Design Showcase context', await contentLangNote(root), '', `How CSS runs in the replica: ${RUNTIME_NOTE[runtime]}`]
  if (designMdPath) {
    const md = fs.readFileSync(path.join(root, designMdPath), 'utf8')
    // A seção de componentes é o que importa; o resto do design.md vai resumido pelos títulos.
    const comp = md.match(/^##\s+(Componentes|Components)[^\n]*\n[\s\S]*?(?=^##\s|(?![\s\S]))/m)?.[0]
    out.push('', `## design.md (${designMdPath})`)
    if (comp) out.push('', comp.trim().slice(0, 15_000), '', 'Other sections of design.md: ' + [...md.matchAll(/^##\s+(.+)/gm)].map((m) => m[1]).join(' · '))
    else out.push('', md.slice(0, 15_000))
  } else {
    out.push('', '## design.md', '', 'DOES NOT EXIST. Suggest creating it with /faundr:design first; without it, pick the components reused across several screens.')
  }
  const files = uiFiles(root)
  out.push('', `## Screen files (${files.length})`, ...files.map((f) => `- ${f}`))
  let showcase = null
  let invalid = false
  try {
    showcase = readShowcase(root)
  } catch (err) {
    invalid = true
    out.push('', `## ${SHOWCASE_FILE}`, '', `EXISTS BUT IS INVALID (${err.message}). Rewrite the file.`)
  }
  if (showcase) {
    const status = showcaseStatus(root, showcase)
    out.push('', `## Current Showcase (${SHOWCASE_FILE}): ${status.length} replica(s)`)
    for (const s of status) out.push(`- ${s.name} — ${s.state}${s.files.length ? ` (${s.files.join(', ')})` : ''}`)
    const todo = status.filter((s) => s.state !== 'atual').length
    out.push('', todo ? `Redo only the ${todo} that are not "atual" (up to date) and add the components that are missing.` : 'All are up to date: only add the components that are missing (or redo them if the user asks).')
  } else if (!invalid) {
    out.push('', `## Current Showcase`, '', `${SHOWCASE_FILE} does not exist yet: generate all the replicas.`)
  }
  console.log(out.join('\n'))
}

export async function showcaseSave(args) {
  const { root } = linkedProject()
  const file = path.resolve(root, args.find((a) => !a.startsWith('--')) ?? SHOWCASE_FILE)
  let showcase
  try {
    showcase = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    console.error(`Could not read ${path.relative(root, file)}: ${err.message}`)
    process.exit(1)
  }
  const { problems, payload, cssFiles, truncated } = buildShowcase(root, showcase)
  if (problems.length) {
    console.error(`Showcase has problems (fix them and run again):\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    process.exit(1)
  }
  // Guarda a impressão digital no arquivo local (o showcase-context usa para achar as desatualizadas).
  fs.writeFileSync(file, JSON.stringify({ ...showcase, components: payload.components }, null, 2) + '\n')
  const res = await designApi({ action: 'showcase', ...payload })
  const fontKb = Math.round(payload.fonts.reduce((n, f) => n + f.data.length * 0.75, 0) / 1024)
  console.log(
    `Showcase sent: ${res.components} component(s), ${res.variants} variant(s). CSS: ${cssFiles.join(', ') || 'none'}${truncated ? ' (cut at 500 KB)' : ''}; ${payload.fonts.length} font(s), ${fontKb} KB. It shows under Design → Showcase on the dashboard.`,
  )
}

export async function designFinding(args) {
  const title = textArg(args)
  const kind = flag(args, '--kind')
  if (!title || !kind)
    throw new Error(
      `usage: faundr design-finding "<title>" --kind ${Object.keys(KIND_LABEL).join('|')} [--rule theme/name] [--severity high|medium|low] [--file path] [--line n] [--detail "..."] [--manual]`,
    )
  const line = Number(flag(args, '--line'))
  const r = await designApi({
    action: 'add',
    // --manual: a pessoa viu e reportou (/faundr:design-report); sem ele, é achado da auditoria do agente.
    origin: args.includes('--manual') ? 'manual' : 'audit',
    finding: {
      title,
      kind,
      rule: flag(args, '--rule'),
      severity: flag(args, '--severity'),
      file: flag(args, '--file'),
      line: Number.isInteger(line) && line > 0 ? line : null,
      detail: flag(args, '--detail'),
    },
  })
  if (r.skipped) return console.log(`Not recorded: ${r.message} (the owner turned it off). Do not insist on this problem.`)
  if (r.archived) return console.log(`D-${r.ref} was already archived (${r.title}); it stays archived. Do not insist on this problem.`)
  console.log(`Design finding D-${r.ref} recorded: ${r.title}`)
}

export const ARCHIVE_REASON_LABEL = {
  'nao-se-aplica': 'does not apply to this project',
  'falso-alarme': 'false alarm',
  'decisao-de-design': 'design decision',
}

// O agente arquiva com evidência (aparece como "arquivado pelo Claude" no painel; o dono pode reabrir).
export async function designArchive(args) {
  const text = textArg(args)
  // O banco guarda o código em português; o nome em inglês é o que as skills mostram.
  const typedReason = flag(args, '--reason')
  const reason = { 'not-applicable': 'nao-se-aplica', 'false-alarm': 'falso-alarme', 'design-decision': 'decisao-de-design' }[typedReason] ?? typedReason
  const note = flag(args, '--note')
  if (!text || !Object.hasOwn(ARCHIVE_REASON_LABEL, reason) || !note)
    throw new Error('usage: faundr design-archive D-<n> --reason not-applicable|false-alarm|design-decision --note "<evidence: who decided and why>"')
  const r = await designApi({ action: 'archive', query: text, reason, note })
  console.log(`Finding D-${r.ref} archived (${ARCHIVE_REASON_LABEL[reason]}): ${r.title}. Tell the user in the response.`)
}

export async function designReopen(args) {
  const text = textArg(args)
  if (!text) throw new Error('usage: faundr design-reopen D-<n>')
  const r = await designApi({ action: 'reopen', query: text })
  console.log(`Finding D-${r.ref} reopened: ${r.title}`)
}

export const SCOPE_LABEL = {
  product: { app: 'app/dashboard', site: 'site/landing', misto: 'app and site' },
  mobile: { sim: 'must work on mobile', desktop: 'desktop only (does not need to be responsive)', celular: 'made for mobile' },
  theme: { escuro: 'dark theme', claro: 'light theme', ambos: 'light and dark theme' },
  motion: { nenhum: 'no animation', sobrio: 'subtle motion', expressivo: 'expressive motion' },
}

export function scopeLines(s) {
  const out = []
  for (const [k, labels] of Object.entries(SCOPE_LABEL)) out.push(`- ${k}: ${s.scope?.[k] ? `${s.scope[k]} (${labels[s.scope[k]]})` : 'not defined'}`)
  for (const e of s.scope?.exceptions ?? []) out.push(`- decided exception: ${e}`)
  out.push(`- turned-off rules: ${s.disabled?.length ? s.disabled.join(', ') : 'none'}`)
  return out
}
