// Skills conectadas (/faundr:skills): acha as skills que a pessoa já usa neste projeto — as do repositório
// (.claude/skills), as pessoais (~/.claude/skills) e as dos plugins ligados para esta pasta — e lê só o nome, a
// descrição e se o Claude pode chamá-la sozinho. O conteúdo das skills nunca sai do computador.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { faundrPath } from './paths.mjs'
import { topicHit } from './workflows.mjs'

const unquote = (v) => {
  const t = v.trim()
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'")
  return t
}

/** Cabeçalho YAML simples do SKILL.md: chaves de primeiro nível, valores em linha, entre aspas ou em bloco (> e |). */
export function parseFrontmatter(text) {
  const m = String(text ?? '').replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const out = {}
  const lines = m[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!kv) continue
    const [, key, raw] = kv
    if (/^[>|][+-]?$/.test(raw.trim())) {
      // Bloco: as linhas recuadas seguintes; ">" junta numa linha só.
      const block = []
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) block.push(lines[++i].trim())
      out[key] = raw.trim().startsWith('>') ? block.filter(Boolean).join(' ') : block.join('\n').trim()
    } else out[key] = unquote(raw)
  }
  return out
}

const isTrue = (v) => /^(true|yes|on)$/i.test(String(v ?? '').trim())
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Uma skill de uma pasta `<dir>/<nome>/SKILL.md`. `plugin` = nome do plugin (a chamada vira "plugin:skill"). */
function readSkill(dir, source, plugin = null) {
  try {
    const fm = parseFrontmatter(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'))
    const name = (fm.name || path.basename(dir)).trim()
    if (!name) return null
    return {
      name: plugin ? `${plugin}:${name}` : name,
      source,
      plugin,
      description: clip(String(fm.description ?? '').replace(/\s+/g, ' ').trim(), 1000),
      // Só a pessoa chama (disable-model-invocation): no workflow, o Claude pede para ela rodar.
      manual: isTrue(fm['disable-model-invocation']),
    }
  } catch {
    return null
  }
}

const skillsIn = (root, source, plugin) => {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      // Pasta ou atalho para uma pasta (skills instaladas com `npx skills` costumam ser atalhos).
      .filter((d) => (d.isDirectory() || d.isSymbolicLink()) && fs.existsSync(path.join(root, d.name, 'SKILL.md')))
      .map((d) => readSkill(path.join(root, d.name), source, plugin))
      .filter(Boolean)
  } catch {
    return []
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const samePath = (a, b) => path.resolve(String(a ?? '')).toLowerCase() === path.resolve(String(b ?? '')).toLowerCase()

/**
 * Plugins que valem nesta pasta: instalados para todos (scope user) ou para este projeto, sem estar desligados nas
 * configurações (a do projeto e a local vencem a da pessoa).
 */
export function activePlugins(root, home = os.homedir()) {
  const installed = readJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins ?? {}
  const enabled = {
    ...(readJson(path.join(home, '.claude', 'settings.json'))?.enabledPlugins ?? {}),
    ...(readJson(path.join(root, '.claude', 'settings.json'))?.enabledPlugins ?? {}),
    ...(readJson(path.join(root, '.claude', 'settings.local.json'))?.enabledPlugins ?? {}),
  }
  const out = []
  for (const [key, installs] of Object.entries(installed)) {
    if (enabled[key] === false) continue
    const here = (Array.isArray(installs) ? installs : []).filter((i) => i.scope === 'user' || samePath(i.projectPath, root))
    // A mais recente das instalações que valem aqui.
    const pick = here.sort((a, b) => String(b.lastUpdated ?? '').localeCompare(String(a.lastUpdated ?? '')))[0]
    if (pick?.installPath) out.push({ key, name: key.split('@')[0], installPath: pick.installPath })
  }
  return out
}

/** Todas as skills desta pasta, sem repetir nome (a do projeto vence a pessoal com o mesmo nome). */
export function scanSkills(root, home = os.homedir()) {
  const found = [
    ...skillsIn(path.join(root, '.claude', 'skills'), 'projeto'),
    ...skillsIn(path.join(home, '.claude', 'skills'), 'pessoal'),
    ...activePlugins(root, home).flatMap((p) => skillsIn(path.join(p.installPath, 'skills'), 'plugin', p.name)),
  ]
  const seen = new Set()
  return found.filter((s) => !seen.has(s.name) && seen.add(s.name))
}

// ---- Aviso pelo assunto do pedido ---------------------------------------------------------------------------
// O início da sessão traz as skills ligadas com os assuntos (.faundr/painel/skills.json); o hook do pedido avisa,
// sem rede, quando o pedido fala do assunto de uma delas. Cada skill uma vez por sessão.

const file = (root) => faundrPath(root, 'skills')

export function readSkillIndex(root) {
  return readJson(file(root)) ?? []
}

export function writeSkillIndex(root, list) {
  fs.mkdirSync(path.dirname(file(root)), { recursive: true })
  fs.writeFileSync(file(root), JSON.stringify(list ?? []))
}

/** Skills cujo assunto bate com o pedido. Sem assuntos definidos, usa o nome (ex.: "copywriting"). */
export function skillsForPrompt(list, prompt, shownIds = [], max = 2) {
  const clean = String(prompt ?? '').replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' ')
  // Quem já chamou a skill pelo nome não precisa do aviso.
  if (/(^|\s)\/[\w:-]+/.test(clean.trim().split('\n')[0])) return []
  return list
    .filter((s) => !shownIds.includes(s.name))
    .filter((s) => {
      const topics = s.topics?.length ? s.topics : [s.name.split(':').pop().replace(/-/g, ' ')]
      return topics.some((t) => topicHit(t, clean))
    })
    .slice(0, max)
}

export function skillNote(items) {
  if (!items.length) return null
  return [
    '[Faundr] O time usa estas skills para este tipo de pedido (chame antes de fazer na mão, se fizer sentido):',
    ...items.map(
      (s) =>
        `- ${s.manual ? `/${s.name} (só a pessoa chama: peça para ela rodar)` : `skill ${s.name}`}${s.when ? ` — quando: ${s.when}` : s.description ? ` — ${clip(s.description, 160)}` : ''}`,
    ),
  ].join('\n')
}

const readState = (root) => readJson(faundrPath(root, 'state')) ?? {}

export function skillsOnce(root, sid, prompt) {
  if (!sid) return null
  const state = readState(root)
  const ids = state.skillsShown?.session === sid ? state.skillsShown.ids : []
  const items = skillsForPrompt(readSkillIndex(root), prompt, ids)
  if (!items.length) return null
  fs.writeFileSync(faundrPath(root, 'state'), JSON.stringify({ ...readState(root), skillsShown: { session: sid, ids: [...ids, ...items.map((s) => s.name)] } }, null, 2))
  return skillNote(items)
}
