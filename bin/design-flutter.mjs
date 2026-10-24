// Checagem de design das telas Flutter (arquivos .dart em lib/), sem IA. As regras da web (design-rules.mjs)
// leem classes e tags; aqui o equivalente no Flutter: cor e fonte fixas fora do tema, botão de ícone sem
// tooltip, imagem sem descrição, largura fixa maior que a tela, animação longa ou com easeIn, botão que não
// faz nada e o título do modelo ("Flutter Demo"). Também lê as cores do tema para a Vitrine.
import fs from 'node:fs'
import path from 'node:path'
import { t } from './i18n.mjs'

export const FLUTTER_RULES = {
  'design/cor-fixa-flutter': { kind: 'off_spec', severity: 'medium' },
  'design/fonte-fixa-flutter': { kind: 'off_spec', severity: 'low' },
  'acessibilidade/botao-sem-tooltip': { kind: 'a11y', severity: 'high' },
  'acessibilidade/imagem-sem-descricao': { kind: 'a11y', severity: 'medium' },
  'responsivo/largura-fixa-flutter': { kind: 'responsive', severity: 'medium' },
  'movimento/duracao-longa-flutter': { kind: 'motion', severity: 'low' },
  'movimento/ease-in-flutter': { kind: 'motion', severity: 'medium' },
  'pratica/botao-sem-acao': { kind: 'practice', severity: 'high' },
  'identidade/titulo-do-modelo': { kind: 'identity', severity: 'medium' },
}

