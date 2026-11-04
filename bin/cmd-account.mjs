// Conta e ligação: faundr login, logout, link, status, a barra de status (statusline), usage --debug e agents-md.

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
import { gitRoot } from './checkpoints.mjs'
import { guessProject } from './setup.mjs'
import { memoryApi } from './cmd-features.mjs'

export async function fetchProjects({ token, apiUrl }) {
  const res = await fetch(`${apiUrl}/api/cli/projects`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 401) throw new Error(t('Invalid token (deleted, or expired after 90 days without use). Sign in again (/faundr:login).', 'Token inválido (apagado, ou venceu depois de 90 dias sem uso). Faça o login de novo (/faundr:login).'))
  if (!res.ok) throw new Error(t(`API error (${res.status}): ${await res.text()}`, `Erro da API (${res.status}): ${await res.text()}`))
  return res.json()
}

// Login pelo navegador: o token nasce aqui e só o hash vai para o Faundr; o dono digita o código no painel
// (/autorizar) e aprova, e o token passa a valer. Assim ele nunca aparece no chat. O link nunca leva o código:
// com o código no link, quem rodou o login podia mandar o link para outra pessoa, que só clicava em Autorizar
// e entregava a conta dela. Enquanto espera, fica em ~/.faundr/pending-login.json (só neste computador).
const PENDING_LOGIN_FILE = path.join(CONFIG_DIR, 'pending-login.json')
const LOGIN_WAIT_MS = 5 * 60_000

