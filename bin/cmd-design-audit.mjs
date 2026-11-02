// Design, parte 2 (auditoria completa): faundr design-measure-script, design-measure-save, design-coverage,
// design-scope, design-resolve e design-show (com a ordem de correção dos achados).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { measurePlan, projectThemes } from './design.mjs'
import { measureFindings } from './measure-findings.mjs'
import { lang } from './i18n.mjs'
import { flag, linkedProject, textArg } from './cli-core.mjs'
import { ARCHIVE_REASON_LABEL, designApi, KIND_LABEL, SCOPE_LABEL, scopeLines } from './cmd-design.mjs'

// Medição no navegador (fase 4): o script roda na página; o resultado vira achados por tela e largura.
const MEASURE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'design', 'medir.js')
const THEME_SCRIPT = path.join(path.dirname(MEASURE_SCRIPT), 'tema.js')

/**
 * Sem --url: o script que mede a página na largura atual da janela.
 * Com --url: um script para rodar em qualquer página do mesmo site, que abre a tela num iframe invisível em cada
 * largura (375/768/1024/1440 por padrão), mede lá dentro e devolve uma lista — não depende de redimensionar a janela.
 * Com tema claro e escuro (escopo "ambos", ou o código mostra os dois), força cada tema: o principal em todas as
 * larguras e o outro só na menor e na maior. --themes claro,escuro escolhe na mão (o primeiro é o principal).
 */
