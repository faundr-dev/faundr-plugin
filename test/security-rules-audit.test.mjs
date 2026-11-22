// Correções da auditoria das regras automáticas de Segurança: cada caso tem o exemplo ruim (acusa) e um parecido
// inocente (não acusa), para não trocar falso negativo por alarme falso.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { scanProject, maskPayload } from '../bin/security.mjs'
import { findCommonSecrets, maskShort, isRuleDefinitionPath } from '../bin/security-secrets.mjs'

// Projeto de exemplo no git; devolve os achados visíveis (sem os suprimidos pelo filtro de ruído).
async function findingsOf(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-audit-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['add', '-A'], { cwd: dir })
  const { findings } = await scanProject(dir, { deps: false })
  fs.rmSync(dir, { recursive: true, force: true })
  return findings.filter((f) => !f.suppressed)
}

// "regra@arquivo" das regras pedidas.
async function scan(files, rules) {
  return (await findingsOf(files)).filter((f) => rules.includes(f.rule_id)).map((f) => `${f.rule_id}@${f.file}`).sort()
}

// Valores montados em pedaços para a própria checagem não acusar este arquivo.
const PW = ['Tr0ub4dor', 'x9Kq'].join('')
const KEY = ['a8Fk2Lm9', 'Qz7Xc4Vb', '6Nn1Pp0R'].join('')
const WHSEC = `whsec_${['mF3kQ9zL', 'x7Vb2NnP', '0RtY6uWc', 'A1sD4gHj'].join('')}`

// ---- A. segredos em formato comum ----------------------------------------------------------------

const COMMON = ['hardcoded-password', 'hardcoded-secret', 'hardcoded-bearer-token', 'url-with-credentials', 'stripe-webhook-secret']

test('segredo em formato comum: os formatos reais acusam', () => {
  const real = [
    ['deploy.sh', `DB_PASSWORD=${PW}`, 'hardcoded-password'],
    ['deploy.sh', `export PGPASSWORD=${PW}`, 'hardcoded-password'],
    ['src/db.py', `password = "${PW}"`, 'hardcoded-password'],
    ['src/db.js', `const senha = '${PW}'`, 'hardcoded-password'],
    ['src/db.js', `  password: "${PW}",`, 'hardcoded-password'],
    ['src/login.js', `if (req.body.password === "${PW}") grant()`, 'hardcoded-password'],
    ['scripts/backup.sh', `mysql -u root -p${PW} app < dump.sql`, 'hardcoded-password'],
    ['package.json', `"db": "mysqldump --password=${PW} app"`, 'hardcoded-password'],
    ['src/db.ts', `const url = "postgresql://app:${PW}@db.acme.io:5432/app"`, 'url-with-credentials'],
    ['src/api.ts', `fetch("https://admin:${PW}@api.acme.io/v1")`, 'url-with-credentials'],
    ['config/app.yml', `password: ${PW}`, 'hardcoded-password'],
    ['config/app.yml', `  db_password: "${PW}"`, 'hardcoded-password'],
    ['config/app.json', `  "password": "${PW}",`, 'hardcoded-password'],
    ['src/auth.ts', `const JWT_SECRET="${KEY}"`, 'hardcoded-secret'],
    ['src/api.py', `api_key="${KEY}"`, 'hardcoded-secret'],
    ['src/api.ts', `const apiKey = '${KEY}'`, 'hardcoded-secret'],
    ['config/app.yml', `client_secret: ${KEY}`, 'hardcoded-secret'],
    ['src/api.ts', `headers: { Authorization: "Bearer ${KEY}" }`, 'hardcoded-bearer-token'],
    ['scripts/call.sh', `curl -H "Authorization: Bearer ${KEY}" https://api.acme.io`, 'hardcoded-bearer-token'],
    ['src/hook.ts', `const secret = "${WHSEC}"`, 'stripe-webhook-secret'],
  ]
  for (const [rel, line, rule] of real) {
    const found = findCommonSecrets(`// início\n${line}\n`, rel).map((s) => s.ruleId)
    assert.deepEqual(found, [rule], `${rel}: ${line}`)
  }
})

