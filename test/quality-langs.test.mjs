import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { runQuality } from '../bin/quality-rules.mjs'

// Projeto de exemplo no git (a checagem lê o que está no git); devolve as regras achadas por arquivo.
async function check(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-ql-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['add', '-A'], { cwd: dir })
  const result = await runQuality(dir, { history: false, tools: false })
  const found = (file) => result.findings.filter((f) => f.file === file).map((f) => f.rule_id)
  return { result, found }
}

// Função com 25 caminhos (ifs em sequência), em cada linguagem.
const ifs = (fmt) => Array.from({ length: 25 }, (_, i) => fmt(i)).join('\n')

test('Dart: catch vazio, print esquecido, função complexa e teste sem expect', async () => {
  const { result, found } = await check({
    'pubspec.yaml': 'name: loja\n',
    'lib/main.dart': "import 'package:loja/carrinho.dart';\n\nvoid main() {\n  print(total([1, 2]));\n}\n",
    'lib/carrinho.dart': `int total(List<int> xs) {\n  try {\n    return xs.reduce((a, b) => a + b);\n  } catch (e) {}\n  return 0;\n}\n\nint nota(int x) {\n${ifs((i) => `  if (x == ${i}) return ${i};`)}\n  return -1;\n}\n`,
    'lib/sobra.dart': 'int nada() => 0;\n',
    'test/carrinho_test.dart': "import 'package:test/test.dart';\n\nvoid main() {\n  test('soma', () {\n    final x = 1 + 1;\n  });\n}\n",
  })
  assert.deepEqual(found('lib/carrinho.dart').sort(), ['complexidade/funcao', 'falha/catch-vazio'])
  assert.deepEqual(found('lib/main.dart'), ['limpeza/print-esquecido'])
  assert.deepEqual(found('lib/sobra.dart'), ['morto/arquivo-orfao'])
  assert.deepEqual(found('test/carrinho_test.dart'), ['testes/sem-conferencia'])
  assert.ok(result.stats.files >= 4, 'os arquivos .dart entram na contagem')
})

test('PHP: catch vazio, var_dump e dd esquecidos, função complexa e teste do PHPUnit sem asserção', async () => {
  const { found } = await check({
    'composer.json': JSON.stringify({ autoload: { 'psr-4': { 'App\\': 'app/' } } }),
    'public/index.php': "<?php\nrequire __DIR__ . '/../app/Pedido.php';\n",
    'app/Pedido.php': `<?php\nnamespace App;\n\nclass Pedido {\n    public function salvar($p) {\n        try { $p->save(); } catch (\\Exception $e) { }\n        var_dump($p);\n        dd($p);\n    }\n    public function nota($x) {\n${ifs((i) => `        if ($x == ${i}) return ${i};`)}\n        return -1;\n    }\n}\n`,
    'app/Velho.php': '<?php\nnamespace App;\n\nclass Velho {}\n',
    'tests/PedidoTest.php': "<?php\nclass PedidoTest extends TestCase {\n    public function testSalva() {\n        $p = new Pedido();\n    }\n}\n",
  })
  assert.deepEqual(found('app/Pedido.php').sort(), ['complexidade/funcao', 'falha/catch-vazio', 'limpeza/debugger', 'limpeza/print-esquecido'])
  assert.deepEqual(found('app/Velho.php'), ['morto/arquivo-orfao'])
  assert.deepEqual(found('tests/PedidoTest.php'), ['testes/sem-conferencia'])
})

test('Python: função que ninguém importa vira código sem uso; rota com decorador não', async () => {
  const { found } = await check({
    'app.py': 'from loja.precos import aplica_cupom\n\nprint(aplica_cupom(10))\n',
    'loja/__init__.py': '',
    'loja/precos.py':
      'from flask import Blueprint\nbp = Blueprint("p", __name__)\n\ndef aplica_cupom(total):\n    return total * 0.9\n\ndef esquecida(x):\n    return x\n\n@bp.route("/precos")\ndef rota():\n    return "ok"\n\ndef _interna():\n    return 1\n',
    'loja/orfao.py': 'def nada():\n    return 0\n',
  })
  assert.deepEqual(found('loja/precos.py'), ['morto/export-sem-uso'])
  assert.deepEqual(found('loja/orfao.py'), ['morto/arquivo-orfao'])
})