export async function designMeasureScript(args) {
  const code = fs.readFileSync(MEASURE_SCRIPT, 'utf8')
  const url = flag(args, '--url')
  if (!url) return console.log(code)
  const widths = (flag(args, '--widths') ?? '375,768,1024,1440')
    .split(',')
    .map(Number)
    .filter((w) => w >= 200 && w <= 4000)
  const { root } = linkedProject()
  let scopeTheme = null
  try {
    scopeTheme = (await designApi({ action: 'scope' })).scope?.theme ?? null
  } catch {
    // Sem rede ou painel fora do ar: segue sem o tema do escopo (vale o --themes ou o padrão).
  }
  const manual = flag(args, '--themes')
    ?.split(',')
    .map((t) => t.trim())
    .filter((t) => t === 'claro' || t === 'escuro')
  const plan = manual?.length
    ? { themes: manual.map((tema, i) => ({ tema, widths: i === 0 ? widths : measurePlan('ambos', { base: manual[0] }, widths).themes[1].widths })) }
    : measurePlan(scopeTheme, projectThemes(root), widths)
  const runs = plan.themes.flatMap((t) => t.widths.map((w) => ({ w, tema: t.tema })))
  const header = [
    `// Themes: ${plan.themes.map((t) => (t.tema ? `${t.tema} at ${t.widths.join(', ')} px` : `as the screen opens, at ${t.widths.join(', ')} px`)).join('; ')}.`,
    ...(plan.hint ? [`// ${plan.hint}`] : []),
  ].join('\n')
  console.log(`${header}
(async () => {
  const code = ${JSON.stringify(code)}
  const tema = ${JSON.stringify(fs.readFileSync(THEME_SCRIPT, 'utf8'))}
  // Fundo da página: o do body ou do html; se os dois forem transparentes, o de quem cobre o canto de baixo (subindo
  // pelos pais até achar cor opaca). O meio da tela não serve: cai em ícone, botão ou card. 0 = preto, 1 = branco.
  const fundo = (win, doc) => {
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
    const lum = (n) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = win.getComputedStyle(n).backgroundColor
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return a > 200 ? (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 : null
    }
    for (const n of [doc.body, doc.documentElement]) { const l = n && lum(n); if (l != null) return l }
    for (let n = doc.elementFromPoint(win.innerWidth - 4, win.innerHeight - 4); n && n.nodeType === 1; n = n.parentElement) { const l = lum(n); if (l != null) return l }
    return 1
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const name = (el) => (el.getAttribute('aria-label') || el.innerText || '').trim().split('\\n')[0].slice(0, 30)
  const shown = (win, el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && win.getComputedStyle(el).visibility !== 'hidden' }
  // Painel aberto por cima da tela (drawer, painel lateral): fixo e cobrindo boa parte da largura.
  const panels = (win, doc) => [...doc.querySelectorAll('body *')].filter((el) => {
    if (win.getComputedStyle(el).position !== 'fixed' || !shown(win, el)) return false
    const r = el.getBoundingClientRect()
    return r.width >= win.innerWidth * 0.6 && r.height >= win.innerHeight * 0.5
  })
  const states = async (f, w, t) => {
    const win = f.contentWindow, doc = f.contentDocument, found = []
    const measure = (estado) => ({ ...JSON.parse(win.eval(code)), largura: w, estado, ...(t && { tema: t }) })
    // Abas da tela: botões de alternar ou role=tab dentro de um cabeçalho fixo (o segundo header).
    const tabs = () => [...doc.querySelectorAll('[aria-pressed], [role=tab]')].filter((b) => shown(win, b) && b.closest('[role=tablist], header, .sticky, [class*=sticky]'))
    const first = tabs().slice(0, 9).map(name)
    for (const label of first.slice(1)) {
      const b = tabs().find((x) => name(x) === label)
      if (!b) continue
      b.click()
      await wait(1800)
      try { found.push(measure('aba ' + label)) } catch {}
    }
    const again = tabs().find((x) => name(x) === first[0])
    if (again) { again.click(); await wait(1500) }
    // Um item aberto: o primeiro da lista da tela. Com um painel por cima, o menu ☰ tem que abrir acima dele.
    const before = new Set(panels(win, doc))
    const item = [...doc.querySelectorAll('main li button, main li a[href], main [role=row], main article button')].find((el) => shown(win, el))
    if (!item) return found
    item.click()
    await wait(1800)
    const panel = panels(win, doc).find((el) => !before.has(el))
    try { found.push(measure('item aberto')) } catch {}
    const toggle = [...doc.querySelectorAll('button[aria-expanded]')].find((b) => shown(win, b) && b.getBoundingClientRect().top < 80 && /menu/i.test(b.getAttribute('aria-label') || ''))
    if (panel && toggle) {
      toggle.click()
      await wait(500)
      const nav = [...doc.querySelectorAll('nav, aside')].find((el) => shown(win, el) && el.getBoundingClientRect().left <= 1 && !before.has(el))
      if (nav) {
        const r = nav.getBoundingClientRect()
        const top = doc.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 200))
        if (top && !nav.contains(top)) found[found.length - 1] = { ...found[found.length - 1], menuPorBaixo: { el: panel.tagName.toLowerCase() + (panel.getAttribute('role') ? '[role=' + panel.getAttribute('role') + ']' : ''), text: name(panel) } }
      }
      toggle.click()
    }
    return found
  }
  const out = []
  for (const { w, tema: t } of ${JSON.stringify(runs)}) {
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;left:-20000px;top:0;height:900px;border:0;width:' + w + 'px'
    document.body.appendChild(f)
    await new Promise((r) => { f.onload = r; f.src = ${JSON.stringify(url)} })
    await new Promise((r) => setTimeout(r, 3500))
    try {
      if (t) {
        f.contentWindow.eval(tema)(f.contentDocument, t)
        await new Promise((r) => setTimeout(r, 800))
        const lum = fundo(f.contentWindow, f.contentDocument)
        if ((t === 'claro' && lum < 0.4) || (t === 'escuro' && lum > 0.6)) {
          out.push({ largura: w, tema: t, erro: 'could not switch the screen to the ' + t + ' theme (the background stayed ' + (lum < 0.4 ? 'dark' : 'light') + ')' })
          f.remove()
          continue
        }
      }
      const res = JSON.parse(f.contentWindow.eval(code))
      out.push({ ...res, largura: w, areaUtil: res.largura, ...(t && { tema: t }) })
      // No celular, mede também o que só aparece depois de um toque: as outras abas da tela e um item aberto.
      if (w < 768 && (t ?? null) === ${JSON.stringify(runs[0]?.tema ?? null)}) out.push(...(await states(f, w, t)))
    } catch (e) { out.push({ largura: w, ...(t && { tema: t }), erro: String(e) }) }
    f.remove()
  }
  // O resultado completo fica na página (a resposta da ferramenta é curta): pegue uma medição por vez.
  window.__faundrMedicao = out
  return out
    .map((m, i) => { const at = \`[\${i}] \${m.largura} px\${m.tema ? ' ' + m.tema : ''}\${m.estado ? ' (' + m.estado + ')' : ''}\`; return m.erro ? \`\${at}: failed (\${m.erro})\` : \`\${at}: \${m.rolagem ? 'SCROLLS SIDEWAYS, ' : ''}\${m.toque.length} touch, \${m.cortado.length} cut off, \${m.contraste.length} contrast, \${m.miudo.length} tiny, \${m.lento.length} slow, \${m.borda.length} edge, \${m.espremido?.length ?? 0} squeezed\${m.menuPorBaixo ? ', MENU BEHIND PANEL' : ''}\` })
    .join(' | ') + ' — to save each one: JSON.stringify(window.__faundrMedicao[i])'
})()`)
}

