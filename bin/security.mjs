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
import { LOCKFILE, parseLockfile } from './lockfiles.mjs'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const lower = (s) => SEVERITIES[Math.min(SEVERITIES.indexOf(s) + 1, SEVERITIES.length - 1)]
const MAX_FILE = 1_000_000
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

// ---- arquivos do projeto --------------------------------------------------------------------

const SKIP_PATH = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|\.next|\.nuxt|\.svelte-kit|\.wrangler|\.vercel|\.turbo|coverage|vendor|\.venv|venv|__pycache__|\.claude|\.remember)(\/|$)/
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|svg|pdf|zip|gz|tgz|rar|7z|woff2?|ttf|otf|eot|mp[34]|mov|webm|wav|ogg|wasm|exe|dll|so|dylib|bin|lockb|jar|class|pyc|ai|psd|sketch|fig|docx?|xlsx?|pptx?|odp)$/i
const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|deno\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/

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
  [/^private-key/, 'chave privada', null],
  [/^jwt/, 'JWT', null],
]

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
    return null
  }
}

/** Procura chaves num texto. Devolve { ruleId, secret, index, confidence, dangerous }. */
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

const TEST_PATH = /(^|\/)(__tests__|__mocks__|tests?|spec|specs|fixtures?|mocks?|e2e|cypress|playwright|stories)(\/|$)|\.(test|spec|stories)\.[a-z]+$/i
const EXAMPLE_PATH = /\.(example|sample|template|dist|defaults?)(\.[a-z]+)?$|(^|\/)examples?(\/|$)/i
const DOC_PATH = /\.(md|mdx|txt|rst|adoc)$/i
const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/i
const isEnvFile = (rel) => ENV_FILE.test(rel) && !EXAMPLE_PATH.test(rel)

function secretFinding(rel, text, s) {
  const p = provider(s.ruleId)
  const masked = mask(s.secret)
  const serious = s.dangerous || s.confidence === 'high'
  return {
    source: 'secret',
    rule_id: s.ruleId,
    severity: s.dangerous ? 'critical' : s.confidence === 'high' ? 'high' : s.confidence === 'medium' ? 'medium' : 'low',
    confidence: s.confidence,
    title: s.ruleId === 'supabase-service-role' ? 'Chave service_role do Supabase no código' : `Chave ${p.name === 'chave privada' ? 'privada' : `do ${p.name}`} no código`,
    detail: `Encontrei o que parece ser uma chave secreta${p.name === 'JWT' ? ' (um token JWT)' : ` do ${p.name}`} escrita direto no arquivo: ${masked}.`,
    impact:
      s.ruleId === 'supabase-service-role'
        ? 'A service_role ignora todas as regras de acesso do banco. Quem tiver essa chave lê, altera e apaga qualquer dado do projeto.'
        : serious
          ? `Quem tiver acesso ao código (ou ao site, se o arquivo for para o navegador) pode usar essa chave em seu nome no ${p.name}${p.name === 'Stripe' ? ', inclusive movimentar dinheiro' : ''}.`
          : 'Se for uma chave de verdade, quem tiver acesso ao código pode usá-la.',
    fix:
      `1. Tire a chave do código: coloque-a no arquivo .env (que não vai para o git) e leia com process.env.NOME_DA_VARIAVEL. ` +
      `2. Troque a chave no ${p.name}${p.url ? ` (${p.url})` : ''}: ela já pode ter vazado. ` +
      '3. Se o arquivo já foi para o git, a chave antiga continua no histórico; por isso a troca no passo 2 é obrigatória.',
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
    title: `Segredo em variável pública: ${name}`,
    detail: `A variável ${name} tem prefixo público: o valor dela é embutido no site e qualquer visitante consegue ler, mesmo estando no .env.`,
    impact: 'Se o valor for uma chave secreta (service_role, chave de API, senha), ela fica exposta para qualquer pessoa que abrir o site.',
    fix: `Renomeie a variável sem o prefixo público (ex.: ${name.replace(/^(NEXT_PUBLIC|VITE|EXPO_PUBLIC|REACT_APP|NUXT_PUBLIC|PUBLIC|GATSBY)_/, '')}) e use-a só no servidor (rota de API, server action, edge function). Se o valor já foi publicado, troque a chave no provedor.`,
    file: rel,
    line: lineOf(text, index),
    snippet: lineText(text, index).replace(/=.*/, '= …').trim().slice(0, 240),
    fingerprint: `secret|public-env-secret|${rel}|${name}`,
  }
}

// Linha de .env que define a variável (NOME=valor), e não só a menciona.
const definesVar = (text, index, name) => new RegExp(`^\\s*(export\\s+)?${name}\\s*=\\s*\\S`).test(lineText(text, index))

