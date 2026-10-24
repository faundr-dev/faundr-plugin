// "Pronto para lançar?": o que só dá para conferir no computador ou no site no ar. O resto do checklist
// (segurança, erros, testes, Stack, backup marcado à mão) o painel monta com o que já tem.
//
// Cada item: { key, status: 'ok' | 'falta' | 'aviso' | 'na' | 'nao-verificado', detail, evidence }.

import fs from 'node:fs'
import path from 'node:path'
import { t } from './i18n.mjs'
import { faundrPath } from './paths.mjs'

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

// Nome do cabeçalho e o que ele faz (texto que a pessoa lê: função, para sair na língua dela).
const HEADERS = [
  ['strict-transport-security', () => t('HSTS (forces the browser to always use https)', 'HSTS (obriga o navegador a usar sempre https)')],
  ['content-security-policy', () => t('CSP (limits where the site loads scripts from; stops injection attacks)', 'CSP (limita de onde o site carrega scripts; segura ataques de injeção)')],
  ['x-content-type-options', () => 'X-Content-Type-Options: nosniff'],
  ['referrer-policy', () => t('Referrer-Policy (does not leak the full address to other sites)', 'Referrer-Policy (não vaza o endereço completo para outros sites)')],
]

/** Confere os cabeçalhos de segurança da URL de produção. */
export async function checkHeaders(url, { fetchImpl = fetch } = {}) {
  const key = 'cabecalhos'
  if (!url)
    return {
      key,
      status: 'nao-verificado',
      detail: t(
        'I do not know the URL of the live site. Run the Project stack (/faundr:stack) or pass --url https://your-site.',
        'Não sei a URL do site no ar. Rode a Stack (/faundr:stack) ou passe --url https://seu-site.',
      ),
      evidence: [],
    }
  if (!/^https:\/\//.test(url))
    return {
      key,
      status: 'falta',
      detail: t(`The live site (${url}) does not use https: passwords and data travel the network in the open.`, `O site no ar (${url}) não usa https: senhas e dados passam abertos pela rede.`),
      evidence: [url],
    }
  let res
  try {
    res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    return { key, status: 'nao-verificado', detail: t(`Could not open ${url} (${e.message}).`, `Não consegui abrir ${url} (${e.message}).`), evidence: [url] }
  }
  const h = (n) => res.headers.get(n)
  const missing = HEADERS.filter(([n]) => !h(n)).map(([, label]) => label())
  const frame = !!h('x-frame-options') || /frame-ancestors/i.test(h('content-security-policy') ?? '')
  if (!frame)
    missing.push(
      t('protection against the site being opened inside another one (X-Frame-Options or frame-ancestors)', 'proteção contra o site ser aberto dentro de outro (X-Frame-Options ou frame-ancestors)'),
    )
  if (h('x-content-type-options') && !/nosniff/i.test(h('x-content-type-options'))) missing.push(t('X-Content-Type-Options with the value nosniff', 'X-Content-Type-Options com valor nosniff'))
  if (!missing.length) return { key, status: 'ok', detail: t(`${url} sends the main security headers.`, `${url} manda os cabeçalhos de segurança principais.`), evidence: [url] }
  return {
    key,
    status: missing.length >= 4 ? 'falta' : 'aviso',
    detail: t(`${url} does not send: ${missing.join('; ')}.`, `${url} não manda: ${missing.join('; ')}.`),
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
  if ([...deps].some((d) => RATE_LIB.test(d))) hits.push(t('dependencies', 'dependências'))
  for (const f of [...files.filter((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x)), ...server]) {
    if (RATE_LIB.test(read(root, f))) hits.push(f)
    if (hits.length >= 5) break
  }
  if (hits.length) return { key, status: 'ok', detail: t(`There is a request limit in the code (${hits.slice(0, 3).join(', ')}).`, `Há limite de pedidos no código (${hits.slice(0, 3).join(', ')}).`), evidence: hits }
  if (!server.length)
    return {
      key,
      status: 'na',
      detail: t(
        "The project has no server routes of its own; Supabase's login and API (if used) already have the service's own limits.",
        'O projeto não tem rotas de servidor próprias; o login e a API do Supabase (se usar) já têm limites do próprio serviço.',
      ),
      evidence: [],
    }
  return {
    key,
    status: 'falta',
    detail: t(
      `No request limit on the server routes (${server.length} file(s), e.g. ${server.slice(0, 2).join(', ')}). Without it, a bot can call the API nonstop: a high bill, a slow database, passwords brute-forced.`,
      `Nenhum limite de pedidos nas rotas do servidor (${server.length} arquivo(s), ex.: ${server.slice(0, 2).join(', ')}). Sem isso, um robô pode chamar a API sem parar: conta alta, banco lento, senha testada à força.`,
    ),
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
    } catch {
      // package.json com JSON quebrado: fica de fora da lista de pacotes.
    }
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
  if (!providers.length) return { key, status: 'na', detail: t('The project does not use a known payment service.', 'O projeto não usa um serviço de pagamento conhecido.'), evidence: [] }
  const hooks = codeFiles(files).filter((f) => /\.(m?[jt]sx?|py|rb|go|php)$/.test(f) && (/webhook/i.test(f) || /webhook/i.test(read(root, f))))
  const name = providers.join(', ')
  if (!hooks.length)
    return {
      key,
      status: 'aviso',
      detail: t(
        `Uses ${name}, but I did not find the route that receives the payment notice (webhook). Without it, granting the product depends on the "thank you" screen, which anyone can open without paying.`,
        `Usa ${name}, mas não achei a rota que recebe o aviso de pagamento (webhook). Sem ela, liberar o produto depende da tela de "obrigado", que qualquer um abre sem pagar.`,
      ),
      evidence: [],
    }
  const unverified = hooks.filter((f) => !VERIFY.test(read(root, f)))
  if (unverified.length === hooks.length)
    return {
      key,
      status: 'falta',
      detail: t(
        `The ${name} webhook route does not check the notice's signature (${hooks.slice(0, 2).join(', ')}). Anyone can send a fake "payment approved".`,
        `A rota do webhook de ${name} não confere a assinatura do aviso (${hooks.slice(0, 2).join(', ')}). Qualquer pessoa pode mandar um "pagamento aprovado" falso.`,
      ),
      evidence: hooks.slice(0, 5),
    }
  const verified = hooks.filter((f) => !unverified.includes(f)).slice(0, 2).join(', ')
  return { key, status: 'ok', detail: t(`The ${name} webhook checks the signature (${verified}).`, `O webhook de ${name} confere a assinatura (${verified}).`), evidence: hooks.slice(0, 5) }
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
  if (byPath.length) return { key, status: 'ok', detail: t(`There is a privacy page (${byPath[0]}).`, `Há uma página de privacidade (${byPath[0]}).`), evidence: byPath.slice(0, 3) }
  const ui = code.filter((f) => /\.(m?[jt]sx|vue|svelte|astro|html)$/.test(f))
  const link = ui.find((f) => PRIVACY_LINK.test(read(root, f)))
  if (link)
    return {
      key,
      status: 'aviso',
      detail: t(
        `The site mentions the privacy policy (${link}), but I did not find its page in the project. Check that the link opens a real text.`,
        `O site cita a política de privacidade (${link}), mas não achei a página dela no projeto. Confira se o link abre um texto de verdade.`,
      ),
      evidence: [link],
    }
  return {
    key,
    status: 'falta',
    detail: t(
      'There is no privacy policy. Privacy laws require telling people what data the app collects, what for, and how to ask for it to be deleted.',
      'Não há política de privacidade. A LGPD exige dizer que dados o app coleta, para quê e como a pessoa pede para apagar.',
    ),
    evidence: [],
  }
}

// ---- Plano de recuperação e backup automático ---------------------------------------------------------------------

const RECOVERY_FILE = /(^|\/)(plano-de-recuperacao|plano-de-incidentes?|recuperacao|recovery-plan|disaster-recovery|incident-response|runbook)[\w-]*\.md$/i
// O que um plano precisa responder (título de seção ou menção): chave vazada, banco, conta invadida, site fora do ar,
// aviso de vazamento pela lei de privacidade (LGPD, GDPR, CCPA). O plano pode estar em português ou inglês.
const RECOVERY_TOPICS = [
  [() => t('leaked key', 'chave vazada'), /chave|segredo|secret|token/i],
  [() => t('lost database', 'banco perdido'), /backup|restaur|banco|database/i],
  [() => t('hacked account', 'conta invadida'), /invad|conta|acesso|account|hacked|compromis/i],
  [() => t('site down', 'site fora do ar'), /fora do ar|deploy|rollback|voltar|outage|downtime/i],
  [() => t('breach notice under privacy law', 'aviso pela LGPD'), /lgpd|anpd|titular|gdpr|ccpa|breach|data protection authority/i],
]

export function checkRecoveryPlan(root, files) {
  const key = 'plano-recuperacao'
  const plan = files.find((f) => RECOVERY_FILE.test(f) && !/(^|\/)(node_modules|plugin)\//.test(f))
  if (!plan)
    return {
      key,
      status: 'falta',
      detail: t(
        'There is no recovery plan: what to do if a key leaks, the database is lost, an account is hacked or the site goes down. Ask Claude for a draft with /faundr:launch.',
        'Não há plano de recuperação: o que fazer se vazar uma chave, se o banco for perdido, se uma conta for invadida ou se o site cair. Peça ao Claude um rascunho com /faundr:launch.',
      ),
      evidence: [],
    }
  const text = read(root, plan)
  const missing = RECOVERY_TOPICS.filter(([, re]) => !re.test(text)).map(([name]) => name())
  if (missing.length) return { key, status: 'aviso', detail: t(`The plan (${plan}) does not cover: ${missing.join(', ')}.`, `O plano (${plan}) não fala de: ${missing.join(', ')}.`), evidence: [plan] }
  return {
    key,
    status: 'ok',
    detail: t(
      `There is a recovery plan (${plan}) covering leaked keys, the database, hacked accounts, the site going down and breach notices.`,
      `Há um plano de recuperação (${plan}) cobrindo chave vazada, banco, conta invadida, site fora do ar e LGPD.`,
    ),
    evidence: [plan],
  }
}

/** Backups do banco pela API de gestão do Supabase (token pessoal, que nunca sai do computador). */
export async function checkBackups(ref, token, { fetchImpl = fetch, now = Date.now() } = {}) {
  const key = 'backup-automatico'
  if (!ref) return { key, status: 'na', detail: t('The project does not use Supabase (or I did not find its URL in the .env files).', 'O projeto não usa Supabase (ou não achei a URL dele nos .env).'), evidence: [] }
  if (!token)
    return {
      key,
      status: 'nao-verificado',
      detail: t(
        'To check the backups, set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens) and run again. Or look under Database → Backups in the Supabase dashboard.',
        'Para conferir os backups, defina SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens) e rode de novo. Ou veja em Database → Backups no painel do Supabase.',
      ),
      evidence: [],
    }
  let body
  try {
    const res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/database/backups`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return { key, status: 'nao-verificado', detail: t(`Supabase answered ${res.status} when asked for the list of backups.`, `O Supabase respondeu ${res.status} ao pedir a lista de backups.`), evidence: [] }
    body = await res.json()
  } catch (err) {
    return { key, status: 'nao-verificado', detail: t(`Could not reach Supabase (${err?.message ?? err}).`, `Não consegui falar com o Supabase (${err?.message ?? err}).`), evidence: [] }
  }
  const done = (body.backups ?? []).filter((b) => !b.status || b.status === 'COMPLETED').map((b) => new Date(b.inserted_at).getTime()).filter(Number.isFinite)
  const last = done.length ? Math.max(...done) : null
  if (body.pitr_enabled)
    return { key, status: 'ok', detail: t('Continuous backup is on (the database can go back to any recent minute).', 'Backup contínuo ligado (dá para voltar o banco para qualquer minuto recente).'), evidence: [] }
  if (!last)
    return {
      key,
      status: 'falta',
      detail: t(
        "The database has no automatic backup (Supabase's free plan does not keep one). Make copies with supabase db dump in a safe place, or move to a paid plan.",
        'O banco não tem backup automático (o plano grátis do Supabase não guarda). Faça cópias com supabase db dump num lugar seguro, ou passe para um plano pago.',
      ),
      evidence: [],
    }
  const days = Math.floor((now - last) / 86_400_000)
  if (days > 2) return { key, status: 'aviso', detail: t(`The last automatic backup is from ${daysAgo(days)}. Check under Database → Backups.`, `O último backup automático é de ${daysAgo(days)}. Confira em Database → Backups.`), evidence: [] }
  return { key, status: 'ok', detail: t(`${done.length} automatic backup(s); the last one from ${daysAgo(days)}.`, `${done.length} backup(s) automático(s); o último de ${daysAgo(days)}.`), evidence: [] }
}

// ---- Teste do banco como visitante (resultado guardado pelo faundr db-test) ------------------------------------

// "hoje", "ontem" ou "há N dias" ("today", "yesterday", "N days ago").
function daysAgo(days) {
  if (days <= 0) return t('today', 'hoje')
  return days === 1 ? t('yesterday', 'ontem') : t(`${days} days ago`, `há ${days} dias`)
}

export function checkDbTest(root, now = Date.now()) {
  const key = 'banco-testado'
  let r
  try {
    r = JSON.parse(fs.readFileSync(faundrPath(root, 'dbTest'), 'utf8'))
  } catch {
    return {
      key,
      status: 'nao-verificado',
      detail: t('The database has not been tested as a visitor yet. Run faundr db-test (or /faundr:launch).', 'O banco ainda não foi testado como visitante. Rode faundr db-test (ou /faundr:launch).'),
      evidence: [],
    }
  }
  const days = Math.floor((now - Date.parse(r.at)) / 86_400_000)
  const when = daysAgo(days)
  if (r.open > 0)
    return {
      key,
      status: 'falta',
      detail: t(`The test from ${when} found ${r.open} open door(s) in the database (list under Security).`, `O teste de ${when} achou ${r.open} porta(s) aberta(s) no banco (lista em Segurança).`),
      evidence: [],
    }
  if (!r.full)
    return {
      key,
      status: 'aviso',
      detail: t(
        `Tested ${when}, reading with the public key only; writing, changing and deleting have not been tested yet.`,
        `Testado ${when} só na leitura com a chave pública; gravar, alterar e apagar ainda não foram testados.`,
      ),
      evidence: [],
    }
  if (days > 30)
    return {
      key,
      status: 'aviso',
      detail: t(`Last full test ${when}: run it again (the database rules change with the migrations).`, `Último teste completo ${when}: rode de novo (as regras do banco mudam com as migrações).`),
      evidence: [],
    }
  return {
    key,
    status: 'ok',
    detail: t(
      `Tested ${when}: ${r.tables} table(s); a visitor and another logged-in person cannot read, write or delete what they should not.`,
      `Testado ${when}: ${r.tables} tabela(s), visitante e outra pessoa logada não leem, gravam nem apagam o que não devem.`,
    ),
    evidence: [],
  }
}

/** URL de produção pela Stack salva (.faundr/painel/stack.json). */
export function productionUrl(root) {
  try {
    const s = JSON.parse(fs.readFileSync(faundrPath(root, 'stack'), 'utf8'))
    const env = (s.environments ?? []).find((e) => /produ|prod|live/i.test(e.name ?? '') && /^https?:\/\//.test(e.url ?? ''))
    if (env) return env.url
    return (s.hosting ?? []).find((h) => h.layer === 'front' && /^https?:\/\//.test(h.url ?? ''))?.url ?? null
  } catch {
    // Sem Stack salva (ou ilegível): sem URL de produção.
    return null
  }
}

export async function launchChecks(root, files, { url = productionUrl(root), fetchImpl = fetch, supabase = null } = {}) {
  return [
    checkDbTest(root),
    checkPaymentWebhook(root, files),
    await checkHeaders(url, { fetchImpl }),
    checkRateLimit(root, files),
    checkPrivacy(root, files),
    checkRecoveryPlan(root, files),
    await checkBackups(supabase?.ref ?? null, supabase?.token ?? null, { fetchImpl }),
  ]
}
