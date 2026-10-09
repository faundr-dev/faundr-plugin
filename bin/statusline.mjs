// Barra de status do Faundr no Claude Code (ideia do Graft, claude/statusline.ts). Roda a cada atualização da barra,
// então só lê arquivos locais: o resumo que o plugin guarda em .faundr/state.json e a marca de grafo para refazer.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Resumo para a barra a partir do quadro (faundr board): funcionalidade atual, progresso, próximo passo, preocupações. */
export function statusFromBoard(board, currentFeatureId, projectName, now = Date.now()) {
  const all = board.allFeatures ?? board.features ?? []
  const f = all.find((x) => x.id === currentFeatureId)
  const tasks = f?.tasks ?? []
  const next = tasks.find((t) => t.task_status === 'in_progress') ?? tasks.find((t) => t.task_status === 'pending')
  return {
    projectName: projectName ?? null,
    feature: f ? { title: f.title, done: tasks.filter((t) => t.task_status === 'completed').length, total: tasks.length, next: next?.title ?? null } : null,
    concerns: (board.concerns ?? []).length,
    // Quantas funcionalidades o projeto tem: sem nenhuma num projeto com código, o início da sessão oferece o inventário.
    features: all.length,
    at: now,
  }
}

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** A linha da barra. `graph`: 'fresh' | 'stale' | null (sem grafo). */
export function statusLine(status, { graph = null, width = 120 } = {}) {
  const parts = [`Faundr${status?.projectName ? ` · ${cut(status.projectName, 24)}` : ''}`]
  const f = status?.feature
  if (f) {
    parts.push(`${cut(f.title, 40)}${f.total ? ` ${f.done}/${f.total}` : ''}`)
    if (f.next) parts.push(`agora: ${cut(f.next, 40)}`)
  } else parts.push('sem funcionalidade atual')
  if (graph) parts.push(graph === 'fresh' ? 'grafo em dia' : 'grafo atualizando')
  if (status?.concerns) parts.push(`${status.concerns} preocupação(ões)`)
  return cut(parts.join(' · '), width)
}

// ---- instalação ---------------------------------------------------------------------------

/**
 * O caminho do plugin muda a cada versão; a barra aponta para um lançador fixo em ~/.faundr que procura a versão
 * mais nova instalada (e cai no caminho de quem instalou, se não achar).
 */
export function launcherSource(fallback) {
  return `// Gerado por "faundr statusline-install": chama a versão mais nova do plugin do Faundr.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const base = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'plugins', 'cache', 'faundr', 'faundr')
const num = (v) => v.split('.').map(Number)
const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0 }
let file = ${JSON.stringify(fallback)}
try {
  const versions = fs.readdirSync(base).filter((v) => /^\\d+\\.\\d+\\.\\d+$/.test(v) && fs.existsSync(path.join(base, v, 'bin', 'faundr.mjs'))).sort(newer)
  if (versions.length) file = path.join(base, versions.at(-1), 'bin', 'faundr.mjs')
} catch {}
process.argv.splice(2, 0, 'statusline')
await import(pathToFileURL(file).href)
`
}

/** Grava o lançador e liga a barra em ~/.claude/settings.json (sem trocar uma barra que já existe, a menos de force). */
export function installStatusline({ pluginFile, force = false, home = os.homedir(), configDir = process.env.CLAUDE_CONFIG_DIR }) {
  const launcher = path.join(home, '.faundr', 'statusline.mjs')
  fs.mkdirSync(path.dirname(launcher), { recursive: true })
  fs.writeFileSync(launcher, launcherSource(pluginFile))
  const settingsFile = path.join(configDir || path.join(home, '.claude'), 'settings.json')
  let settings = {}
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') return { ok: false, reason: `não consegui ler ${settingsFile}: ${err.message}` }
  }
  const command = `node "${launcher.split(path.sep).join('/')}"`
  const current = settings.statusLine
  if (current?.command === command) return { ok: true, already: true, settingsFile }
  if (current && !force) return { ok: false, reason: `já existe uma barra de status (${current.command ?? JSON.stringify(current)}). Para trocar pela do Faundr: faundr statusline-install --force`, settingsFile }
  settings.statusLine = { type: 'command', command, padding: 0 }
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true })
  fs.writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
  return { ok: true, replaced: current ?? null, settingsFile }
}