test('segredo em formato comum: os parecidos inocentes não acusam', () => {
  const innocent = [
    // Leitura de variável, função, entrada.
    ['src/db.js', 'const password = process.env.DB_PASSWORD'],
    ['src/db.js', 'password: input.password,'],
    ['src/db.js', 'const password = getPassword()'],
    ['src/db.py', 'password = os.environ["DB_PASSWORD"]'],
    ['src/db.py', 'SECRET_KEY = os.environ.get("SECRET_KEY")'],
    ['src/db.js', 'const apiKey = `${prefix}_${id}_long_enough_value`'],
    ['deploy.sh', 'DB_PASSWORD=$(cat /run/secrets/db)'],
    ['deploy.sh', 'DB_PASSWORD=${DB_PASSWORD}'],
    ['deploy.sh', 'export API_TOKEN=$1'],
    ['.github/workflows/ci.yml', '          password: ${{ secrets.REGISTRY_PASSWORD }}'],
    // Placeholders.
    ['src/db.js', 'const password = "changeme"'],
    ['src/db.js', 'const apiKey = "xxxxxxxxxxxxxxxxxxxx"'],
    ['src/db.js', 'const apiKey = "your-api-key-goes-here"'],
    ['src/db.js', 'const apiKey = "<your-api-key>"'],
    ['src/db.js', 'const password = "example-password-1"'],
    ['docker-compose.yml', '      POSTGRES_PASSWORD: postgres'],
    ['src/db.ts', 'const url = "postgresql://user:password@localhost:5432/app"'],
    ['src/db.ts', `const url = "postgresql://postgres:${PW}@localhost:54322/postgres"`],
    ['src/db.ts', 'const url = `postgres://${user}:${pass}@${host}/db`'],
    ['ci.sh', 'git clone https://x-access-token:$GITHUB_TOKEN@github.com/acme/app.git'],
    ['src/api.ts', 'headers: { Authorization: `Bearer ${token}` }'],
    ['src/api.ts', 'headers: { Authorization: "Bearer " + token }'],
    ['src/api.ts', '// Authorization: Bearer <token>'],
    // Exemplo, teste, documentação.
    ['.env.example', `DB_PASSWORD=${PW}`],
    ['config/database.yml.sample', `password: ${PW}`],
    ['docs/setup.md', `password = "${PW}"`],
    ['test/login.test.js', `const password = "${PW}"`],
    ['fixtures/user.json', `"password": "${PW}"`],
    // Campo de formulário, tipo, tela e tradução.
    ['src/Login.tsx', '<input type="password" name="password" autoComplete="current-password" />'],
    ['src/Login.tsx', 'const passwordLabel = "Digite a senha 123"'],
    ['src/Login.tsx', 'const passwordPlaceholder = "Min8chars!"'],
    ['src/types.ts', 'type Login = { password: string; token: string }'],
    ['src/types.ts', 'const schema = z.object({ password: z.string().min(8) })'],
    ['src/form.ts', 'const field = { password: "password" }'],
    ['src/i18n.ts', 'password: "Senha",'],
    ['src/i18n.ts', 'forgotPassword: "Esqueceu a senha?",'],
    ['src/i18n.ts', 'password: "auth.fields.password",'],
    ['locales/pt-BR.json', `"password": "Senh4Forte9x"`],
    // Configuração que tem a palavra mas não é segredo.
    ['config/app.yml', 'tokenUrl: https://auth.acme.io/oauth/token'],
    ['config/app.yml', 'password_min_length: 123456'],
    ['config/app.yml', 'secretName: acme-app-tls-2024'],
    ['src/auth.ts', 'const TOKEN_KEY = "faundr_session_v2x"'],
    ['src/auth.ts', 'const tokenType = "Bearer9000xyz"'],
    ['src/auth.ts', 'const NEXT_PUBLIC_API_KEY = "pk_live_a8Fk2Lm9Qz7Xc4Vb"'],
    ['Dockerfile', `ENV DB_PASSWORD="${PW}"`],
    ['src/hook.ts', 'const secret = "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'],
  ]
  for (const [rel, line] of innocent) assert.deepEqual(findCommonSecrets(`${line}\n`, rel), [], `${rel}: ${line}`)
})

test('segredo em formato comum: gravidade, máscara e ruído na checagem inteira', async () => {
  const found = await findingsOf({
    'src/db.ts': `export const url = "postgresql://app:${PW}@db.acme.io:5432/app"\nexport const jwtSecret = "${KEY}"\n`,
    'src/hook.ts': `export const secret = "${WHSEC}"\n`,
    // O que a regra do provedor já acha não vira um segundo achado genérico.
    'src/pay.ts': `export const STRIPE_SECRET_KEY = "sk_live_${KEY}${KEY}"\n`,
    'docs/setup.md': `password = "${PW}"\n`,
    '.env.example': `JWT_SECRET=${KEY}\n`,
  })
  const common = found.filter((f) => COMMON.includes(f.rule_id))
  assert.deepEqual(common.map((f) => `${f.severity} ${f.rule_id}@${f.file}`).sort(), [
    'high stripe-webhook-secret@src/hook.ts',
    'high url-with-credentials@src/db.ts',
    'medium hardcoded-secret@src/db.ts',
  ])
  // O valor nunca aparece inteiro no achado.
  for (const f of common) for (const secret of [PW, KEY, WHSEC]) assert.ok(!JSON.stringify(f).includes(secret), f.rule_id)
  assert.equal(found.filter((f) => f.file === 'src/pay.ts').length, 1)
})

test('máscara curta: segredo de até 20 caracteres mostra no máximo 4', () => {
  for (const s of ['abc123', 'Tr0ub4dorx9Kq', 'a'.repeat(20)]) assert.ok(maskShort(s).replace('…', '').length <= 4, s)
  assert.ok(maskShort(KEY).replace('…', '').length <= 6)
})

// ---- E. a máscara do diário não trava com texto grande -------------------------------------------

test('máscara: 320 KB de texto repetitivo passam em menos de 200 ms por padrão', () => {
  for (const unit of ['a.', 'key_', 'mysql ', 'password ', 'a://', 'TOKEN_', 'x:y']) {
    const big = unit.repeat(Math.ceil(320_000 / unit.length))
    const started = performance.now()
    maskPayload(big)
    const ms = performance.now() - started
    assert.ok(ms < 200, `${JSON.stringify(unit)}: ${Math.round(ms)} ms`)
  }
})

