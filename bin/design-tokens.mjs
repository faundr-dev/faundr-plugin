// Tokens do design para a Vitrine do painel (sem IA): cores, fontes, tamanhos de texto, raios e sombras.
// Fontes de verdade, nesta ordem:
//   1. variáveis CSS do projeto (@theme do Tailwind, :root) — o valor exato;
//   2. o design.md — nome, valor e "quando usar" (tabelas com hex, tópicos de tipografia);
//   3. o tema padrão do Tailwind instalado no projeto — só para o que o design.md cita (neutral-200, text-sm, rounded-md…).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { contextTheme, cssRules, customProps } from './css-rules.mjs'
import { flutterColorTokens } from './design-flutter.mjs'
import { luminance, parseColor } from './design-project.mjs'
import { faundrIgnore, ignoredBy, inNodeModules, isClaudePlugin } from './parts.mjs'

const SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|coverage|\.claude|\.remember|\.wrangler|\.next|\.nuxt|\.svelte-kit|\.tanstack|\.vercel|\.output)(\/|$)/
// Não é estilo do app: arquivos servidos como estão (public/, static/ — ex.: temas de marca para baixar), a extensão
// do navegador e os templates de e-mail do Supabase.
const NOT_APP_STYLE = /(^|\/)(public|static|extension)(\/|$)|(^|\/)supabase\/templates(\/|$)/
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(.+\))$/i
const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i
const TW_COLORS =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

/** Variáveis CSS (--nome: valor) de um texto CSS (todas, sem olhar o seletor: usado no tema padrão do Tailwind). */
function cssVars(text) {
  const out = new Map()
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of clean.matchAll(/--([\w-]+)\s*:\s*([^;{}]+);/g)) out.set(m[1], m[2].replace(/\s+/g, ' ').trim())
  return out
}

// Arquivos do git (versionados e novos fora do .gitignore); null sem git.
function gitListed(root) {
  const r = spawnSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20 })
  if (r.error || r.status !== 0) return null
  return new Set(r.stdout.split('\0').filter(Boolean))
}

/**
 * Arquivos do projeto (até 8 pastas de fundo) cujo nome passa em `keep`, pulando dependências, saídas de build,
 * plugins do Claude, o que não é estilo do app (public/, static/, extension/, supabase/templates/), o .faundrignore
 * e, com git, o que está no .gitignore. Usado aqui e na Vitrine (showcase.mjs).
 */
export function styleFiles(root, keep) {
  const ignored = faundrIgnore(root)
  const listed = gitListed(root)
  const out = []
  const walk = (dir, depth) => {
    if (depth > 8) return
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      // Pasta sem permissão ou apagada no meio da leitura: pula, os tokens saem do que deu para ler.
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(root, abs).split(path.sep).join('/')
      if (SKIP.test(rel) || NOT_APP_STYLE.test(rel) || ignoredBy(ignored, rel) || (e.isDirectory() && isClaudePlugin(abs))) continue
      if (e.isDirectory()) walk(abs, depth + 1)
      else if (keep(e.name) && (!listed || listed.has(rel))) out.push(rel)
    }
  }
  walk(root, 0)
  return out
}

const read = (root, rel) => {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8')
  } catch {
    return ''
  }
}

