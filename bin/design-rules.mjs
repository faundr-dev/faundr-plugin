// Regras de design sem IA (fase 2): identidade do app, responsivo, acessibilidade, contraste, movimento,
// conteúdo e consistência. Destiladas de anti-slop, impeccable, taste-skill, skills do Emil Kowalski e
// web-interface-guidelines da Vercel (docs/research/design-proposta.md). Só entra regra com padrão exato e
// pouca exceção; o resto fica para a auditoria com IA.
//
// Cada achado é um por arquivo por regra (com as linhas no detalhe) ou um por projeto. Exceção no código:
// comentário `faundr-ignore <regra>: motivo` na linha ou na anterior; `faundr-ignore-file <regra>` vale para o arquivo.

import { FLUTTER_RULES } from './design-flutter.mjs'
import { isNativeProject, NATIVE_RULES } from './design-native.mjs'
import { loadProject, parseColor, luminance, makeCollector } from './design-project.mjs'
import { TEXT, lineList } from './design-texts.mjs'
import { uiFileRules, nativeRules, dartFileRules, cssFileRules, headIdentityRules, headViewportRules, projectWideRules, grayRules, iconLibRules, contrastRules } from './design-checks.mjs'
export { ignoreSet, contrast } from './design-project.mjs'

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
