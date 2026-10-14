#!/usr/bin/env node
// Hook PreToolUse da ferramenta Skill: quando o time marcou uma skill como "Só você no terminal" (painel → Workflows),
// o Claude não chama ela sozinho. Barra com o motivo e pede para ele lembrar a pessoa em uma linha. Quando a pessoa
// digita /nome no terminal, a skill roda direto, sem passar por aqui. Numa skill do Faundr que o projeto deixou com
// passos desligados, entrega o aviso de quais pular. Não usa a rede: lê as cópias locais das skills e dos interruptores.
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio.
import fs from 'node:fs'
import path from 'node:path'
import { blockedSkill } from './skills.mjs'
import { skillStepsNote } from './flows.mjs'

function findUp(dir, name) {
  for (let current = path.resolve(dir); ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, name))) return current
    if (path.dirname(current) === current) return null
  }
}

async function readStdin() {
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data
}

try {
  const payload = JSON.parse(await readStdin())
  const root = findUp(payload.cwd ?? process.cwd(), '.faundr.json')
  const name = payload.tool_input?.skill ?? payload.tool_input?.name
  const s = root && name ? blockedSkill(root, name) : null
  if (s)
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `[Faundr] O time marcou /${s.name} para rodar só quando a pessoa chama (painel → Workflows → Skills). Não rode; diga em uma linha "isso parece trabalho para /${s.name}, quer rodar?" e siga sem ela.`,
        },
      }),
    )
  else {
    // Skill do Faundr com passos desligados neste projeto: o aviso chega junto com ela.
    const note = root && name ? skillStepsNote(root, name) : null
    if (note) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: note } }))
  }
} catch {}
