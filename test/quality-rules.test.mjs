// Cada regra de qualidade com um exemplo ruim (tem que achar) e um bom (não pode achar).
// Rodar: node --test plugin/test
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { analyzeQuality } from '../dist/graph.mjs'
import { runQuality } from '../bin/quality-rules.mjs'

const rules = async (code, file = 'a.ts', opts) => (await analyzeQuality(file, code, opts)).hits.map((h) => h.rule)
const branches = (n) => Array.from({ length: n }, (_, i) => `  if (x === ${i}) return ${i}`).join('\n')

const CASES = [
  ['falha/catch-vazio', 'try { a() } catch {}', 'try { a() } catch { /* arquivo pode não existir */ }'],
  ['falha/catch-vazio', 'p.catch(() => {})', 'p.catch((e) => avisar(e))'],
  ['falha/catch-so-loga', 'try { a() } catch (e) { console.error(e) }', 'try { a() } catch (e) { console.error(e); throw e }'],
  ['falha/catch-devolve-nulo', 'function f() { try { return a() } catch { return null } }', 'function f() { try { return a() } catch (e) { log(e); return null } }'],
  ['falha/mock-em-producao', "import { users } from './mocks/users'", "import { users } from './api/users'"],
  ['tipos/any', 'let x: any = 1', 'let x: unknown = 1'],
  ['tipos/as-any', 'const y = x as any', 'const y = x as Foo'],
  ['tipos/ts-ignore-sem-motivo', '// @ts-ignore\nlet a = 1', '// @ts-expect-error a biblioteca não exporta o tipo\nlet a = 1'],
  ['tipos/eslint-disable-sem-motivo', '// eslint-disable-next-line no-console\nlet a = 1', '// eslint-disable-next-line no-console -- CLI escreve no terminal\nlet a = 1'],
  ['tipos/non-null-em-excesso', Array.from({ length: 10 }, (_, i) => `a${i}!.b`).join('\n'), 'a!.b\nc!.d'],
  ['complexidade/funcao', `function f(x) {\n${branches(21)}\n}`, `function f(x) {\n${branches(10)}\n}`],
  ['complexidade/funcao-longa', `function f() {\n${'  a()\n'.repeat(150)}}`, `function f() {\n${'  a()\n'.repeat(20)}}`],
  ['complexidade/aninhamento', 'function f() { if (a) { for (;;) { while (b) { if (c) { if (d) { e() } } } } } }', 'function f() { if (!a) return; if (b) e(); else if (c) g(); else if (d) h() }'],
  ['complexidade/ternario-aninhado', 'const v = a ? 1 : b ? 2 : 3', 'const v = a ? 1 : 2'],
  ['demais/codigo-comentado', 'let a = 1\n// const b = 2\n// if (a) {\n//   b = 3\n// }\nlet c = 4', '// Explica o que vem a seguir\n// em duas linhas de texto\n// e mais esta aqui\n// e a última\nlet a = 1'],
  ['limpeza/debugger', 'function f() { debugger }', 'function f() { return 1 }'],
  ['limpeza/console-log', 'console.log(1)', 'console.error(1)'],
]

for (const [rule, bad, good] of CASES)
  test(rule, async () => {
    assert.ok((await rules(bad)).includes(rule), `deveria achar em: ${bad}`)
    assert.ok(!(await rules(good)).includes(rule), `não deveria achar em: ${good}`)
  })

test('testes/only e testes/pulado só em arquivo de teste', async () => {
  assert.deepEqual(await rules("it.only('x', () => {})", 'a.test.ts', { test: true }), ['testes/only'])
  assert.deepEqual(await rules("it.skip('x', () => {})", 'a.test.ts', { test: true }), ['testes/pulado'])
  assert.deepEqual(await rules("it('x', () => { expect(1).toBe(1) })", 'a.test.ts', { test: true }), [])
})

test('testes sem conferência e com espera fixa', async () => {
  const t = (code) => rules(code, 'a.test.ts', { test: true })
  assert.deepEqual(await t("it('soma', () => { soma(1, 2) })"), ['testes/sem-conferencia'])
  assert.deepEqual(await t("it('soma', () => { expect(soma(1, 2)).toBe(3) })"), [])
  assert.deepEqual(await t("test('x', async () => { assert.equal(1, 1) })"), [])
  assert.deepEqual(await t("test('x', async ({ page }) => { await page.waitForTimeout(2000); await expect(page).toHaveTitle('a') })"), ['testes/espera-fixa'])
})

test('tsx: JSX com apóstrofo não confunde a leitura', async () => {
  assert.deepEqual(await rules("export const A = () => <p>Don't {x ? 1 : 2}</p>", 'a.tsx'), [])
})

