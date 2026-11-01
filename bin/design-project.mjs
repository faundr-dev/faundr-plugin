// Leitura do projeto para as regras de design: arquivos de tela, tags, classes, blocos de CSS,
// cores e contraste, ignorar por comentário e o coletor de achados (parte de design-rules.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { allDeps, faundrIgnore, ignoredBy, isClaudePlugin } from './parts.mjs'

const SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|coverage|\.claude|\.remember|\.wrangler|\.next|\.nuxt|\.svelte-kit|\.tanstack|\.vercel|\.output)(\/|$)/
const NOT_APP = /(^|\/)(__tests__|__mocks__|fixtures?|mocks?|stories|test|tests|e2e)(\/|$)|\.(test|spec|stories)\.|\.gen\./

// ---------- leitura do projeto ----------

function walk(root) {
  const ignored = faundrIgnore(root)
  const out = []
  const visit = (dir, depth) => {
    if (depth > 10) return
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      // Pasta sem permissão ou apagada no meio da leitura: pula, as regras olham só o que deu para ler.
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(root, abs).split(path.sep).join('/')
      if (SKIP.test(rel) || ignoredBy(ignored, rel) || (e.isDirectory() && isClaudePlugin(abs))) continue
      if (e.isDirectory()) visit(abs, depth + 1)
      else out.push(rel)
    }
  }
  visit(root, 0)
  return out
}

const read = (root, rel) => {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8')
  } catch {
    return ''
  }
}

// Onde fica o <head> em cada framework (o primeiro que existir conta; vários podem existir).
const HEAD_FILES = [
  /^index\.html$/,
  /^public\/index\.html$/,
  /^src\/routes\/__root\.(tsx|jsx)$/,
  /^(src\/)?app\/layout\.(tsx|jsx|js)$/,
  /^(src\/)?app\/root\.(tsx|jsx)$/,
  /^(src\/)?pages\/_document\.(tsx|jsx|js)$/,
  /^src\/app\.html$/,
  /^src\/index\.html$/, // Angular
  /^src\/layouts\/[^/]+\.astro$/,
  /^nuxt\.config\.(ts|js)$/,
  /^app\.vue$/,
  /^resources\/views\/(layouts\/)?[\w-]+\.blade\.php$/, // Laravel
  /^web\/index\.html$/, // Flutter Web
]

export function loadProject(root, uiExt) {
  const all = walk(root)
  const ui = all.filter((f) => uiExt.test(f) && !NOT_APP.test(f))
  const css = all.filter((f) => /\.(css|scss)$/.test(f) && !NOT_APP.test(f))
  const head = all.filter((f) => HEAD_FILES.some((re) => re.test(f)))
  // Telas Flutter: o código do app fica em lib/ (sem os arquivos gerados).
  const dart = all.filter((f) => /(^|\/)lib\/.*\.dart$/.test(f) && !NOT_APP.test(f) && !/\.(g|freezed|gr|mocks)\.dart$/.test(f))
  // Quem troca o tema costuma morar num arquivo de lógica (theme.ts, useColorMode…), fora das telas.
  const themeCode = all.filter((f) => /\.(m?[jt]sx?)$/.test(f) && /theme|color-?mode|dark-?mode|appearance/i.test(f) && !NOT_APP.test(f) && !uiExt.test(f))
  // Dependências da raiz e das partes (um Next em frontend/ também conta).
  const deps = allDeps(root)
  return {
    all,
    ui: ui.map((rel) => ({ rel, text: read(root, rel) })),
    css: css.map((rel) => ({ rel, text: read(root, rel) })),
    head: head.map((rel) => ({ rel, text: read(root, rel) })),
    dart: dart.map((rel) => ({ rel, text: read(root, rel) })),
    themeCode: themeCode.slice(0, 20).map((rel) => ({ rel, text: read(root, rel) })),
    deps,
  }
}

// ---------- análise de JSX/HTML: elementos com seus atributos ----------

export const lineAt = (text, index) => text.slice(0, index).split('\n').length

