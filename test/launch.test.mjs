import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkDbTest, checkHeaders, checkPaymentWebhook, checkPrivacy, checkRateLimit, productionUrl } from '../bin/launch.mjs'

function project(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-launch-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true })
    fs.writeFileSync(path.join(d, rel), text)
  }
  return [d, Object.keys(files)]
}

test('cabeçalhos: todos presentes = ok; nenhum = falta; sem https = falta', async () => {
  const full = {
    'strict-transport-security': 'max-age=63072000',
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  }
  const ok = await checkHeaders('https://a.dev', { fetchImpl: async () => new Response('', { headers: full }) })
  assert.equal(ok.status, 'ok')
  const none = await checkHeaders('https://a.dev', { fetchImpl: async () => new Response('') })
  assert.equal(none.status, 'falta')
  assert.match(none.detail, /HSTS/)
  const some = await checkHeaders('https://a.dev', { fetchImpl: async () => new Response('', { headers: { ...full, 'referrer-policy': '' } }) })
  assert.equal(some.status, 'aviso')
  assert.equal((await checkHeaders('http://a.dev')).status, 'falta')
  assert.equal((await checkHeaders(null)).status, 'nao-verificado')
})

test('limite de pedidos: dependência conta; regra em arquivo que não é rota não conta', () => {
  let [d, files] = project({ 'package.json': '{"dependencies":{"@upstash/ratelimit":"1"}}', 'src/api/login.ts': 'export {}' })
  assert.equal(checkRateLimit(d, files).status, 'ok')
  ;[d, files] = project({ 'package.json': '{}', 'src/api/login.ts': 'export {}', 'tools/scan.mjs': "const re = /express-rate-limit/" })
  assert.equal(checkRateLimit(d, files).status, 'falta')
  ;[d, files] = project({ 'package.json': '{}', 'src/server/api.ts': 'const limiter = rateLimit({ windowMs: 60000 })' })
  assert.equal(checkRateLimit(d, files).status, 'ok')
  ;[d, files] = project({ 'package.json': '{}', 'src/App.tsx': 'export {}' })
  assert.equal(checkRateLimit(d, files).status, 'na', 'sem servidor próprio')
})

test('webhook de pagamento: sem serviço = na; webhook sem assinatura = falta; com assinatura = ok', () => {
  let [d, files] = project({ 'package.json': '{}' })
  assert.equal(checkPaymentWebhook(d, files).status, 'na')
  ;[d, files] = project({ 'package.json': '{"dependencies":{"stripe":"1"}}', 'src/App.tsx': 'checkout()' })
  assert.equal(checkPaymentWebhook(d, files).status, 'aviso')
  ;[d, files] = project({ 'package.json': '{"dependencies":{"stripe":"1"}}', 'src/api/webhook.ts': 'const body = await req.json(); if (body.type === "checkout.session.completed") liberar()' })
  assert.equal(checkPaymentWebhook(d, files).status, 'falta')
  ;[d, files] = project({ 'package.json': '{"dependencies":{"stripe":"1"}}', 'src/api/webhook.ts': 'stripe.webhooks.constructEvent(raw, sig, secret)' })
  assert.equal(checkPaymentWebhook(d, files).status, 'ok')
})

test('política de privacidade: página = ok; só o texto = aviso; nada = falta', () => {
  let [d, files] = project({ 'src/routes/privacidade.tsx': 'export default () => null' })
  assert.equal(checkPrivacy(d, files).status, 'ok')
  ;[d, files] = project({ 'src/Footer.tsx': '<a href="/privacidade">Política de Privacidade</a>', 'src/Help.tsx': 'veja a política de privacidade' })
  assert.equal(checkPrivacy(d, files).status, 'aviso')
  ;[d, files] = project({ 'src/App.tsx': 'oi' })
  assert.equal(checkPrivacy(d, files).status, 'falta')
})

test('banco testado: lê o resultado salvo pelo db-test', () => {
  const now = Date.parse('2026-10-08T12:00:00Z')
  const save = (r) => project({ '.faundr/db-test.json': JSON.stringify(r) })[0]
  assert.equal(checkDbTest(project({})[0], now).status, 'nao-verificado')
  assert.equal(checkDbTest(save({ at: '2026-10-08T10:00:00Z', full: true, open: 0, tables: 3 }), now).status, 'ok')
  assert.equal(checkDbTest(save({ at: '2026-10-08T10:00:00Z', full: false, open: 0, tables: 3 }), now).status, 'aviso')
  assert.equal(checkDbTest(save({ at: '2026-10-08T10:00:00Z', full: true, open: 2, tables: 3 }), now).status, 'falta')
  assert.equal(checkDbTest(save({ at: '2026-08-01T10:00:00Z', full: true, open: 0, tables: 3 }), now).status, 'aviso')
})

test('URL de produção vem da Stack', () => {
  const [d] = project({ '.faundr/stack.json': JSON.stringify({ environments: [{ name: 'Local', url: 'http://localhost:3000' }, { name: 'Produção', url: 'https://app.dev' }] }) })
  assert.equal(productionUrl(d), 'https://app.dev')
})
