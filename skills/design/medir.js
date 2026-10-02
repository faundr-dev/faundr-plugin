// Medição de design do Faundr: roda na página aberta (Claude in Chrome → javascript_tool), na largura atual da
// janela, e devolve um JSON com números objetivos. Não muda nada na página. Limiares: piso de qualidade (piso.md).
;(() => {
  const W = window.innerWidth
  const mobile = W < 768
  const all = [...document.querySelectorAll('body *')].slice(0, 6000)

  const visible = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const describe = (el) => {
    let s = el.tagName.toLowerCase()
    if (el.id) return `${s}#${el.id}`
    const cls = [...el.classList].filter((c) => !/[[\]:/]/.test(c)).slice(0, 3)
    if (cls.length) s += '.' + cls.join('.')
    return s
  }
  const label = (el) =>
    (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 30)

  // Qualquer cor CSS (rgb, oklch, color()) → [r, g, b, a] desenhando 1 pixel.
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  const rgba = (c) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255]
  }
  const lum = ([r, g, b]) =>
    [r, g, b].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0)
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const hex = ([r, g, b]) => '#' + [r, g, b].map((n) => Math.round(n * 255).toString(16).padStart(2, '0')).join('')
  // Fundo de verdade: sobe pelos pais somando camadas até ficar opaco (imagem/degradê = não dá para calcular).
  const backgroundOf = (el) => {
    const layers = []
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage && s.backgroundImage !== 'none') return null
      const c = rgba(s.backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] >= 0.99) break
    }
    let out = [1, 1, 1]
    for (const c of layers.reverse()) out = out.map((v, i) => v * (1 - c[3]) + c[i] * c[3])
    return out
  }

  // 1. Rolagem para o lado: quem passa da borda (sem estar dentro de uma caixa que rola ou corta).
  const docW = document.documentElement.scrollWidth
  const clipsX = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX
      if (o !== 'visible') return true
    }
    return false
  }
  const overflowing = all.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.right > W + 1 && r.width > 0 && visible(el) && !clipsX(el)
  })
  const culprits = overflowing
    .filter((el) => !overflowing.includes(el.parentElement))
    .slice(0, 5)
    .map((el) => ({ el: describe(el), text: label(el), passa: Math.round(el.getBoundingClientRect().right - W) }))

  // 2. Alvos de toque pequenos (no celular): 44×44. Link no meio de um texto é exceção.
  const touch = mobile
    ? [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[tabindex]:not([tabindex="-1"])')]
        .filter((el) => visible(el))
        .filter((el) => !(el.tagName === 'A' && getComputedStyle(el).display === 'inline' && /^(P|LI|SPAN|TD)$/.test(el.parentElement?.tagName ?? '')))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .slice(0, 8)
        .map(({ el, r }) => ({ el: describe(el), text: label(el), w: Math.round(r.width), h: Math.round(r.height) }))
    : []

  // 3. Texto cortado sem reticências (overflow escondendo o fim do texto).
  const clipped = all
    .filter((el) => {
      if (!el.innerText || el.children.length > 3 || !visible(el)) return false
      const s = getComputedStyle(el)
      if (!/hidden|clip/.test(s.overflowX + s.overflowY) || s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') return false
      return el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2
    })
    .slice(0, 5)
    .map((el) => ({ el: describe(el), text: label(el) }))

  // 4. Contraste real e texto pequeno: elementos com texto próprio.
  const contrast = []
  const tiny = []
  const seen = new Set()
  for (const el of all) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!own || !visible(el)) continue
    const s = getComputedStyle(el)
    const size = parseFloat(s.fontSize)
    if (size < 12 && tiny.length < 5) tiny.push({ el: describe(el), text: label(el), size })
    const fg = rgba(s.color)
    const bg = backgroundOf(el)
    if (!bg || fg[3] < 0.5) continue
    const shown = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]))
    const r = ratio(shown, bg)
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
    const min = large ? 3 : 4.5
    if (r >= min) continue
    const key = `${hex(shown)}|${hex(bg)}|${Math.round(size)}`
    if (seen.has(key) || contrast.length >= 6) continue
    seen.add(key)
    contrast.push({ el: describe(el), text: label(el), cor: hex(shown), fundo: hex(bg), razao: Math.round(r * 100) / 100, minimo: min, tamanho: size })
  }

  // 5. Transições lentas em elementos clicáveis (acima de 300 ms).
  const slow = []
  for (const el of document.querySelectorAll('a,button,[role=button],input,select,textarea,summary')) {
    const s = getComputedStyle(el)
    const longest = Math.max(...s.transitionDuration.split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000)))
    if (longest > 300 && slow.length < 5) slow.push({ el: describe(el), text: label(el), ms: Math.round(longest), curva: s.transitionTimingFunction.split(',')[0] })
  }

  // 6. Texto colado na borda da tela (celular): menos de 12 px de respiro.
  const edge = mobile
    ? all
        .filter((el) => /^(P|H1|H2|H3|H4|LI|LABEL)$/.test(el.tagName) && visible(el) && el.innerText?.trim())
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.left < 12 || r.right > W - 12
        })
        .slice(0, 5)
        .map((el) => ({ el: describe(el), text: label(el) }))
    : []

  return JSON.stringify({
    url: location.pathname + location.search,
    largura: W,
    rolagem: docW > W + 1 ? { pagina: docW, tela: W, culpados: culprits } : null,
    toque: touch,
    cortado: clipped,
    contraste: contrast,
    miudo: tiny,
    lento: slow,
    borda: edge,
  })
})()
