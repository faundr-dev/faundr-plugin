// SDK de erros do Faundr para o servidor (Node, Cloudflare Workers, Bun): arquivo único, sem dependência, copiado para
// o projeto com `faundr errors-sdk`. Não edite: o Faundr reescreve este arquivo para atualizar.
//
//   Node:     import { init, errorHandler } from './faundr-errors.mjs'
//             init({ dsn: '<DSN>', release: process.env.COMMIT_SHA })   // no começo do servidor
//             app.use(errorHandler())                                    // Express: depois das rotas
//   Workers:  import { withFaundr } from './faundr-errors.mjs'
//             export default withFaundr((env) => ({ dsn: env.FAUNDR_DSN, release: env.COMMIT_SHA }), { fetch, scheduled })
//   Qualquer: await capture(erro, { request })
//
// Manda ao Faundr, no formato de envelope do SDK do Sentry, erro sem tratamento (o processo do Node termina como
// terminaria sem o SDK) e erro que escapa do fetch/scheduled do Worker (sem atrasar a resposta). Limpa senhas,
// tokens, cartões, e-mails e IPs antes de enviar; do pedido vão só o método e o caminho, sem cabeçalhos nem corpo.
// No Node, liga só com NODE_ENV=production (ou enabled: true).

const VERSION = '1.0.0'
const PER_MINUTE = 30
const REPEAT_MS = 30_000
const sentAt = []
const lastSeen = new Map()
let options = null
let pausedUntil = 0

const isWorker = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
const proc = typeof process !== 'undefined' && process.versions ? process : null
const RELEASE_VARS = ['COMMIT_SHA', 'VERCEL_GIT_COMMIT_SHA', 'RENDER_GIT_COMMIT', 'RAILWAY_GIT_COMMIT_SHA', 'SOURCE_VERSION', 'WORKERS_CI_COMMIT_SHA']

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function luhn(digits) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = +digits[digits.length - 1 - i]
    if (i % 2 && (d *= 2) > 9) d -= 9
    sum += d
  }
  return sum % 10 === 0
}

// As mesmas regras do SDK do navegador e do recebimento: o servidor do Faundr limpa de novo ao receber.
const scrub = (input) =>
  clip(
    String(input)
      .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, '[token]')
      .replace(/\b(sk|rk|pk)_(live|test)_\w{10,}|\bsb_secret_[\w-]{10,}|\bgh[pousr]_\w{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[\w-]{10,}/g, '[chave]')
      .replace(/\bbearer\s+[\w.~+/=-]{12,}/gi, 'Bearer [token]')
      .replace(/\b(pass(?:word|wd)?|senha|secret|token|api[_-]?key|authorization|cookie)(["']?\s*[:=]\s*["']?)([^\s"',;&]{4,})/gi, '$1$2[filtrado]')
      .replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => (luhn(m.replace(/\D/g, '')) ? '[cartão]' : m))
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]'),
    2000,
  )

// Caminho a partir da pasta do projeto: a pasta do servidor (com o nome do usuário, às vezes) não sai daqui.
const cwd = (() => {
  try {
    return proc?.cwd?.().replace(/\\/g, '/').replace(/\/?$/, '/')
  } catch {
    return null
  }
})()
const relative = (file) => {
  const f = file.replace(/\\/g, '/')
  return cwd && f.toLowerCase().startsWith(cwd.toLowerCase()) ? f.slice(cwd.length) : f
}