test('máscara: as formas reais continuam mascaradas', () => {
  const cases = [
    [`postgresql://app:${PW}@db.acme.io:5432/app`, PW],
    [`DATABASE_URL="mysql://root:${PW}@10.0.0.5/app"`, PW],
    [`curl https://admin:${PW}@api.acme.io/v1`, PW],
    [`mysql -u root -p${PW} app`, PW],
    [`PGPASSWORD=${PW} psql`, PW],
    [`export DB_PASSWORD=${PW}`, PW],
    [`STRIPE_SECRET_KEY: ${KEY}`, KEY],
    [`password: "${PW}"`, PW],
    [`api_key = ${KEY}`, KEY],
  ]
  for (const [text, secret] of cases) {
    const out = maskPayload(text)
    assert.ok(!out.includes(secret), text)
    assert.ok(out.includes('***'), text)
  }
  // O que não é segredo fica como está.
  assert.equal(maskPayload('abra https://faundr.com/docs e rode npm test'), 'abra https://faundr.com/docs e rode npm test')
})

// ---- D. arquivos que só definem regras ------------------------------------------------------------

test('arquivo de definição de regra: os do próprio Faundr são pulados, os do projeto não', () => {
  for (const rel of ['plugin/dist/secret-rules.mjs', 'engine/secret-rules.mjs', 'plugin/bin/security-code.mjs', 'plugin/bin/security.mjs']) assert.ok(isRuleDefinitionPath(rel), rel)
  for (const rel of ['src/server/security.ts', 'plugin/bin/launch.mjs', 'src/lib/secret-rules.ts', 'app/security-code.mjs']) assert.ok(!isRuleDefinitionPath(rel), rel)
})

// ---- B. regras de código olham a instrução inteira ------------------------------------------------

// Cada caso num arquivo próprio: devolve os nomes dos arquivos em que a regra acusou.
async function hits(cases, rule, dir = 'src/server') {
  const files = Object.fromEntries(Object.entries(cases).map(([name, text]) => [`${dir}/${name}`, `${text}\n`]))
  return (await scan(files, [rule])).map((x) => x.split('/').pop())
}

test('SQL: várias linhas, soma, consulta montada antes e filtro do Supabase', async () => {
  const bad = {
    'multi.ts': 'export const a = (db, id) =>\n  db.query(\n    `select * from users\n     where id = ${id}`,\n  )',
    'soma.ts': 'export const a = (db, name) => db.query("select * from users where name = \'" + name + "\'")',
    'antes.ts': 'export async function a(db, id) {\n  const sql = `select * from users where id = ${id}`\n  return db.query(sql)\n}',
    'antes-soma.ts': 'export async function a(db, status) {\n  let sql = "select * from orders"\n  sql += " where status = \'" + status + "\'"\n  return db.execute(sql)\n}',
    'unsafe.ts': 'export const a = (sql, id) => sql.unsafe(`delete from t where id = ${id}`)',
  }
  const good = {
    'param.ts': 'export const a = (db, id) => db.query("select * from users where id = $1", [id])',
    'param-multi.ts': 'export const a = (db, id) =>\n  db.query(\n    `select * from users\n     where id = $1`,\n    [id],\n  )',
    'constante.ts': 'const TABLE = "users"\nexport const a = (db, id) => db.query(`select * from ${TABLE} where id = $1`, [id])',
    'numerado.ts': 'export const a = (db, n, id) => db.query(`select * from t where id = $${n}`, [id])',
    'etiqueta.ts': 'export async function a(sql, db, id) {\n  const q = sql`select * from users where id = ${id}`\n  return db.query(q)\n}',
    'lista.ts': 'const COLS = ["name", "date"]\nexport function a(db, col) {\n  if (!COLS.includes(col)) throw new Error("x")\n  return db.query(`select * from t order by ${col}`)\n}',
    'outra-coisa.ts': 'export function a(client, id) {\n  const key = `user:${id}`\n  return client.query(key)\n}',
  }
  assert.deepEqual(await hits({ ...bad, ...good }, 'sql-injection'), Object.keys(bad).sort())

  const filterBad = {
    'busca.ts': 'export const a = (supabase, q) => supabase.from("people").select("*").or(`name.ilike.%${q}%,email.ilike.%${q}%`)',
    'pedido.ts': 'export async function GET(req, supabase) {\n  const owner = req.query.owner\n  return supabase.from("docs").select("*").or(`owner.eq.${owner},public.eq.true`)\n}',
  }
  const filterGood = {
    'fixo.ts': 'export const a = (db) => db.from("t").select("*").or("status.eq.failed,flaky.eq.true")',
    'servidor.ts': 'export const a = (db, userId) => db.from("t").select("*").or(`assignee_id.eq.${userId},assignee_id.is.null`)',
    'limpo.ts': 'export function a(supabase, q) {\n  const safe = q.replace(/[,()%]/g, "")\n  return supabase.from("people").select("*").or(`name.ilike.%${safe}%`)\n}',
    'metodo.ts': 'export const a = (supabase, q) => supabase.from("people").select("*").ilike("name", `%${q}%`)',
    'lista.ts': 'export const a = (items, q) => items.filter((x) => x.name.includes(q))',
  }
  assert.deepEqual(await hits({ ...filterBad, ...filterGood }, 'supabase-filter-injection'), Object.keys(filterBad).sort())
})

