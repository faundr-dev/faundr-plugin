// Conta e ligação: faundr login, link, status, a barra de status (statusline), usage --debug e agents-md.

import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ensureFaundrPath, faundrPath } from './paths.mjs'
import { transcriptUsage } from './usage.mjs'
import { metersSnapshot, statusLine } from './statusline.mjs'
import { agentsBlock, removeBlock, upsertBlock } from './agents-md.mjs'
import { t } from './i18n.mjs'
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_API_URL, findUp, firstOf, flags, gitBranch, LINK_FILE, linkedProject, loadConfig, log, LOG_FILE, projectRoot, readJson, readState, readStdin, saveConfig, writeState } from './cli-core.mjs'
import { dirtyFile } from './hook-events.mjs'
import { memoryApi } from './cmd-features.mjs'

export async function fetchProjects({ token, apiUrl }) {
  const res = await fetch(`${apiUrl}/api/cli/projects`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 401) throw new Error(t('Invalid token. Sign in again (/faundr:login).', 'Token inválido. Faça o login de novo (/faundr:login).'))
  if (!res.ok) throw new Error(t(`API error (${res.status}): ${await res.text()}`, `Erro da API (${res.status}): ${await res.text()}`))
  return res.json()
}

// Login pelo navegador: o token nasce aqui e só o hash vai para o Faundr; o dono aprova o código no painel
// (/autorizar) e o token passa a valer. Assim ele nunca aparece no chat. Enquanto espera, fica em
// ~/.faundr/pending-login.json (só neste computador, como o config.json).
const PENDING_LOGIN_FILE = path.join(CONFIG_DIR, 'pending-login.json')
const LOGIN_WAIT_MS = 5 * 60_000

export async function login(args) {
  const urlAt = args.indexOf('--url')
  const apiUrl = (urlAt >= 0 ? args[urlAt + 1] : (readJson(CONFIG_FILE)?.apiUrl ?? DEFAULT_API_URL)).replace(/\/+$/, '')
  const token = args.find((a, i) => !a.startsWith('--') && i !== urlAt + 1)
  if (token) {
    const projects = await fetchProjects({ token, apiUrl }) // valida antes de salvar
    saveConfig({ token, apiUrl })
    return console.log(t(`Signed in (API: ${apiUrl}). You have ${projects.length} project(s).`, `Login feito (API: ${apiUrl}). Você tem ${projects.length} projeto(s).`))
  }
  const wait = args.includes('--wait')
  if (!wait) await startLogin(apiUrl)
  if (!args.includes('--start')) await waitLogin()
}

