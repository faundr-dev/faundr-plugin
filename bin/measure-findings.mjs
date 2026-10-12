// Resultado do script de medição (skills/design/medir.js) → achados de design, um por tela, largura e regra.
// A extensão do Chrome usa uma cópia deste arquivo (extension/measure-findings.js); o teste
// plugin/test/measure-findings.test.mjs barra cópia diferente.
const list = (items, fmt, max = 8) =>
  items
    .slice(0, max)
    .map(fmt)
    .join('; ') + (items.length > max ? '; …' : '')
const who = (x) => `${x.el}${x.text ? ` ("${x.text}")` : ''}`

/** Resultado do script de medição → achados (um por tela, largura e regra). */
export function measureFindings(m, screen) {
  const at = `${screen} em ${m.largura} px`
  const out = []
  const add = (rule, kind, severity, title, detail) => out.push({ rule, kind, severity, title, detail: `${detail} Página: ${m.url}.`.slice(0, 2000) })
  if (m.rolagem)
    add(
      'responsivo/rolagem-horizontal',
      'responsive',
      'high',
      `Rolagem para o lado: ${at}`,
      `A página tem ${m.rolagem.pagina} px numa tela de ${m.rolagem.tela} px. Passam da borda: ${list(m.rolagem.culpados, (c) => `${who(c)} +${c.passa} px`)}. Use largura fluida (w-full, max-w), quebre colunas no celular ou role só dentro de uma caixa.`,
    )
  if (m.toque?.length)
    add(
      'responsivo/alvo-de-toque-pequeno',
      'responsive',
      'medium',
      `${m.toque.length === 1 ? '1 alvo de toque menor' : `${m.toque.length} alvos de toque menores`} que 44 px: ${at}`,
      `No celular, botões e links precisam de pelo menos 44×44 px para o dedo. Pequenos: ${list(m.toque, (t) => `${who(t)} ${t.w}×${t.h}`)}. Aumente a área clicável (padding ou min-h-11/min-w-11) sem mudar o desenho.`,
    )
  if (m.cortado?.length)
    add(
      'visual/texto-cortado',
      'visual',
      'medium',
      `Texto cortado sem reticências: ${at}`,
      `O fim do texto some (caixa com overflow escondido, sem "…"): ${list(m.cortado, who)}. Deixe quebrar a linha, use truncate (com reticências) ou aumente a caixa.`,
    )
  if (m.contraste?.length) {
    const worst = Math.min(...m.contraste.map((c) => c.razao))
    add(
      'acessibilidade/contraste-na-tela',
      'a11y',
      worst < 3 ? 'high' : 'medium',
      `Contraste baixo na tela (mínimo ${String(worst).replace('.', ',')}:1): ${at}`,
      `Medido na tela (cor do texto × fundo de verdade): ${list(m.contraste, (c) => `${who(c)} ${c.cor} sobre ${c.fundo} = ${String(c.razao).replace('.', ',')}:1 (precisa ${String(c.minimo).replace('.', ',')})`)}. Clareie o texto ou escureça o fundo.`,
    )
  }
  if (m.miudo?.length)
    add(
      'acessibilidade/texto-pequeno-na-tela',
      'a11y',
      'low',
      `Texto menor que 12 px: ${at}`,
      `Difícil de ler: ${list(m.miudo, (t) => `${who(t)} ${t.size} px`)}. Use no mínimo 12 px (ou registre no design.md se for proposital).`,
    )
  if (m.lento?.length)
    add(
      'movimento/transicao-lenta-na-tela',
      'motion',
      'low',
      `Transição de mais de 300 ms em elemento clicável: ${at}`,
      `A interface parece lenta: ${list(m.lento, (t) => `${who(t)} ${t.ms} ms (${t.curva})`)}. Use 150–250 ms com curva de saída.`,
    )
  if (m.borda?.length)
    add(
      'responsivo/texto-colado-na-borda',
      'responsive',
      'low',
      `Texto colado na borda da tela: ${at}`,
      `Menos de 12 px de respiro até a borda: ${list(m.borda, who)}. Dê padding lateral de pelo menos 16 px no celular.`,
    )
  return out
}
