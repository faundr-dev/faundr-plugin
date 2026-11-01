// As regras de design por tela e por projeto: responsivo, acessibilidade, movimento, boas práticas,
// CSS, head, cinzas, ícones e contraste (parte de design-rules.mjs).
import { flutterFileRules } from './design-flutter.mjs'
import { nativeFileRules } from './design-native.mjs'
import { locale, t } from './i18n.mjs'
import { lineAt, tags, classList, base, prefixed, cssBlocks, ignoreSet, parseColor, luminance, contrast } from './design-project.mjs'

// ---------- regras por elemento (tag) dos arquivos de tela ----------

// Conteúdo escondido até o mouse passar por cima (group-hover).
function hidesUntilHover(cls, bases, has) {
  return (
    (bases.includes('opacity-0') && has(/(^|:)group-hover:opacity-(100|[5-9]0)$/)) ||
    (bases.includes('invisible') && has(/group-hover:visible$/)) ||
    (cls.includes('hidden') && has(/^group-hover:(block|flex|inline-flex|grid)$/))
  )
}

function responsiveTagRules({ t, cls, bases, has, add }) {
  const grid = cls.find((x) => !prefixed(x) && /^grid-cols-([3-9]|1[0-2])$/.test(x))
  if (grid && !has(/^(sm|md|lg|xl|2xl|@[\w-]+|max-\w+):grid-cols-/))
    add('responsivo/grid-sem-celular', t.start, { token: grid, cols: grid.split('-').pop() })
  const fixed = cls.find((x) => !prefixed(x) && /^(min-)?w-\[(\d+)px\]$/.test(x) && Number(x.match(/\d+/)[0]) > 360)
  if (fixed && !has(/^max-w-/)) add('responsivo/largura-fixa', t.start, { token: fixed })
  const styleWidth = t.attrs.match(/\b(?:min)?[wW]idth\s*:\s*['"]?(\d{3,})(px)?['"]?/)
  if (styleWidth && Number(styleWidth[1]) > 360 && /style\s*=/.test(t.attrs)) add('responsivo/largura-fixa', t.start, { token: `width: ${styleWidth[1]}` })
  const vh = cls.find((x) => /^(min-)?h-screen$/.test(base(x)) || /100vh/.test(x))
  if (vh) add('responsivo/altura-100vh', t.start, { token: vh })
  const vw = cls.find((x) => base(x) === 'w-screen' || /100vw/.test(x))
  if (vw) add('responsivo/largura-100vw', t.start, { token: vw })
  if (/^(input|textarea|select)$/.test(t.name)) {
    const small = cls.find((x) => !prefixed(x) && /^text-(xs|sm|\[(\d|1[0-5])px\])$/.test(x))
    if (small && !has(/^(sm|md|lg|xl):text-/)) add('responsivo/campo-com-fonte-pequena', t.start, { token: small })
  }
  if (hidesUntilHover(cls, bases, has) && !has(/(focus-within|focus-visible|group-focus|peer-focus|focus):/))
    add('responsivo/so-no-hover', t.start, { token: cls.find((x) => x.startsWith('group-hover:')) })
}

// Botão só com ícone (svg ou componente), sem texto, aria-label nem title.
function isIconOnlyButton(t, text) {
  if (!/^(button|Button|IconButton)$/.test(t.name) || t.selfClosing || /aria-label(ledby)?\s*=|\btitle\s*=/.test(t.attrs)) return false
  const close = text.indexOf(`</${t.name}>`, t.end)
  if (close <= 0 || close - t.end >= 1500) return false
  const inner = text.slice(t.end, close)
  const bare = inner.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/<[^>]*>/g, '').trim()
  // Ícone: componente (<Icon />), <svg>, ou o ícone do Angular Material e do Ionic, cujo texto é o nome do ícone.
  const iconText = /^<(mat-icon|ion-icon)\b/.test(inner.trim()) && !/<\/(mat-icon|ion-icon)>\s*\S/.test(inner)
  return (!bare || iconText) && /<([A-Z][\w.]*|svg|mat-icon|ion-icon)\b/.test(inner) && !/sr-only|aria-label/.test(inner)
}

// Clique no jeito de cada framework: onClick (React), (click) (Angular), @click/v-on:click (Vue), on:click/onclick (Svelte e HTML).
const CLICK = /(^|\s)(onClick|onclick|on:click)\s*=|\(click\)\s*=|@click\b|v-on:click\b/
// E o teclado, também em cada jeito.
const KEYS = /\brole\s*=|onKey(Down|Up|Press)\s*=|\(key(down|up)[\w.]*\)\s*=|@key(down|up)|on:key(down|up)|onkey(down|up)\s*=/i

function a11yTagRules({ t, text, cls, has, add }) {
  const outline = cls.find((x) => /^(outline-none|outline-0|outline-hidden)$/.test(base(x)) && !/^(focus-visible|focus-within):/.test(x))
  if (outline && !has(/^(focus|focus-visible|focus-within|group-focus|peer-focus|has-\[:focus-visible\]):(?!outline-(none|0|hidden)$)/))
    add('acessibilidade/foco-removido', t.start, {})
  if (isIconOnlyButton(t, text)) add('acessibilidade/botao-sem-nome', t.start, {})
  if ((t.name === 'img' || (t.name === 'Image' && /\bsrc\s*=/.test(t.attrs))) && !/\balt\s*=/.test(t.attrs))
    add('acessibilidade/imagem-sem-alt', t.start, {})
  if (/\bonPaste\s*=/.test(t.attrs) && /preventDefault/.test(t.attrs)) add('acessibilidade/colar-bloqueado', t.start, {})
  if (/^(div|span|li|td|tr|p|section|article|img)$/.test(t.name) && CLICK.test(t.attrs) && !KEYS.test(t.attrs))
    add('acessibilidade/elemento-clicavel-sem-teclado', t.start, { tag: t.name })
  if (/\btabIndex\s*=\s*\{?\s*["']?[1-9]/.test(t.attrs)) add('acessibilidade/tabindex-positivo', t.start, {})
}

// Duração máxima de animação pelo tipo de arquivo: modal e gaveta até 500 ms, toast até 400 ms, o resto 300 ms.
function durationLimit(rel) {
  if (/modal|dialog|drawer|sheet/i.test(rel)) return 500
  if (/toast|sonner|notif/i.test(rel)) return 400
  return 300
}

function motionTagRules({ t, cls, bases, add, accordionish, maxDuration }) {
  if (bases.includes('transition-all')) add('movimento/transition-all', t.start, {})
  if (bases.includes('ease-in')) add('movimento/ease-in', t.start, {})
  if (bases.includes('scale-0')) add('movimento/entra-do-zero', t.start, {})
  const layoutAnim = cls.find((x) => /^transition-\[[^\]]*(width|height|top|left|right|bottom|margin|padding)/.test(base(x)))
  if (layoutAnim && !accordionish) add('movimento/anima-tamanho-ou-posicao', t.start, { token: layoutAnim })
  const dur = bases.find((x) => {
    const ms = x.match(/^duration-(\d+)$/)?.[1] ?? x.match(/^duration-\[(\d+)ms\]$/)?.[1]
    return ms && Number(ms) > maxDuration
  })
  if (dur) add('movimento/duracao-longa', t.start, { token: dur })
  if (bases.includes('animate-bounce')) add('movimento/quique', t.start, { token: 'animate-bounce' })
}

// Prática (controle morto) e consistência (z-index, texto miúdo, texto em degradê).
function practiceTagRules({ t, cls, bases, add, designText }) {
  const dead = t.attrs.match(/\bhref\s*=\s*["'](#?)["']/) ?? t.attrs.match(/\bonClick\s*=\s*\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/)
  if (dead) add('pratica/controle-morto', t.start, { token: dead[0].replace(/\s+/g, ' ') })
  const z = cls.find((x) => /^z-\[\d{3,}\]$/.test(base(x)))
  if (z) add('design/z-index-alto', t.start, { token: z })
  const tiny = cls.find((x) => /^text-\[(\d|1[01])(\.\d+)?px\]$/.test(base(x)))
  if (tiny && !designText.includes(base(tiny))) add('design/texto-miudo', t.start, { token: tiny })
  if (bases.includes('bg-clip-text') && bases.includes('text-transparent')) add('design/texto-em-degrade', t.start, {})
}

// Linhas de texto (fora das tags).
function textLineRules(l, line, add) {
  const at = { line }
  if (/^\s*(\/\/|\*|\/\*)/.test(l)) return
  if (/(?<![.\w])(window\.)?(alert|confirm)\(\s*['"`]/.test(l)) add('conteudo/alerta-do-navegador', at, {})
  const filler = l.match(/lorem ipsum|john doe|jane doe|fulano de tal|acme (inc|corp)|\(\d{2}\) 9?9999-9999|123\.456\.789-00|foo@bar|test@test\.com/i)
  if (filler && !/placeholder\s*=|example|exemplo|e\.g\./i.test(l)) add('conteudo/dado-de-enchimento', at, { token: filler[0] })
  if (/(>|["'`])[^<>"'`{}]*\p{L}\.\.\.\s*(<|["'`])/u.test(l) && !/\{\s*\.\.\./.test(l.match(/\p{L}\.\.\./u)?.[0] ?? '')) add('conteudo/reticencias', at, {})
  if (/>\s*(clique aqui|click here)\s*</i.test(l)) add('conteudo/clique-aqui', at, {})
  const emoji = l.match(/(?:>|["'`])[^<>{}"'`]*?(\p{Extended_Pictographic})/u)
  if (emoji && !/[©®™]/.test(emoji[1]) && !/\bconsole\./.test(l)) add('design/emoji-como-icone', at, { token: emoji[1] })
}

// Um arquivo de tela: cada elemento e depois cada linha de texto.
export function uiFileRules({ rel, text }, c, designText, stats) {
  const ign = ignoreSet(text)
  const add = (rule, index, ctx) => {
    const line = typeof index === 'number' ? lineAt(text, index) : index.line
    if (ign.ignored(rule, line)) return stats.ignored++
    c.add(rule, rel, line, ctx)
  }
  const accordionish = /accordion|collaps/i.test(rel)
  const maxDuration = durationLimit(rel)
  for (const t of tags(text)) {
    const cls = classList(t.attrs)
    const tag = { t, text, cls, bases: cls.map(base), has: (re) => cls.some((x) => re.test(x)), add, accordionish, maxDuration, designText }
    responsiveTagRules(tag)
    a11yTagRules(tag)
    motionTagRules(tag)
    practiceTagRules(tag)
  }
  text.split('\n').forEach((l, i) => textLineRules(l, i + 1, add))
}

// Um arquivo de tela do Flutter: as regras de design-flutter.mjs e as de texto (dado de enchimento, emoji).
export function nativeRules({ rel, text }, c, stats) {
  const ign = ignoreSet(text)
  nativeFileRules({ rel, text }, tags(text), (rule, line, ctx) => (ign.ignored(rule, line) ? stats.ignored++ : c.add(rule, rel, line, ctx)))
}

export function dartFileRules({ rel, text }, c, stats) {
  const ign = ignoreSet(text)
  const add = (rule, line, ctx) => (ign.ignored(rule, line) ? stats.ignored++ : c.add(rule, rel, line, ctx))
  flutterFileRules({ rel, text }, add)
  text.split('\n').forEach((l, i) => textLineRules(l, i + 1, (rule, at, ctx) => add(rule, at.line, ctx)))
}

// ---------- regras de CSS ----------

// Classes do Tailwind aplicadas com @apply num bloco CSS.
function cssAppliedRules(applied, sel, line, add) {
  const outline = applied.find((x) => /^(outline-none|outline-0)$/.test(base(x)) && !prefixed(x))
  if (outline && !applied.some((x) => /^(focus|focus-visible|focus-within):(?!outline-(none|0)$)/.test(x))) add('acessibilidade/foco-removido', line, {})
  if (!/input|textarea|select|field/i.test(sel)) return
  const small = applied.find((x) => !prefixed(x) && /^text-(xs|sm|\[(\d|1[0-5])px\])$/.test(x))
  if (small && !applied.some((x) => /^(sm|md|lg|xl):text-/.test(x))) add('responsivo/campo-com-fonte-pequena', line, { token: `${small} ${t('in', 'em')} ${sel.split(/\s+/).pop()}` })
}

function cssBlockRules(b, add) {
  const body = b.body
  const applied = (body.match(/@apply\s+([^;]+);/g) ?? []).flatMap((a) => a.replace(/@apply\s+|;/g, '').trim().split(/\s+/))
  const sel = b.selector
  if (/transition(-property)?\s*:\s*all\b/.test(body) || applied.map(base).includes('transition-all')) add('movimento/transition-all', b.line, {})
  if (/(transition|animation)[^;]*\bease-in\b(?!-out)/.test(body) || applied.map(base).includes('ease-in')) add('movimento/ease-in', b.line, {})
  if (/scale\(\s*0\s*\)/.test(body)) add('movimento/entra-do-zero', b.line, {})
  const lay = body.match(/transition(-property)?\s*:[^;]*\b(width|height|top|left|margin|padding)\b/)
  if (lay && !/accordion|collaps/i.test(sel)) add('movimento/anima-tamanho-ou-posicao', b.line, { token: lay[2] })
  const vh = body.match(/[\w-]+\s*:[^;]*\b100vh\b/)
  if (vh || applied.some((x) => /^(min-)?h-screen$/.test(base(x)))) add('responsivo/altura-100vh', b.line, { token: vh?.[0] ?? 'h-screen' })
  if (/outline\s*:\s*(none|0)\b/.test(body) && /:focus(?!-visible|-within)/.test(sel) && !/box-shadow|border(-color)?\s*:/.test(body))
    add('acessibilidade/foco-removido', b.line, {})
  if (applied.length) cssAppliedRules(applied, sel, b.line, add)
  else if (/(^|[\s,])(input|textarea|select)\b/.test(sel)) {
    const fs = body.match(/font-size\s*:\s*(\d+(\.\d+)?)px/)
    if (fs && Number(fs[1]) < 16) add('responsivo/campo-com-fonte-pequena', b.line, { token: `font-size: ${fs[1]}px` })
  }
}

export function cssFileRules({ rel, text }, c, stats) {
  const ign = ignoreSet(text)
  const add = (rule, line, ctx) => (ign.ignored(rule, line) ? stats.ignored++ : c.add(rule, rel, line, ctx))
  for (const b of cssBlocks(text)) cssBlockRules(b, add)
}

// ---------- regras do <head> (identidade e viewport) ----------

export function headIdentityRules(p, c, themes, headText, headFile) {
  const anyFile = (re) => p.all.some((f) => re.test(f))
  if (!/rel\s*[:=]\s*['"](shortcut )?icon['"]|\bicons?\s*:\s*[{['"]/.test(headText) && !anyFile(/^(public|static)\/favicon\.|^(src\/)?app\/(icon|favicon)\.|^favicon\./))
    c.add('identidade/sem-favicon', headFile, null, {})
  if (!/apple-touch-icon|rel\s*[:=]\s*['"]apple|\bapple\s*:/.test(headText) && !anyFile(/apple-touch-icon|^(src\/)?app\/apple-icon\./))
    c.add('identidade/sem-apple-touch-icon', headFile, null, {})
  const title = headText.match(/<title>([^<]*)<\/title>/)?.[1] ?? headText.match(/\btitle\s*:\s*['"`]([^'"`]*)['"`]/)?.[1]
  if (title === undefined || /^\s*$|^(vite \+ \w+|vite app|react app|create next app|vue app|sveltekit app|my app|untitled|document)$/i.test(title.trim()))
    c.add('identidade/titulo-padrao', headFile, null, { title })
  if (!/name\s*[:=]\s*['"]description['"]|\bdescription\s*:\s*['"`]/.test(headText)) c.add('identidade/sem-descricao', headFile, null, {})
  if (!/og:image|openGraph\s*:/.test(headText) && !anyFile(/opengraph-image\./)) c.add('identidade/sem-imagem-de-compartilhamento', headFile, null, {})
  if (/<html\b/.test(headText) && !/<html\b[^>]*\blang\s*=/.test(headText)) c.add('identidade/sem-idioma', headFile, null, {})
  if (!/theme-color|themeColor/.test(headText)) c.add('identidade/sem-theme-color', headFile, null, {})
  else if (themes.both && !/prefers-color-scheme/.test(headText) && !/theme-?color/i.test((p.themeCode ?? []).map((f) => f.text).join('\n')))
    c.add('identidade/theme-color-unico', headFile, null, {})
}

export function headViewportRules(p, c, headText, headFile, code) {
  const viewport = headText.match(/name\s*[:=]\s*['"]viewport['"][^>}]*?content\s*[:=]\s*['"]([^'"]*)['"]/)?.[1] ?? headText.match(/export const viewport[\s\S]{0,300}/)?.[0]
  if (!viewport && !p.deps?.next && !p.deps?.nuxt && !/name\s*[:=]\s*['"]viewport/.test(headText)) c.add('responsivo/sem-viewport', headFile, null, {})
  if (viewport && /user-scalable\s*[=:]\s*['"]?(no|0|false)|maximum-scale\s*[=:]\s*['"]?1(\.0)?\b/.test(viewport)) c.add('responsivo/zoom-desligado', headFile, null, {})
  if (/env\(\s*safe-area-inset/.test(code) && !/viewport-fit\s*=\s*cover/.test(headText)) c.add('responsivo/safe-area-sem-viewport-fit', headFile, null, {})
}

// ---------- regras do projeto inteiro ----------

export function projectWideRules(p, c, themes, code) {
  const animated = /@keyframes|\banimate-(?!none)[\w-]+|framer-motion|from ['"]motion|transition-(transform|all|opacity)/.test(code)
  if (animated && !/prefers-reduced-motion|motion-reduce:|motion-safe:|useReducedMotion|reducedMotion/.test(code))
    c.add('acessibilidade/sem-reduced-motion', null, null, {})
  if (themes.both && !themes.followsSystem) c.add('design/tema-nao-segue-sistema', p.themeCode?.[0]?.rel ?? null, null, {})
  const toasters = (code.match(/<Toaster\b/g) ?? []).length
  if (toasters > 1) c.add('movimento/toaster-duplicado', p.ui.find((f) => /<Toaster\b/.test(f.text))?.rel ?? null, null, { count: toasters })
}

// Cinzas de famílias diferentes do Tailwind misturados.
export function grayRules(c, code, designText) {
  const grays = {}
  for (const m of code.matchAll(/\b(?:text|bg|border|ring|fill|stroke|divide|outline|from|to|via|placeholder|shadow|decoration)-(slate|gray|zinc|neutral|stone)-\d{2,3}\b/g)) grays[m[1]] = (grays[m[1]] ?? 0) + 1
  const families = Object.entries(grays).sort((a, b) => b[1] - a[1])
  if (families.length <= 1) return
  const declared = families.find(([f]) => new RegExp(`\\b${f}-\\d`).test(designText))?.[0]
  const main = declared ?? families[0][0]
  const others = families.filter(([f]) => f !== main)
  if (others.reduce((s, [, n]) => s + n, 0) >= 2)
    c.add('design/cinzas-misturados', null, null, {
      families: families.map(([f, n]) => `${f} ${n}×`).join(', '),
      main,
      others: others.map(([f]) => f).join(', '),
    })
}

const ICON_LIBS = ['lucide-react', '@heroicons/react', 'react-icons', '@phosphor-icons/react', '@tabler/icons-react', '@radix-ui/react-icons', '@mui/icons-material', 'react-feather']

export function iconLibRules(c, code) {
  const libs = ICON_LIBS.filter((l) => new RegExp(`from ['"]${l.replace(/[/@-]/g, '\\$&')}`).test(code))
  if (libs.length > 1) c.add('design/icones-misturados', null, null, { libs: libs.join(', ') })
}

const decimal = (n) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Contraste entre as cores do design.md (texto × fundo) e tema escuro sem color-scheme.
export function contrastRules(c, { designMdPath, tokens, code, headText }) {
  if (!designMdPath || !tokens?.colors?.length) return
  const colors = tokens.colors.map((t) => ({ ...t, rgb: parseColor(t.value) })).filter((t) => t.rgb)
  const isBg = (t) => /fundo|background|superf[ií]cie/i.test(t.usage ?? '')
  const isText = (t) => !isBg(t) && /texto|t[íi]tulo|r[óo]tulo|[íi]cone|label|text/i.test(t.usage ?? '')
  const bgs = colors.filter(isBg)
  for (const t of colors.filter(isText)) {
    const fails = bgs
      .map((b) => ({ b, ratio: contrast(t.rgb, b.rgb) }))
      .filter((x) => x.ratio < 4.5)
      .sort((a, b) => a.ratio - b.ratio)
    if (!fails.length) continue
    const worst = fails[0]
    c.add('acessibilidade/contraste-baixo', designMdPath, null, {
      text: t.name,
      textValue: t.value,
      bg: worst.b.name,
      bgValue: worst.b.value,
      ratio: decimal(worst.ratio),
      others: fails.slice(1).map((x) => `${x.b.name} (${decimal(x.ratio)}:1)`).join(', '),
      high: worst.ratio < 3,
    }, t.name)
  }
  const mainBg = bgs[0]
  if (mainBg && luminance(mainBg.rgb) < 0.2 && !/color-scheme|scheme-dark|colorScheme/.test(code + headText))
    c.add('acessibilidade/sem-color-scheme', null, null, {})
}
