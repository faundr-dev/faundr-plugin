// Regras de design sem IA (fase 2): identidade do app, responsivo, acessibilidade, contraste, movimento,
// conteúdo e consistência. Destiladas de anti-slop, impeccable, taste-skill, skills do Emil Kowalski e
// web-interface-guidelines da Vercel (docs/research/design-proposta.md). Só entra regra com padrão exato e
// pouca exceção; o resto fica para a auditoria com IA.
//
// Cada achado é um por arquivo por regra (com as linhas no detalhe) ou um por projeto. Exceção no código:
// comentário `faundr-ignore <regra>: motivo` na linha ou na anterior; `faundr-ignore-file <regra>` vale para o arquivo.

import fs from 'node:fs'
import path from 'node:path'
import { FLUTTER_RULES, FLUTTER_TEXT, flutterFileRules } from './design-flutter.mjs'
import { isNativeProject, NATIVE_RULES, NATIVE_TEXT, nativeFileRules } from './design-native.mjs'
import { locale, t } from './i18n.mjs'
import { allDeps, isClaudePlugin } from './parts.mjs'

const SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|coverage|\.claude|\.remember|\.wrangler|\.next|\.nuxt|\.svelte-kit|\.tanstack|\.vercel|\.output)(\/|$)/
const NOT_APP = /(^|\/)(__tests__|__mocks__|fixtures?|mocks?|stories|test|tests|e2e)(\/|$)|\.(test|spec|stories)\.|\.gen\./

// Identificação, tipo e gravidade de cada regra. A explicação vai no detalhe do achado.
export const RULES = {
  'identidade/sem-favicon': { kind: 'identity', severity: 'medium' },
  'identidade/sem-apple-touch-icon': { kind: 'identity', severity: 'low' },
  'identidade/titulo-padrao': { kind: 'identity', severity: 'medium' },
  'identidade/sem-descricao': { kind: 'identity', severity: 'low' },
  'identidade/sem-imagem-de-compartilhamento': { kind: 'identity', severity: 'low' },
  'identidade/sem-idioma': { kind: 'identity', severity: 'medium' },
  'identidade/sem-theme-color': { kind: 'identity', severity: 'low' },
  'identidade/theme-color-unico': { kind: 'identity', severity: 'low' },
  'responsivo/sem-viewport': { kind: 'responsive', severity: 'high' },
  'responsivo/zoom-desligado': { kind: 'responsive', severity: 'high' },
  'responsivo/grid-sem-celular': { kind: 'responsive', severity: 'medium' },
  'responsivo/largura-fixa': { kind: 'responsive', severity: 'medium' },
  'responsivo/altura-100vh': { kind: 'responsive', severity: 'medium' },
  'responsivo/largura-100vw': { kind: 'responsive', severity: 'low' },
  'responsivo/campo-com-fonte-pequena': { kind: 'responsive', severity: 'medium' },
  'responsivo/so-no-hover': { kind: 'responsive', severity: 'medium' },
  'responsivo/safe-area-sem-viewport-fit': { kind: 'responsive', severity: 'medium' },
  'acessibilidade/foco-removido': { kind: 'a11y', severity: 'high' },
  'acessibilidade/botao-sem-nome': { kind: 'a11y', severity: 'high' },
  'acessibilidade/imagem-sem-alt': { kind: 'a11y', severity: 'high' },
  'acessibilidade/colar-bloqueado': { kind: 'a11y', severity: 'high' },
  'acessibilidade/elemento-clicavel-sem-teclado': { kind: 'a11y', severity: 'medium' },
  'acessibilidade/tabindex-positivo': { kind: 'a11y', severity: 'medium' },
  'acessibilidade/contraste-baixo': { kind: 'a11y', severity: 'high' },
  'acessibilidade/sem-reduced-motion': { kind: 'a11y', severity: 'medium' },
  'acessibilidade/sem-color-scheme': { kind: 'a11y', severity: 'low' },
  'movimento/transition-all': { kind: 'motion', severity: 'medium' },
  'movimento/ease-in': { kind: 'motion', severity: 'medium' },
  'movimento/entra-do-zero': { kind: 'motion', severity: 'medium' },
  'movimento/anima-tamanho-ou-posicao': { kind: 'motion', severity: 'medium' },
  'movimento/duracao-longa': { kind: 'motion', severity: 'low' },
  'movimento/quique': { kind: 'motion', severity: 'low' },
  'movimento/toaster-duplicado': { kind: 'motion', severity: 'medium' },
  'conteudo/dado-de-enchimento': { kind: 'content', severity: 'medium' },
  'conteudo/reticencias': { kind: 'content', severity: 'low' },
  'conteudo/alerta-do-navegador': { kind: 'content', severity: 'medium' },
  'conteudo/clique-aqui': { kind: 'content', severity: 'low' },
  'pratica/controle-morto': { kind: 'practice', severity: 'high' },
  'design/cinzas-misturados': { kind: 'off_spec', severity: 'medium' },
  'design/icones-misturados': { kind: 'off_spec', severity: 'low' },
  'design/z-index-alto': { kind: 'off_spec', severity: 'low' },
  'design/texto-miudo': { kind: 'off_spec', severity: 'low' },
  'design/texto-em-degrade': { kind: 'off_spec', severity: 'low' },
  'design/emoji-como-icone': { kind: 'off_spec', severity: 'low' },
  'design/tema-nao-segue-sistema': { kind: 'off_spec', severity: 'low' },
}

