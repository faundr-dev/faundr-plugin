// Onde o Faundr erra: uma checagem do plugin que quebrou ou travou fica anotada aqui na hora, sem rede, e vai ao
// painel junto da próxima requisição que o hook já faz (nenhum hook espera por isso). Só campos fechados: o comando
// do Faundr, o tipo e o código do erro e as linhas do próprio plugin no stack. A mensagem nunca vai: pode ter caminho
// ou trecho do projeto.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_DIR, findUp, LINK_FILE, readJson } from './cli-core.mjs'

const FILE = path.join(CONFIG_DIR, 'failures.json')
const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MAX = 50

export const PLUGIN_VERSION = readJson(path.join(PLUGIN_DIR, 'package.json'))?.version ?? null

/** `kind`: 'crash' (o erro escapou), 'stuck' (o hook não terminou e foi derrubado), 'slow' (passou do tempo). */
export function recordFailure(command, kind, err = null, ms = null) {
  try {
    const projectId = readJson(findUp(process.cwd(), LINK_FILE) ?? '')?.projectId
    if (!projectId) return
    const entry = {
      projectId,
      command: String(command).slice(0, 60),
      kind,
      errorName: /^[A-Za-z]{1,40}$/.test(err?.name ?? '') ? err.name : null,
      errorCode: /^[A-Z0-9_]{1,40}$/.test(err?.code ?? '') ? err.code : null,
      frames: pluginFrames(err?.stack),
      ms: ms == null ? null : Math.round(ms),
      version: PLUGIN_VERSION,
      platform: process.platform,
      node: process.versions.node,
      at: new Date().toISOString(),
    }
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify([...read(), entry].slice(-MAX)))
  } catch {
    // Anotar a falha nunca pode virar outra falha.
  }
}

/** As falhas deste projeto ainda não enviadas; tira do arquivo (vão no corpo do hook). */
export function takeFailures(projectId) {
  try {
    const all = read()
    const mine = all.filter((f) => f.projectId === projectId)
    if (!mine.length) return []
    fs.writeFileSync(FILE, JSON.stringify(all.filter((f) => f.projectId !== projectId)))
    return mine.map(({ projectId: _, ...f }) => f)
  } catch {
    return []
  }
}

function read() {
  const data = readJson(FILE)
  return Array.isArray(data) ? data : []
}

// "at fn (C:\…\plugin\bin\x.mjs:12:5)" → "bin/x.mjs:12 fn": só as linhas de dentro do plugin, sem o caminho da máquina.
export function pluginFrames(stack) {
  if (typeof stack !== 'string') return []
  const out = []
  for (const line of stack.split('\n').slice(1)) {
    const m = line.match(/^\s*at (?:async )?(?:(.+?) \()?(.+?):(\d+):\d+\)?$/)
    if (!m) continue
    let file
    try {
      file = m[2].startsWith('file:') ? fileURLToPath(m[2]) : path.resolve(m[2])
    } catch {
      continue
    }
    const rel = path.relative(PLUGIN_DIR, file)
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue
    const fn = m[1] && /^[\w.$<> ]{1,80}$/.test(m[1]) ? ` ${m[1]}` : ''
    out.push(`${rel.replace(/\\/g, '/')}:${m[3]}${fn}`)
    if (out.length === 5) break
  }
  return out
}
