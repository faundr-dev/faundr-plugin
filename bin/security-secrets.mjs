// Segredos no código e nos .env: provedores conhecidos, chaves públicas com valor secreto,
// .env fora do .gitignore e a trava de escrita do hook (parte de security.mjs).
import fs from 'node:fs'
import { SECRET_RULES } from '../dist/secret-rules.mjs'
import { t } from './i18n.mjs'
import { hash, BINARY, LOCKFILES, readText, lineOf, lineText, mask, entropy, TEST_PATH, EXAMPLE_PATH, DOC_PATH } from './security-base.mjs'

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
export const shownName = (p) => (p.name === 'private key' ? t('private key', 'chave privada') : p.name)
// "Chave do Stripe" / "Chave privada" (o começo do título dos achados de chave).
export const keyOf = (p) => (p.name === 'private key' ? t('Private key', 'Chave privada') : t(`${p.name} key`, `Chave do ${p.name}`))

export function provider(ruleId) {
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

export function scanSecrets(root, files, { tracked, envDir }) {
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