// Telas Flutter: regras e textos em design-flutter.mjs.
Object.assign(RULES, FLUTTER_RULES, NATIVE_RULES)

// ---------- leitura do projeto ----------

function walk(root) {
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
      if (SKIP.test(rel) || (e.isDirectory() && isClaudePlugin(abs))) continue
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

function loadProject(root, uiExt) {
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

const lineAt = (text, index) => text.slice(0, index).split('\n').length

/** Cada tag de abertura: nome, atributos (até o ">" no nível zero de chaves/aspas), posição, fim. */
function tags(text) {
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
function classList(attrs) {
  const m = attrs.match(/\b(?:className|class)\s*=\s*([\s\S]*)/)
  if (!m) return []
  return (m[1].match(/[!\w:@.\/#%&-]*\[[^\]\s]*\][\w\/-]*|[!\w:@.\/#%&-]+/g) ?? []).filter((t) => t.length < 80)
}
const base = (t) => t.slice(t.lastIndexOf(':') + 1).replace(/^!/, '')
const prefixed = (t) => t.includes(':')

/** Blocos CSS: seletor, corpo, linha (só o nível de regra; @media entra como seletor composto). */
function cssBlocks(text) {
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

function parseColor(value) {
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
const luminance = (rgb) =>
  rgb
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0)
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// ---------- coleta de achados ----------

function makeCollector() {
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

// Título e explicação de cada achado (n = quantas vezes no arquivo), na língua da pessoa (t na hora do achado).
const TEXT = {
  'identidade/sem-favicon': () => [
    t('App without a favicon (the browser tab icon)', 'App sem favicon (ícone da aba do navegador)'),
    t('The browser tab and bookmarks show a generic icon. Make the favicon from the logo (SVG + 32 px PNG) and declare it in the <head> with <link rel="icon">.', 'A aba do navegador e os favoritos mostram um ícone genérico. Gere o favicon a partir da logo (SVG + PNG 32 px) e declare no <head> com <link rel="icon">.'),
  ],
  'identidade/sem-apple-touch-icon': () => [
    t('No icon for the iPhone home screen (apple-touch-icon)', 'Sem ícone para a tela inicial do iPhone (apple-touch-icon)'),
    t('Whoever saves the app to the iPhone home screen sees a blurry screenshot. Add a 180×180 PNG and <link rel="apple-touch-icon">.', 'Quem salva o app na tela inicial do iPhone vê um print borrado. Adicione um PNG 180×180 e <link rel="apple-touch-icon">.'),
  ],
  'identidade/titulo-padrao': (c) => [
    t(`Default or empty page title${c.title ? ` ("${c.title}")` : ''}`, `Título da página padrão ou vazio${c.title ? ` ("${c.title}")` : ''}`),
    t('The title shows on the tab, in bookmarks and in search. Replace the template title with the app name (ideally, one title per screen).', 'O título aparece na aba, nos favoritos e na busca. Troque o título do template pelo nome do app (e, de preferência, um título por tela).'),
  ],
  'identidade/sem-descricao': () => [
    t('No page description (meta description)', 'Sem descrição da página (meta description)'),
    t('It is the text shown on Google and in shared links. Add <meta name="description" content="…"> with one sentence about the app.', 'É o texto que aparece no Google e em links compartilhados. Adicione <meta name="description" content="…"> com uma frase sobre o app.'),
  ],
  'identidade/sem-imagem-de-compartilhamento': () => [
    t('No share image (og:image)', 'Sem imagem de compartilhamento (og:image)'),
    t('When the link is pasted in WhatsApp, Slack or social media, it shows no image. Add <meta property="og:image"> (1200×630).', 'Ao colar o link no WhatsApp, Slack ou redes, aparece sem imagem. Adicione <meta property="og:image"> (1200×630).'),
  ],
  'identidade/sem-idioma': () => [
    t('Page without a declared language (<html lang>)', 'Página sem idioma declarado (<html lang>)'),
    t('Without lang, screen readers use the wrong pronunciation and the browser offers translation for no reason. Use <html lang="en"> (or the app language).', 'Sem lang, o leitor de tela lê com a pronúncia errada e o navegador oferece tradução à toa. Use <html lang="pt-BR"> (ou o idioma do app).'),
  ],
  'identidade/sem-theme-color': () => [
    t('No browser bar color (theme-color)', 'Sem cor da barra do navegador (theme-color)'),
    t('On phones, the browser bar keeps the default color instead of the app color. Add <meta name="theme-color"> with the background color from design.md.', 'No celular, a barra do navegador fica com a cor padrão em vez da cor do app. Adicione <meta name="theme-color"> com a cor de fundo do design.md.'),
  ],
  'responsivo/sem-viewport': () => [
    t('No <meta name="viewport">: on phones the page opens tiny', 'Sem <meta name="viewport">: no celular a página abre minúscula'),
    t('Without the viewport meta, the phone draws the page as if it were a computer and shrinks everything. Add <meta name="viewport" content="width=device-width, initial-scale=1">.', 'Sem a meta viewport, o celular desenha a página como se fosse um computador e encolhe tudo. Adicione <meta name="viewport" content="width=device-width, initial-scale=1">.'),
  ],
  'responsivo/zoom-desligado': () => [
    t('Phone zoom turned off (user-scalable=no / maximum-scale=1)', 'Zoom do celular desligado (user-scalable=no / maximum-scale=1)'),
    t('People with poor eyesight cannot zoom in. Remove user-scalable=no and maximum-scale from the viewport meta.', 'Quem enxerga mal não consegue aproximar a tela. Tire user-scalable=no e maximum-scale da meta viewport.'),
  ],
  'responsivo/grid-sem-celular': (c, n) => [
    t(`Multi-column grid with no phone version${n > 1 ? ` (${n} places)` : ''}`, `Grade de várias colunas sem versão de celular${n > 1 ? ` (${n} lugares)` : ''}`),
    t(`Classes like "${c.token}" without a screen prefix (sm:, md:, lg:) squeeze the columns on phones. Start with grid-cols-1 and add columns on bigger screens (e.g. grid-cols-1 md:grid-cols-${c.cols}).`, `Classes como "${c.token}" sem um prefixo de tela (sm:, md:, lg:) deixam as colunas espremidas no celular. Comece com grid-cols-1 e aumente nas telas maiores (ex.: grid-cols-1 md:grid-cols-${c.cols}).`),
  ],
  'responsivo/largura-fixa': (c, n) => [
    t(`Large fixed width (${c.token})${n > 1 ? ` in ${n} places` : ''}`, `Largura fixa grande (${c.token})${n > 1 ? ` em ${n} lugares` : ''}`),
    t('An element with a fixed width bigger than a phone screen (~360 px) causes sideways scrolling. Use max-w-[…] with w-full, or set the width only from md: up.', 'Um elemento com largura fixa maior que a tela do celular (~360 px) cria rolagem para o lado. Use max-w-[…] com w-full, ou largura só a partir de md:.'),
  ],
  'responsivo/altura-100vh': (c, n) => [
    t(`Full-screen height with 100vh (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Altura de tela cheia com 100vh (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('On phones, 100vh does not account for the browser bar and the bottom of the screen gets hidden. Use dvh (h-dvh, min-h-dvh, calc(100dvh - …)).', 'No celular, 100vh não desconta a barra do navegador e o fim da tela fica escondido. Use dvh (h-dvh, min-h-dvh, calc(100dvh - …)).'),
  ],
  'responsivo/largura-100vw': (c, n) => [
    t(`100vw width (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Largura de 100vw (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('100vw includes the scrollbar and often causes sideways scrolling. Use w-full.', '100vw inclui a barra de rolagem e costuma criar rolagem para o lado. Use w-full.'),
  ],
  'responsivo/campo-com-fonte-pequena': (c, n) => [
    t(`Text field with a font smaller than 16 px (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Campo de texto com fonte menor que 16 px (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('On iPhone, tapping a field with a font smaller than 16 px makes the page zoom in by itself. Use text-base on phones and go smaller only from md: up (e.g. text-base md:text-sm).', 'No iPhone, ao tocar num campo com fonte menor que 16 px, a página dá zoom sozinha. Use text-base no celular e diminua só a partir de md: (ex.: text-base md:text-sm).'),
  ],
  'responsivo/so-no-hover': (c, n) => [
    t(`Content that only shows on mouse hover${n > 1 ? ` (${n} places)` : ''}`, `Conteúdo que só aparece ao passar o mouse${n > 1 ? ` (${n} lugares)` : ''}`),
    t(`"${c.token}" hides the element until the mouse hovers over it, but phones have no hover and keyboard users never see it. Also show it with group-focus-within: / focus-visible: (or keep it visible on phones).`, `"${c.token}" esconde o elemento até o mouse passar por cima, mas no celular não existe hover e pelo teclado ele nunca aparece. Mostre também com group-focus-within: / focus-visible: (ou deixe visível no celular).`),
  ],
  'responsivo/safe-area-sem-viewport-fit': () => [
    t('Uses env(safe-area-inset-*) but the viewport has no viewport-fit=cover', 'Usa env(safe-area-inset-*) mas a viewport não tem viewport-fit=cover'),
    t('Without viewport-fit=cover, the iPhone safe areas (notch, bottom bar) are zero and the adjustment does nothing. Add viewport-fit=cover to the viewport meta.', 'Sem viewport-fit=cover, as áreas seguras do iPhone (entalhe, barra de baixo) valem zero e o ajuste não funciona. Acrescente viewport-fit=cover à meta viewport.'),
  ],
  'acessibilidade/foco-removido': (c, n) => [
    t(`Focus outline removed with no replacement${n > 1 ? ` (${n} places)` : ''}`, `Contorno de foco removido sem substituto${n > 1 ? ` (${n} lugares)` : ''}`),
    t('Keyboard users cannot see where they are. When you remove the outline, give another focus sign (e.g. focus-visible:ring-2 or focus-visible:border-…).', 'Quem navega pelo teclado não vê onde está. Ao tirar o outline, dê outro sinal de foco (ex.: focus-visible:ring-2 ou focus-visible:border-…).'),
  ],
  'acessibilidade/botao-sem-nome': (c, n) => [
    t(`Icon-only button with no name for screen readers${n > 1 ? ` (${n} buttons)` : ''}`, `Botão só com ícone, sem nome para leitor de tela${n > 1 ? ` (${n} botões)` : ''}`),
    t('The screen reader just says "button". Add aria-label="…" (or sr-only text) saying what the button does.', 'O leitor de tela anuncia só "botão". Adicione aria-label="…" (ou um texto sr-only) dizendo o que o botão faz.'),
  ],
  'acessibilidade/imagem-sem-alt': (c, n) => [
    t(`Image without alternative text (alt)${n > 1 ? ` (${n} images)` : ''}`, `Imagem sem texto alternativo (alt)${n > 1 ? ` (${n} imagens)` : ''}`),
    t('Without alt, the screen reader reads the file name. Describe the image in alt="…" (or alt="" if it is just decoration).', 'Sem alt, o leitor de tela lê o nome do arquivo. Descreva a imagem em alt="…" (ou alt="" se for só decoração).'),
  ],
  'acessibilidade/colar-bloqueado': () => [
    t('Field that blocks pasting', 'Campo que bloqueia colar'),
    t('Blocking paste gets in the way of password managers and people who have trouble typing. Remove the preventDefault from onPaste.', 'Bloquear o colar atrapalha gerenciadores de senha e quem tem dificuldade de digitar. Tire o preventDefault do onPaste.'),
  ],
  'acessibilidade/elemento-clicavel-sem-teclado': (c, n) => [
    t(`Clickable element that is neither a button nor a link (<${c.tag} onClick>)${n > 1 ? `, ${n} places` : ''}`, `Elemento clicável que não é botão nem link (<${c.tag} onClick>)${n > 1 ? `, ${n} lugares` : ''}`),
    t('It cannot be reached with the keyboard, and the screen reader does not know it is clickable. Use <button> (action) or <a>/<Link> (navigation).', 'Não dá para chegar nele pelo teclado nem o leitor de tela sabe que é clicável. Use <button> (ação) ou <a>/<Link> (navegação).'),
  ],
  'acessibilidade/tabindex-positivo': () => [
    t('Positive tabIndex changes the keyboard order', 'tabIndex positivo muda a ordem do teclado'),
    t('A tabIndex above 0 makes Tab jump to this element before everything else. Use 0 (or nothing) and let the HTML order decide.', 'tabIndex maior que 0 faz o Tab pular para esse elemento antes de todo o resto. Use 0 (ou nada) e deixe a ordem do HTML mandar.'),
  ],
  'acessibilidade/contraste-baixo': (c) => [
    t(`Low contrast: ${c.text} on ${c.bg} (${c.ratio}:1)`, `Contraste baixo: ${c.text} sobre ${c.bg} (${c.ratio}:1)`),
    t(
      `Under the accessibility guideline (WCAG AA), text needs at least 4.5:1 (3:1 only for large text, icons and borders). ${c.text} (${c.textValue}) on ${c.bg} (${c.bgValue}) gives ${c.ratio}:1${c.others ? `; it also fails on ${c.others}` : ''}. Lighten the text, darken the background, or use this color only where 3:1 is enough.`,
      `Pela regra de acessibilidade (WCAG AA), texto precisa de pelo menos 4,5:1 (3:1 só para texto grande, ícones e bordas). ${c.text} (${c.textValue}) sobre ${c.bg} (${c.bgValue}) dá ${c.ratio}:1${c.others ? `; também falha sobre ${c.others}` : ''}. Clareie o texto, escureça o fundo ou use esta cor só onde 3:1 basta.`,
    ),
  ],
  'acessibilidade/sem-reduced-motion': () => [
    t('Animations that ignore "reduce motion"', 'Animações sem respeitar "reduzir movimento"'),
    t('People who turn on "reduce motion" in their system (motion sickness, vertigo) still see the animations. Wrap the animations in motion-safe: or add @media (prefers-reduced-motion: reduce) turning them off.', 'Quem liga "reduzir movimento" no sistema (enjoo, labirintite) continua vendo as animações. Envolva as animações em motion-safe: ou adicione @media (prefers-reduced-motion: reduce) desligando-as.'),
  ],
  'acessibilidade/sem-color-scheme': () => [
    t('Dark theme without color-scheme', 'Tema escuro sem color-scheme'),
    t('Without color-scheme: dark, scrollbars, fields and native menus show up light in the dark theme. Add color-scheme: dark to :root (or the scheme-dark class).', 'Sem color-scheme: dark, barras de rolagem, campos e menus nativos aparecem claros no tema escuro. Adicione color-scheme: dark no :root (ou a classe scheme-dark).'),
  ],
  'movimento/transition-all': (c, n) => [
    t(`transition-all${n > 1 ? ` in ${n} places` : ''}`, `transition-all${n > 1 ? ` em ${n} lugares` : ''}`),
    t('It animates every property that changes (even size and background color at once), which is heavy and causes surprises. List only what changes: transition-colors, transition-opacity, transition-transform.', 'Anima toda propriedade que mudar (inclusive tamanho e cor de fundo de uma vez), pesa e dá efeitos inesperados. Liste só o que muda: transition-colors, transition-opacity, transition-transform.'),
  ],
  'movimento/ease-in': (c, n) => [
    t(`ease-in curve in the interface${n > 1 ? ` (${n} places)` : ''}`, `Curva ease-in em interface${n > 1 ? ` (${n} lugares)` : ''}`),
    t('ease-in starts slowly: the click feels delayed. In interfaces, use ease-out (or an exit curve like cubic-bezier(0.23, 1, 0.32, 1)).', 'ease-in começa devagar: o clique parece atrasado. Em interface, use ease-out (ou uma curva de saída como cubic-bezier(0.23, 1, 0.32, 1)).'),
  ],
  'movimento/entra-do-zero': (c, n) => [
    t(`Element that appears from scale(0)${n > 1 ? ` (${n} places)` : ''}`, `Elemento que surge de scale(0)${n > 1 ? ` (${n} lugares)` : ''}`),
    t('Growing from zero looks artificial. Start from 0.95 with opacity 0 (e.g. scale-95 opacity-0 → scale-100 opacity-100).', 'Crescer do zero parece artificial. Comece de 0.95 com opacidade 0 (ex.: scale-95 opacity-0 → scale-100 opacity-100).'),
  ],
  'movimento/anima-tamanho-ou-posicao': (c, n) => [
    t(`Animating width, height or position (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Animação de largura, altura ou posição (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Animating width/height/top/left recalculates the page every frame and stutters. Animate transform (translate, scale) and opacity.', 'Animar width/height/top/left recalcula a página a cada quadro e engasga. Anime transform (translate, scale) e opacity.'),
  ],
  'movimento/duracao-longa': (c, n) => [
    t(`Long interface animation (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Animação de interface longa (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Above 300 ms the interface feels slow (modals and drawers up to 500 ms; toasts up to 400 ms). Shorten to 150–250 ms.', 'Acima de 300 ms a interface parece lenta (modal e gaveta até 500 ms; toast até 400 ms). Encurte para 150–250 ms.'),
  ],
  'movimento/quique': (c, n) => [
    t(`Bounce animation (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Animação de quique (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Bounce and elastic effects in an interface look like a toy and distract. Use a smooth exit curve.', 'Quique e elástico em interface parecem brinquedo e distraem. Use uma curva de saída suave.'),
  ],
  'movimento/toaster-duplicado': (c) => [
    t(`More than one <Toaster> in the app (${c.count})`, `Mais de um <Toaster> no app (${c.count})`),
    t('Each <Toaster> draws its own stack of notices: messages show up twice or in different places. Keep just one, in the root layout.', 'Cada <Toaster> desenha sua própria pilha de avisos: as mensagens aparecem duplicadas ou em lugares diferentes. Deixe um só, no layout raiz.'),
  ],
  'conteudo/dado-de-enchimento': (c, n) => [
    t(`Sample data left on screen ("${c.token}")${n > 1 ? `, ${n} places` : ''}`, `Dado de exemplo esquecido na tela ("${c.token}")${n > 1 ? `, ${n} lugares` : ''}`),
    t('Sample names, phone numbers or text ("Lorem ipsum", "John Doe") make the app look unfinished. Use real data or an empty state.', 'Nome, telefone ou texto de exemplo ("Lorem ipsum", "John Doe") passa a impressão de app inacabado. Use dados reais ou um estado vazio.'),
  ],
  'conteudo/reticencias': (c, n) => [
    t(`Three dots ("...") instead of an ellipsis ("…")${n > 1 ? `, ${n} places` : ''}`, `Três pontos ("...") no lugar de reticências ("…")${n > 1 ? `, ${n} lugares` : ''}`),
    t('Use the ellipsis character "…" (e.g. "Loading…"): it takes the right space and does not break at the end of a line.', 'Use o caractere de reticências "…" (ex.: "Carregando…"): ocupa o espaço certo e não quebra no fim da linha.'),
  ],
  'conteudo/alerta-do-navegador': (c, n) => [
    t(`Browser alert()/confirm()${n > 1 ? ` (${n} places)` : ''}`, `alert()/confirm() do navegador${n > 1 ? ` (${n} lugares)` : ''}`),
    t('The browser box freezes the page, looks like the system and ignores the design. Use a notice (toast) or a modal from the app itself.', 'A caixa do navegador trava a página, tem a cara do sistema e não segue o design. Use um aviso (toast) ou um modal do próprio app.'),
  ],
  'conteudo/clique-aqui': (c, n) => [
    t(`"Click here" link or button${n > 1 ? ` (${n} places)` : ''}`, `Link ou botão "Clique aqui"${n > 1 ? ` (${n} lugares)` : ''}`),
    t('The text does not say where it goes; screen reader users hear a list of "click here". Write the action: "Download the report", "See plans".', 'O texto não diz para onde vai; quem usa leitor de tela ouve uma lista de "clique aqui". Escreva a ação: "Baixar o relatório", "Ver planos".'),
  ],
  'pratica/controle-morto': (c, n) => [
    t(`Link or button that does nothing (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Link ou botão que não faz nada (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('href="#" or an empty onClick looks like it works but goes nowhere. Connect it to the real action or remove the element.', 'href="#" ou onClick vazio parece funcionar mas não leva a lugar nenhum. Ligue à ação real ou tire o elemento.'),
  ],
  'design/cinzas-misturados': (c) => [
    t(`Grays from different families mixed together (${c.families})`, `Cinzas de famílias diferentes misturados (${c.families})`),
    t(`Tailwind has several gray families (slate, gray, zinc, neutral, stone) with slightly different tones; mixing them gives a "dirty" gray. The main one here is ${c.main}; replace ${c.others}.`, `O Tailwind tem várias famílias de cinza (slate, gray, zinc, neutral, stone) com tons levemente diferentes; misturar dá um cinza "sujo". A principal aqui é ${c.main}; troque ${c.others}.`),
  ],
  'design/icones-misturados': (c) => [
    t(`More than one icon library (${c.libs})`, `Mais de uma biblioteca de ícones (${c.libs})`),
    t('Icons from different libraries have different strokes and sizes. Pick one and use only that one (and note it in design.md).', 'Ícones de bibliotecas diferentes têm traço e tamanho diferentes. Escolha uma e use só ela (e registre no design.md).'),
  ],
  'design/z-index-alto': (c, n) => [
    t(`Three-digit z-index (${c.token})${n > 1 ? `, ${n} places` : ''}`, `z-index de três dígitos (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('A huge z-index is a sign of layers fighting each other. Define a small scale (e.g. 10 menu, 20 header, 30 popover, 50 modal) and use only that.', 'z-index enorme é sinal de briga de camadas. Defina uma escala pequena (ex.: 10 menu, 20 header, 30 popover, 50 modal) e use só ela.'),
  ],
  'design/texto-miudo': (c, n) => [
    t(`Text smaller than 12 px (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Texto menor que 12 px (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Below 12 px it is hard to read, especially on phones. Use at least text-xs (12 px), or note it in design.md if it is an intentional label.', 'Abaixo de 12 px fica difícil de ler, ainda mais no celular. Use no mínimo text-xs (12 px), ou registre no design.md se for um rótulo proposital.'),
  ],
  'design/texto-em-degrade': (c, n) => [
    t(`Gradient text${n > 1 ? ` (${n} places)` : ''}`, `Texto em degradê${n > 1 ? ` (${n} lugares)` : ''}`),
    t('Gradient text is the trademark of AI-made pages and usually has poor contrast. Use a solid color from the palette.', 'Texto com gradiente é a marca registrada de página feita por IA e costuma ter contraste ruim. Use uma cor sólida da paleta.'),
  ],
  'design/tema-nao-segue-sistema': () => [
    t('Light and dark themes that ignore the system setting', 'Tema claro e escuro sem seguir o do sistema'),
    t('The app has both themes but does not check the device preference (prefers-color-scheme): someone using their phone in dark mode opens the app in light, and vice versa. Start with the system theme (or offer a "System" option) and let the person switch.', 'O app tem os dois temas, mas não olha a preferência do aparelho (prefers-color-scheme): quem usa o celular no escuro abre o app claro, e vice-versa. Comece pelo tema do sistema (ou ofereça a opção "Sistema") e deixe a pessoa trocar.'),
  ],
  'identidade/theme-color-unico': () => [
    t('One browser bar color for both themes', 'Uma cor de barra do navegador para os dois temas'),
    t('theme-color paints the browser bar on phones. With a single color, the bar clashes with the page in the other theme. Use two theme-color tags with media="(prefers-color-scheme: light)" and "(prefers-color-scheme: dark)", or change the color along with the theme.', 'O theme-color pinta a barra do navegador no celular. Com uma cor só, no outro tema a barra fica destoando da página. Use duas tags theme-color com media="(prefers-color-scheme: light)" e "(prefers-color-scheme: dark)", ou troque a cor junto com o tema.'),
  ],
  'design/emoji-como-icone': (c, n) => [
    t(`Emoji used as an icon or decoration (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Emoji usado como ícone ou enfeite (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Emoji look different on each system and do not match the stroke of the app icons. Use the project icon library.', 'Emoji muda de cara em cada sistema e não segue o traço dos ícones do app. Use a biblioteca de ícones do projeto.'),
  ],
}
Object.assign(TEXT, FLUTTER_TEXT, NATIVE_TEXT)

const lineList = (lines) => (lines.length ? ` ${t('Lines', 'Linhas')}: ${lines.slice(0, 12).join(', ')}${lines.length > 12 ? '…' : ''}.` : '')

// Tema principal: pela cor de fundo do design.md ou, sem ela, pelos sinais do código.
function baseTheme(bgs, light, dark) {
  if (bgs.length) return luminance(bgs[0]) < 0.2 ? 'escuro' : 'claro'
  return light && !dark ? 'escuro' : 'claro'
}

/**
 * Quais temas o projeto tem, pelo código: o principal (a cor de fundo do design.md, ou o que os sinais indicam) e se
 * existe o outro (variantes dark:/light:, [data-theme], .dark, prefers-color-scheme). followsSystem = olha a
 * preferência do aparelho (o dark: do Tailwind sem @custom-variant dark já segue o sistema).
 */
export function themeSupport(p, tokens) {
  const code = [...p.ui, ...p.css, ...p.head, ...(p.themeCode ?? [])].map((f) => f.text).join('\n')
  const dark = /prefers-color-scheme\s*:\s*dark|\[data-(theme|mode|color-scheme)=['"]?dark|(^|[\s"'`.])\.dark\b|(^|[\s"'`])dark:[a-z!-]|@custom-variant\s+dark|darkMode\s*:/m.test(code)
  const light = /prefers-color-scheme\s*:\s*light|\[data-(theme|mode|color-scheme)=['"]?light|(^|[\s"'`])\.light\b|(^|[\s"'`])light:[a-z!-]|@custom-variant\s+light/m.test(code)
  const bgs = (tokens?.colors ?? []).filter((t) => /fundo|background|superf[ií]cie/i.test(t.usage ?? '')).map((t) => parseColor(t.value)).filter(Boolean)
  const base = baseTheme(bgs, light, dark)
  const both = base === 'claro' ? dark : light
  const usesTailwindDark = /(^|[\s"'`])dark:[a-z!-]/m.test(code) && !/@custom-variant\s+dark|darkMode\s*:/.test(code)
  const followsSystem = /prefers-color-scheme/.test(code) || usesTailwindDark
  return { base, both, followsSystem }
}

/** Temas do projeto pelo código (para a medição no navegador saber quais forçar). */
export function detectThemes(root, { uiExt, tokens }) {
  return themeSupport(loadProject(root, uiExt), tokens)
}

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
function uiFileRules({ rel, text }, c, designText, stats) {
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
function nativeRules({ rel, text }, c, stats) {
  const ign = ignoreSet(text)
  nativeFileRules({ rel, text }, tags(text), (rule, line, ctx) => (ign.ignored(rule, line) ? stats.ignored++ : c.add(rule, rel, line, ctx)))
}

function dartFileRules({ rel, text }, c, stats) {
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

function cssFileRules({ rel, text }, c, stats) {
  const ign = ignoreSet(text)
  const add = (rule, line, ctx) => (ign.ignored(rule, line) ? stats.ignored++ : c.add(rule, rel, line, ctx))
  for (const b of cssBlocks(text)) cssBlockRules(b, add)
}

// ---------- regras do <head> (identidade e viewport) ----------

function headIdentityRules(p, c, themes, headText, headFile) {
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

function headViewportRules(p, c, headText, headFile, code) {
  const viewport = headText.match(/name\s*[:=]\s*['"]viewport['"][^>}]*?content\s*[:=]\s*['"]([^'"]*)['"]/)?.[1] ?? headText.match(/export const viewport[\s\S]{0,300}/)?.[0]
  if (!viewport && !p.deps?.next && !p.deps?.nuxt && !/name\s*[:=]\s*['"]viewport/.test(headText)) c.add('responsivo/sem-viewport', headFile, null, {})
  if (viewport && /user-scalable\s*[=:]\s*['"]?(no|0|false)|maximum-scale\s*[=:]\s*['"]?1(\.0)?\b/.test(viewport)) c.add('responsivo/zoom-desligado', headFile, null, {})
  if (/env\(\s*safe-area-inset/.test(code) && !/viewport-fit\s*=\s*cover/.test(headText)) c.add('responsivo/safe-area-sem-viewport-fit', headFile, null, {})
}

// ---------- regras do projeto inteiro ----------

function projectWideRules(p, c, themes, code) {
  const animated = /@keyframes|\banimate-(?!none)[\w-]+|framer-motion|from ['"]motion|transition-(transform|all|opacity)/.test(code)
  if (animated && !/prefers-reduced-motion|motion-reduce:|motion-safe:|useReducedMotion|reducedMotion/.test(code))
    c.add('acessibilidade/sem-reduced-motion', null, null, {})
  if (themes.both && !themes.followsSystem) c.add('design/tema-nao-segue-sistema', p.themeCode?.[0]?.rel ?? null, null, {})
  const toasters = (code.match(/<Toaster\b/g) ?? []).length
  if (toasters > 1) c.add('movimento/toaster-duplicado', p.ui.find((f) => /<Toaster\b/.test(f.text))?.rel ?? null, null, { count: toasters })
}

// Cinzas de famílias diferentes do Tailwind misturados.
function grayRules(c, code, designText) {
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

function iconLibRules(c, code) {
  const libs = ICON_LIBS.filter((l) => new RegExp(`from ['"]${l.replace(/[/@-]/g, '\\$&')}`).test(code))
  if (libs.length > 1) c.add('design/icones-misturados', null, null, { libs: libs.join(', ') })
}

const decimal = (n) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Contraste entre as cores do design.md (texto × fundo) e tema escuro sem color-scheme.
function contrastRules(c, { designMdPath, tokens, code, headText }) {
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

// ---------- achados ----------

// Contraste abaixo de 3:1 é alto; entre 3 e 4,5 é médio. As outras regras usam a gravidade da tabela.
function severityOf(h, meta) {
  if (h.rule !== 'acessibilidade/contraste-baixo') return meta.severity
  return h.ctx.high ? 'high' : 'medium'
}

function hitsToFindings(c) {
  const findings = []
  for (const h of c.hits.values()) {
    const meta = RULES[h.rule]
    const [title, detail] = TEXT[h.rule](h.ctx ?? {}, Math.max(1, h.lines.length))
    findings.push({
      kind: meta.kind,
      rule: h.rule,
      severity: severityOf(h, meta),
      title,
      detail: `${detail}${lineList(h.lines)}`.slice(0, 2000),
      file: h.file,
      line: h.lines[0] ?? null,
      fingerprint: `lint:${h.rule}|${h.file ?? ''}${h.rule === 'acessibilidade/contraste-baixo' ? `|${h.ctx.text}` : ''}`,
    })
  }
  return findings
}

/** Roda as regras e devolve achados no formato da CLI. */
export function runRules(root, { uiExt, designMdPath, designMd, tokens }) {
  const p = loadProject(root, uiExt)
  const c = makeCollector()
  const designText = designMd ?? ''
  const themes = themeSupport(p, tokens)
  const stats = { ignored: 0 }

  for (const f of p.ui) uiFileRules(f, c, designText, stats)
  for (const f of p.css) cssFileRules(f, c, stats)
  for (const f of p.dart) dartFileRules(f, c, stats)
  // React Native: o estilo vive no StyleSheet e nas props, não em classes.
  if (isNativeProject(p.deps)) for (const f of p.ui.filter((u) => /\.[jt]sx$/.test(u.rel))) nativeRules(f, c, stats)

  const headText = p.head.map((h) => h.text).join('\n')
  const code = [...p.ui, ...p.css].map((f) => f.text).join('\n')
  if (p.ui.length && p.head.length) {
    const headFile = p.head[0]?.rel ?? null
    headIdentityRules(p, c, themes, headText, headFile)
    headViewportRules(p, c, headText, headFile, code)
  }
  projectWideRules(p, c, themes, code)
  grayRules(c, code, designText)
  iconLibRules(c, code)
  contrastRules(c, { designMdPath, tokens, code, headText })

  return { findings: hitsToFindings(c), ignored: stats.ignored, themes }
}
