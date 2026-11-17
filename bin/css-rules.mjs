// Leitura de CSS em regras com o contexto (seletores e at-rules de fora para dentro). Usado pelos tokens
// (qual tema cada variável define) e pela impressão digital da Vitrine (só as regras que a réplica usa).

/**
 * Cada bloco do CSS: { context: [prelúdios de fora para dentro], decls: declarações do próprio bloco
 * (sem os blocos de dentro) }. Comentários saem; strings com chaves não confundem a leitura.
 */
export function cssRules(text) {
  const clean = String(text).replace(/\/\*[\s\S]*?\*\//g, ' ')
  const out = []
  const stack = []
  let seg = 0
  let quote = null
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quote) {
      if (c === quote && clean[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '{') {
      const piece = clean.slice(seg, i)
      const cut = piece.lastIndexOf(';')
      if (stack.length && cut >= 0) stack.at(-1).decls += piece.slice(0, cut + 1)
      stack.push({ prelude: piece.slice(cut + 1).trim().replace(/\s+/g, ' '), decls: '' })
      seg = i + 1
    } else if (c === '}') {
      const node = stack.pop()
      if (node) {
        node.decls += clean.slice(seg, i)
        out.push({ context: [...stack.map((s) => s.prelude), node.prelude], decls: node.decls.trim() })
      }
      seg = i + 1
    }
  }
  return out
}

/** Declarações "--nome: valor" de um bloco, na ordem. */
export function customProps(decls) {
  const out = []
  for (const m of decls.matchAll(/(?:^|;)\s*--([\w-]+)\s*:\s*([^;]*)/g)) {
    const v = m[2].replace(/\s+/g, ' ').trim()
    if (v) out.push([m[1], v])
  }
  return out
}

// Qualificadores de tema num seletor: .dark, .theme-dark, [data-theme=dark], [data-mode='dark'], [data-color-scheme=dark]…
const qualifier = (name) => new RegExp(`\\.(?:theme-)?${name}(?![\\w-])|\\[data-[\\w-]*(?:theme|mode|scheme)[\\w-]*\\s*[~|^$*]?=\\s*['"]?${name}['"]?\\s*\\]`, 'gi')
const DARK_Q = qualifier('dark')
const LIGHT_Q = qualifier('light')
const has = (re, s) => {
  re.lastIndex = 0
  return re.test(s)
}

// Separa uma lista de seletores pelas vírgulas de fora dos parênteses.
function selectorList(sel) {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === '(') depth++
    else if (sel[i] === ')') depth--
    else if (sel[i] === ',' && depth === 0) {
      out.push(sel.slice(start, i))
      start = i + 1
    }
  }
  out.push(sel.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/**
 * Tema de um seletor que vale para a página toda (:root, html, body, :host, & e os qualificadores de tema):
 * 'base', 'dark' ou 'light'; null quando o seletor é de um componente (.card, .dark .card…).
 * Numa lista, o seletor sem tema vence (":root, .light" é o tema base).
 */
export function selectorTheme(sel) {
  let found = null
  for (const s of selectorList(sel)) {
    const bare = s.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '')
    const dark = has(DARK_Q, bare)
    const light = has(LIGHT_Q, bare)
    if (dark && light) continue
    const rest = bare
      .replace(DARK_Q, '')
      .replace(LIGHT_Q, '')
      .replace(/:(where|is)\(\s*[\s,*]*\)/g, '')
    const rootish = rest
      .split(/[\s>+~]+/)
      .filter(Boolean)
      .every((p) => /^(:root|html|body|:host|\*|&)+$/.test(p))
    if (!rootish) continue
    const theme = dark ? 'dark' : light ? 'light' : 'base'
    if (theme === 'base') return 'base'
    found ??= theme
  }
  return found
}

/**
 * Tema de um contexto inteiro (lista de prelúdios): 'base', 'dark', 'light' ou null (componente, @media de largura,
 * @keyframes…). @theme, @layer e @supports não mudam o tema; @media (prefers-color-scheme) e @variant dark|light mudam.
 */
export function contextTheme(context) {
  let theme = 'base'
  const set = (t) => {
    if (t === 'base') return true
    if (theme !== 'base' && theme !== t) return false
    theme = t
    return true
  }
  for (const p of context) {
    let t
    if (p.startsWith('@')) {
      if (/^@theme\b/.test(p) || /^@(layer|supports)\b/.test(p)) t = 'base'
      else if (/^@media\b/.test(p)) {
        const m = p.match(/prefers-color-scheme\s*:\s*(dark|light)/)
        t = m ? m[1] : null
      } else t = p.match(/^@variant\s+(dark|light)\b/)?.[1] ?? null
    } else t = selectorTheme(p)
    if (!t || !set(t)) return null
  }
  return theme
}
