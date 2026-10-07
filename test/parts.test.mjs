// Projeto dividido em partes (frontend/ com o próprio package.json, backend em Python): cada checagem tem que
// olhar a parte certa, e o código Python também passa pela qualidade.
// Rodar: node --test plugin/test
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { analyzeQuality } from '../dist/graph.mjs'
import { findDesignMd } from '../bin/design.mjs'
import { extractTokens } from '../bin/design-tokens.mjs'
import { commandCwd, parseErrors } from '../bin/errors.mjs'
import { allDeps, allScripts, inNodeModules, projectParts } from '../bin/parts.mjs'
import { runQuality } from '../bin/quality-rules.mjs'
import { projectMap, scanProject } from '../bin/security.mjs'
import { detectRuntime } from '../bin/showcase.mjs'

const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-p-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return { dir, write, done: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

const pyRules = async (code, file = 'app/a.py', opts) => (await analyzeQuality(file, code, opts)).hits.map((h) => h.rule)

const PY_CASES = [
  ['falha/catch-vazio', 'try:\n    a()\nexcept Exception:\n    pass\n', 'try:\n    a()\nexcept FileNotFoundError:\n    # o arquivo é opcional\n    pass\n'],
  ['falha/catch-so-loga', 'try:\n    a()\nexcept Exception as e:\n    print(e)\n', 'try:\n    a()\nexcept Exception as e:\n    print(e)\n    raise\n'],
  ['falha/catch-devolve-nulo', 'def f():\n    try:\n        return a()\n    except Exception:\n        return None\n', 'def f():\n    try:\n        return a()\n    except Exception as e:\n        log.error(e)\n        return None\n'],
  ['falha/mock-em-producao', 'from tests.fixtures import usuarios\n', 'from app.servicos import usuarios\n'],
  ['limpeza/debugger', 'def f():\n    breakpoint()\n', 'def f():\n    return 1\n'],
  ['complexidade/ternario-aninhado', 'v = 1 if a else 2 if b else 3\n', 'v = 1 if a else 2\n'],
  ['complexidade/funcao', `def f(x):\n${Array.from({ length: 21 }, (_, i) => `    if x == ${i}:\n        return ${i}`).join('\n')}\n`, `def f(x):\n${Array.from({ length: 5 }, (_, i) => `    if x == ${i}:\n        return ${i}`).join('\n')}\n`],
  ['complexidade/aninhamento', 'def f():\n    if a:\n        for x in y:\n            while b:\n                if c:\n                    if d:\n                        e()\n', 'def f():\n    if not a:\n        return\n    e()\n'],
  ['demais/codigo-comentado', 'a = 1\n# b = 2\n# if a:\n#     b = 3\n# print(b)\nc = 4\n', '# Explica o que vem a seguir\n# em duas linhas de texto\n# e mais esta aqui\n# e a última\na = 1\n'],
]

for (const [rule, bad, good] of PY_CASES)
  test(`python: ${rule}`, async () => {
    assert.ok((await pyRules(bad)).includes(rule), `deveria achar em: ${bad}`)
    assert.ok(!(await pyRules(good)).includes(rule), `não deveria achar em: ${good}`)
  })

test('python: testes do pytest pulados, sem assert e com espera fixa', async () => {
  const t = (code) => pyRules(code, 'tests/test_a.py', { test: true })
  assert.ok((await t('import pytest\n\n@pytest.mark.skip\ndef test_a():\n    assert 1\n')).includes('testes/pulado'))
  assert.ok((await t('def test_a():\n    soma(1, 2)\n')).includes('testes/sem-conferencia'))
  assert.ok(!(await t('def test_a():\n    assert soma(1, 2) == 3\n')).includes('testes/sem-conferencia'))
  assert.ok(!(await t('def test_a():\n    with pytest.raises(ValueError):\n        soma(None)\n')).includes('testes/sem-conferencia'))
  assert.ok((await t('import time\n\ndef test_a():\n    time.sleep(2)\n    assert 1\n')).includes('testes/espera-fixa'))
  // Funções auxiliares do teste (sem "test" no nome) não são cobradas.
  assert.deepEqual(await t('def montar():\n    return 1\n'), [])
})

test('partes do projeto: raiz, frontend/ e apps/web/, sem node_modules nem pastas ocultas', () => {
  const { dir, write, done } = tmp()
  write('package.json', JSON.stringify({ scripts: { lint: 'eslint .' } }))
  write('frontend/package.json', JSON.stringify({ scripts: { dev: 'vite --port 4000' }, dependencies: { react: '19', next: '15' } }))
  write('apps/web/package.json', JSON.stringify({ dependencies: { vue: '3' } }))
  write('frontend/node_modules/x/package.json', '{}')
  write('.cache/package.json', '{}')
  write('frontend/node_modules/tailwindcss/package.json', JSON.stringify({ version: '4.1.0' }))
  write('frontend/node_modules/tailwindcss/theme.css', ':root { --color-red-500: oklch(63.7% 0.237 25.331); }')
  assert.deepEqual(projectParts(dir).map((p) => p.dir).sort(), ['', 'apps/web', 'frontend'])
  assert.deepEqual(Object.keys(allDeps(dir)).sort(), ['next', 'react', 'vue'])
  assert.deepEqual(allScripts(dir).map((s) => `${s.dir}:${s.name}`).sort(), [':lint', 'frontend:dev'])
  assert.match(inNodeModules(dir, 'tailwindcss/theme.css'), /frontend/)
  // Vitrine e cores do design: o Tailwind de frontend/ conta.
  assert.equal(detectRuntime(dir), 'tailwind4')
  done()
})

test('design: design.md dentro de uma parte e pasta "plugin/" do app não é ignorada', () => {
  const { dir, write, done } = tmp()
  write('frontend/package.json', '{}')
  write('frontend/DESIGN.md', '# Design')
  assert.equal(findDesignMd(dir), 'frontend/DESIGN.md')
  write('DESIGN.md', '# Design da raiz')
  assert.equal(findDesignMd(dir), 'DESIGN.md')
  // Um app com telas em plugin/ (não é um plugin do Claude Code): as cores dele entram.
  write('plugin/estilo.css', ':root { --marca: #ff0000; }')
  assert.ok(extractTokens(dir).colors.some((c) => /ff0000/i.test(c.value ?? '')))
  // Plugin do Claude Code (tem .claude-plugin/plugin.json): fica de fora.
  write('ferramenta/.claude-plugin/plugin.json', '{}')
  write('ferramenta/estilo.css', ':root { --outra: #00ff00; }')
  assert.ok(!extractTokens(dir).colors.some((c) => /00ff00/i.test(c.value ?? '')))
  done()
})

test('qualidade: scripts de todas as partes, pacotes por parte e Python no projeto', async () => {
  const { dir, write, done } = tmp()
  write('package.json', JSON.stringify({ name: 'raiz' }))
  write('frontend/package.json', JSON.stringify({ scripts: { dev: 'vite' }, dependencies: { react: '19', 'left-pad': '1' } }))
  write('frontend/src/a.tsx', "import React from 'react'\nexport const A = () => null\n")
  write('backend/app/servico.py', 'def f():\n    try:\n        a()\n    except Exception:\n        pass\n')
  write('CLAUDE.md', 'Rode `cd frontend && npm run dev`. Depois `npm run deploy`.')
  const { findings } = await runQuality(dir, { history: false, tools: false })
  const byRule = (r) => findings.filter((f) => f.rule_id === r)
  // "dev" existe em frontend/package.json: só "deploy" falta.
  assert.match(byRule('instrucoes/script-inexistente')[0].detail, /deploy/)
  assert.doesNotMatch(byRule('instrucoes/script-inexistente')[0].detail, /\bdev\b/)
  assert.deepEqual(byRule('demais/dependencia-sem-uso').map((f) => [f.file, f.title]), [['frontend/package.json', 'Pacote que nenhum arquivo usa: left-pad']])
  assert.deepEqual(byRule('falha/catch-vazio').map((f) => f.file), ['backend/app/servico.py'])
  assert.match(byRule('falha/catch-vazio')[0].title, /except: pass/)
  // Python fica fora do "código sem uso" (o leitor de imports é só do JS/TS).
  assert.ok(!byRule('morto/arquivo-orfao').some((f) => f.file.endsWith('.py')))
  done()
})

test('segurança: cabeçalhos do site com o React em frontend/ e FastAPI na lista de tecnologias', async () => {
  const { dir, write, done } = tmp()
  write('frontend/package.json', JSON.stringify({ dependencies: { react: '19', vite: '6' } }))
  write('frontend/src/main.tsx', 'export const x = 1\n')
  write('backend/requirements.txt', 'fastapi==0.115.0\nsupabase>=2\n')
  const { findings } = await scanProject(dir, { deps: false })
  const headers = findings.find((f) => f.rule_id === 'missing-security-headers')
  assert.equal(headers?.file, 'frontend/package.json')
  assert.deepEqual(projectMap(dir).stack.filter((s) => ['React', 'Vite', 'FastAPI', 'Supabase'].includes(s)).sort(), ['FastAPI', 'React', 'Supabase', 'Vite'])
  done()
})

test('erros: caminho de quem roda depois de "cd frontend &&" fica a partir da raiz', () => {
  const root = path.resolve('/proj')
  assert.equal(commandCwd('cd frontend && npx vitest run', root), path.join(root, 'frontend'))
  assert.equal(commandCwd('cd "meu app"; npm test', root), path.join(root, 'meu app'))
  assert.equal(commandCwd('npx vitest run', root), root)
  const out = ' FAIL  src/a.test.ts > carrinho > soma\nAssertionError: expected 1 to be 2'
  const [issue] = parseErrors(out, { kind: 'test', root, cwd: path.join(root, 'frontend') })
  assert.equal(issue.file, 'frontend/src/a.test.ts')
  // Sem cd, igual a antes.
  assert.equal(parseErrors(out, { kind: 'test', root })[0].file, 'src/a.test.ts')
})