test('comando: valor direto do pedido, variável vinda de fora, sh -c e várias linhas', async () => {
  const bad = {
    'direto.ts': 'import { exec } from "node:child_process"\nexport const a = (req) => exec(req.body.cmd)',
    'variavel.ts': 'import { exec } from "node:child_process"\nexport function a(req) {\n  const cmd = req.query.cmd\n  exec(cmd)\n}',
    'desmontado.ts': 'import { execSync } from "node:child_process"\nexport function a(req) {\n  const { branch } = req.body\n  return execSync(branch)\n}',
    'sh-c.ts': 'import { spawn } from "node:child_process"\nexport const a = (x) => spawn("sh", ["-c", x])',
    'sh-c-template.ts': 'import { spawnSync } from "node:child_process"\nexport const a = (dir) => spawnSync("bash", ["-c", `ls ${dir}`])',
    'multi.ts': 'import { exec } from "node:child_process"\nexport const a = (dir) =>\n  exec(\n    `tar -czf out.tgz ${dir}`,\n  )',
  }
  const good = {
    'fixo.ts': 'import { exec } from "node:child_process"\nexport const a = () => exec("git status")',
    'lista-fixa.ts': 'import { spawn } from "node:child_process"\nexport const a = () => spawn("git", ["log", "--oneline", "-5"])',
    'lista-variavel.ts': 'import { spawn } from "node:child_process"\nexport const a = (file) => spawn("git", ["log", "--", file])',
    'sh-c-fixo.ts': 'import { spawn } from "node:child_process"\nexport const a = () => spawn("sh", ["-c", "ls -la | wc -l"])',
    'constante.ts': 'import { execSync } from "node:child_process"\nconst TOOL = "git"\nexport const a = () => execSync(`${TOOL} status`)',
    // Como o launch.mjs do Faundr: função local que só devolve textos fixos + nome conferido por regex logo acima.
    'conferido.ts':
      'import { spawnSync } from "node:child_process"\nconst SCRIPT = /^(build|typecheck)$/\nfunction manager(root) {\n  if (root) return "pnpm"\n  return "npm"\n}\nexport function run(root, name) {\n  if (!SCRIPT.test(name)) return null\n  return spawnSync(`${manager(root)} run ${name}`, { shell: true })\n}',
    'regex.ts': 'export const a = (re, req) => re.exec(req.body.text)',
    'conferida.ts': 'import { exec } from "node:child_process"\nconst ALLOWED = ["status", "log"]\nexport function a(req) {\n  const cmd = req.query.cmd\n  if (!ALLOWED.includes(cmd)) return\n  exec(cmd)\n}',
  }
  assert.deepEqual(await hits({ ...bad, ...good }, 'command-injection'), Object.keys(bad).sort())
  // Sem a conferência do nome, o mesmo trecho continua acusando.
  assert.deepEqual(await hits({ 'sem.ts': 'import { spawnSync } from "node:child_process"\nexport const run = (name) => spawnSync(`npm run ${name}`, { shell: true })' }, 'command-injection'), ['sem.ts'])
})

test('SSRF: endereço vindo direto do pedido, sem lista de permitidos', async () => {
  const bad = {
    'direto.ts': 'export async function POST(req) {\n  const body = await req.json()\n  return fetch(body.url)\n}',
    'variavel.ts': 'export async function GET(request) {\n  const { searchParams } = new URL(request.url)\n  const target = searchParams.get("url")\n  const res = await fetch(target)\n  return res\n}',
    'axios.ts': 'import axios from "axios"\nexport const a = (req, res) => axios.get(req.query.url).then((r) => res.send(r.data))',
  }
  const good = {
    'fixo.ts': 'export const a = (req) => fetch("https://api.acme.io/v1/items")',
    'caminho.ts': 'export async function a(req) {\n  const id = req.query.id\n  return fetch(`https://api.acme.io/v1/items/${id}`)\n}',
    'permitidos.ts': 'const ALLOWED_HOSTS = ["api.acme.io"]\nexport async function a(req) {\n  const target = req.query.url\n  if (!ALLOWED_HOSTS.includes(new URL(target).hostname)) return null\n  return fetch(target)\n}',
    'servidor.ts': 'export const a = (row) => fetch(row.webhook_url)',
  }
  assert.deepEqual(await hits({ ...bad, ...good }, 'ssrf-user-url'), Object.keys(bad).sort())
  // No navegador não é o servidor que chama.
  assert.deepEqual(await hits({ 'Tela.tsx': '"use client"\nexport const load = (searchParams) => fetch(searchParams.get("u"))' }, 'ssrf-user-url', 'src/components'), [])
})

