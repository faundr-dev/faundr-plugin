#!/usr/bin/env node
// Hook UserPromptSubmit síncrono: roda antes de o agente ler cada pedido, então fica separado do faundr.mjs (só
// carrega o detector e a cópia local da memória) e não usa a rede. Três avisos, cada um só quando vale:
// - pedido parece funcionalidade nova: registrar, com as etapas, e perguntar o escopo se for vago;
// - pedido parece uma regra ("a partir de agora…", "nunca…"): registrar como regra do time;
// - regras e decisões do assunto do pedido, da cópia local (.faundr/memory.json), cada uma uma vez por sessão.
// O registro do pedido no diário continua no hook assíncrono do faundr.mjs.
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio.
import fs from 'node:fs'
import path from 'node:path'
import { featureIntent, featureNudge, ruleIntent, ruleNudge } from './intent.mjs'
import { memoryNote, readMemoryIndex, relevantMemory } from './rules.mjs'

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

const readState = (root) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'state.json'), 'utf8'))
  } catch {
    return {}
  }
}

// Mesma lista do guard (regras ligadas a arquivos): o que já chegou ao agente nesta sessão não volta.
function relevantOnce(root, sid, prompt) {
  if (!sid) return null
  const state = readState(root)
  const ids = state.rulesShown?.session === sid ? state.rulesShown.ids : []
  const items = relevantMemory(readMemoryIndex(root), prompt, ids)
  if (!items.length) return null
  fs.writeFileSync(
    path.join(root, '.faundr', 'state.json'),
    JSON.stringify({ ...readState(root), rulesShown: { session: sid, ids: [...ids, ...items.map((m) => m.id)] } }, null, 2),
  )
  return memoryNote(items)
}

try {
  const payload = JSON.parse(await readStdin())
  const root = findUp(payload.cwd ?? process.cwd(), '.faundr.json')
  if (root) {
    const notes = []
    if (featureIntent(payload.prompt)) notes.push(featureNudge(readState(root).status?.feature?.title ?? null))
    if (ruleIntent(payload.prompt)) notes.push(ruleNudge())
    try {
      notes.push(relevantOnce(root, payload.session_id, payload.prompt))
    } catch {}
    const additionalContext = notes.filter(Boolean).join('\n\n')
    if (additionalContext) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } }))
  }
} catch {}