export async function designMeasureSave(args) {
  const { root } = linkedProject()
  const screen = flag(args, '--screen')
  const file = flag(args, '--file')
  if (!screen || !file)
    throw new Error('usage: faundr design-measure-save --screen "<screen name>" --width <375|768|1024|1440> --file <result.json>  (the JSON the measurement script returned)')
  let data
  try {
    const raw = fs.readFileSync(path.resolve(root, file), 'utf8').trim()
    data = JSON.parse(raw.startsWith('"') ? JSON.parse(raw) : raw)
  } catch (err) {
    throw new Error(`Could not read the measurement result: ${err.message}`)
  }
  // Uma medição (janela atual) ou a lista do script com --url (uma por largura).
  for (const m of Array.isArray(data) ? data : [data]) await saveMeasure(m, screen, args)
}

// Uma medição: manda os problemas da tela naquela largura (e tema) e conta o que mudou.
async function saveMeasure(m, screen, args) {
  const tema = m?.tema === 'claro' || m?.tema === 'escuro' ? m.tema : undefined
  // Estado medido depois de um toque (outra aba, item aberto) vira uma tela própria: "Qualidade → aba Por arquivo".
  if (m?.estado) screen = `${screen} → ${m.estado}`
  const at = `${screen} at ${m?.largura} px${tema ? ` (${tema} theme)` : ''}`
  if (m?.erro) return console.log(`${at}: the measurement failed (${m.erro})`)
  if (!Number.isInteger(m?.largura)) throw new Error('The file does not look like the result of the measurement script ("largura" is missing).')
  // A largura pedida (375, 768, 1024, 1440) é a coluna da matriz.
  const width = Number(flag(args, '--width')) || m.largura
  const findings = measureFindings({ ...m, largura: width }, screen, lang())
  let r
  try {
    r = await designApi({ action: 'measure', screen, url: m.url, viewport: width, ...(tema && { appearance: tema }), findings })
  } catch (err) {
    // Tema fora do escopo (ex.: escopo só escuro): avisa e segue com as outras medições.
    return console.log(`${at}: ${err.message}`)
  }
  const parts = [`${screen} at ${width} px${tema ? ` (${tema} theme)` : ''}: ${findings.length ? `${findings.length} problem(s)` : 'no problems measured'}`]
  if (r.added) parts.push(`${r.added} new`)
  if (r.resolved) parts.push(`${r.resolved} resolved since the last measurement`)
  if (r.skipped) parts.push(`${r.skipped} from turned-off rules`)
  console.log(parts.join(' · '))
  for (const f of r.findings ?? []) console.log(`  D-${f.ref} ${f.title}`)
}

const COVERAGE_LABEL = { passou: 'passed', falhou: 'failed', parcial: 'partial', 'nao-verificado': 'not checked' }
const HOW_LABEL = { codigo: 'from the code', navegador: 'in the browser', aparelho: 'on a device' }

export function coverageLines(coverage) {
  const themes = Object.entries(coverage?.themes ?? {})
  if (!themes.length) return ['- (no full audit recorded yet)']
  const out = themes.map(
    ([theme, c]) =>
      `- ${theme}: ${COVERAGE_LABEL[c.result] ?? c.result}${c.how ? ` ${HOW_LABEL[c.how]}` : ''}${typeof c.score === 'number' ? `, score ${c.score}/4` : ''} (${c.at?.slice(0, 10)})${c.note ? ` — ${c.note}` : ''}`,
  )
  const history = coverage?.history ?? []
  if (history.length > 1) {
    const sum = (h) => Object.values(h.scores).reduce((s, n) => s + n, 0)
    out.push(`- total score trend: ${history.slice(-5).map(sum).join(' → ')}`)
  }
  return out
}

// Cobertura da auditoria completa: o que foi verificado, como e com que nota (um tema por chamada; --finish fecha).
export async function designCoverage(args) {
  const theme = flag(args, '--theme')
  const finish = args.includes('--finish')
  if (!theme && !finish) {
    const { design } = await designApi({ action: 'list' })
    return console.log(['Design coverage:', ...coverageLines(design?.coverage)].join('\n'))
  }
  if (theme && !flag(args, '--result'))
    throw new Error(
      'usage: faundr design-coverage --theme responsivo|acessibilidade|movimento|conteudo|identidade|design|visual --result passou|falhou|parcial|nao-verificado [--how codigo|navegador|aparelho] [--score 0-4] [--note "..."]  ·  faundr design-coverage --finish\n  (--result: passou = passed, falhou = failed, parcial = partial, nao-verificado = not checked; --how: codigo = code, navegador = browser, aparelho = device)',
    )
  const score = flag(args, '--score')
  const r = await designApi({
    action: 'coverage',
    theme,
    result: flag(args, '--result'),
    how: flag(args, '--how'),
    score: score === undefined ? undefined : Number(score),
    note: flag(args, '--note'),
    finish,
  })
  console.log(finish ? 'Audit closed. Coverage:' : `Coverage of ${theme} recorded.`)
  if (finish) console.log(coverageLines(r).join('\n'))
}