test('path traversal: caminho com valor direto do pedido, sem basename nem conferência', async () => {
  const bad = {
    'join.ts': 'import fs from "node:fs"\nimport path from "node:path"\nexport const a = (req, res) => res.send(fs.readFileSync(path.join("uploads", req.params.name)))',
    'ler.ts': 'import fs from "node:fs"\nexport function a(req) {\n  const file = req.query.file\n  return fs.createReadStream(file)\n}',
    'template.ts': 'import fs from "node:fs/promises"\nexport const a = (req) => fs.readFile(`./uploads/${req.params.name}`)',
    'enviar.ts': 'export const a = (req, res) => res.sendFile(req.query.path)',
  }
  const good = {
    'fixo.ts': 'import fs from "node:fs"\nimport path from "node:path"\nexport const a = () => fs.readFileSync(path.join("data", "tabela.json"))',
    'basename.ts': 'import fs from "node:fs"\nimport path from "node:path"\nexport const a = (req) => fs.readFileSync(path.join("uploads", path.basename(req.params.name)))',
    'conferido.ts':
      'import fs from "node:fs"\nimport path from "node:path"\nconst BASE = path.resolve("uploads")\nexport function a(req) {\n  const full = path.resolve(BASE, req.params.name)\n  if (!full.startsWith(BASE + path.sep)) return null\n  return fs.readFileSync(full)\n}',
    'raiz.ts': 'export const a = (req, res) => res.sendFile(req.params.name, { root: "public" })',
    'servidor.ts': 'import fs from "node:fs"\nimport path from "node:path"\nexport const a = (root, rel) => fs.readFileSync(path.join(root, rel))',
  }
  assert.deepEqual(await hits({ ...bad, ...good }, 'path-traversal'), Object.keys(bad).sort())
})

// ---- D. alarmes falsos medidos no próprio repositório ----------------------------------------------

test('webhook do Stripe: conferência própria vale, e só o arquivo que recebe o aviso é cobrado', async () => {
  const EVENTS = 'if (event.type === "checkout.session.completed") await grant(event)'
  const found = await scan(
    {
      // Sem conferência nenhuma: acusa (pelo caminho e pelo corpo lido).
      'src/routes/api/stripe/webhook.ts': `import Stripe from "stripe"\nexport async function POST(request) {\n  const event = await request.json()\n  ${EVENTS}\n}\n`,
      'src/routes/api/pagamentos.ts': `// stripe\nexport async function POST(request) {\n  const event = JSON.parse(await request.text())\n  ${EVENTS}\n}\n`,
      // Conferência própria com função verify…Signature (como o src/server/stripe-webhook.ts do Faundr).
      'src/server/stripe-webhook.ts': `import { verifyStripeSignature } from "./lib"\nexport async function handle(request, secrets) {\n  const raw = await request.text()\n  if (await verifyStripeSignature(raw, request.headers.get("stripe-signature"), secrets)) return null\n  const event = JSON.parse(raw)\n  ${EVENTS}\n}\n`,
      // Conferência própria com HMAC do cabeçalho.
      'src/routes/api/hooks/stripe-webhook.ts': `import crypto from "node:crypto"\nexport async function POST(request) {\n  const raw = await request.text()\n  const sig = request.headers.get("stripe-signature")\n  const mac = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(raw).digest("hex")\n  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig))) return new Response("no", { status: 400 })\n  const event = JSON.parse(raw)\n  ${EVENTS}\n}\n`,
      // Não é o webhook: só fala com o Stripe e cita "webhook" num comentário (como o src/server/billing.ts do Faundr).
      'src/server/billing.ts': '// O webhook sincroniza depois.\nexport async function pay(stripe, id) {\n  const inv = await stripe.get("invoices/" + id)\n  return inv.payment_intent\n}\n',
    },
    ['stripe-webhook-without-signature'],
  )
  assert.deepEqual(found, ['stripe-webhook-without-signature@src/routes/api/pagamentos.ts', 'stripe-webhook-without-signature@src/routes/api/stripe/webhook.ts'])
})

test('HTML na tela: texto fixo e constante não acusam; variável e template com dado acusam', async () => {
  const dangerous = {
    'Var.tsx': 'export const A = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />',
    'Template.tsx': 'export const A = ({ name }) => <div dangerouslySetInnerHTML={{ __html: `<b>${name}</b>` }} />',
    'Montada.tsx': 'const BANNER = `<b>${window.location.hash}</b>`\nexport const A = () => <div dangerouslySetInnerHTML={{ __html: BANNER }} />',
  }
  const fixed = {
    'Importada.tsx': 'import { THEME_SCRIPT } from "./theme"\nexport const A = () => <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />',
    'Local.tsx': 'const GA_ID = "G-123"\nconst GA_SCRIPT = `gtag("config", ${JSON.stringify(GA_ID)})`\nexport const A = () => <script dangerouslySetInnerHTML={{ __html: GA_SCRIPT }} />',
    'Literal.tsx': 'export const A = () => <style dangerouslySetInnerHTML={{ __html:  "body{margin:0}" }} />',
  }
  assert.deepEqual(await hits({ ...dangerous, ...fixed }, 'xss-dangerously-set-inner-html', 'src/ui'), Object.keys(dangerous).sort())

  const inner = {
    'var.js': 'export const a = (el, html) => {\n  el.innerHTML = html\n}',
    'template.js': 'export const a = (el, name) => {\n  el.innerHTML = `<b>${name}</b>`\n}',
    'soma.js': 'export const a = (el, name) => {\n  el.innerHTML += "<li>" + name + "</li>"\n}',
  }
  const innerFixed = {
    'vazio.js': "export const a = (el) => {\n  el.innerHTML = ''\n}",
    'vazio-ponto.js': 'export const a = (el) => {\n  el.innerHTML = "";\n}',
    'vazio-crlf.js': "export const a = (el) => {\r\n  el.innerHTML = '';\r\n}\r\n",
    'fixo.js': 'export const a = (el) => {\n  el.innerHTML = "<b>Carregando…</b>"\n}',
    'compara.js': 'export const a = (el) => {\n  if (el.innerHTML === "") return\n}',
    'constante.js': 'const SHELL_HTML = `<div class="x"></div>`\nexport const a = (el) => {\n  el.innerHTML = SHELL_HTML\n}',
  }
  assert.deepEqual(await hits({ ...inner, ...innerFixed }, 'xss-inner-html', 'src/ui'), Object.keys(inner).sort())

  // eval: o espaço antes do texto fixo não fura mais a exceção.
  assert.deepEqual(await hits({ 'fixo.js': 'export const a = () => eval( "1 + 1" )', 'var.js': 'export const a = (code) => eval( code )' }, 'code-eval', 'src/ui'), ['var.js'])
})