async function startLogin(apiUrl) {
  const token = `fdr_${randomBytes(32).toString('base64url')}`
  const res = await fetch(`${apiUrl}/api/cli/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tokenHash: createHash('sha256').update(token).digest('hex'), label: `Plugin · ${os.hostname()}` }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(t(`API error (${res.status}): ${await res.text()}`, `Erro da API (${res.status}): ${await res.text()}`))
  const { code, expiresInSeconds } = await res.json()
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const pending = { token, apiUrl, code, expiresAt: Date.now() + expiresInSeconds * 1000 }
  fs.writeFileSync(PENDING_LOGIN_FILE, JSON.stringify(pending), { mode: 0o600 })
  const url = `${apiUrl}/autorizar?code=${code}`
  openBrowser(url)
  console.log(t(`Code: ${code}`, `Código: ${code}`))
  console.log(
    t(
      `Opened the browser at ${url} (if it did not open, open the link). Check that the code is the same and click Authorize.`,
      `Abri o navegador em ${url} (se não abriu, abra o link). Confira se o código é o mesmo e clique em Autorizar.`,
    ),
  )
}

async function waitLogin() {
  const pending = readJson(PENDING_LOGIN_FILE)
  if (!pending?.token || pending.expiresAt < Date.now())
    throw new Error(t('No pending sign-in (the code is valid for 10 minutes). Run /faundr:login again.', 'Nenhum login pendente (o código vale 10 minutos). Rode /faundr:login de novo.'))
  const until = Math.min(Date.now() + LOGIN_WAIT_MS, pending.expiresAt)
  while (Date.now() < until) {
    try {
      const projects = await fetchProjects(pending)
      saveConfig({ token: pending.token, apiUrl: pending.apiUrl })
      fs.rmSync(PENDING_LOGIN_FILE, { force: true })
      return console.log(t(`Signed in (API: ${pending.apiUrl}). You have ${projects.length} project(s).`, `Login feito (API: ${pending.apiUrl}). Você tem ${projects.length} projeto(s).`))
    } catch (err) {
      if (!/Token inválido|Invalid token/.test(err.message)) throw err
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  console.log(
    t(
      `Not authorized yet. Open ${pending.apiUrl}/autorizar?code=${pending.code}, click Authorize and run: faundr login --wait`,
      `Ainda não autorizado. Abra ${pending.apiUrl}/autorizar?code=${pending.code}, clique em Autorizar e rode: faundr login --wait`,
    ),
  )
}

export function openBrowser(url) {
  const [cmd, cmdArgs] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]]
  try {
    spawn(cmd, cmdArgs, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
  } catch {
    // Sem navegador (servidor, SSH): o link já vai impresso.
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// O projeto pelo id ou pelo nome exato (sem nada: nenhum).
function findProject(projects, query) {
  if (!query) return undefined
  if (UUID.test(query)) return projects.find((p) => p.id === query.toLowerCase())
  return projects.find((p) => p.name.toLowerCase() === query.toLowerCase())
}

// Aceita o id, o nome do projeto ou nada (lista os projetos para escolher).
export async function link(query) {
  const config = loadConfig()
  if (!config.token) throw new Error(t('No token. Sign in first (/faundr:login).', 'Sem token. Faça o login primeiro (/faundr:login).'))
  const projects = await fetchProjects(config)
  const project = findProject(projects, query)
  if (!project) {
    if (query) console.log(t(`No project found for "${query}".`, `Nenhum projeto encontrado para "${query}".`))
    console.log(projects.length ? t('Available projects:', 'Projetos disponíveis:') : t('You have no projects yet. Create one on the dashboard.', 'Você ainda não tem projetos. Crie um no painel.'))
    for (const p of projects) console.log(`- ${p.name}${p.org ? ` — ${p.org}` : ''} (${p.id})`)
    return
  }
  fs.writeFileSync(LINK_FILE, JSON.stringify({ projectId: project.id }, null, 2) + '\n')
  console.log(t(`Folder ${process.cwd()} linked to the project "${project.name}" (${project.id}).`, `Pasta ${process.cwd()} ligada ao projeto "${project.name}" (${project.id}).`))
}

export function status() {
  const { token, apiUrl } = loadConfig()
  const linkFile = findUp(process.cwd(), LINK_FILE)
  console.log(`API:     ${apiUrl}`)
  console.log(`Token:   ${token ? `${token.slice(0, 6)}…` : t('(not set — use /faundr:login)', '(não configurado — use /faundr:login)')}`)
  console.log(`${t('Project:', 'Projeto:')} ${linkFile ? `${readJson(linkFile)?.projectId} (${linkFile})` : t('(folder not linked — use /faundr:link)', '(pasta não ligada — use /faundr:link)')}`)
  console.log(`Branch:  ${gitBranch(process.cwd()) ?? '-'}`)
  const graphFile = faundrPath(projectRoot(), 'graph')
  console.log(`${t('Graph:  ', 'Grafo:  ')} ${fs.existsSync(graphFile) ? graphFile : t('(not built yet — use /faundr:map)', '(ainda não gerado — use /faundr:map)')}`)
  console.log(`Log:     ${LOG_FILE}`)
}

// Mapa do código na barra: sem mapa (null), desatualizado (edição esperando a próxima geração) ou em dia.
function graphFreshness(hasGraph, projectId) {
  if (!hasGraph) return null
  return projectId && fs.existsSync(dirtyFile(projectId)) ? 'stale' : 'fresh'
}

// Barra de status do Claude Code: recebe o JSON da sessão no stdin e imprime uma linha, só com arquivos locais.
export async function statusline() {
  let input = {}
  try {
    input = JSON.parse((await readStdin()) || '{}')
  } catch {
    // Entrada vazia ou inválida: a barra mostra o que der com a pasta atual.
  }
  const cwd = input.workspace?.current_dir ?? input.cwd ?? process.cwd()
  const linkFile = findUp(cwd, LINK_FILE)
  if (!linkFile) return
  const root = path.dirname(linkFile)
  const { projectId } = readJson(linkFile) ?? {}
  const hasGraph = fs.existsSync(faundrPath(root, 'graph'))
  const graph = graphFreshness(hasGraph, projectId)
  // Contexto, janelas de uso e custo vêm do próprio Claude Code (stdin); a largura, de COLUMNS.
  const width = Number(process.env.COLUMNS) > 20 ? Number(process.env.COLUMNS) - 2 : 120
  process.stdout.write(statusLine(readState(root).status, { graph, input, prefs: readJson(faundrPath(root, 'bar')) ?? undefined, width }))
  // Insights: guarda os medidores para o fim da resposta enviar. Só grava quando mudam (ou a cada minuto).
  const meters = metersSnapshot(input)
  if (meters) {
    const file = faundrPath(root, 'meters')
    const prev = readJson(file)
    const same = prev && JSON.stringify({ ...prev, at: 0 }) === JSON.stringify({ ...meters, at: 0 })
    if (!same || meters.at - (prev.at ?? 0) > 60_000) fs.writeFileSync(ensureFaundrPath(root, 'meters'), JSON.stringify(meters))
  }
}

// O que o Impacto receberia desta sessão (docs/impacto-contrato.md): só números, lidos da conversa.
export function usageDebug(args) {
  const { root } = linkedProject()
  const given = args.find((a) => !a.startsWith('--'))
  const recent = Object.values(readState(root).usageTranscripts ?? {}).sort((a, b) => b.at - a.at)[0]?.path
  const file = given || recent
  if (!file) throw new Error('No conversation remembered in this folder yet. Pass the file: faundr usage --debug <conversation.jsonl>')
  const usage = transcriptUsage(file)
  if (!usage) throw new Error(`Could not find the conversation ${file}`)
  console.log(`Conversation: ${file}`)
  console.log(JSON.stringify(usage, null, 2))
  console.log("Fields explained in docs/impacto-contrato.md (in Faundr's repository).")
}

// Bloco com as regras e decisões no AGENTS.md/CLAUDE.md, para agentes sem os hooks do Faundr (desligado por padrão).
export async function agentsMd(args) {
  const { root } = linkedProject()
  const chosen = flags(args, '--file')
  const saved = readState(root).agentsMd ?? []
  if (args.includes('--off')) {
    for (const f of chosen.length ? chosen : saved) console.log(`${f}: ${removeBlock(path.join(root, f))}`)
    writeState(root, { agentsMd: chosen.length ? saved.filter((f) => !chosen.includes(f)) : [] })
    return console.log('Faundr block turned off.')
  }
  // --sync: só atualiza o que já foi ligado (roda no começo de cada sessão).
  const files = firstOf([[args.includes('--sync'), saved], [chosen.length, chosen], [saved.length, saved]], ['AGENTS.md'])
  if (!files.length) return
  const { decisions, projectName } = await memoryApi({ action: 'board' })
  const body = agentsBlock(decisions ?? [], projectName)
  const results = files.map((f) => `${f}: ${upsertBlock(path.join(root, f), body)}`)
  writeState(root, { agentsMd: [...new Set([...saved, ...files])] })
  if (args.includes('--quiet')) return log(`agents-md: ${results.join('; ')}`)
  console.log(results.join('\n'))
  console.log(`${(decisions ?? []).length} rule(s) and decision(s) in the block. It updates at the start of every session; to remove it: faundr agents-md --off`)
}
