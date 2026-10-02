// Checagem de design sem IA (roda na CLI, de graça, em segundos).
// Acha o design.md e aponta padrões que quase sempre são problema:
//   - cores escritas direto no código em vez de vir da paleta do design.md;
//   - o mesmo estilo de elemento repetido em vários lugares (candidato a componente);
//   - menus/popovers dentro de caixas com overflow escondido (o menu abre cortado).
// O julgamento fino (a tela segue o design.md? faz sentido?) fica com a auditoria do agente.

import fs from 'node:fs'
import path from 'node:path'
import { extractTokens } from './design-tokens.mjs'
import { runRules } from './design-rules.mjs'

const SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|coverage|\.claude|\.remember|\.wrangler|\.next|\.nuxt|\.svelte-kit|\.tanstack|\.vercel|\.output)(\/|$)/
const UI_EXT = /\.(tsx|jsx|vue|svelte|astro)$/
const GENERATED = /\.gen\.|\.d\.ts$|\.test\.|\.spec\.|\.stories\./
const DESIGN_NAMES = /^design\.md$/i
const DESIGN_DIRS = ['', 'docs', 'doc', 'design', '.faundr', '.claude', 'src']

/** Caminho relativo do design.md (ou null). */
export function findDesignMd(root) {
  for (const dir of DESIGN_DIRS) {
    let entries = []
    try {
      entries = fs.readdirSync(path.join(root, dir))
    } catch {
      continue
    }
    const hit = entries.find((e) => DESIGN_NAMES.test(e))
    if (hit) return [dir, hit].filter(Boolean).join('/')
  }
  return null
}

function ignoreList(root) {
  try {
    return fs
      .readFileSync(path.join(root, '.faundrignore'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\\/g, '/'))
      .filter((l) => l && !l.startsWith('#'))
  } catch {
    return []
  }
}

/** Arquivos de tela do projeto (componentes e páginas). */
export function uiFiles(root) {
  const ignored = ignoreList(root)
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(root, abs).split(path.sep).join('/')
      if (SKIP.test(rel) || rel.startsWith('plugin/') || ignored.some((i) => rel === i || rel.startsWith(i.replace(/\/?$/, '/')))) continue
      if (e.isDirectory()) walk(abs)
      else if (UI_EXT.test(e.name) && !GENERATED.test(e.name)) out.push(rel)
    }
  }
  walk(root)
  return out
}

const HEX = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi
const normHex = (h) => {
  const s = h.toLowerCase().slice(1)
  return '#' + (s.length === 3 ? [...s].map((c) => c + c).join('') : s)
}

/** Cores declaradas no design.md e nos arquivos de tokens (css com variáveis / @theme). */
function palette(root, designMd) {
  const colors = new Set()
  const add = (text) => (text.match(HEX) ?? []).forEach((h) => colors.add(normHex(h)))
  if (designMd) add(fs.readFileSync(path.join(root, designMd), 'utf8'))
  return colors
}

const POPUP = /<(Menu|DropdownMenu|Dropdown\w*|Popover\w*|Tooltip\w*|Combobox\w*|ContextMenu\w*|Select)\b/
const CLIPS = /\boverflow-(hidden|auto|scroll|clip|x-auto|y-auto|x-hidden|y-hidden)\b/

/** Corpo de cada componente-função do arquivo: nome → texto. */
function components(text) {
  const out = new Map()
  const re = /^(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)|^(?:export\s+)?const\s+([A-Z]\w*)\s*=/gm
  const starts = [...text.matchAll(re)].map((m) => ({ name: m[1] ?? m[2], at: m.index }))
  starts.forEach((s, i) => out.set(s.name, text.slice(s.at, starts[i + 1]?.at ?? text.length)))
  return out
}

/** Componentes (deste arquivo) que abrem um menu flutuante — direta ou indiretamente — sem portal. */
function popupComponents(bodies) {
  const hits = new Set()
  let grew = true
  while (grew) {
    grew = false
    for (const [name, body] of bodies) {
      if (hits.has(name) || /createPortal|<Portal\b/.test(body)) continue
      const uses = POPUP.test(body) || [...hits].some((h) => new RegExp(`<${h}\\b`).test(body))
      if (uses) {
        hits.add(name)
        grew = true
      }
    }
  }
  return hits
}

