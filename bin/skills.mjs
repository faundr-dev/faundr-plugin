// Skills conectadas (/faundr:skills): acha as skills que a pessoa já usa neste projeto, no Claude Code e no Codex —
// as do repositório (.claude/skills, .agents/skills), as pessoais (~/.claude/skills, ~/.agents/skills, ~/.codex/skills)
// e as dos plugins ligados para esta pasta — e lê só o nome, a descrição e se o agente pode chamá-la sozinho. O
// conteúdo das skills nunca sai do computador.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { faundrPath } from './paths.mjs'
import { topicHit } from './workflows.mjs'
import { matchesPath } from './rules.mjs'

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
    // SKILL.md ilegível: a skill fica fora da lista.
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
    // Pasta de skills que não existe: nenhuma skill dela.
    return []
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // Arquivo ausente ou ilegível: quem chama trata como vazio.
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

// ---- Codex ---------------------------------------------------------------------------------------------------
// Pasta do Codex: CODEX_HOME ou ~/.codex. Plugins ligados no config.toml ([plugins."nome@loja"] enabled = …), o da
// pasta (.codex/config.toml) vencendo o da pessoa; cada um instalado em plugins/cache/<loja>/<nome>/<versão>.

export const codexHome = (home = os.homedir(), env = process.env) => (home === os.homedir() && env.CODEX_HOME) || path.join(home, '.codex')

/** Os [plugins."x"] de um config.toml e se estão ligados (sem "enabled", ligado). */
export function codexPluginToggles(text) {
  const out = {}
  let key = null
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const head = line.match(/^\s*\[(.+)\]\s*(#.*)?$/)
    if (head) {
      key = head[1].match(/^plugins\.(?:"([^"]+)"|'([^']+)'|([\w@.-]+))$/)?.slice(1).find(Boolean) ?? null
      if (key) out[key] = true
      continue
    }
    const on = key && line.match(/^\s*enabled\s*=\s*(true|false)\b/)
    if (on) out[key] = on[1] === 'true'
  }
  return out
}

const readText = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    // Sem config.toml: nenhum plugin dele.
    return ''
  }
}

/** Versão mais nova entre as pastas de um plugin no cache (26.1020.11127 > 26.1016.51333; 0.103.0 > 0.99.2). */
const newestVersion = (dirs) =>
  dirs.sort((a, b) => {
    const pa = a.split(/[.-]/).map(Number)
    const pb = b.split(/[.-]/).map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
    return b.localeCompare(a)
  })[0]

/** Plugins do Codex ligados nesta pasta, com a pasta de skills que o manifesto aponta (padrão ./skills). */
export function codexPlugins(root, home = os.homedir()) {
  const base = codexHome(home)
  const toggles = {
    ...codexPluginToggles(readText(path.join(base, 'config.toml'))),
    ...codexPluginToggles(readText(path.join(root, '.codex', 'config.toml'))),
  }
  const out = []
  for (const [key, on] of Object.entries(toggles)) {
    const [name, market] = key.split('@')
    if (!on || !name || !market) continue
    const dir = path.join(base, 'plugins', 'cache', market, name)
    let versions = []
    try {
      versions = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    } catch {
      // Ligado no config.toml mas ainda não baixado: sem skills dele.
      continue
    }
    const version = newestVersion(versions)
    if (!version) continue
    const installPath = path.join(dir, version)
    const skills = readJson(path.join(installPath, '.codex-plugin', 'plugin.json'))?.skills
    out.push({ key, name, installPath, skillsPath: path.join(installPath, typeof skills === 'string' ? skills : 'skills') })
  }
  return out
}

