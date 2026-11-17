#!/usr/bin/env node
// Hook PreToolUse dos comandos (Bash, PowerShell e SQL das ferramentas MCP de banco). Roda em todo comando, então
// fica separado do faundr.mjs: só carrega os checkpoints e os avisos ao agente.
//
//   comando que descarta mudanças (git reset --hard, git clean…) → checkpoint antes, sem perguntar
//   primeiro comando que pode mudar arquivos na sessão → checkpoint
//   aviso do detector de loop guardado → entregue ao agente
//   comando de um passo de workflow à frente dos que ainda estão abertos → avisa o Claude (o comando roda)
//
// Nunca pede permissão nem barra: quem está no modo automático não quer interrupção (pedido do dono em 04/11/2026).
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio (detalhes em ~/.faundr/hook.log).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCheckpoint, ensureSessionCheckpoint, gitRoot, HOOK_CHECKPOINT_MS, rescueBundle, unsafeCheckpointRoot } from './checkpoints.mjs'
import { classifyCommand, commandDir, isReadOnly, wipesRepo } from './command-guard.mjs'
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

// Prazo do hook inteiro, contado do início do processo (o Claude Code derruba aos 15 s): checkpoint e, se der, o
// bundle de resgate dentro dele.
const HOOK_BUDGET_MS = 13_000

// Comando que descarta mudanças nos arquivos: checkpoint antes, para dar para desfazer. Nunca pergunta nem barra;
// quando o checkpoint não sai, avisa o agente (ele precisa saber que não há volta).
function checkpointBefore(command, { cwd: sessionCwd, sql, sessionId, started = performance.timeOrigin }) {
  // Onde o comando apaga: cd ../outro && git reset --hard protege o outro repositório, não o da sessão.
  const cwd = sql ? sessionCwd : commandDir(command, sessionCwd)
  const verdict = classifyCommand(command, { cwd, sql })
  const root = gitRoot(cwd)
  if (!verdict?.files || !root) return null
  if (unsafeCheckpointRoot(root)) {
    log(`checkpoint: o git começa em ${root} (pasta pessoal ou raiz do disco), sem checkpoint`)
    return null
  }
  // Motivo visto pelo time no painel: só o nome fixo do tipo de comando, nunca o texto (pode ter token).
  const label = verdict.label ?? t('a command that discards changes', 'um comando que descarta mudanças')
  const ignoredNote = verdict.ignored
    ? ' Files ignored by git (.env and the like) are NOT in the checkpoint: this command deletes them for good and /faundr:undo cannot bring them back.'
    : ''
  let c
  try {
    c = createCheckpoint(root, { reason: `${t('before', 'antes de')}: ${label}`, session: sessionId, timeoutMs: HOOK_CHECKPOINT_MS })
    log(`checkpoint antes de: ${label}`)
  } catch (err) {
    log(`checkpoint antes de ${label}: ${err.message}`)
    return `[Faundr] NO checkpoint was saved before this command (${label}): ${err.message.slice(0, 160)}. If it discards something by mistake, /faundr:undo cannot bring it back; tell the user before running it.${ignoredNote}`
  }
  if (!wipesRepo(verdict, root)) return `[Faundr] Checkpoint saved before this command (${label}); to undo: /faundr:undo.${ignoredNote}`
  // Apaga o .git (pasta inteira ou o próprio .git): os checkpoints moram nele e vão junto. Cópia de resgate fora.
  const left = started + HOOK_BUDGET_MS - Date.now()
  const lost = `[Faundr] This command deletes the project's .git folder, and the checkpoints live inside it: they go away with it and /faundr:undo will not work afterwards.`
  if (left < 1_000) return `${lost} There was no time to save a copy outside the folder: if the files are deleted, there is no way back. Tell the user before running it.`
  try {
    const file = rescueBundle(root, c, { dir: path.join(CONFIG_DIR, 'rescue'), deadline: Date.now() + left })
    log(`bundle de resgate: ${file}`)
    return `${lost} A copy of the files was saved outside it, in ${file}; to get them back: git clone "${file}" <folder>.${ignoredNote}`
  } catch (err) {
    log(`bundle de resgate: ${err.message}`)
    return `${lost} The copy outside the folder failed (${err.message.slice(0, 120)}): if the files are deleted, there is no way back. Tell the user before running it.`
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
    if (checkpoint) context.push('[Faundr] Checkpoint of the files saved before the first change of this session (to undo: /faundr:undo).')
  }
  if (context.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context.join('\n\n') } }))
}

try {
  await main()
} catch (err) {
  log(err?.stack ?? String(err))
}
process.exitCode = 0
