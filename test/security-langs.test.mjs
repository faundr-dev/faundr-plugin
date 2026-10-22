import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { projectMap, scanProject } from '../bin/security.mjs'

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

test('Go: SQL com Sprintf e +, sh -c, TLS sem conferir, template.HTML, hash fraco e CORS *', async () => {
  const found = await scan({
    'internal/ruim.go': [
      'package app',
      'rows, err := db.Query(fmt.Sprintf("SELECT * FROM users WHERE id = %s", id))',
      'db.Exec("DELETE FROM pedidos WHERE dono = " + dono)',
      'out, _ := exec.Command("sh", "-c", "convert "+arquivo).Output()',
      'tr := &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}',
      'pagina := template.HTML(comentario)',
      'h := md5.Sum([]byte(senha))',
      'c := cors.New(cors.Options{AllowedOrigins: []string{"*"}})',
    ].join('\n'),
    'internal/bom.go': [
      'package app',
      'rows, err := db.Query("SELECT * FROM users WHERE id = $1", id)',
      'db.Where("dono = ?", dono).Find(&pedidos)',
      'out, _ := exec.Command("convert", arquivo, saida).Output()',
      'h, _ := bcrypt.GenerateFromPassword([]byte(senha), 12)',
      'pagina := template.HTML("<b>fixo</b>")',
    ].join('\n'),
    'internal/ruim_test.go': 'package app\nvar tr = &tls.Config{InsecureSkipVerify: true}\n',
  })
  assert.deepEqual(found('internal/ruim.go'), [
    'go-command-injection', 'go-cors-any-origin', 'go-sql-injection', 'go-template-unescaped', 'go-tls-verification-disabled', 'go-weak-password-hash',
  ])
  assert.deepEqual(found('internal/bom.go'), [])
  assert.deepEqual(found('internal/ruim_test.go'), [], 'arquivo de teste fica de fora')
})

test('Java/Kotlin: SQL montado, Runtime.exec, ObjectInputStream, XXE, TLS, senha sem hash, JWT sem assinatura, CSRF e CORS', async () => {
  const found = await scan({
    'src/main/java/com/acme/Ruim.java': [
      'ResultSet rs = st.executeQuery("SELECT * FROM users WHERE id = " + id);',
      'Runtime.getRuntime().exec("convert " + arquivo);',
      'ObjectInputStream in = new ObjectInputStream(req.getInputStream());',
      'DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();',
      'HttpClients.custom().setSSLHostnameVerifier(NoopHostnameVerifier.INSTANCE);',
      'return NoOpPasswordEncoder.getInstance();',
      'Claims c = Jwts.parser().setSigningKey(k).parseClaimsJwt(token).getBody();',
      'http.csrf().disable();',
      '@CrossOrigin(origins = "*")',
    ].join('\n'),
    'src/main/kotlin/Ruim.kt': [
      'val rs = jdbc.queryForList("select * from pedidos where dono = $dono")',
      'val b = OkHttpClient.Builder().hostnameVerifier { _, _ -> true }',
    ].join('\n'),
    'src/main/java/com/acme/Bom.java': [
      'PreparedStatement ps = con.prepareStatement("SELECT * FROM users WHERE id = ?");',
      'new ProcessBuilder("convert", arquivo, saida).start();',
      'DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();',
      'f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);',
      'return new BCryptPasswordEncoder();',
      'Claims c = Jwts.parser().verifyWith(k).build().parseSignedClaims(token).getPayload();',
      '@CrossOrigin(origins = "https://loja.com")',
    ].join('\n'),
    'src/main/java/com/acme/Api.java': ['http.csrf(AbstractHttpConfigurer::disable);', 'http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));'].join('\n'),
  })
  assert.deepEqual(found('src/main/java/com/acme/Ruim.java'), [
    'jvm-command-injection', 'jvm-cors-any-origin', 'jvm-jwt-without-verify', 'jvm-sql-injection', 'jvm-tls-verification-disabled', 'jvm-unsafe-deserialization',
    'jvm-weak-password-hash', 'jvm-xxe', 'spring-csrf-disabled',
  ])
  assert.deepEqual(found('src/main/kotlin/Ruim.kt'), ['jvm-sql-injection', 'jvm-tls-verification-disabled'])
  assert.deepEqual(found('src/main/java/com/acme/Bom.java'), [])
  assert.deepEqual(found('src/main/java/com/acme/Api.java'), [], 'API sem sessão pode desligar o CSRF')
})

