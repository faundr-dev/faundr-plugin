// "Pronto para lançar?": o que só dá para conferir no computador ou no site no ar. O resto do checklist
// (segurança, erros, testes, Stack, backup marcado à mão) o painel monta com o que já tem.
//
// Cada item: { key, status: 'ok' | 'falta' | 'aviso' | 'na' | 'nao-verificado', detail, evidence }.

import fs from 'node:fs'
import path from 'node:path'

const MAX_FILE = 400_000
const CODE = /\.(m?[jt]sx?|cjs|py|rb|go|php|rs|java|kt|cs|vue|svelte|astro|html|md|mdx|json|jsonc|toml|ya?ml)$/i
const SKIP = /(^|\/)(node_modules|dist|build|\.next|\.output|\.svelte-kit|\.git|\.faundr|vendor|coverage|__pycache__|\.venv|venv)\//
const TEST = /(^|\/)(tests?|__tests__|e2e|spec|fixtures?|bench)\/|\.(test|spec)\.[a-z]+$/i

function read(root, rel) {
  try {
    const abs = path.join(root, rel)
    if (fs.statSync(abs).size > MAX_FILE) return ''
    return fs.readFileSync(abs, 'utf8')
  } catch {
    return ''
  }
}

const codeFiles = (files) => files.filter((f) => CODE.test(f) && !SKIP.test(f) && !TEST.test(f))

// ---- Cabeçalhos de segurança do site no ar -----------------------------------------------------------------

const HEADERS = [
  ['strict-transport-security', 'HSTS (obriga o navegador a usar sempre https)'],
  ['content-security-policy', 'CSP (limita de onde o site carrega scripts; segura ataques de injeção)'],
  ['x-content-type-options', 'X-Content-Type-Options: nosniff'],
  ['referrer-policy', 'Referrer-Policy (não vaza o endereço completo para outros sites)'],
]

