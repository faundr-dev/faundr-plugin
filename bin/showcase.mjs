// Vitrine do design (fase 2): réplicas dos componentes que o agente escreve em .faundr/showcase.json.
// Aqui, sem IA: descobrir como o CSS do projeto roda (Tailwind 4, Tailwind 3 ou CSS puro), juntar esse CSS
// com as fontes (enviadas à parte, servidas pelo painel) e calcular a impressão digital dos arquivos de cada
// componente — quando o arquivo muda, a réplica aparece como desatualizada no painel.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { inNodeModules, isClaudePlugin } from './parts.mjs'

export const SHOWCASE_FILE = '.faundr/showcase.json'
// Marca que o painel troca pelo endereço das fontes (/api/showcase-font/<projeto>).
export const FONT_BASE = '__FAUNDR_FONT__'

const SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|coverage|\.claude|\.remember|\.wrangler|\.next|\.nuxt|\.svelte-kit|\.tanstack|\.vercel|\.output)(\/|$)/
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
  } catch {}
  return 'css'
}

function cssFiles(root) {
  const out = []
  const walk = (dir, depth) => {
    if (depth > 8) return
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(root, abs).split(path.sep).join('/')
      if (SKIP.test(rel) || (e.isDirectory() && isClaudePlugin(abs))) continue
      if (e.isDirectory()) walk(abs, depth + 1)
      else if (/\.css$/.test(e.name) && !/\.module\.css$/.test(e.name)) out.push(rel)
    }
  }
  walk(root, 0)
  return out
}

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

/** Impressão digital dos arquivos de um componente (null se nenhum existe). */
export function fingerprint(root, files) {
  const parts = files.map((f) => read(root, f))
  if (!parts.some(Boolean)) return null
  return sha(files.map((f, i) => `${f}\n${parts[i]}`).join('\n\0')).slice(0, 16)
}

/** Impressão digital atual de cada componente da vitrine, pela chave "arquivo1|arquivo2". */
export function showcaseHashes(root, showcase) {
  const out = {}
  for (const c of showcase?.components ?? []) {
    const files = componentFiles(c)
    if (!files.length) continue
    out[files.join('|')] = fingerprint(root, files) ?? 'missing'
  }
  return out
}

/** Situação de cada réplica: atual, desatualizada (arquivo mudou) ou arquivo sumiu. */
export function showcaseStatus(root, showcase) {
  return (showcase?.components ?? []).map((c) => {
    const files = componentFiles(c)
    const now = files.length ? fingerprint(root, files) : null
    const state = !files.length ? 'sem arquivo' : !now ? 'arquivo sumiu' : c.fingerprint && c.fingerprint !== now ? 'desatualizada' : 'atual'
    return { name: c.name, files, state }
  })
}

/** Prepara o envio: valida o formato, carimba a impressão digital de cada componente e junta CSS e fontes. */
export function buildShowcase(root, showcase) {
  const problems = []
  if (!showcase || !Array.isArray(showcase.components)) problems.push('o arquivo precisa ter "components": [...]')
  const components = (showcase?.components ?? []).map((c, i) => {
    const where = `components[${i}]${c?.name ? ` (${c.name})` : ''}`
    if (!c?.name) problems.push(`${where}: falta "name"`)
    if (!Array.isArray(c?.variants) || !c.variants.length) problems.push(`${where}: falta "variants" com pelo menos uma`)
    for (const [j, v] of (c?.variants ?? []).entries()) if (!v?.html?.trim()) problems.push(`${where}.variants[${j}]: falta "html"`)
    const files = componentFiles(c ?? {})
    for (const f of files) if (!fs.existsSync(path.join(root, f))) problems.push(`${where}: arquivo não existe: ${f}`)
    if (/<script\b/i.test(JSON.stringify(c?.variants ?? []))) problems.push(`${where}: réplica não pode ter <script> (é só visual)`)
    return { ...c, files, fingerprint: files.length ? fingerprint(root, files) : undefined }
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