export const FLUTTER_TEXT = {
  'design/cor-fixa-flutter': (c, n) => [
    t(`${n} color${n > 1 ? 's' : ''} written straight into the screen (${c.token})`, `${n} cor${n > 1 ? 'es' : ''} escrita${n > 1 ? 's' : ''} direto na tela (${c.token})`),
    t(
      'The color is fixed in the widget instead of coming from the theme. When the design changes (or in the dark theme), this screen ends up different from the others. Use Theme.of(context).colorScheme (primary, surface, onSurface…) and define the colors once in ThemeData.',
      'A cor está fixa no widget em vez de vir do tema. Quando o design mudar (ou no tema escuro), essa tela fica diferente das outras. Use Theme.of(context).colorScheme (primary, surface, onSurface…) e defina as cores uma vez no ThemeData.',
    ),
  ],
  'design/fonte-fixa-flutter': (c, n) => [
    t(`${n} fixed font size${n > 1 ? 's' : ''} on the screen (fontSize: ${c.size})`, `${n} tamanho${n > 1 ? 's' : ''} de fonte fixo${n > 1 ? 's' : ''} na tela (fontSize: ${c.size})`),
    t(
      'The text size is written in the widget instead of coming from the theme. Use Theme.of(context).textTheme (titleLarge, bodyMedium…) so the text follows the standard and the system text size setting.',
      'O tamanho do texto está escrito no widget em vez de vir do tema. Use Theme.of(context).textTheme (titleLarge, bodyMedium…) para o texto seguir o padrão e o ajuste de tamanho do sistema.',
    ),
  ],
  'acessibilidade/botao-sem-tooltip': (c, n) => [
    t(`Icon-only button with no name for screen readers${n > 1 ? ` (${n} buttons)` : ''}`, `Botão só com ícone, sem nome para leitor de tela${n > 1 ? ` (${n} botões)` : ''}`),
    t(
      'The IconButton has no tooltip: TalkBack and VoiceOver just say "button". Add tooltip: "…" saying what the button does (it becomes the name read aloud).',
      'O IconButton não tem tooltip: o TalkBack e o VoiceOver anunciam só "botão". Adicione tooltip: "…" dizendo o que o botão faz (ele vira o nome lido em voz alta).',
    ),
  ],
  'acessibilidade/imagem-sem-descricao': (c, n) => [
    t(`Image with no description for screen readers${n > 1 ? ` (${n} images)` : ''}`, `Imagem sem descrição para leitor de tela${n > 1 ? ` (${n} imagens)` : ''}`),
    t(
      'Image without semanticLabel: screen reader users do not know what the image shows. Add semanticLabel: "…" (or excludeFromSemantics: true if it is just decoration).',
      'Image sem semanticLabel: quem usa leitor de tela não sabe o que a imagem mostra. Adicione semanticLabel: "…" (ou excludeFromSemantics: true se for só decoração).',
    ),
  ],
  'responsivo/largura-fixa-flutter': (c, n) => [
    t(`Fixed width bigger than a phone screen (width: ${c.width})${n > 1 ? ` in ${n} places` : ''}`, `Largura fixa maior que a tela do celular (width: ${c.width})${n > 1 ? ` em ${n} lugares` : ''}`),
    t(
      'A fixed width above ~360 overflows the screen on small phones (the yellow and black overflow stripe shows up). Use Expanded/Flexible, ConstrainedBox(maxWidth: …) or the width from LayoutBuilder.',
      'Uma largura fixa acima de ~360 estoura a tela em celulares pequenos (aparece a faixa amarela e preta de overflow). Use Expanded/Flexible, ConstrainedBox(maxWidth: …) ou a largura vinda do LayoutBuilder.',
    ),
  ],
  'movimento/duracao-longa-flutter': (c, n) => [
    t(`Long animation (${c.ms} ms)${n > 1 ? ` in ${n} places` : ''}`, `Animação longa (${c.ms} ms)${n > 1 ? ` em ${n} lugares` : ''}`),
    t(
      'Interface animations above 300 ms (500 for full screens) make the app feel slow. Use 150–300 ms for buttons, menus and state changes.',
      'Animação de interface acima de 300 ms (500 para telas inteiras) deixa o app com cara de lento. Use 150–300 ms para botões, menus e trocas de estado.',
    ),
  ],
  'movimento/ease-in-flutter': (c, n) => [
    t(`Curves.easeIn curve in the interface${n > 1 ? ` (${n} places)` : ''}`, `Curva Curves.easeIn em interface${n > 1 ? ` (${n} lugares)` : ''}`),
    t('easeIn starts slowly: the tap feels delayed. In interfaces, use Curves.easeOut or Curves.easeOutCubic.', 'easeIn começa devagar: o toque parece atrasado. Em interface, use Curves.easeOut ou Curves.easeOutCubic.'),
  ],
  'pratica/botao-sem-acao': (c, n) => [
    t(`Button that does nothing (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Botão que não faz nada (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t(
      'The button looks active but onPressed/onTap is empty: the person taps and nothing happens. Connect the real action or disable the button (onPressed: null) until it exists.',
      'O botão aparece ativo mas o onPressed/onTap está vazio: a pessoa toca e nada acontece. Ligue a ação de verdade ou desabilite o botão (onPressed: null) até ela existir.',
    ),
  ],
  'identidade/titulo-do-modelo': (c) => [
    t(`The app title is still the template one ("${c.title}")`, `Título do app ainda é o do modelo ("${c.title}")`),
    t(
      'It is the name shown in the Android recent apps list and on the browser tab (Flutter Web). Replace it with the app name in MaterialApp(title: …).',
      'É o nome que aparece na lista de apps abertos do Android e na aba do navegador (Flutter Web). Troque pelo nome do app no MaterialApp(title: …).',
    ),
  ],
}

const COLOR = /\b(Color\(\s*0x[0-9a-fA-F]{8}\s*\)|Color\.fromARGB\([^)]*\)|Color\.fromRGBO\([^)]*\)|Colors\.(?!transparent\b)[a-z]+[A-Za-z]*(?:\[\d+\]|\.shade\d+)?)/g
// O arquivo que define o tema pode ter as cores fixas: é o lugar delas.
const THEME_FILE = /(theme|colors?|palette|tokens?|styles?)\.dart$/i

/** Regras de um arquivo .dart de tela. `add(rule, line, ctx)`. */
export function flutterFileRules({ rel, text }, add) {
  const lines = text.split('\n')
  const themeFile = THEME_FILE.test(rel)
  lines.forEach((l, i) => {
    const line = i + 1
    if (/^\s*\/\//.test(l)) return
    if (!themeFile) {
      const color = [...l.matchAll(COLOR)][0]
      if (color && !/ThemeData|ColorScheme|colorScheme\b|seedColor/.test(l)) add('design/cor-fixa-flutter', line, { token: color[1].slice(0, 30) })
      const size = l.match(/\bfontSize\s*:\s*(\d+(?:\.\d+)?)/)
      if (size && !/textTheme|TextTheme/.test(l)) add('design/fonte-fixa-flutter', line, { size: size[1] })
    }
    const width = l.match(/\b(?:width|minWidth)\s*:\s*(\d{3,})(?:\.0)?\b/)
    if (width && Number(width[1]) > 360 && !/maxWidth|double\.infinity|MediaQuery|constraints/.test(l)) add('responsivo/largura-fixa-flutter', line, { width: width[1] })
    const ms = l.match(/Duration\(\s*milliseconds\s*:\s*(\d+)\s*\)/)
    if (ms && Number(ms[1]) > 500 && /Animat|Duration|transition|curve/i.test(l + (lines[i - 1] ?? ''))) add('movimento/duracao-longa-flutter', line, { ms: ms[1] })
    if (/\bCurves\.easeIn\b(?!Out)/.test(l)) add('movimento/ease-in-flutter', line, {})
    const empty = l.match(/\b(onPressed|onTap)\s*:\s*\(\)\s*(\{\s*\}|=>\s*null|=>\s*\{\s*\})/)
    if (empty) add('pratica/botao-sem-acao', line, { token: empty[0].replace(/\s+/g, ' ') })
    const demo = l.match(/\btitle\s*:\s*['"](Flutter Demo|Flutter Demo Home Page|My App)['"]/)
    if (demo) add('identidade/titulo-do-modelo', line, { title: demo[1] })
  })
  for (const call of calls(text, /\bIconButton\s*\(/g)) if (!/\btooltip\s*:/.test(call.body)) add('acessibilidade/botao-sem-tooltip', call.line, {})
  for (const call of calls(text, /\bImage\.(asset|network|file|memory)\s*\(/g))
    if (!/\b(semanticLabel|excludeFromSemantics)\s*:/.test(call.body)) add('acessibilidade/imagem-sem-descricao', call.line, {})
}

/** Cada chamada que casa com `re`, com o texto entre os parênteses (contando os aninhados). */
function calls(text, re) {
  const out = []
  for (const m of text.matchAll(re)) {
    let depth = 0
    let end = m.index + m[0].length - 1
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++
      else if (text[end] === ')' && --depth === 0) break
    }
    out.push({ line: text.slice(0, m.index).split('\n').length, body: text.slice(m.index, end + 1) })
  }
  return out
}

/**
 * Cores do tema de um app Flutter, para a Vitrine: constantes `nome = Color(0xFF…)` nos arquivos de tema e de
 * cores de lib/, e os papéis do ColorScheme (primary: Color(0xFF…), seedColor…). Devolve { name, value, source }.
 */
export function flutterColorTokens(root) {
  const out = new Map()
  for (const rel of dartFilesIn(root, 'lib').filter((f) => THEME_FILE.test(f)).slice(0, 20)) {
    let text = ''
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8')
    } catch {
      continue
    }
    const re = /\b(?:static\s+)?(?:const|final)?\s*(?:Color\s+)?([a-zA-Z_]\w*)\s*[:=]\s*(?:const\s+)?Color\(\s*0x([0-9a-fA-F]{8})\s*\)/g
    for (const m of text.matchAll(re)) if (!out.has(m[1])) out.set(m[1], { name: m[1], value: argbToCss(m[2]), source: rel })
  }
  return [...out.values()]
}

// Arquivos .dart de uma pasta (relativos à raiz), sem descer mais que 6 níveis.
function dartFilesIn(root, dir, depth = 0) {
  if (depth > 6) return []
  let entries = []
  try {
    entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  } catch {
    // Sem a pasta (projeto que não é Flutter): nada a ler.
    return []
  }
  return entries.flatMap((e) => {
    if (e.isDirectory()) return dartFilesIn(root, `${dir}/${e.name}`, depth + 1)
    return e.name.endsWith('.dart') ? [`${dir}/${e.name}`] : []
  })
}

// 0xAARRGGBB → #rrggbb (opaca) ou rgba(…).
function argbToCss(hex) {
  const a = parseInt(hex.slice(0, 2), 16)
  const rgb = hex.slice(2).toLowerCase()
  if (a === 255) return `#${rgb}`
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`
}