test('Go: if err != nil vazio, que só loga ou devolve nil; println e fmt.Print fora do main; teste sem conferência', async () => {
  const { found } = await check({
    'go.mod': 'module example.com/loja\n',
    'cmd/api/main.go': 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("subiu")\n}\n',
    'internal/pedido/pedido.go': `package pedido\n\nimport (\n\t"fmt"\n\t"log"\n)\n\nfunc Salva(p int) error {\n\terr := grava(p)\n\tif err != nil {\n\t}\n\tif err != nil {\n\t\tlog.Println(err)\n\t}\n\tfmt.Println("salvo")\n\tprintln("debug")\n\treturn nil\n}\n\nfunc Busca(id int) (*int, error) {\n\tv, err := le(id)\n\tif err != nil {\n\t\treturn nil, nil\n\t}\n\treturn v, nil\n}\n\nfunc Nota(x int) int {\n${ifs((i) => `\tif x == ${i} {\n\t\treturn ${i}\n\t}`)}\n\treturn -1\n}\n`,
    'internal/pedido/ok.go': 'package pedido\n\nfunc Confere(err error) error {\n\tif err != nil {\n\t\treturn fmt.Errorf("salva: %w", err)\n\t}\n\treturn nil\n}\n',
    'internal/pedido/pedido_test.go':
      'package pedido\n\nimport "testing"\n\nfunc TestSalva(t *testing.T) {\n\tSalva(1)\n}\n\nfunc TestBusca(t *testing.T) {\n\tif _, err := Busca(1); err != nil {\n\t\tt.Fatal(err)\n\t}\n}\n\nfunc TestPulado(t *testing.T) {\n\tt.Skip("depois")\n}\n',
  })
  assert.deepEqual(found('cmd/api/main.go'), [], 'fmt.Println no package main é a saída do programa')
  assert.deepEqual(found('internal/pedido/pedido.go').sort(), ['complexidade/funcao', 'falha/catch-devolve-nulo', 'falha/catch-so-loga', 'falha/catch-vazio', 'limpeza/print-esquecido'])
  assert.deepEqual(found('internal/pedido/ok.go'), [], 'erro devolvido com contexto está certo')
  assert.deepEqual(found('internal/pedido/pedido_test.go').sort(), ['testes/pulado', 'testes/sem-conferencia'])
})

test('Java: catch vazio e só com printStackTrace, System.out fora do main, ternário aninhado; JUnit sem assert e @Disabled', async () => {
  const { found } = await check({
    'pom.xml': '<project></project>\n',
    'src/main/java/com/acme/App.java': 'package com.acme;\n\npublic class App {\n    public static void main(String[] args) {\n        System.out.println("subiu");\n    }\n}\n',
    'src/main/java/com/acme/Pedido.java': `package com.acme;\n\npublic class Pedido {\n    public String salva(int p) {\n        try {\n            grava(p);\n        } catch (Exception e) {\n        }\n        try {\n            grava(p);\n        } catch (Exception e) {\n            e.printStackTrace();\n        }\n        System.out.println("salvo");\n        return p > 0 ? "a" : p < 0 ? "b" : "c";\n    }\n    public int nota(int x) {\n${ifs((i) => `        if (x == ${i}) return ${i};`)}\n        return -1;\n    }\n    private void grava(int p) throws Exception {}\n}\n`,
    'src/test/java/com/acme/PedidoTest.java':
      'package com.acme;\n\nimport org.junit.jupiter.api.*;\nimport static org.junit.jupiter.api.Assertions.*;\n\nclass PedidoTest {\n    @Test\n    void salva() {\n        new Pedido().salva(1);\n    }\n    @Test\n    void nota() {\n        assertEquals(1, new Pedido().nota(1));\n    }\n    @Disabled\n    @Test\n    void velho() {}\n}\n',
  })
  assert.deepEqual(found('src/main/java/com/acme/App.java'), [])
  assert.deepEqual(found('src/main/java/com/acme/Pedido.java').sort(), ['complexidade/funcao', 'complexidade/ternario-aninhado', 'falha/catch-so-loga', 'falha/catch-vazio', 'limpeza/print-esquecido'])
  assert.deepEqual(found('src/test/java/com/acme/PedidoTest.java').sort(), ['testes/pulado', 'testes/sem-conferencia'])
})

