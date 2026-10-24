// Resultado do script de medição (skills/design/medir.js) → achados de design, um por tela, largura e regra.
// A extensão do Chrome usa uma cópia deste arquivo (extension/measure-findings.js); o teste
// plugin/test/measure-findings.test.mjs barra cópia diferente. Por isso não importa o i18n.mjs: a língua vem
// do terceiro parâmetro ('en' | 'pt'; a CLI passa lang()) ou, sem ele, da língua do navegador/sistema.
const list = (items, fmt, max = 8) =>
  items
    .slice(0, max)
    .map(fmt)
    .join('; ') + (items.length > max ? '; …' : '')
const who = (x) => `${x.el}${x.text ? ` ("${x.text}")` : ''}`
const systemLang = () => (/^pt/i.test(globalThis.navigator?.language ?? '') ? 'pt' : 'en')

/** Resultado do script de medição → achados (um por tela, largura e regra). */
export function measureFindings(m, screen, lang = systemLang()) {
  const t = (en, pt) => (lang === 'pt' ? pt : en)
  const num = (n) => (lang === 'pt' ? String(n).replace('.', ',') : String(n))
  const theme = m.tema === 'claro' ? t('light', 'claro') : m.tema === 'escuro' ? t('dark', 'escuro') : m.tema
  const at = `${screen} ${t('at', 'em')} ${m.largura} px${m.tema ? ` (${t(`${theme} theme`, `tema ${theme}`)})` : ''}`
  const out = []
  const add = (rule, kind, severity, title, detail) => out.push({ rule, kind, severity, title, detail: `${detail} ${t('Page', 'Página')}: ${m.url}.`.slice(0, 2000) })
  if (m.rolagem)
    add(
      'responsivo/rolagem-horizontal',
      'responsive',
      'high',
      t(`Sideways scrolling: ${at}`, `Rolagem para o lado: ${at}`),
      t(
        `The page is ${m.rolagem.pagina} px wide on a ${m.rolagem.tela} px screen. Going past the edge: ${list(m.rolagem.culpados, (c) => `${who(c)} +${c.passa} px`)}. Use fluid widths (w-full, max-w), stack columns on phones, or scroll only inside a box.`,
        `A página tem ${m.rolagem.pagina} px numa tela de ${m.rolagem.tela} px. Passam da borda: ${list(m.rolagem.culpados, (c) => `${who(c)} +${c.passa} px`)}. Use largura fluida (w-full, max-w), quebre colunas no celular ou role só dentro de uma caixa.`,
      ),
    )
  if (m.toque?.length)
    add(
      'responsivo/alvo-de-toque-pequeno',
      'responsive',
      'medium',
      t(
        `${m.toque.length === 1 ? '1 tap target' : `${m.toque.length} tap targets`} smaller than 44 px: ${at}`,
        `${m.toque.length === 1 ? '1 alvo de toque menor' : `${m.toque.length} alvos de toque menores`} que 44 px: ${at}`,
      ),
      t(
        `On phones, buttons and links need at least 44×44 px for a finger. Too small: ${list(m.toque, (x) => `${who(x)} ${x.w}×${x.h}`)}. Make the clickable area bigger (padding or min-h-11/min-w-11) without changing the look.`,
        `No celular, botões e links precisam de pelo menos 44×44 px para o dedo. Pequenos: ${list(m.toque, (x) => `${who(x)} ${x.w}×${x.h}`)}. Aumente a área clicável (padding ou min-h-11/min-w-11) sem mudar o desenho.`,
      ),
    )
  if (m.cortado?.length)
    add(
      'visual/texto-cortado',
      'visual',
      'medium',
      t(`Text cut off without an ellipsis: ${at}`, `Texto cortado sem reticências: ${at}`),
      t(
        `The end of the text disappears (box with hidden overflow, no "…"): ${list(m.cortado, who)}. Let the line wrap, use truncate (with an ellipsis) or make the box bigger.`,
        `O fim do texto some (caixa com overflow escondido, sem "…"): ${list(m.cortado, who)}. Deixe quebrar a linha, use truncate (com reticências) ou aumente a caixa.`,
      ),
    )
  if (m.contraste?.length) {
    const worst = Math.min(...m.contraste.map((c) => c.razao))
    add(
      'acessibilidade/contraste-na-tela',
      'a11y',
      worst < 3 ? 'high' : 'medium',
      t(`Low contrast on screen (lowest ${num(worst)}:1): ${at}`, `Contraste baixo na tela (mínimo ${num(worst)}:1): ${at}`),
      t(
        `Measured on screen (text color × actual background): ${list(m.contraste, (c) => `${who(c)} ${c.cor} on ${c.fundo} = ${num(c.razao)}:1 (needs ${num(c.minimo)})`)}. Lighten the text or darken the background.`,
        `Medido na tela (cor do texto × fundo de verdade): ${list(m.contraste, (c) => `${who(c)} ${c.cor} sobre ${c.fundo} = ${num(c.razao)}:1 (precisa ${num(c.minimo)})`)}. Clareie o texto ou escureça o fundo.`,
      ),
    )
  }
  if (m.miudo?.length)
    add(
      'acessibilidade/texto-pequeno-na-tela',
      'a11y',
      'low',
      t(`Text smaller than 12 px: ${at}`, `Texto menor que 12 px: ${at}`),
      t(
        `Hard to read: ${list(m.miudo, (x) => `${who(x)} ${x.size} px`)}. Use at least 12 px (or note it in design.md if it is on purpose).`,
        `Difícil de ler: ${list(m.miudo, (x) => `${who(x)} ${x.size} px`)}. Use no mínimo 12 px (ou registre no design.md se for proposital).`,
      ),
    )
  if (m.lento?.length)
    add(
      'movimento/transicao-lenta-na-tela',
      'motion',
      'low',
      t(`Transition longer than 300 ms on a clickable element: ${at}`, `Transição de mais de 300 ms em elemento clicável: ${at}`),
      t(
        `The interface feels slow: ${list(m.lento, (x) => `${who(x)} ${x.ms} ms (${x.curva})`)}. Use 150–250 ms with an ease-out curve.`,
        `A interface parece lenta: ${list(m.lento, (x) => `${who(x)} ${x.ms} ms (${x.curva})`)}. Use 150–250 ms com curva de saída.`,
      ),
    )
  if (m.borda?.length)
    add(
      'responsivo/texto-colado-na-borda',
      'responsive',
      'low',
      t(`Text touching the edge of the screen: ${at}`, `Texto colado na borda da tela: ${at}`),
      t(
        `Less than 12 px of space to the edge: ${list(m.borda, who)}. Give at least 16 px of side padding on phones.`,
        `Menos de 12 px de respiro até a borda: ${list(m.borda, who)}. Dê padding lateral de pelo menos 16 px no celular.`,
      ),
    )
  return out
}
