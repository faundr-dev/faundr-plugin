import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { coverageArgs, fromClover, fromCobertura, fromGoCover, fromJacoco } from '../bin/coverage.mjs'
import { detectRunners, fromJUnit, inventory } from '../bin/tests.mjs'
import { ctestCaseFiles, fromCargoTest, fromDartJson, fromGoJson, fromTrx, jvmCaseFiles } from '../bin/tests-langs.mjs'

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

test('acha go test, Maven, Gradle e dotnet test (módulo e solução ficam com a raiz) e conta os testes sem rodar', () => {
  const dir = project({
    'api/go.mod': 'module example.com/api\n',
    'api/pedido/pedido_test.go': 'package pedido\n\nimport "testing"\n\nfunc TestSalva(t *testing.T) {}\nfunc TestPulado(t *testing.T) { t.Skip("depois") }\nfunc ajuda() {}\n',
    'loja/pom.xml': '<project><modules><module>core</module></modules></project>',
    'loja/core/pom.xml': '<project></project>',
    'loja/core/src/test/java/com/acme/PedidoTest.java': 'class PedidoTest {\n  @Test void salva() {}\n  @Disabled @Test void velho() {}\n}\n',
    'app/build.gradle.kts': 'plugins { kotlin("jvm") }\n',
    'app/src/test/kotlin/AppTest.kt': 'class AppTest {\n  @Test fun roda() {}\n}\n',
    'net/Loja.sln': '',
    'net/Loja/Loja.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
    'net/Loja.Tests/Loja.Tests.csproj': '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="Microsoft.NET.Test.Sdk" /><PackageReference Include="coverlet.collector" /></ItemGroup></Project>',
    'net/Loja.Tests/PedidoTests.cs': 'public class PedidoTests {\n  [Fact] public void Salva() {}\n  [Fact(Skip = "depois")] public void Velho() {}\n  [Theory] public void Soma(int x) {}\n}\n',
  })
  const { runners } = detectRunners(dir, { files: [] })
  assert.deepEqual(runners.map((r) => `${r.runner}@${r.dir}`).sort(), ['dotnet@net', 'go@api', 'gradle@app', 'maven@loja'])
  assert.equal(runners.find((r) => r.runner === 'dotnet').coverage, true, 'coverlet no projeto de teste')
  const files = ['api/pedido/pedido_test.go', 'loja/core/src/test/java/com/acme/PedidoTest.java', 'app/src/test/kotlin/AppTest.kt', 'net/Loja.Tests/PedidoTests.cs', 'net/Loja/Pedido.cs']
  const inv = inventory(dir, files)
  assert.equal(inv.testFiles, 4, 'o Pedido.cs do app não é teste')
  assert.equal(inv.cases, 8)
  assert.equal(inv.skipped, 3)
})

test('lê o go test -json: arquivo pelo func Test, subtestes, pulado e a saída da falha', () => {
  const root = project({
    'go.mod': 'module example.com/loja\n',
    'pedido/pedido_test.go': 'package pedido\n\nfunc TestSalva(t *testing.T) {}\n',
    'pedido/tabela_test.go': 'package pedido\n\nfunc TestTabela(t *testing.T) {}\nfunc TestPulado(t *testing.T) {}\n',
  })
  const ev = (o) => JSON.stringify({ Package: 'example.com/loja/pedido', ...o })
  const out = [
    ev({ Action: 'run', Test: 'TestSalva' }),
    ev({ Action: 'output', Test: 'TestSalva', Output: '=== RUN   TestSalva\n' }),
    ev({ Action: 'output', Test: 'TestSalva', Output: '    pedido_test.go:9: got 3, want 2\n' }),
    ev({ Action: 'output', Test: 'TestSalva', Output: '--- FAIL: TestSalva (0.00s)\n' }),
    ev({ Action: 'fail', Test: 'TestSalva', Elapsed: 0.01 }),
    ev({ Action: 'run', Test: 'TestTabela' }),
    ev({ Action: 'run', Test: 'TestTabela/vazio' }),
    ev({ Action: 'pass', Test: 'TestTabela/vazio', Elapsed: 0 }),
    ev({ Action: 'run', Test: 'TestTabela/cheio' }),
    ev({ Action: 'pass', Test: 'TestTabela/cheio', Elapsed: 0.002 }),
    ev({ Action: 'pass', Test: 'TestTabela', Elapsed: 0.003 }),
    ev({ Action: 'output', Test: 'TestPulado', Output: '    tabela_test.go:5: depois\n' }),
    ev({ Action: 'skip', Test: 'TestPulado', Elapsed: 0 }),
    ev({ Action: 'fail', Elapsed: 0.5 }),
  ].join('\n')
  const cases = fromGoJson(out, root)
  assert.deepEqual(
    cases.map((c) => [c.file, c.name, c.status]),
    [
      ['pedido/pedido_test.go', 'TestSalva', 'failed'],
      ['pedido/tabela_test.go', 'TestTabela › vazio', 'passed'],
      ['pedido/tabela_test.go', 'TestTabela › cheio', 'passed'],
      ['pedido/tabela_test.go', 'TestPulado', 'skipped'],
    ],
  )
  assert.match(cases[0].message, /got 3, want 2/)
  assert.doesNotMatch(cases[0].message, /--- FAIL/)
  assert.equal(cases[2].durationMs, 2)
})