export async function login(args) {
  const urlAt = args.indexOf('--url')
  const apiUrl = (urlAt >= 0 ? args[urlAt + 1] : (readJson(CONFIG_FILE)?.apiUrl ?? DEFAULT_API_URL)).replace(/\/+$/, '')
  const token = args.find((a, i) => !a.startsWith('--') && i !== urlAt + 1)
  if (token) {
    const projects = await fetchProjects({ token, apiUrl }) // valida antes de salvar
    saveConfig({ token, apiUrl })
    console.log(t(`Signed in (API: ${apiUrl}). You have ${projects.length} project(s).`, `Login feito (API: ${apiUrl}). Você tem ${projects.length} projeto(s).`))
    return console.log(folderAfterLogin(projects))
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
  const url = `${apiUrl}/autorizar`
  openBrowser(url)
  console.log(t(`Code: ${code}`, `Código: ${code}`))
  console.log(
    t(
      `Opened ${url} in the browser (if it didn't open, open the link). Type this code there and click Authorize. Only type a code shown in your own terminal, never one someone sent you.`,
      `Abri ${url} no navegador (se não abriu, abra o link). Digite este código lá e clique em Autorizar. Só digite o código que aparece no seu próprio terminal, nunca um que alguém mandou.`,
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
      console.log(t(`Signed in (API: ${pending.apiUrl}). You have ${projects.length} project(s).`, `Login feito (API: ${pending.apiUrl}). Você tem ${projects.length} projeto(s).`))
      return console.log(folderAfterLogin(projects))
    } catch (err) {
      if (!/Token inválido|Invalid token/.test(err.message)) throw err
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  console.log(
    t(
      `Not authorized yet. Open ${pending.apiUrl}/autorizar, type the code ${pending.code}, click Authorize and run: faundr login --wait`,
      `Ainda não autorizado. Abra ${pending.apiUrl}/autorizar, digite o código ${pending.code}, clique em Autorizar e rode: faundr login --wait`,
    ),
  )
}

// faundr logout: apaga o token no Faundr (ele para de valer na hora) e neste computador (~/.faundr). Sem rede,
// apaga só aqui e avisa que falta apagar no painel.
export async function logout() {
  const file = readJson(CONFIG_FILE) ?? {}
  const { token, apiUrl } = loadConfig()
  fs.rmSync(PENDING_LOGIN_FILE, { force: true })
  if (!token) return console.log(t('This computer is not signed in to Faundr.', 'Este computador não está com login no Faundr.'))
  let server
  try {
    const res = await fetch(`${apiUrl}/api/cli/login`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    server = res.ok ? 'deleted' : `error ${res.status}`
  } catch (err) {
    server = err.message
  }
  if (file.token) {
    const { token: _, ...rest } = file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(rest, null, 2), { mode: 0o600 })
  }
  console.log(
    server === 'deleted'
      ? t('Signed out: the token was deleted from Faundr and from this computer.', 'Logout feito: o token foi apagado do Faundr e deste computador.')
      : t(
          `Deleted the token from this computer, but could not delete it from Faundr (${server}). Delete it under Plugin token in the dashboard.`,
          `Apaguei o token deste computador, mas não deu para apagar no Faundr (${server}). Apague em Token do plugin, no painel.`,
        ),
  )
  if (process.env.FAUNDR_TOKEN)
    console.log(t('The FAUNDR_TOKEN environment variable is still set: remove it too.', 'A variável de ambiente FAUNDR_TOKEN continua definida: tire ela também.'))
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

const projectLabel = (p) => `"${p.name}"${p.org ? t(` (organization ${p.org})`, ` (organização ${p.org})`) : ''}`
// O histórico mora no painel, não na pasta: ligar só aponta a pasta para ele.
const HISTORY_KEPT = () =>
  t(
    "Everything the team already recorded in this project (features, tasks, rules, decisions, past sessions) stays in place and now applies here. Only this computer's local files (the code map) are rebuilt.",
    'Tudo o que o time já registrou no projeto (funcionalidades, tarefas, regras, decisões, sessões anteriores) continua lá e passa a valer aqui. Só os arquivos locais deste computador (o mapa do código) são gerados de novo.',
  )

// Depois do login, diz se a pasta atual já está ligada (o .faundr.json veio no clone), liga quando o nome da pasta
// bate com um projeto só, ou diz que falta o /faundr:link. Assim ninguém roda link à toa num repositório já ligado.
function folderAfterLogin(projects) {
  const linkFile = findUp(process.cwd(), LINK_FILE)
  if (linkFile) {
    const id = readJson(linkFile)?.projectId
    const p = projects.find((x) => x.id === id)
    if (p) return t(`This folder is already linked to the project ${projectLabel(p)}: no need to run /faundr:link. ${HISTORY_KEPT()}`, `Esta pasta já está ligada ao projeto ${projectLabel(p)}: não precisa rodar /faundr:link. ${HISTORY_KEPT()}`)
    return t(
      `This folder is linked to a project (${id}) that this account cannot open. Ask an Owner or Admin of that project's organization to invite this account as Member (Viewer does not link folders), or sign in with the account that has access.`,
      `Esta pasta está ligada a um projeto (${id}) que esta conta não abre. Peça para um Dono ou Admin da organização do projeto convidar esta conta como Membro (Leitura não liga pasta), ou faça login com a conta que tem acesso.`,
    )
  }
  const root = gitRoot(process.cwd())
  const guess = root && guessProject(projects, [path.basename(root), readJson(path.join(root, 'package.json'))?.name])
  if (guess) {
    fs.writeFileSync(path.join(root, LINK_FILE), JSON.stringify({ projectId: guess.id }, null, 2) + '\n')
    return t(`Linked this folder to the project ${projectLabel(guess)} (the folder name matched). ${HISTORY_KEPT()} If it is the wrong project, run /faundr:link to pick another.`, `Liguei esta pasta ao projeto ${projectLabel(guess)} (o nome da pasta bateu). ${HISTORY_KEPT()} Se não for esse, rode /faundr:link para escolher outro.`)
  }
  return t('This folder is not linked to a project yet: run /faundr:link to pick one.', 'Esta pasta ainda não está ligada a nenhum projeto: rode /faundr:link para escolher.')
}

// Aceita o id, o nome do projeto ou nada (lista os projetos para escolher).
export async function link(query) {
  const config = loadConfig()
  if (!config.token) throw new Error(t('No token. Sign in first (/faundr:login).', 'Sem token. Faça o login primeiro (/faundr:login).'))
  const projects = await fetchProjects(config)
  const project = findProject(projects, query)
  if (!project) {
    const current = projects.find((p) => p.id === readJson(findUp(process.cwd(), LINK_FILE) ?? '')?.projectId)
    if (current && !query) console.log(t(`This folder is already linked to ${projectLabel(current)}. To switch, pick another one:`, `Esta pasta já está ligada a ${projectLabel(current)}. Para trocar, escolha outro:`))
    if (query) console.log(t(`No project found for "${query}".`, `Nenhum projeto encontrado para "${query}".`))
    console.log(projects.length ? t('Available projects:', 'Projetos disponíveis:') : t('You have no projects yet. Create one on the dashboard.', 'Você ainda não tem projetos. Crie um no painel.'))
    for (const p of projects) console.log(`- ${p.name}${p.org ? ` — ${p.org}` : ''} (${p.id})`)
    return
  }
  // Na raiz do repositório (fora de um, na pasta atual): rodar dentro de src/ não cria um segundo .faundr.json.
  const root = gitRoot(process.cwd()) ?? process.cwd()
  fs.writeFileSync(path.join(root, LINK_FILE), JSON.stringify({ projectId: project.id }, null, 2) + '\n')
  console.log(t(`Folder ${root} linked to the project ${projectLabel(project)}.`, `Pasta ${root} ligada ao projeto ${projectLabel(project)}.`))
  console.log(HISTORY_KEPT())
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