/** Cada tag de abertura: nome, atributos (até o ">" no nível zero de chaves/aspas), posição, fim. */
export function tags(text) {
  const out = []
  const re = /<([A-Za-z][\w.:-]*)(?=[\s/>])/g
  let m
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length
    let depth = 0
    let quote = null
    for (; i < text.length && i - m.index < 4000; i++) {
      const c = text[i]
      if (quote) {
        if (c === quote && text[i - 1] !== '\\') quote = null
      } else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth <= 0) break
    }
    const attrs = text.slice(m.index + m[0].length, i)
    out.push({ name: m[1], attrs, start: m.index, end: i + 1, selfClosing: attrs.trimEnd().endsWith('/') })
  }
  return out
}

// Classes de verdade (sem cortar o que está entre colchetes, ex.: w-[720px], h-[calc(100vh-7rem)]).
export function classList(attrs) {
  const m = attrs.match(/\b(?:className|class)\s*=\s*([\s\S]*)/)
  if (!m) return []
  return (m[1].match(/[!\w:@.\/#%&-]*\[[^\]\s]*\][\w\/-]*|[!\w:@.\/#%&-]+/g) ?? []).filter((t) => t.length < 80)
}
export const base = (t) => t.slice(t.lastIndexOf(':') + 1).replace(/^!/, '')
export const prefixed = (t) => t.includes(':')

/** Blocos CSS: seletor, corpo, linha (só o nível de regra; @media entra como seletor composto). */
export function cssBlocks(text) {
  const out = []
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const stack = []
  let start = 0
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (c === '{') {
      stack.push({ selector: clean.slice(start, i).trim(), at: i })
      start = i + 1
    } else if (c === '}') {
      const open = stack.pop()
      if (open) {
        const body = clean.slice(open.at + 1, i)
        if (!body.includes('{')) out.push({ selector: [...stack.map((s) => s.selector), open.selector].join(' '), body, line: lineAt(clean, open.at) })
      }
      start = i + 1
    } else if (c === ';' && !stack.length) start = i + 1
  }
  return out
}

// ---------- exceções no código ----------

export function ignoreSet(text) {
  const lines = text.split('\n')
  const perLine = new Map()
  const whole = new Set()
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/faundr-ignore(-file)?\s+([a-z0-9/*,-]+)/g)) {
      const rules = m[2].split(',').filter(Boolean)
      if (m[1]) rules.forEach((r) => whole.add(r))
      else
        for (const n of [i + 1, i + 2]) {
          const set = perLine.get(n) ?? new Set()
          rules.forEach((r) => set.add(r))
          perLine.set(n, set)
        }
    }
  })
  const match = (set, rule) => set.has(rule) || set.has(rule.split('/')[0]) || set.has(`${rule.split('/')[0]}/*`)
  return { ignored: (rule, line) => match(whole, rule) || (perLine.has(line) && match(perLine.get(line), rule)), count: whole.size + perLine.size }
}

// ---------- cores e contraste ----------

export function parseColor(value) {
  const v = String(value).trim().toLowerCase()
  let m = v.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    let h = m[1]
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/)
  if (m) return m.slice(1, 4).map((n) => Number(n) / 255)
  m = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+|none)\s+([\d.]+|none)/)
  if (m) {
    const L = Number(m[1]) / (m[2] ? 100 : 1)
    const C = m[3] === 'none' ? 0 : Number(m[3])
    const H = ((m[4] === 'none' ? 0 : Number(m[4])) * Math.PI) / 180
    const a = C * Math.cos(H)
    const b = C * Math.sin(H)
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const lin = [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ]
    return lin.map((c) => {
      const x = Math.min(1, Math.max(0, c))
      return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
    })
  }
  return null
}

// WCAG 2: luminância relativa e razão de contraste.
export const luminance = (rgb) =>
  rgb
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0)
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// ---------- coleta de achados ----------

export function makeCollector() {
  const hits = new Map() // regra|arquivo → { rule, file, lines: [], ctx }
  return {
    add(rule, file, line, ctx, extra = '') {
      const key = `${rule}|${file ?? ''}|${extra}`
      const h = hits.get(key) ?? { rule, file, lines: [], ctx }
      if (line && h.lines.length < 50 && !h.lines.includes(line)) h.lines.push(line)
      hits.set(key, h)
    },
    hits,
  }
}
