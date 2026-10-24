// Checagem de segurança sem IA (seção Segurança do Faundr). Roda no computador do usuário:
// o código nunca sai daqui; para o painel vão só os achados, com a chave mascarada.
//
// Detectores:
// - secret:     chaves e senhas no código (regras do Betterleaks, MIT) + .env no git + variável pública com segredo
// - dependency: pacotes com falha conhecida (lockfile + API pública do OSV.dev; só nomes e versões saem daqui)
// - database:   migrations do Supabase (tabela sem RLS, política sempre verdadeira, bucket público…)
//
// Depois dos detectores, o filtro de ruído (arquivo de teste/exemplo, pacote só de desenvolvimento, falha sem
// correção) rebaixa ou suprime o achado, sempre dizendo o motivo, e a impressão digital (sem número de linha)
// deixa o mesmo problema com o mesmo S-n entre uma checagem e outra.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SECRET_RULES } from '../dist/secret-rules.mjs'
import { LANG_LOCKFILE, parseLangLockfile, preferLocks } from './lockfiles-langs.mjs'
import { DOCKERFILE, LANG_LINE_RULES } from './security-langs.mjs'
import { LANG_TECH, langDeps } from './stack-langs.mjs'
import { LOCKFILE, parseLockfile } from './lockfiles.mjs'
import { allDeps, partWith, projectParts } from './parts.mjs'
import { remoteDatabaseFindings } from './env-target.mjs'
import { t } from './i18n.mjs'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const lower = (s) => SEVERITIES[Math.min(SEVERITIES.indexOf(s) + 1, SEVERITIES.length - 1)]
const MAX_FILE = 1_000_000
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

// ---- arquivos do projeto --------------------------------------------------------------------

const SKIP_PATH = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|\.next|\.nuxt|\.svelte-kit|\.wrangler|\.vercel|\.turbo|coverage|vendor|\.venv|venv|__pycache__|\.claude|\.remember)(\/|$)/
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|svg|pdf|zip|gz|tgz|rar|7z|woff2?|ttf|otf|eot|mp[34]|mov|webm|wav|ogg|wasm|exe|dll|so|dylib|bin|lockb|jar|class|pyc|ai|psd|sketch|fig|docx?|xlsx?|pptx?|odp)$/i
const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|deno\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock|pubspec\.lock|packages\.lock\.json|gradle\.lockfile|conan\.lock)$/

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true })
  return r.status === 0 ? r.stdout.split('\0').filter(Boolean) : null
}

/** Arquivos do projeto: os do git (versionados + novos que não estão no .gitignore); sem git, a pasta toda. */
export function projectFiles(root) {
  const tracked = git(root, ['ls-files', '-z'])
  if (!tracked) {
    const all = []
    walk(root, root, all)
    return { files: all, tracked: null }
  }
  const untracked = git(root, ['ls-files', '-z', '--others', '--exclude-standard']) ?? []
  const files = [...new Set([...tracked, ...untracked])].filter((f) => !SKIP_PATH.test(f))
  return { files, tracked: new Set(tracked) }
}

function walk(dir, root, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    const rel = path.relative(root, abs).split(path.sep).join('/')
    if (SKIP_PATH.test(rel)) continue
    if (e.isDirectory()) walk(abs, root, out)
    else out.push(rel)
  }
}

function readText(root, rel) {
  try {
    const abs = path.join(root, rel)
    const st = fs.statSync(abs)
    if (!st.isFile() || st.size > MAX_FILE) return null
    const text = fs.readFileSync(abs, 'utf8')
    return text.includes('\0') ? null : text
  } catch {
    // Arquivo que sumiu, sem permissão ou ilegível: fica fora da checagem, como se não existisse.
    return null
  }
}

function lineOf(text, index) {
  let line = 1
  for (let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) line++
  return line
}

function lineText(text, index) {
  const start = text.lastIndexOf('\n', index - 1) + 1
  const end = text.indexOf('\n', index)
  return text.slice(start, end === -1 ? undefined : end)
}

// ---- chaves e senhas ------------------------------------------------------------------------

/** Mostra só o começo e o fim da chave (ex.: "sk_live_ab…wxyz"). O valor inteiro nunca sai do computador. */
export function mask(secret) {
  if (secret.length <= 12) return `${secret.slice(0, 3)}…`
  return `${secret.slice(0, Math.min(12, Math.floor(secret.length / 3)))}…${secret.slice(-4)}`
}

function entropy(s) {
  const counts = new Map()
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) {
    const p = n / s.length
    h -= p * Math.log2(p)
  }
  return h
}