test('JUnit do Maven/Gradle: acha o arquivo pela classe e encurta o nome', () => {
  const root = project({ 'core/src/test/java/com/acme/PedidoTest.java': 'class PedidoTest {}', 'src/test/kotlin/com/acme/AppTest.kt': 'class AppTest' })
  const xml = `<?xml version="1.0"?>
<testsuite name="com.acme.PedidoTest" tests="2" failures="1">
  <testcase name="salva" classname="com.acme.PedidoTest" time="0.012"/>
  <testcase name="nota" classname="com.acme.PedidoTest" time="0.003"><failure message="expected: &lt;1&gt; but was: &lt;2&gt;" type="org.opentest4j.AssertionFailedError">org.opentest4j.AssertionFailedError: expected: &lt;1&gt; but was: &lt;2&gt;</failure></testcase>
</testsuite>
<testsuite name="com.acme.AppTest" tests="1"><testcase name="roda()" classname="com.acme.AppTest" time="0.1"><skipped/></testcase></testsuite>`
  const cases = jvmCaseFiles(fromJUnit(xml, root), root)
  assert.deepEqual(
    cases.map((c) => [c.file, c.name, c.status]),
    [
      ['core/src/test/java/com/acme/PedidoTest.java', 'PedidoTest › salva', 'passed'],
      ['core/src/test/java/com/acme/PedidoTest.java', 'PedidoTest › nota', 'failed'],
      ['src/test/kotlin/com/acme/AppTest.kt', 'AppTest › roda()', 'skipped'],
    ],
  )
  assert.match(cases[1].message, /expected: <1> but was: <2>/)

  // Cobertura do JaCoCo: o arquivo fica no módulo, em src/main/java ou src/main/kotlin.
  const proj = project({ 'core/src/main/java/com/acme/Pedido.java': 'class Pedido {}', 'src/main/kotlin/com/acme/App.kt': 'class App' })
  const jacoco = (pkg, file, lines) => `<report name="x"><package name="${pkg}"><sourcefile name="${file}">${lines}</sourcefile></package></report>`
  const files = fromJacoco(
    [
      { module: 'core', xml: jacoco('com/acme', 'Pedido.java', '<line nr="5" mi="0" ci="3" mb="0" cb="0"/><line nr="6" mi="0" ci="2" mb="1" cb="1"/><line nr="9" mi="4" ci="0" mb="0" cb="0"/>') },
      { module: '', xml: jacoco('com/acme', 'App.kt', '<line nr="3" mi="0" ci="1" mb="0" cb="0"/>') },
    ],
    proj,
  )
  assert.deepEqual([...files.get('core/src/main/java/com/acme/Pedido.java')], [[5, 'c'], [6, 'p'], [9, 'u']])
  assert.deepEqual([...files.get('src/main/kotlin/com/acme/App.kt')], [[3, 'c']])
})