test('token e TLS: texto dentro de explicação e declaração de função não acusam', async () => {
  const found = await scan(
    {
      // Texto de ajuda que cita o padrão (como as regras do próprio plugin fazem).
      'src/help.ts': "export const TIP = ['Remove verify=False and call jwt.decode(token, key) with the algorithm.', 'rejectUnauthorized: false desliga a conferência']\n",
      // Declaração de uma função com esse nome.
      'src/claims.ts': 'export function decodeJwt(token: string) {\n  return JSON.parse(atob(token.split(".")[1]))\n}\n',
      // Uso de verdade.
      'src/auth.ts': 'import jwt from "jsonwebtoken"\nexport const user = (token) => jwt.decode(token)\n',
      'src/http.ts': 'import https from "node:https"\nexport const agent = new https.Agent({ rejectUnauthorized: false })\n',
      'src/env.ts': 'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"\n',
    },
    ['jwt-decode-without-verify', 'tls-verification-disabled'],
  )
  assert.deepEqual(found, ['jwt-decode-without-verify@src/auth.ts', 'tls-verification-disabled@src/env.ts', 'tls-verification-disabled@src/http.ts'])
})

test('impressão digital: os achados que já existiam continuam com a mesma', async () => {
  const line = 'export const a = (dir) => exec(`ls ${dir}`)'
  const [f] = (await findingsOf({ 'src/run.ts': `import { exec } from "node:child_process"\n${line}\n` })).filter((x) => x.rule_id === 'command-injection')
  // code|regra|arquivo|sha256 da linha (16 caracteres): o formato de antes das correções.
  assert.equal(f.fingerprint, `code|command-injection|src/run.ts|${createHash('sha256').update(line).digest('hex').slice(0, 16)}`)
})

// ---- C. banco: o estado final depois de todas as migrações ---------------------------------------

const DB_RULES = ['rls-policy-logged-in-only', 'rls-select-all-personal-data', 'view-without-security-invoker', 'grant-write-to-anon', 'definer-open-without-caller-check', 'rls-policy-always-true', 'security-definer-search-path']

// Uma migração por caso; devolve "regra severidade" dos achados do banco.
async function db(...migrations) {
  const files = Object.fromEntries(migrations.map((sql, i) => [`supabase/migrations/000${i + 1}_m.sql`, sql]))
  return (await findingsOf(files)).filter((f) => DB_RULES.includes(f.rule_id)).map((f) => `${f.rule_id} ${f.severity}`).sort()
}

const NOTES = `
create table public.notes (id uuid primary key, user_id uuid not null references auth.users (id), body text);
alter table public.notes enable row level security;
`

test('banco: política de escrita só com "está logado"', async () => {
  for (const cond of ['auth.uid() is not null', '(select auth.uid()) is not null', "auth.role() = 'authenticated'", "(select auth.role()) = 'authenticated'::text"]) {
    assert.deepEqual(await db(`${NOTES}create policy "upd" on public.notes for update to authenticated using (${cond});`), ['rls-policy-logged-in-only high'], cond)
  }
  assert.deepEqual(await db(`${NOTES}create policy "del" on public.notes for delete using (auth.uid() is not null);`), ['rls-policy-logged-in-only high'])
  assert.deepEqual(await db(`${NOTES}create policy "tudo" on public.notes for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);`), ['rls-policy-logged-in-only high'])
  // Insert em tabela do time (sem coluna de autor): qualquer conta cria linha em qualquer time.
  const TEAM = 'create table public.boards (id uuid primary key, org_id uuid not null, name text);\nalter table public.boards enable row level security;\n'
  assert.deepEqual(await db(`${TEAM}create policy "ins" on public.boards for insert to authenticated with check (auth.uid() is not null);`), ['rls-policy-logged-in-only medium'])

  // Parecidos que não acusam: confere o dono; "logado" junto com o dono; insert em tabela sem dono nem time;
  // política do servidor; política restritiva.
  assert.deepEqual(await db(`${NOTES}create policy "upd" on public.notes for update to authenticated using ((select auth.uid()) = user_id);`), [])
  assert.deepEqual(await db(`${NOTES}create policy "upd" on public.notes for update using (auth.uid() is not null and user_id = auth.uid());`), [])
  assert.deepEqual(await db('create table public.feedback (id uuid primary key, message text);\nalter table public.feedback enable row level security;\ncreate policy "ins" on public.feedback for insert to authenticated with check (auth.uid() is not null);'), [])
  assert.deepEqual(await db(`${NOTES}create policy "srv" on public.notes for update to service_role using (auth.uid() is not null);`), [])
  assert.deepEqual(await db(`${NOTES}create policy "r" on public.notes as restrictive for update to authenticated using (auth.uid() is not null);`), [])
  // Estado final: a migração seguinte troca a política.
  assert.deepEqual(
    await db(`${NOTES}create policy "upd" on public.notes for update using (auth.uid() is not null);`, 'drop policy "upd" on public.notes;\ncreate policy "upd" on public.notes for update using ((select auth.uid()) = user_id);'),
    [],
  )
  // A política "true" apagada depois também deixa de ser achado.
  assert.deepEqual(await db(`${NOTES}create policy "aberta" on public.notes for update using (true);`), ['rls-policy-always-true critical'])
  assert.deepEqual(await db(`${NOTES}create policy "aberta" on public.notes for update using (true);`, 'drop policy if exists "aberta" on public.notes;'), [])
})

