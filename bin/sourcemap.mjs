// Source maps no computador do usuário (seção Erros, fase 2), sem dependências: acha o .map do arquivo
// do build (pelo nome com hash ou pelo debug id) e traduz linha:coluna do código minificado para o
// arquivo original. Nada é enviado: o Faundr não pede upload de source maps.
import fs from 'node:fs'
import path from 'node:path'

const BUILD_DIRS = ['dist', 'build', '.next', '.output', 'out', '.vercel/output', '.svelte-kit/output', 'public/build', '.wrangler/tmp']
const MAX_MAPS = 3000

let cache = null
/** Todos os .map das pastas de build do projeto (uma vez por execução). */
export function listMaps(root) {
  if (cache?.root === root) return cache.maps
  const maps = []
  const walk = (dir, depth) => {
    if (depth > 8 || maps.length >= MAX_MAPS) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== 'cache') walk(full, depth + 1)
      } else if (e.name.endsWith('.map')) maps.push(full)
    }
  }
  for (const d of BUILD_DIRS) walk(path.join(root, d), 0)
  cache = { root, maps }
  return maps
}

// Acha o .map de um arquivo do build: primeiro pelo debug id (exato), depois pelo nome (index-Bx9aQ12k.js.map).
export function findMap(root, rawFile, debugId) {
  const maps = listMaps(root)
  if (debugId) {
    const id = debugId.toLowerCase().replace(/-/g, '')
    for (const m of maps) {
      try {
        const head = fs.readFileSync(m, 'utf8')
        const found = head.match(/"debug_?[iI]d"\s*:\s*"([^"]+)"/)
        if (found && found[1].toLowerCase().replace(/-/g, '') === id) return m
      } catch {}
    }
  }
  const base = path.basename(String(rawFile ?? '').replace(/[?#].*$/, ''))
  if (!base) return null
  return maps.find((m) => path.basename(m) === `${base}.map`) ?? null
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_VAL = Object.fromEntries([...B64].map((c, i) => [c, i]))

// Decodifica uma linha de "mappings" (VLQ base64) em segmentos [coluna gerada, fonte, linha, coluna, nome].
function decodeLine(line, state) {
  const segments = []
  for (const seg of line.split(',')) {
    if (!seg) continue
    const values = []
    let value = 0
    let shift = 0
    for (const ch of seg) {
      const digit = B64_VAL[ch]
      if (digit === undefined) break
      value += (digit & 31) << shift
      if (digit & 32) shift += 5
      else {
        values.push(value & 1 ? -(value >>> 1) : value >>> 1)
        value = 0
        shift = 0
      }
    }
    state.genCol += values[0] ?? 0
    if (values.length >= 4) {
      state.source += values[1]
      state.line += values[2]
      state.col += values[3]
      if (values.length >= 5) state.name += values[4]
      segments.push([state.genCol, state.source, state.line, state.col, values.length >= 5 ? state.name : -1])
    }
  }
  return segments
}

/** Traduz linha/coluna (1-based, como o SDK manda) do arquivo do build para o original. */
export function resolvePosition(mapFile, line, column) {
  let map
  try {
    map = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
  } catch {
    return null
  }
  if (map.sections) {
    // Mapa indexado: acha a seção que contém a posição.
    const section = [...map.sections].reverse().find((s) => s.offset.line < line - 1 || (s.offset.line === line - 1 && s.offset.column <= column - 1))
    if (!section?.map) return null
    map = section.map
    line -= section.offset.line
    if (line === 1) column -= section.offset.column
  }
  const lines = String(map.mappings ?? '').split(';')
  const state = { genCol: 0, source: 0, line: 0, col: 0, name: 0 }
  let segments = []
  for (let i = 0; i < lines.length && i < line; i++) {
    state.genCol = 0
    segments = decodeLine(lines[i], state)
  }
  if (line > lines.length) return null
  const col0 = Math.max(0, (column ?? 1) - 1)
  let hit = null
  for (const s of segments) if (s[0] <= col0) hit = s
  hit ??= segments[0]
  if (!hit) return null
  const rawSource = map.sources?.[hit[1]] ?? ''
  const source = cleanSource(map.sourceRoot ? `${map.sourceRoot.replace(/\/$/, '')}/${rawSource}` : rawSource)
  const content = map.sourcesContent?.[hit[1]] ?? null
  return { source, line: hit[2] + 1, column: hit[3] + 1, name: hit[4] >= 0 ? map.names?.[hit[4]] : undefined, content }
}

// "webpack://app/./src/a.tsx", "../../src/a.tsx" → "src/a.tsx"
function cleanSource(s) {
  return s
    .replace(/^webpack(-internal)?:\/\/\/?[^/]*\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '')
    .replace(/\?.*$/, '')
}

/** Linhas em volta da posição original (do sourcesContent ou do arquivo no disco). */
export function contextLines(root, pos, around = 2) {
  let text = pos.content
  if (!text) {
    try {
      text = fs.readFileSync(path.join(root, pos.source), 'utf8')
    } catch {
      return null
    }
  }
  const lines = text.split(/\r?\n/)
  const from = Math.max(0, pos.line - 1 - around)
  return lines.slice(from, pos.line + around).map((l, i) => `${String(from + i + 1).padStart(5)}${from + i + 1 === pos.line ? ' >' : '  '} ${l.slice(0, 200)}`)
}
