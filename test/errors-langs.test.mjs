import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classify, parseErrors } from '../bin/errors.mjs'
import { setLang } from '../bin/i18n.mjs'

// Os títulos dos E-n vão para o painel na língua da pessoa: fixa o português (e confere o inglês no Go).
setLang('pt')

// Saídas reais (encurtadas) de cada ferramenta: o erro precisa sair com arquivo e linha.
const parse = (output, kind) => parseErrors(output, { kind, root: '/p', failed: true })
const first = (output, kind) => {
  const [e] = parse(output, kind)
  return e && { file: e.file, line: e.line, title: e.title }
}

test('comandos das outras linguagens são reconhecidos; servidores e instalação não', () => {
  const kinds = {
    'go test ./...': 'test', 'go build ./...': 'build', 'go vet ./...': 'lint', 'cargo test': 'test', 'cargo build --release': 'build',
    'cargo clippy': 'lint', 'cargo check': 'typecheck', 'flutter test': 'test', 'flutter analyze': 'typecheck', 'flutter build apk': 'build',
    'dart test': 'test', 'mvn test': 'test', './mvnw -q package': 'build', './gradlew test': 'test', 'gradle assembleDebug': 'build',
    'dotnet test': 'test', 'dotnet build': 'build', 'vendor/bin/phpunit': 'test', 'php artisan test': 'test', 'vendor/bin/phpstan analyse': 'typecheck',
    'make': 'build', 'make test': 'test', 'cmake --build build': 'build', 'ctest --output-on-failure': 'test', 'g++ main.cpp -o app': 'build',
    'docker build -t app .': 'build', 'docker compose build': 'build', 'ng build': 'build', 'ng test --watch=false': 'test',
  }
  for (const [cmd, kind] of Object.entries(kinds)) assert.equal(classify(cmd)?.kind, kind, cmd)
  for (const cmd of ['flutter run', 'docker run app', 'composer install', 'mvn spring-boot:run', 'go mod tidy', 'docker compose up']) {
    assert.ok(!classify(cmd) || classify(cmd).kind === 'run', cmd)
  }
})

test('Go: compilação e teste', () => {
  assert.deepEqual(first('# app/soma\n./soma.go:5:9: undefined: total\n', 'build'), { file: 'soma.go', line: 5, title: 'undefined: total' })
  const t = first(`=== RUN   TestSoma
--- FAIL: TestSoma (0.00s)
    soma_test.go:10: esperava 3, veio 4
FAIL
FAIL\tapp/soma\t0.002s`, 'test')
  assert.deepEqual(t, { file: 'soma_test.go', line: 10, title: 'Teste falhou: TestSoma (esperava 3, veio 4)' })
  setLang('en')
  assert.equal(first('--- FAIL: TestSoma (0.00s)\n    soma_test.go:10: esperava 3, veio 4\nFAIL', 'test').title, 'Test failed: TestSoma (esperava 3, veio 4)')
  setLang('pt')
})

