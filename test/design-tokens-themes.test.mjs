import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { contextTheme, selectorTheme } from '../bin/css-rules.mjs'
import { designExceptions, extractTokens } from '../bin/design-tokens.mjs'
import { lintProject, palette, uiFiles } from '../bin/design.mjs'
import { themeSupport } from '../bin/design-rules.mjs'
import { contrastRules } from '../bin/design-checks.mjs'
import { makeCollector } from '../bin/design-project.mjs'
import { fingerprint, replicaUsage, showcaseHashes, buildShowcase, collectCss } from '../bin/showcase.mjs'
import { setLang } from '../bin/i18n.mjs'

setLang('pt')

const proj = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-tokens-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

// O Faundr em miniatura: escuro no @theme, troca para o claro em :root[data-theme='light'] e um tema de marca
// para baixar em public/ (não é estilo do app).
const APP_CSS = `@import "tailwindcss";
@theme {
  --color-ink: #151515;
  --color-dim: #9b9b9b;
}
:root[data-theme='light'] {
  --color-ink: #eef1f2;
  --color-dim: #5b5f62;
  --color-white: #151515;
}
body { @apply bg-ink text-white; }
`
const BRAND_CSS = '@theme { --color-brand: #ff5a5f; --color-ink: #ff0000; }\n.dark { --color-brand: #000001; }'

test('tokens: só o CSS do app, valor do tema principal e alt do outro', () => {
  const dir = proj({
    'src/styles.css': APP_CSS,
    'src/routes/__root.tsx': "import appCss from '../styles.css?url'\nexport const x = appCss",
    'public/resources/design-md/airbnb/tailwind.css': BRAND_CSS,
    'extension/popup.css': ':root { --color-popup: #123456; }',
    'supabase/templates/invite.html': '<div style="color:#abcdef">oi</div>',
    // O tema padrão do Tailwind instalado: --color-white só existe ali (o claro troca o valor dele).
    'node_modules/tailwindcss/theme.css': '@theme { --color-white: #fff; }',
  })
  const t = extractTokens(dir, null)
  const byName = Object.fromEntries(t.colors.map((c) => [c.name, c]))
  assert.deepEqual(t.themes, { base: 'escuro', other: true })
  assert.equal(byName.ink.value, '#151515')
  assert.equal(byName.ink.alt, '#eef1f2')
  assert.equal(byName.dim.alt, '#5b5f62')
  assert.equal(byName.white.value, '#fff')
  assert.equal(byName.white.alt, '#151515')
  for (const name of ['brand', 'popup']) assert.ok(!byName[name], name)
  assert.ok(!t.colors.some((c) => /ff0000|ff5a5f|123456/i.test(`${c.value} ${c.alt ?? ''}`)))
})

test('tokens: sem import no código, a varredura pula public/, extension/ e o .faundrignore', () => {
  const dir = proj({
    'src/app.css': ':root { --color-ink: #ffffff; } .dark { --color-ink: #000000; }',
    'public/brand.css': ':root { --color-brand: #ff5a5f; }',
    'vendor/x.css': ':root { --color-vendor: #00ff00; }',
    '.faundrignore': 'vendor/\n',
  })
  const t = extractTokens(dir, null)
  assert.deepEqual(t.colors.map((c) => c.name), ['ink'])
  assert.deepEqual(t.themes, { base: 'claro', other: true })
  assert.equal(t.colors[0].alt, '#000000')
})

test('tokens: o tema do seletor e do @media', () => {
  assert.equal(selectorTheme(":root[data-theme='light']"), 'light')
  assert.equal(selectorTheme('html.dark'), 'dark')
  assert.equal(selectorTheme(':root, .light'), 'base')
  assert.equal(selectorTheme('.dark .card'), null)
  assert.equal(selectorTheme('.card'), null)
  assert.equal(contextTheme(['@media (prefers-color-scheme: dark)', ':root']), 'dark')
  assert.equal(contextTheme(['@media (min-width: 640px)', ':root']), null)
  assert.equal(contextTheme(['@theme']), 'base')
  assert.equal(contextTheme([':root', '@variant dark']), 'dark')
})