test('Kotlin: catch vazio, catch que devolve null, println fora do main e teste sem conferência', async () => {
  const { found } = await check({
    'build.gradle.kts': 'plugins { kotlin("jvm") }\n',
    'src/main/kotlin/Main.kt': 'fun main() {\n    println("subiu")\n}\n',
    'src/main/kotlin/Pedido.kt':
      'package loja\n\nclass Pedido {\n    fun salva(p: Int): String? {\n        try {\n            grava(p)\n        } catch (e: Exception) {\n        }\n        println("salvo")\n        return try {\n            le(p)\n        } catch (e: Exception) {\n            null\n        }\n    }\n    private fun grava(p: Int) {}\n    private fun le(p: Int): String = "x"\n}\n',
    'src/test/kotlin/PedidoTest.kt': 'import org.junit.jupiter.api.Test\nimport kotlin.test.assertEquals\n\nclass PedidoTest {\n    @Test\n    fun salva() {\n        Pedido().salva(1)\n    }\n    @Test\n    fun le() {\n        assertEquals("x", Pedido().salva(1))\n    }\n}\n',
  })
  assert.deepEqual(found('src/main/kotlin/Main.kt'), [])
  assert.deepEqual(found('src/main/kotlin/Pedido.kt').sort(), ['falha/catch-devolve-nulo', 'falha/catch-vazio', 'limpeza/print-esquecido'])
  assert.deepEqual(found('src/test/kotlin/PedidoTest.kt'), ['testes/sem-conferencia'])
})

test('C#: catch vazio e que devolve null, Console.WriteLine fora do Program, Debugger.Break; xUnit sem Assert e com Skip', async () => {
  const { found } = await check({
    'Loja/Loja.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>\n',
    'Loja/Program.cs': 'Console.WriteLine("subiu");\n',
    'Loja/Pedido.cs': `namespace Loja;\n\npublic class Pedido\n{\n    public string? Salva(int p)\n    {\n        try { Grava(p); } catch (Exception) { }\n        Console.WriteLine("salvo");\n        System.Diagnostics.Debugger.Break();\n        try { return Le(p); } catch { return null; }\n    }\n    public int Nota(int x)\n    {\n${ifs((i) => `        if (x == ${i}) return ${i};`)}\n        return -1;\n    }\n    void Grava(int p) { }\n    string Le(int p) => "x";\n}\n`,
    'Loja.Tests/PedidoTests.cs':
      'using Xunit;\n\npublic class PedidoTests\n{\n    [Fact]\n    public void Salva()\n    {\n        new Loja.Pedido().Salva(1);\n    }\n    [Fact]\n    public void Nota() => Assert.Equal(1, new Loja.Pedido().Nota(1));\n    [Fact(Skip = "depois")]\n    public void Velho() { }\n}\n',
  })
  assert.deepEqual(found('Loja/Program.cs'), [])
  assert.deepEqual(found('Loja/Pedido.cs').sort(), ['complexidade/funcao', 'falha/catch-devolve-nulo', 'falha/catch-vazio', 'limpeza/debugger', 'limpeza/print-esquecido'])
  assert.deepEqual(found('Loja.Tests/PedidoTests.cs').sort(), ['testes/pulado', 'testes/sem-conferencia'])
})