// Valores que claramente não são chave de verdade (placeholder de exemplo ou variável).
const PLACEHOLDER = /x{4,}|\*{3,}|\.{3}|<[^>]*>|\$\{|\{\{|your[_-]|example|placeholder|changeme|dummy|fake|sample|redacted|0{8,}|1234567/i

// Provedores com nome amigável e onde trocar a chave.
const PROVIDERS = [
  [/^stripe/, 'Stripe', 'https://dashboard.stripe.com/apikeys'],
  [/^supabase|service-role/, 'Supabase', 'https://supabase.com/dashboard/project/_/settings/api-keys'],
  [/^openai/, 'OpenAI', 'https://platform.openai.com/api-keys'],
  [/^anthropic/, 'Anthropic', 'https://console.anthropic.com/settings/keys'],
  [/^aws|bedrock/, 'AWS', 'https://console.aws.amazon.com/iam/home#/security_credentials'],
  [/^gcp|^google|^firebase/, 'Google Cloud / Firebase', 'https://console.cloud.google.com/apis/credentials'],
  [/^github/, 'GitHub', 'https://github.com/settings/tokens'],
  [/^gitlab/, 'GitLab', 'https://gitlab.com/-/user_settings/personal_access_tokens'],
  [/^slack/, 'Slack', 'https://api.slack.com/apps'],
  [/^twilio/, 'Twilio', 'https://console.twilio.com/'],
  [/^sendgrid/, 'SendGrid', 'https://app.sendgrid.com/settings/api_keys'],
  [/^resend/, 'Resend', 'https://resend.com/api-keys'],
  [/^cloudflare/, 'Cloudflare', 'https://dash.cloudflare.com/profile/api-tokens'],
  [/^vercel/, 'Vercel', 'https://vercel.com/account/tokens'],
  [/^npm/, 'npm', 'https://www.npmjs.com/settings/~/tokens'],
  [/^mailgun/, 'Mailgun', null],
  [/^discord/, 'Discord', null],
  [/^telegram/, 'Telegram', null],
  [/^private-key/, 'private key', null],
  [/^jwt/, 'JWT', null],
]

// Nome do provedor no texto que a pessoa lê (a chave privada não é de um provedor).
const shownName = (p) => (p.name === 'private key' ? t('private key', 'chave privada') : p.name)
// "Chave do Stripe" / "Chave privada" (o começo do título dos achados de chave).
const keyOf = (p) => (p.name === 'private key' ? t('Private key', 'Chave privada') : t(`${p.name} key`, `Chave do ${p.name}`))

function provider(ruleId) {
  const hit = PROVIDERS.find(([re]) => re.test(ruleId))
  if (hit) return { name: hit[1], url: hit[2] }
  const first = ruleId.split('-')[0]
  return { name: first.charAt(0).toUpperCase() + first.slice(1), url: null }
}

// As mais perigosas: o Faundr barra antes de gravar (PreToolUse) e marca como crítico.
const DANGEROUS =
  /^(stripe-access-token|supabase-project-api-key|supabase-management-token|supabase-service-role|aws-access-token|aws-amazon-bedrock|private-key|gcp-service-account|openai-api-key|anthropic-api-key|anthropic-admin-api-key|github-pat|github-fine-grained-pat|github-app-token|github-oauth|gitlab-pat)/

function isDangerous(ruleId, secret) {
  if (!DANGEROUS.test(ruleId)) return false
  // Chave de teste do Stripe não mexe em dinheiro de verdade.
  if (ruleId === 'stripe-access-token' && /_test_/.test(secret)) return false
  return true
}

let compiled = null
function rules() {
  compiled ??= SECRET_RULES.map((r) => ({
    ...r,
    re: new RegExp(r.regex, `${r.flags}g`),
    pathRe: r.path ? new RegExp(r.path.source, r.path.flags) : null,
    stopRe: (r.stop ?? []).map((s) => new RegExp(s.source, s.flags)),
  }))
  return compiled
}

function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch {
    // Não é um JWT de verdade (o conteúdo não decodifica): segue como chave comum, com confiança baixa.
    return null
  }
}

/** Procura chaves num texto. Devolve { ruleId, secret, index, confidence, dangerous }. */
// Chaves e senhas que o Claude leu ou digitou não saem do computador: cada texto do evento do diário passa
// pelas regras antes de ir para o Faundr.
// Formatos comuns que as regras acima podem não pegar (a mesma lista do servidor, em src/lib/redact.ts).
const COMMON_SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[chave privada]'],
  [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, '$1***'],
  [/\b(sk-ant-|sk-proj-|sk-|sk_live_|sk_test_|rk_live_|pk_live_|ghp_|gho_|ghs_|ghu_|github_pat_|glpat-|xox[abprs]-|AIza|SG\.|sbp_|sb_secret_)[A-Za-z0-9_\-.]{12,}/g, '$1***'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, 'eyJ***'],
  [/\b([a-z][a-z0-9+.-]*:\/\/[^:\/\s@]+:)[^@\s\/]{3,}@/gi, '$1***@'],
  [/\b((?:password|passwd|senha|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["']?)[^\s"',;&]{6,}/gi, '$1***'],
]
export function maskPayload(value) {
  if (typeof value === 'string') {
    if (value.length < 8) return value
    let out = value
    for (const s of findSecrets(value)) out = out.replaceAll(s.secret, mask(s.secret))
    return COMMON_SECRETS.reduce((text, [re, to]) => text.replace(re, to), out)
  }
  if (Array.isArray(value)) return value.map(maskPayload)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskPayload(v)]))
  return value
}

export function findSecrets(text, rel = '') {
  const lowerText = text.toLowerCase()
  const out = []
  const seen = new Set()
  for (const r of rules()) {
    if (r.pathRe && !r.pathRe.test(rel)) continue
    if (r.keywords.length && !r.keywords.some((k) => lowerText.includes(k))) continue
    r.re.lastIndex = 0
    for (let m = r.re.exec(text); m; m = r.re.exec(text)) {
      if (m[0] === '') {
        r.re.lastIndex++
        continue
      }
      const secret = (m[r.group ?? 1] ?? m[0]).trim()
      if (!secret || seen.has(secret)) continue
      if (r.entropy && entropy(secret) <= r.entropy) continue
      if (r.stopRe.some((s) => s.test(secret)) || r.stopContains?.some((s) => secret.includes(s))) continue
      if (PLACEHOLDER.test(secret)) continue
      let ruleId = r.id
      let confidence = r.confidence
      // JWT: a chave anon do Supabase é pública por design; a service_role dá acesso total ao banco.
      if (ruleId === 'jwt' || ruleId === 'jwt-base64') {
        const payload = decodeJwt(secret)
        if (payload?.role === 'anon') continue
        if (payload?.role === 'service_role') {
          ruleId = 'supabase-service-role'
          confidence = 'high'
        } else confidence = 'low'
      }
      seen.add(secret)
      out.push({ ruleId, secret, index: m.index + m[0].indexOf(secret), confidence, dangerous: isDangerous(ruleId, secret) })
    }
  }
  return out
}

const TEST_PATH = /(^|\/)(__tests__|__mocks__|tests?|spec|specs|fixtures?|mocks?|e2e|cypress|playwright|stories)(\/|$)|\.(test|spec|stories)\.[a-z]+$|_test\.go$|Tests?\.(java|kt|cs)$|(^|\/)[^/]+\.Tests?\/|_(unit)?tests?\.(c|cc|cpp|cxx)$/i
const EXAMPLE_PATH = /\.(example|sample|template|dist|defaults?)(\.[a-z]+)?$|(^|\/)examples?(\/|$)/i
const DOC_PATH = /\.(md|mdx|txt|rst|adoc)$/i
const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/i
const isEnvFile = (rel) => ENV_FILE.test(rel) && !EXAMPLE_PATH.test(rel)

function secretSeverity(s) {
  if (s.dangerous) return 'critical'
  if (s.confidence === 'high' || s.confidence === 'medium') return s.confidence
  return 'low'
}

function secretImpact(s, p, serious) {
  if (s.ruleId === 'supabase-service-role')
    return t(
      "The service_role key bypasses all of the database's access rules. Whoever has it can read, change and delete any data in the project.",
      'A service_role ignora todas as regras de acesso do banco. Quem tiver essa chave lê, altera e apaga qualquer dado do projeto.',
    )
  if (serious)
    return t(
      `Anyone with access to the code (or to the site, if the file goes to the browser) can use this key on ${shownName(p)} in your name${p.name === 'Stripe' ? ', including moving money' : ''}.`,
      `Quem tiver acesso ao código (ou ao site, se o arquivo for para o navegador) pode usar essa chave em seu nome no ${shownName(p)}${p.name === 'Stripe' ? ', inclusive movimentar dinheiro' : ''}.`,
    )
  return t('If it is a real key, anyone with access to the code can use it.', 'Se for uma chave de verdade, quem tiver acesso ao código pode usá-la.')
}

function secretFinding(rel, text, s) {
  const p = provider(s.ruleId)
  const masked = mask(s.secret)
  const serious = s.dangerous || s.confidence === 'high'
  return {
    source: 'secret',
    rule_id: s.ruleId,
    severity: secretSeverity(s),
    confidence: s.confidence,
    title: s.ruleId === 'supabase-service-role' ? t('Supabase service_role key in the code', 'Chave service_role do Supabase no código') : t(`${keyOf(p)} in the code`, `${keyOf(p)} no código`),
    detail: t(
      `I found what looks like a secret key${p.name === 'JWT' ? ' (a JWT token)' : ` for ${shownName(p)}`} written straight into the file: ${masked}.`,
      `Encontrei o que parece ser uma chave secreta${p.name === 'JWT' ? ' (um token JWT)' : ` do ${shownName(p)}`} escrita direto no arquivo: ${masked}.`,
    ),
    impact: secretImpact(s, p, serious),
    fix: t(
      '1. Take the key out of the code: put it in the .env file (which does not go to git) and read it with process.env.VARIABLE_NAME. ' +
        `2. Replace the key on ${shownName(p)}${p.url ? ` (${p.url})` : ''}: it may already have leaked. ` +
        '3. If the file already went to git, the old key stays in the history; that is why the replacement in step 2 is required.',
      '1. Tire a chave do código: coloque-a no arquivo .env (que não vai para o git) e leia com process.env.NOME_DA_VARIAVEL. ' +
        `2. Troque a chave no ${shownName(p)}${p.url ? ` (${p.url})` : ''}: ela já pode ter vazado. ` +
        '3. Se o arquivo já foi para o git, a chave antiga continua no histórico; por isso a troca no passo 2 é obrigatória.',
    ),
    file: rel,
    line: lineOf(text, s.index),
    snippet: lineText(text, s.index).replace(s.secret, masked).trim().slice(0, 240),
    fingerprint: `secret|${s.ruleId}|${rel}|${hash(s.secret)}`,
  }
}

// Variáveis com esses prefixos vão para o navegador (qualquer visitante lê).
const PUBLIC_ENV = /\b((?:NEXT_PUBLIC|VITE|EXPO_PUBLIC|REACT_APP|NUXT_PUBLIC|PUBLIC|GATSBY)_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)[A-Z0-9_]*)\b/g

function publicEnvFinding(rel, text, index, name) {
  return {
    source: 'secret',
    rule_id: 'public-env-secret',
    severity: 'critical',
    confidence: 'medium',
    title: t(`Secret in a public variable: ${name}`, `Segredo em variável pública: ${name}`),
    detail: t(
      `The variable ${name} has a public prefix: its value is built into the site and any visitor can read it, even though it is in .env.`,
      `A variável ${name} tem prefixo público: o valor dela é embutido no site e qualquer visitante consegue ler, mesmo estando no .env.`,
    ),
    impact: t(
      'If the value is a secret key (service_role, API key, password), it is exposed to anyone who opens the site.',
      'Se o valor for uma chave secreta (service_role, chave de API, senha), ela fica exposta para qualquer pessoa que abrir o site.',
    ),
    fix: t(
      `Rename the variable without the public prefix (e.g. ${name.replace(/^(NEXT_PUBLIC|VITE|EXPO_PUBLIC|REACT_APP|NUXT_PUBLIC|PUBLIC|GATSBY)_/, '')}) and use it only on the server (API route, server action, edge function). If the value was already published, replace the key with the provider.`,
      `Renomeie a variável sem o prefixo público (ex.: ${name.replace(/^(NEXT_PUBLIC|VITE|EXPO_PUBLIC|REACT_APP|NUXT_PUBLIC|PUBLIC|GATSBY)_/, '')}) e use-a só no servidor (rota de API, server action, edge function). Se o valor já foi publicado, troque a chave no provedor.`,
    ),
    file: rel,
    line: lineOf(text, index),
    snippet: lineText(text, index).replace(/=.*/, '= …').trim().slice(0, 240),
    fingerprint: `secret|public-env-secret|${rel}|${name}`,
  }
}

// Variável pública cujo VALOR é uma chave perigosa, mesmo com nome inocente (VITE_SUPABASE_KEY = service_role,
// NEXT_PUBLIC_STRIPE_KEY = sk_live_…). O nome não denuncia; o valor sim. O valor nunca sai daqui (só mascarado).
const PUBLIC_ENV_LINE = /^[ \t]*(?:export[ \t]+)?((?:NEXT_PUBLIC|VITE|EXPO_PUBLIC|REACT_APP|NUXT_PUBLIC|PUBLIC|GATSBY)_[A-Z0-9_]*)[ \t]*=[ \t]*(.+)$/gm
const LOCAL_ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']

export function publicSecretValueFindings(root) {
  const out = []
  for (const rel of LOCAL_ENV_FILES) {
    const text = readText(root, rel)
    if (!text) continue
    for (const m of text.matchAll(PUBLIC_ENV_LINE)) {
      const s = findSecrets(m[2], rel).find((x) => x.dangerous)
      if (!s) continue
      const p = provider(s.ruleId)
      out.push({
        source: 'config',
        rule_id: 'public-env-secret-value',
        severity: 'critical',
        confidence: 'high',
        title: t(`Secret key in a public variable: ${m[1]} (${shownName(p)})`, `Chave secreta em variável pública: ${m[1]} (${shownName(p)})`),
        detail: t(
          `The value of ${m[1]} in ${rel} is a secret ${shownName(p)} key${s.ruleId === 'supabase-service-role' ? ' (service_role, which bypasses all database rules)' : ''}. Because of the prefix, it is built into the code that goes to the browser.`,
          `O valor de ${m[1]} em ${rel} é uma chave secreta do ${shownName(p)}${s.ruleId === 'supabase-service-role' ? ' (service_role, que ignora todas as regras do banco)' : ''}. Pelo prefixo, ela é embutida no código que vai para o navegador.`,
        ),
        impact: t(
          `Any visitor to the site can read the key and use ${shownName(p)} in your name${s.ruleId === 'supabase-service-role' ? ': read, change and delete the whole database' : ''}.`,
          `Qualquer visitante do site lê a chave e usa o ${shownName(p)} em seu nome${s.ruleId === 'supabase-service-role' ? ': lê, altera e apaga todo o banco' : ''}.`,
        ),
        fix: t(
          `1. In the browser, use only the public key (in Supabase, the anon or publishable key). 2. The secret key goes in a variable without the public prefix, read only on the server. 3. If the site was already published with it, replace the key on ${shownName(p)}${p.url ? ` (${p.url})` : ''}.`,
          `1. No navegador use só a chave pública (no Supabase, a anon ou publishable). 2. A chave secreta vai numa variável sem prefixo público, lida só no servidor. 3. Se o site já foi publicado com ela, troque a chave no ${shownName(p)}${p.url ? ` (${p.url})` : ''}.`,
        ),
        file: rel,
        line: lineOf(text, m.index),
        snippet: `${m[1]}=${mask(s.secret)}`,
        fingerprint: `config|public-env-secret-value|${rel}|${m[1]}`,
      })
    }
  }
  return out
}

// Linha de .env que define a variável (NOME=valor), e não só a menciona.
const definesVar = (text, index, name) => new RegExp(`^\\s*(export\\s+)?${name}\\s*=\\s*\\S`).test(lineText(text, index))

// Chaves e variáveis públicas com segredo num arquivo do projeto.
function secretsInFile(root, rel, tracked) {
  if (BINARY.test(rel) || LOCKFILES.test(rel)) return []
  const text = readText(root, rel)
  if (!text || text.startsWith('// Gerado por engine/secret-rules.mjs')) return []
  const out = []
  const env = isEnvFile(rel)
  // .env fora do git é o lugar certo da chave; o problema é ele ir para o git (checado em envFileFinding).
  if (!env || tracked?.has(rel)) for (const s of findSecrets(text, rel)) out.push(secretFinding(rel, text, s))
  for (const m of text.matchAll(PUBLIC_ENV)) {
    // Em código, só quando a variável é lida (process.env.X / import.meta.env.X); em .env, quando é definida.
    const before = text.slice(Math.max(0, m.index - 16), m.index)
    if (env ? definesVar(text, m.index, m[1]) : /env\.$/.test(before)) out.push(publicEnvFinding(rel, text, m.index, m[1]))
  }
  return out
}

// .env com valores que está (ou vai estar) no git; null se o arquivo não tem valores.
function envFileFinding(root, rel, tracked) {
  const text = readText(root, rel) ?? ''
  const hasValues = /^\s*[A-Z0-9_]+\s*=\s*\S+/m.test(text)
  if (!hasValues) return null
  const inGit = tracked.has(rel)
  return {
    source: 'secret',
    rule_id: inGit ? 'env-in-git' : 'env-not-ignored',
    severity: inGit ? 'critical' : 'high',
    confidence: 'high',
    title: inGit ? t(`File ${rel} is in git`, `Arquivo ${rel} está no git`) : t(`File ${rel} is not in .gitignore`, `Arquivo ${rel} fora do .gitignore`),
    detail: inGit
      ? t(`${rel} holds the project's keys and passwords and was saved to git.`, `O ${rel} guarda as chaves e senhas do projeto e foi salvo no git.`)
      : t(
          `${rel} holds the project's keys and passwords and is not in .gitignore: the next "git add" takes it along.`,
          `O ${rel} guarda as chaves e senhas do projeto e não está no .gitignore: o próximo "git add" leva ele junto.`,
        ),
    impact: t(
      'Anyone with access to the repository (or a copy of it) sees all of the project keys.',
      'Quem tiver acesso ao repositório (ou a uma cópia dele) vê todas as chaves do projeto.',
    ),
    fix: inGit
      ? t(
          `Add ".env*" and "!.env.example" to .gitignore, run "git rm --cached ${rel}" and replace the keys that were in it: they stay in the git history.`,
          `Adicione ".env*" e "!.env.example" ao .gitignore, rode "git rm --cached ${rel}" e troque as chaves que estavam nele: elas continuam no histórico do git.`,
        )
      : t('Add ".env*" and "!.env.example" to .gitignore.', 'Adicione ".env*" e "!.env.example" ao .gitignore.'),
    file: rel,
    line: null,
    snippet: null,
    fingerprint: `secret|env-file|${rel}`,
  }
}

// .env ignorado pelo git não entra na lista de arquivos, mas uma variável pública com segredo nele vaza pelo site.
function ignoredEnvFindings(root, files, envDir) {
  const out = []
  for (const name of envDir ? fs.readdirSync(envDir).filter((f) => isEnvFile(f) && !files.includes(f)) : []) {
    const text = readText(root, name)
    if (!text) continue
    for (const m of text.matchAll(PUBLIC_ENV)) if (definesVar(text, m.index, m[1])) out.push(publicEnvFinding(name, text, m.index, m[1]))
  }
  return out
}

function scanSecrets(root, files, { tracked, envDir }) {
  const out = files.flatMap((rel) => secretsInFile(root, rel, tracked))
  // .env que está (ou vai estar) no git.
  if (tracked)
    for (const rel of files.filter(isEnvFile)) {
      const f = envFileFinding(root, rel, tracked)
      if (f) out.push(f)
    }
  out.push(...ignoredEnvFindings(root, files, envDir))
  return out
}

/**
 * Checagem antes de gravar (hook PreToolUse): chaves no conteúdo novo de um arquivo.
 * Arquivos .env e documentação não são barrados (é onde a chave deve ficar, ou é só exemplo).
 */
export function guardContent(content, rel) {
  if (!content || isEnvFile(rel) || EXAMPLE_PATH.test(rel)) return { block: [], warn: [] }
  const found = findSecrets(content, rel).filter((s) => s.confidence !== 'low')
  const soft = DOC_PATH.test(rel) || TEST_PATH.test(rel)
  const describe = (s) => {
    const p = provider(s.ruleId)
    return { name: s.ruleId === 'supabase-service-role' ? 'Supabase service_role' : p.name, masked: mask(s.secret), url: p.url }
  }
  return {
    block: soft ? [] : found.filter((s) => s.dangerous).map(describe),
    warn: found.filter((s) => soft || !s.dangerous).map(describe),
  }
}

// Migração que apaga ou transforma dado sem volta: o aviso entra antes de gravar, quando ainda dá para fazer backup
// e escrever o caminho de volta. As antigas já rodaram, então não viram achado no painel.
const MIGRATION_FILE = /(^|\/)supabase\/migrations\/.+\.sql$|(^|\/)(migrations?|db\/migrate|drizzle|prisma\/migrations)\/.+\.sql$/i
const DESTRUCTIVE_SQL = [
  [/\bdrop\s+table\b/i, 'deletes a whole table'],
  [/\bdrop\s+schema\b/i, 'deletes a whole schema'],
  [/\balter\s+table\b[^;]*\bdrop\s+(column\b|(?!constraint\b|policy\b|default\b|not\b)\w)/i, 'deletes a column'],
  [/\btruncate\b/i, 'empties a table'],
  [/\bdelete\s+from\s+[\w."]+\s*(;|$)/i, 'deletes every row (delete without where)'],
  [/\bupdate\s+[\w."]+\s+set\b(?![^;]*\bwhere\b)[^;]*(;|$)/i, 'changes every row (update without where)'],
  [/\balter\s+column\b[^;]*\btype\b/i, 'changes a column type (may lose or truncate data)'],
  [/\brename\s+(column\s+)?[\w."]+\s+to\b/i, 'renames a table or column (the live app still uses the old name)'],
]

/** O que a migração faz que não tem volta (lista vazia se não é migração ou não apaga nada). */
export function destructiveMigration(content, rel) {
  if (!content || !MIGRATION_FILE.test(rel)) return []
  const sql = strip(content)
  return DESTRUCTIVE_SQL.filter(([re]) => re.test(sql)).map(([, what]) => what)
}

// ---- pacotes (lockfile + OSV) ---------------------------------------------------------------

const cmpParts = (a, b) => {
  const pa = String(a).split('.')
  const pb = String(b).split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1
    if (pb[i] === undefined) return 1
    const na = /^\d+$/.test(pa[i]) ? Number(pa[i]) : null
    const nb = /^\d+$/.test(pb[i]) ? Number(pb[i]) : null
    if (na !== null && nb !== null && na !== nb) return na - nb
    if (na === null && nb !== null) return 1
    if (na !== null && nb === null) return -1
    if (na === null && pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

/** Compara versões semver (1.2.3-beta.1). */
export function compareVersions(a, b) {
  const [ma, pa] = String(a).replace(/^v/, '').split(/-(.*)/s)
  const [mb, pb] = String(b).replace(/^v/, '').split(/-(.*)/s)
  const main = cmpParts(ma.split('+')[0], mb.split('+')[0])
  if (main) return main
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  return cmpParts(pa, pb)
}

const OSV = 'https://api.osv.dev/v1'
const CACHE_FILE = path.join(os.homedir(), '.faundr', 'osv-cache.json')

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    // Sem cache ainda (primeira checagem) ou arquivo corrompido: começa vazio e busca tudo no OSV.
    return {}
  }
}

// Ecossistemas que o Faundr lê (lockfiles.mjs e lockfiles-langs.mjs), com o nome que o OSV usa.
const OSV_ECOSYSTEMS = new Set(['npm', 'PyPI', 'crates.io', 'Go', 'Packagist', 'Pub', 'RubyGems', 'NuGet', 'Maven', 'ConanCenter'])

async function osvDetails(ids, known) {
  const cache = readCache()
  const missing = ids.filter((id) => cache[id]?.modified !== known.get(id))
  for (let i = 0; i < missing.length; i += 8) {
    await Promise.all(
      missing.slice(i, i + 8).map(async (id) => {
        const res = await fetch(`${OSV}/vulns/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) return
        const v = await res.json()
        cache[id] = {
          modified: v.modified,
          summary: v.summary ?? '',
          details: (v.details ?? '').slice(0, 800),
          aliases: v.aliases ?? [],
          severity: v.database_specific?.severity ?? null,
          vectors: (v.severity ?? []).map((s) => s.score),
          cwe: v.database_specific?.cwe_ids ?? [],
          affected: (v.affected ?? [])
            .filter((a) => OSV_ECOSYSTEMS.has(a.package?.ecosystem))
            .map((a) => ({ name: a.package.name, ranges: a.ranges ?? [], versions: a.versions?.length > 200 ? [] : (a.versions ?? []) })),
          url: v.references?.find((r) => r.type === 'ADVISORY')?.url ?? `https://osv.dev/vulnerability/${id}`,
        }
      }),
    )
  }
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
  } catch {
    // Sem gravar o cache a checagem sai igual; só busca os detalhes no OSV de novo da próxima vez.
  }
  return cache
}

// CVSS 3.x: nota base a partir do vetor (CVSS:3.1/AV:N/AC:L/...).
export function cvss3(vector) {
  const m = Object.fromEntries(String(vector).split('/').map((p) => p.split(':')))
  if (!m.AV || !m.S) return null
  const scope = m.S === 'C'
  const W = { AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }, AC: { L: 0.77, H: 0.44 }, UI: { N: 0.85, R: 0.62 }, CIA: { H: 0.56, L: 0.22, N: 0 } }
  const pr = { N: 0.85, L: scope ? 0.68 : 0.62, H: scope ? 0.5 : 0.27 }[m.PR]
  const iss = 1 - (1 - W.CIA[m.C]) * (1 - W.CIA[m.I]) * (1 - W.CIA[m.A])
  const impact = scope ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss
  const exploit = 8.22 * W.AV[m.AV] * W.AC[m.AC] * pr * W.UI[m.UI]
  if (!(impact > 0)) return 0
  const up = (x) => Math.ceil(x * 10 - 1e-9) / 10
  return up(Math.min(scope ? 1.08 * (impact + exploit) : impact + exploit, 10))
}

function vulnSeverity(id, v) {
  if (id.startsWith('MAL-')) return 'critical'
  const label = { CRITICAL: 'critical', HIGH: 'high', MODERATE: 'medium', MEDIUM: 'medium', LOW: 'low' }[String(v.severity).toUpperCase()]
  if (label) return label
  const score = v.vectors.map(cvss3).find((s) => s !== null)
  if (score == null) return 'medium'
  return scoreSeverity(score)
}

// Nota CVSS → gravidade (as faixas do CVSS 3).
function scoreSeverity(score) {
  if (score >= 9) return 'critical'
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

// Versões corrigidas de uma faixa (introduced → fixed) que valem para a versão instalada.
function fixesInRange(r, version) {
  const fixes = []
  let introduced = null
  for (const e of r.events) {
    if (e.introduced !== undefined) introduced = e.introduced
    else if (e.fixed !== undefined && introduced !== null) {
      if ((introduced === '0' || compareVersions(version, introduced) >= 0) && compareVersions(version, e.fixed) < 0) fixes.push(e.fixed)
      introduced = null
    }
  }
  return fixes
}

// Menor versão corrigida para a versão instalada (null = ainda não existe correção).
function fixedVersion(v, name, version) {
  const fixes = []
  for (const a of v.affected.filter((x) => x.name === name))
    for (const r of a.ranges) if (r.type === 'SEMVER' || r.type === 'ECOSYSTEM') fixes.push(...fixesInRange(r, version))
  return fixes.sort(compareVersions)[0] ?? null
}

// Primeiras frases do aviso (em inglês, como vem da base pública), sem cortar no meio.
function firstSentences(details, max = 320) {
  const para = (details ?? '').split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? ''
  if (!para) return ''
  if (para.length <= max) return ` ${para}`
  const cut = para.slice(0, max).match(/^(.*[.!?])\s/s)?.[1]
  return ` ${cut ?? `${para.slice(0, max).replace(/\s+\S*$/, '')}…`}`
}

// Comandos de atualização por gerenciador (a dica de correção usa o do projeto).
// force: onde fixar a versão de um pacote indireto (texto para a pessoa, por isso um getter com t()).
const MANAGER = {
  npm: { add: (n, v) => `npm install ${n}@^${v}`, update: (n) => `npm update ${n}`, remove: (n) => `npm uninstall ${n}`, get force() { return t('in "overrides" in package.json', 'em "overrides" no package.json') } },
  pnpm: { add: (n, v) => `pnpm add ${n}@^${v}`, update: (n) => `pnpm update ${n}`, remove: (n) => `pnpm remove ${n}`, get force() { return t('in "pnpm.overrides" in package.json', 'em "pnpm.overrides" no package.json') } },
  yarn: { add: (n, v) => `yarn add ${n}@^${v}`, update: (n) => `yarn up ${n}`, remove: (n) => `yarn remove ${n}`, get force() { return t('in "resolutions" in package.json', 'em "resolutions" no package.json') } },
  bun: { add: (n, v) => `bun add ${n}@^${v}`, update: (n) => `bun update ${n}`, remove: (n) => `bun remove ${n}`, get force() { return t('in "overrides" in package.json', 'em "overrides" no package.json') } },
  pip: {
    add: (n, v) => t(`change the line to ${n}==${v} in requirements and run pip install -r`, `atualize a linha para ${n}==${v} no requirements e rode pip install -r`),
    update: (n) => `pip install -U ${n}`,
    remove: (n) => `pip uninstall ${n}`,
    get force() { return t('by pinning the version in requirements', 'fixando a versão no requirements') },
  },
  poetry: { add: (n, v) => `poetry add ${n}@^${v}`, update: (n) => `poetry update ${n}`, remove: (n) => `poetry remove ${n}`, get force() { return t('as a direct dependency in pyproject.toml', 'como dependência direta no pyproject.toml') } },
  uv: { add: (n, v) => `uv add "${n}>=${v}"`, update: (n) => `uv lock --upgrade-package ${n}`, remove: (n) => `uv remove ${n}`, get force() { return t('as a direct dependency in pyproject.toml', 'como dependência direta no pyproject.toml') } },
  pipenv: { add: (n, v) => `pipenv install "${n}>=${v}"`, update: (n) => `pipenv update ${n}`, remove: (n) => `pipenv uninstall ${n}`, get force() { return t('in the Pipfile', 'no Pipfile') } },
  cargo: { add: (n, v) => `cargo update -p ${n} --precise ${v}`, update: (n) => `cargo update -p ${n}`, remove: (n) => `cargo remove ${n}`, get force() { return t('as a direct dependency in Cargo.toml', 'como dependência direta no Cargo.toml') } },
  go: {
    add: (n, v) => `go get ${n}@v${v} && go mod tidy`,
    update: (n) => `go get -u ${n} && go mod tidy`,
    remove: (n) => t(`remove the import of ${n} and run go mod tidy`, `tire o import de ${n} e rode go mod tidy`),
    get force() { return t('with go get in go.mod', 'com go get no go.mod') },
  },
  composer: { add: (n, v) => `composer require ${n}:^${v}`, update: (n) => `composer update ${n} --with-dependencies`, remove: (n) => `composer remove ${n}`, get force() { return t('as a direct dependency in composer.json', 'como dependência direta no composer.json') } },
  pub: { add: (n, v) => `flutter pub add ${n}:^${v}`, update: (n) => `flutter pub upgrade ${n}`, remove: (n) => `flutter pub remove ${n}`, get force() { return t('in dependency_overrides in pubspec.yaml', 'em dependency_overrides no pubspec.yaml') } },
  bundler: {
    add: (n, v) => t(`put gem "${n}", ">= ${v}" in the Gemfile and run bundle update ${n}`, `ponha gem "${n}", ">= ${v}" no Gemfile e rode bundle update ${n}`),
    update: (n) => `bundle update ${n}`,
    remove: (n) => t(`remove the gem ${n} from the Gemfile and run bundle install`, `tire a gem ${n} do Gemfile e rode bundle install`),
    get force() { return t('as a direct gem in the Gemfile', 'como gem direta no Gemfile') },
  },
  dotnet: { add: (n, v) => `dotnet add package ${n} --version ${v}`, update: (n) => `dotnet add package ${n}`, remove: (n) => `dotnet remove package ${n}`, get force() { return t('as a direct PackageReference in the .csproj', 'como PackageReference direta no .csproj') } },
  maven: {
    add: (n, v) => t(`change the version of ${n} to ${v} in pom.xml`, `troque a versão de ${n} para ${v} no pom.xml`),
    update: (n) => t(`update the version of ${n} in pom.xml`, `atualize a versão de ${n} no pom.xml`),
    remove: (n) => t(`remove ${n} from pom.xml`, `tire ${n} do pom.xml`),
    get force() { return t('in <dependencyManagement> in pom.xml', 'em <dependencyManagement> no pom.xml') },
  },
  gradle: {
    add: (n, v) => t(`change the version of ${n} to ${v} in build.gradle (or in libs.versions.toml)`, `troque a versão de ${n} para ${v} no build.gradle (ou no libs.versions.toml)`),
    update: (n) => t(`update the version of ${n} in build.gradle`, `atualize a versão de ${n} no build.gradle`),
    remove: (n) => t(`remove ${n} from build.gradle`, `tire ${n} do build.gradle`),
    get force() { return t('with a constraint in build.gradle', 'com uma constraint no build.gradle') },
  },
  conan: {
    add: (n, v) => t(`change to ${n}/${v} in the conanfile and run conan lock create`, `troque para ${n}/${v} no conanfile e rode conan lock create`),
    update: (n) => t(`update ${n} in the conanfile`, `atualize ${n} no conanfile`),
    remove: (n) => t(`remove ${n} from the conanfile`, `tire ${n} do conanfile`),
    get force() { return t('as a direct requirement in the conanfile', 'como requisito direto no conanfile') },
  },
}

// Pacotes de todos os lockfiles, com o ecossistema, o gerenciador e o lockfile de onde vieram.
function lockfileEntries(root, lockfiles) {
  const entries = []
  const readManifest = (dir) => {
    try {
      return JSON.parse(readText(root, path.posix.join(dir, 'package.json')) ?? '{}')
    } catch {
      // package.json ausente ou inválido: o lockfile é lido sem ele.
      return {}
    }
  }
  for (const lf of lockfiles) {
    const text = readText(root, lf)
    if (!text) continue
    let parsed
    try {
      parsed = LOCKFILE.test(lf) ? parseLockfile(lf, text, readManifest) : parseLangLockfile(lf, text)
    } catch {
      continue
    }
    if (!parsed) continue
    for (const p of parsed.pkgs) entries.push({ ...p, ecosystem: parsed.ecosystem, manager: parsed.manager, lockfile: lf })
  }
  return entries
}

const pkgKey = (e) => `${e.ecosystem}:${e.name}@${e.version}`

// Pergunta ao OSV, em lotes de 1000, quais pacotes têm falha: ids por pacote e quando cada falha mudou.
async function osvQuery(unique) {
  const known = new Map()
  const hits = new Map() // name@version → ids
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000)
    const res = await fetch(`${OSV}/querybatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: batch.map((e) => ({ package: { name: e.name, ecosystem: e.ecosystem }, version: e.version })) }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`OSV answered ${res.status}`)
    const { results } = await res.json()
    results.forEach((r, j) => {
      if (!r.vulns?.length) return
      hits.set(pkgKey(batch[j]), r.vulns.map((v) => v.id))
      for (const v of r.vulns) known.set(v.id, v.modified)
    })
  }
  return { known, hits }
}

// O GHSA vem primeiro; o resto em ordem alfabética.
function ghsaFirst(a, b) {
  if (a.startsWith('GHSA')) return -1
  if (b.startsWith('GHSA')) return 1
  return a.localeCompare(b)
}

// Uma falha costuma ter vários ids (GHSA + CVE): fica o GHSA, com os outros como apelidos.
function primaryIds(ids, details) {
  const primary = new Map()
  for (const id of ids) {
    const v = details[id]
    if (!v) continue
    const group = [id, ...v.aliases].sort(ghsaFirst)[0]
    if (!primary.has(group) || id.startsWith('GHSA')) primary.set(group, id)
  }
  return [...primary.values()]
}

function dependencyFix(e, cmd, { malicious, fixed, chain }) {
  if (malicious)
    return t(
      `Remove the package (${cmd.remove(e.via?.[0] ?? e.name)}), delete the installed dependencies folder and replace the keys and passwords on this computer.`,
      `Remova o pacote (${cmd.remove(e.via?.[0] ?? e.name)}), apague a pasta de dependências instaladas e troque as chaves e senhas deste computador.`,
    )
  if (!fixed)
    return t(
      "There is no fixed version yet. Check the advisory for another way to avoid the problem, or whether you can switch packages.",
      'Ainda não existe versão corrigida. Veja se há outra forma de evitar o problema no aviso da falha ou se dá para trocar de pacote.',
    )
  if (chain)
    return t(
      `${e.name} comes from ${chain}. Update ${e.via[0]} (${cmd.update(e.via[0])}); if that does not fix it, force ${e.name} ${fixed} or newer ${cmd.force}.`,
      `O ${e.name} vem de ${chain}. Atualize o ${e.via[0]} (${cmd.update(e.via[0])}); se não resolver, force o ${e.name} ${fixed} ou mais novo ${cmd.force}.`,
    )
  return t(`Update to version ${fixed} or newer: ${cmd.add(e.name, fixed)}`, `Atualize para a versão ${fixed} ou mais nova: ${cmd.add(e.name, fixed)}`)
}

function dependencyFinding(e, id, v) {
  const cmd = MANAGER[e.manager] ?? MANAGER.npm
  const malicious = id.startsWith('MAL-')
  const fixed = malicious ? null : fixedVersion(v, e.name, e.version)
  const chain = e.via?.length > 1 ? e.via.join(' > ') : null
  return {
    source: 'dependency',
    rule_id: id,
    severity: vulnSeverity(id, v),
    confidence: 'high',
    title: malicious ? t(`Malicious package: ${e.name}`, `Pacote malicioso: ${e.name}`) : `${e.name} ${e.version}: ${v.summary || t('known security flaw', 'falha de segurança conhecida')}`,
    detail: malicious
      ? t(
          `The package ${e.name} ${e.version} was flagged as malicious (code made to steal data or attack whoever installs it).`,
          `O pacote ${e.name} ${e.version} foi marcado como malicioso (código feito para roubar dados ou atacar quem instala).`,
        )
      : t(
          `Version ${e.version} of the package ${e.name} has a published security flaw (${id}).${firstSentences(v.details)}`,
          `A versão ${e.version} do pacote ${e.name} tem uma falha de segurança publicada (${id}).${firstSentences(v.details)}`,
        ),
    impact: malicious
      ? t(
          'It may already have run on your computer when it was installed. Remove it and replace the keys that were on the machine.',
          'Ele pode já ter rodado no seu computador ao ser instalado. Remova e troque as chaves que estavam na máquina.',
        )
      : t(
          `Depends on how the project uses the package${e.dev ? '; since it is only used during development, it does not go to the live site' : ''}.`,
          `Depende de como o projeto usa o pacote${e.dev ? '; como ele só é usado no desenvolvimento, não vai para o site publicado' : ''}.`,
        ),
    fix: dependencyFix(e, cmd, { malicious, fixed, chain }),
    file: e.lockfile,
    line: null,
    snippet: null,
    package: e.name,
    version: e.version,
    fixed_in: fixed,
    introduced_by: chain,
    dev: e.dev,
    cve: [id, ...v.aliases].filter((a) => /^(CVE|GHSA)-/.test(a)),
    cwe: v.cwe,
    advisory_url: v.url,
    fingerprint: `dependency|${e.lockfile}|${e.name}|${id}`,
  }
}

async function scanDependencies(root, files) {
  const lockfiles = preferLocks(files.filter((f) => LOCKFILE.test(f) || LANG_LOCKFILE.test(f)))
  const entries = lockfileEntries(root, lockfiles)
  const unique = [...new Map(entries.map((e) => [pkgKey(e), e])).values()]
  if (!unique.length) return { findings: [], packages: 0, lockfiles, snapshot: { packages: [], known: [] } }

  const { known, hits } = await osvQuery(unique)
  const details = await osvDetails([...known.keys()], known)

  const findings = []
  for (const e of entries) {
    const ids = hits.get(pkgKey(e))
    if (!ids) continue
    for (const id of primaryIds(ids, details)) findings.push(dependencyFinding(e, id, details[id]))
  }
  // Lista de pacotes (só nomes e versões) para o servidor conferir todo dia se surgiu falha nova.
  const snapshot = {
    packages: unique.map((e) => ({ e: e.ecosystem, n: e.name, v: e.version, lf: e.lockfile, dev: !!e.dev, ...(e.via?.length > 1 ? { via: e.via.join(' > ') } : {}) })),
    known: [...known.keys()],
  }
  return { findings: [...new Map(findings.map((f) => [f.fingerprint, f])).values()], packages: unique.length, lockfiles, snapshot }
}

// ---- banco (migrations do Supabase) --------------------------------------------------------

// Divide o SQL em comandos, respeitando strings, comentários e corpos $tag$…$tag$.
export function splitSql(sql) {
  const out = []
  let start = 0
  let i = 0
  const push = (end) => {
    const text = sql.slice(start, end)
    if (text.trim()) out.push({ text, line: lineOf(sql, start + (text.length - text.trimStart().length)) })
    start = end + 1
  }
  while (i < sql.length) {
    const c = sql[i]
    if (c === '-' && sql[i + 1] === '-') i = sql.indexOf('\n', i) === -1 ? sql.length : sql.indexOf('\n', i)
    else if (c === '/' && sql[i + 1] === '*') i = sql.indexOf('*/', i + 2) === -1 ? sql.length : sql.indexOf('*/', i + 2) + 2
    else if (c === "'") {
      i++
      while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1
      i++
    } else if (c === '$') {
      const tag = sql.slice(i).match(/^\$[A-Za-z_]*\$/)?.[0]
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length)
        i = end === -1 ? sql.length : end + tag.length
      } else i++
    } else if (c === ';') {
      push(i)
      i++
    } else i++
  }
  push(sql.length)
  return out
}

const strip = (sql) => sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
function tableName(raw) {
  const parts = raw.replace(/"/g, '').toLowerCase().split('.')
  return parts.length === 1 ? { schema: 'public', name: parts[0] } : { schema: parts[0], name: parts[1] }
}

// Política com condição "true" (não confere quem pede), exceto leitura, service_role e storage.
function policyFinding(m, rel, stmt) {
  const policy = m[1].replace(/"/g, '')
  const tbl = tableName(m[2])
  const rest = m[3]
  const cmd = (rest.match(/ for (all|select|insert|update|delete)\b/i)?.[1] ?? 'all').toLowerCase()
  const roles = rest.match(/ to ([\w", ]+?)(?: using| with check|$)/i)?.[1]?.toLowerCase() ?? 'public'
  const alwaysTrue = /(using|with check) \(\s*\(?\s*(true|1\s*=\s*1)\s*\)?\s*\)/i.test(rest)
  if (!alwaysTrue || cmd === 'select' || /service_role/.test(roles) || tbl.schema === 'storage') return null
  const anyone = /anon|public/.test(roles)
  const who = anyone ? t('anyone', 'qualquer pessoa') : t('any logged-in user', 'qualquer usuário logado')
  const Who = anyone ? t('Anyone', 'Qualquer pessoa') : t('Any logged-in user', 'Qualquer usuário logado')
  const withCheck = cmd === 'insert' || cmd === 'update' || cmd === 'all' ? ' with check ((select auth.uid()) = user_id)' : ''
  return {
    source: 'database',
    rule_id: 'rls-policy-always-true',
    severity: anyone ? 'critical' : 'high',
    confidence: 'high',
    title: t(`Policy "${policy}" allows ${cmd === 'all' ? 'everything' : cmd} on ${tbl.name} for ${who}`, `Política "${policy}" libera ${cmd === 'all' ? 'tudo' : cmd} em ${tbl.name} para ${who}`),
    detail: t(
      `The policy "${policy}" on the table ${tbl.name} has the condition "true": it does not check who is asking.`,
      `A política "${policy}" da tabela ${tbl.name} tem a condição "true": ela não confere quem está pedindo.`,
    ),
    impact:
      cmd === 'insert'
        ? t(
            `${Who} can create rows in ${tbl.name} with any content, including in someone else's name.`,
            `${Who} pode criar linhas em ${tbl.name} com qualquer conteúdo, inclusive em nome de outra pessoa.`,
          )
        : t(
            `${Who} can ${cmd === 'delete' ? 'delete' : 'change'} other people's rows in ${tbl.name}.`,
            `${Who} pode ${cmd === 'delete' ? 'apagar' : 'alterar'} linhas de outras pessoas em ${tbl.name}.`,
          ),
    fix: t(
      `Replace "true" with a condition that checks the owner, for example: using ((select auth.uid()) = user_id)${withCheck}. Do it in a new migration (drop policy + create policy).`,
      `Troque "true" por uma condição que confira o dono, por exemplo: using ((select auth.uid()) = user_id)${withCheck}. Faça isso numa nova migration (drop policy + create policy).`,
    ),
    file: rel,
    line: stmt.line,
    snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
    fingerprint: `database|rls-policy-always-true|${tbl.name}|${policy}`,
  }
}

// Bucket do Storage criado como público.
function bucketFinding(s, rel, stmt) {
  const cols = s.match(/buckets ?\(([^)]*)\)/i)?.[1]?.split(',').map((c) => c.trim().toLowerCase()) ?? []
  const values = s.match(/values ?\((.*)\)/i)?.[1]?.split(',').map((v) => v.trim()) ?? []
  const pub = cols.indexOf('public')
  if (pub === -1 || !/^true$/i.test(values[pub] ?? '')) return null
  const bucket = (values[cols.indexOf('id')] ?? values[cols.indexOf('name')] ?? '').replace(/'/g, '')
  return {
    source: 'database',
    rule_id: 'storage-public-bucket',
    severity: 'medium',
    confidence: 'high',
    title: t(`Public file bucket: ${bucket}`, `Bucket de arquivos público: ${bucket}`),
    detail: t(
      `The bucket ${bucket} was created as public: anyone with the link opens the files, without logging in.`,
      `O bucket ${bucket} foi criado como público: qualquer pessoa com o link abre os arquivos, sem login.`,
    ),
    impact: t(
      "If it stores documents, personal photos or customers' files, they are reachable by anyone who finds the link.",
      'Se guardar documentos, fotos pessoais ou arquivos de clientes, eles ficam acessíveis para quem descobrir o link.',
    ),
    fix: t(
      'If the files are not meant for the public, make the bucket private (public = false) and serve the files with temporary links (createSignedUrl).',
      'Se os arquivos não são para o público, deixe o bucket privado (public = false) e entregue os arquivos com links temporários (createSignedUrl).',
    ),
    file: rel,
    line: stmt.line,
    snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
    fingerprint: `database|storage-public-bucket|${bucket}`,
  }
}

// Função "security definer" sem search_path fixo.
function definerFinding(m, rel, stmt) {
  const fn = m[1].replace(/"/g, '')
  return {
    source: 'database',
    rule_id: 'security-definer-search-path',
    severity: 'medium',
    confidence: 'medium',
    title: t(`Function ${fn} runs with full power and no fixed search_path`, `Função ${fn} roda com poder total sem search_path fixo`),
    detail: t(
      `The function ${fn} is "security definer" (it runs with the permissions of whoever created it, bypassing the access rules) and does not pin the search_path.`,
      `A função ${fn} é "security definer" (roda com as permissões de quem a criou, ignorando as regras de acesso) e não fixa o search_path.`,
    ),
    impact: t(
      'Someone allowed to create objects in the database can trick the function into running their code with full power.',
      'Alguém com permissão para criar objetos no banco pode enganar a função e fazer ela executar código dele com poder total.',
    ),
    fix: t(
      `Add "set search_path = ''" to the function definition (and use full names, like public.table). Also check whether it really needs to be security definer.`,
      `Adicione "set search_path = ''" na definição da função (e use nomes completos, como public.tabela). Confira também se ela precisa mesmo ser security definer.`,
    ),
    file: rel,
    line: stmt.line,
    snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
    fingerprint: `database|security-definer-search-path|${fn.toLowerCase()}`,
  }
}

function rlsDisabledFinding(name, tbl) {
  return {
    source: 'database',
    rule_id: 'rls-disabled',
    severity: 'critical',
    confidence: 'high',
    title: t(`Table ${name} has no access protection (RLS)`, `Tabela ${name} sem proteção de acesso (RLS)`),
    detail: t(
      `The table public.${name} was created without "enable row level security". Without it, Supabase's access rules do not apply to it.`,
      `A tabela public.${name} foi criada sem "enable row level security". Sem isso, as regras de acesso do Supabase não valem para ela.`,
    ),
    impact: t(
      `Anyone with the app's public key (which sits in the browser) can read, change and delete everything in ${name}.`,
      `Qualquer pessoa com a chave pública do app (que fica no navegador) pode ler, alterar e apagar tudo em ${name}.`,
    ),
    fix: t(
      `In a new migration: alter table public.${name} enable row level security; and create policies that let each user see and change only their own data.`,
      `Numa nova migration: alter table public.${name} enable row level security; e crie políticas que só deixam cada usuário ver e mudar os próprios dados.`,
    ),
    file: tbl.file,
    line: tbl.line,
    snippet: `create table public.${name} (…)`,
    fingerprint: `database|rls-disabled|${name}`,
  }
}

// Um comando SQL: atualiza o mapa de tabelas (criada, RLS ligado, apagada) ou devolve um achado (null se nenhum).
function databaseStatement(stmt, rel, tables) {
  const s = strip(stmt.text).replace(/\s+/g, ' ').trim()
  let m
  if ((m = s.match(/^create (?:unlogged )?table (?:if not exists )?([\w."]+)/i)) && !/ partition of /i.test(s)) {
    const t = tableName(m[1])
    if (t.schema === 'public') tables.set(t.name, { file: rel, line: stmt.line, rls: false })
  } else if ((m = s.match(/^alter table (?:if exists )?(?:only )?([\w."]+) (enable|disable|force) row level security/i))) {
    const t = tableName(m[1])
    if (t.schema === 'public' && tables.has(t.name)) tables.get(t.name).rls = m[2].toLowerCase() !== 'disable'
  } else if ((m = s.match(/^drop table (?:if exists )?([\w.", ]+)/i))) {
    for (const raw of m[1].split(',')) tables.delete(tableName(raw.trim().split(' ')[0]).name)
  } else if ((m = s.match(/^create policy ("[^"]+"|\S+) on ([\w."]+)(.*)$/i))) return policyFinding(m, rel, stmt)
  else if (/^insert into storage\.buckets/i.test(s) && /\btrue\b/i.test(s)) return bucketFinding(s, rel, stmt)
  else if ((m = s.match(/^create (?:or replace )?function ([\w."]+)/i)) && /security definer/i.test(s) && !/set search_path/i.test(s))
    return definerFinding(m, rel, stmt)
  return null
}

function scanDatabase(root, files) {
  const sqlFiles = files.filter((f) => /(^|\/)supabase\/.*\.sql$/i.test(f)).sort()
  const tables = new Map() // public.nome → { file, line, rls }
  const findings = []
  for (const rel of sqlFiles) {
    const text = readText(root, rel)
    if (!text) continue
    for (const stmt of splitSql(text)) {
      const f = databaseStatement(stmt, rel, tables)
      if (f) findings.push(f)
    }
  }
  for (const [name, t] of tables) if (!t.rls) findings.push(rlsDisabledFinding(name, t))
  return { findings, tables: tables.size, files: sqlFiles.length }
}

// ---- código (padrões perigosos, sem IA) -----------------------------------------------------

const CODE_FILE = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro|py|php|dart|go|java|kt|kts|cs|cshtml|razor|rs|c|cc|cpp|cxx|h|hh|hpp|hxx|html?)$/i
// Código das linguagens sem regras de linha (o Claude lê na revisão).
const OTHER_CODE = /\.(go|rs|java|kts?|cs|c|cc|cpp|cxx|h|hpp|rb|swift)$/i
const SERVER_ROUTE = /(^|\/)(app\/(.*\/)?api\/.*\/?route\.[mc]?[jt]s|pages\/api\/.*\.[mc]?[jt]sx?|src\/routes\/api\/.*\.[mc]?[jt]sx?|supabase\/functions\/[^/]+\/index\.[jt]s|functions\/.*\.[jt]s|server\/.*\.[mc]?[jt]s|api\/.*\.[mc]?[jt]s)$/i

// Regras por linha: o que é quase sempre perigoso quando aparece com dado variável.
// Cada regra: padrão da linha, exceção (se a linha tiver isto, está ok) e o texto do achado.
// Onde as regras gerais (comando, SQL, eval, CORS) valem: Go, Java/Kotlin, C#, Rust e C/C++ têm as próprias em security-langs.mjs.
const GENERAL_RULE_FILES = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro|py|php|dart)$/i

const LINE_RULES = [
  {
    id: 'xss-dangerously-set-inner-html',
    re: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!['"`])/,
    ok: /sanitize|DOMPurify|purify|escape/i,
    severity: 'medium',
    cwe: 'CWE-79',
    title: ['HTML put on the screen without cleaning (dangerouslySetInnerHTML)', 'HTML inserido na tela sem limpar (dangerouslySetInnerHTML)'],
    detail: ['The component puts HTML straight into the page from a variable.', 'O componente coloca HTML direto na página a partir de uma variável.'],
    impact: ['If that content comes from a user (comment, name, text from the database, AI answer), someone can inject a script that runs in the browser of whoever opens the page and steal their session.', 'Se esse conteúdo vier de um usuário (comentário, nome, texto do banco, resposta de IA), alguém pode injetar um script que roda no navegador de quem abrir a página e roubar a sessão.'],
    fix: ['Avoid raw HTML: show it as text. If you need HTML (e.g. markdown), clean it first with DOMPurify.sanitize(html).', 'Evite HTML cru: mostre como texto. Se precisar de HTML (ex.: markdown), limpe antes com DOMPurify.sanitize(html).'],
  },
  {
    id: 'xss-inner-html',
    re: /\.(innerHTML|outerHTML)\s*[+]?=\s*(?!['"`]\s*[;)]?$)(?!['"][^'"]*['"]\s*;?\s*$)|document\.write\s*\(/,
    ok: /sanitize|DOMPurify|purify|escape|textContent/i,
    severity: 'medium',
    cwe: 'CWE-79',
    title: ['HTML built with innerHTML', 'HTML montado com innerHTML'],
    detail: ['The code writes HTML into the page with innerHTML/outerHTML/document.write from a variable.', 'O código escreve HTML na página com innerHTML/outerHTML/document.write a partir de uma variável.'],
    impact: ['If the value comes from a user or from outside, someone can inject a script that runs in the browser of whoever opens the page.', 'Se o valor vier de um usuário ou de fora, alguém pode injetar um script que roda no navegador de quem abrir a página.'],
    fix: ['Use textContent for text; if you need HTML, clean it first with DOMPurify.sanitize().', 'Use textContent para texto; se precisar de HTML, limpe antes com DOMPurify.sanitize().'],
  },
  {
    id: 'code-eval',
    files: GENERAL_RULE_FILES,
    re: /(?<![\w.])(eval|new\s+Function)\s*\(\s*(?!['"`][^'"`$]*['"`]\s*\))/,
    severity: 'high',
    cwe: 'CWE-95',
    title: ['Code run from text (eval / new Function)', 'Código executado a partir de texto (eval / new Function)'],
    detail: ['The code runs text as a program (eval or new Function) with a value that is not fixed.', 'O código executa um texto como programa (eval ou new Function) com um valor que não é fixo.'],
    impact: ['If that text can come from a user or from outside, whoever controls it runs whatever they want on the server or in the browser.', 'Se esse texto puder vir de um usuário ou de fora, quem controlar o texto executa o que quiser no servidor ou no navegador.'],
    fix: ['Replace eval with a safe alternative: JSON.parse for data, a map of allowed functions for actions.', 'Troque eval por uma alternativa segura: JSON.parse para dados, um mapa de funções permitidas para ações.'],
  },
  {
    id: 'command-injection',
    files: GENERAL_RULE_FILES,
    re: /\b(exec|execSync|spawn|spawnSync)\s*\(\s*(`[^`]*\$\{|['"][^'"]*['"]\s*\+|[a-zA-Z_$][\w$.]*\s*\+)/,
    ok: /shell\s*:\s*false/,
    severity: 'high',
    cwe: 'CWE-78',
    title: ['System command built from variable text', 'Comando do sistema montado com texto variável'],
    detail: ['An operating system command is built by joining text with a variable.', 'Um comando do sistema operacional é montado juntando texto com uma variável.'],
    impact: ['If the variable can come from a user, they can run any command on the server (delete files, steal keys).', 'Se a variável puder vir de um usuário, ele consegue rodar qualquer comando no servidor (apagar arquivos, roubar chaves).'],
    fix: ['Use execFile/spawn with a separate argument list (no shell) and check the value against a list of what is allowed.', 'Use execFile/spawn com a lista de argumentos separada (sem shell) e valide o valor contra uma lista do que é permitido.'],
  },
  {
    id: 'sql-injection',
    files: GENERAL_RULE_FILES,
    re: /\b(query|execute|raw|whereRaw|orderByRaw|\$queryRawUnsafe|\$executeRawUnsafe|unsafe)\s*\(\s*`[^`]*\b(select|insert|update|delete|where|order by)\b[^`]*\$\{/i,
    severity: 'high',
    cwe: 'CWE-89',
    title: ['SQL query built from variable text', 'Consulta SQL montada com texto variável'],
    detail: ['The SQL query is built by pasting a variable into the text (${...}).', 'A consulta SQL é montada colando uma variável dentro do texto (${...}).'],
    impact: ["If the variable comes from a user, they can change the query and read, change or delete other people's data (SQL injection).", 'Se a variável vier de um usuário, ele pode mudar a consulta e ler, alterar ou apagar dados de outras pessoas (SQL injection).'],
    fix: ["Use parameters: query(\"... where id = $1\", [id]) or the library's query builder (sql`...` with safely interpolated values, .eq(), where({ id })).", 'Use parâmetros: query("... where id = $1", [id]) ou o construtor de consultas da biblioteca (sql`...` com valores interpolados de forma segura, .eq(), where({ id })).'],
  },
  {
    id: 'cors-any-origin',
    files: GENERAL_RULE_FILES,
    re: /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]|\borigin\s*:\s*['"]\*['"]|\borigin\s*:\s*true\b/,
    severity: 'medium',
    cwe: 'CWE-942',
    title: ['CORS open to any site', 'CORS liberado para qualquer site'],
    detail: ['The API accepts requests from any site (Access-Control-Allow-Origin: * or a reflected origin).', 'A API aceita pedidos vindos de qualquer site (Access-Control-Allow-Origin: * ou origin refletida).'],
    impact: ["Any site can call this API through a logged-in person's browser; with cookies or credentials, it reads that person's data.", 'Qualquer site pode chamar esta API pelo navegador de quem está logado; com cookies ou credenciais, ele lê dados da pessoa.'],
    fix: ["List only your app's domains in origin (e.g. origin: [\"https://myapp.com\"]). Never combine \"*\" with credentials: true.", 'Liste só os domínios do seu app em origin (ex.: origin: ["https://meuapp.com"]). Nunca combine "*" com credentials: true.'],
  },
  {
    id: 'jwt-decode-without-verify',
    // Só JS/TS: no Python, o jwt.decode do PyJWT confere a assinatura (a regra de lá é python-jwt-without-verify).
    files: /\.(m?[jt]sx?|c[jt]s|vue|svelte|astro)$/i,
    re: /\bjwt\.decode\s*\(|\bjwtDecode\s*\(|\bdecodeJwt\s*\(/,
    fileOk: /jwt\.verify|jwtVerify|verifyIdToken|getUser\(|getClaims\(/,
    severity: 'medium',
    cwe: 'CWE-347',
    title: ['Token read without checking the signature', 'Token lido sem conferir a assinatura'],
    detail: ['The code reads the content of a JWT token (decode) and the file never checks the signature (verify).', 'O código lê o conteúdo de um token JWT (decode) e o arquivo não confere a assinatura em nenhum lugar (verify).'],
    impact: ['If access decisions use that content, anyone can forge a token claiming to be another user or an admin.', 'Se a decisão de acesso usar esse conteúdo, qualquer pessoa monta um token falso dizendo ser outro usuário ou admin.'],
    fix: ['Check the signature with jwt.verify / jose.jwtVerify (or supabase.auth.getUser()) before trusting what the token says.', 'Confira a assinatura com jwt.verify / jose.jwtVerify (ou supabase.auth.getUser()) antes de confiar no que o token diz.'],
  },
  {
    id: 'open-redirect',
    re: /\b(redirect|NextResponse\.redirect|res\.redirect|location\.href\s*=|window\.location\s*=)\s*\(?[^;\n]*(searchParams\.get|req\.query|query\.|params\.(next|redirect|url|return))/i,
    ok: /startsWith\(['"]\/['"]\)|allowed|whitelist|allowlist|new URL\([^)]*origin/i,
    severity: 'medium',
    cwe: 'CWE-601',
    title: ['Redirect to an address taken from the URL', 'Redirecionamento para endereço vindo da URL'],
    detail: ['The app redirects to an address that comes from a URL parameter (e.g. ?next=...).', 'O app redireciona para um endereço que vem de um parâmetro da URL (ex.: ?next=...).'],
    impact: ["Someone sends a link to your site that takes the victim to a fake site (phishing), borrowing your domain's trustworthy look.", 'Alguém manda um link do seu site que leva a vítima para um site falso (phishing), com a cara de confiável do seu domínio.'],
    fix: ['Accept only internal paths (starting with "/" and not "//") or a list of allowed destinations.', 'Só aceite caminhos internos (começando com "/" e não com "//") ou uma lista de destinos permitidos.'],
  },
  {
    id: 'tls-verification-disabled',
    re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|rejectUnauthorized\s*:\s*false|verify\s*=\s*False/,
    severity: 'medium',
    cwe: 'CWE-295',
    title: ['HTTPS certificate check turned off', 'Conferência de certificado HTTPS desligada'],
    detail: ['The code turns off the HTTPS certificate check on connections.', 'O código desliga a conferência do certificado HTTPS nas conexões.'],
    impact: ['Someone in the middle (public Wi-Fi, a compromised network) can pose as the server and read or change the data, keys included.', 'Alguém no meio do caminho (Wi-Fi público, rede comprometida) pode se passar pelo servidor e ler ou alterar os dados, inclusive chaves.'],
    fix: ['Remove this option. If it is your own certificate, provide the certificate authority (ca) instead of turning off the check.', 'Remova essa opção. Se for um certificado próprio, informe a autoridade certificadora (ca) em vez de desligar a conferência.'],
  },
  {
    id: 'python-shell-true',
    re: /subprocess\.\w+\([^)]*shell\s*=\s*True/,
    severity: 'high',
    cwe: 'CWE-78',
    title: ['System command with shell=True', 'Comando do sistema com shell=True'],
    detail: ['subprocess runs the command through the shell.', 'O subprocess roda o comando através do shell.'],
    impact: ['If part of the command comes from a user, they can run any command on the server.', 'Se parte do comando vier de um usuário, ele consegue rodar qualquer comando no servidor.'],
    fix: ['Pass the command as a list of arguments, without shell=True.', 'Passe o comando como lista de argumentos, sem shell=True.'],
  },
  {
    id: 'python-unsafe-deserialization',
    re: /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*SafeLoader)/,
    severity: 'high',
    cwe: 'CWE-502',
    title: ['Unsafe data loading (pickle / yaml.load)', 'Leitura insegura de dados (pickle / yaml.load)'],
    detail: ['The code turns data into objects with pickle or yaml.load without the safe loader.', 'O código transforma dados em objetos com pickle ou yaml.load sem o carregador seguro.'],
    impact: ['If the data comes from outside, whoever controls it runs code on the server.', 'Se os dados vierem de fora, quem os controla executa código no servidor.'],
    fix: ['Use json for outside data; for YAML, yaml.safe_load().', 'Use json para dados de fora; para YAML, yaml.safe_load().'],
  },
]
// As regras de PHP, Dart e Python moram em security-langs.mjs.
const ALL_LINE_RULES = [...LINE_RULES, ...LANG_LINE_RULES]

// Webhooks do Stripe: assinatura não conferida, conferida com o corpo já convertido, pagamento sem idempotência.
function webhookRules(rel, text, isRoute) {
  const out = []
  // Webhook do Stripe sem conferir a assinatura.
  if (isRoute && /stripe/i.test(text) && /webhook|stripe-signature/i.test(rel + text) && /(checkout\.session|payment_intent|invoice\.|customer\.subscription|event\.type)/.test(text) && !/constructEvent(Async)?\s*\(/.test(text))
    out.push({
      rule_id: 'stripe-webhook-without-signature',
      severity: 'high',
      cwe: 'CWE-345',
      index: text.search(/event\.type|checkout\.session|payment_intent/),
      title: t('Stripe webhook without checking the signature', 'Webhook do Stripe sem conferir a assinatura'),
      detail: t('The route handles Stripe events (payment, subscription) but does not call stripe.webhooks.constructEvent to check that the notice really came from Stripe.', 'A rota trata eventos do Stripe (pagamento, assinatura) mas não chama stripe.webhooks.constructEvent para conferir que o aviso veio mesmo do Stripe.'),
      impact: t('Anyone can call this route pretending to be Stripe and mark a payment as done, unlock a plan or credits without paying.', 'Qualquer pessoa pode chamar essa rota fingindo ser o Stripe e marcar um pagamento como feito, liberar um plano ou créditos sem pagar.'),
      fix: t('Read the raw body (await request.text()) and use stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET) before handling the event.', 'Leia o corpo cru (await request.text()) e use stripe.webhooks.constructEvent(corpo, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET) antes de tratar o evento.'),
    })
  const verifies = /constructEvent(Async)?\s*\(/.test(text)
  // Webhook que confere a assinatura com o corpo já transformado em objeto: a conferência falha sempre (e alguém
  // "conserta" desligando) ou só passa porque o corpo foi remontado.
  if (isRoute && verifies && (/constructEvent(Async)?\(\s*JSON\.stringify/.test(text) || /(req|request|c\.req)\.json\(\)/.test(text.slice(0, text.search(/constructEvent/)))))
    out.push({
      rule_id: 'stripe-webhook-parsed-body',
      severity: 'medium',
      cwe: 'CWE-345',
      index: text.search(/constructEvent/),
      title: t('Stripe webhook checks the signature against an already parsed body', 'Webhook do Stripe confere a assinatura com o corpo já convertido'),
      detail: t("Stripe's signature covers the raw request body, byte for byte. Here the body is read as JSON (or rebuilt with JSON.stringify) before the check.", 'A assinatura do Stripe vale para o corpo cru do pedido, byte a byte. Aqui o corpo é lido como JSON (ou remontado com JSON.stringify) antes da conferência.'),
      impact: t('The check fails with real payments (and the temptation is to turn it off) or passes by luck; either way the webhook is fragile.', 'A conferência falha com pagamentos de verdade (e a tentação é desligá-la) ou passa por acaso; nos dois casos o webhook fica frágil.'),
      fix: t('Read the raw body (await request.text(), or express.raw({ type: "application/json" }) on that route only) and pass that text to constructEvent; parse it into an object afterwards.', 'Leia o corpo cru (await request.text(), ou express.raw({ type: "application/json" }) só nessa rota) e passe esse texto para constructEvent; transforme em objeto depois.'),
    })
  // Webhook de pagamento que não guarda o id do evento: o Stripe reenvia avisos e cada reenvio libera de novo.
  if (isRoute && verifies && /checkout\.session\.completed|payment_intent\.succeeded|invoice\.(paid|payment_succeeded)/.test(text) && !/\b(event|evt)\.id\b|idempot|processed_events|webhook_events|onConflict|on conflict|upsert/i.test(text))
    out.push({
      rule_id: 'payment-webhook-not-idempotent',
      severity: 'medium',
      cwe: 'CWE-841',
      index: text.search(/checkout\.session\.completed|payment_intent\.succeeded|invoice\./),
      title: t('Payment webhook may grant twice', 'Webhook de pagamento pode liberar duas vezes'),
      detail: t('The route handles the confirmed payment, but does not store the event id or write in a way that makes a repeat harmless.', 'A rota trata o pagamento confirmado, mas não guarda o id do evento nem grava de forma que repetir não mude nada.'),
      impact: t('Stripe resends the same notice when the response is slow or fails: the customer gets credits, emails or orders twice.', 'O Stripe reenvia o mesmo aviso quando a resposta demora ou falha: o cliente ganha créditos, e-mails ou pedidos em dobro.'),
      fix: t('Store event.id in a table with a unique key and stop if it already exists; or write with an upsert on the payment id, so a repeat has no effect.', 'Guarde event.id numa tabela com chave única e pare se já existir; ou grave com upsert pelo id do pagamento, para repetir não ter efeito.'),
    })
  return out
}

// Pagamento: valor vindo do navegador, produto liberado na página de obrigado e chave de admin no navegador.
function paymentRules(rel, text, isRoute) {
  const out = []
  // Preço ou valor vindo do navegador na criação da cobrança.
  const clientAmount = text.search(/\b(unit_amount|amount|transaction_amount)\s*:\s*(Number\(|parseInt\(|parseFloat\()?\s*(req\.|request\.|c\.req\.)?(body|data|input|params|query|payload)\??\.\w*(price|amount|valor|total|preco|preço)/i)
  if (isRoute && clientAmount >= 0 && /stripe|mercadopago|checkout|payment|pagamento|pix/i.test(text))
    out.push({
      rule_id: 'payment-amount-from-client',
      severity: 'high',
      cwe: 'CWE-602',
      index: clientAmount,
      title: t('Charge amount comes from the browser', 'Valor da cobrança vem do navegador'),
      detail: t('The route creates the charge with the price or amount that came in the request, instead of looking the price up on the server.', 'A rota cria a cobrança com o preço ou valor que chegou no pedido, em vez de buscar o preço no servidor.'),
      impact: t('Anyone can change the amount in the browser and pay $0.01 for any product.', 'Qualquer pessoa pode mudar o valor no navegador e pagar R$ 0,01 por qualquer produto.'),
      fix: t('Receive only the product id (or the Stripe price id, price_…) and look the amount up on the server or in the database; never trust the amount sent by the browser.', 'Receba só o id do produto (ou do preço do Stripe, price_…) e busque o valor no servidor ou no banco; nunca confie no valor enviado pelo navegador.'),
    })
  // Produto liberado na página de "obrigado": quem abre o endereço sem pagar ganha o mesmo.
  if (/(^|\/)[^/]*(success|sucesso|obrigado|thank-?you|pagamento-aprovado|payment-success)[^/]*\.[cm]?[jt]sx?$/i.test(rel) || /(success|sucesso|obrigado)\/(page|route|index)\.[jt]sx?$/i.test(rel)) {
    const grant = text.search(/\.(update|insert|upsert)\(\s*\{[^}]{0,300}\b(plan|plano|paid|pago|is_pro|premium|credits|creditos|créditos|subscription|assinatura|status\s*:\s*['"](active|ativo|paid|pago))/i)
    if (grant >= 0 && !/sessions\.retrieve|payment_status|paymentIntents\.retrieve|verif/i.test(text))
      out.push({
        rule_id: 'payment-fulfilled-on-redirect',
        severity: 'high',
        cwe: 'CWE-840',
        index: grant,
        title: t('Product granted on the "payment approved" page', 'Produto liberado na página de "pagamento aprovado"'),
        detail: t('The page the customer returns to after paying saves the plan, the payment or the credits, without confirming with the payment service.', 'A página para onde o cliente volta depois do pagamento grava o plano, o pagamento ou os créditos, sem confirmar com o serviço de pagamento.'),
        impact: t('Whoever opens that address directly, without paying, gets the product. The payment can also fail after the person sees that page.', 'Quem abrir esse endereço direto, sem pagar, ganha o produto. O pagamento também pode falhar depois de a pessoa ver essa página.'),
        fix: t('Grant the product only in the payment webhook (with the signature checked). The thank-you page only shows the message, or checks the status with stripe.checkout.sessions.retrieve(id) first.', 'Libere o produto só no webhook do pagamento (com a assinatura conferida). A página de obrigado só mostra a mensagem, ou confere o status com stripe.checkout.sessions.retrieve(id) antes.'),
      })
  }
  // Chave de admin do Supabase num arquivo que roda no navegador.
  if (/^\s*['"]use client['"]/m.test(text) && /SERVICE_ROLE|sb_secret_|serviceRole/i.test(text))
    out.push({
      rule_id: 'supabase-service-role-in-client',
      severity: 'critical',
      cwe: 'CWE-522',
      index: text.search(/SERVICE_ROLE|sb_secret_|serviceRole/i),
      title: t('Supabase admin key used in a browser file', 'Chave de admin do Supabase usada em arquivo do navegador'),
      detail: t('A file marked "use client" (runs in the browser) uses the Supabase service_role/secret key.', 'Um arquivo marcado com "use client" (roda no navegador) usa a chave service_role/secret do Supabase.'),
      impact: t('The service_role key bypasses all access rules: whoever opens the site can grab it and read, change or delete any data.', 'A service_role ignora todas as regras de acesso: quem abrir o site pode pegá-la e ler, alterar ou apagar qualquer dado.'),
      fix: t('In the browser, use only the public key (anon/publishable) with RLS. Admin operations go to the server (API route, server action, edge function).', 'No navegador, use só a chave pública (anon/publishable) com RLS. Operações de admin vão para o servidor (rota de API, server action, edge function).'),
    })
  return out
}

// Regras por arquivo: o que falta no arquivo inteiro (ex.: webhook que não confere a assinatura).
function fileRules(rel, text) {
  const isRoute = SERVER_ROUTE.test(rel)
  return [...webhookRules(rel, text, isRoute), ...paymentRules(rel, text, isRoute), ...dockerRules(rel, text)]
}

/** Dockerfile: a imagem final (a do último FROM) roda como root quando nenhum USER troca o usuário depois dele. */
function dockerRules(rel, text) {
  if (!DOCKERFILE.test(rel)) return []
  const froms = [...text.matchAll(/^\s*FROM\s+(\S+)/gim)]
  const last = froms.at(-1)
  if (!last) return []
  const finalStage = text.slice(last.index)
  // Imagens que já trocam o usuário (distroless :nonroot, chainguard) não precisam do USER.
  if (/^\s*USER\s+(?!root\b|0\b)\S+/im.test(finalStage) || /:nonroot\b|chainguard/i.test(last[1])) return []
  return [
    {
      rule_id: 'docker-runs-as-root',
      severity: 'medium',
      cwe: 'CWE-250',
      index: last.index,
      title: t('Container runs as root', 'Contêiner roda como root'),
      detail: t('The final image has no USER instruction: the program runs as root inside the container.', 'A imagem final não tem uma instrução USER: o programa roda como root dentro do contêiner.'),
      impact: t('If someone exploits a flaw in the app, they get full control of the container and get closer to reaching the server.', 'Se alguém explorar uma falha do app, ganha o controle total do contêiner e fica mais perto de chegar ao servidor.'),
      fix: t('Create a user and switch to it before CMD (in Node: USER node; in others: RUN adduser -D app and USER app).', 'Crie um usuário e troque para ele antes do CMD (no Node: USER node; nas outras: RUN adduser -D app e USER app).'),
    },
  ]
}

function scanCode(root, files) {
  const out = []
  for (const rel of files) {
    if ((!CODE_FILE.test(rel) && !DOCKERFILE.test(rel)) || /\.(d\.ts|min\.js)$/.test(rel) || TEST_PATH.test(rel)) continue
    const text = readText(root, rel)
    if (!text || text.startsWith('// Gerado por')) continue
    const lines = text.split('\n')
    let offset = 0
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim()
      if (trimmed.length > 2000 || /^(\/\/|\*|\/\*|#)/.test(trimmed)) {
        offset += line.length + 1
        continue
      }
      for (const r of ALL_LINE_RULES) {
        if ((r.files && !r.files.test(rel)) || !r.re.test(line) || r.ok?.test(line) || r.fileOk?.test(text)) continue
        out.push(codeFinding(rel, r.id, r, i + 1, trimmed))
      }
      offset += line.length + 1
    }
    for (const f of fileRules(rel, text)) out.push(codeFinding(rel, f.rule_id, f, f.index >= 0 ? lineOf(text, f.index) : null, f.index >= 0 ? lineText(text, f.index).trim() : null))
  }
  return out
}

// Texto de regra: [en, pt] (regras montadas ao carregar o módulo) ou já na língua da pessoa.
const ruleText = (v) => (Array.isArray(v) ? t(v[0], v[1]) : v)

function codeFinding(rel, ruleId, r, line, snippet) {
  return {
    source: 'code',
    rule_id: ruleId,
    severity: r.severity,
    confidence: 'medium',
    title: ruleText(r.title),
    detail: t(
      `${ruleText(r.detail)} Check whether the value can come from outside: if it is always a fixed value from the code itself, it is not a problem.`,
      `${ruleText(r.detail)} Confira se o valor pode vir de fora: se for sempre um valor fixo do próprio código, não é problema.`,
    ),
    impact: ruleText(r.impact),
    fix: ruleText(r.fix),
    file: rel,
    line,
    // O trecho passa pela máscara de chaves, por garantia.
    snippet: snippet ? maskSecretsIn(snippet).slice(0, 240) : null,
    cwe: [r.cwe],
    fingerprint: `code|${ruleId}|${rel}|${hash((snippet ?? '').replace(/\s+/g, ' '))}`,
  }
}

function maskSecretsIn(text) {
  let out = text
  for (const s of findSecrets(text)) out = out.replace(s.secret, mask(s.secret))
  return out
}

// ---- configuração do projeto (o que falta no projeto inteiro) -------------------------------

// Sinais de limite de pedidos EM USO (não basta a palavra aparecer num comentário ou texto).
const RATE_LIMIT_DEPS = /rate-?limit|ratelimit|limiter|throttl|slow-down|bottleneck/i
const RATE_LIMIT_CODE = /from\s+['"][^'"]*(rate-?limit|ratelimit|limiter|throttl)[^'"]*['"]|\b(rateLimit|rateLimiter|RateLimiter|Ratelimit|RATE_LIMITER|limiter)\s*[.(]|status\s*[:=]\s*429\b|\(\s*['"][^'"]*['"]\s*,\s*429\s*\)|new Response\([^)]*429/
const HEADER_FILES = /(^|\/)(next\.config\.[mc]?[jt]s|vercel\.json|netlify\.toml|_headers|middleware\.[jt]s|wrangler\.(jsonc?|toml)|nginx\.conf|server\.[mc]?[jt]s|app\.[mc]?[jt]s|entry[-.]server\.[jt]sx?|__root\.tsx|root\.tsx|hooks\.server\.[jt]s|index\.html)$/i

function configFinding(ruleId, severity, file, extra) {
  return { source: 'config', rule_id: ruleId, severity, confidence: 'medium', file, line: null, snippet: null, fingerprint: `config|${ruleId}${extra?.key ? `|${extra.key}` : ''}`, ...extra }
}

// Limite de pedidos e de tamanho do corpo nas rotas do servidor.
function routeLimitFindings({ routes, code, files, deps, read }) {
  const out = []
  const serverCode = code.filter((f) => SERVER_ROUTE.test(f) || /(^|\/)(server|middleware|lib\/server|src\/server)(\/|\.)/i.test(f))
  const hasLimit =
    Object.keys(deps).some((d) => RATE_LIMIT_DEPS.test(d)) ||
    serverCode.some((f) => RATE_LIMIT_CODE.test(read(f))) ||
    files.filter((f) => /wrangler\.(jsonc?|toml)$/.test(f)).some((f) => /ratelimit/i.test(read(f)))
  if (!hasLimit)
    out.push(
      configFinding('no-rate-limit', 'high', routes[0], {
        title: t('No request limit (rate limit) on the server routes', 'Nenhum limite de pedidos (rate limit) nas rotas do servidor'),
        detail: t(
          `The project has ${routes.length} server route(s) (e.g. ${routes.slice(0, 4).join(', ')}) and none of them limits how many requests a person can make per minute.`,
          `O projeto tem ${routes.length} rota(s) de servidor (ex.: ${routes.slice(0, 4).join(', ')}) e nenhuma delas limita quantos pedidos uma pessoa pode fazer por minuto.`,
        ),
        impact: t('Someone can call the routes nonstop: try passwords and tokens in bulk, flood the database, send emails or burn through your AI and server account until the app goes down or the bill gets high.', 'Alguém pode chamar as rotas sem parar: tentar senhas e tokens em massa, encher o banco, disparar e-mails ou gastar a sua conta de IA e de servidor até derrubar o app ou gerar uma conta alta.'),
        fix: t('Limit per user/IP on sensitive routes (login, sign-up, sending email, AI, database writes). On Cloudflare: the Workers Rate Limiting binding; on Vercel/Node: @upstash/ratelimit or express-rate-limit. Answer 429 when the limit is passed.', 'Limite por usuário/IP nas rotas sensíveis (login, cadastro, envio de e-mail, IA, escrita no banco). Na Cloudflare: binding de Rate Limiting do Workers; na Vercel/Node: @upstash/ratelimit ou express-rate-limit. Responda 429 quando passar do limite.'),
        cwe: ['CWE-770'],
      }),
    )
  // Corpo do pedido lido inteiro sem limite de tamanho.
  const noBodyLimit = routes.filter((f) => /request\.(json|text|formData|arrayBuffer)\(\)|req\.(json|text)\(\)/.test(read(f)) && !/content-length|maxBody|bodyLimit|MAX_BYTES|MAX_BODY/i.test(read(f)))
  if (noBodyLimit.length && !deps.express)
    out.push(
      configFinding('no-body-size-limit', 'medium', noBodyLimit[0], {
        title: t(`Routes read the whole request with no size limit (${noBodyLimit.length})`, `Rotas leem o pedido inteiro sem limite de tamanho (${noBodyLimit.length})`),
        detail: t(
          `These routes read the request body without checking its size first: ${noBodyLimit.slice(0, 6).join(', ')}${noBodyLimit.length > 6 ? '…' : ''}.`,
          `Estas rotas leem o corpo do pedido sem conferir o tamanho antes: ${noBodyLimit.slice(0, 6).join(', ')}${noBodyLimit.length > 6 ? '…' : ''}.`,
        ),
        impact: t("A huge request can blow the server's memory or time limit and take the app down, or fill the database.", 'Um pedido gigante pode estourar a memória ou o tempo do servidor e derrubar o app, ou encher o banco.'),
        fix: t('Before reading the body, check the content-length header (e.g. above 1 MB answer 413) and also limit the size of the fields that go to the database.', 'Antes de ler o corpo, confira o cabeçalho content-length (ex.: acima de 1 MB responda 413) e limite também o tamanho dos campos que vão para o banco.'),
        cwe: ['CWE-400'],
      }),
    )
  return out
}

// Cabeçalhos de segurança do site (só quando o projeto tem um site).
function securityHeaderFindings({ root, parts, files, code, deps, read }) {
  const out = []
  const webDep = ['react', 'next', 'vue', 'svelte', '@sveltejs/kit', 'astro', 'nuxt', 'solid-js', 'vite'].find((d) => deps[d])
  if (!webDep) return out
  const sitePkg = [partWith(root, webDep, parts)?.dir, 'package.json'].filter(Boolean).join('/')
  const headerText = files.filter((f) => HEADER_FILES.test(f)).map(read).join('\n') + code.filter((f) => /middleware|headers|security/i.test(f)).map(read).join('\n')
  // O cabeçalho precisa estar sendo definido (nome seguido de valor), não só citado num texto.
  const sets = (name) => new RegExp(`(^|['"\\s])(${name})['"]?\\s*[:,=]\\s*['"]?[\\w'-]`, 'im')
  const missing = [
    [sets('Content-Security-Policy'), 'Content-Security-Policy (CSP)'],
    [sets('X-Frame-Options|frame-ancestors'), 'X-Frame-Options / frame-ancestors'],
    [sets('Strict-Transport-Security'), 'Strict-Transport-Security (HSTS)'],
    [sets('X-Content-Type-Options'), 'X-Content-Type-Options'],
  ].filter(([re]) => !re.test(headerText))
  if (missing.length >= 2)
    out.push(
      configFinding('missing-security-headers', 'medium', sitePkg, {
        title: t('Site security headers missing', 'Cabeçalhos de segurança do site ausentes'),
        detail: t(
          `I did not find these security headers in the site configuration: ${missing.map(([, n]) => n).join(', ')}.`,
          `Não encontrei estes cabeçalhos de segurança na configuração do site: ${missing.map(([, n]) => n).join(', ')}.`,
        ),
        impact: t('Without them, it is easier to exploit an XSS flaw, load your site hidden inside another one to trick clicks (clickjacking) or force a connection without HTTPS.', 'Sem eles, fica mais fácil explorar uma falha de XSS, abrir o seu site escondido dentro de outro para enganar cliques (clickjacking) ou forçar conexão sem HTTPS.'),
        fix: t('Send the headers on every response of the site (middleware, headers() in next.config, _headers on Cloudflare/Netlify or vercel.json). Start the CSP in "Report-Only" mode so nothing breaks.', 'Envie os cabeçalhos em todas as respostas do site (middleware, headers() do next.config, _headers da Cloudflare/Netlify ou vercel.json). Comece pela CSP em modo "Report-Only" para não quebrar nada.'),
        cwe: ['CWE-693'],
      }),
    )
  return out
}

// Segredo em "vars" do wrangler (vai em texto claro para o código e para o git).
function wranglerVarsFindings(files, read) {
  const out = []
  for (const f of files.filter((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x))) {
    const text = read(f)
    const vars = text.match(/"vars"\s*:\s*\{([^}]*)\}|\[vars\]([\s\S]*?)(\n\[|$)/)
    const names = [...(vars?.[1] ?? vars?.[2] ?? '').matchAll(/["']?([A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY)[A-Z0-9_]*)["']?\s*[:=]/g)].map((m) => m[1])
    if (names.length)
      out.push(
        configFinding('wrangler-secret-in-vars', 'high', f, {
          key: f,
          title: t(`Secret in "vars" of ${path.posix.basename(f)}`, `Segredo em "vars" do ${path.posix.basename(f)}`),
          detail: t(
            `The variables ${names.join(', ')} are in "vars", which sits as plain text in the file (and in git).`,
            `As variáveis ${names.join(', ')} estão em "vars", que fica em texto claro no arquivo (e no git).`,
          ),
          impact: t('Anyone with access to the repository sees the key.', 'Quem tiver acesso ao repositório vê a chave.'),
          fix: t(
            `Remove it from the file and register it with "wrangler secret put ${names[0]}". Replace the key with the provider, because it is already in the git history.`,
            `Remova do arquivo e cadastre com "wrangler secret put ${names[0]}". Troque a chave no provedor, porque ela já está no histórico do git.`,
          ),
          cwe: ['CWE-798'],
        }),
      )
  }

  return out
}

// Tipo de regra aberta do Firestore/Storage: liberada para todos, modo de teste (só data) ou qualquer logado escrevendo.
function firebaseRuleKind(cond, ops) {
  if (/^true$/.test(cond)) return 'open'
  if (/request\.time\s*<\s*timestamp\.date/.test(cond)) return 'testMode'
  if (/^request\.auth\s*!=\s*null$/.test(cond) && /write|create|update|delete/.test(ops)) return 'anyUser'
  return null
}

const FIREBASE_RULE_KINDS = {
  open: {
    id: 'firebase-rules-open',
    anyone: true,
    title: (ops) => t(`Firebase rule allows ${ops} for anyone`, `Regra do Firebase libera ${ops} para qualquer pessoa`),
    why: () => t('checks nothing', 'não confere nada'),
  },
  testMode: {
    id: 'firebase-rules-test-mode',
    anyone: true,
    title: () => t('Firebase rules in test mode', 'Regras do Firebase em modo de teste'),
    why: () => t('only checks a date (test mode)', 'só confere uma data (modo de teste)'),
  },
  anyUser: {
    id: 'firebase-rules-any-user',
    anyone: false,
    title: (ops) => t(`Firebase rule allows ${ops} for any logged-in user`, `Regra do Firebase libera ${ops} para qualquer usuário logado`),
    why: () => t('only checks that the person is logged in, not that the data is theirs', 'só confere se a pessoa está logada, não se o dado é dela'),
  },
}

// Regras do Firebase (Firestore e Storage) abertas.
function firebaseRulesFindings(files, read) {
  const out = []
  for (const f of files.filter((x) => /(^|\/)(firestore|storage)\.rules$/.test(x))) {
    const text = read(f)
    for (const m of text.matchAll(/allow\s+([\w, ]+?)\s*(?::\s*if\s+([^;]+))?;/g)) {
      const cond = (m[2] ?? 'true').trim()
      const ops = m[1]
      const kind = firebaseRuleKind(cond, ops)
      if (!kind) continue
      const k = FIREBASE_RULE_KINDS[kind]
      out.push({
        source: 'config',
        rule_id: k.id,
        severity: k.anyone ? 'critical' : 'high',
        confidence: 'high',
        title: k.title(ops),
        detail: t(`In ${f}, the rule "allow ${ops}${m[2] ? `: if ${cond}` : ''}" ${k.why()}.`, `Em ${f}, a regra "allow ${ops}${m[2] ? `: if ${cond}` : ''}" ${k.why()}.`),
        impact: k.anyone
          ? t('Anyone on the internet can read and change this data, without logging in.', 'Qualquer pessoa na internet pode ler e mudar esses dados, sem login.')
          : t("Anyone who creates an account can change or delete other users' data.", 'Qualquer pessoa que criar uma conta pode mudar ou apagar dados de outros usuários.'),
        fix: t(
          'Check the owner of the data in the rule, e.g.: allow read, write: if request.auth != null && request.auth.uid == resource.data.userId; and restrict per collection.',
          'Confira o dono do dado na regra, ex.: allow read, write: if request.auth != null && request.auth.uid == resource.data.userId; e restrinja por coleção.',
        ),
        file: f,
        line: lineOf(text, m.index),
        snippet: m[0].slice(0, 240),
        cwe: ['CWE-284'],
        fingerprint: `config|firebase-rules|${f}|${hash(m[0])}`,
      })
    }
  }
  return out
}

// Realtime Database com ".read"/".write": true.
function rtdbRulesFindings(files, read) {
  const out = []
  for (const f of files.filter((x) => /(^|\/)database\.rules\.json$/.test(x))) {
    const text = read(f)
    for (const m of text.matchAll(/"\.(read|write)"\s*:\s*(true|"true")/g))
      out.push({
        source: 'config',
        rule_id: 'firebase-rtdb-open',
        severity: 'critical',
        confidence: 'high',
        title: t(
          `Realtime Database allows ${m[1] === 'read' ? 'reading' : 'writing'} for anyone`,
          `Realtime Database libera ${m[1] === 'read' ? 'leitura' : 'escrita'} para qualquer pessoa`,
        ),
        detail: t(
          `In ${f}, ".${m[1]}": true does not check who is asking (and applies to everything below that point).`,
          `Em ${f}, ".${m[1]}": true não confere quem está pedindo (e vale para tudo abaixo desse ponto).`,
        ),
        impact: t(
          `Anyone on the internet can ${m[1] === 'read' ? 'read' : 'change and delete'} this data.`,
          `Qualquer pessoa na internet pode ${m[1] === 'read' ? 'ler' : 'alterar e apagar'} esses dados.`,
        ),
        fix: t(
          'Replace true with a condition that checks the owner, e.g.: "auth != null && auth.uid === $uid".',
          'Troque true por uma condição que confira o dono, ex.: "auth != null && auth.uid === $uid".',
        ),
        file: f,
        line: lineOf(text, m.index),
        snippet: m[0],
        cwe: ['CWE-284'],
        fingerprint: `config|firebase-rtdb|${f}|${hash(m[0] + lineOf(text, m.index))}`,
      })
  }
  return out
}

function scanConfig(root, files) {
  const code = files.filter((f) => CODE_FILE.test(f) && !TEST_PATH.test(f) && !/\.d\.ts$/.test(f))
  const routes = code.filter((f) => SERVER_ROUTE.test(f))
  // Dependências da raiz e das partes (num projeto dividido, o React fica em frontend/package.json).
  const parts = projectParts(root)
  const deps = allDeps(root, parts)
  const texts = new Map()
  const read = (f) => {
    if (!texts.has(f)) texts.set(f, readText(root, f) ?? '')
    return texts.get(f)
  }
  return [
    // Limite de pedidos: nenhuma rota do servidor tem, nem o projeto usa biblioteca ou configuração para isso.
    ...(routes.length ? routeLimitFindings({ routes, code, files, deps, read }) : []),
    ...securityHeaderFindings({ root, parts, files, code, deps, read }),
    ...wranglerVarsFindings(files, read),
    ...firebaseRulesFindings(files, read),
    ...rtdbRulesFindings(files, read),
  ]
}

// ---- chaves no histórico do git --------------------------------------------------------------

/**
 * Procura chaves nas linhas adicionadas dos commits (até `maxCommits`, todas as branches).
 * Chave apagada do código continua no histórico: quem clonar o repositório ainda a encontra.
 * Cada chave aparece uma vez (no commit mais antigo em que entrou).
 */
export function scanHistory(root, { maxCommits = 3000 } = {}) {
  const r = spawnSync(
    'git',
    ['log', '--all', '-p', '--no-color', '--no-ext-diff', '--unified=0', '--reverse', `--max-count=${maxCommits}`, '--format=%x01%H%x09%ad', '--date=short'],
    { cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true },
  )
  if (r.status !== 0) throw new Error(`git log failed: ${(r.stderr || '').trim().slice(0, 200)}`)
  const current = new Set(projectFiles(root).files)
  const seen = new Map()
  let commit = null
  let date = null
  let file = null
  let added = []
  let commits = 0
  const flush = () => {
    if (!file || !added.length || BINARY.test(file) || LOCKFILES.test(file)) return (added = [])
    const text = added.join('\n')
    for (const s of findSecrets(text, file)) {
      if (s.confidence === 'low' || seen.has(s.secret)) continue
      seen.set(s.secret, { ...s, commit, date, file, line: lineText(text, s.index) })
    }
    added = []
  }
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('\x01')) {
      flush()
      ;[commit, date] = line.slice(1).split('\t')
      commits++
      file = null
    } else if (line.startsWith('+++ ')) {
      flush()
      file = line.startsWith('+++ b/') ? line.slice(6).trim() : null
    } else if (line.startsWith('+') && file) added.push(line.slice(1))
  }
  flush()

  const findings = []
  for (const [secret, s] of seen) {
    const p = provider(s.ruleId)
    const stillThere = current.has(s.file) && (readText(root, s.file) ?? '').includes(secret)
    const f = {
      source: 'history',
      rule_id: s.ruleId,
      severity: s.dangerous ? 'critical' : 'high',
      confidence: s.confidence,
      title: t(`${keyOf(p)} in the git history`, `${keyOf(p)} no histórico do git`),
      detail: t(
        `Commit ${s.commit.slice(0, 8)} (${s.date}) added to ${s.file} what looks like a secret key: ${mask(secret)}. ${stillThere ? 'It is still in the file today.' : 'It was already deleted from the code, but it stays in the history.'}`,
        `O commit ${s.commit.slice(0, 8)} (${s.date}) adicionou em ${s.file} o que parece ser uma chave secreta: ${mask(secret)}. ${stillThere ? 'Ela ainda está no arquivo hoje.' : 'Ela já foi apagada do código, mas continua no histórico.'}`,
      ),
      impact: t(
        'Anyone who has or gets a copy of the repository (partner, former collaborator, a repository made public by mistake, a GitHub leak) finds the key in the history, even after it was deleted from the code.',
        'Quem tiver ou conseguir uma cópia do repositório (sócio, ex-colaborador, repositório público por engano, vazamento do GitHub) encontra a chave no histórico, mesmo depois de apagada do código.',
      ),
      fix: t(
        `1. Replace the key on ${shownName(p)}${p.url ? ` (${p.url})` : ''}: it is the only step that truly fixes it. ` +
          '2. Take the key out of the code (if it is still there) and use .env. ' +
          '3. Optional, and only if the repository is shared: rewriting the history (git filter-repo or BFG) removes the key from the commits, but changes every commit and requires everyone to clone again. Do it only with guidance.',
        `1. Troque a chave no ${shownName(p)}${p.url ? ` (${p.url})` : ''}: é o único passo que resolve de verdade. ` +
          '2. Tire a chave do código (se ainda estiver lá) e use o .env. ' +
          '3. Opcional, e só se o repositório for compartilhado: reescrever o histórico (git filter-repo ou BFG) apaga a chave dos commits, mas muda todos os commits e exige que todo mundo clone de novo. Faça isso só com orientação.',
      ),
      file: s.file,
      line: null,
      snippet: maskSecretsIn(s.line.trim()).slice(0, 240),
      fingerprint: `history|${s.ruleId}|${hash(secret)}`,
    }
    findings.push(TEST_PATH.test(s.file) || EXAMPLE_PATH.test(s.file) ? { ...f, severity: 'low' } : f)
  }
  return { findings, commits }
}

// ---- mapa do projeto para a revisão com IA ---------------------------------------------------

const STACK_SIGNS = [
  ['Next.js', (d) => d.next],
  ['React', (d) => d.react],
  ['Vite', (d) => d.vite],
  ['TanStack Start', (d) => d['@tanstack/react-start'] || d['@tanstack/start']],
  ['Remix / React Router', (d) => d['@remix-run/node'] || d['@react-router/node']],
  ['SvelteKit', (d) => d['@sveltejs/kit']],
  ['Nuxt / Vue', (d) => d.nuxt || d.vue],
  ['Express', (d) => d.express],
  ['Hono', (d) => d.hono],
  ['Fastify', (d) => d.fastify],
  ['FastAPI', (d) => d.fastapi],
  ['Django', (d) => d.django],
  ['Flask', (d) => d.flask],
  ['Supabase', (d, f) => d['@supabase/supabase-js'] || d['@supabase/ssr'] || d.supabase || f.some((x) => x.startsWith('supabase/'))],
  ['Firebase', (d, f) => d.firebase || d['firebase-admin'] || f.some((x) => /(^|\/)(firebase\.json|firestore\.rules)$/.test(x))],
  ['Stripe', (d) => d.stripe || d['@stripe/stripe-js']],
  ['Prisma', (d) => d.prisma || d['@prisma/client']],
  ['Drizzle', (d) => d['drizzle-orm']],
  ['Cloudflare Workers', (d, f) => d.wrangler || f.some((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x))],
  ['AI / LLM', (d) => d.openai || d['@anthropic-ai/sdk'] || d.ai || d['@ai-sdk/openai'] || d.langchain || d['@langchain/core'] || d['@google/generative-ai'] || d.anthropic],
  ['Auth.js / NextAuth', (d) => d['next-auth'] || d['@auth/core']],
  ['Clerk', (d) => d['@clerk/nextjs'] || d['@clerk/clerk-react']],
]

// Pacotes Python citados em requirements*.txt e pyproject.toml (só os nomes, em minúsculas).
function pythonDeps(root, files) {
  const out = {}
  for (const f of files.filter((x) => /(^|\/)(requirements[\w.-]*\.txt|pyproject\.toml)$/.test(x)).slice(0, 20)) {
    const text = readText(root, f) ?? ''
    // pyproject: os nomes entre aspas das listas de dependências ("fastapi>=0.110"); requirements: o começo da linha.
    const names = f.endsWith('.toml') ? [...text.matchAll(/["']([A-Za-z][\w.-]*)\s*(?:[<>=~!\[;]|["'])/g)] : [...text.matchAll(/^\s*([A-Za-z][\w.-]*)/gm)]
    for (const m of names) out[m[1].toLowerCase().replace(/_/g, '-')] = true
  }
  return out
}

// Temas do catálogo (plugin/skills/security/catalog/<tema>.md) e quando cada um vale.
const CI_FILE = /^\.github\/workflows\/.+\.ya?ml$|(^|\/)\.gitlab-ci\.ya?ml$|^\.circleci\/|(^|\/)bitbucket-pipelines\.yml$|(^|\/)azure-pipelines\.ya?ml$/
const PACKAGE_MANIFEST = /(^|\/)(package\.json|requirements[\w.-]*\.txt|pyproject\.toml|composer\.json|go\.mod|Cargo\.toml|Gemfile|pom\.xml|build\.gradle(\.kts)?|pubspec\.yaml)$/

// Tema do catálogo e quando ler: pela stack detectada ou pelos arquivos do projeto.
const TOPICS = [
  ['access-and-idor', () => true],
  ['authentication', () => true],
  ['input-and-injection', () => true],
  ['api-and-abuse', () => true],
  ['business-logic', () => true],
  ['data-exposure', () => true],
  ['data-lifecycle', () => true],
  ['least-privilege', () => true],
  ['logging-and-monitoring', () => true],
  ['browser', (_, files) => files.some((f) => /\.(jsx|tsx|vue|svelte|astro|html)$/.test(f))],
  ['ci-and-dependencies', (_, files) => files.some((f) => CI_FILE.test(f) || PACKAGE_MANIFEST.test(f))],
  ['supabase', (s) => s.includes('Supabase')],
  ['nextjs', (s) => s.includes('Next.js')],
  ['firebase', (s) => s.includes('Firebase')],
  ['ai-and-llm', (s) => s.includes('AI / LLM')],
  ['php-laravel', (s) => s.includes('PHP') || s.includes('Laravel') || s.includes('Symfony')],
  ['python-web', (s) => s.includes('Django') || s.includes('Flask') || s.includes('FastAPI')],
  ['flutter', (s) => s.includes('Flutter') || s.includes('Dart')],
  ['go', (s) => s.includes('Go')],
  ['java-spring', (s) => s.includes('Java') || s.includes('Kotlin')],
  ['dotnet', (s) => s.includes('C#')],
  ['rust', (s) => s.includes('Rust')],
  ['c-cpp', (s) => s.includes('C') || s.includes('C++')],
]

/** O que a revisão com IA precisa saber para começar: stack, onde estão as portas de entrada e que temas ler. */
export function projectMap(root) {
  const { files } = projectFiles(root)
  const deps = { ...pythonDeps(root, files), ...allDeps(root) }
  const langFrameworks = [...langDeps(root, files).keys()].map((k) => LANG_TECH[k]).filter((t) => t?.[1] === 'framework').map((t) => t[0])
  // Linguagem sem framework conhecido também puxa o tema dela (PHP puro, Dart, Go, Rust, C/C++…).
  const langs = [
    ['PHP', /\.php$/],
    ['Dart', /\.dart$/],
    ['Go', /\.go$/],
    ['Java', /\.java$/],
    ['Kotlin', /\.kts?$/],
    ['C#', /\.cs$/],
    ['Rust', /\.rs$/],
    ['C', /\.c$/],
    ['C++', /\.(cc|cpp|cxx|hpp|hh|hxx)$/],
  ].filter(([, re]) => files.some((f) => re.test(f))).map(([name]) => name)
  const stack = [...new Set([...STACK_SIGNS.filter(([, test]) => test(deps, files)).map(([name]) => name), ...langFrameworks, ...langs])]
  const other = files.filter((f) => OTHER_CODE.test(f) && !TEST_PATH.test(f))
  const code = files.filter((f) => CODE_FILE.test(f) && !TEST_PATH.test(f) && !/\.d\.ts$/.test(f))
  const pick = (re) => code.filter((f) => re.test(f)).slice(0, 60)
  return {
    stack,
    topics: TOPICS.filter(([, when]) => when(stack, files)).map(([t]) => t),
    entry: {
      'Server routes and functions': code.filter((f) => SERVER_ROUTE.test(f)).slice(0, 80),
      'Server actions / server functions': code.filter((f) => /^\s*['"]use server['"]|createServerFn\(/m.test(readText(root, f) ?? '')).slice(0, 40),
      'Middleware and route protection': pick(/(^|\/)(middleware|proxy)\.[mc]?[jt]s$|auth[^/]*\.(t|j)sx?$|guard/i),
      'Routes, controllers and handlers in other languages': other.filter((f) => /(controller|handler|route|router|endpoint|api|server|middleware|auth|main)[^/]*\.\w+$|\/(controllers?|handlers?|routes?|api|endpoints?)\//i.test(f)).slice(0, 80),
      'Migrations and database rules': files.filter((f) => /(^|\/)supabase\/.*\.sql$|\.rules$|database\.rules\.json$|prisma\/schema\.prisma$|drizzle\/.*\.(sql|ts)$|(^|\/)(migrations?|db\/migrate)\/.*\.(sql|php|rb|py|go|cs|java|kt)$/i.test(f)).slice(0, 60),
      'CI and automation': files.filter((f) => CI_FILE.test(f)).slice(0, 30),
      'Containers and server': files.filter((f) => /(^|\/)(Dockerfile[\w.-]*|(docker-)?compose\.ya?ml|nginx\.conf|Caddyfile)$|(^|\/)(k8s|kubernetes|helm)\/.*\.ya?ml$/i.test(f)).slice(0, 30),
      Configuration: files.filter((f) => HEADER_FILES.test(f) || /(^|\/)(\.env\.example|firebase\.json)$/.test(f)).slice(0, 30),
    },
  }
}

// ---- filtro de ruído e checagem completa -----------------------------------------------------

/** Rebaixa ou suprime (sem esconder) o que quase sempre é ruído, dizendo o motivo. */
export function applyNoiseRules(f) {
  const adjust = (severity, reason, suppressed = false) => ({
    ...f,
    severity_original: f.severity,
    severity,
    adjust_reason: reason,
    suppressed: f.suppressed || suppressed,
  })
  if (f.source === 'history' && f.severity === 'low')
    return { ...f, severity_original: 'high', adjust_reason: t('test or example file', 'arquivo de teste ou exemplo'), suppressed: true }
  if (f.source === 'secret' && f.file) {
    if (EXAMPLE_PATH.test(f.file)) return adjust('low', t('example file', 'arquivo de exemplo'), true)
    if (TEST_PATH.test(f.file)) return adjust('low', t('test file', 'arquivo de teste'), true)
    if (DOC_PATH.test(f.file))
      return adjust('low', t('documentation: it may be just an example; if it is a real key, replace it', 'documentação: pode ser só um exemplo; se for chave de verdade, troque-a'))
  }
  if (f.source === 'dependency' && !f.rule_id.startsWith('MAL-')) {
    if (f.dev) return adjust(lower(f.severity), t('only used during development: it does not go to the live site', 'só usado no desenvolvimento: não vai para o site publicado'), true)
    if (!f.fixed_in) return adjust(f.severity, t('there is no fixed version yet', 'ainda não existe versão corrigida'), true)
  }
  return { ...f, severity_original: f.severity, adjust_reason: null, suppressed: false }
}

/**
 * Checagem completa (ou só de alguns arquivos). `scopes` diz ao servidor o que foi olhado, para que só
 * o que foi olhado e não apareceu mais conte como corrigido.
 */
export async function scanProject(root, { only = null, deps = true, history = false } = {}) {
  const started = Date.now()
  const { files: all, tracked } = projectFiles(root)
  const files = only ? all.filter((f) => only.includes(f)) : all
  const scopes = [
    { source: 'secret', files: only ? files : null },
    { source: 'code', files: only ? files : null },
  ]
  const findings = [...scanSecrets(root, files, { tracked, envDir: only ? null : root }), ...scanCode(root, files)]
  const stats = { files: files.length }
  const errors = []
  let snapshot = null

  // O que falta no projeto inteiro (limite de pedidos, cabeçalhos, regras do Firebase): na checagem completa
  // ou quando um arquivo que muda essa resposta foi editado.
  if (!only || files.some((f) => SERVER_ROUTE.test(f) || HEADER_FILES.test(f) || /(^|\/)(package\.json|firestore\.rules|storage\.rules|database\.rules\.json)$/.test(f))) {
    findings.push(...scanConfig(root, all))
    // O .env do computador apontando para o banco da nuvem (o dos usuários, muitas vezes).
    findings.push(...remoteDatabaseFindings(root))
    findings.push(...publicSecretValueFindings(root))
    scopes.push({ source: 'config', files: null })
  }

  if (!only || files.some((f) => /(^|\/)supabase\/.*\.sql$/i.test(f))) {
    const db = scanDatabase(root, all)
    findings.push(...db.findings)
    scopes.push({ source: 'database', files: null })
    stats.tables = db.tables
  }
  if (deps && (!only || files.some((f) => LOCKFILE.test(f) || LANG_LOCKFILE.test(f) || /(^|\/)package\.json$/.test(f)))) {
    try {
      const d = await scanDependencies(root, all)
      findings.push(...d.findings)
      scopes.push({ source: 'dependency', files: null })
      stats.packages = d.packages
      stats.lockfiles = d.lockfiles.length
      snapshot = d.snapshot
    } catch (err) {
      // Sem internet: os achados de pacotes da checagem anterior continuam valendo.
      errors.push(t(`packages: ${err.message}`, `pacotes: ${err.message}`))
    }
  }
  if (history && !only) {
    try {
      const h = scanHistory(root)
      findings.push(...h.findings)
      scopes.push({ source: 'history', files: null })
      stats.commits = h.commits
    } catch (err) {
      errors.push(t(`git history: ${err.message}`, `histórico do git: ${err.message}`))
    }
  }
  const unique = [...new Map(findings.map((f) => [f.fingerprint, f])).values()].map(applyNoiseRules)
  return { findings: unique, scopes, stats: { ...stats, ms: Date.now() - started }, errors, snapshot }
}
