// Força o tema claro ou escuro numa página aberta num iframe (o script de medição com --url embute este arquivo).
// Cobre as formas comuns de fazer tema: atributo data-theme/data-mode, classe dark/light no <html> e as regras
// @media (prefers-color-scheme) do CSS, que viram "sempre" para o tema pedido e "nunca" para o outro. Não toca no
// localStorage (é o mesmo do site aberto na aba: mudaria a escolha da pessoa). Se pegou, quem confere é o script de
// medição, pelo fundo da tela.
;(doc, tema) => {
  const en = tema === 'claro' ? 'light' : 'dark'
  const op = en === 'light' ? 'dark' : 'light'
  const h = doc.documentElement
  h.dataset.theme = en
  if (h.dataset.mode !== undefined) h.dataset.mode = en
  if (h.dataset.colorScheme !== undefined) h.dataset.colorScheme = en
  h.classList.remove(op)
  h.classList.add(en)
  h.style.colorScheme = en
  const flip = (text) =>
    text.replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/g, (_, s) => (s === en ? '(min-width: 0px)' : '(max-width: 0px)'))
  const walk = (rules) => {
    for (const r of rules) {
      if (r.media && /prefers-color-scheme/.test(r.media.mediaText)) r.media.mediaText = flip(r.media.mediaText)
      if (r.cssRules) walk(r.cssRules)
    }
  }
  for (const s of doc.styleSheets) {
    try {
      walk(s.cssRules)
    } catch {}
  }
  for (const m of doc.querySelectorAll('link[rel=stylesheet][media*="prefers-color-scheme"], style[media*="prefers-color-scheme"]'))
    m.media = flip(m.media)
}
