#!/usr/bin/env node
// Hook PreToolUse dos comandos (Bash, PowerShell e SQL das ferramentas MCP de banco). Roda em todo comando, então
// fica separado do faundr.mjs: só carrega a guarda e os pontos de volta. Rede só para conferir pacotes a instalar.
//
//   comando perigoso → barra (catástrofe) ou faz o Claude Code perguntar ao usuário, com ponto de volta antes
//   migração/seed com o .env apontando para um banco na nuvem → pergunta (podem ser os dados reais)
//   instalar pacote que não existe (barra) ou que é novo/quase sem uso (pergunta): nome inventado pela IA
//   primeiro comando que pode mudar arquivos na sessão → ponto de volta
//   aviso do detector de loop guardado → entregue ao agente
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio (detalhes em ~/.faundr/hook.log).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCheckpoint, ensureSessionCheckpoint, gitRoot } from './checkpoints.mjs'
import { classifyCommand, guardMessage, isReadOnly } from './command-guard.mjs'
import { changesDatabase, remoteDatabases, remoteNote } from './env-target.mjs'
import { takeLoopAlerts } from './loop.mjs'
import { guardInstall } from './package-guard.mjs'

const CONFIG_DIR = path.join(os.homedir(), '.faundr')

function log(message) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.appendFileSync(path.join(CONFIG_DIR, 'hook.log'), `${new Date().toISOString()} guard-cmd: ${message}\n`)
  } catch {}
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

// Onde o comando de banco vai rodar, para o aviso dizer se são os dados reais.
function databaseNote(root, verdict, sql) {
  if (!verdict.database) return null
  if (sql) return 'Esta ferramenta roda direto no banco do Supabase na nuvem (o do projeto ligado a ela).'
  try {
    return remoteNote(remoteDatabases(root))
  } catch {
    return null
  }
}

const reply = (output) => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...output } }))

async function main() {
  const payload = JSON.parse(await readStdin())
  const cwd = payload.cwd ?? process.cwd()
  const root = linked(cwd)
  if (!root) return
  const input = payload.tool_input ?? {}
  const sql = payload.tool_name?.startsWith('mcp__')
  const command = sql ? input.query ?? input.sql : input.command
  if (typeof command !== 'string') return

  const verdict = classifyCommand(command, { cwd, sql })
  if (verdict) {
    // Risco nos arquivos: um ponto de volta antes (o usuário ainda vai decidir; se aprovar, dá para desfazer).
    let checkpoint = null
    if (verdict.files && verdict.level === 'ask' && gitRoot(cwd)) {
      try {
        checkpoint = createCheckpoint(gitRoot(cwd), { reason: `antes de: ${command.replace(/\s+/g, ' ').slice(0, 120)}`, session: payload.session_id })
      } catch (err) {
        log(`ponto de volta: ${err.message}`)
      }
    }
    log(`${verdict.level}: ${verdict.what} :: ${command.slice(0, 200)}`)
    return reply({ permissionDecision: verdict.level, permissionDecisionReason: guardMessage(verdict, { command, checkpoint, note: databaseNote(root, verdict, sql) }) })
  }

  // Migração, seed ou script de banco: normal contra um banco local; com o .env apontando para a nuvem, pergunta.
  if (!sql && changesDatabase(command)) {
    const note = remoteNote(remoteDatabases(root))
    if (note) {
      log(`ask: banco na nuvem :: ${command.slice(0, 200)}`)
      return reply({ permissionDecision: 'ask', permissionDecisionReason: guardMessage({ level: 'ask', what: 'muda o banco de dados (migração, seed ou script de banco)', database: true }, { note }) })
    }
  }

  if (!sql) {
    const install = await guardInstall(command, { configDir: CONFIG_DIR })
    if (install) {
      log(`${install.level}: pacote :: ${command.slice(0, 200)}`)
      return reply({ permissionDecision: install.level, permissionDecisionReason: install.message })
    }
  }

  const context = takeLoopAlerts(CONFIG_DIR, payload.session_id)
  if (!sql && !isReadOnly(command)) {
    const checkpoint = ensureSessionCheckpoint(cwd, payload.session_id, { configDir: CONFIG_DIR })
    if (checkpoint) context.push('[Faundr] Ponto de volta dos arquivos salvo antes da primeira mudança desta sessão (para desfazer: /faundr:undo).')
  }
  if (context.length) reply({ additionalContext: context.join('\n\n') })
}

try {
  await main()
} catch (err) {
  log(err?.stack ?? String(err))
}
process.exitCode = 0
