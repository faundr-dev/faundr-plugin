// Stack e passagem: faundr stack-scan, env-check, handover, weekly, stack-context, stack-save, handoff e resume.

import fs from 'node:fs'
import path from 'node:path'
import { ensureFaundrPath, faundrPath, relPath } from './paths.mjs'
import { projectFiles } from './security.mjs'
import { detectStack } from './stack.mjs'
import { envMatrix, hostingFromCli, hostingProvider } from './env-matrix.mjs'
import { AGENT, AGENT_SESSION_ID, firstOf, flag, gitHead, linkedProject, textArg, writeState } from './cli-core.mjs'
import { contentLangNote } from './hook-events.mjs'
import { memoryApi } from './cmd-features.mjs'
import { walkFiles } from './cmd-overview.mjs'
import { maskSecretsIn } from './cmd-security.mjs'

async function stackApi(body) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/stack`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

const LAYER_LABEL = { front: 'Front (screens)', back: 'Back (server)', banco: 'Database', arquivos: 'Files', auth: 'Login', dominio: 'Domain', deploy: 'Deploy', agendado: 'Scheduled tasks', outro: 'Other' }

export async function stackScan(args) {
  const { root } = linkedProject()
  const { stack, hash } = detectStack(root)
  if (args.includes('--json')) return console.log(JSON.stringify(stack, null, 1))
  const r = await stackApi({ action: 'scan', detected: stack, hash })
  if (args.includes('--quiet')) return
  console.log(`Stack detected${r.changed ? ' and sent' : ' (nothing changed since last time)'}:`)
  for (const h of stack.hosting) console.log(`- ${LAYER_LABEL[h.layer] ?? h.layer}: ${h.provider}${h.detail ? ` — ${h.detail}` : ''}`)
  console.log(`- Languages: ${stack.languages.slice(0, 5).map((l) => `${l.name} ${l.percent}%`).join(', ') || '-'}`)
  console.log(`- ${stack.tech.length} technologies, ${stack.services.length} services, ${stack.env.length} environment variables`)
  console.log('For the explanation in plain language (and what the files do not say), run /faundr:stack.')
}

// Variáveis por ambiente: código x exemplo x .env do computador x hospedagem (só nomes).
const ENV_KIND_TEXT = { 'falta-no-ar': 'breaks live', 'falta-no-computador': 'missing on this computer', 'fora-do-exemplo': 'not in the example', sobrando: 'unused' }
const yesNo = (v) => firstOf([[v === true, 'yes'], [v === false, 'NO']], '?')

export async function envCheck(args) {
  const { root } = linkedProject()
  const { files } = projectFiles(root)
  if (args.includes('--hosting')) {
    const provider = hostingProvider(files)
    if (!provider) console.log('Could not recognize the hosting (Cloudflare, Vercel or Netlify) to list its variables.')
    else {
      const r = hostingFromCli(root, provider)
      if (r.error) console.log(`Could not list the variables on the hosting (${provider}): ${r.error}. Sign in to the provider's CLI and run it again.`)
      else {
        fs.writeFileSync(ensureFaundrPath(root, 'envHosting'), JSON.stringify({ provider, at: new Date().toISOString(), names: r.names }, null, 1))
        console.log(`Hosting (${provider}): ${r.names.length} secret variable(s) listed (names only).`)
      }
    }
  }
  const m = envMatrix(root, files)
  if (!args.includes('--quiet')) {
    console.log(`Variables (${m.rows.length}) — code · example · computer · live${m.hosting ? ` (${m.hosting.provider})` : ''}:`)
    for (const r of m.rows)
      console.log(`  ${r.name}${r.scope === 'publica' ? ' [browser]' : ''}: ${r.code.length ? 'yes' : 'no'} · ${yesNo(r.example)} · ${yesNo(r.local)} · ${yesNo(r.hosting)}${r.optional ? ' (optional)' : ''}`)
    if (!m.problems.length) console.log('No problems.')
    for (const p of m.problems) console.log(`  [${ENV_KIND_TEXT[p.kind]}] ${p.text}`)
    if (!m.hosting)
      console.log('\n"?" live = the files cannot tell. To check on the hosting (names only): faundr env-check --hosting (needs the provider\'s CLI signed in).')
  }
  if (!args.includes('--no-send')) await stackApi({ action: 'env', envCheck: m })
}

// Pacote de passagem (um documento para um dev assumir o projeto) e resumo da semana (para sócios).
async function reportApi(kind) {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, kind }),
    signal: AbortSignal.timeout(60_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  return data
}

export async function handover(args) {
  const { root } = linkedProject()
  const { markdown } = await reportApi('handover')
  const out = path.resolve(root, flag(args, '--out') ?? relPath('handover'))
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, markdown)
  console.log(`Handover pack saved to ${path.relative(root, out) || out} (${markdown.split('\n').length} lines). It can also be downloaded on the dashboard: Activity → Handover to a developer.`)
}

export async function weekly() {
  const { text } = await reportApi('weekly')
  console.log(text)
}