test('lê o TRX do dotnet test e a cobertura do Go e do Cobertura (coverlet)', () => {
  const root = project({ 'Loja.Tests/PedidoTests.cs': 'public class PedidoTests {}', 'go.mod': 'module example.com/loja\n' })
  const trx = `<?xml version="1.0" encoding="utf-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testId="a1" testName="Loja.Tests.PedidoTests.Salva" outcome="Passed" duration="00:00:00.0120000" />
    <UnitTestResult testId="a2" testName="Loja.Tests.PedidoTests.Nota" outcome="Failed" duration="00:00:00.0030000">
      <Output><ErrorInfo><Message>Assert.Equal() Failure&#xD;&#xA;Expected: 1&#xD;&#xA;Actual:   2</Message><StackTrace>   at Loja.Tests.PedidoTests.Nota() in ${path.join(root, 'Loja.Tests', 'PedidoTests.cs')}:line 14</StackTrace></ErrorInfo></Output>
    </UnitTestResult>
    <UnitTestResult testId="a3" testName="Loja.Tests.PedidoTests.Velho" outcome="NotExecuted" duration="00:00:00" />
  </Results>
  <TestDefinitions>
    <UnitTest name="Salva" id="a1"><TestMethod codeBase="x.dll" className="Loja.Tests.PedidoTests" name="Salva" /></UnitTest>
    <UnitTest name="Nota" id="a2"><TestMethod codeBase="x.dll" className="Loja.Tests.PedidoTests" name="Nota" /></UnitTest>
    <UnitTest name="Velho" id="a3"><TestMethod codeBase="x.dll" className="Loja.Tests.PedidoTests" name="Velho" /></UnitTest>
  </TestDefinitions>
</TestRun>`
  const cases = fromTrx(trx, root)
  assert.deepEqual(
    cases.map((c) => [c.file, c.name, c.status, c.durationMs]),
    [
      ['Loja.Tests/PedidoTests.cs', 'PedidoTests › Salva', 'passed', 12],
      ['Loja.Tests/PedidoTests.cs', 'PedidoTests › Nota', 'failed', 3],
      ['Loja.Tests/PedidoTests.cs', 'PedidoTests › Velho', 'skipped', 0],
    ],
  )
  assert.match(cases[1].message, /Expected: 1\nActual: {3}2/)

  const profile = 'mode: set\nexample.com/loja/pedido/pedido.go:5.20,7.2 1 1\nexample.com/loja/pedido/pedido.go:9.20,10.2 1 0\n'
  assert.deepEqual([...fromGoCover(profile, root, { module: 'example.com/loja', dir: '' }).get('pedido/pedido.go')], [[5, 'c'], [6, 'c'], [7, 'c'], [9, 'u'], [10, 'u']])

  const cobertura = `<?xml version="1.0"?><coverage><sources><source>${root}</source></sources><packages><package><classes>
<class name="Loja.Pedido" filename="Loja/Pedido.cs"><lines><line number="8" hits="2" branch="False" /><line number="9" hits="1" branch="True" condition-coverage="50% (1/2)" /><line number="12" hits="0" branch="False" /></lines></class>
</classes></package></packages></coverage>`
  assert.deepEqual([...fromCobertura(cobertura, root).get('Loja/Pedido.cs')], [[8, 'c'], [9, 'p'], [12, 'u']])
})

test('acha cargo test (workspace fica com a raiz) e CTest, e conta os testes do Rust (também dentro de src/) e do GoogleTest/Catch2', () => {
  const dir = project({
    'Cargo.toml': '[workspace]\nmembers = ["api", "core"]\n',
    'api/Cargo.toml': '[package]\nname = "api"\n',
    'api/src/main.rs': 'fn main() {}\n',
    'core/Cargo.toml': '[package]\nname = "loja-core"\n',
    'core/src/lib.rs': 'pub fn soma(a: i32, b: i32) -> i32 { a + b }\n\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn soma_ok() { assert_eq!(super::soma(1, 1), 2); }\n    #[test]\n    #[ignore]\n    fn velho() {}\n}\n',
    'core/src/sem_teste.rs': 'pub fn nada() {}\n',
    'core/tests/api.rs': '#[tokio::test]\nasync fn sobe() {}\n',
    'motor/CMakeLists.txt': 'project(motor)\nenable_testing()\nadd_subdirectory(tests)\n',
    'motor/tests/CMakeLists.txt': 'add_executable(t pedido_test.cpp)\ngtest_discover_tests(t)\n',
    'motor/tests/pedido_test.cpp': 'TEST(Pedido, Salva) { EXPECT_EQ(1, 1); }\nTEST_F(Base, DISABLED_Velho) {}\n',
    'motor/tests/catch_test.cpp': 'TEST_CASE("soma dois numeros") { REQUIRE(1 + 1 == 2); }\nTEST_CASE("lento", "[.]") {}\n',
    'motor/src/motor.cpp': 'int motor() { return 0; }\n',
  })
  const { runners } = detectRunners(dir, { files: [] })
  assert.deepEqual(runners.map((r) => `${r.runner}@${r.dir}`).sort(), ['cargo@', 'ctest@motor'])
  const files = ['core/src/lib.rs', 'core/src/sem_teste.rs', 'core/tests/api.rs', 'api/src/main.rs', 'motor/tests/pedido_test.cpp', 'motor/tests/catch_test.cpp', 'motor/src/motor.cpp']
  const inv = inventory(dir, files)
  assert.equal(inv.testFiles, 4, 'lib.rs com #[test] conta; sem_teste.rs, main.rs e motor.cpp não')
  assert.equal(inv.cases, 7)
  assert.equal(inv.skipped, 3)
})