/** Todas as skills desta pasta, sem repetir nome (a do projeto vence a pessoal com o mesmo nome). */
export function scanSkills(root, home = os.homedir()) {
  const found = [
    ...skillsIn(path.join(root, '.claude', 'skills'), 'projeto'),
    ...skillsIn(path.join(root, '.agents', 'skills'), 'projeto'),
    ...skillsIn(path.join(home, '.claude', 'skills'), 'pessoal'),
    ...skillsIn(path.join(home, '.agents', 'skills'), 'pessoal'),
    // Pasta antiga das skills pessoais do Codex (as dele mesmo ficam em .system, fora da lista).
    ...skillsIn(path.join(codexHome(home), 'skills'), 'pessoal'),
    ...activePlugins(root, home).flatMap((p) => skillsIn(path.join(p.installPath, 'skills'), 'plugin', p.name)),
    ...codexPlugins(root, home).flatMap((p) => skillsIn(p.skillsPath, 'plugin', p.name)),
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

/** Momentos do gatilho da skill (painel → Skills): sem a lista (índice antigo), só o assunto do pedido. */
export const skillMoment = (s, m) => (s.moments ?? ['prompt']).includes(m)
/** Só a pessoa chama: a própria skill diz (manual) ou o time escolheu "Só você no terminal". */
export const onlyUser = (s) => !!s.manual || s.call === 'user'

/** Skills cujo assunto bate com o pedido. Sem assuntos definidos, usa o nome (ex.: "copywriting"). */
export function skillsForPrompt(list, prompt, shownIds = [], max = 2) {
  const clean = String(prompt ?? '').replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' ')
  // Quem já chamou a skill pelo nome (/nome no Claude Code, $nome no Codex) não precisa do aviso.
  if (/(^|\s)[/$][\w:-]+/.test(clean.trim().split('\n')[0])) return []
  return list
    .filter((s) => !shownIds.includes(s.name) && skillMoment(s, 'prompt'))
    .filter((s) => {
      const topics = s.topics?.length ? s.topics : [s.name.split(':').pop().replace(/-/g, ' ')]
      return topics.some((t) => topicHit(t, clean))
    })
    .slice(0, max)
}

// Quando usar a skill: o "quando" que o time escreveu ou, sem ele, a descrição.
function skillWhen(s) {
  if (s.when) return ` — when: ${s.when}`
  return s.description ? ` — ${clip(s.description, 160)}` : ''
}

/** Como a pessoa chama uma skill: /nome no Claude Code, $nome no Codex. */
const callSign = (agent) => (agent === 'codex' ? '$' : '/')

/** Linha de uma skill no aviso: a que só a pessoa chama vira um lembrete em uma linha para ela, nunca uma chamada. */
const skillLine = (s, agent) => {
  const call = `${callSign(agent)}${s.name}`
  return `- ${onlyUser(s) ? `${call} (only the person calls it: do not run it; say in one line "this looks like a job for ${call}, want to run it?")` : `skill ${s.name}`}${skillWhen(s)}`
}

export function skillNote(items, where = 'this kind of request', agent = 'claude') {
  if (!items.length) return null
  return [`[Faundr] The team uses these skills for ${where} (call them before doing it by hand, if it makes sense):`, ...items.map((s) => skillLine(s, agent))].join('\n')
}

/** Skills com o momento "antes de editar" cujos arquivos batem com o arquivo editado. */
export const skillsForFile = (list, rel, shownIds = []) =>
  list.filter((s) => !shownIds.includes(s.name) && skillMoment(s, 'edit') && (s.paths ?? []).some((p) => matchesPath(p, rel)))

const readState = (root) => readJson(faundrPath(root, 'state')) ?? {}

/** Entrega cada skill uma vez por sessão (pelo pedido ou pelo arquivo editado): devolve o aviso e marca. */
function skillsShownOnce(root, sid, pick, where, agent) {
  if (!sid) return null
  const state = readState(root)
  const ids = state.skillsShown?.session === sid ? state.skillsShown.ids : []
  const items = pick(readSkillIndex(root), ids)
  if (!items.length) return null
  fs.writeFileSync(faundrPath(root, 'state'), JSON.stringify({ ...readState(root), skillsShown: { session: sid, ids: [...ids, ...items.map((s) => s.name)] } }, null, 2))
  return skillNote(items, where, agent)
}

export const skillsOnce = (root, sid, prompt, agent = 'claude') =>
  skillsShownOnce(root, sid, (list, ids) => skillsForPrompt(list, prompt, ids), 'this kind of request', agent)

export const skillsFileOnce = (root, sid, rel) => skillsShownOnce(root, sid, (list, ids) => skillsForFile(list, rel, ids), `editing ${rel}`)

/** Skill que o Claude não pode chamar sozinho (o time escolheu "Só você no terminal"); null quando pode. */
export function blockedSkill(root, name) {
  const short = String(name ?? '').replace(/^\//, '')
  const s = readSkillIndex(root).find((x) => x.name === short || x.name.split(':').pop() === short)
  return s && s.call === 'user' ? s : null
}

// ---- Skills conectadas ao painel ---------------------------------------------------------------------------------
// Skill de outra pessoa marcada como de segurança, testes, qualidade ou erros (faundr skills when --kind): quando ela
// roda (o Claude chama ou a pessoa digita /nome), o fim da resposta pede para registrar o resultado com
// faundr skill-report. A lista fica no estado da pasta, por sessão.

export const CONNECTED_KINDS = { seguranca: 'security', testes: 'tests', qualidade: 'code quality', erros: 'app errors' }

const stateFile = (root) => faundrPath(root, 'state')

/** A skill do índice local, se ela é conectada (tem tipo e não é do Faundr). */
export function connectedSkill(root, name) {
  const clean = String(name ?? '').trim().replace(/^\//, '')
  const s = readSkillIndex(root).find((x) => x.name === clean)
  return s && Object.hasOwn(CONNECTED_KINDS, s.kind ?? '') && !s.name.startsWith('faundr:') ? s : null
}

/** "/nome args" (Claude Code) ou "$nome args" (Codex) digitado pela pessoa: o nome da skill, se for um. */
export function typedSkill(prompt) {
  return String(prompt ?? '').trim().match(/^[/$]([\w.:-]+)/)?.[1] ?? null
}

/** Anota que uma skill conectada rodou nesta sessão (devolve a skill, ou null se não é conectada). */
export function noteSkillRan(root, sid, name) {
  const s = sid ? connectedSkill(root, name) : null
  if (!s) return null
  const state = readJson(stateFile(root)) ?? {}
  const list = state.skillsRan?.session === sid ? state.skillsRan.list : []
  fs.mkdirSync(path.dirname(stateFile(root)), { recursive: true })
  fs.writeFileSync(stateFile(root), JSON.stringify({ ...state, skillsRan: { session: sid, list: [...new Set([...list, s.name])] } }, null, 2))
  return s
}

/** Passos do fim da resposta para as skills conectadas que rodaram; esvazia a lista (cada rodada pede uma vez). */
export function takeSkillsRan(root, sid) {
  const state = readJson(stateFile(root)) ?? {}
  if (state.skillsRan?.session !== sid || !state.skillsRan.list?.length) return []
  fs.writeFileSync(stateFile(root), JSON.stringify({ ...state, skillsRan: { session: sid, list: [] } }, null, 2))
  return state.skillsRan.list.map((name) => connectedSkill(root, name)).filter(Boolean).map(skillReportStep)
}

export function skillReportStep(s) {
  return `the /${s.name} skill (connected to Faundr: ${CONNECTED_KINDS[s.kind]}) ran in this response: record its result on the dashboard. Write a JSON list to a temporary file with each problem it found and each one fixed in this conversation: {"area":"seguranca|qualidade|testes|erros","status":"open|fixed","title":"<the problem, short>","severity":"critical|high|medium|low","file":"<path>","line":<n>,"detail":"<what it is, in plain language, in the user's language>","impact":"<what can happen>","fix":"<how to fix it>"} and run faundr skill-report "${s.name}" --areas ${s.kind} --file <file> (add --scope a,b if it looked at only some files). If it found nothing, run faundr skill-report "${s.name}" --areas ${s.kind} --none (closes what it had found before). Record only what is in its result, without making things up or repeating what Faundr already shows`
}
