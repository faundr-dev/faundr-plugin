// Vitrine do design (fase 2): réplicas dos componentes que o agente escreve em .faundr/painel/showcase.json.
// Aqui, sem IA: descobrir como o CSS do projeto roda (Tailwind 4, Tailwind 3 ou CSS puro), juntar esse CSS
// com as fontes (enviadas à parte, servidas pelo painel) e calcular a impressão digital dos arquivos de cada
// componente — quando o arquivo muda, a réplica aparece como desatualizada no painel.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { contextTheme, cssRules, customProps } from './css-rules.mjs'
import { appStyleFiles } from './design-tokens.mjs'
import { inNodeModules } from './parts.mjs'
import { relPath } from './paths.mjs'

export const SHOWCASE_FILE = relPath('showcase')
// Marca que o painel troca pelo endereço das fontes (/api/showcase-font/<projeto>).
export const FONT_BASE = '__FAUNDR_FONT__'

const FONT_EXT = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }
const MAX_CSS = 500_000
const MAX_FONTS = 3_000_000

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

/** Como o CSS do projeto roda: pelo Tailwind instalado (4 ou 3) ou CSS puro. */
export function detectRuntime(root) {
  try {
    // Na raiz ou numa parte do projeto (ex.: frontend/node_modules).
    const { version } = JSON.parse(fs.readFileSync(inNodeModules(root, 'tailwindcss/package.json'), 'utf8'))
    const major = Number(String(version).split('.')[0])
    if (major >= 4) return 'tailwind4'
    if (major === 3) return 'tailwind3'
  } catch {
    // Sem Tailwind instalado (ou package.json ilegível): o projeto é tratado como CSS puro.
  }
  return 'css'
}

// CSS de entrada do app (o que o código importa; sem public/, extension/, e-mails, .faundrignore e .gitignore).
// Os .module.css ficam de fora: só valem dentro do componente que os importa.
const cssFiles = (root) => appStyleFiles(root, (name) => /\.css$/.test(name) && !/\.module\.css$/.test(name)).entries

/** Arquivo CSS de um pacote importado pelo nome (@import "@fontsource-variable/inter"). */
function packageCss(root, spec) {
  if (/\.css$/.test(spec)) {
    const css = inNodeModules(root, spec)
    if (css) return css
  }
  const manifest = inNodeModules(root, `${spec}/package.json`)
  if (!manifest) return null
  const direct = path.dirname(manifest)
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(direct, 'package.json'), 'utf8'))
    const entry = pkg.style ?? (/\.css$/.test(pkg.main ?? '') ? pkg.main : 'index.css')
    const file = path.join(direct, entry)
    return fs.existsSync(file) ? file : null
  } catch {
    // package.json do pacote ilegível: o @import some da réplica, como um pacote sem CSS.
    return null
  }
}

/**
 * CSS do projeto pronto para rodar dentro da réplica: tira o que só funciona no build (@import "tailwindcss",
 * @plugin, @source, @config), embute os @import de pacotes e troca as fontes por endereços do painel.
 * Fontes de pacotes com vários alfabetos (Fontsource): só o latino.
 */