const indentOf = (line) => line.match(/^\s*/)[0].length

/** Caixas com overflow que contêm um menu flutuante: o menu abre cortado. */
function clippedPopups(rel, text) {
  const findings = []
  const lines = text.split(/\r?\n/)
  const bodies = components(text)
  const popupNames = popupComponents(bodies)
  const usesPopup = (s) => POPUP.test(s) || [...popupNames].some((n) => new RegExp(`<${n}\\b`).test(s))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!/<[a-zA-Z]/.test(line) && !/className=/.test(line)) continue
    if (!CLIPS.test(line)) continue
    // Início da tag: a linha com "<" no mesmo nível ou acima.
    let open = i
    while (open > 0 && !/<[a-zA-Z]/.test(lines[open])) open--
    const base = indentOf(lines[open])
    const subtree = []
    for (let j = open + 1; j < lines.length; j++) {
      if (lines[j].trim() && indentOf(lines[j]) <= base) break
      subtree.push(lines[j])
    }
    const inside = subtree.join('\n')
    if (!usesPopup(inside)) continue
    const culprit = inside.match(POPUP)?.[1] ?? [...popupNames].find((n) => new RegExp(`<${n}\\b`).test(inside))
    const clip = line.match(CLIPS)[0]
    findings.push({
      kind: 'visual',
      severity: 'high',
      title: `Menu "${culprit}" pode abrir cortado dentro de uma caixa com ${clip}`,
      detail: `A caixa na linha ${open + 1} usa "${clip}", e dentro dela há um menu flutuante (${culprit}). Quando o menu abre, a parte que passa da borda da caixa fica escondida. Tire o ${clip} da caixa (use rounded nas células) ou renderize o menu num portal (fora da caixa).`,
      file: rel,
      line: open + 1,
      rule: 'visual/menu-cortado',
      fingerprint: `lint:clip|${rel}|${culprit}|${clip}`,
    })
  }
  return findings
}

