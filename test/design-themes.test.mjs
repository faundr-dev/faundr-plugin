import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { themeSupport } from '../bin/design-rules.mjs'
import { lintProject, measurePlan } from '../bin/design.mjs'
import { setLang } from '../bin/i18n.mjs'
import { measureFindings } from '../bin/measure-findings.mjs'

// Os achados saem na língua da pessoa: os testes fixam o português (e conferem o inglês onde muda).
setLang('pt')

const proj = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-tema-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}
const rules = (r) => r.findings.map((f) => f.rule)
const files = (ui = [], css = [], head = [], themeCode = []) => ({
  ui: ui.map((text) => ({ text })),
  css: css.map((text) => ({ text })),
  head: head.map((text) => ({ text })),
  themeCode: themeCode.map((text) => ({ text })),
})
const darkTokens = { colors: [{ name: 'Fundo', value: '#151515', usage: 'fundo da página' }] }

test('tema: um tema só não conta como dois', () => {
  const t = themeSupport(files(['<div className="bg-black text-white font-light">'], [':root { color-scheme: dark }']), darkTokens)
  assert.deepEqual(t, { base: 'escuro', both: false, followsSystem: false })
})

test('tema: dark: do Tailwind = claro com escuro, seguindo o sistema', () => {
  const t = themeSupport(files(['<div className="bg-white dark:bg-black">']), null)
  assert.equal(t.base, 'claro')
  assert.equal(t.both, true)
  assert.equal(t.followsSystem, true)
})

test('tema: dark: com @custom-variant e sem prefers-color-scheme não segue o sistema', () => {
  const t = themeSupport(files(['<div className="bg-white dark:bg-black">'], ['@custom-variant dark (&:where(.dark, .dark *));']), null)
  assert.equal(t.both, true)
  assert.equal(t.followsSystem, false)
})

test('tema: escuro principal com [data-theme=light] e matchMedia no arquivo de tema', () => {
  const css = [":root[data-theme='light'] { --bg: white }"]
  const sem = themeSupport(files([], css), darkTokens)
  assert.deepEqual(sem, { base: 'escuro', both: true, followsSystem: false })
  const com = themeSupport(files([], css, [], ["matchMedia('(prefers-color-scheme: light)')"]), darkTokens)
  assert.equal(com.followsSystem, true)
})

test('regras: dois temas sem seguir o sistema e theme-color único', () => {
  const dir = proj({
    'index.html': '<html lang="pt-BR"><head><title>App</title><meta name="theme-color" content="#ffffff"></head></html>',
    'src/styles.css': '@custom-variant dark (&:where(.dark, .dark *));',
    'src/App.tsx': 'export const App = () => <div className="bg-white dark:bg-neutral-900">oi</div>',
  })
  const r = lintProject(dir)
  assert.equal(r.themes.both, true)
  assert.ok(rules(r).includes('design/tema-nao-segue-sistema'))
  assert.ok(rules(r).includes('identidade/theme-color-unico'))
})

test('regras: theme-color com media por tema não vira achado', () => {
  const dir = proj({
    'index.html':
      '<html lang="pt-BR"><head><title>App</title><meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000"></head></html>',
    'src/App.tsx': 'export const App = () => <div className="bg-white dark:bg-neutral-900">oi</div>',
  })
  const r = lintProject(dir)
  assert.ok(!rules(r).includes('identidade/theme-color-unico'))
  assert.ok(!rules(r).includes('design/tema-nao-segue-sistema'))
})

test('regras: um tema só não ganha regra de dois temas', () => {
  const dir = proj({
    'index.html': '<html lang="pt-BR"><head><title>App</title><meta name="theme-color" content="#000000"></head></html>',
    'design.md': '# Design\n\n- Fundo: #151515\n',
    'src/App.tsx': 'export const App = () => <div className="bg-[#151515] text-white">oi</div>',
  })
  const r = lintProject(dir)
  assert.equal(r.themes.both, false)
  for (const rule of ['design/tema-nao-segue-sistema', 'identidade/theme-color-unico', 'design/cor-fixa-sem-tema'])
    assert.ok(!rules(r).includes(rule), rule)
})

test('regras: cor da paleta fixa num app de dois temas, menos com variante ou reserva de variável', () => {
  const dir = proj({
    'design.md': '# Design\n\n- Fundo: #151515\n- Texto: #ffffff\n',
    'src/App.tsx': [
      'export const App = () => (',
      '  <main className="bg-white dark:bg-black">',
      '    <div className="bg-[#151515]">fixo</div>',
      '    <div className="bg-[#151515] dark:bg-[#ffffff]">com variante</div>',
      "    <canvas style={{ background: 'var(--fundo, #151515)' }} />",
      '  </main>',
      ')',
    ].join('\n'),
  })
  const r = lintProject(dir)
  const hit = r.findings.find((f) => f.rule === 'design/cor-fixa-sem-tema')
  assert.ok(hit)
  assert.equal(hit.line, 3)
  assert.match(hit.detail, /Linhas: 3\./)
  setLang('en')
  try {
    const en = lintProject(dir).findings.find((f) => f.rule === 'design/cor-fixa-sem-tema')
    assert.match(en.title, /fixed color that does not change with the theme/i)
    assert.match(en.detail, /Lines: 3\./)
  } finally {
    setLang('pt')
  }
})

test('plano de medição: escopo, detecção e larguras', () => {
  const W = [375, 768, 1024, 1440]
  assert.deepEqual(measurePlan('escuro', { base: 'claro', both: true }, W), { themes: [{ tema: 'escuro', widths: W }] })
  const ambos = measurePlan('ambos', { base: 'escuro', both: true }, W)
  assert.deepEqual(ambos.themes, [
    { tema: 'escuro', widths: W },
    { tema: 'claro', widths: [375, 1440] },
  ])
  assert.equal(ambos.hint, null)
  const semEscopo = measurePlan(null, { base: 'claro', both: true }, W)
  assert.deepEqual(semEscopo.themes.map((t) => t.tema), ['claro', 'escuro'])
  assert.match(semEscopo.hint, /design-scope --theme ambos/)
  assert.deepEqual(measurePlan(null, { base: 'claro', both: false }, W), { themes: [{ tema: null, widths: W }] })
  // Só no computador: o segundo tema fica na maior largura.
  assert.deepEqual(measurePlan('ambos', { base: 'escuro' }, [1024, 1440]).themes[1], { tema: 'claro', widths: [1024, 1440] })
})

test('medição com tema: o tema vai no título do achado', () => {
  const [f] = measureFindings(
    { url: '/app', largura: 375, tema: 'claro', contraste: [{ el: 'p', cor: '#aaa', fundo: '#fff', razao: 2.3, minimo: 4.5 }] },
    'Projetos',
    'pt',
  )
  assert.match(f.title, /Projetos em 375 px \(tema claro\)/)
  assert.match(f.title, /mínimo 2,3:1/)
  const [en] = measureFindings(
    { url: '/app', largura: 375, tema: 'claro', contraste: [{ el: 'p', cor: '#aaa', fundo: '#fff', razao: 2.3, minimo: 4.5 }] },
    'Projects',
    'en',
  )
  assert.equal(en.title, 'Low contrast on screen (lowest 2.3:1): Projects at 375 px (light theme)')
  assert.match(en.detail, /Page: \/app\.$/)
})