export function collectCss(root, runtime) {
  let files = cssFiles(root)
  // No Tailwind, o CSS que importa é o de entrada (o que tem @import "tailwindcss" ou @theme).
  if (runtime !== 'css') {
    const entries = files.filter((f) => /@import\s+["']tailwindcss|@theme\b|@tailwind\s+base/.test(read(root, f)))
    if (entries.length) files = entries
  }
  const fonts = new Map() // hash → { hash, mime, data }
  let fontBytes = 0
  const seen = new Set()

  const fontUrl = (absFile) => {
    const ext = path.extname(absFile).slice(1).toLowerCase()
    const mime = FONT_EXT[ext]
    if (!mime) return null
    let buf
    try {
      buf = fs.readFileSync(absFile)
    } catch {
      // Arquivo de fonte que não existe ou não abre: a réplica cai na fonte de reserva do CSS.
      return null
    }
    const hash = sha(buf).slice(0, 32)
    if (!fonts.has(hash)) {
      if (fontBytes + buf.length > MAX_FONTS) return null
      fontBytes += buf.length
      fonts.set(hash, { hash, mime, data: buf.toString('base64') })
    }
    return `${FONT_BASE}/${hash}.${ext}`
  }

  const process = (absFile, fromPackage) => {
    if (seen.has(absFile)) return ''
    seen.add(absFile)
    let css = ''
    try {
      css = fs.readFileSync(absFile, 'utf8')
    } catch {
      return ''
    }
    const dir = path.dirname(absFile)
    css = css.replace(/\/\*[\s\S]*?\*\//g, '')
    // Diretivas que só existem no build.
    css = css.replace(/@import\s+["']tailwindcss[^;]*;|@(plugin|source|config|reference)\s+[^;]+;/g, '')
    // @import de pacote ou de arquivo local: embute.
    css = css.replace(/@import\s+(?:url\()?["']([^"']+)["']\)?[^;]*;/g, (all, spec) => {
      if (/^https?:/.test(spec)) return all
      const target = spec.startsWith('.') || spec.startsWith('/') ? path.resolve(dir, spec) : packageCss(root, spec)
      return target ? process(target, fromPackage || !spec.startsWith('.')) : ''
    })
    // @font-face: fontes de pacote só no alfabeto latino (o resto pesa e não aparece nas réplicas).
    css = css.replace(/@font-face\s*{[^}]*}/g, (block) => {
      const urls = [...block.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1])
      if (fromPackage && urls.some((u) => /-(cyrillic|greek|vietnamese|latin-ext|math|symbols)/.test(u))) return ''
      return block.replace(/url\(\s*["']?([^"')]+)["']?\s*\)(\s*format\([^)]*\))?/g, (all, u) => {
        if (/^(data:|https?:|__FAUNDR)/.test(u)) return all
        const local = fontUrl(path.resolve(dir, decodeURIComponent(u.split(/[?#]/)[0])))
        return local ? `url("${local}")${all.match(/format\([^)]*\)/)?.[0] ? ' ' + all.match(/format\([^)]*\)/)[0] : ''}` : ''
      })
    })
    // Outros arquivos locais (imagens) não existem na réplica.
    css = css.replace(/url\(\s*["']?(?!data:|https?:|__FAUNDR)([^"')]+)["']?\s*\)/g, 'none')
    return css.trim()
  }

  const css = files
    .map((f) => `/* ${f} */\n${process(path.join(root, f), false)}`)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
  return { css: css.slice(0, MAX_CSS), truncated: css.length > MAX_CSS, fonts: [...fonts.values()], files }
}

function read(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8')
  } catch {
    return ''
  }
}

export function readShowcase(root) {
  const file = path.join(root, SHOWCASE_FILE)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const componentFiles = (c) => [...new Set([...(Array.isArray(c.files) ? c.files : []), c.file].filter(Boolean))]

// Todos os textos de um valor (html, css e o que mais a variante tiver).
const strings = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [])

/** O que as réplicas usam: classes (sem variante hover:, sem /opacidade), tags do html e variáveis CSS citadas. */
export function replicaUsage(components) {
  const usage = { classes: new Set(), tags: new Set(['html', 'body']), vars: new Set() }
  for (const text of components.flatMap((c) => strings(c?.variants ?? []))) {
    for (const m of text.matchAll(/\bclass(?:Name)?\s*=\s*["']([^"']*)["']/g))
      for (const tok of m[1].split(/\s+/).filter(Boolean)) usage.classes.add(tok.slice(tok.lastIndexOf(':') + 1).replace(/^!/, '').replace(/\/[\w.]+$/, ''))
    for (const m of text.matchAll(/<([a-z][\w-]*)/gi)) usage.tags.add(m[1].toLowerCase())
    for (const m of text.matchAll(/--([\w-]+)/g)) usage.vars.add(m[1])
  }
  return usage
}

// Classes, tags e "*" de um seletor (os nomes de elemento ficam sem .classe, #id, [atributo] e :pseudo).
function selectorParts(prelude) {
  const classes = [...prelude.matchAll(/\.((?:\\.|[\w-])+)/g)].map((m) => m[1].replace(/\\/g, ''))
  const bare = prelude.replace(/\.((?:\\.|[\w-])+)|#[\w-]+|\[[^\]]*\]|::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, ' ')
  const tags = bare.split(/[\s>+~,()]+/).filter((tk) => /^([a-z][a-z0-9-]*|\*)$/i.test(tk))
  return { classes, tags: tags.map((tk) => tk.toLowerCase()) }
}

/**
 * Só as partes de uma folha de estilo global que a réplica usa: as regras cujo seletor cita uma classe ou tag dela,
 * as variáveis (--x) citadas por essas regras ou pelas classes (bg-ink → --color-ink), os @keyframes das animações
 * e os @font-face das fontes. Mudar outra parte do arquivo não muda a impressão digital.
 */
export function usedCss(text, usage) {
  const rules = cssRules(text).map((r) => {
    const sel = r.context.filter((p) => !p.startsWith('@'))
    const parts = sel.map(selectorParts)
    return {
      ...r,
      page: sel.length > 0 && contextTheme(r.context) !== null, // :root, html, body e trocas de tema
      atOnly: !sel.length, // @theme, @font-face, @keyframes…
      classes: parts.flatMap((p) => p.classes),
      tags: parts.flatMap((p) => p.tags),
      keyframes: r.context.find((p) => p.startsWith('@keyframes'))?.split(/\s+/)[1],
    }
  })
  const classes = new Set(usage.classes)
  const vars = new Set(usage.vars)
  const animations = new Set()
  const picked = new Set()
  const pickedProps = new Map() // regra → props usadas
  // Variável citada por uma classe: --<qualquer>-<resto>, ex.: bg-ink-raised → --color-ink-raised, font-display → --font-display.
  const suffixes = () => new Set([...classes].map((c) => c.replace(/^-?[a-z]+-/, '')).filter((s) => s && s !== 'DEFAULT'))
  const pick = (r) => {
    for (const m of r.decls.matchAll(/var\(\s*--([\w-]+)/g)) vars.add(m[1])
    for (const m of r.decls.matchAll(/@apply\s+([^;]+)/g)) for (const tk of m[1].trim().split(/\s+/)) classes.add(tk.slice(tk.lastIndexOf(':') + 1).replace(/\/[\w.]+$/, ''))
    for (const m of r.decls.matchAll(/animation(?:-name)?\s*:\s*([^;]+)/g)) for (const tk of m[1].split(/[\s,]+/)) animations.add(tk)
  }
  for (let pass = 0, grew = true; grew && pass < 12; pass++) {
    grew = false
    const sfx = suffixes()
    const usedVar = (name) => vars.has(name) || [...sfx].some((s) => name === s || name.endsWith(`-${s}`))
    rules.forEach((r, i) => {
      if (picked.has(i)) return
      const custom = customProps(r.decls)
      if (r.page || (r.atOnly && /^@theme\b/.test(r.context[0] ?? ''))) {
        // Bloco de tokens: só as variáveis usadas; o resto da regra (color-scheme, @apply…) sempre conta.
        const set = pickedProps.get(i) ?? new Set()
        for (const [k, v] of custom)
          if (!set.has(k) && usedVar(k)) {
            set.add(k)
            for (const m of v.matchAll(/var\(\s*--([\w-]+)/g)) vars.add(m[1])
            grew = true
          }
        pickedProps.set(i, set)
        if (r.page && !r.done) {
          r.done = true
          pick({ decls: r.decls.replace(/(?:^|;)\s*--[\w-]+\s*:[^;]*/g, '') })
          grew = true
        }
        return
      }
      const hit =
        (r.keyframes && animations.has(r.keyframes)) ||
        r.classes.some((c) => classes.has(c)) ||
        r.tags.some((tk) => tk === '*' || usage.tags.has(tk))
      if (hit) {
        picked.add(i)
        pick(r)
        grew = true
      }
    })
  }
  const kept = rules
    .map((r, i) => {
      if (picked.has(i)) return `${r.context.join(' > ')} {${r.decls}}`
      if (r.page) {
        const own = r.decls.replace(/(?:^|;)\s*--[\w-]+\s*:[^;]*/g, '').replace(/[;\s]+/g, ' ').trim()
        const props = customProps(r.decls).filter(([k]) => pickedProps.get(i)?.has(k))
        return own || props.length ? `${r.context.join(' > ')} {${own}|${props.map(([k, v]) => `--${k}:${v}`).join(';')}}` : null
      }
      const props = customProps(r.decls).filter(([k]) => pickedProps.get(i)?.has(k))
      return props.length ? `${r.context.join(' > ')} {${props.map(([k, v]) => `--${k}:${v}`).join(';')}}` : null
    })
    .filter(Boolean)
  // @font-face das fontes citadas no que ficou.
  const keptText = kept.join('\n').toLowerCase()
  for (const r of rules) {
    if (r.context[0] !== '@font-face') continue
    const family = r.decls.match(/font-family\s*:\s*['"]?([^;'"]+)/)?.[1]?.trim().toLowerCase()
    if (family && keptText.includes(family)) kept.push(`@font-face {${r.decls}}`)
  }
  return kept.map((s) => s.replace(/\s+/g, ' ')).join('\n')
}

const GLOBAL_CSS = /\.(css|scss)$/
const SCOPED_CSS = /\.module\.(css|scss)$/

/**
 * Impressão digital dos arquivos de um componente (null se nenhum existe). Com `usage` (o que as réplicas usam),
 * folha de estilo global entra só com as regras usadas; componente (.tsx…) e .module.css entram inteiros.
 */
export function fingerprint(root, files, usage) {
  const parts = files.map((f) => read(root, f))
  if (!parts.some(Boolean)) return null
  const body = (f, text) => (usage && text && GLOBAL_CSS.test(f) && !SCOPED_CSS.test(f) ? usedCss(text, usage) : text)
  return sha(files.map((f, i) => `${f}\n${body(f, parts[i])}`).join('\n\0')).slice(0, 16)
}

// O que as réplicas usam, por chave "arquivo1|arquivo2": réplicas com os mesmos arquivos dividem a chave
// no painel, então dividem também o que conta na impressão digital.
function usageByKey(components) {
  const groups = new Map()
  for (const c of components) {
    const key = componentFiles(c).join('|')
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return new Map([...groups].map(([key, list]) => [key, replicaUsage(list)]))
}

/** Impressão digital atual de cada componente da vitrine, pela chave "arquivo1|arquivo2". */
export function showcaseHashes(root, showcase) {
  const out = {}
  const usage = usageByKey(showcase?.components ?? [])
  for (const [key, u] of usage) out[key] = fingerprint(root, key.split('|'), u) ?? 'missing'
  return out
}

function replicaState(files, now, saved) {
  if (!files.length) return 'sem arquivo'
  if (!now) return 'arquivo sumiu'
  if (saved && saved !== now) return 'desatualizada'
  return 'atual'
}

/** Situação de cada réplica: atual, desatualizada (arquivo mudou) ou arquivo sumiu. */
export function showcaseStatus(root, showcase) {
  const usage = usageByKey(showcase?.components ?? [])
  return (showcase?.components ?? []).map((c) => {
    const files = componentFiles(c)
    const now = files.length ? fingerprint(root, files, usage.get(files.join('|'))) : null
    return { name: c.name, files, state: replicaState(files, now, c.fingerprint) }
  })
}

/** Prepara o envio: valida o formato, carimba a impressão digital de cada componente e junta CSS e fontes. */
export function buildShowcase(root, showcase) {
  const problems = []
  if (!showcase || !Array.isArray(showcase.components)) problems.push('the file needs "components": [...]')
  const usage = usageByKey((showcase?.components ?? []).filter(Boolean))
  const components = (showcase?.components ?? []).map((c, i) => {
    const where = `components[${i}]${c?.name ? ` (${c.name})` : ''}`
    if (!c?.name) problems.push(`${where}: missing "name"`)
    if (!Array.isArray(c?.variants) || !c.variants.length) problems.push(`${where}: missing "variants" with at least one`)
    for (const [j, v] of (c?.variants ?? []).entries()) if (!v?.html?.trim()) problems.push(`${where}.variants[${j}]: missing "html"`)
    const files = componentFiles(c ?? {})
    for (const f of files) if (!fs.existsSync(path.join(root, f))) problems.push(`${where}: file does not exist: ${f}`)
    if (/<script\b/i.test(JSON.stringify(c?.variants ?? []))) problems.push(`${where}: a replica cannot have <script> (it is only visual)`)
    return { ...c, files, fingerprint: files.length ? fingerprint(root, files, usage.get(files.join('|'))) : undefined }
  })
  const runtime = detectRuntime(root)
  const { css, truncated, fonts, files } = collectCss(root, runtime)
  return {
    problems,
    payload: { runtime, css, components, fonts, fileHashes: showcaseHashes(root, { components }) },
    cssFiles: files,
    truncated,
  }
}