/** Cores escritas direto no código. Com design.md, só as que não estão na paleta dele. */
function looseColors(rel, text, colors, hasDesign) {
  const hits = []
  text.split(/\r?\n/).forEach((line, i) => {
    // className arbitrário do Tailwind (bg-[#123456]) ou estilo inline com cor.
    const candidates = [
      ...[...line.matchAll(/-\[(#[0-9a-f]{3,6})\]/gi)].map((m) => m[1]),
      ...(/style=|(color|background|fill|stroke|border)\w*\s*:/i.test(line) ? line.match(HEX) ?? [] : []),
    ]
    for (const c of candidates) if (!hasDesign || !colors.has(normHex(c))) hits.push({ color: normHex(c), line: i + 1 })
  })
  if (!hits.length) return []
  const unique = [...new Set(hits.map((h) => h.color))]
  return [
    {
      kind: 'off_spec',
      severity: 'medium',
      title: hasDesign
        ? `${unique.length === 1 ? '1 cor fora' : `${unique.length} cores fora`} da paleta do design.md`
        : `${unique.length === 1 ? '1 cor escrita' : `${unique.length} cores escritas`} direto no código`,
      detail: `${unique.slice(0, 8).join(', ')}${unique.length > 8 ? '…' : ''}. ${
        hasDesign
          ? 'Use as cores (tokens) definidas no design.md.'
          : 'Crie tokens de cor (ex.: no tema do Tailwind) e use-os, para mudar a paleta num lugar só.'
      }`,
      file: rel,
      line: hits[0].line,
      rule: 'design/cor-fora-da-paleta',
      fingerprint: `lint:color|${rel}`,
    },
  ]
}

/** Mesma lista de classes num elemento, repetida em vários lugares: vire um componente. */
function repeatedStyles(texts) {
  const byStyle = new Map()
  for (const [rel, text] of texts) {
    text.split(/\r?\n/).forEach((line, i) => {
      const m = line.match(/<(button|a|input|span|div|Link)\b[^>]*?className="([^"{}]+)"/)
      if (!m) return
      const classes = m[2].trim().split(/\s+/)
      if (classes.length < 6) return
      const key = `${m[1]}|${[...classes].sort().join(' ')}`
      const list = byStyle.get(key) ?? []
      list.push({ rel, line: i + 1 })
      byStyle.set(key, list)
    })
  }
  const findings = []
  for (const [key, where] of byStyle) {
    if (where.length < 3) continue
    const [tag] = key.split('|')
    const files = [...new Set(where.map((w) => w.rel))]
    findings.push({
      kind: 'duplicate',
      severity: where.length >= 5 ? 'medium' : 'low',
      title: `Mesmo estilo de <${tag}> repetido ${where.length} vezes`,
      detail: `Aparece em ${files.slice(0, 4).join(', ')}${files.length > 4 ? '…' : ''}. Crie um componente reutilizável (ou uma classe do tema) e use-o nesses lugares, para mudar o visual num lugar só.`,
      file: where[0].rel,
      line: where[0].line,
      rule: 'repeticao/estilo-repetido',
      fingerprint: `lint:dup|${key}`,
    })
  }
  return findings
}

/** Muitos <button> com estilo escrito na hora e nenhum componente de botão. */
function rawButtons(texts) {
  let raw = 0
  let first = null
  const files = new Set()
  let hasButtonComponent = false
  for (const [rel, text] of texts) {
    if (/(function|const)\s+Button\b/.test(text)) hasButtonComponent = true
    text.split(/\r?\n/).forEach((line, i) => {
      if (/<button\b[^>]*className=/.test(line)) {
        raw++
        files.add(rel)
        first ??= { rel, line: i + 1 }
      }
    })
  }
  if (hasButtonComponent || raw < 8 || files.size < 3) return []
  return [
    {
      kind: 'practice',
      severity: 'medium',
      title: `${raw} botões montados na mão, sem componente de botão`,
      detail: `Há ${raw} <button> com classes escritas na hora em ${files.size} arquivos. Crie um componente <Button> com as variantes do design (principal, secundário, ícone) e use-o em todo lugar.`,
      file: first.rel,
      line: first.line,
      rule: 'pratica/botoes-sem-componente',
      fingerprint: 'lint:raw-buttons',
    },
  ]
}

/** Roda todas as checagens. */
export function lintProject(root) {
  const designMdPath = findDesignMd(root)
  const files = uiFiles(root)
  const colors = palette(root, designMdPath)
  const texts = files.map((rel) => [rel, fs.readFileSync(path.join(root, rel), 'utf8')])
  // O texto vai para a aba Design → Guia do painel.
  const designMd = designMdPath ? fs.readFileSync(path.join(root, designMdPath), 'utf8').slice(0, 100_000) : null
  // Cores, fontes, tamanhos e raios para a aba Design → Vitrine (falha aqui não derruba a checagem).
  let tokens = null
  try {
    tokens = extractTokens(root, designMdPath)
  } catch {}
  // Regras da fase 2 (identidade, responsivo, acessibilidade, contraste, movimento, conteúdo, consistência).
  let rules = { findings: [], ignored: 0 }
  try {
    rules = runRules(root, { uiExt: UI_EXT, designMdPath, designMd, tokens })
  } catch (err) {
    rules.error = err.message
  }
  const findings = [
    ...texts.flatMap(([rel, text]) => clippedPopups(rel, text)),
    ...texts.flatMap(([rel, text]) => looseColors(rel, text, colors, !!designMdPath)),
    ...repeatedStyles(texts),
    ...rawButtons(texts),
    ...rules.findings,
  ]
  return { designMdPath, designMd, tokens, uiFiles: files.length, findings, ignored: rules.ignored, rulesError: rules.error }
}

/** O arquivo é de tela? (para a auditoria do fim da resposta) */
export const isUiFile = (rel) => UI_EXT.test(rel) || /\.(css|scss)$/.test(rel)