test('lê a saída do cargo test: arquivo pelo módulo (workspace e testes de integração), ignorado, doc-test e o motivo da falha', () => {
  const root = project({
    'Cargo.toml': '[workspace]\nmembers = ["core"]\n',
    'core/Cargo.toml': '[package]\nname = "loja-core"\n',
    'core/src/lib.rs': 'pub mod pedido;\n',
    'core/src/pedido.rs': '#[cfg(test)]\nmod tests {}\n',
    'core/tests/api.rs': '#[test]\nfn sobe() {}\n',
  })
  const out = [
    '   Compiling loja-core v0.1.0 (C:\\loja\\core)',
    '    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.20s',
    '     Running unittests src/lib.rs (target/debug/deps/loja_core-1a2b3c)',
    '',
    'running 3 tests',
    'test pedido::tests::salva_ok ... ok',
    'test pedido::tests::velho ... ignored, lento demais',
    'test pedido::tests::soma ... FAILED',
    '',
    'failures:',
    '',
    '---- pedido::tests::soma stdout ----',
    "thread 'pedido::tests::soma' panicked at src/pedido.rs:9:9:",
    'assertion `left == right` failed',
    '  left: 3',
    ' right: 2',
    'note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace',
    '',
    '',
    'failures:',
    '    pedido::tests::soma',
    '',
    'test result: FAILED. 1 passed; 1 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s',
    '',
    '     Running tests/api.rs (target/debug/deps/api-9f8e7d)',
    '',
    'running 1 test',
    'test sobe ... ok',
    '',
    '   Doc-tests loja_core',
    '',
    'running 1 test',
    'test core/src/lib.rs - soma (line 3) ... ok',
  ].join('\n')
  const cases = fromCargoTest(out, root)
  assert.deepEqual(
    cases.map((c) => [c.file, c.name, c.status]),
    [
      ['core/src/pedido.rs', 'pedido › tests › salva_ok', 'passed'],
      ['core/src/pedido.rs', 'pedido › tests › velho', 'skipped'],
      ['core/src/pedido.rs', 'pedido › tests › soma', 'failed'],
      ['core/tests/api.rs', 'sobe', 'passed'],
      ['core/src/lib.rs', 'soma (doc-test, linha 3)', 'passed'],
    ],
  )
  assert.match(cases[2].message, /left: 3\n right: 2/)
  assert.doesNotMatch(cases[2].message, /RUST_BACKTRACE/)
})

test('CTest: o teste do JUnit vira o arquivo que declara TEST(Suite, Nome) ou TEST_CASE("nome")', () => {
  const root = project({
    'motor/tests/pedido_test.cpp': 'TEST(Pedido, Salva) {}\nTEST_F(PedidoBase, Volta) {}\n',
    'motor/tests/catch_test.cpp': 'TEST_CASE("soma dois numeros", "[calc]") {}\n',
  })
  const cases = ctestCaseFiles(
    [
      { file: null, name: 'Linux-c++ › Pedido.Salva', status: 'passed' },
      { file: null, name: 'Linux-c++ › PedidoBase.Volta', status: 'failed' },
      { file: null, name: 'Linux-c++ › soma dois numeros', status: 'passed' },
      { file: null, name: 'Linux-c++ › teste_manual', status: 'passed' },
    ],
    root,
    'motor',
  )
  assert.deepEqual(
    cases.map((c) => [c.file, c.name]),
    [
      ['motor/tests/pedido_test.cpp', 'Pedido › Salva'],
      ['motor/tests/pedido_test.cpp', 'PedidoBase › Volta'],
      ['motor/tests/catch_test.cpp', 'soma dois numeros'],
      [null, 'teste_manual'],
    ],
  )
})

test('cargo: com cobertura roda o cargo llvm-cov gravando o lcov na pasta do Faundr', () => {
  const root = project({ 'Cargo.toml': '[package]\nname = "loja"\n' })
  const args = coverageArgs('cargo', root)
  assert.deepEqual(args.slice(0, 2), ['--lcov', '--output-path'])
  assert.ok(args[2].endsWith(path.join('lcov.info')) && path.isAbsolute(args[2]), 'caminho completo do lcov')
  assert.equal(coverageArgs('ctest', root), null, 'CTest ainda sem cobertura')
})
