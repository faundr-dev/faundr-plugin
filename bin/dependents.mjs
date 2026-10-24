// "Quem depende deste arquivo" (ideia do Graft, claude/format.ts): antes de o agente editar um arquivo, o guard
// lê o graph.json e conta quem chama as funções dele ou importa o arquivo, para o agente conferir esses usos.
import fs from 'node:fs'
import path from 'node:path'
import { faundrPath } from './paths.mjs'

const USES = new Set(['calls', 'indirect_call', 'imports', 'imports_from', 're_exports', 'references', 'inherits', 'implements'])

export function readGraph(root) {
  try {
    return JSON.parse(fs.readFileSync(faundrPath(root, 'graph'), 'utf8'))
  } catch {
    // Grafo ainda não gerado (ou ilegível): sem lista de dependentes.
    return null
  }
}

/** Quem, fora do próprio arquivo, chama ou importa algo dele: [{ label, file, line }] sem repetir, o mais usado primeiro. */
export function dependentsOf(graph, rel) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const inFile = new Set(graph.nodes.filter((n) => n.source_file === rel).map((n) => n.id))
  if (!inFile.size) return []
  const seen = new Map()
  for (const l of graph.links) {
    if (!USES.has(l.relation) || !inFile.has(l.target) || inFile.has(l.source)) continue
    const from = byId.get(l.source)
    if (!from?.source_file) continue
    const cur = seen.get(from.id)
    if (cur) cur.uses++
    else seen.set(from.id, { label: from.label, file: from.source_file, line: l.source_location || from.source_location, uses: 1 })
  }
  return [...seen.values()].sort((a, b) => b.uses - a.uses || a.file.localeCompare(b.file))
}

/** Aviso curto para o agente (até `max` itens), ou null quando ninguém depende do arquivo. */
export function dependentsNote(graph, rel, max = 8) {
  const deps = dependentsOf(graph, rel)
  if (!deps.length) return null
  const files = new Set(deps.map((d) => d.file)).size
  const list = deps.slice(0, max).map((d) => `${d.label} (${d.file}:${d.line})`)
  const more = deps.length > max ? `, … and ${deps.length - max} more` : ''
  return `[Faundr] ${rel} is used by ${deps.length} part(s) in ${files} file(s): ${list.join(', ')}${more}. If you change what they use (name, parameters, return value), check those places; for the full list: faundr graph-callers ${rel}.`
}
