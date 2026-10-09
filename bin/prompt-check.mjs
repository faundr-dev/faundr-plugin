#!/usr/bin/env node
// Hook UserPromptSubmit síncrono: roda antes de o agente ler cada pedido, então fica separado do faundr.mjs (só
// carrega o detector) e não usa a rede. Se o pedido parece funcionalidade nova, lembra o agente de registrá-la,
// com as etapas, e de perguntar o escopo quando o pedido for vago. O registro do pedido no diário continua no
// hook assíncrono do faundr.mjs.
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio.
import fs from 'node:fs'
import path from 'node:path'
import { featureIntent, featureNudge } from './intent.mjs'

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
  if (root && featureIntent(payload.prompt)) {
    let current = null
    try {
      current = JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'state.json'), 'utf8')).status?.feature?.title ?? null
    } catch {}
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: featureNudge(current) } }))
  }
} catch {}