const SOURCE = /\.(m?[jt]sx?|vue|svelte|astro|html?)$/
// import './x.css', import css from '../styles.css?url', require('./x.css') e <link rel="stylesheet" href="…">.
const CSS_IN_CODE = /(?:\bimport\s+(?:[^'"`;]*?\s+from\s+)?|\brequire\(\s*|<link\b[^>]*?\bhref\s*=\s*)['"]([^'"]+\.(?:css|scss))(?:\?[^'"]*)?['"]/g
const CSS_IMPORT = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g

// Caminho de um import de CSS visto em `fromRel` (relativo, da raiz "/" ou com apelido @/ e ~/); null para pacotes.
function resolveCss(fromRel, spec, exists) {
  const dir = path.posix.dirname(fromRel)
  const norm = (p) => path.posix.normalize(p).replace(/^(\.\/)+/, '')
  if (spec.startsWith('.')) return norm(path.posix.join(dir, spec))
  if (spec.startsWith('/')) return norm(spec.slice(1))
  const alias = spec.match(/^[@~]\/(.+)/)?.[1]
  if (!alias) return null
  // O apelido costuma apontar para o src/ da parte do arquivo que importa (frontend/src/…) ou da raiz.
  const part = fromRel.includes('/src/') ? fromRel.slice(0, fromRel.indexOf('/src/') + 1) : ''
  return [`${part}src/${alias}`, `src/${alias}`, alias, `app/${alias}`].map(norm).find(exists) ?? null
}

/**
 * CSS que o app usa de verdade: os arquivos importados pelo código (import, <link>) e o que eles puxam com @import,
 * na ordem da cascata (o importado antes de quem importa). `entries` são os de entrada (os que o código importa).
 * Sem nenhum import achado, todos os arquivos de estilo do app (já sem public/, extension/, e-mails…).
 */
export function appStyleFiles(root, keep = (name) => /\.(css|scss)$/.test(name)) {
  const allowed = styleFiles(root, keep)
  const allowedSet = new Set(allowed)
  const exists = (rel) => allowedSet.has(rel)
  const entries = []
  const sources = styleFiles(root, (name) => SOURCE.test(name) && !/\.d\.ts$/.test(name)).slice(0, 5000)
  for (const rel of sources) {
    const text = read(root, rel)
    if (!/\.(css|scss)\b/.test(text)) continue
    for (const m of text.matchAll(CSS_IN_CODE)) {
      const target = resolveCss(rel, m[1], exists)
      if (target && exists(target) && !entries.includes(target)) entries.push(target)
    }
  }
  if (!entries.length) return { entries: allowed, files: allowed, fromImports: false }
  const files = []
  const visit = (rel, depth) => {
    if (files.includes(rel) || depth > 10) return
    for (const m of read(root, rel).matchAll(CSS_IMPORT)) {
      const spec = m[1]
      if (/^https?:/.test(spec)) continue
      // @import "tokens.css" sem ./ também é relativo no CSS puro.
      const target = resolveCss(rel, /^[.\/@~]/.test(spec) ? spec : `./${spec}`, exists)
      if (target && exists(target)) visit(target, depth + 1)
    }
    if (!files.includes(rel)) files.push(rel)
  }
  for (const e of entries) visit(e, 0)
  return { entries, files, fromImports: true }
}

/** Troca var(--x) pelo valor conhecido (até 3 níveis). */
function resolveValue(value, vars) {
  let v = value
  for (let i = 0; i < 3 && /var\(--/.test(v); i++)
    v = v.replace(/var\(--([\w-]+)(?:\s*,\s*([^)]+))?\)/g, (all, name, fb) => vars.get(name) ?? fb ?? all)
  return v
}

// Texto de markdown sem marcação, para "quando usar".
const plain = (s) =>
  s
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
const unbalanced = (s) => ((s.match(/\(/g) ?? []).length < (s.match(/\)/g) ?? []).length ? s.replace(/\)\s*$/, '') : s)
const short = (s, n = 160) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

/** Seções do markdown: título (##) → linhas. */
function sections(md) {
  const out = []
  let cur = { title: '', lines: [] }
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#{1,4}\s+(.+)/)
    if (h) {
      out.push(cur)
      cur = { title: plain(h[1]), lines: [] }
    } else cur.lines.push(line)
  }
  out.push(cur)
  return out.filter((s) => s.lines.some((l) => l.trim()))
}

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

/** Texto logo antes de uma menção (desde a última pontuação), ex.: "Título de página" em "Título de página `text-4xl`". */
function beforeContext(line, index) {
  const piece = plain(line.slice(0, index).replace(/[`\s]+$/, '').split(/[,;.:()]/).pop() ?? '')
  return piece.length >= 8 && !/^[-*]/.test(piece) ? short(piece, 60) : ''
}

// Contexto depois da menção, só se for texto (não outra classe como tracking-[0.18em]).
function proseAfter(line, match) {
  const after = mentionContext(line, match.index, match[0].length)
  return after !== short(plain(line.replace(/^\s*[-*]\s*/, ''))) && !/[[\]]|^[\w]+-/.test(after) ? after : ''
}

/** Contexto de uma menção: o texto logo depois dela (até a vírgula), ou a linha inteira. */
function mentionContext(line, index, length) {
  // Pula o fechamento da crase e menções encadeadas (`neutral-300`/`neutral-400` texto de apoio).
  const rest = line.slice(index + length).replace(/^[`\s]*(\/\s*`?[\w-]+`?\s*)*/, '')
  const after = plain(rest.split(/[,;.]|`/)[0] ?? '')
  if (after.length >= 4) return short(unbalanced(after))
  return short(plain(line.replace(/^\s*[-*]\s*/, '')))
}

/**
 * Variáveis CSS do projeto separadas por tema: `base` (@theme, :root, html, body, :host sem qualificador de tema),
 * `dark` (.dark, [data-theme=dark], prefers-color-scheme: dark, @variant dark) e `light` (o mesmo para o claro).
 * Variável definida dentro de um componente (.card { --x }) ou de um @media de largura não é token e fica de fora.
 * Em cada tema a última definição vence, como no CSS; uma troca de tema nunca substitui o valor do tema base.
 * `bgRefs`: o fundo da página no tema base (background de html/body/:root ou @apply bg-*), para saber se é escuro.
 */
function projectCssVars(root) {
  const vars = { base: new Map(), dark: new Map(), light: new Map() }
  const varSource = new Map()
  const bgRefs = []
  for (const rel of appStyleFiles(root).files.slice(0, 200)) {
    for (const rule of cssRules(read(root, rel))) {
      const theme = contextTheme(rule.context)
      if (!theme) continue
      for (const [k, v] of customProps(rule.decls)) {
        vars[theme].set(k, v)
        if (theme === 'base' || !varSource.has(k)) varSource.set(k, rel)
      }
      if (theme !== 'base' || !/(^|[\s,])(html|body|:root)\b/.test(rule.context.at(-1) ?? '')) continue
      const bg = rule.decls.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/)?.[1]
      if (bg) bgRefs.push(bg.trim())
      const applied = rule.decls.match(/@apply\s+[^;]*?(?:^|\s)bg-([\w-]+)/)?.[1]
      if (applied) bgRefs.push(`var(--color-${applied})`)
    }
  }
  return { vars, varSource, bgRefs }
}

/** Variáveis do tema padrão do Tailwind instalado (vazio se o projeto não usa Tailwind 4). */
function tailwindThemeVars(root) {
  try {
    // Na raiz ou numa parte do projeto (ex.: frontend/node_modules).
    return cssVars(fs.readFileSync(inNodeModules(root, 'tailwindcss/theme.css'), 'utf8'))
  } catch {
    // Sem Tailwind 4 instalado não há tema padrão: os tokens saem só do projeto e do design.md.
    return new Map()
  }
}

// O que o design.md proíbe ("Não faça", "nunca use #fff") não é token nem cor da paleta.
export const PROHIBITED_TITLE = /n[ãa]o fa[çc]a|don'?t|do not|evite|avoid|proibid|nunca|never/i
const PROHIBITION = /n[ãa]o\s+(?:fa[çc]a|use|usar|utilize|coloque)|\bnunca\b|\bdon'?t\b|\bdo not\b|\bnever\b|\bavoid\b|\bevite\b|\bproibid/i

/**
 * A linha sem o trecho proibido: em cada frase (separada por ; | ou ponto final), o que vem depois de "nunca",
 * "não use", "never", "avoid"… vira espaço (mesmo tamanho, para as posições das menções continuarem certas).
 */
export function withoutProhibitions(line) {
  let out = ''
  for (const clause of line.split(/(?<=[;|]|\.(?=\s|$))/)) {
    const m = clause.match(PROHIBITION)
    out += m ? clause.slice(0, m.index) + ' '.repeat(clause.length - m.index) : clause
  }
  return out
}

/** Seções do design.md: [{ title, lines }] (o título vem sem marcação). */
export const designSections = (md) => sections(md)

/**
 * Exceções decididas no design.md: os tópicos da seção "Escopo e exceções" / "Scope and exceptions" (ou só
 * "Exceções"), cada um "técnica — motivo". Até 50, cada um com até 300 caracteres.
 */
export function designExceptions(md) {
  const sec = sections(md ?? '').find((s) => /escopo e exce|scope and exce|^exce[çc][õo]es\b|^exceptions\b/i.test(s.title))
  if (!sec) return []
  return sec.lines
    .filter((l) => /^\s*[-*+]\s+\S/.test(l))
    .map((l) => l.replace(/^\s*[-*+]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((l) => l.slice(0, 300))
}

/** Menções no design.md (`neutral-200`, text-sm, rounded-md…) com a linha e a seção onde aparecem. */
function mentionsIn(secs, re) {
  const found = new Map()
  for (const sec of secs) {
    if (PROHIBITED_TITLE.test(sec.title)) continue
    for (const line of sec.lines)
      for (const m of withoutProhibitions(line).matchAll(re)) {
        const key = m[1]
        if (!found.has(key)) found.set(key, { match: m, line, section: sec.title })
      }
  }
  return found
}

const normHex = (h) => {
  const s = h.toLowerCase().slice(1)
  return '#' + (s.length === 3 ? [...s].map((c) => c + c).join('') : s)
}
// Mesma cor escrita de jeitos diferentes (#fff e #ffffff).
const FULL_HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{3})$/i
const sameColor = (a, b) => {
  if (!a || !b) return false
  const [x, y] = [a.trim(), b.trim()]
  return FULL_HEX.test(x) && FULL_HEX.test(y) ? normHex(x) === normHex(y) : x.toLowerCase() === y.toLowerCase()
}

/** Linha de tabela do design.md com um hex → { name, hex, usage } (nome na 1ª célula, uso na última). */
function tableColor(line) {
  if (!/^\s*\|/.test(line) || /^\s*\|[\s|:-]+\|?\s*$/.test(line)) return null
  const row = cells(line)
  const hex = row.map((c) => c.match(HEX)?.[0]).find(Boolean)
  if (!hex || row.length < 2) return null
  const name = plain(row[0]).replace(/^--(color-)?/, '')
  if (!name || HEX.test(name)) return null
  return { name, hex, usage: plain(row[row.length - 1]) }
}

/**
 * Cores: variáveis do projeto, tabelas do design.md e cores do Tailwind citadas. `value` é o valor no tema principal;
 * `alt`, o do outro tema quando muda (calculado em extractTokens pela variável de cada cor, guardada em `varName`).
 */
function colorTokens({ projectVars, otherVars, defaults, varSource, value, altValue, secs, designMdPath }) {
  const colors = new Map() // chave: nome
  const addColor = (c) => {
    const prev = colors.get(c.name)
    colors.set(c.name, { ...c, ...prev, usage: prev?.usage || c.usage })
  }

  // 1. Cores do projeto: as do tema principal e as que o outro tema troca (ex.: --color-white do Tailwind no claro).
  for (const k of new Set([...projectVars.keys(), ...otherVars.keys()])) {
    const v = value(k)
    // Sem valor no tema principal (a cor só existe no outro tema): não entra.
    if (!v || !COLOR_VALUE.test(v)) continue
    if (!projectVars.has(k) && !COLOR_VALUE.test(altValue(k) ?? '')) continue
    const name = k.replace(/^color-/, '')
    addColor({ name, value: v, group: projectVars.has(k) || !defaults.has(k) ? 'Projeto' : 'Tailwind', source: varSource.get(k), varName: k })
  }

  // 2. design.md: linhas de tabela com um hex (fora do que o design.md proíbe).
  for (const sec of secs) {
    if (PROHIBITED_TITLE.test(sec.title)) continue
    for (const line of sec.lines) {
      const row = tableColor(line)
      if (!row) continue
      const { name, hex, usage } = row
      // A tabela do outro tema (ex.: "Modo claro") repete os tokens com o valor dele: casa pelo nome ou pelo alt.
      // Casar só pelo valor do outro tema não traz o "quando usar" (o texto fala do outro tema: "nos fundos claros").
      const existing = [...colors.values()].find((c) => c.name === name || sameColor(c.value, hex))
      const otherTheme = !existing && [...colors.values()].find((c) => sameColor(altValue(c.varName ?? '') ?? '', hex))
      if (otherTheme) continue
      if (existing) colors.set(existing.name, { ...existing, usage: existing.usage || short(usage) })
      else addColor({ name, value: hex, group: 'Projeto', usage: short(usage), source: designMdPath })
    }
  }

  // 3. Cores do Tailwind citadas.
  const twColorRe = new RegExp(`\\b(?:bg-|text-|border-|fill-|stroke-|ring-)?((?:${TW_COLORS})-(?:50|[1-9]00|950))\\b`, 'g')
  for (const [name, { match, line }] of mentionsIn(secs, twColorRe)) {
    const v = value(`color-${name}`)
    if (v) addColor({ name, value: v, group: 'Tailwind', usage: mentionContext(line, match.index, match[0].length), varName: `color-${name}` })
  }
  return colors
}

/**
 * Tema principal e se o outro existe, pelo CSS: troca só para o claro → o principal é o escuro (a não ser que o
 * fundo da página seja claro); troca para o escuro → principal claro; sem troca (ou as duas), pela luminância do
 * fundo. null quando o CSS não diz nada (sem troca de tema e sem fundo conhecido).
 */
function cssThemes({ vars, bgRefs, value, colors }) {
  const changesColor = (m) => [...m.values()].some((v) => COLOR_VALUE.test(v) || /^var\(--/.test(v))
  const hasDark = changesColor(vars.dark)
  const hasLight = changesColor(vars.light)
  const resolveBg = (ref) => {
    const v = resolveValue(ref, { get: (k) => value(k) ?? undefined })
    return parseColor(v.match(/#[0-9a-f]{3,8}\b|(?:rgba?|oklch)\([^)]*\)/i)?.[0] ?? v)
  }
  const bg =
    bgRefs.map(resolveBg).find(Boolean) ??
    [...colors.values()].filter((c) => /fundo|background|superf[ií]cie/i.test(c.usage ?? '')).map((c) => parseColor(c.value)).find(Boolean) ??
    [...colors.values()].filter((c) => /^(background|bg|surface|canvas|page)$/.test(c.name)).map((c) => parseColor(c.value)).find(Boolean)
  const dark = bg ? luminance(bg) < 0.2 : null
  let base
  if (hasLight && !hasDark) base = dark === false ? 'claro' : 'escuro'
  else if (hasDark && !hasLight) base = dark === true ? 'escuro' : 'claro'
  else if (dark !== null) base = dark ? 'escuro' : 'claro'
  else return null
  const other = base === 'escuro' ? hasLight : hasDark
  return { base, other }
}

/** Fontes: variáveis --font-* do projeto + as citadas (font-mono); papel pelos tópicos de tipografia. */
function fontTokens({ projectVars, varSource, value, secs }) {
  const fonts = new Map()
  const typoLines = secs.filter((s) => /tipograf|typograph|fonte|font/i.test(s.title)).flatMap((s) => s.lines)
  const roleOf = (fontName) => {
    const line = typoLines.find((l) => new RegExp(`\\bfont-${fontName}\\b|--font-${fontName}\\b`).test(l))
    if (!line) return {}
    const label = line.match(/\*\*([^*]+?):?\*\*/)?.[1]?.replace(/:$/, '')
    return { role: label ? plain(label) : '', usage: short(plain(line.replace(/^\s*[-*]\s*(\*\*[^*]+\*\*:?)?/, ''))) }
  }
  for (const [k] of projectVars)
    if (/^font-[\w-]+$/.test(k) && !/--/.test(k.slice(5)) && !/weight|size/.test(k)) {
      const name = k.slice(5)
      fonts.set(name, { name, family: value(k), source: varSource.get(k), ...roleOf(name) })
    }
  for (const [name] of mentionsIn(secs, /\bfont-(sans|serif|mono|display|heading|body)\b/g))
    if (!fonts.has(name) && value(`font-${name}`)) fonts.set(name, { name, family: value(`font-${name}`), ...roleOf(name) })
  return fonts
}

const px = (v) => (/rem$/.test(v) ? parseFloat(v) * 16 : parseFloat(v)) || 0

/** Tamanhos de texto citados (escala do tema ou valor arbitrário text-[10px]) + os do projeto, do maior ao menor. */
function sizeTokens({ projectVars, varSource, value, secs }) {
  const sizes = []
  for (const [name, { match, line, section }] of mentionsIn(secs, /\b(text-(?:xs|sm|base|lg|xl|[2-9]xl|\[\d+(?:\.\d+)?(?:px|rem)\]))(?![\w-])/g)) {
    const arbitrary = name.match(/\[(.+)\]/)?.[1]
    const v = arbitrary ?? value(name)
    if (!v) continue
    const lh = arbitrary ? null : value(`${name}--line-height`)
    const label = line.match(/\*\*([^*]+?):?\*\*/)?.[1]
    sizes.push({
      name,
      value: v,
      ...(lh ? { lineHeight: lh } : {}),
      usage: [label && plain(label).replace(/:$/, ''), beforeContext(line, match.index) || proseAfter(line, match)].filter(Boolean).join(' · '),
      section,
    })
  }
  for (const [k] of projectVars)
    if (/^text-[\w-]+$/.test(k) && !k.includes('--') && !sizes.some((s) => s.name === k))
      sizes.push({ name: k, value: value(k), source: varSource.get(k) })
  return sizes.sort((a, b) => px(b.value) - px(a.value))
}

// Valor de um degrau da escala: none e full são fixos; o resto vem do tema (ou o padrão, sem degrau).
function scaleStepValue(size, prefix, fallback, value) {
  if (!size) return fallback
  if (size === 'none') return '0'
  if (size === 'full') return 'calc(infinity * 1px)'
  return value(`${prefix}-${size}`)
}

/** Raios e sombras: do projeto + os citados. */
function scaleTokens({ projectVars, varSource, value, secs }, prefix, cls, fallback) {
  const list = new Map()
  for (const [k] of projectVars)
    if (k.startsWith(`${prefix}-`)) list.set(k.slice(prefix.length + 1), { name: `${cls}-${k.slice(prefix.length + 1)}`, value: value(k), source: varSource.get(k) })
  for (const [key, { match, line }] of mentionsIn(secs, new RegExp(`\\b${cls}(-(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|inner))?(?![\\w-])`, 'g'))) {
    const size = key ? key.slice(1) : ''
    const v = scaleStepValue(size, prefix, fallback, value)
    if (v && !list.has(size || 'DEFAULT'))
      list.set(size || 'DEFAULT', {
        name: size ? `${cls}-${size}` : cls,
        value: v,
        usage: beforeContext(line, match.index) || mentionContext(line, match.index, match[0].length),
      })
  }
  return [...list.values()].filter((t) => t.value)
}

export function extractTokens(root, designMdPath) {
  const md = designMdPath ? fs.readFileSync(path.join(root, designMdPath), 'utf8') : ''
  const { vars, varSource, bgRefs } = projectCssVars(root)
  const projectVars = vars.base
  const defaults = tailwindThemeVars(root)
  const allVars = new Map([...defaults, ...projectVars])
  const value = (name) => (allVars.has(name) ? resolveValue(allVars.get(name), allVars) : null)
  const secs = sections(md)

  // Tema principal primeiro (o fundo pode vir do "quando usar" do design.md), depois as cores com o valor de cada tema.
  const pre = colorTokens({ projectVars, otherVars: new Map(), defaults, varSource, value, altValue: () => null, secs, designMdPath })
  const themes = cssThemes({ vars, bgRefs, value, colors: pre })
  const otherVars = themes ? vars[themes.base === 'escuro' ? 'light' : 'dark'] : new Map()
  const altVars = new Map([...allVars, ...otherVars])
  const altValue = (name) => (altVars.has(name) ? resolveValue(altVars.get(name), altVars) : null)
  const ctx = { projectVars, otherVars, defaults, varSource, value, altValue, secs, designMdPath }

  const colors = colorTokens(ctx)
  // App Flutter: as cores do tema (lib/**/theme|colors.dart) entram na paleta como as variáveis do CSS.
  for (const c of flutterColorTokens(root)) if (!colors.has(c.name)) colors.set(c.name, { ...c, group: 'Projeto' })
  const fonts = fontTokens(ctx)
  const sizes = sizeTokens(ctx)
  const radii = scaleTokens(ctx, 'radius', 'rounded', '0.25rem').sort((a, b) => px(a.value) - px(b.value))
  const shadows = scaleTokens(ctx, 'shadow', 'shadow', value('shadow-sm'))

  return {
    colors: [...colors.values()].map(({ varName, ...c }) => {
      const v = resolveValue(c.value, allVars)
      const alt = varName && otherVars.size ? altValue(varName) : null
      return { ...c, value: v, ...(alt && !sameColor(alt, v) ? { alt } : {}) }
    }),
    fonts: [...fonts.values()].filter((f) => f.family),
    sizes,
    radii,
    shadows,
    ...(themes ? { themes } : {}),
  }
}
