// Base da CLI do Faundr (faundr.mjs), usada por todos os comandos e hooks: configuração (~/.faundr/config.json), log dos
// hooks, pasta ligada (.faundr.json), git lido direto dos arquivos, stdin, as orientações fixas que os hooks mandam ao
// agente, as opções da linha de comando, o estado da pasta (funcionalidade atual por sessão) e os processos em segundo plano.
// Não importa nenhum outro módulo da CLI: os outros importam daqui.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { faundrPath } from './paths.mjs'
import { t } from './i18n.mjs'
import { agentSessionId, agentStdout, currentAgent } from './agent.mjs'

export const CONFIG_DIR = path.join(os.homedir(), '.faundr')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
export const LOG_FILE = path.join(CONFIG_DIR, 'hook.log')
export const LINK_FILE = '.faundr.json'
// Arquivo da CLI (faundr.mjs): é ele que os processos em segundo plano, o setup e a barra de status chamam.
export const FAUNDR_FILE = fileURLToPath(new URL('./faundr.mjs', import.meta.url))
// Agente que rodou este comando (Claude Code ou Codex) e a sessão dele, para o painel marcar quem fez.
export const AGENT = ['hook', 'gate', 'guard', 'subagent-start'].includes(process.argv[2]) && process.argv[3] === 'codex' ? 'codex' : currentAgent()
export const AGENT_SESSION_ID = agentSessionId()
// No Codex as skills se chamam com $: tudo o que o Faundr escreve (avisos dos hooks, inclusive os que vêm do painel, e
// a saída da CLI, que passa pelo mesmo stdout) sai com $faundr: no lugar de /faundr:.
agentStdout(AGENT)
// Site do Faundr no ar; para desenvolver o próprio Faundr: /faundr:login --url http://localhost:3000.
export const DEFAULT_API_URL = 'https://faundr.dev'

// Ferramentas que alteram arquivos: depois delas o grafo do projeto precisa ser refeito.
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch'])
export const GRAPH_LOCK_MS = 5 * 60_000

// Os avisos e as skills do Faundr são em inglês; a conversa segue a língua da pessoa e o que vai para o painel, a
// língua do conteúdo do projeto (languageGuidance, em content-lang.mjs).

// Orientação de acompanhamento: o agente registra o que constrói (skill "track").
export const WORK_GUIDANCE = `[Faundr] Record the work so the team can follow it on the dashboard: when you start something with several steps (a new feature, a big improvement, a new phase), before building, run faundr feature "<title>" --done-when "<how to tell it is done>" and one faundr task "<step>" per step; if the request is vague (does not say who it is for, what is left out or when it is done), first ask 2 or 3 short questions in a single round; faundr done "<step>" when you finish one; faundr decision "<decision>" --why "<reason>" for technical choices (if it changes an earlier decision, add --replaces "<snippet of the old title>"). Work in stages (phases, MVP and then the rest): record the next stages right at the start with faundr feature "<stage>" --after current --desc "<what goes in>"; when you finish a stage, tell the user which one is next.`

// Orientação "sempre ligada" (equivalente à regra de CLAUDE.md do graphify): consultar o grafo antes de varrer arquivos.
export const GRAPH_GUIDANCE = `[Faundr] This project has a knowledge graph in .faundr/mapa/ (code + docs, with communities and links).
- For questions about the code, run this first: faundr graph-query "<question>". It returns the most relevant functions and files with their code, who calls them and what they call: often you won't need to open the file. Before changing a function or file: faundr graph-callers "X" (who depends on it; --depth 2 for the chain effect). To see a file without reading all of it: faundr graph-skeleton <file>. Instead of grep: faundr graph-grep "<pattern>" (groups by function and shows the most used first). Everything connected to a piece (who uses it and what it uses): faundr graph-callers "X" --both. How two pieces connect: faundr graph-path "A" "B".
- Architecture overview: .faundr/mapa/GRAPH_REPORT.md (read it only when the queries are not enough).
- The graph updates itself when you edit files.`

// Design: com design.md, ele é a regra das telas; sem ele, o agente sugere criar (skill "design").
// O piso de qualidade (números e o que recusar) vale para toda tela, com ou sem design.md.
export const QUALITY_FLOOR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'design', 'quality-floor.md')
export const DESIGN_GUIDANCE = (file) =>
  `[Faundr] This project has a design guide in ${file}. Before creating or changing screens, read it and follow its colors, fonts and components; reuse existing components instead of recreating styles. Also read Faundr's quality floor (${QUALITY_FLOOR}): contrast, touch, mobile, states, focus and motion apply to every screen (design.md wins when it decides otherwise).`
export const NO_DESIGN_GUIDANCE = `[Faundr] This project has screens but no design.md (the design guide that standardizes colors, fonts and components). When the work involves screens, suggest the user create one with /faundr:design, and follow Faundr's quality floor (${QUALITY_FLOOR}).`

// Eventos cuja resposta volta para o agente (plataforma → projeto).
export const CONTEXT_EVENTS = new Set(['SessionStart', 'UserPromptSubmit'])

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // Arquivo ausente ou ilegível: quem chama trata como vazio.
    return null
  }
}

export function loadConfig() {
  const file = readJson(CONFIG_FILE) ?? {}
  return {
    token: process.env.FAUNDR_TOKEN ?? file.token,
    apiUrl: (process.env.FAUNDR_API_URL ?? file.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, ''),
  }
}

export function saveConfig(patch) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const next = { ...(readJson(CONFIG_FILE) ?? {}), ...patch }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), { mode: 0o600 })
}