// Pilha do V8 (Node, Workers, Bun): "at fn (arquivo:10:5)" → frames do Sentry, do mais antigo para o mais novo.
function frames(stack) {
  const out = []
  for (const line of String(stack).split('\n').slice(0, 50)) {
    const m = line.match(/^\s*at (?:(?:async )?(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/)
    if (!m) continue
    const file = relative(m[2].replace(/^file:\/\/(\/(?=[A-Za-z]:))?/, ''))
    out.push({ function: m[1] || '?', filename: file, abs_path: file, lineno: +m[3], colno: +m[4], in_app: !/node_modules|^node:|^internal\//.test(file) })
  }
  return out.reverse()
}

/** Liga o SDK. No Node, também passa a mandar os erros sem tratamento (e as promessas rejeitadas sem catch). */
export function init(opts = {}) {
  let dsn = null
  try {
    dsn = new URL(opts.dsn)
  } catch {}
  const env = proc?.env ?? {}
  options = {
    dsnText: opts.dsn,
    ingest: dsn && `${dsn.origin}/api/${dsn.pathname.replace(/\//g, '')}/envelope/`,
    release: opts.release || RELEASE_VARS.map((k) => env[k]).find(Boolean) || undefined,
    environment: opts.environment || (isWorker ? 'production' : env.NODE_ENV || 'production'),
    enabled: !!dsn && (opts.enabled ?? (isWorker || env.NODE_ENV === 'production')),
  }
  if (options.enabled && proc?.on && !isWorker && !init.listening) {
    init.listening = true
    // Promessa rejeitada sem catch também chega aqui (o padrão do Node desde a versão 15).
    proc.on('uncaughtException', async (error, origin) => {
      await capture(error, { mechanism: origin === 'unhandledRejection' ? 'onunhandledrejection' : 'onuncaughtexception', handled: false })
      // Outro ouvinte do app decide o que fazer; sozinho, o SDK termina como o Node terminaria.
      if (proc.listenerCount('uncaughtException') > 1) return
      console.error(error)
      proc.exit(1)
    })
  }
}

function request(req) {
  if (!req) return {}
  const raw = String(req.originalUrl ?? req.url ?? '')
  const path = raw.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '') || '/'
  const method = String(req.method || 'GET').toUpperCase()
  return { transaction: `${method} ${path}`, request: { method, url: path } }
}

/** Manda um erro ao Faundr. A promessa nunca falha (serve para ctx.waitUntil). */
export async function capture(error, extra = {}) {
  if (!options?.enabled) return
  const now = Date.now()
  if (now < pausedUntil) return
  const err = error instanceof Error ? error : null
  let value = err ? err.message : error
  if (typeof value !== 'string')
    try {
      value = JSON.stringify(value)
    } catch {
      value = String(value)
    }
  const stack = err?.stack ? frames(err.stack) : undefined
  const type = err?.name || 'Error'
  const key = `${type}|${value}|${stack?.at(-1)?.filename}`
  if (now - (lastSeen.get(key) ?? 0) < REPEAT_MS) return
  while (sentAt.length && now - sentAt[0] > 60_000) sentAt.shift()
  if (sentAt.length >= PER_MINUTE) return
  sentAt.push(now)
  lastSeen.set(key, now)

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: now / 1000,
    platform: 'node',
    level: 'error',
    environment: options.environment,
    release: options.release,
    sdk: { name: 'faundr.server', version: VERSION },
    contexts: { runtime: isWorker ? { name: 'cloudflare-workers' } : proc?.versions?.bun ? { name: 'bun', version: proc.versions.bun } : { name: 'node', version: proc?.version } },
    exception: {
      values: [{ type, value: scrub(value), stacktrace: stack && { frames: stack }, mechanism: { type: extra.mechanism || 'generic', handled: extra.handled ?? true } }],
    },
    ...request(extra.request),
  }
  const body = [{ event_id: event.event_id, sent_at: new Date(now).toISOString(), dsn: options.dsnText }, { type: 'event' }, event].map((x) => JSON.stringify(x)).join('\n')
  try {
    const res = await fetch(options.ingest, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-sentry-envelope' },
      signal: AbortSignal.timeout?.(3000),
    })
    if (res.status === 429) pausedUntil = Date.now() + (+res.headers.get('retry-after') || 60) * 1000
  } catch {
    // Sem rede ou Faundr fora do ar: o erro do app não pode virar outro erro.
  }
}

/** Express (e Connect): use depois das rotas. Manda o erro e segue para o tratamento que já existe. */
export const errorHandler = () => (error, req, _res, next) => {
  capture(error, { request: req, mechanism: 'express', handled: false })
  next(error)
}

/**
 * Cloudflare Workers: envolve o `export default`. As opções vêm do env (variáveis do Worker) a cada chamada.
 * O erro vai pelo ctx.waitUntil (a resposta não espera) e segue adiante, como sem o SDK.
 */
export function withFaundr(optionsFromEnv, handler) {
  const setup = (env) => {
    if (!options) init(typeof optionsFromEnv === 'function' ? optionsFromEnv(env) : optionsFromEnv)
  }
  const wrapped = { ...handler }
  if (handler.fetch)
    wrapped.fetch = async (req, env, ctx) => {
      setup(env)
      try {
        return await handler.fetch(req, env, ctx)
      } catch (error) {
        // wrangler dev: localhost não manda.
        if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(req.url)) ctx.waitUntil(capture(error, { request: req, mechanism: 'cloudflare', handled: false }))
        throw error
      }
    }
  if (handler.scheduled)
    wrapped.scheduled = async (controller, env, ctx) => {
      setup(env)
      try {
        return await handler.scheduled(controller, env, ctx)
      } catch (error) {
        ctx.waitUntil(capture(error, { mechanism: 'cloudflare.scheduled', handled: false }))
        throw error
      }
    }
  return wrapped
}
