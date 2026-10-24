#!/usr/bin/env node
// Hook PreToolUse dos comandos (Bash, PowerShell e SQL das ferramentas MCP de banco). Roda em todo comando, então
// fica separado do faundr.mjs: só carrega a guarda e os pontos de volta. Rede só para conferir pacotes a instalar.
//
//   comando perigoso → barra (catástrofe) ou faz o Claude Code perguntar ao usuário, com ponto de volta antes
//   migração/seed com o .env apontando para um banco na nuvem → pergunta (podem ser os dados reais)
//   instalar pacote que não existe (barra) ou que é novo/quase sem uso (pergunta): nome inventado pela IA
//   primeiro comando que pode mudar arquivos na sessão → ponto de volta
//   aviso do detector de loop guardado → entregue ao agente
//   git push na main com outra pessoa trabalhando no projeto → pergunta (o combinado é juntar pela mesa de trabalho)
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio (detalhes em ~/.faundr/hook.log).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { changesSince, createCheckpoint, ensureSessionCheckpoint, findCheckpoint, gitRoot, restoreSummary } from './checkpoints.mjs'
import { classifyCommand, guardMessage, isReadOnly } from './command-guard.mjs'
import { changesDatabase, remoteDatabases, remoteNote } from './env-target.mjs'
import { takeLoopAlerts } from './loop.mjs'
import { guardInstall } from './package-guard.mjs'
import { pushWarning, readTeam } from './team.mjs'
import { t } from './i18n.mjs'
import { codexDecision } from './agent.mjs'

const CONFIG_DIR = path.join(os.homedir(), '.faundr')

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

// Onde o comando de banco vai rodar, para o aviso dizer se são os dados reais.
function databaseNote(root, verdict, sql) {
  if (!verdict.database) return null
  if (sql) return 'This tool runs directly on the Supabase database in the cloud (the one of the project linked to it).'
  try {
    return remoteNote(remoteDatabases(root))
  } catch {
    // Sem ler o .env, o aviso sai sem a nota do banco (o pedido de confirmação continua).
    return null
  }
}

// Pergunta da volta a um ponto: o que muda nos arquivos, para o usuário aprovar sabendo o que perde.
function restoreReason(cwd, which) {
  try {
    const repo = gitRoot(cwd)
    const c = repo && findCheckpoint(repo, which)
    if (c) return `[Faundr] ${restoreSummary(c, changesSince(repo, c))}\nApprove only if this is really what you want.`
  } catch (err) {
    log(`volta: ${err.message}`)
  }
  return '[Faundr] Warning: this command restores the files to a restore point. The changes made after it leave the files (the current state is saved). Approve only if this is really what you want.'
}

// Branch atual lida do .git/HEAD (sem abrir o git).
function currentBranch(cwd) {
  try {
    const dir = gitRoot(cwd)
    if (!dir) return null
    let gitDir = path.join(dir, '.git')
    if (fs.statSync(gitDir).isFile()) gitDir = path.resolve(dir, fs.readFileSync(gitDir, 'utf8').match(/gitdir:\s*(.+)/)[1].trim())
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim()
    return head.startsWith('ref: refs/heads/') ? head.slice(16) : null
  } catch {
    // Sem git ou HEAD ilegível: sem branch, o aviso de push com o time não se aplica.
    return null
  }
}

// Comando e sessão atuais, para a confirmação do Codex (ver codexDecision).
let current = { command: null, sessionId: null }
const CODEX = process.argv[2] === 'codex'

function reply(output) {
  if (CODEX && output.permissionDecision) {
    const file = path.join(CONFIG_DIR, `codex-confirm-${current.sessionId}.json`)
    let pending = null
    try {
      pending = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      // Nada barrado antes nesta sessão.
    }
    const next = codexDecision(output, current.command, pending)
    try {
      if (next.pending) fs.writeFileSync(file, JSON.stringify(next.pending))
      else fs.rmSync(file, { force: true })
    } catch (err) {
      log(`confirmação do Codex: ${err.message}`)
    }
    if (!next.output) return log(`codex: confirmado pelo usuário :: ${String(current.command).slice(0, 200)}`)
    output = next.output
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...output } }))
}

// Comando perigoso: barra ou pergunta, com o motivo.
function replyVerdict(verdict, { payload, cwd, root, command, sql }) {
  // Risco nos arquivos: um ponto de volta antes (o usuário ainda vai decidir; se aprovar, dá para desfazer).
  let checkpoint = null
  if (verdict.files && verdict.level === 'ask' && gitRoot(cwd)) {
    try {
      checkpoint = createCheckpoint(gitRoot(cwd), { reason: `${t('before', 'antes de')}: ${command.replace(/\s+/g, ' ').slice(0, 120)}`, session: payload.session_id })
    } catch (err) {
      log(`ponto de volta: ${err.message}`)
    }
  }
  log(`${verdict.level}: ${verdict.what} :: ${command.slice(0, 200)}`)
  if (verdict.restore) return reply({ permissionDecision: 'ask', permissionDecisionReason: restoreReason(cwd, verdict.restore) })
  return reply({ permissionDecision: verdict.level, permissionDecisionReason: guardMessage(verdict, { command, checkpoint, note: databaseNote(root, verdict, sql) }) })
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
  current = { command, sessionId: payload.session_id }

  const verdict = classifyCommand(command, { cwd, sql })
  if (verdict) return replyVerdict(verdict, { payload, cwd, root, command, sql })

  const push = !sql && pushWarning(readTeam(root), payload.session_id, command, currentBranch(cwd))
  if (push) {
    log(`ask: push com o time ativo :: ${command.slice(0, 200)}`)
    return reply({ permissionDecision: 'ask', permissionDecisionReason: push })
  }

  // Migração, seed ou script de banco: normal contra um banco local; com o .env apontando para a nuvem, pergunta.
  if (!sql && changesDatabase(command)) {
    const note = remoteNote(remoteDatabases(root))
    if (note) {
      log(`ask: banco na nuvem :: ${command.slice(0, 200)}`)
      return reply({ permissionDecision: 'ask', permissionDecisionReason: guardMessage({ level: 'ask', what: 'changes the database (migration, seed or database script)', database: true }, { note }) })
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
    if (checkpoint) context.push('[Faundr] Restore point of the files saved before the first change of this session (to undo: /faundr:undo).')
  }
  if (context.length) reply({ additionalContext: context.join('\n\n') })
}

try {
  await main()
} catch (err) {
  log(err?.stack ?? String(err))
}
process.exitCode = 0