test('temas: com tokens.themes o Faundr é escuro com o claro', () => {
  const dir = proj({
    'src/styles.css': APP_CSS,
    'src/main.tsx': "import './styles.css'\nexport const App = () => <div className=\"bg-ink\">oi</div>",
  })
  const r = lintProject(dir)
  assert.equal(r.themes.base, 'escuro')
  assert.equal(r.themes.both, true)
  // E os sinais soltos não ganham dos tokens: claro principal pelo design.md, mas o CSS diz escuro.
  const s = themeSupport({ ui: [], css: [], head: [] }, { colors: [{ name: 'x', value: '#ffffff', usage: 'fundo' }], themes: { base: 'escuro', other: true } })
  assert.deepEqual([s.base, s.both], ['escuro', true])
})

test('paleta: hex de "Não faça" e depois de "nunca" não entra', () => {
  const dir = proj({
    'design.md': [
      '# Design',
      '',
      '## Cores',
      '',
      '| Token | Valor | Uso |',
      '|---|---|---|',
      '| `ink` | `#151515` | Fundo |',
      '',
      '## Princípios',
      '',
      '- Claro em branco gelo, nunca o branco puro `#ffffff`.',
      '- Texto: #eeeeee',
      '',
      '## Não faça',
      '',
      '- Fundo `#fff` ou `bg-neutral-50` (`#fafafa`).',
    ].join('\n'),
  })
  const p = palette(dir, 'design.md')
  assert.ok(p.has('#151515'))
  assert.ok(p.has('#eeeeee'))
  for (const hex of ['#ffffff', '#fafafa']) assert.ok(!p.has(hex), hex)
  // As menções do Tailwind também: neutral-50 só aparece no "Não faça".
  const t = extractTokens(dir, 'design.md')
  assert.ok(!t.colors.some((c) => c.name === 'neutral-50'))
})

test('e-mails: supabase/templates não é tela', () => {
  const dir = proj({
    'supabase/templates/invite.html': '<table width="600"><tr><td style="color:#123456">Convite</td></tr></table>',
    'src/App.tsx': 'export const App = () => <div>oi</div>',
  })
  assert.deepEqual(uiFiles(dir), ['src/App.tsx'])
  assert.ok(!lintProject(dir).findings.some((f) => /supabase\/templates/.test(f.file ?? '')))
})

test('contraste: texto e fundo do mesmo tema', () => {
  const tokens = {
    themes: { base: 'escuro', other: true },
    colors: [
      { name: 'ink', value: '#151515', alt: '#eef1f2', usage: 'Fundo de todas as telas' },
      { name: 'white', value: '#ffffff', alt: '#151515', usage: 'Texto principal' },
    ],
  }
  const c = makeCollector()
  contrastRules(c, { designMdPath: 'design.md', tokens, code: 'color-scheme: dark', headText: '' })
  // Branco sobre preto e preto sobre gelo passam; misturar os temas (branco sobre gelo) daria contraste baixo.
  assert.equal([...c.hits.values()].filter((h) => h.rule === 'acessibilidade/contraste-baixo').length, 0)
  const bad = { ...tokens, colors: [tokens.colors[0], { name: 'dim', value: '#9b9b9b', alt: '#dddddd', usage: 'Texto secundário' }] }
  const c2 = makeCollector()
  contrastRules(c2, { designMdPath: 'design.md', tokens: bad, code: 'color-scheme: dark', headText: '' })
  const hits = [...c2.hits.values()].filter((h) => h.rule === 'acessibilidade/contraste-baixo')
  assert.deepEqual(hits.map((h) => h.ctx.text), ['dim (tema claro)'])
})