test('banco: leitura liberada em tabela com coluna pessoal', async () => {
  const PROFILES = 'create table public.profiles (id uuid primary key, full_name text, email text, phone text);\nalter table public.profiles enable row level security;\n'
  assert.deepEqual(await db(`${PROFILES}create policy "ler" on public.profiles for select using (true);`), ['rls-select-all-personal-data high'])
  assert.deepEqual(await db(`${PROFILES}create policy "ler" on public.profiles for select to authenticated using (true);`), ['rls-select-all-personal-data medium'])
  // Tabela de consulta pública de propósito (sem coluna pessoal).
  assert.deepEqual(await db('create table public.countries (code text primary key, name text, tokens_used int);\nalter table public.countries enable row level security;\ncreate policy "ler" on public.countries for select using (true);'), [])
  // Cada um lê o seu.
  assert.deepEqual(await db(`${PROFILES}create policy "ler" on public.profiles for select using ((select auth.uid()) = id);`), [])
  // A leitura é por coluna e as pessoais ficam de fora.
  assert.deepEqual(await db(`${PROFILES}create policy "ler" on public.profiles for select using (true);`, 'revoke select on public.profiles from anon, authenticated;\ngrant select (id, full_name) on public.profiles to anon, authenticated;'), [])
  assert.deepEqual(await db(`${PROFILES}create policy "ler" on public.profiles for select using (true);`, 'drop policy "ler" on public.profiles;'), [])
})

test('banco: view sem security_invoker sobre tabela com RLS', async () => {
  const VIEW = 'create view public.notes_view as select n.id, n.body from public.notes n;'
  assert.deepEqual(await db(NOTES + VIEW), ['view-without-security-invoker high'])
  assert.deepEqual(await db(`${NOTES}create or replace view public.notes_view with (security_invoker = false) as select * from public.notes;`), ['view-without-security-invoker high'])
  // Com security_invoker, acertada depois, fechada para quem usa o app, apagada, ou sobre tabela sem RLS própria.
  assert.deepEqual(await db(`${NOTES}create view public.notes_view with (security_invoker = true) as select * from public.notes;`), [])
  assert.deepEqual(await db(`${NOTES}create view public.notes_view with (security_invoker=on) as select * from public.notes;`), [])
  assert.deepEqual(await db(NOTES + VIEW, 'alter view public.notes_view set (security_invoker = true);'), [])
  assert.deepEqual(await db(NOTES + VIEW, 'revoke all on public.notes_view from anon, authenticated;'), [])
  assert.deepEqual(await db(NOTES + VIEW, 'drop view if exists public.notes_view;'), [])
  assert.deepEqual(await db(`${NOTES}create view public.agora as select now() as t;`), [])
})

test('banco: permissão de escrita escrita à mão para o visitante sem login', async () => {
  assert.deepEqual(await db(`${NOTES}grant insert, update on public.notes to anon;`), ['grant-write-to-anon low'])
  assert.deepEqual(await db(`${NOTES}grant all on table public.notes to anon;`), ['grant-write-to-anon low'])
  assert.deepEqual(await db(`${NOTES}grant delete on all tables in schema public to anon;`), ['grant-write-to-anon medium'])
  // Só leitura; para quem está logado; o trio padrão do Supabase (todo dump tem); tirada depois.
  assert.deepEqual(await db(`${NOTES}grant select on public.notes to anon;`), [])
  assert.deepEqual(await db(`${NOTES}grant insert, update on public.notes to authenticated;`), [])
  assert.deepEqual(await db(`${NOTES}grant all on table public.notes to anon;\ngrant all on table public.notes to authenticated;\ngrant all on table public.notes to service_role;`), [])
  assert.deepEqual(await db(`${NOTES}grant insert, update on public.notes to anon;`, 'revoke insert, update on public.notes from anon;'), [])
  assert.deepEqual(await db(`${NOTES}grant all on public.notes to anon;`, 'revoke all on public.notes from anon;'), [])
})

