// Leitores de erro das linguagens fora de JS/TS e Python: Go, Rust, Dart/Flutter, Java/Kotlin (Maven e
// Gradle), C# (.NET), PHP, C/C++ (gcc, clang, MSVC, ctest) e Docker. Mesmo formato dos leitores de
// errors.mjs: { tool, code, message, file, line, index, key? }.

// Arquivo:linha:coluna: mensagem — gcc/clang, go build/vet, Dart (compilação).
const C_LIKE = /^\s*((?:[a-z]:)?[^\s:()]+?\.(c|h|cc|cpp|cxx|hpp|hh|hxx|m|mm|go|dart)):(\d+):(?:\d+:)?\s*(fatal error|error|Error)?:?\s*(.+)$/i

export function goErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    const m = l.match(C_LIKE)
    if (m && m[2].toLowerCase() === 'go' && !/^\s{4,}/.test(l)) out.push({ tool: 'go', code: null, message: m[5].trim(), file: m[1], line: Number(m[3]), index: i })
    // go test: "--- FAIL: TestSoma (0.00s)" seguido de "    soma_test.go:10: esperava 3"
    const t = l.match(/^\s*--- FAIL:\s+(\S+)/)
    if (!t) return
    let file = null
    let line = null
    let reason = ''
    for (let k = i + 1; k < Math.min(lines.length, i + 10); k++) {
      const at = lines[k].match(/^\s+([\w./-]+_test\.go):(\d+):\s*(.*)$/)
      if (at) {
        file = at[1]
        line = Number(at[2])
        reason = at[3].trim()
        break
      }
      if (/^\s*(---|===|FAIL|ok)\b/.test(lines[k])) break
    }
    // O pacote vem no "FAIL\tmodulo/pasta" do fim; o arquivo fica relativo à pasta do teste.
    out.push({ tool: 'go', code: null, message: `Teste falhou: ${t[1]}${reason ? ` (${reason})` : ''}`, file, line, index: i, key: t[1] })
  })
  return out
}

export function rustErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    // error[E0425]: cannot find value `x` in this scope
    //  --> src/main.rs:2:13
    const m = l.match(/^error(?:\[(E\d+)\])?:\s*(.+)$/)
    if (m && !/^(could not compile|aborting due to|test failed)/.test(m[2])) {
      const at = lines.slice(i + 1, i + 4).map((x) => x.match(/^\s*-->\s*(.+?):(\d+):\d+/)).find(Boolean)
      if (at) out.push({ tool: 'cargo', code: m[1] ?? null, message: m[2].trim(), file: at[1], line: Number(at[2]), index: i })
    }
    // cargo test: "thread 'testes::soma' panicked at src/lib.rs:10:9:" (formato antigo: "... panicked at 'msg', src/lib.rs:10:9")
    const p = l.match(/^thread '([^']+)' panicked at (?:'(.*)', )?(.+?):(\d+):\d+:?$/)
    if (p) {
      const reason = p[2] ?? lines[i + 1]?.trim() ?? ''
      out.push({ tool: 'cargo', code: null, message: `Teste falhou: ${p[1]}${reason ? ` (${reason})` : ''}`, file: p[3], line: Number(p[4]), index: i, key: p[1] })
    }
  })
  return out
}