test('vitrine: impressão digital só muda com o CSS que a réplica usa', () => {
  const css = (btn, other) => `@theme { --color-ink: #151515; --color-other: ${other}; }
@layer components {
  .f-btn { background: var(--color-ink); padding: ${btn}; }
  .f-card { border: 1px solid var(--color-other); }
}
`
  const dir = proj({ 'src/styles.css': css('4px', '#111111'), 'src/Button.tsx': 'export const Button = () => null' })
  const comp = { name: 'Botão', files: ['src/styles.css', 'src/Button.tsx'], variants: [{ name: 'Padrão', html: '<button class="f-btn hover:bg-ink">Ok</button>' }] }
  const usage = replicaUsage([comp])
  const before = fingerprint(dir, comp.files, usage)
  // Mudança fora do que o botão usa (outra classe e outra variável): igual.
  fs.writeFileSync(path.join(dir, 'src/styles.css'), css('4px', '#222222'))
  assert.equal(fingerprint(dir, comp.files, usage), before)
  // Mudança na classe que a réplica usa: muda.
  fs.writeFileSync(path.join(dir, 'src/styles.css'), css('8px', '#222222'))
  assert.notEqual(fingerprint(dir, comp.files, usage), before)
  // Mudança no token que a classe usa: muda.
  const mid = fingerprint(dir, comp.files, usage)
  fs.writeFileSync(path.join(dir, 'src/styles.css'), css('8px', '#222222').replace('#151515', '#161616'))
  assert.notEqual(fingerprint(dir, comp.files, usage), mid)
  // O componente (.tsx) conta inteiro; a chave do painel continua "arquivo1|arquivo2".
  const hashes = showcaseHashes(dir, { components: [comp] })
  assert.deepEqual(Object.keys(hashes), ['src/styles.css|src/Button.tsx'])
  assert.equal(buildShowcase(dir, { components: [comp] }).payload.components[0].fingerprint, hashes['src/styles.css|src/Button.tsx'])
})

test('vitrine: o CSS das réplicas não puxa os temas de marca de public/', () => {
  const dir = proj({
    'src/styles.css': APP_CSS,
    'src/main.tsx': "import './styles.css'",
    'public/resources/design-md/airbnb/tailwind.css': BRAND_CSS,
  })
  const { files, css } = collectCss(dir, 'tailwind4')
  assert.deepEqual(files, ['src/styles.css'])
  assert.ok(!/ff5a5f/.test(css))
  // O bloco do outro tema vai junto (o painel troca o data-theme do iframe).
  assert.match(css, /data-theme='light'/)
})

test('exceções: os tópicos de "Escopo e exceções" do design.md', () => {
  const md = [
    '# Design',
    '## Escopo e exceções',
    '',
    'Exceções decididas:',
    '',
    '- Cor nos bonecos — decisão do dono.',
    '* Travessão (—) — pontuação normal.',
    '',
    '## Não faça',
    '- Fundo branco.',
  ].join('\n')
  assert.deepEqual(designExceptions(md), ['Cor nos bonecos — decisão do dono.', 'Travessão (—) — pontuação normal.'])
  assert.deepEqual(designExceptions('# D\n## Scope and exceptions\n- ' + 'x'.repeat(400)), ['x'.repeat(300)])
  assert.deepEqual(designExceptions('# D\n## Cores\n- a'), [])
  const dir = proj({ 'design.md': md, 'src/App.tsx': 'export const A = () => <div>oi</div>' })
  assert.equal(lintProject(dir).exceptions.length, 2)
})

test('tokens: com git, o que está no .gitignore fica de fora', async () => {
  const { spawnSync } = await import('node:child_process')
  const dir = proj({
    '.gitignore': 'generated/\n',
    'src/app.css': ':root { --color-ink: #151515; }',
    'generated/theme.css': ':root { --color-gerada: #00ff00; }',
  })
  if (spawnSync('git', ['init', '-q'], { cwd: dir, windowsHide: true }).status !== 0) return // sem git na máquina
  const names = extractTokens(dir, null).colors.map((c) => c.name)
  assert.deepEqual(names, ['ink'])
})