test('banco: função security definer aberta sem conferir quem chama', async () => {
  const fn = (body, extra = '') => `${NOTES}create function public.wipe_notes(target uuid) returns void language sql security definer set search_path = '' as $$ ${body} $$;\n${extra}`
  const OPEN = 'delete from public.notes where user_id = target'
  assert.deepEqual(await db(fn(OPEN)), ['definer-open-without-caller-check high'])
  // Fechada só para o visitante: quem está logado ainda chama.
  assert.deepEqual(await db(fn(OPEN, 'revoke execute on function public.wipe_notes(uuid) from public, anon;')), ['definer-open-without-caller-check medium'])
  // "create or replace" numa migração posterior não reabre nem fecha nada: vale a permissão que já estava.
  assert.deepEqual(await db(fn(OPEN), fn(OPEN).replace('create function', 'create or replace function').replace(NOTES, '')), ['definer-open-without-caller-check high'])

  // Não acusam: confere quem chama; função de permissão do projeto; revoke (na mesma ou em outra migração, com
  // "execute" ou "all"); gatilho; outro schema; sem security definer; apagada; banco que já nasce fechado.
  assert.deepEqual(await db(fn('delete from public.notes where user_id = (select auth.uid())')), [])
  assert.deepEqual(await db(fn('delete from public.notes where user_id = target and public.is_admin()')), [])
  assert.deepEqual(await db(fn(OPEN, 'revoke execute on function public.wipe_notes(uuid) from public, anon, authenticated;')), [])
  assert.deepEqual(await db(fn(OPEN), 'revoke all on function public.wipe_notes(uuid) from public, anon, authenticated;'), [])
  assert.deepEqual(await db(fn(OPEN), 'revoke execute on all functions in schema public from public, anon, authenticated;'), [])
  assert.deepEqual(await db(`alter default privileges in schema public revoke execute on functions from public, anon, authenticated;\n${fn(OPEN)}`), [])
  assert.deepEqual(await db(`${NOTES}create function public.touch() returns trigger language plpgsql security definer set search_path = '' as $$ begin new.body := 'x'; return new; end $$;`), [])
  assert.deepEqual(await db(fn(OPEN).replace('public.wipe_notes', 'private.wipe_notes')), [])
  assert.deepEqual(await db(fn(OPEN).replace('security definer ', '')), [])
  assert.deepEqual(await db(fn(OPEN), 'drop function public.wipe_notes(uuid);'), [])
  // Tabela citada com "member" no nome não conta como conferência.
  assert.deepEqual(await db(fn('insert into public.team_members (user_id) values (target)')), ['definer-open-without-caller-check high'])
})

// ---- F. regras por linguagem: a chamada inteira e o espaço que furava a exceção ---------------------

test('linguagens: consulta e comando em várias linhas acusam; parametrizados não', async () => {
  const found = await scan(
    {
      'app/db.py': 'def a(cur, name):\n    cur.execute(\n        f"select * from users where name = {name}"\n    )\n\ndef b(cur, name):\n    cur.execute(\n        "select * from users where name = %s",\n        (name,),\n    )\n',
      'app/run.py': 'import subprocess\ndef a(cmd):\n    subprocess.run(\n        cmd,\n        shell=True,\n    )\n\ndef b(args):\n    subprocess.run(\n        args,\n        check=True,\n    )\n\ndef c():\n    exec( "x = 1" )\n',
      'app/Repo.php': '<?php\nfunction a($pdo, $id) {\n  return $pdo->query(\n    "select * from users where id = $id"\n  );\n}\nfunction b($pdo, $id) {\n  $st = $pdo->prepare(\n    "select * from users where id = ?"\n  );\n  return unserialize( "a:0:{}" );\n}\n',
      'app/repo.go': 'package app\nfunc a(db *sql.DB, id string) {\n\tdb.Query(\n\t\t"select * from users where id = " + id,\n\t)\n}\nfunc b(db *sql.DB, id string) {\n\tdb.Query(\n\t\t"select * from users where id = $1",\n\t\tid,\n\t)\n}\n',
      'app/page.component.ts': 'export const a = (s) => s.bypassSecurityTrustHtml( "<b>fixo</b>" )\nexport const b = (s, html) => s.bypassSecurityTrustHtml( html )\n',
    },
    ['python-sql-injection', 'python-shell-true', 'python-exec', 'php-sql-injection', 'php-unsafe-deserialization', 'go-sql-injection', 'angular-bypass-sanitizer'],
  )
  assert.deepEqual(found, ['angular-bypass-sanitizer@app/page.component.ts', 'go-sql-injection@app/repo.go', 'php-sql-injection@app/Repo.php', 'python-shell-true@app/run.py', 'python-sql-injection@app/db.py'])
  // Uma vez só por arquivo: o caso parametrizado e o texto fixo ao lado não acusam.
  const all = await findingsOf({ 'app/page.component.ts': 'export const a = (s) => s.bypassSecurityTrustHtml( "<b>fixo</b>" )\n' })
  assert.deepEqual(all.filter((f) => f.rule_id === 'angular-bypass-sanitizer'), [])
})