test('Rust: Err(_) vazio, que só loga ou vira None; println! fora do main, dbg! e unwrap(); #[test] sem assert e #[ignore]', async () => {
  const { found } = await check({
    'Cargo.toml': '[package]\nname = "loja"\nversion = "0.1.0"\n',
    'src/main.rs': 'mod pedido;\n\nfn main() {\n    println!("subiu");\n    pedido::salva(1);\n}\n',
    'src/pedido.rs': `pub fn salva(p: i32) -> Option<i32> {\n    match grava(p) {\n        Ok(_) => {}\n        Err(_) => {}\n    }\n    if let Err(e) = grava(p) {\n        eprintln!("{}", e);\n    }\n    println!("salvo");\n    dbg!(p);\n    let v = le(p).unwrap();\n    match le(v) {\n        Ok(x) => Some(x),\n        Err(_) => None,\n    }\n}\n\npub fn nota(x: i32) -> i32 {\n${ifs((i) => `    if x == ${i} {\n        return ${i};\n    }`)}\n    -1\n}\n\nfn grava(_p: i32) -> Result<(), String> {\n    Ok(())\n}\n\nfn le(p: i32) -> Result<i32, String> {\n    Ok(p)\n}\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn salva_ok() {\n        salva(1);\n    }\n\n    #[test]\n    fn le_ok() {\n        assert_eq!(le(1).unwrap(), 1);\n    }\n\n    #[test]\n    #[ignore]\n    fn velho() {}\n}\n`,
    'src/ok.rs': 'pub fn confere(r: Result<i32, String>) -> Result<i32, String> {\n    match r {\n        Ok(x) => Ok(x),\n        Err(e) => Err(format!("salva: {e}")),\n    }\n}\n',
  })
  assert.deepEqual(found('src/main.rs'), [], 'println! no main é a saída do programa')
  assert.deepEqual(found('src/pedido.rs').sort(), ['complexidade/funcao', 'falha/catch-devolve-nulo', 'falha/catch-so-loga', 'falha/catch-vazio', 'falha/unwrap', 'limpeza/print-esquecido', 'testes/pulado', 'testes/sem-conferencia'])
  assert.deepEqual(found('src/ok.rs'), [], 'erro devolvido com contexto está certo')
})

test('C e C++: catch vazio e que só loga, função complexa; GoogleTest sem EXPECT e DISABLED_', async () => {
  const { found } = await check({
    'CMakeLists.txt': 'project(loja)\n',
    'src/main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "subiu" << std::endl;\n    return 0;\n}\n',
    'src/pedido.cpp': `#include <iostream>\n\nint grava(int p);\n\nint salva(int p) {\n    try {\n        grava(p);\n    } catch (...) {\n    }\n    try {\n        grava(p);\n    } catch (const std::exception& e) {\n        std::cerr << e.what() << std::endl;\n    }\n    return p;\n}\n`,
    'src/nota.c': `int nota(int x) {\n${ifs((i) => `    if (x == ${i}) return ${i};`)}\n    return -1;\n}\n`,
    'tests/pedido_test.cpp': '#include <gtest/gtest.h>\n\nint salva(int p);\n\nTEST(Pedido, Salva) {\n    salva(1);\n}\n\nTEST(Pedido, Volta) {\n    EXPECT_EQ(salva(1), 1);\n}\n\nTEST(Pedido, DISABLED_Velho) {\n}\n',
  })
  assert.deepEqual(found('src/main.cpp'), [])
  assert.deepEqual(found('src/pedido.cpp').sort(), ['falha/catch-so-loga', 'falha/catch-vazio'])
  assert.deepEqual(found('src/nota.c'), ['complexidade/funcao'])
  assert.deepEqual(found('tests/pedido_test.cpp').sort(), ['testes/pulado', 'testes/sem-conferencia'])
})