// Pacote de contexto que o agente lê para revisar a Stack.
export async function stackContext() {
  const { root } = linkedProject()
  const { stack, hash } = detectStack(root)
  const prev = await stackApi({ action: 'get' })
  const out = []
  const say = (s = '') => out.push(s)
  say(`# Context for the Project stack of "${prev.project}"`)
  say(await contentLangNote(root, prev.contentLang))
  say(`Current commit: ${gitHead(root) ?? '(no git)'} · detection fingerprint: ${hash}`)
  say()
  say('## Previous review')
  if (prev.stack?.content) {
    say(`Done on ${prev.stack.content_at}. UPDATE it; keep what is still true (including what you found outside the files).`)
    say('```json')
    say(JSON.stringify(prev.stack.content, null, 1))
    say('```')
  } else say('(none — this is the first one)')
  say()
  say('## Detected now in the files (no AI — may have noise; check it)')
  say('```json')
  say(JSON.stringify({ ...stack, languages: undefined }, null, 1))
  say('```')
  say(`Languages (counted by the CLI, do not write them): ${stack.languages.map((l) => `${l.name} ${l.percent}%`).join(', ')}`)
  say()
  // Arquivos de configuração que dizem onde e como o projeto roda (sem .env: valores nunca entram aqui).
  say('## Configuration files')
  const files = walkFiles(root, root)
  const CONFIG = /^(wrangler\.(jsonc?|toml)|vercel\.json|netlify\.toml|fly\.toml|render\.ya?ml|railway\.(json|toml)|firebase\.json|Dockerfile|(docker-)?compose\.ya?ml|Procfile|app\.ya?ml|serverless\.ya?ml|supabase\/config\.toml|\.github\/workflows\/.*\.ya?ml|vite\.config\.[mc]?[jt]s|next\.config\.[mc]?[jt]s|astro\.config\.[mc]?[jt]s|prisma\/schema\.prisma|drizzle\.config\.[jt]s)$/
  let budget = 16_000
  for (const rel of files.filter((f) => CONFIG.test(f)).slice(0, 20)) {
    if (budget <= 0) break
    const text = maskSecretsIn(fs.readFileSync(path.join(root, rel), 'utf8')).slice(0, Math.min(3000, budget))
    budget -= text.length
    say(`### ${rel}`)
    say('```')
    say(text.trimEnd())
    say('```')
  }
  say()
  // Trechos dos documentos que falam de deploy, hospedagem e ambiente.
  say('## What the documents say about deploy and environment')
  let docBudget = 6000
  for (const rel of files.filter((f) => /\.mdx?$/i.test(f) && !/(^|\/)(SKILL|CHANGELOG)\.md$/i.test(f)).slice(0, 60)) {
    if (docBudget <= 0) break
    const lines = fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/)
    const hits = lines.flatMap((l, i) => (/deploy|hosped|vercel|cloudflare|netlify|produç|production|staging|domínio|domain|\.env\b|secret/i.test(l) ? [i] : []))
    if (!hits.length) continue
    const excerpt = maskSecretsIn(hits.slice(0, 6).map((i) => lines.slice(Math.max(0, i - 1), i + 2).join('\n')).join('\n…\n')).slice(0, 1200)
    docBudget -= excerpt.length
    say(`### ${rel}`)
    say(excerpt)
  }
  say()
  say('## Recorded decisions')
  const b = await memoryApi({ action: 'board' })
  for (const d of b.decisions ?? []) say(`- ${d.title}${d.body ? ` — ${d.body}` : ''}`)
  if (!(b.decisions ?? []).length) say('(none)')
  console.log(out.join('\n'))
}

export async function stackSave(args) {
  const { root } = linkedProject()
  const file = path.resolve(textArg(args) || faundrPath(root, 'stack'))
  let content
  try {
    content = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`Could not read ${file} as JSON: ${err.message}`)
  }
  const { stack, hash } = detectStack(root)
  const r = await stackApi({
    action: 'save',
    detected: stack,
    hash,
    content,
    commit: gitHead(root),
    agent: AGENT,
    agentSessionId: AGENT_SESSION_ID ?? null,
  })
  console.log(`Project stack saved: ${r.hosting} hosting pieces, ${r.tech} technologies, ${r.services} services, ${r.env} variables. It already shows under Project stack on the dashboard.`)
}

export async function handoffCommand(args) {
  const text = textArg(args)
  if (!text) throw new Error('usage: faundr handoff "<what was left half done and what is missing>"')
  const { root, projectId, config } = linkedProject()
  const agentSessionId = AGENT_SESSION_ID ?? null
  const res = await fetch(`${config.apiUrl}/api/cli/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, action: 'handoff', text, agent: AGENT, agentSessionId }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  if (agentSessionId) writeState(root, { lastHandoff: { session: agentSessionId, at: new Date().toISOString() } })
  console.log('Handoff note saved. It shows under Activity → Where I left off and at the start of the next session.')
}

export async function resumeCommand() {
  const { projectId, config } = linkedProject()
  const res = await fetch(`${config.apiUrl}/api/cli/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, action: 'resume', agent: AGENT, agentSessionId: AGENT_SESSION_ID ?? null }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  console.log(data.text)
}