function scanSecrets(root, files, { tracked, envDir }) {
  const out = []
  for (const rel of files) {
    if (BINARY.test(rel) || LOCKFILES.test(rel)) continue
    const text = readText(root, rel)
    if (!text || text.startsWith('// Gerado por engine/secret-rules.mjs')) continue
    const env = isEnvFile(rel)
    // .env fora do git é o lugar certo da chave; o problema é ele ir para o git (checado abaixo).
    if (!env || tracked?.has(rel)) for (const s of findSecrets(text, rel)) out.push(secretFinding(rel, text, s))
    for (const m of text.matchAll(PUBLIC_ENV)) {
      // Em código, só quando a variável é lida (process.env.X / import.meta.env.X); em .env, quando é definida.
      const before = text.slice(Math.max(0, m.index - 16), m.index)
      if (env ? definesVar(text, m.index, m[1]) : /env\.$/.test(before)) out.push(publicEnvFinding(rel, text, m.index, m[1]))
    }
  }
  // .env que está (ou vai estar) no git.
  if (tracked)
    for (const rel of files.filter(isEnvFile)) {
      const text = readText(root, rel) ?? ''
      const hasValues = /^\s*[A-Z0-9_]+\s*=\s*\S+/m.test(text)
      if (!hasValues) continue
      const inGit = tracked.has(rel)
      out.push({
        source: 'secret',
        rule_id: inGit ? 'env-in-git' : 'env-not-ignored',
        severity: inGit ? 'critical' : 'high',
        confidence: 'high',
        title: inGit ? `Arquivo ${rel} está no git` : `Arquivo ${rel} fora do .gitignore`,
        detail: inGit
          ? `O ${rel} guarda as chaves e senhas do projeto e foi salvo no git.`
          : `O ${rel} guarda as chaves e senhas do projeto e não está no .gitignore: o próximo "git add" leva ele junto.`,
        impact: 'Quem tiver acesso ao repositório (ou a uma cópia dele) vê todas as chaves do projeto.',
        fix: inGit
          ? `Adicione ".env*" e "!.env.example" ao .gitignore, rode "git rm --cached ${rel}" e troque as chaves que estavam nele: elas continuam no histórico do git.`
          : 'Adicione ".env*" e "!.env.example" ao .gitignore.',
        file: rel,
        line: null,
        snippet: null,
        fingerprint: `secret|env-file|${rel}`,
      })
    }
  // .env ignorado pelo git não entra na lista de arquivos, mas uma variável pública com segredo nele vaza pelo site.
  for (const name of envDir ? fs.readdirSync(envDir).filter((f) => isEnvFile(f) && !files.includes(f)) : []) {
    const text = readText(root, name)
    if (!text) continue
    for (const m of text.matchAll(PUBLIC_ENV)) if (definesVar(text, m.index, m[1])) out.push(publicEnvFinding(name, text, m.index, m[1]))
  }
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
    return { name: s.ruleId === 'supabase-service-role' ? 'service_role do Supabase' : p.name, masked: mask(s.secret), url: p.url }
  }
  return {
    block: soft ? [] : found.filter((s) => s.dangerous).map(describe),
    warn: found.filter((s) => soft || !s.dangerous).map(describe),
  }
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
    return {}
  }
}

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
            .filter((a) => a.package?.ecosystem === 'npm' || a.package?.ecosystem === 'PyPI')
            .map((a) => ({ name: a.package.name, ranges: a.ranges ?? [], versions: a.versions?.length > 200 ? [] : (a.versions ?? []) })),
          url: v.references?.find((r) => r.type === 'ADVISORY')?.url ?? `https://osv.dev/vulnerability/${id}`,
        }
      }),
    )
  }
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
  } catch {}
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
  return score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low'
}

