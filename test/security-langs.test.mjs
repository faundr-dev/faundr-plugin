import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { scanProject } from '../bin/security.mjs'

// Projeto de exemplo no git; devolve as regras de código achadas em cada arquivo.
async function scan(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-sl-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['add', '-A'], { cwd: dir })
  const { findings } = await scanProject(dir, { deps: false })
  return (file) => [...new Set(findings.filter((f) => f.source === 'code' && f.file === file).map((f) => f.rule_id))].sort()
}

test('PHP: SQL, comando, include, unserialize, echo e Blade sem escapar, hash fraco e $guarded vazio', async () => {
  const found = await scan({
    'app/Ruim.php': [
      '<?php',
      '$r = $pdo->query("SELECT * FROM users WHERE id = $id");',
      'DB::select("select * from pedidos where dono = " . $dono);',
      'shell_exec("convert " . $_GET["f"]);',
      'include $_GET["pagina"] . ".php";',
      '$o = unserialize($_COOKIE["c"]);',
      'echo "Olá " . $_GET["nome"];',
      '$h = md5($senha);',
      "curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);",
      'class User extends Model { protected $guarded = []; }',
    ].join('\n'),
    'app/Bom.php': [
      '<?php',
      '$s = $pdo->prepare("SELECT * FROM users WHERE id = ?");',
      'echo htmlspecialchars($_GET["nome"], ENT_QUOTES);',
      'shell_exec("ls " . escapeshellarg($dir));',
      '$h = password_hash($senha, PASSWORD_DEFAULT);',
      '$o = unserialize($dados, ["allowed_classes" => false]);',
    ].join('\n'),
    'resources/views/perfil.blade.php': '<div>{!! $bio !!}</div>\n<p>{{ $nome }}</p>\n',
  })
  assert.deepEqual(found('app/Ruim.php'), [
    'laravel-mass-assignment', 'php-command-injection', 'php-file-inclusion', 'php-sql-injection', 'php-tls-verification-disabled',
    'php-unsafe-deserialization', 'php-weak-password-hash', 'php-xss-echo',
  ])
  assert.deepEqual(found('app/Bom.php'), [])
  assert.deepEqual(found('resources/views/perfil.blade.php'), ['blade-raw-output'])
})

test('Flutter: certificado aceito sem conferir, http://, token em SharedPreferences e SQL do sqflite', async () => {
  const found = await scan({
    'lib/api.dart': [
      "final base = 'http://api.minhaloja.com.br';",
      'client.badCertificateCallback = (cert, host, port) => true;',
      "await prefs.setString('auth_token', token);",
      "await db.rawQuery('SELECT * FROM pedidos WHERE id = $id');",
    ].join('\n'),
    'lib/ok.dart': [
      "final base = 'https://api.minhaloja.com.br';",
      "final dev = 'http://10.0.2.2:8000';",
      "await storage.write(key: 'auth_token', value: token);",
      "await db.rawQuery('SELECT * FROM pedidos WHERE id = ?', [id]);",
    ].join('\n'),
  })
  assert.deepEqual(found('lib/api.dart'), ['dart-cleartext-http', 'dart-insecure-token-storage', 'dart-sql-injection', 'dart-tls-verification-disabled'])
  assert.deepEqual(found('lib/ok.dart'), [])
})

test('Python: SQL com f-string, os.system, exec, debug ligado, JWT sem conferir, hash fraco e CORS *', async () => {
  const found = await scan({
    'app/ruim.py': [
      'cur.execute(f"SELECT * FROM users WHERE id = {uid}")',
      'os.system("convert " + nome)',
      'exec(codigo)',
      'app.run(debug=True)',
      'dados = jwt.decode(token, options={"verify_signature": False})',
      'h = hashlib.md5(senha.encode())',
      'app.add_middleware(CORSMiddleware, allow_origins=["*"])',
    ].join('\n'),
    'app/bom.py': [
      'cur.execute("SELECT * FROM users WHERE id = %s", (uid,))',
      'subprocess.run(["convert", nome])',
      'dados = jwt.decode(token, chave, algorithms=["HS256"])',
      'app.run(debug=os.environ.get("DEBUG") == "1")',
    ].join('\n'),
  })
  assert.deepEqual(found('app/ruim.py'), [
    'python-command-injection', 'python-cors-any-origin', 'python-debug-mode', 'python-exec', 'python-jwt-without-verify', 'python-sql-injection',
    'python-weak-password-hash',
  ])
  assert.deepEqual(found('app/bom.py'), [])
})
