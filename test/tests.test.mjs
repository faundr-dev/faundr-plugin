// Leitores dos relatórios de teste e detecção (seção Testes), com relatórios de exemplo.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { detectRunners, fromJestLike, fromPlaywright, fromPytest, insideDir, inventory, productionDbSignals } from '../bin/tests.mjs'

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

test('pytest: arquivo, classe no nome, falha, erro de fixture e pulado', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><testsuites><testsuite name="pytest" tests="4">
<testcase classname="tests.test_importa" name="test_le_planilha" file="tests/test_importa.py" line="3" time="0.012" />
<testcase classname="tests.test_importa.TestMetas" name="test_dias_uteis" file="tests/test_importa.py" line="9" time="0.5"><failure message="assert 21 == 22">def test_dias_uteis():
&gt;       assert 21 == 22
E       assert 21 == 22</failure></testcase>
<testcase classname="tests.test_login" name="test_token" file="tests/test_login.py" time="0"><error message="failed on setup with &quot;KeyError: 'X'&quot;">KeyError: 'X'</error></testcase>
<testcase classname="tests.test_login" name="test_lento" file="tests/test_login.py" time="0"><skipped type="pytest.skip" message="precisa de rede">/x</skipped></testcase>
</testsuite></testsuites>`
  const cases = fromPytest(xml, root, path.join(root, 'backend'))
  assert.deepEqual(
    cases.map((c) => [c.file, c.name, c.status, c.durationMs]),
    [
      ['backend/tests/test_importa.py', 'test_le_planilha', 'passed', 12],
      ['backend/tests/test_importa.py', 'TestMetas › test_dias_uteis', 'failed', 500],
      ['backend/tests/test_login.py', 'test_token', 'failed', 0],
      ['backend/tests/test_login.py', 'test_lento', 'skipped', 0],
    ],
  )
  assert.match(cases[1].message, /assert 21 == 22/)
  assert.match(cases[2].message, /KeyError/)
  assert.equal(cases[3].message, 'Pulado: precisa de rede')
})

test('projeto dividido: Vitest em frontend/, pytest na raiz e banco de produção num teste Python', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-t-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  write('frontend/package.json', JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '5' } }))
  write('frontend/node_modules/vitest/vitest.mjs', '')
  write('frontend/src/a.test.ts', "import { it } from 'vitest'\nit('um', () => {})\n")
  write('backend/tests/test_metas.py', 'import pytest\n\ndef test_um():\n    assert 1\n\n@pytest.mark.skip\ndef test_dois():\n    pass\n')
  write('backend/tests/test_rfm_rpc.py', 'import os\nfrom supabase import create_client\nurl = os.environ["SUPABASE_URL"]\n\ndef test_rpc():\n    pass\n')
  write('backend/.env', 'SUPABASE_URL=https://abcdefghijklmnop.supabase.co\n')
  write('venv/Lib/site-packages/x/test_lib.py', 'def test_x(): pass\n')
  const { runners } = detectRunners(dir, { python: process.execPath })
  assert.deepEqual(
    runners.map((r) => [r.runner, r.dir, r.script, r.installed]),
    [
      ['vitest', 'frontend', 'test', true],
      ['pytest', '', null, true],
    ],
  )
  const inv = inventory(dir)
  assert.deepEqual([inv.testFiles, inv.cases, inv.skipped], [3, 4, 1])
  assert.match(productionDbSignals(dir)[0], /test_rfm_rpc\.py usa SUPABASE_URL/)
  assert.deepEqual(productionDbSignals(dir, undefined, { exclude: ['backend/tests/test_rfm_rpc.py'] }), [])
  // Com a configuração do pytest em backend/, ele roda de dentro dela.
  write('backend/pytest.ini', '[pytest]\n')
  assert.deepEqual(detectRunners(dir, { python: process.execPath }).runners.find((r) => r.runner === 'pytest').dir, 'backend')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('caminhos da raiz vistos de dentro da pasta do executor', () => {
  assert.deepEqual(insideDir('frontend', ['frontend/src/a.test.ts', 'backend/x.py', 'frontend']), ['src/a.test.ts', '.'])
  assert.deepEqual(insideDir('', ['a', 'b']), ['a', 'b'])
})