// Menor versão corrigida para a versão instalada (null = ainda não existe correção).
function fixedVersion(v, name, version) {
  const fixes = []
  for (const a of v.affected.filter((x) => x.name === name)) {
    for (const r of a.ranges) {
      if (r.type !== 'SEMVER' && r.type !== 'ECOSYSTEM') continue
      let introduced = null
      for (const e of r.events) {
        if (e.introduced !== undefined) introduced = e.introduced
        else if (e.fixed !== undefined && introduced !== null) {
          if ((introduced === '0' || compareVersions(version, introduced) >= 0) && compareVersions(version, e.fixed) < 0) fixes.push(e.fixed)
          introduced = null
        }
      }
    }
  }
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
const MANAGER = {
  npm: { add: (n, v) => `npm install ${n}@^${v}`, update: (n) => `npm update ${n}`, remove: (n) => `npm uninstall ${n}`, force: 'em "overrides" no package.json' },
  pnpm: { add: (n, v) => `pnpm add ${n}@^${v}`, update: (n) => `pnpm update ${n}`, remove: (n) => `pnpm remove ${n}`, force: 'em "pnpm.overrides" no package.json' },
  yarn: { add: (n, v) => `yarn add ${n}@^${v}`, update: (n) => `yarn up ${n}`, remove: (n) => `yarn remove ${n}`, force: 'em "resolutions" no package.json' },
  bun: { add: (n, v) => `bun add ${n}@^${v}`, update: (n) => `bun update ${n}`, remove: (n) => `bun remove ${n}`, force: 'em "overrides" no package.json' },
  pip: { add: (n, v) => `atualize a linha para ${n}==${v} no requirements e rode pip install -r`, update: (n) => `pip install -U ${n}`, remove: (n) => `pip uninstall ${n}`, force: 'fixando a versão no requirements' },
  poetry: { add: (n, v) => `poetry add ${n}@^${v}`, update: (n) => `poetry update ${n}`, remove: (n) => `poetry remove ${n}`, force: 'como dependência direta no pyproject.toml' },
  uv: { add: (n, v) => `uv add "${n}>=${v}"`, update: (n) => `uv lock --upgrade-package ${n}`, remove: (n) => `uv remove ${n}`, force: 'como dependência direta no pyproject.toml' },
  pipenv: { add: (n, v) => `pipenv install "${n}>=${v}"`, update: (n) => `pipenv update ${n}`, remove: (n) => `pipenv uninstall ${n}`, force: 'no Pipfile' },
}

async function scanDependencies(root, files) {
  const lockfiles = files.filter((f) => LOCKFILE.test(f))
  const entries = []
  const readManifest = (dir) => {
    try {
      return JSON.parse(readText(root, path.posix.join(dir, 'package.json')) ?? '{}')
    } catch {
      return {}
    }
  }
  for (const lf of lockfiles) {
    const text = readText(root, lf)
    if (!text) continue
    let parsed
    try {
      parsed = parseLockfile(lf, text, readManifest)
    } catch {
      continue
    }
    if (!parsed) continue
    for (const p of parsed.pkgs) entries.push({ ...p, ecosystem: parsed.ecosystem, manager: parsed.manager, lockfile: lf })
  }
  const unique = [...new Map(entries.map((e) => [`${e.ecosystem}:${e.name}@${e.version}`, e])).values()]
  if (!unique.length) return { findings: [], packages: 0, lockfiles, snapshot: { packages: [], known: [] } }

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
    if (!res.ok) throw new Error(`OSV respondeu ${res.status}`)
    const { results } = await res.json()
    results.forEach((r, j) => {
      if (!r.vulns?.length) return
      hits.set(`${batch[j].ecosystem}:${batch[j].name}@${batch[j].version}`, r.vulns.map((v) => v.id))
      for (const v of r.vulns) known.set(v.id, v.modified)
    })
  }
  const details = await osvDetails([...known.keys()], known)

  const findings = []
  for (const e of entries) {
    const ids = hits.get(`${e.ecosystem}:${e.name}@${e.version}`)
    const cmd = MANAGER[e.manager] ?? MANAGER.npm
    if (!ids) continue
    // Uma falha costuma ter vários ids (GHSA + CVE): fica o GHSA, com os outros como apelidos.
    const primary = new Map()
    for (const id of ids) {
      const v = details[id]
      if (!v) continue
      const group = [id, ...v.aliases].sort((a, b) => (a.startsWith('GHSA') ? -1 : b.startsWith('GHSA') ? 1 : a.localeCompare(b)))[0]
      if (!primary.has(group) || id.startsWith('GHSA')) primary.set(group, id)
    }
    for (const id of primary.values()) {
      const v = details[id]
      const malicious = id.startsWith('MAL-')
      const fixed = malicious ? null : fixedVersion(v, e.name, e.version)
      const chain = e.via?.length > 1 ? e.via.join(' > ') : null
      findings.push({
        source: 'dependency',
        rule_id: id,
        severity: vulnSeverity(id, v),
        confidence: 'high',
        title: malicious ? `Pacote malicioso: ${e.name}` : `${e.name} ${e.version}: ${v.summary || 'falha de segurança conhecida'}`,
        detail: malicious
          ? `O pacote ${e.name} ${e.version} foi marcado como malicioso (código feito para roubar dados ou atacar quem instala).`
          : `A versão ${e.version} do pacote ${e.name} tem uma falha de segurança publicada (${id}).${firstSentences(v.details)}`,
        impact: malicious
          ? 'Ele pode já ter rodado no seu computador ao ser instalado. Remova e troque as chaves que estavam na máquina.'
          : `Depende de como o projeto usa o pacote${e.dev ? '; como ele só é usado no desenvolvimento, não vai para o site publicado' : ''}.`,
        fix: malicious
          ? `Remova o pacote (${cmd.remove(e.via?.[0] ?? e.name)}), apague a pasta de dependências instaladas e troque as chaves e senhas deste computador.`
          : fixed
            ? chain
              ? `O ${e.name} vem de ${chain}. Atualize o ${e.via[0]} (${cmd.update(e.via[0])}); se não resolver, force o ${e.name} ${fixed} ou mais novo ${cmd.force}.`
              : `Atualize para a versão ${fixed} ou mais nova: ${cmd.add(e.name, fixed)}`
            : 'Ainda não existe versão corrigida. Veja se há outra forma de evitar o problema no aviso da falha ou se dá para trocar de pacote.',
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
      })
    }
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

function scanDatabase(root, files) {
  const sqlFiles = files.filter((f) => /(^|\/)supabase\/.*\.sql$/i.test(f)).sort()
  const tables = new Map() // public.nome → { file, line, rls }
  const findings = []
  for (const rel of sqlFiles) {
    const text = readText(root, rel)
    if (!text) continue
    for (const stmt of splitSql(text)) {
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
      } else if ((m = s.match(/^create policy ("[^"]+"|\S+) on ([\w."]+)(.*)$/i))) {
        const policy = m[1].replace(/"/g, '')
        const t = tableName(m[2])
        const rest = m[3]
        const cmd = (rest.match(/ for (all|select|insert|update|delete)\b/i)?.[1] ?? 'all').toLowerCase()
        const roles = rest.match(/ to ([\w", ]+?)(?: using| with check|$)/i)?.[1]?.toLowerCase() ?? 'public'
        const alwaysTrue = /(using|with check) \(\s*\(?\s*(true|1\s*=\s*1)\s*\)?\s*\)/i.test(rest)
        if (alwaysTrue && cmd !== 'select' && !/service_role/.test(roles) && t.schema !== 'storage')
          findings.push({
            source: 'database',
            rule_id: 'rls-policy-always-true',
            severity: /anon|public/.test(roles) ? 'critical' : 'high',
            confidence: 'high',
            title: `Política "${policy}" libera ${cmd === 'all' ? 'tudo' : cmd} em ${t.name} para ${/anon|public/.test(roles) ? 'qualquer pessoa' : 'qualquer usuário logado'}`,
            detail: `A política "${policy}" da tabela ${t.name} tem a condição "true": ela não confere quem está pedindo.`,
            impact:
              cmd === 'insert'
                ? `${/anon|public/.test(roles) ? 'Qualquer pessoa' : 'Qualquer usuário logado'} pode criar linhas em ${t.name} com qualquer conteúdo, inclusive em nome de outra pessoa.`
                : `${/anon|public/.test(roles) ? 'Qualquer pessoa' : 'Qualquer usuário logado'} pode ${cmd === 'delete' ? 'apagar' : 'alterar'} linhas de outras pessoas em ${t.name}.`,
            fix: `Troque "true" por uma condição que confira o dono, por exemplo: using ((select auth.uid()) = user_id)${cmd === 'insert' || cmd === 'update' || cmd === 'all' ? ' with check ((select auth.uid()) = user_id)' : ''}. Faça isso numa nova migration (drop policy + create policy).`,
            file: rel,
            line: stmt.line,
            snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
            fingerprint: `database|rls-policy-always-true|${t.name}|${policy}`,
          })
      } else if (/^insert into storage\.buckets/i.test(s) && /\btrue\b/i.test(s)) {
        const cols = s.match(/buckets ?\(([^)]*)\)/i)?.[1]?.split(',').map((c) => c.trim().toLowerCase()) ?? []
        const values = s.match(/values ?\((.*)\)/i)?.[1]?.split(',').map((v) => v.trim()) ?? []
        const pub = cols.indexOf('public')
        if (pub !== -1 && /^true$/i.test(values[pub] ?? '')) {
          const bucket = (values[cols.indexOf('id')] ?? values[cols.indexOf('name')] ?? '').replace(/'/g, '')
          findings.push({
            source: 'database',
            rule_id: 'storage-public-bucket',
            severity: 'medium',
            confidence: 'high',
            title: `Bucket de arquivos público: ${bucket}`,
            detail: `O bucket ${bucket} foi criado como público: qualquer pessoa com o link abre os arquivos, sem login.`,
            impact: 'Se guardar documentos, fotos pessoais ou arquivos de clientes, eles ficam acessíveis para quem descobrir o link.',
            fix: 'Se os arquivos não são para o público, deixe o bucket privado (public = false) e entregue os arquivos com links temporários (createSignedUrl).',
            file: rel,
            line: stmt.line,
            snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
            fingerprint: `database|storage-public-bucket|${bucket}`,
          })
        }
      } else if ((m = s.match(/^create (?:or replace )?function ([\w."]+)/i)) && /security definer/i.test(s) && !/set search_path/i.test(s)) {
        const fn = m[1].replace(/"/g, '')
        findings.push({
          source: 'database',
          rule_id: 'security-definer-search-path',
          severity: 'medium',
          confidence: 'medium',
          title: `Função ${fn} roda com poder total sem search_path fixo`,
          detail: `A função ${fn} é "security definer" (roda com as permissões de quem a criou, ignorando as regras de acesso) e não fixa o search_path.`,
          impact: 'Alguém com permissão para criar objetos no banco pode enganar a função e fazer ela executar código dele com poder total.',
          fix: `Adicione "set search_path = ''" na definição da função (e use nomes completos, como public.tabela). Confira também se ela precisa mesmo ser security definer.`,
          file: rel,
          line: stmt.line,
          snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
          fingerprint: `database|security-definer-search-path|${fn.toLowerCase()}`,
        })
      }
    }
  }
  for (const [name, t] of tables)
    if (!t.rls)
      findings.push({
        source: 'database',
        rule_id: 'rls-disabled',
        severity: 'critical',
        confidence: 'high',
        title: `Tabela ${name} sem proteção de acesso (RLS)`,
        detail: `A tabela public.${name} foi criada sem "enable row level security". Sem isso, as regras de acesso do Supabase não valem para ela.`,
        impact: `Qualquer pessoa com a chave pública do app (que fica no navegador) pode ler, alterar e apagar tudo em ${name}.`,
        fix: `Numa nova migration: alter table public.${name} enable row level security; e crie políticas que só deixam cada usuário ver e mudar os próprios dados.`,
        file: t.file,
        line: t.line,
        snippet: `create table public.${name} (…)`,
        fingerprint: `database|rls-disabled|${name}`,
      })
  return { findings, tables: tables.size, files: sqlFiles.length }
}

// ---- código (padrões perigosos, sem IA) -----------------------------------------------------

const CODE_FILE = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro|py)$/i
const SERVER_ROUTE = /(^|\/)(app\/(.*\/)?api\/.*\/?route\.[mc]?[jt]s|pages\/api\/.*\.[mc]?[jt]sx?|src\/routes\/api\/.*\.[mc]?[jt]sx?|supabase\/functions\/[^/]+\/index\.[jt]s|functions\/.*\.[jt]s|server\/.*\.[mc]?[jt]s|api\/.*\.[mc]?[jt]s)$/i

// Regras por linha: o que é quase sempre perigoso quando aparece com dado variável.
// Cada regra: padrão da linha, exceção (se a linha tiver isto, está ok) e o texto do achado.
const LINE_RULES = [
  {
    id: 'xss-dangerously-set-inner-html',
    re: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!['"`])/,
    ok: /sanitize|DOMPurify|purify|escape/i,
    severity: 'medium',
    cwe: 'CWE-79',
    title: 'HTML inserido na tela sem limpar (dangerouslySetInnerHTML)',
    detail: 'O componente coloca HTML direto na página a partir de uma variável.',
    impact: 'Se esse conteúdo vier de um usuário (comentário, nome, texto do banco, resposta de IA), alguém pode injetar um script que roda no navegador de quem abrir a página e roubar a sessão.',
    fix: 'Evite HTML cru: mostre como texto. Se precisar de HTML (ex.: markdown), limpe antes com DOMPurify.sanitize(html).',
  },
  {
    id: 'xss-inner-html',
    re: /\.(innerHTML|outerHTML)\s*[+]?=\s*(?!['"`]\s*[;)]?$)(?!['"][^'"]*['"]\s*;?\s*$)|document\.write\s*\(/,
    ok: /sanitize|DOMPurify|purify|escape|textContent/i,
    severity: 'medium',
    cwe: 'CWE-79',
    title: 'HTML montado com innerHTML',
    detail: 'O código escreve HTML na página com innerHTML/outerHTML/document.write a partir de uma variável.',
    impact: 'Se o valor vier de um usuário ou de fora, alguém pode injetar um script que roda no navegador de quem abrir a página.',
    fix: 'Use textContent para texto; se precisar de HTML, limpe antes com DOMPurify.sanitize().',
  },
  {
    id: 'code-eval',
    re: /(?<![\w.])(eval|new\s+Function)\s*\(\s*(?!['"`][^'"`$]*['"`]\s*\))/,
    severity: 'high',
    cwe: 'CWE-95',
    title: 'Código executado a partir de texto (eval / new Function)',
    detail: 'O código executa um texto como programa (eval ou new Function) com um valor que não é fixo.',
    impact: 'Se esse texto puder vir de um usuário ou de fora, quem controlar o texto executa o que quiser no servidor ou no navegador.',
    fix: 'Troque eval por uma alternativa segura: JSON.parse para dados, um mapa de funções permitidas para ações.',
  },
  {
    id: 'command-injection',
    re: /\b(exec|execSync|spawn|spawnSync)\s*\(\s*(`[^`]*\$\{|['"][^'"]*['"]\s*\+|[a-zA-Z_$][\w$.]*\s*\+)/,
    ok: /shell\s*:\s*false/,
    severity: 'high',
    cwe: 'CWE-78',
    title: 'Comando do sistema montado com texto variável',
    detail: 'Um comando do sistema operacional é montado juntando texto com uma variável.',
    impact: 'Se a variável puder vir de um usuário, ele consegue rodar qualquer comando no servidor (apagar arquivos, roubar chaves).',
    fix: 'Use execFile/spawn com a lista de argumentos separada (sem shell) e valide o valor contra uma lista do que é permitido.',
  },
  {
    id: 'sql-injection',
    re: /\b(query|execute|raw|whereRaw|orderByRaw|\$queryRawUnsafe|\$executeRawUnsafe|unsafe)\s*\(\s*`[^`]*\b(select|insert|update|delete|where|order by)\b[^`]*\$\{/i,
    severity: 'high',
    cwe: 'CWE-89',
    title: 'Consulta SQL montada com texto variável',
    detail: 'A consulta SQL é montada colando uma variável dentro do texto (${...}).',
    impact: 'Se a variável vier de um usuário, ele pode mudar a consulta e ler, alterar ou apagar dados de outras pessoas (SQL injection).',
    fix: 'Use parâmetros: query("... where id = $1", [id]) ou o construtor de consultas da biblioteca (sql`...` com valores interpolados de forma segura, .eq(), where({ id })).',
  },
  {
    id: 'cors-any-origin',
    re: /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]|\borigin\s*:\s*['"]\*['"]|\borigin\s*:\s*true\b/,
    severity: 'medium',
    cwe: 'CWE-942',
    title: 'CORS liberado para qualquer site',
    detail: 'A API aceita pedidos vindos de qualquer site (Access-Control-Allow-Origin: * ou origin refletida).',
    impact: 'Qualquer site pode chamar esta API pelo navegador de quem está logado; com cookies ou credenciais, ele lê dados da pessoa.',
    fix: 'Liste só os domínios do seu app em origin (ex.: origin: ["https://meuapp.com"]). Nunca combine "*" com credentials: true.',
  },
  {
    id: 'jwt-decode-without-verify',
    re: /\bjwt\.decode\s*\(|\bjwtDecode\s*\(|\bdecodeJwt\s*\(/,
    fileOk: /jwt\.verify|jwtVerify|verifyIdToken|getUser\(|getClaims\(/,
    severity: 'medium',
    cwe: 'CWE-347',
    title: 'Token lido sem conferir a assinatura',
    detail: 'O código lê o conteúdo de um token JWT (decode) e o arquivo não confere a assinatura em nenhum lugar (verify).',
    impact: 'Se a decisão de acesso usar esse conteúdo, qualquer pessoa monta um token falso dizendo ser outro usuário ou admin.',
    fix: 'Confira a assinatura com jwt.verify / jose.jwtVerify (ou supabase.auth.getUser()) antes de confiar no que o token diz.',
  },
  {
    id: 'open-redirect',
    re: /\b(redirect|NextResponse\.redirect|res\.redirect|location\.href\s*=|window\.location\s*=)\s*\(?[^;\n]*(searchParams\.get|req\.query|query\.|params\.(next|redirect|url|return))/i,
    ok: /startsWith\(['"]\/['"]\)|allowed|whitelist|allowlist|new URL\([^)]*origin/i,
    severity: 'medium',
    cwe: 'CWE-601',
    title: 'Redirecionamento para endereço vindo da URL',
    detail: 'O app redireciona para um endereço que vem de um parâmetro da URL (ex.: ?next=...).',
    impact: 'Alguém manda um link do seu site que leva a vítima para um site falso (phishing), com a cara de confiável do seu domínio.',
    fix: 'Só aceite caminhos internos (começando com "/" e não com "//") ou uma lista de destinos permitidos.',
  },
  {
    id: 'tls-verification-disabled',
    re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|rejectUnauthorized\s*:\s*false|verify\s*=\s*False/,
    severity: 'medium',
    cwe: 'CWE-295',
    title: 'Conferência de certificado HTTPS desligada',
    detail: 'O código desliga a conferência do certificado HTTPS nas conexões.',
    impact: 'Alguém no meio do caminho (Wi-Fi público, rede comprometida) pode se passar pelo servidor e ler ou alterar os dados, inclusive chaves.',
    fix: 'Remova essa opção. Se for um certificado próprio, informe a autoridade certificadora (ca) em vez de desligar a conferência.',
  },
  {
    id: 'python-shell-true',
    re: /subprocess\.\w+\([^)]*shell\s*=\s*True/,
    severity: 'high',
    cwe: 'CWE-78',
    title: 'Comando do sistema com shell=True',
    detail: 'O subprocess roda o comando através do shell.',
    impact: 'Se parte do comando vier de um usuário, ele consegue rodar qualquer comando no servidor.',
    fix: 'Passe o comando como lista de argumentos, sem shell=True.',
  },
  {
    id: 'python-unsafe-deserialization',
    re: /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*SafeLoader)/,
    severity: 'high',
    cwe: 'CWE-502',
    title: 'Leitura insegura de dados (pickle / yaml.load)',
    detail: 'O código transforma dados em objetos com pickle ou yaml.load sem o carregador seguro.',
    impact: 'Se os dados vierem de fora, quem os controla executa código no servidor.',
    fix: 'Use json para dados de fora; para YAML, yaml.safe_load().',
  },
]

// Regras por arquivo: o que falta no arquivo inteiro (ex.: webhook que não confere a assinatura).
function fileRules(rel, text) {
  const out = []
  const isRoute = SERVER_ROUTE.test(rel)
  // Webhook do Stripe sem conferir a assinatura.
  if (isRoute && /stripe/i.test(text) && /webhook|stripe-signature/i.test(rel + text) && /(checkout\.session|payment_intent|invoice\.|customer\.subscription|event\.type)/.test(text) && !/constructEvent(Async)?\s*\(/.test(text))
    out.push({
      rule_id: 'stripe-webhook-without-signature',
      severity: 'high',
      cwe: 'CWE-345',
      index: text.search(/event\.type|checkout\.session|payment_intent/),
      title: 'Webhook do Stripe sem conferir a assinatura',
      detail: 'A rota trata eventos do Stripe (pagamento, assinatura) mas não chama stripe.webhooks.constructEvent para conferir que o aviso veio mesmo do Stripe.',
      impact: 'Qualquer pessoa pode chamar essa rota fingindo ser o Stripe e marcar um pagamento como feito, liberar um plano ou créditos sem pagar.',
      fix: 'Leia o corpo cru (await request.text()) e use stripe.webhooks.constructEvent(corpo, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET) antes de tratar o evento.',
    })
  // Chave de admin do Supabase num arquivo que roda no navegador.
  if (/^\s*['"]use client['"]/m.test(text) && /SERVICE_ROLE|sb_secret_|serviceRole/i.test(text))
    out.push({
      rule_id: 'supabase-service-role-in-client',
      severity: 'critical',
      cwe: 'CWE-522',
      index: text.search(/SERVICE_ROLE|sb_secret_|serviceRole/i),
      title: 'Chave de admin do Supabase usada em arquivo do navegador',
      detail: 'Um arquivo marcado com "use client" (roda no navegador) usa a chave service_role/secret do Supabase.',
      impact: 'A service_role ignora todas as regras de acesso: quem abrir o site pode pegá-la e ler, alterar ou apagar qualquer dado.',
      fix: 'No navegador, use só a chave pública (anon/publishable) com RLS. Operações de admin vão para o servidor (rota de API, server action, edge function).',
    })
  return out
}

function scanCode(root, files) {
  const out = []
  for (const rel of files) {
    if (!CODE_FILE.test(rel) || /\.(d\.ts|min\.js)$/.test(rel) || TEST_PATH.test(rel)) continue
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
      for (const r of LINE_RULES) {
        if (!r.re.test(line) || r.ok?.test(line) || r.fileOk?.test(text)) continue
        out.push(codeFinding(rel, r.id, r, i + 1, trimmed))
      }
      offset += line.length + 1
    }
    for (const f of fileRules(rel, text)) out.push(codeFinding(rel, f.rule_id, f, f.index >= 0 ? lineOf(text, f.index) : null, f.index >= 0 ? lineText(text, f.index).trim() : null))
  }
  return out
}

function codeFinding(rel, ruleId, r, line, snippet) {
  return {
    source: 'code',
    rule_id: ruleId,
    severity: r.severity,
    confidence: 'medium',
    title: r.title,
    detail: `${r.detail} Confira se o valor pode vir de fora: se for sempre um valor fixo do próprio código, não é problema.`,
    impact: r.impact,
    fix: r.fix,
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

function scanConfig(root, files) {
  const out = []
  const code = files.filter((f) => CODE_FILE.test(f) && !TEST_PATH.test(f) && !/\.d\.ts$/.test(f))
  const routes = code.filter((f) => SERVER_ROUTE.test(f))
  const pkg = JSON.parse(readText(root, 'package.json') ?? '{}')
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const texts = new Map()
  const read = (f) => {
    if (!texts.has(f)) texts.set(f, readText(root, f) ?? '')
    return texts.get(f)
  }

  // Limite de pedidos: nenhuma rota do servidor tem, nem o projeto usa biblioteca ou configuração para isso.
  if (routes.length) {
    const serverCode = code.filter((f) => SERVER_ROUTE.test(f) || /(^|\/)(server|middleware|lib\/server|src\/server)(\/|\.)/i.test(f))
    const hasLimit =
      Object.keys(pkg.dependencies ?? {}).some((d) => RATE_LIMIT_DEPS.test(d)) ||
      serverCode.some((f) => RATE_LIMIT_CODE.test(read(f))) ||
      files.filter((f) => /wrangler\.(jsonc?|toml)$/.test(f)).some((f) => /ratelimit/i.test(read(f)))
    if (!hasLimit)
      out.push(
        configFinding('no-rate-limit', 'high', routes[0], {
          title: 'Nenhum limite de pedidos (rate limit) nas rotas do servidor',
          detail: `O projeto tem ${routes.length} rota(s) de servidor (ex.: ${routes.slice(0, 4).join(', ')}) e nenhuma delas limita quantos pedidos uma pessoa pode fazer por minuto.`,
          impact: 'Alguém pode chamar as rotas sem parar: tentar senhas e tokens em massa, encher o banco, disparar e-mails ou gastar a sua conta de IA e de servidor até derrubar o app ou gerar uma conta alta.',
          fix: 'Limite por usuário/IP nas rotas sensíveis (login, cadastro, envio de e-mail, IA, escrita no banco). Na Cloudflare: binding de Rate Limiting do Workers; na Vercel/Node: @upstash/ratelimit ou express-rate-limit. Responda 429 quando passar do limite.',
          cwe: ['CWE-770'],
        }),
      )
    // Corpo do pedido lido inteiro sem limite de tamanho.
    const noBodyLimit = routes.filter((f) => /request\.(json|text|formData|arrayBuffer)\(\)|req\.(json|text)\(\)/.test(read(f)) && !/content-length|maxBody|bodyLimit|MAX_BYTES|MAX_BODY/i.test(read(f)))
    if (noBodyLimit.length && !deps.express)
      out.push(
        configFinding('no-body-size-limit', 'medium', noBodyLimit[0], {
          title: `Rotas leem o pedido inteiro sem limite de tamanho (${noBodyLimit.length})`,
          detail: `Estas rotas leem o corpo do pedido sem conferir o tamanho antes: ${noBodyLimit.slice(0, 6).join(', ')}${noBodyLimit.length > 6 ? '…' : ''}.`,
          impact: 'Um pedido gigante pode estourar a memória ou o tempo do servidor e derrubar o app, ou encher o banco.',
          fix: 'Antes de ler o corpo, confira o cabeçalho content-length (ex.: acima de 1 MB responda 413) e limite também o tamanho dos campos que vão para o banco.',
          cwe: ['CWE-400'],
        }),
      )
  }

  // Cabeçalhos de segurança do site.
  const isWeb = ['react', 'next', 'vue', 'svelte', '@sveltejs/kit', 'astro', 'nuxt', 'solid-js', 'vite'].some((d) => deps[d])
  if (isWeb) {
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
        configFinding('missing-security-headers', 'medium', 'package.json', {
          title: 'Cabeçalhos de segurança do site ausentes',
          detail: `Não encontrei estes cabeçalhos de segurança na configuração do site: ${missing.map(([, n]) => n).join(', ')}.`,
          impact: 'Sem eles, fica mais fácil explorar uma falha de XSS, abrir o seu site escondido dentro de outro para enganar cliques (clickjacking) ou forçar conexão sem HTTPS.',
          fix: 'Envie os cabeçalhos em todas as respostas do site (middleware, headers() do next.config, _headers da Cloudflare/Netlify ou vercel.json). Comece pela CSP em modo "Report-Only" para não quebrar nada.',
          cwe: ['CWE-693'],
        }),
      )
  }

  // Segredo em "vars" do wrangler (vai em texto claro para o código e para o git).
  for (const f of files.filter((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x))) {
    const text = read(f)
    const vars = text.match(/"vars"\s*:\s*\{([^}]*)\}|\[vars\]([\s\S]*?)(\n\[|$)/)
    const names = [...(vars?.[1] ?? vars?.[2] ?? '').matchAll(/["']?([A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY)[A-Z0-9_]*)["']?\s*[:=]/g)].map((m) => m[1])
    if (names.length)
      out.push(
        configFinding('wrangler-secret-in-vars', 'high', f, {
          key: f,
          title: `Segredo em "vars" do ${path.posix.basename(f)}`,
          detail: `As variáveis ${names.join(', ')} estão em "vars", que fica em texto claro no arquivo (e no git).`,
          impact: 'Quem tiver acesso ao repositório vê a chave.',
          fix: `Remova do arquivo e cadastre com "wrangler secret put ${names[0]}". Troque a chave no provedor, porque ela já está no histórico do git.`,
          cwe: ['CWE-798'],
        }),
      )
  }

  // Regras do Firebase abertas.
  for (const f of files.filter((x) => /(^|\/)(firestore|storage)\.rules$/.test(x))) {
    const text = read(f)
    for (const m of text.matchAll(/allow\s+([\w, ]+?)\s*(?::\s*if\s+([^;]+))?;/g)) {
      const cond = (m[2] ?? 'true').trim()
      const ops = m[1]
      const open = /^true$/.test(cond)
      const testMode = /request\.time\s*<\s*timestamp\.date/.test(cond)
      const anyUser = /^request\.auth\s*!=\s*null$/.test(cond)
      if (!open && !testMode && !(anyUser && /write|create|update|delete/.test(ops))) continue
      out.push({
        source: 'config',
        rule_id: open ? 'firebase-rules-open' : testMode ? 'firebase-rules-test-mode' : 'firebase-rules-any-user',
        severity: open || testMode ? 'critical' : 'high',
        confidence: 'high',
        title: open ? `Regra do Firebase libera ${ops} para qualquer pessoa` : testMode ? 'Regras do Firebase em modo de teste' : `Regra do Firebase libera ${ops} para qualquer usuário logado`,
        detail: `Em ${f}, a regra "allow ${ops}${m[2] ? `: if ${cond}` : ''}" ${open ? 'não confere nada' : testMode ? 'só confere uma data (modo de teste)' : 'só confere se a pessoa está logada, não se o dado é dela'}.`,
        impact: open || testMode ? 'Qualquer pessoa na internet pode ler e mudar esses dados, sem login.' : 'Qualquer pessoa que criar uma conta pode mudar ou apagar dados de outros usuários.',
        fix: 'Confira o dono do dado na regra, ex.: allow read, write: if request.auth != null && request.auth.uid == resource.data.userId; e restrinja por coleção.',
        file: f,
        line: lineOf(text, m.index),
        snippet: m[0].slice(0, 240),
        cwe: ['CWE-284'],
        fingerprint: `config|firebase-rules|${f}|${hash(m[0])}`,
      })
    }
  }
  for (const f of files.filter((x) => /(^|\/)database\.rules\.json$/.test(x))) {
    const text = read(f)
    for (const m of text.matchAll(/"\.(read|write)"\s*:\s*(true|"true")/g))
      out.push({
        source: 'config',
        rule_id: 'firebase-rtdb-open',
        severity: 'critical',
        confidence: 'high',
        title: `Realtime Database libera ${m[1] === 'read' ? 'leitura' : 'escrita'} para qualquer pessoa`,
        detail: `Em ${f}, ".${m[1]}": true não confere quem está pedindo (e vale para tudo abaixo desse ponto).`,
        impact: `Qualquer pessoa na internet pode ${m[1] === 'read' ? 'ler' : 'alterar e apagar'} esses dados.`,
        fix: 'Troque true por uma condição que confira o dono, ex.: "auth != null && auth.uid === $uid".',
        file: f,
        line: lineOf(text, m.index),
        snippet: m[0],
        cwe: ['CWE-284'],
        fingerprint: `config|firebase-rtdb|${f}|${hash(m[0] + lineOf(text, m.index))}`,
      })
  }
  return out
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
  if (r.status !== 0) throw new Error(`git log falhou: ${(r.stderr || '').trim().slice(0, 200)}`)
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
      title: `Chave ${p.name === 'chave privada' ? 'privada' : `do ${p.name}`} no histórico do git`,
      detail: `O commit ${s.commit.slice(0, 8)} (${s.date}) adicionou em ${s.file} o que parece ser uma chave secreta: ${mask(secret)}. ${stillThere ? 'Ela ainda está no arquivo hoje.' : 'Ela já foi apagada do código, mas continua no histórico.'}`,
      impact: 'Quem tiver ou conseguir uma cópia do repositório (sócio, ex-colaborador, repositório público por engano, vazamento do GitHub) encontra a chave no histórico, mesmo depois de apagada do código.',
      fix:
        `1. Troque a chave no ${p.name}${p.url ? ` (${p.url})` : ''}: é o único passo que resolve de verdade. ` +
        '2. Tire a chave do código (se ainda estiver lá) e use o .env. ' +
        '3. Opcional, e só se o repositório for compartilhado: reescrever o histórico (git filter-repo ou BFG) apaga a chave dos commits, mas muda todos os commits e exige que todo mundo clone de novo. Faça isso só com orientação.',
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
  ['Supabase', (d, f) => d['@supabase/supabase-js'] || d['@supabase/ssr'] || f.some((x) => x.startsWith('supabase/'))],
  ['Firebase', (d, f) => d.firebase || d['firebase-admin'] || f.some((x) => /(^|\/)(firebase\.json|firestore\.rules)$/.test(x))],
  ['Stripe', (d) => d.stripe || d['@stripe/stripe-js']],
  ['Prisma', (d) => d.prisma || d['@prisma/client']],
  ['Drizzle', (d) => d['drizzle-orm']],
  ['Cloudflare Workers', (d, f) => d.wrangler || f.some((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x))],
  ['IA / LLM', (d) => d.openai || d['@anthropic-ai/sdk'] || d.ai || d['@ai-sdk/openai'] || d.langchain || d['@langchain/core'] || d['@google/generative-ai']],
  ['Auth.js / NextAuth', (d) => d['next-auth'] || d['@auth/core']],
  ['Clerk', (d) => d['@clerk/nextjs'] || d['@clerk/clerk-react']],
]

// Temas do catálogo (plugin/skills/security/catalog/<tema>.md) e quando cada um vale.
const TOPICS = [
  ['acesso-e-idor', () => true],
  ['autenticacao', () => true],
  ['entrada-e-injecao', () => true],
  ['api-e-abuso', () => true],
  ['logica-de-negocio', () => true],
  ['dados-e-exposicao', () => true],
  ['supabase', (s) => s.includes('Supabase')],
  ['nextjs', (s) => s.includes('Next.js')],
  ['firebase', (s) => s.includes('Firebase')],
  ['ia-e-llm', (s) => s.includes('IA / LLM')],
]

/** O que a revisão com IA precisa saber para começar: stack, onde estão as portas de entrada e que temas ler. */
export function projectMap(root) {
  const { files } = projectFiles(root)
  const pkg = JSON.parse(readText(root, 'package.json') ?? '{}')
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const stack = STACK_SIGNS.filter(([, test]) => test(deps, files)).map(([name]) => name)
  const code = files.filter((f) => CODE_FILE.test(f) && !TEST_PATH.test(f) && !/\.d\.ts$/.test(f))
  const pick = (re) => code.filter((f) => re.test(f)).slice(0, 60)
  return {
    stack,
    topics: TOPICS.filter(([, when]) => when(stack)).map(([t]) => t),
    entry: {
      'Rotas e funções do servidor': code.filter((f) => SERVER_ROUTE.test(f)).slice(0, 80),
      'Server actions / funções de servidor': code.filter((f) => /^\s*['"]use server['"]|createServerFn\(/m.test(readText(root, f) ?? '')).slice(0, 40),
      'Middleware e proteção de rotas': pick(/(^|\/)(middleware|proxy)\.[mc]?[jt]s$|auth[^/]*\.(t|j)sx?$|guard/i),
      'Migrations e regras do banco': files.filter((f) => /(^|\/)supabase\/.*\.sql$|\.rules$|database\.rules\.json$|prisma\/schema\.prisma$|drizzle\/.*\.(sql|ts)$/i.test(f)).slice(0, 60),
      'Configuração': files.filter((f) => HEADER_FILES.test(f) || /(^|\/)(\.env\.example|firebase\.json)$/.test(f)).slice(0, 30),
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
  if (f.source === 'history' && f.severity === 'low') return { ...f, severity_original: 'high', adjust_reason: 'arquivo de teste ou exemplo', suppressed: true }
  if (f.source === 'secret' && f.file) {
    if (EXAMPLE_PATH.test(f.file)) return adjust('low', 'arquivo de exemplo', true)
    if (TEST_PATH.test(f.file)) return adjust('low', 'arquivo de teste', true)
    if (DOC_PATH.test(f.file)) return adjust('low', 'documentação: pode ser só um exemplo; se for chave de verdade, troque-a')
  }
  if (f.source === 'dependency' && !f.rule_id.startsWith('MAL-')) {
    if (f.dev) return adjust(lower(f.severity), 'só usado no desenvolvimento: não vai para o site publicado', true)
    if (!f.fixed_in) return adjust(f.severity, 'ainda não existe versão corrigida', true)
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
    scopes.push({ source: 'config', files: null })
  }

  if (!only || files.some((f) => /(^|\/)supabase\/.*\.sql$/i.test(f))) {
    const db = scanDatabase(root, all)
    findings.push(...db.findings)
    scopes.push({ source: 'database', files: null })
    stats.tables = db.tables
  }
  if (deps && (!only || files.some((f) => LOCKFILE.test(f) || /(^|\/)package\.json$/.test(f)))) {
    try {
      const d = await scanDependencies(root, all)
      findings.push(...d.findings)
      scopes.push({ source: 'dependency', files: null })
      stats.packages = d.packages
      stats.lockfiles = d.lockfiles.length
      snapshot = d.snapshot
    } catch (err) {
      // Sem internet: os achados de pacotes da checagem anterior continuam valendo.
      errors.push(`pacotes: ${err.message}`)
    }
  }
  if (history && !only) {
    try {
      const h = scanHistory(root)
      findings.push(...h.findings)
      scopes.push({ source: 'history', files: null })
      stats.commits = h.commits
    } catch (err) {
      errors.push(`histórico do git: ${err.message}`)
    }
  }
  const unique = [...new Map(findings.map((f) => [f.fingerprint, f])).values()].map(applyNoiseRules)
  return { findings: unique, scopes, stats: { ...stats, ms: Date.now() - started }, errors, snapshot }
}
