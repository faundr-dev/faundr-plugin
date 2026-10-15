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
