// Tokens do design para a Vitrine do painel (sem IA): cores, fontes, tamanhos de texto, raios e sombras.
// Fontes de verdade, nesta ordem:
//   1. variáveis CSS do projeto (@theme do Tailwind, :root) — o valor exato;
//   2. o design.md — nome, valor e "quando usar" (tabelas com hex, tópicos de tipografia);
//   3. o tema padrão do Tailwind instalado no projeto — só para o que o design.md cita (neutral-200, text-sm, rounded-md…).

import fs from 'node:fs'
import path from 'node:path'
import { flutterColorTokens } from './design-flutter.mjs'
import { inNodeModules, isClaudePlugin } from './parts.mjs'

const SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|coverage|\.claude|\.remember|\.wrangler|\.next|\.nuxt|\.svelte-kit|\.tanstack|\.vercel|\.output)(\/|$)/
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(.+\))$/i
const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i
const TW_COLORS =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

/** Variáveis CSS (--nome: valor) de um texto CSS. */
function cssVars(text) {
  const out = new Map()
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of clean.matchAll(/--([\w-]+)\s*:\s*([^;{}]+);/g)) out.set(m[1], m[2].replace(/\s+/g, ' ').trim())
  return out
}

/**
 * Arquivos de estilo do projeto (até 8 pastas de fundo) cujo nome passa em `keep`, pulando dependências,
 * saídas de build e plugins do Claude. Usado aqui e na Vitrine (showcase.mjs).
 */
export function styleFiles(root, keep) {
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
      if (SKIP.test(rel) || (e.isDirectory() && isClaudePlugin(abs))) continue
      if (e.isDirectory()) walk(abs, depth + 1)
      else if (keep(e.name)) out.push(rel)
    }
  }
  walk(root, 0)
  return out
}

const cssFiles = (root) => styleFiles(root, (name) => /\.(css|scss)$/.test(name)).slice(0, 200)

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

/** Variáveis CSS do projeto (a última definição vence, como no CSS) e o arquivo de onde cada uma veio. */
function projectCssVars(root) {
  const projectVars = new Map()
  const varSource = new Map()
  for (const rel of cssFiles(root)) {
    let text = ''
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8')
    } catch {
      continue
    }
    for (const [k, v] of cssVars(text)) {
      projectVars.set(k, v)
      varSource.set(k, rel)
    }
  }
  return { projectVars, varSource }
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

/** Menções no design.md (`neutral-200`, text-sm, rounded-md…) com a linha e a seção onde aparecem. */
function mentionsIn(secs, re) {
  const found = new Map()
  for (const sec of secs) {
    // O que o design.md proíbe ("Não faça") não é token do design.
    if (/n[ãa]o fa[çc]a|don'?t|evite|avoid|proibid/i.test(sec.title)) continue
    for (const line of sec.lines)
      for (const m of line.matchAll(re)) {
        const key = m[1]
        if (!found.has(key)) found.set(key, { match: m, line, section: sec.title })
      }
  }
  return found
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

/** Cores: variáveis do projeto, tabelas do design.md e cores do Tailwind citadas. */
function colorTokens({ projectVars, varSource, value, secs, designMdPath }) {
  const colors = new Map() // chave: nome
  const addColor = (c) => {
    const prev = colors.get(c.name)
    colors.set(c.name, { ...c, ...prev, usage: prev?.usage || c.usage })
  }

  // 1. Cores do projeto.
  for (const [k] of projectVars) {
    const v = value(k)
    if (!v || !COLOR_VALUE.test(v)) continue
    const name = k.replace(/^color-/, '')
    addColor({ name, value: v, group: 'Projeto', source: varSource.get(k) })
  }

  // 2. design.md: linhas de tabela com um hex.
  for (const sec of secs)
    for (const line of sec.lines) {
      const row = tableColor(line)
      if (!row) continue
      const { name, hex, usage } = row
      const existing = [...colors.values()].find((c) => c.name === name || c.value.toLowerCase() === hex.toLowerCase())
      if (existing) colors.set(existing.name, { ...existing, usage: existing.usage || short(usage) })
      else addColor({ name, value: hex, group: 'Projeto', usage: short(usage), source: designMdPath })
    }

  // 3. Cores do Tailwind citadas.
  const twColorRe = new RegExp(`\\b(?:bg-|text-|border-|fill-|stroke-|ring-)?((?:${TW_COLORS})-(?:50|[1-9]00|950))\\b`, 'g')
  for (const [name, { match, line }] of mentionsIn(secs, twColorRe)) {
    const v = value(`color-${name}`)
    if (v) addColor({ name, value: v, group: 'Tailwind', usage: mentionContext(line, match.index, match[0].length) })
  }
  return colors
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
  const { projectVars, varSource } = projectCssVars(root)
  const allVars = new Map([...tailwindThemeVars(root), ...projectVars])
  const value = (name) => (allVars.has(name) ? resolveValue(allVars.get(name), allVars) : null)
  const ctx = { projectVars, varSource, value, secs: sections(md), designMdPath }

  const colors = colorTokens(ctx)
  // App Flutter: as cores do tema (lib/**/theme|colors.dart) entram na paleta como as variáveis do CSS.
  for (const c of flutterColorTokens(root)) if (!colors.has(c.name)) colors.set(c.name, { ...c, group: 'Projeto' })
  const fonts = fontTokens(ctx)
  const sizes = sizeTokens(ctx)
  const radii = scaleTokens(ctx, 'radius', 'rounded', '0.25rem').sort((a, b) => px(a.value) - px(b.value))
  const shadows = scaleTokens(ctx, 'shadow', 'shadow', value('shadow-sm'))

  return {
    colors: [...colors.values()].map((c) => ({ ...c, value: resolveValue(c.value, allVars) })),
    fonts: [...fonts.values()].filter((f) => f.family),
    sizes,
    radii,
    shadows,
  }
}
