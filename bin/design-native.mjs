// Checagem de design das telas React Native (Expo), sem IA. As regras da web (design-rules.mjs) leem classes e
// tags HTML; no React Native o estilo vive no StyleSheet e nas props, e os componentes são outros (Pressable,
// Image com source). O equivalente às regras do Flutter (design-flutter.mjs): cor e fonte fixas fora do tema,
// largura fixa maior que o celular, botão só com ícone sem accessibilityLabel, imagem sem descrição, onPress
// vazio e animação longa.

export const NATIVE_RULES = {
  'design/cor-fixa-native': { kind: 'off_spec', severity: 'medium' },
  'design/fonte-fixa-native': { kind: 'off_spec', severity: 'low' },
  'acessibilidade/botao-sem-nome-native': { kind: 'a11y', severity: 'high' },
  'acessibilidade/imagem-sem-descricao-native': { kind: 'a11y', severity: 'medium' },
  'responsivo/largura-fixa-native': { kind: 'responsive', severity: 'medium' },
  'movimento/duracao-longa-native': { kind: 'motion', severity: 'low' },
}

export const NATIVE_TEXT = {
  'design/cor-fixa-native': (c, n) => [
    `${n} cor${n > 1 ? 'es' : ''} escrita${n > 1 ? 's' : ''} direto na tela (${c.token})`,
    'A cor está fixa no estilo da tela em vez de vir do tema. Quando o design mudar (ou no tema escuro), essa tela fica diferente das outras. Defina as cores uma vez num arquivo de tema (theme.ts, colors.ts) e use daqui (colors.primaria).',
  ],
  'design/fonte-fixa-native': (c, n) => [
    `${n} tamanho${n > 1 ? 's' : ''} de fonte fixo${n > 1 ? 's' : ''} na tela (fontSize: ${c.size})`,
    'O tamanho do texto está escrito na tela em vez de vir do tema. Defina a escala de tamanhos num arquivo de tema (ex.: fontSize.corpo = 16) e use a mesma em todas as telas.',
  ],
  'acessibilidade/botao-sem-nome-native': (c, n) => [
    `Botão só com ícone, sem nome para leitor de tela${n > 1 ? ` (${n} botões)` : ''}`,
    'O Pressable/Touchable tem só um ícone: o TalkBack e o VoiceOver anunciam só "botão". Adicione accessibilityLabel="…" (e accessibilityRole="button") dizendo o que ele faz.',
  ],
  'acessibilidade/imagem-sem-descricao-native': (c, n) => [
    `Imagem sem descrição para leitor de tela${n > 1 ? ` (${n} imagens)` : ''}`,
    'Image sem accessibilityLabel (ou alt): quem usa leitor de tela não sabe o que a imagem mostra. Adicione accessibilityLabel="…", ou accessible={false} se for só decoração.',
  ],
  'responsivo/largura-fixa-native': (c, n) => [
    `Largura fixa maior que a tela do celular (width: ${c.width})${n > 1 ? ` em ${n} lugares` : ''}`,
    'Uma largura fixa acima de ~360 estoura a tela em celulares pequenos. Use flex: 1, width: "100%", maxWidth ou a largura do useWindowDimensions().',
  ],
  'movimento/duracao-longa-native': (c, n) => [
    `Animação longa (${c.ms} ms)${n > 1 ? ` em ${n} lugares` : ''}`,
    'Animação de interface acima de 300 ms (500 para telas inteiras) deixa o app com cara de lento. Use 150–300 ms para botões, menus e trocas de estado.',
  ],
}

// Cor escrita no estilo: hex, rgb()/rgba()/hsl() ou nome de cor (menos transparent, inherit e currentColor).
const COLOR = /\b(color|backgroundColor|borderColor|border\w*Color|tintColor|shadowColor|overlayColor|textShadowColor)\s*:\s*['"`](#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\)|(?!transparent|inherit|currentColor)[a-z]+)['"`]/
// O arquivo que define o tema pode (e deve) ter as cores e os tamanhos fixos.
const THEME_FILE = /(^|\/)(theme|themes|colors?|palette|tokens?|constants)(\/|\.[jt]sx?$)|(theme|colors?|palette|tokens?)\.[jt]sx?$/i
const BUTTON = /^(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback|RectButton|BorderlessButton)$/

/** O projeto é React Native (ou Expo)? */
export const isNativeProject = (deps) => !!(deps['react-native'] || deps.expo)

/** Regras de um arquivo de tela React Native. `add(rule, line, ctx)`; `tags`: as tags do arquivo (design-rules.mjs). */
export function nativeFileRules({ rel, text }, tags, add) {
  const lines = text.split('\n')
  const lineAt = (index) => text.slice(0, index).split('\n').length
  const themeFile = THEME_FILE.test(rel)
  lines.forEach((l, i) => {
    const line = i + 1
    if (/^\s*(\/\/|\*)/.test(l)) return
    if (!themeFile) {
      const color = l.match(COLOR)
      if (color) add('design/cor-fixa-native', line, { token: color[2].slice(0, 30) })
      const size = l.match(/\bfontSize\s*:\s*(\d+(?:\.\d+)?)\b/)
      if (size) add('design/fonte-fixa-native', line, { size: size[1] })
    }
    const width = l.match(/\b(?:width|minWidth)\s*:\s*(\d{3,})\b/)
    if (width && Number(width[1]) > 360 && !/maxWidth|Dimensions|useWindowDimensions/.test(l)) add('responsivo/largura-fixa-native', line, { width: width[1] })
    const ms = l.match(/\bduration\s*:\s*(\d+)\b/)
    if (ms && Number(ms[1]) > 500 && /Animated\.|withTiming|withSpring|LayoutAnimation|animation/i.test(l + (lines[i - 1] ?? ''))) add('movimento/duracao-longa-native', line, { ms: ms[1] })
    const empty = l.match(/\bonPress\s*=\s*\{\s*\(\)\s*=>\s*(\{\s*\}|null|undefined)\s*\}/)
    if (empty) add('pratica/botao-sem-acao', line, { token: empty[0].replace(/\s+/g, ' ') })
  })
  for (const t of tags) {
    if (BUTTON.test(t.name) && !t.selfClosing && !/accessibilityLabel\s*=|aria-label\s*=/.test(t.attrs)) {
      const close = text.indexOf(`</${t.name}>`, t.end)
      const inner = close > 0 ? text.slice(t.end, close) : ''
      const onlyIcon = inner && !inner.replace(/<[^>]*>/g, '').trim() && /<\w*(Icon|Icons|icons)\b|<(Ionicons|MaterialIcons|MaterialCommunityIcons|FontAwesome\d?|Feather|AntDesign|Entypo|Svg)\b/.test(inner)
      if (onlyIcon && !/<Text\b/.test(inner)) add('acessibilidade/botao-sem-nome-native', lineAt(t.start), {})
    }
    if (t.name === 'Image' && /\bsource\s*=/.test(t.attrs) && !/accessibilityLabel\s*=|\balt\s*=|accessible\s*=\s*\{\s*false\s*\}/.test(t.attrs))
      add('acessibilidade/imagem-sem-descricao-native', lineAt(t.start), {})
  }
}