export function dartErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    // flutter/dart analyze: "  error • Undefined name 'x' • lib/main.dart:10:5 • undefined_identifier"
    const a = l.match(/^\s*error\s+•\s+(.+?)\s+•\s+(\S+?\.dart):(\d+):\d+\s+•\s+(\S+)\s*$/)
    if (a) return out.push({ tool: 'dart', code: a[4], message: a[1].trim(), file: a[2], line: Number(a[3]), index: i })
    // compilação (flutter build/run, dart run): "lib/main.dart:10:5: Error: Undefined name 'x'."
    const c = l.match(/^\s*((?:[a-z]:)?[^\s:]+?\.dart):(\d+):\d+:\s*Error:\s*(.+)$/i)
    if (c) return out.push({ tool: 'dart', code: null, message: c[3].trim(), file: c[1], line: Number(c[2]), index: i })
    // flutter test / dart test: "00:02 +0 -1: soma funciona [E]"
    const t = l.match(/^\s*\d+:\d+\s+\+\d+(?:\s+~\d+)?\s+-\d+:\s+(.+?)\s+\[E\]\s*$/)
    if (!t) return
    let file = null
    let line = null
    let reason = ''
    for (let k = i + 1; k < Math.min(lines.length, i + 25); k++) {
      const r = lines[k].trim()
      if (!reason && /^(Expected|Actual|Which|.*Exception|.*Error)\b/.test(r)) reason = r
      const at = r.match(/^((?:test|lib|integration_test)\/\S+?\.dart)\s+(\d+):\d+/)
      if (at) {
        file = at[1]
        line = Number(at[2])
        break
      }
      if (/^\d+:\d+\s+\+\d+/.test(r)) break
    }
    out.push({ tool: 'flutter', code: null, message: `Teste falhou: ${t[1]}${reason ? ` (${reason})` : ''}`, file, line, index: i, key: t[1] })
  })
  return out
}

export function jvmErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    // Maven: "[ERROR] /app/src/main/java/App.java:[12,5] cannot find symbol"
    const mv = l.match(/^\[ERROR\]\s+((?:[a-z]:)?[^\s:]+?\.(?:java|kt|scala)):\[(\d+),\d+\]\s*(.+)$/i)
    if (mv) return out.push({ tool: 'maven', code: null, message: mv[3].trim(), file: mv[1], line: Number(mv[2]), index: i })
    // javac/Gradle: "src/App.java:12: error: cannot find symbol"
    const jc = l.match(/^\s*((?:[a-z]:)?[^\s:]+?\.java):(\d+):\s*error:\s*(.+)$/i)
    if (jc) return out.push({ tool: 'javac', code: null, message: jc[3].trim(), file: jc[1], line: Number(jc[2]), index: i })
    // Kotlin: "e: file:///app/Main.kt:12:5 Unresolved reference: x" ou "e: /app/Main.kt: (12, 5): ..."
    const kt = l.match(/^e:\s+(?:file:\/\/)?((?:[a-z]:)?[^\s:]+?\.kts?)(?::(\d+):\d+|:\s*\((\d+),\s*\d+\):)\s*(.+)$/i)
    if (kt) return out.push({ tool: 'kotlin', code: null, message: kt[4].trim(), file: kt[1], line: Number(kt[2] ?? kt[3]), index: i })
    // Gradle (JUnit): "AppTest > soma() FAILED" e, abaixo, "    at AppTest.java:15"
    const gt = l.match(/^\s*([\w.$]+)\s+>\s+(.+?)\s+FAILED\s*$/)
    if (gt) {
      const near = lines.slice(i + 1, i + 8).map((x) => x.trim())
      const at = near.map((x) => x.match(/\bat\s+\S*?\(([\w$]+\.(?:java|kt)):(\d+)\)/)).find(Boolean)
      const reason = near.find((x) => /(Error|Exception|expected)/.test(x)) ?? ''
      return out.push({ tool: 'gradle', code: null, message: `Teste falhou: ${gt[1]} > ${gt[2]}${reason ? ` (${reason})` : ''}`, file: at?.[1] ?? null, line: at ? Number(at[2]) : null, index: i, key: `${gt[1]}.${gt[2]}` })
    }
    // Maven (Surefire): "[ERROR]   AppTest.soma:15 expected: <3> but was: <4>"
    const sf = l.match(/^\[ERROR\]\s{2,}([\w$]+)\.([\w$]+):(\d+)\s+(.+)$/)
    if (sf) out.push({ tool: 'maven', code: null, message: `Teste falhou: ${sf[1]}.${sf[2]} (${sf[4].trim()})`, file: `${sf[1]}.java`, line: Number(sf[3]), index: i, key: `${sf[1]}.${sf[2]}` })
  })
  return out
}

