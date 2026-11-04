#!/usr/bin/env node
// Hook PreToolUse dos comandos (Bash, PowerShell e SQL das ferramentas MCP de banco). Roda em todo comando, então
// fica separado do faundr.mjs: só carrega os pontos de volta e os avisos ao agente.
//
//   comando que descarta mudanças (git reset --hard, git clean…) → ponto de volta antes, sem perguntar
//   primeiro comando que pode mudar arquivos na sessão → ponto de volta
//   aviso do detector de loop guardado → entregue ao agente
//   comando de um passo de workflow à frente dos que ainda estão abertos → avisa o Claude (o comando roda)
//
// Nunca pede permissão nem barra: quem está no modo automático não quer interrupção (pedido do dono em 04/11/2026).
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio (detalhes em ~/.faundr/hook.log).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCheckpoint, ensureSessionCheckpoint, gitRoot } from './checkpoints.mjs'
import { classifyCommand, isReadOnly } from './command-guard.mjs'
import { takeLoopAlerts } from './loop.mjs'
import { t } from './i18n.mjs'
import { agentStdout } from './agent.mjs'
import { outOfOrderNote } from './workflow-run.mjs'

const CONFIG_DIR = path.join(os.homedir(), '.faundr')
agentStdout(process.argv[2] === 'codex' ? 'codex' : 'claude')

function log(message) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.appendFileSync(path.join(CONFIG_DIR, 'hook.log'), `${new Date().toISOString()} guard-cmd: ${message}\n`)
  } catch {
    // Sem onde registrar: o hook nunca pode quebrar o agente.
  }
}

function linked(dir) {
  let current = path.resolve(dir)
  while (true) {
    if (fs.existsSync(path.join(current, '.faundr.json'))) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

// Comando que descarta mudanças nos arquivos: ponto de volta antes, para dar para desfazer.
function checkpointBefore(command, { cwd, sql, sessionId }) {
  const verdict = classifyCommand(command, { cwd, sql })
  if (!verdict?.files || !gitRoot(cwd)) return null
  try {
    const c = createCheckpoint(gitRoot(cwd), { reason: `${t('before', 'antes de')}: ${command.replace(/\s+/g, ' ').slice(0, 120)}`, session: sessionId })
    log(`ponto de volta antes de: ${verdict.what} :: ${command.slice(0, 200)}`)
    return c ? `[Faundr] Restore point saved before this command (${verdict.what}); to undo: /faundr:undo.` : null
  } catch (err) {
    log(`ponto de volta: ${err.message}`)
    return null
  }
}

async function main() {
  const payload = JSON.parse(await readStdin())
  const cwd = payload.cwd ?? process.cwd()
  const root = linked(cwd)
  if (!root) return
  const input = payload.tool_input ?? {}
  const sql = payload.tool_name?.startsWith('mcp__')
  const command = sql ? input.query ?? input.sql : input.command
  if (typeof command !== 'string') return

  const context = takeLoopAlerts(CONFIG_DIR, payload.session_id)
  const before = checkpointBefore(command, { cwd, sql, sessionId: payload.session_id })
  if (before) context.push(before)
  if (!sql) {
    try {
      const ahead = outOfOrderNote(root, payload.session_id, command)
      if (ahead) context.push(ahead)
    } catch (err) {
      log(`workflow fora de ordem: ${err.message}`)
    }
  }
  if (!sql && !before && !isReadOnly(command)) {
    const checkpoint = ensureSessionCheckpoint(cwd, payload.session_id, { configDir: CONFIG_DIR })
    if (checkpoint) context.push('[Faundr] Restore point of the files saved before the first change of this session (to undo: /faundr:undo).')
  }
  if (context.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context.join('\n\n') } }))
}

try {
  await main()
} catch (err) {
  log(err?.stack ?? String(err))
}
process.exitCode = 0