test('Rust: compilação e teste', () => {
  assert.deepEqual(first(`error[E0425]: cannot find value \`x\` in this scope
 --> src/main.rs:2:13
  |
2 |     println!("{}", x);
  |                    ^ not found in this scope
error: could not compile \`app\` (bin "app") due to 1 previous error`, 'build'), { file: 'src/main.rs', line: 2, title: 'cannot find value `x` in this scope' })
  const t = parse(`running 1 test
test testes::soma ... FAILED

failures:

---- testes::soma stdout ----

thread 'testes::soma' panicked at src/lib.rs:10:9:
assertion \`left == right\` failed
  left: 4
 right: 3`, 'test')
  assert.equal(t.length, 1)
  assert.deepEqual({ file: t[0].file, line: t[0].line }, { file: 'src/lib.rs', line: 10 })
  assert.match(t[0].title, /^Teste falhou: testes::soma \(assertion/)
})

test('Flutter e Dart: análise, compilação e teste', () => {
  assert.deepEqual(first(`Analyzing app...

  error • Undefined name 'contador' • lib/main.dart:42:7 • undefined_identifier
warning • Unused import • lib/main.dart:3:8 • unused_import

2 issues found. (ran in 1.2s)`, 'typecheck'), { file: 'lib/main.dart', line: 42, title: "Undefined name 'contador'" })
  assert.deepEqual(first("lib/main.dart:42:7: Error: Undefined name 'contador'.\n    contador++;\n    ^^^^^^^^", 'build'), {
    file: 'lib/main.dart', line: 42, title: "Undefined name 'contador'.",
  })
  const t = first(`00:01 +0: loading test/widget_test.dart
00:02 +0 -1: Contador aumenta [E]
  Expected: exactly one matching candidate
    Actual: _TextWidgetFinder:<Found 0 widgets with text "1": []>

  package:flutter_test/src/expect.dart 149:31  expect
  test/widget_test.dart 20:5                   main.<fn>

00:02 +0 -1: Some tests failed.`, 'test')
  assert.deepEqual(t, { file: 'test/widget_test.dart', line: 20, title: 'Teste falhou: Contador aumenta (Expected: exactly one matching candidate)' })
})

test('Java e Kotlin: Maven, Gradle e javac', () => {
  assert.deepEqual(first('[ERROR] /p/src/main/java/app/App.java:[12,5] cannot find symbol\n[ERROR]   symbol: variable total', 'build'), {
    file: 'src/main/java/app/App.java', line: 12, title: 'cannot find symbol',
  })
  assert.deepEqual(first('src/App.java:12: error: cannot find symbol\n        total++;', 'build'), { file: 'src/App.java', line: 12, title: 'cannot find symbol' })
  assert.deepEqual(first("e: file:///p/app/src/main/kotlin/Main.kt:7:5 Unresolved reference 'total'.", 'build'), {
    file: 'app/src/main/kotlin/Main.kt', line: 7, title: "Unresolved reference 'total'.",
  })
  const g = first(`> Task :test FAILED

SomaTest > soma() FAILED
    org.opentest4j.AssertionFailedError: expected: <3> but was: <4>
        at app//SomaTest.soma(SomaTest.java:15)

1 test completed, 1 failed`, 'test')
  assert.deepEqual(g, { file: 'SomaTest.java', line: 15, title: 'Teste falhou: SomaTest > soma() (org.opentest4j.AssertionFailedError: expected: <3> but was: <4>)' })
  const m = first('[ERROR] Failures: \n[ERROR]   SomaTest.soma:15 expected: <3> but was: <4>\n[ERROR] Tests run: 1, Failures: 1', 'test')
  assert.equal(m.line, 15)
  assert.match(m.title, /SomaTest\.soma/)
})

test('C#: dotnet build e dotnet test', () => {
  assert.deepEqual(first("/p/Program.cs(12,5): error CS0103: The name 'total' does not exist in the current context [/p/app.csproj]", 'build'), {
    file: 'Program.cs', line: 12, title: "The name 'total' does not exist in the current context",
  })
  const t = first(`  Failed App.Tests.SomaTests.Soma [12 ms]
  Error Message:
   Assert.Equal() Failure: Values differ
  Stack Trace:
     at App.Tests.SomaTests.Soma() in /p/tests/SomaTests.cs:line 15`, 'test')
  assert.deepEqual(t, { file: 'tests/SomaTests.cs', line: 15, title: 'Teste falhou: App.Tests.SomaTests.Soma (Assert.Equal() Failure: Values differ)' })
})

test('PHP: erro de sintaxe, PHPUnit e PHPStan', () => {
  assert.deepEqual(first('PHP Parse error:  syntax error, unexpected token "}" in /p/src/Soma.php on line 12', 'run'), {
    file: 'src/Soma.php', line: 12, title: 'syntax error, unexpected token "}"',
  })
  const u = first(`There was 1 failure:

1) Tests\\SomaTest::testSoma
Failed asserting that 4 matches expected 3.

/p/tests/SomaTest.php:15

FAILURES!`, 'test')
  assert.deepEqual(u, { file: 'tests/SomaTest.php', line: 15, title: 'Teste falhou: Tests\\SomaTest::testSoma (Failed asserting that 4 matches expected 3.)' })
  const s = first(` ------ ------------------------------------------
  Line   src/Soma.php
 ------ ------------------------------------------
  12     Undefined variable: $total
 ------ ------------------------------------------`, 'typecheck')
  assert.deepEqual(s, { file: 'src/Soma.php', line: 12, title: 'Undefined variable: $total' })
})

test('C e C++: gcc, clang, MSVC, ligação e ctest', () => {
  assert.deepEqual(first("src/main.c:12:5: error: 'total' undeclared (first use in this function)", 'build'), {
    file: 'src/main.c', line: 12, title: "'total' undeclared (first use in this function)",
  })
  assert.deepEqual(first("main.cpp(12): error C2065: 'total': undeclared identifier", 'build'), { file: 'main.cpp', line: 12, title: "'total': undeclared identifier" })
  assert.equal(parse('src/main.c:3:5: warning: unused variable', 'build').filter((e) => e.file).length, 0)
  assert.match(first("/usr/bin/ld: main.o: in function `main':\nmain.c:(.text+0x9): undefined reference to `soma'", 'build').title, /soma/)
  assert.equal(first('The following tests FAILED:\n\t  1 - soma (Failed)\nErrors while running CTest', 'test').title, 'Teste falhou: soma (Failed)')
})

test('Docker: o erro aponta a linha do Dockerfile', () => {
  const d = first(`#8 [4/5] RUN npm ci
#8 ERROR: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
------
Dockerfile:12
--------------------
  12 | >>> RUN npm ci
--------------------
ERROR: failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1`, 'build')
  assert.deepEqual(d, { file: 'Dockerfile', line: 12, title: 'process "/bin/sh -c npm ci" did not complete successfully: exit code: 1' })
})

test('Angular: template com erro', () => {
  assert.deepEqual(first("Error: src/app/app.component.html:3:5 - error NG8002: Can't bind to 'ngModel'", 'build'), {
    file: 'src/app/app.component.html', line: 3, title: "Can't bind to 'ngModel'",
  })
})
