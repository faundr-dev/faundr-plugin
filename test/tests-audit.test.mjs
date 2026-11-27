// Correções da auditoria da aba Testes (27/11/2026): exclusão que não vale, arquivo que não carrega, pacote Go que
// não compila, estado do código para o "instável" e caminho da cobertura de executor em subpasta.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { brokenFiles, CAN_EXCLUDE, commandFor, runTests } from '../bin/tests.mjs'
import { fromGoJson } from '../bin/tests-langs.mjs'
import { fromLcov } from '../bin/coverage.mjs'
import { codeState } from '../bin/cmd-tests.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-ta-'))

test('Jest: cada arquivo de fora no formato com "=" (não engole o --files) e o node_modules continua ignorado', () => {
  const args = commandFor('jest', 'out.json', { files: ['src/a.test.ts'], exclude: ['db/real.test.ts'] })
  assert.ok(args.includes('--testPathIgnorePatterns=/node_modules/'))
  assert.ok(args.includes('--testPathIgnorePatterns=db/real\\.test\\.ts'))
  assert.ok(!args.includes('--testPathIgnorePatterns'))
  assert.equal(args.at(-1), 'src/a.test.ts')
})

test('executor que não sabe excluir arquivo não roda com --exclude (rodaria o teste do banco real)', () => {
  assert.deepEqual(CAN_EXCLUDE, ['vitest', 'jest', 'pytest'])
  const root = tmp()
  fs.writeFileSync(path.join(root, 'package.json'), '{}')
  const r = runTests(root, 'node', { exclude: ['test/db.test.mjs'] })
  assert.ok(r.error)
  assert.match(r.error, /test\/db\.test\.mjs/)
  assert.equal(r.cases, undefined)
})

test('arquivo de teste que não carregou vira teste falhando; arquivo com teste falhando não duplica', () => {
  const root = tmp()
  const json = {
    testResults: [
      { name: path.join(root, 'src/ok.test.ts'), message: '', assertionResults: [{ title: 'soma', status: 'passed' }] },
      { name: path.join(root, 'src/quebrado.test.ts'), message: "Cannot find module './x'", assertionResults: [] },
      { name: path.join(root, 'src/falha.test.ts'), message: 'expected 1', assertionResults: [{ title: 'a', status: 'failed' }] },
    ],
  }
  const broken = brokenFiles(json, root, 'vitest')
  assert.equal(broken.length, 1)
  assert.equal(broken[0].file, 'src/quebrado.test.ts')
  assert.equal(broken[0].status, 'failed')
  const pw = brokenFiles({ errors: [{ message: 'config quebrada', location: { file: path.join(root, 'e2e/a.spec.ts') } }] }, root, 'playwright')
  assert.equal(pw[0].file, 'e2e/a.spec.ts')
})

test('go test: pacote que não compila vira teste falhando; pacote com teste falhando não ganha outro', () => {
  const root = tmp()
  const lines = [
    { Action: 'build-output', ImportPath: 'ex/a [ex/a.test]', Output: './a.go:3:1: undefined: x\n' },
    { Action: 'fail', Package: 'ex/a', FailedBuild: 'ex/a [ex/a.test]' },
    { Action: 'run', Package: 'ex/b', Test: 'TestB' },
    { Action: 'fail', Package: 'ex/b', Test: 'TestB', Elapsed: 0.01 },
    { Action: 'output', Package: 'ex/b', Output: 'FAIL\tex/b\t0.01s\n' },
    { Action: 'fail', Package: 'ex/b' },
  ].map((l) => JSON.stringify(l))
  const cases = fromGoJson(lines.join('\n'), root)
  const build = cases.filter((c) => c.name.startsWith('ex/a'))
  assert.equal(build.length, 1)
  assert.equal(build[0].status, 'failed')
  assert.match(build[0].message, /undefined: x/)
  assert.equal(cases.filter((c) => c.name.startsWith('ex/b')).length, 0)
  assert.equal(cases.filter((c) => c.name === 'TestB').length, 1)
})

test('estado do código: muda com o que não foi commitado; sem mudança é o commit', () => {
  const root = tmp()
  const commit = 'a'.repeat(40)
  const clean = codeState(root, commit, () => '')
  assert.equal(clean, commit)
  const one = codeState(root, commit, (a) => (a[0] === 'diff' ? '+linha 1' : ''))
  const two = codeState(root, commit, (a) => (a[0] === 'diff' ? '+linha 2' : ''))
  assert.notEqual(one, two)
  assert.equal(one.length, 12)
  assert.equal(codeState(root, null, () => ''), null)
})

test('lcov de executor em subpasta: caminho relativo vem da pasta em que rodou; file:// vira caminho de verdade', () => {
  const root = tmp()
  const files = fromLcov('SF:app/x.py\nDA:1,1\nend_of_record\n', root, path.join(root, 'backend'))
  assert.deepEqual([...files.keys()], ['backend/app/x.py'])
  const url = pathToFileURL(path.join(root, 'lib', 'a.mjs')).href
  assert.deepEqual([...fromLcov(`SF:${url}\nDA:1,1\nend_of_record\n`, root).keys()], ['lib/a.mjs'])
})

test('explicações: lista dos arquivos sem explicação e leitura do --json', async () => {
  const { missingExplanations, readExplanationsJson } = await import('../bin/cmd-tests.mjs')
  assert.deepEqual(missingExplanations(['a.test.ts', 'b.test.ts'], { 'a.test.ts': { text: 'x' } }), ['b.test.ts'])
  assert.deepEqual(missingExplanations(['a.test.ts'], null), ['a.test.ts'])
  const items = readExplanationsJson(JSON.stringify([{ file: '.\\src\\a.test.ts', text: ' confere ' }, { file: 'b.test.ts', text: '' }, { nope: 1 }]))
  assert.deepEqual(items, [{ file: 'src/a.test.ts', text: 'confere' }])
  assert.throws(() => readExplanationsJson('{nope'), /not valid JSON/)
  assert.throws(() => readExplanationsJson('{"a":1}'), /must be a list/)
})