test('C#: SQL com FromSqlRaw e +, cmd /c, BinaryFormatter, TLS, Html.Raw, hash fraco, JWT sem validar e CORS', async () => {
  const found = await scan({
    'Loja/Ruim.cs': [
      'var users = db.Users.FromSqlRaw($"SELECT * FROM Users WHERE Name = {nome}").ToList();',
      'var cmd = new SqlCommand("DELETE FROM Pedidos WHERE Dono = " + dono, con);',
      'Process.Start("cmd.exe", "/c convert " + arquivo);',
      'var f = new BinaryFormatter();',
      'handler.ServerCertificateCustomValidationCallback = (m, c, ch, e) => true;',
      'var h = MD5.HashData(Encoding.UTF8.GetBytes(senha));',
      'ValidateIssuerSigningKey = false,',
      'policy.AllowAnyOrigin().AllowAnyHeader();',
    ].join('\n'),
    'Loja/Views/Home/Index.cshtml': '<div>@Html.Raw(Model.Comentario)</div>\n',
    'Loja/Bom.cs': [
      'var users = db.Users.FromSqlInterpolated($"SELECT * FROM Users WHERE Name = {nome}").ToList();',
      'var cmd = new SqlCommand("DELETE FROM Pedidos WHERE Dono = @dono", con);',
      'var p = new ProcessStartInfo("convert"); p.ArgumentList.Add(arquivo);',
      'ValidateIssuerSigningKey = true,',
      'policy.WithOrigins("https://loja.com");',
    ].join('\n'),
    'Loja/Views/Home/Bom.cshtml': '<div>@Model.Comentario</div>\n@Html.Raw("<br>")\n',
  })
  assert.deepEqual(found('Loja/Ruim.cs'), [
    'cs-command-injection', 'cs-cors-any-origin', 'cs-jwt-without-validation', 'cs-sql-injection', 'cs-tls-verification-disabled', 'cs-unsafe-deserialization',
    'cs-weak-password-hash',
  ])
  assert.deepEqual(found('Loja/Views/Home/Index.cshtml'), ['cs-raw-html'])
  assert.deepEqual(found('Loja/Bom.cs'), [])
  assert.deepEqual(found('Loja/Views/Home/Bom.cshtml'), [])
})

test('Rust: SQL com format!, sh -c, TLS sem conferir, CORS liberado, PreEscaped, JWT sem assinatura e hash fraco', async () => {
  const found = await scan({
    'src/ruim.rs': [
      'let rows = sqlx::query(&format!("SELECT * FROM users WHERE id = {}", id)).fetch_all(&pool).await?;',
      'conn.execute(&format!("DELETE FROM pedidos WHERE dono = \'{dono}\'"), [])?;',
      'let out = Command::new("sh").arg("-c").arg(format!("convert {}", arquivo)).output()?;',
      'let client = reqwest::Client::builder().danger_accept_invalid_certs(true).build()?;',
      'let app = Router::new().layer(CorsLayer::permissive());',
      'html! { (PreEscaped(comentario)) }',
      'validation.insecure_disable_signature_validation();',
      'let h = md5::compute(senha.as_bytes());',
    ].join('\n'),
    'src/bom.rs': [
      'let rows = sqlx::query("SELECT * FROM users WHERE id = $1").bind(id).fetch_all(&pool).await?;',
      'let out = Command::new("convert").arg(&arquivo).output()?;',
      'let cors = CorsLayer::new().allow_origin("https://loja.com".parse::<HeaderValue>()?);',
      'html! { (PreEscaped("<b>fixo</b>")) }',
      'let h = argon2.hash_password(senha.as_bytes(), &salt)?;',
    ].join('\n'),
    'tests/api.rs': 'let c = reqwest::Client::builder().danger_accept_invalid_certs(true).build();\n',
  })
  assert.deepEqual(found('src/ruim.rs'), [
    'rust-command-injection', 'rust-cors-any-origin', 'rust-html-unescaped', 'rust-jwt-without-verify', 'rust-sql-injection', 'rust-tls-verification-disabled', 'rust-weak-password-hash',
  ])
  assert.deepEqual(found('src/bom.rs'), [])
  assert.deepEqual(found('tests/api.rs'), [], 'arquivo de teste fica de fora')
})

test('C e C++: gets/strcpy, printf com variável, system(), SQL com sprintf, TLS sem conferir e hash fraco', async () => {
  const found = await scan({
    'src/ruim.c': [
      'gets(nome);',
      'strcpy(destino, entrada);',
      'printf(mensagem);',
      'system(comando);',
      'sprintf(sql, "SELECT * FROM users WHERE nome = \'%s\'", nome);',
      'curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);',
      'MD5((unsigned char*)senha, strlen(senha), hash);',
    ].join('\n'),
    'src/ruim.cpp': [
      'auto sql = std::format("DELETE FROM pedidos WHERE dono = {}", dono);',
      'SSL_CTX_set_verify(ctx, SSL_VERIFY_NONE, nullptr);',
    ].join('\n'),
    'src/bom.c': [
      'fgets(nome, sizeof nome, stdin);',
      'snprintf(destino, sizeof destino, "%s", entrada);',
      'printf("%s", mensagem);',
      'system("clear");',
      'sqlite3_prepare_v2(db, "SELECT * FROM users WHERE nome = ?", -1, &stmt, NULL);',
      'curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);',
    ].join('\n'),
    'tests/ruim_test.c': 'gets(nome);\n',
  })
  assert.deepEqual(found('src/ruim.c'), [
    'c-command-injection', 'c-format-string', 'c-sql-injection', 'c-tls-verification-disabled', 'c-unsafe-string-function', 'c-weak-password-hash',
  ])
  assert.deepEqual(found('src/ruim.cpp'), ['c-sql-injection', 'c-tls-verification-disabled'])
  assert.deepEqual(found('src/bom.c'), [])
  assert.deepEqual(found('tests/ruim_test.c'), [], 'arquivo de teste fica de fora')
})

test('Revisão com IA: Rust, C/C++, Go, Java e C# puxam o tema do catálogo de cada um', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-sm-'))
  for (const rel of ['api/src/main.rs', 'motor/calc.cpp', 'svc/main.go', 'app/App.java', 'web/Program.cs']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), '\n')
  }
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['add', '-A'], { cwd: dir })
  const { topics } = projectMap(dir)
  for (const t of ['rust', 'c-cpp', 'go', 'java-spring', 'dotnet']) assert.ok(topics.includes(t), t)
  for (const t of topics) assert.ok(fs.existsSync(new URL(`../skills/security/catalog/${t}.md`, import.meta.url)), `catálogo ${t}.md existe`)
})
