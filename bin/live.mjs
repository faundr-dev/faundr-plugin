#!/usr/bin/env node
// Estado ao vivo da sessão (aba Agora do painel): roda antes de cada ferramenta e nos avisos do Claude Code
// (pedido de permissão, pergunta esperando resposta). Fica fora do faundr.mjs para abrir rápido: roda muitas vezes
// por resposta, sempre em segundo plano (o agente nunca espera a rede por causa dele).
// Só sai daqui o necessário para o estado: nome da ferramenta, caminho do arquivo, a descrição do comando e o nome
// do programa. Conteúdo de arquivo e o comando inteiro (que pode ter senhas) ficam no computador.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CONFIG_DIR = path.join(os.homedir(), '.faundr')
const DEFAULT_API_URL = 'https://faundr.palasbusinessstrategy.workers.dev'

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function findUp(dir, name) {
  let current = path.resolve(dir)
  while (true) {
    const candidate = path.join(current, name)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function gitBranch(cwd) {
  try {
    const dotGit = findUp(cwd, '.git')
    if (!dotGit) return null
    let gitDir = dotGit
    if (fs.statSync(dotGit).isFile()) {
      const m = fs.readFileSync(dotGit, 'utf8').match(/gitdir:\s*(.+)/)
      if (!m) return null
      gitDir = path.resolve(path.dirname(dotGit), m[1].trim())
    }
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim()
    return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : head.slice(0, 12)
  } catch {
    return null
  }
}

/** O que vai para o servidor: o mínimo para saber o estado. */
export function livePayload(p) {
  const input = p.tool_input ?? {}
  const program = typeof input.command === 'string' ? input.command.trim().split(/\s+/)[0] : undefined
  return {
    session_id: p.session_id,
    hook_event_name: p.hook_event_name,
    cwd: p.cwd,
    tool_name: p.tool_name,
    tool_input: {
      file_path: input.file_path,
      notebook_path: input.notebook_path,
      description: typeof input.description === 'string' ? input.description.slice(0, 200) : undefined,
      command: program,
    },
    notification_type: p.notification_type,
    message: typeof p.message === 'string' ? p.message.slice(0, 200) : undefined,
  }
}

export function machineName(config) {
  return String(config?.machine ?? os.hostname() ?? '').slice(0, 80) || null
}

async function main() {
  const at = Date.now()
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  const cwd = payload.cwd ?? process.cwd()
  const linkFile = findUp(cwd, '.faundr.json')
  if (!linkFile) return
  const { projectId } = readJson(linkFile) ?? {}
  const config = readJson(path.join(CONFIG_DIR, 'config.json')) ?? {}
  const token = process.env.FAUNDR_TOKEN ?? config.token
  const apiUrl = (process.env.FAUNDR_API_URL ?? config.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '')
  if (!projectId || !token) return
  await fetch(`${apiUrl}/api/hooks/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ agent: 'claude', projectId, git: { branch: gitBranch(cwd) }, machine: machineName(config), at, payload: livePayload(payload) }),
    signal: AbortSignal.timeout(5000),
  })
}

// Os testes importam as funções sem disparar o envio.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {})
