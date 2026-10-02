// Leitores dos relatórios de teste e detecção (seção Testes), com relatórios de exemplo.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { detectRunners, fromJestLike, fromPlaywright, inventory, productionDbSignals } from '../bin/tests.mjs'

const root = path.resolve('/proj')

test('Vitest/Jest: um teste por assertionResult, nome com os grupos, pulado e todo', () => {
  const json = {
    testResults: [
      {
        name: path.join(root, 'src/soma.test.ts'),
        message: '',
        assertionResults: [
          { ancestorTitles: ['', 'carrinho'], title: 'soma o total', status: 'passed', duration: 3.4, failureMessages: [] },
          { ancestorTitles: ['carrinho'], title: 'aplica cupom', status: 'failed', duration: 9, failureMessages: ['\u001b[31mexpected 5 to be 4\u001b[39m'] },
          { ancestorTitles: [], title: 'frete', status: 'pending', failureMessages: [] },
          { ancestorTitles: [], title: 'parcelas', status: 'todo', failureMessages: [] },
        ],
      },
    ],
  }
  const cases = fromJestLike(json, root)
  assert.deepEqual(cases.map((c) => [c.file, c.name, c.status]), [
    ['src/soma.test.ts', 'carrinho › soma o total', 'passed'],
    ['src/soma.test.ts', 'carrinho › aplica cupom', 'failed'],
    ['src/soma.test.ts', 'frete', 'skipped'],
    ['src/soma.test.ts', 'parcelas', 'todo'],
  ])
  assert.equal(cases[1].message, 'expected 5 to be 4')
  assert.equal(cases[0].durationMs, 3)
})

test('Playwright: instável, falha com mensagem, pulado com motivo e um por navegador', () => {
  const json = {
    config: { projects: [{ testDir: path.join(root, 'e2e') }] },
    suites: [
      {
        title: 'login.spec.ts',
        file: 'login.spec.ts',
        specs: [
          {
            title: 'entra com senha certa',
            file: 'login.spec.ts',
            tests: [
              { projectName: 'chromium', status: 'flaky', annotations: [], results: [{ duration: 5, errors: [{ message: 'timeout' }] }, { duration: 2, errors: [] }] },
              { projectName: 'firefox', status: 'skipped', annotations: [{ type: 'skip', description: 'ainda não funciona no Firefox' }], results: [] },
            ],
          },
        ],
        suites: [{ title: 'erros', specs: [{ title: 'senha errada', file: 'login.spec.ts', tests: [{ projectName: 'chromium', status: 'unexpected', results: [{ duration: 3, errors: [{ message: 'expect(locator).toBeVisible() failed' }] }] }] }] }],
      },
    ],
  }
  const cases = fromPlaywright(json, root)
  assert.deepEqual(cases.map((c) => [c.file, c.name, c.status]), [
    ['e2e/login.spec.ts', 'entra com senha certa [chromium]', 'flaky'],
    ['e2e/login.spec.ts', 'entra com senha certa [firefox]', 'skipped'],
    ['e2e/login.spec.ts', 'erros › senha errada [chromium]', 'failed'],
  ])
  assert.equal(cases[0].durationMs, 7)
  assert.equal(cases[1].message, 'Pulado: ainda não funciona no Firefox')
  assert.match(cases[2].message, /toBeVisible/)
})

test('detecção, inventário e aviso de banco de produção', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-t-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  write('package.json', JSON.stringify({ scripts: { test: 'vitest run', 'test:e2e': 'playwright test' }, devDependencies: { vitest: '5', '@playwright/test': '1' } }))
  write('playwright.config.ts', 'export default {}')
  write('.env', 'SUPABASE_URL=https://abcdefghijklmnop.supabase.co\n')
  write('src/a.test.ts', "import { it } from 'vitest'\nit('um', () => {})\nit.skip('dois', () => {})\nconst url = process.env.SUPABASE_URL\n")
  write('e2e/login.spec.ts', "import { test } from '@playwright/test'\ntest('entra', async () => {})\n")
  const { runners } = detectRunners(dir)
  assert.deepEqual(runners.map((r) => [r.runner, r.script, r.installed]), [['vitest', 'test', false], ['playwright', 'test:e2e', false]])
  const inv = inventory(dir)
  assert.deepEqual([inv.testFiles, inv.cases, inv.skipped, inv.e2eFiles], [2, 3, 1, 1])
  assert.match(productionDbSignals(dir)[0], /SUPABASE_URL/)
  write('.env.test', 'SUPABASE_URL=http://127.0.0.1:54321\n')
  assert.deepEqual(productionDbSignals(dir), [])
  fs.rmSync(dir, { recursive: true, force: true })
})