export function dotnetErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    // "/app/Program.cs(12,5): error CS0103: The name 'x' does not exist [/app/app.csproj]"
    const m = l.match(/^\s*((?:[a-z]:)?[^():]+?\.(?:cs|fs|vb|razor|cshtml))\((\d+),\d+\):\s*error\s+(\w+):\s*(.+?)(?:\s+\[[^\]]+\])?\s*$/i)
    if (m) return out.push({ tool: 'dotnet', code: m[3], message: m[4].trim(), file: m[1], line: Number(m[2]), index: i })
    // dotnet test: "  Failed AppTests.SomaTests.Soma [12 ms]" → "Error Message:" e "at ... in /app/SomaTests.cs:line 15"
    const t = l.match(/^\s*Failed\s+([\w.<>`]+)\s+\[[^\]]*\]\s*$/)
    if (!t) return
    const near = lines.slice(i + 1, i + 20).map((x) => x.trim())
    const msgAt = near.findIndex((x) => /^Error Message:/.test(x))
    const reason = msgAt >= 0 ? near[msgAt + 1] ?? '' : ''
    const at = near.map((x) => x.match(/\bin\s+(.+?\.cs):line\s+(\d+)/)).find(Boolean)
    out.push({ tool: 'dotnet', code: null, message: `Teste falhou: ${t[1]}${reason ? ` (${reason})` : ''}`, file: at?.[1] ?? null, line: at ? Number(at[2]) : null, index: i, key: t[1] })
  })
  return out
}

export function phpErrors(lines) {
  const out = []
  let stanFile = null
  lines.forEach((l, i) => {
    // "PHP Parse error:  syntax error, unexpected ... in /app/x.php on line 12" (também Fatal error, sem "PHP")
    const m = l.match(/^(?:PHP\s+)?(Parse error|Fatal error|Warning|Deprecated):\s+(.+?)\s+in\s+((?:[a-z]:)?\S+?\.php)(?:\s+on line\s+|:)(\d+)/i)
    if (m && /error/i.test(m[1])) return out.push({ tool: 'php', code: m[1], message: m[2].replace(/^Uncaught\s+/, '').trim(), file: m[3], line: Number(m[4]), index: i })
    // PHPUnit: "1) Tests\SomaTest::testSoma" → motivo nas linhas seguintes e "/app/tests/SomaTest.php:15"
    const u = l.match(/^\d+\)\s+([\w\\]+::\w+)/)
    if (u) {
      const near = lines.slice(i + 1, i + 15).map((x) => x.trim())
      const reason = near.find((x) => x && !/^(\/|[a-z]:)/i.test(x)) ?? ''
      const at = near.map((x) => x.match(/^((?:[a-z]:)?\S+?\.php):(\d+)$/i)).find(Boolean)
      return out.push({ tool: 'phpunit', code: null, message: `Teste falhou: ${u[1]}${reason ? ` (${reason})` : ''}`, file: at?.[1] ?? null, line: at ? Number(at[2]) : null, index: i, key: u[1] })
    }
    // PHPStan (tabela): "  Line   src/Soma.php" e depois "  12     Mensagem"
    const h = l.match(/^\s*Line\s+(\S+\.php)\s*$/)
    if (h) return (stanFile = h[1])
    if (/^\s*-{3,}/.test(l) || !l.trim()) return
    const s = stanFile && l.match(/^\s+(\d+)\s{2,}(.+)$/)
    if (s) out.push({ tool: 'phpstan', code: null, message: s[2].trim(), file: stanFile, line: Number(s[1]), index: i })
  })
  return out
}

export function cErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    const m = l.match(C_LIKE)
    if (m && /^(c|h|cc|cpp|cxx|hpp|hh|hxx|m|mm)$/i.test(m[2]) && /error/i.test(m[4] ?? '')) {
      return out.push({ tool: 'cc', code: null, message: m[5].trim(), file: m[1], line: Number(m[3]), index: i })
    }
    // MSVC: "main.cpp(12): error C2065: 'x': undeclared identifier"
    const ms = l.match(/^\s*((?:[a-z]:)?[^():]+?\.(?:c|h|cc|cpp|cxx|hpp))\((\d+)(?:,\d+)?\):\s*(?:fatal\s+)?error\s+(\w+):\s*(.+)$/i)
    if (ms) return out.push({ tool: 'msvc', code: ms[3], message: ms[4].trim(), file: ms[1], line: Number(ms[2]), index: i })
    // ctest: "  1 - soma (Failed)"
    const ct = l.match(/^\s*\d+\s+-\s+(\S+)\s+\((Failed|SEGFAULT|Timeout|Exception|Not Run)\)/)
    if (ct) out.push({ tool: 'ctest', code: null, message: `Teste falhou: ${ct[1]} (${ct[2]})`, file: null, line: null, index: i, key: ct[1] })
    // Linker: "undefined reference to `soma'"
    const ld = l.match(/undefined reference to [`'"]([^`'"]+)[`'"]|Undefined symbols? .*?"([^"]+)"/)
    if (ld) out.push({ tool: 'ld', code: 'link', message: `Referência não encontrada na ligação: ${ld[1] ?? ld[2]}`, file: null, line: null, index: i, key: ld[1] ?? ld[2] })
  })
  return out
}

export function dockerErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    // "ERROR: failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1"
    // Só a linha de erro do BuildKit; outros "ERROR" (de um RUN que roda testes, por exemplo) ficam no trecho.
    const m = l.match(/^(?:#\d+\s+)?ERROR:?\s+(?:failed to (?:solve|build)(?: with frontend dockerfile\.v0)?:\s*)(.+)$/)
    if (!m) return
    let file = 'Dockerfile'
    let line = Number(m[1].match(/dockerfile parse error (?:on )?line (\d+)/i)?.[1]) || null
    for (let k = Math.max(0, i - 15); k < Math.min(lines.length, i + 15) && !line; k++) {
      const at = lines[k].match(/^\s*((?:[\w./-]*\/)?(?:Dockerfile[\w.-]*|[\w.-]+\.dockerfile)):(\d+)\s*$/i)
      if (at) {
        file = at[1]
        line = Number(at[2])
      }
    }
    out.push({ tool: 'docker', code: null, message: m[1].trim().replace(/\s+/g, ' '), file, line, index: i })
  })
  return out.slice(0, 1) // o Docker repete o mesmo erro no fim
}

// Angular: "Error: src/app/x.component.html:3:5 - error NG8002: ..." (o tsc de errors.mjs lê os .ts)
export function angularErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:Error:\s*)?(\S+?\.html):(\d+):\d+\s*-\s*error\s+(NG\d+|TS\d+):\s*(.+)$/)
    if (m) out.push({ tool: 'ng', code: m[3], message: m[4].trim(), file: m[1], line: Number(m[2]), index: i })
    // ng test (Karma): "Chrome 120 (Linux) AppComponent deve criar FAILED"
    const k = l.match(/^\s*(?:Chrome|Firefox|Edge|Safari|ChromeHeadless)[^)]*\)\s+(.+?)\s+FAILED\s*$/)
    if (k) out.push({ tool: 'karma', code: null, message: `Teste falhou: ${k[1]}`, file: null, line: null, index: i, key: k[1] })
  })
  return out
}

export const LANG_READERS = [goErrors, rustErrors, dartErrors, jvmErrors, dotnetErrors, phpErrors, cErrors, angularErrors, dockerErrors]
// Ferramenta → tipo, quando ela sempre é do mesmo tipo (as outras ficam com o tipo do comando).
export const LANG_TOOL_KIND = { karma: 'test', ctest: 'test', phpunit: 'test', phpstan: 'typecheck', javac: 'build', msvc: 'build', ld: 'build', docker: 'build' }