/** Confere os cabeçalhos de segurança da URL de produção. */
export async function checkHeaders(url, { fetchImpl = fetch } = {}) {
  const key = 'cabecalhos'
  if (!url) return { key, status: 'nao-verificado', detail: 'Não sei a URL do site no ar. Rode a Stack (/faundr:stack) ou passe --url https://seu-site.', evidence: [] }
  if (!/^https:\/\//.test(url)) return { key, status: 'falta', detail: `O site no ar (${url}) não usa https: senhas e dados passam abertos pela rede.`, evidence: [url] }
  let res
  try {
    res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    return { key, status: 'nao-verificado', detail: `Não consegui abrir ${url} (${e.message}).`, evidence: [url] }
  }
  const h = (n) => res.headers.get(n)
  const missing = HEADERS.filter(([n]) => !h(n)).map(([, label]) => label)
  const frame = !!h('x-frame-options') || /frame-ancestors/i.test(h('content-security-policy') ?? '')
  if (!frame) missing.push('proteção contra o site ser aberto dentro de outro (X-Frame-Options ou frame-ancestors)')
  if (h('x-content-type-options') && !/nosniff/i.test(h('x-content-type-options'))) missing.push('X-Content-Type-Options com valor nosniff')
  if (!missing.length) return { key, status: 'ok', detail: `${url} manda os cabeçalhos de segurança principais.`, evidence: [url] }
  return {
    key,
    status: missing.length >= 4 ? 'falta' : 'aviso',
    detail: `${url} não manda: ${missing.join('; ')}.`,
    evidence: [url],
  }
}

// ---- Limite de pedidos (rate limit) ---------------------------------------------------------------------------

const RATE_LIB =
  /(express-rate-limit|@upstash\/ratelimit|rate-limiter-flexible|@nestjs\/throttler|hono-rate-limiter|@fastify\/rate-limit|koa-ratelimit|slowapi|flask[-_]limiter|django[-_]ratelimit|django_ratelimit|rack-attack|rack::attack|"ratelimits"\s*:|\[\[\s*(unsafe\.bindings|ratelimits)|\bnew\s+Ratelimit\b|\brateLimit(er)?\s*\(|\bRateLimiter\b|\brate_limit\s*\()/i
const SERVER_PATH = /(^|\/)(api|server|routes\/api|pages\/api|app\/api|functions|supabase\/functions|backend|handlers|controllers|workers?)\//i

export function checkRateLimit(root, files) {
  const key = 'limite-pedidos'
  const code = codeFiles(files)
  const server = code.filter((f) => SERVER_PATH.test(f) && /\.(m?[jt]sx?|py|rb|go|php)$/.test(f))
  // Só onde o limite de verdade mora: dependências, configuração do deploy e o código das rotas.
  const hits = []
  const deps = dependencies(root, files)
  if ([...deps].some((d) => RATE_LIB.test(d))) hits.push('dependências')
  for (const f of [...files.filter((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x)), ...server]) {
    if (RATE_LIB.test(read(root, f))) hits.push(f)
    if (hits.length >= 5) break
  }
  if (hits.length) return { key, status: 'ok', detail: `Há limite de pedidos no código (${hits.slice(0, 3).join(', ')}).`, evidence: hits }
  if (!server.length)
    return { key, status: 'na', detail: 'O projeto não tem rotas de servidor próprias; o login e a API do Supabase (se usar) já têm limites do próprio serviço.', evidence: [] }
  return {
    key,
    status: 'falta',
    detail: `Nenhum limite de pedidos nas rotas do servidor (${server.length} arquivo(s), ex.: ${server.slice(0, 2).join(', ')}). Sem isso, um robô pode chamar a API sem parar: conta alta, banco lento, senha testada à força.`,
    evidence: server.slice(0, 5),
  }
}

// ---- Webhook de pagamento --------------------------------------------------------------------------------------

const PAYMENT = [
  ['Stripe', /^(stripe|@stripe\/stripe-js|@stripe\/react-stripe-js)$/],
  ['Mercado Pago', /^(mercadopago|@mercadopago\/sdk-react|@mercadopago\/sdk-js)$/],
  ['Pagar.me', /^(pagarme|@pagarme\/.+)$/],
  ['Asaas', /^asaas/],
  ['Lemon Squeezy', /^@lemonsqueezy\//],
  ['Paddle', /^@paddle\//],
  ['AbacatePay', /^abacatepay/],
  ['PayPal', /^(@paypal\/.+|paypal-rest-sdk)$/],
  ['Polar', /^@polar-sh\//],
]
const VERIFY = /(constructEvent(Async)?|webhooks\.unwrap|validateEvent|verifyWebhook|verify_?signature|verifySignature|x-signature|createHmac|hmac\.new|timingSafeEqual|compare_digest|svix|Webhook\.verify|webhooks\.verify)/i

function dependencies(root, files) {
  const deps = new Set()
  for (const f of files.filter((x) => /(^|\/)package\.json$/.test(x) && !SKIP.test(x))) {
    try {
      const pkg = JSON.parse(read(root, f))
      for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) deps.add(d)
    } catch {}
  }
  for (const f of files.filter((x) => /(^|\/)(requirements[^/]*\.txt|pyproject\.toml)$/.test(x))) {
    for (const m of read(root, f).matchAll(/^\s*"?([A-Za-z0-9_.-]+)/gm)) deps.add(m[1].toLowerCase())
  }
  return deps
}

export function checkPaymentWebhook(root, files) {
  const key = 'webhook-pagamento'
  const deps = dependencies(root, files)
  const providers = PAYMENT.filter(([, re]) => [...deps].some((d) => re.test(d))).map(([name]) => name)
  if (!providers.length) return { key, status: 'na', detail: 'O projeto não usa um serviço de pagamento conhecido.', evidence: [] }
  const hooks = codeFiles(files).filter((f) => /\.(m?[jt]sx?|py|rb|go|php)$/.test(f) && (/webhook/i.test(f) || /webhook/i.test(read(root, f))))
  const name = providers.join(', ')
  if (!hooks.length)
    return {
      key,
      status: 'aviso',
      detail: `Usa ${name}, mas não achei a rota que recebe o aviso de pagamento (webhook). Sem ela, liberar o produto depende da tela de "obrigado", que qualquer um abre sem pagar.`,
      evidence: [],
    }
  const unverified = hooks.filter((f) => !VERIFY.test(read(root, f)))
  if (unverified.length === hooks.length)
    return {
      key,
      status: 'falta',
      detail: `A rota do webhook de ${name} não confere a assinatura do aviso (${hooks.slice(0, 2).join(', ')}). Qualquer pessoa pode mandar um "pagamento aprovado" falso.`,
      evidence: hooks.slice(0, 5),
    }
  return { key, status: 'ok', detail: `O webhook de ${name} confere a assinatura (${hooks.filter((f) => !unverified.includes(f)).slice(0, 2).join(', ')}).`, evidence: hooks.slice(0, 5) }
}

// ---- Política de privacidade -----------------------------------------------------------------------------------

// O nome do arquivo da página (privacidade.tsx, privacy/page.tsx, politica-de-privacidade.html), numa pasta de páginas.
const PRIVACY_PATH = /(^|\/)[^/]*(privac|privacy|politica-de-privacidade)[^/]*(\/(page|index|route)\.[a-z]+)?$/i
export const PAGE_DIR = /(^|\/)(routes|pages|app|public|static|views|site|content)\//i
// Link para a página (href ou to apontando para privacidade), não só o texto citado numa explicação.
const PRIVACY_LINK = /\b(href|to)=\{?["'`][^"'`]*(privac|privacy|politica|lgpd)[^"'`]*["'`]/i

export function checkPrivacy(root, files) {
  const key = 'privacidade'
  const code = codeFiles(files)
  // Só páginas (telas, HTML ou Markdown publicado), não código que só tem "privacy" no nome.
  const byPath = code.filter((f) => PRIVACY_PATH.test(f) && PAGE_DIR.test(f) && /\.(m?[jt]sx|vue|svelte|astro|html|mdx?)$/.test(f) && !/(^|\/)(docs?|\.github|plugin|bin|scripts?)\//i.test(f))
  if (byPath.length) return { key, status: 'ok', detail: `Há uma página de privacidade (${byPath[0]}).`, evidence: byPath.slice(0, 3) }
  const ui = code.filter((f) => /\.(m?[jt]sx|vue|svelte|astro|html)$/.test(f))
  const link = ui.find((f) => PRIVACY_LINK.test(read(root, f)))
  if (link) return { key, status: 'aviso', detail: `O site cita a política de privacidade (${link}), mas não achei a página dela no projeto. Confira se o link abre um texto de verdade.`, evidence: [link] }
  return {
    key,
    status: 'falta',
    detail: 'Não há política de privacidade. A LGPD exige dizer que dados o app coleta, para quê e como a pessoa pede para apagar.',
    evidence: [],
  }
}

// ---- Teste do banco como visitante (resultado guardado pelo faundr db-test) ------------------------------------

export function checkDbTest(root, now = Date.now()) {
  const key = 'banco-testado'
  let r
  try {
    r = JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'db-test.json'), 'utf8'))
  } catch {
    return { key, status: 'nao-verificado', detail: 'O banco ainda não foi testado como visitante. Rode faundr db-test (ou /faundr:launch).', evidence: [] }
  }
  const days = Math.floor((now - Date.parse(r.at)) / 86_400_000)
  const when = days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`
  if (r.open > 0) return { key, status: 'falta', detail: `O teste de ${when} achou ${r.open} porta(s) aberta(s) no banco (lista em Segurança).`, evidence: [] }
  if (!r.full) return { key, status: 'aviso', detail: `Testado ${when} só na leitura com a chave pública; gravar, alterar e apagar ainda não foram testados.`, evidence: [] }
  if (days > 30) return { key, status: 'aviso', detail: `Último teste completo ${when}: rode de novo (as regras do banco mudam com as migrações).`, evidence: [] }
  return { key, status: 'ok', detail: `Testado ${when}: ${r.tables} tabela(s), visitante e outra pessoa logada não leem, gravam nem apagam o que não devem.`, evidence: [] }
}

/** URL de produção pela Stack salva (.faundr/stack.json). */
export function productionUrl(root) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'stack.json'), 'utf8'))
    const env = (s.environments ?? []).find((e) => /produ|prod|live/i.test(e.name ?? '') && /^https?:\/\//.test(e.url ?? ''))
    if (env) return env.url
    return (s.hosting ?? []).find((h) => h.layer === 'front' && /^https?:\/\//.test(h.url ?? ''))?.url ?? null
  } catch {
    return null
  }
}

export async function launchChecks(root, files, { url = productionUrl(root), fetchImpl = fetch } = {}) {
  return [
    checkDbTest(root),
    checkPaymentWebhook(root, files),
    await checkHeaders(url, { fetchImpl }),
    checkRateLimit(root, files),
    checkPrivacy(root, files),
  ]
}