export function log(message) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\n`)
  } catch {
    // Sem onde registrar: o log nunca pode quebrar o comando nem o hook.
  }
}

// Sobe a partir de `dir` até achar `name`.
export function findUp(dir, name) {
  let current = path.resolve(dir)
  while (true) {
    const candidate = path.join(current, name)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

// Branch atual lendo .git/HEAD direto (sem spawnar git, para ser rápido).
// Pasta do git (resolve o arquivo .git de worktrees e submódulos).
function gitDirOf(cwd) {
  const dotGit = findUp(cwd, '.git')
  if (!dotGit) return null
  if (!fs.statSync(dotGit).isFile()) return dotGit
  const m = fs.readFileSync(dotGit, 'utf8').match(/gitdir:\s*(.+)/)
  return m ? path.resolve(path.dirname(dotGit), m[1].trim()) : null
}

/** Quantos arquivos têm mudanças fora de commit (sem contar o .faundr/); 0 sem git. */
export function uncommittedChanges(root) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', timeout: 15_000 })
  if (r.status !== 0) return 0
  return r.stdout.split('\n').filter((l) => l.trim() && !/^.. \.faundr\//.test(l) && !/^.. "?\.faundr\//.test(l)).length
}

// Commit atual lido dos arquivos do .git: no Windows, abrir um `git rev-parse` leva ~1 s no início da sessão.
export function gitHead(cwd) {
  try {
    const gitDir = gitDirOf(cwd)
    if (!gitDir) return null
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim()
    if (!head.startsWith('ref: ')) return head
    const ref = head.slice(5)
    // Worktree: as refs ficam na pasta comum.
    const commonFile = path.join(gitDir, 'commondir')
    const common = fs.existsSync(commonFile) ? path.resolve(gitDir, fs.readFileSync(commonFile, 'utf8').trim()) : gitDir
    for (const dir of [gitDir, common]) {
      const file = path.join(dir, ...ref.split('/'))
      if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
    }
    const packed = fs.readFileSync(path.join(common, 'packed-refs'), 'utf8')
    return packed.split('\n').find((l) => l.endsWith(` ${ref}`))?.split(' ')[0] ?? null
  } catch {
    // Sem git (ou .git ilegível): sem commit atual.
    return null
  }
}

export function gitBranch(cwd) {
  try {
    const gitDir = gitDirOf(cwd)
    if (!gitDir) return null
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim()
    return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : head.slice(0, 12)
  } catch {
    // Sem git (ou .git ilegível): sem branch.
    return null
  }
}

export async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

// No Windows cada processo novo leva ~1 s para nascer e o hook do início da sessão tem 10 s: com um processo por
// checagem, o Claude Code cancelava o hook (e o "onde parou" não chegava). Um processo só abre os outros.
export function spawnBackground(jobs, cwd) {
  if (jobs.length === 1) return spawnDetached(jobs[0], cwd)
  spawnDetached(['background', JSON.stringify(jobs)], cwd)
}

function spawnDetached(args, cwd) {
  const child = spawn(process.execPath, [FAUNDR_FILE, ...args], {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

// O valor do primeiro caso verdadeiro, na ordem; nenhum: o padrão (troca cadeias de "a ? x : b ? y : z").
export function firstOf(cases, fallback) {
  for (const [ok, value] of cases) if (ok) return value
  return fallback
}

export function flag(args, name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

/** Todos os valores de uma opção que pode se repetir (`--file a --file b`). */
export const flags = (args, name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []))

export function projectRoot() {
  const linkFile = findUp(process.cwd(), LINK_FILE)
  return linkFile ? path.dirname(linkFile) : process.cwd()
}
const stateFile = (root) => faundrPath(root, 'state')
export const readState = (root) => readJson(stateFile(root)) ?? {}
export function writeState(root, patch) {
  fs.mkdirSync(path.join(root, '.faundr'), { recursive: true })
  fs.writeFileSync(stateFile(root), JSON.stringify({ ...readState(root), ...patch }, null, 2))
}

// Funcionalidade atual por sessão: duas sessões na mesma pasta podem tocar funcionalidades diferentes. A da pasta
// (currentFeatureId) é a última escolhida e vale para quem ainda não escolheu (sessão nova, Codex, terminal comum).
const KEPT_SESSIONS = 20
const sessionIdOf = (sid) => sid ?? AGENT_SESSION_ID ?? null

export function currentFeature(root, sid) {
  const state = readState(root)
  const own = state.featureBySession?.[sessionIdOf(sid)]
  return own?.id ?? state.currentFeatureId ?? null
}

export function setCurrentFeature(root, id, sid) {
  const key = sessionIdOf(sid)
  const bySession = { ...(readState(root).featureBySession ?? {}) }
  if (key) bySession[key] = { id, at: Date.now() }
  const kept = Object.entries(bySession)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, KEPT_SESSIONS)
  writeState(root, { currentFeatureId: id, featureBySession: Object.fromEntries(kept) })
}

/** Sessão nova fica com a funcionalidade atual da pasta: se outra sessão trocar depois, esta não muda junto. */
export function pinSessionFeature(root, sid) {
  const state = readState(root)
  if (!sid || state.featureBySession?.[sid] || !state.currentFeatureId) return
  setCurrentFeature(root, state.currentFeatureId, sid)
}

export function linkedProject() {
  const linkFile = findUp(process.cwd(), LINK_FILE)
  if (!linkFile) throw new Error(t('Folder not linked to a project. Use /faundr:link first.', 'Pasta não ligada a um projeto. Use /faundr:link primeiro.'))
  const config = loadConfig()
  if (!config.token) throw new Error(t('No token. Sign in first (/faundr:login).', 'Sem token. Faça o login primeiro (/faundr:login).'))
  return { root: path.dirname(linkFile), projectId: readJson(linkFile)?.projectId, config }
}

export const textArg = (args) => args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).join(' ').trim()
export const MARK = { completed: '[x]', in_progress: '[~]', pending: '[ ]' }
