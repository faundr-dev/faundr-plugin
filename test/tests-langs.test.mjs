import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fromClover } from '../bin/coverage.mjs'
import { detectRunners, fromJUnit, inventory } from '../bin/tests.mjs'
import { fromDartJson } from '../bin/tests-langs.mjs'

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-tl-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

test('acha flutter test, dart test, PHPUnit e Pest (também numa subpasta) e conta os testes sem rodar', () => {
  const dir = project({
    'app/pubspec.yaml': 'name: app\ndependencies:\n  flutter:\n    sdk: flutter\n',
    'app/test/widget_test.dart': "void main() {\n  testWidgets('abre', (t) async {});\n  test('soma', () {}, skip: true);\n}\n",
    'cli/pubspec.yaml': 'name: cli\ndev_dependencies:\n  test: ^1.24.0\n',
    'cli/test/cli_test.dart': "void main() { test('roda', () {}); }\n",
    'api/composer.json': JSON.stringify({ 'require-dev': { 'pestphp/pest': '^2.0' } }),
    'api/tests/Feature/PedidoTest.php': "<?php\nit('cria pedido', function () { expect(1)->toBe(1); });\ntest('apaga', function () {})->skip();\n",
    'site/composer.json': JSON.stringify({ 'require-dev': { 'phpunit/phpunit': '^10' } }),
    'site/tests/SomaTest.php': '<?php\nclass SomaTest extends TestCase {\n  public function testSoma() { $this->assertSame(2, 1 + 1); }\n}\n',
  })
  const { runners } = detectRunners(dir, { files: [] })
  assert.deepEqual(runners.map((r) => `${r.runner}@${r.dir}`).sort(), ['dart@cli', 'flutter@app', 'pest@api', 'phpunit@site'])
  const files = ['app/test/widget_test.dart', 'cli/test/cli_test.dart', 'api/tests/Feature/PedidoTest.php', 'site/tests/SomaTest.php']
  const inv = inventory(dir, files)
  assert.equal(inv.testFiles, 4)
  assert.equal(inv.cases, 6)
  assert.equal(inv.skipped, 2)
})

test('lê o JSON do flutter test: arquivo, nome, situação, duração e a mensagem da falha', () => {
  const root = path.resolve('/proj')
  const out = [
    JSON.stringify({ type: 'start', protocolVersion: '0.1.1' }),
    JSON.stringify({ type: 'suite', suite: { id: 0, platform: 'vm', path: path.join(root, 'test/widget_test.dart') } }),
    JSON.stringify({ type: 'testStart', test: { id: 1, name: 'loading /proj/test/widget_test.dart', suiteID: 0 }, time: 0 }),
    JSON.stringify({ type: 'testDone', testID: 1, result: 'success', skipped: false, hidden: true, time: 50 }),
    JSON.stringify({ type: 'testStart', test: { id: 2, name: 'Contador aumenta', suiteID: 0, line: 12 }, time: 60 }),
    JSON.stringify({ type: 'error', testID: 2, error: 'Expected: <1>\n  Actual: <0>', stackTrace: '', isFailure: true, time: 90 }),
    JSON.stringify({ type: 'testDone', testID: 2, result: 'failure', skipped: false, hidden: false, time: 100 }),
    JSON.stringify({ type: 'testStart', test: { id: 3, name: 'Abre a tela', suiteID: 0 }, time: 100 }),
    JSON.stringify({ type: 'testDone', testID: 3, result: 'success', skipped: false, hidden: false, time: 130 }),
    JSON.stringify({ type: 'testStart', test: { id: 4, name: 'Ainda não', suiteID: 0 }, time: 130 }),
    JSON.stringify({ type: 'testDone', testID: 4, result: 'success', skipped: true, hidden: false, time: 131 }),
    JSON.stringify({ type: 'done', success: false }),
  ].join('\n')
  assert.deepEqual(fromDartJson(out, root), [
    { file: 'test/widget_test.dart', name: 'Contador aumenta', status: 'failed', durationMs: 40, message: 'Expected: <1>\n  Actual: <0>' },
    { file: 'test/widget_test.dart', name: 'Abre a tela', status: 'passed', durationMs: 30, message: null },
    { file: 'test/widget_test.dart', name: 'Ainda não', status: 'skipped', durationMs: 1, message: null },
  ])
})

test('lê o JUnit do PHPUnit, com <error> de exceção, e a cobertura em Clover', () => {
  const root = path.resolve('/proj')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Tests\\SomaTest" file="${path.join(root, 'tests/SomaTest.php')}" tests="3">
    <testcase name="testSoma" class="Tests\\SomaTest" file="${path.join(root, 'tests/SomaTest.php')}" line="8" time="0.01"/>
    <testcase name="testFalha" class="Tests\\SomaTest" file="${path.join(root, 'tests/SomaTest.php')}" line="12" time="0.02">
      <failure type="PHPUnit\\Framework\\ExpectationFailedException">Failed asserting that 3 is identical to 2.</failure>
    </testcase>
    <testcase name="testQuebra" class="Tests\\SomaTest" file="${path.join(root, 'tests/SomaTest.php')}" line="16" time="0.01">
      <error type="Error">Call to undefined function soma()</error>
    </testcase>
  </testsuite>
</testsuites>`
  const cases = fromJUnit(xml, root)
  assert.deepEqual(cases.map((c) => [c.file, c.status]), [['tests/SomaTest.php', 'passed'], ['tests/SomaTest.php', 'failed'], ['tests/SomaTest.php', 'failed']])
  assert.match(cases[2].message, /undefined function soma/)
  const clover = `<coverage><project><file name="${path.join(root, 'app/Soma.php')}"><line num="5" type="stmt" count="3"/><line num="6" type="stmt" count="0"/><line num="2" type="method" count="1"/></file></project></coverage>`
  assert.deepEqual([...fromClover(clover, root).get('app/Soma.php')], [[5, 'c'], [6, 'u']])
})