// Escopo do design: sem flags mostra; --product/--mobile/--theme/--motion mudam; --disable/--enable ligam e desligam regras.
export async function designScope(args) {
  const scope = {}
  for (const k of Object.keys(SCOPE_LABEL)) {
    const v = flag(args, `--${k}`)
    if (v) scope[k] = v
  }
  const exception = flag(args, '--exception')
  const list = (name) => flag(args, name)?.split(',').map((r) => r.trim()).filter(Boolean)
  const current = await designApi({ action: 'scope' })
  if (exception) scope.exceptions = [...(current.scope?.exceptions ?? []), exception]
  const disable = list('--disable')
  const enable = list('--enable')
  const changing = Object.keys(scope).length || disable?.length || enable?.length
  const r = changing ? await designApi({ action: 'scope', scope: Object.keys(scope).length ? scope : undefined, disable, enable }) : current
  console.log(changing ? 'Design scope updated:' : 'Design scope:')
  console.log(scopeLines(r).join('\n'))
  if (r.archived) console.log(`${r.archived} open finding(s) from the turned-off rules were archived.`)
  if (!changing)
    console.log(
      '\nTo change it: faundr design-scope --mobile sim|desktop|celular --product app|site|misto --theme escuro|claro|ambos --motion nenhum|sobrio|expressivo --exception "technique — reason" --disable responsivo/largura-fixa --enable responsivo',
    )
}

export async function designResolve(args) {
  const text = textArg(args)
  if (!text) {
    const { findings } = await designApi({ action: 'list' })
    if (!findings.length) return console.log('No open design findings.')
    console.log('Open design findings:')
    for (const f of findings) console.log(`  D-${f.ref}  [${KIND_LABEL[f.kind]} · ${f.rule}] ${f.title}${f.file ? ` — ${f.file}` : ''}`)
    return console.log('To resolve: faundr design-resolve D-<n>. To archive (does not apply to the project): faundr design-archive D-<n> --reason … --note "…"')
  }
  const r = await designApi({ action: 'resolve', query: text })
  console.log(`Finding D-${r.ref} resolved: ${r.title}`)
}

const ORIGIN_LABEL = { lint: 'automatic check', audit: 'AI audit', manual: 'reported by the person' }

// Ordem de correção: o que quebra o uso ou a acessibilidade → estados → responsivo e fluxo → desvio do design.md → polimento.
const FIX_STAGE = (f) => {
  if (f.severity === 'high') return 1
  if (f.kind === 'content') return 2
  if (['responsive', 'a11y', 'visual', 'practice'].includes(f.kind) && f.severity === 'medium') return 3
  if (f.severity === 'low') return 5
  return 4
}
const FIX_STAGE_LABEL = {
  1: 'Breaks use or accessibility',
  2: 'States and content',
  3: 'Responsive and flow',
  4: 'Deviation from design.md',
  5: 'Polish',
}

async function designFixOrder() {
  const { findings } = await designApi({ action: 'list' })
  if (!findings.length) return console.log('No open design findings.')
  const ordered = [...findings].sort((a, b) => FIX_STAGE(a) - FIX_STAGE(b) || a.ref - b.ref)
  console.log(`NO NUMBER: fix the ${ordered.length} open findings in this order, one at a time.`)
  let stage = 0
  for (const f of ordered) {
    if (FIX_STAGE(f) !== stage) {
      stage = FIX_STAGE(f)
      console.log(`\n${stage}. ${FIX_STAGE_LABEL[stage]}`)
    }
    console.log(`  D-${f.ref} [${KIND_LABEL[f.kind]} · ${f.severity}] ${f.title}${f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : ''}`)
  }
}

// Situação do achado de design, quando não está aberto.
function designState(f) {
  if (f.status === 'resolved') return ' — ALREADY RESOLVED'
  if (f.status !== 'archived') return ''
  return ` — ARCHIVED (${ARCHIVE_REASON_LABEL[f.archive_reason] ?? f.archive_reason}${f.archive_note ? `: ${f.archive_note}` : ''})`
}

export async function designShow(args) {
  const text = textArg(args)
  if (!text) return designFixOrder()
  const f = await designApi({ action: 'get', query: text })
  const state = designState(f)
  console.log(`D-${f.ref} [${KIND_LABEL[f.kind]}, rule ${f.rule}, severity ${f.severity}, ${ORIGIN_LABEL[f.origin]}]${state}`)
  console.log(f.title)
  if (f.file) console.log(`File: ${f.file}${f.line ? `:${f.line}` : ''}`)
  if (f.detail) console.log(`\n${f.detail}`)
}