test('projeto: pacote dispensável, pacote sem uso, CLAUDE.md quebrado, exceção no código', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-q-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  write('package.json', JSON.stringify({ scripts: { dev: 'vite' }, dependencies: { uuid: '9', react: '18', 'left-pad': '1' } }))
  write('src/a.ts', "import { v4 } from 'uuid'\nimport React from 'react'\n// faundr-ignore falha/catch-vazio: limpeza opcional\ntry { a() } catch {}\n")
  write('CLAUDE.md', 'Rode `npm run dev` e `npm run build`. Veja `src/a.ts` e `src/nao-existe.ts`.')
  const { findings, stats } = await runQuality(dir, { history: false })
  const ids = findings.map((f) => f.rule_id)
  assert.ok(ids.includes('demais/dependencia-dispensavel'))
  assert.equal(findings.find((f) => f.rule_id === 'demais/dependencia-sem-uso')?.title, 'Pacote que nenhum arquivo usa: left-pad')
  assert.match(findings.find((f) => f.rule_id === 'instrucoes/arquivo-inexistente').detail, /src\/nao-existe\.ts/)
  assert.doesNotMatch(findings.find((f) => f.rule_id === 'instrucoes/arquivo-inexistente').detail, /src\/a\.ts/)
  assert.match(findings.find((f) => f.rule_id === 'instrucoes/script-inexistente').detail, /build/)
  assert.ok(!ids.includes('falha/catch-vazio'))
  assert.equal(stats.ignored, 1)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('projeto: código sem uso, arquivo órfão e trecho repetido', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-q-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  const block = Array.from({ length: 10 }, (_, i) => `  const valor${i} = calcularAlgoBemComprido(entrada.campo${i}, opcoes.limite${i})`).join('\n')
  write('package.json', JSON.stringify({ name: 'x' }))
  write('src/main.ts', "import { usada } from './util'\nimport './efeito'\nusada()\n")
  write('src/util.ts', `export function usada() {\n${block}\n}\nexport function esquecida() {}\nexport const interna = 1\nconsole.info(interna)\n`)
  write('src/efeito.ts', `export function copia() {\n${block}\n}\n`)
  write('src/orfao.ts', 'export const nada = 1\n')
  write('src/routes/index.tsx', 'export const Route = 1\n')
  const { findings } = await runQuality(dir, { history: false, tools: false })
  const byRule = (r) => findings.filter((f) => f.rule_id === r)
  assert.deepEqual(byRule('morto/arquivo-orfao').map((f) => f.file), ['src/orfao.ts'])
  // efeito.ts é importado só pelo efeito (import './efeito'): a função dele continua sem uso.
  assert.deepEqual(byRule('morto/export-sem-uso').map((f) => f.file).sort(), ['src/efeito.ts', 'src/util.ts'])
  const util = byRule('morto/export-sem-uso').find((f) => f.file === 'src/util.ts')
  assert.match(util.detail, /esquecida/)
  assert.doesNotMatch(util.detail, /interna/)
  assert.deepEqual(byRule('demais/duplicado').map((f) => f.file).sort(), ['src/efeito.ts', 'src/util.ts'])
  fs.rmSync(dir, { recursive: true, force: true })
})

test('regras da casa e livro de atalhos', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-q-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  write('package.json', '{}')
  write('.faundr-regras/sem-fetch-na-tela.md', '---\nnome: Sem fetch direto nas telas\npadrao: "\\bfetch\\("\narquivos: src/components/**\ngravidade: alta\n---\nUse o cliente de src/lib/api.ts.\n')
  write('src/components/A.tsx', "export const A = () => { fetch('/x'); return null }\n")
  write('src/lib/api.ts', "export const get = () => fetch('/x')\n// faundr: busca tudo de uma vez, paginar quando passar de 500 itens\n// faundr: sem cache\nconst msg = 'formato // faundr: exemplo'\n")
  const { findings } = await runQuality(dir, { history: false, tools: false })
  const casa = findings.filter((f) => f.rule_id === 'casa/sem-fetch-na-tela')
  assert.deepEqual(casa.map((f) => f.file), ['src/components/A.tsx'])
  assert.equal(casa[0].severity, 'high')
  assert.match(casa[0].impact, /src\/lib\/api\.ts/)
  const semPrazo = findings.filter((f) => f.rule_id === 'limpeza/atalho-sem-prazo')
  assert.equal(semPrazo.length, 1)
  assert.match(semPrazo[0].detail, /sem cache/)
  fs.rmSync(dir, { recursive: true, force: true })
})
