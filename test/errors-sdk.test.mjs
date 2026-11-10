import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capture, errorHandler, init } from '../sdk/faundr-errors.mjs'

// O SDK de erros roda dentro do app do usuário: nada nele pode virar outro erro.
const realFetch = globalThis.fetch
const cryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto')

test('sem crypto global (Node 18) o evento sai com id, e o e-mail enorme não trava', async () => {
  const bodies = []
  globalThis.fetch = async (_url, req) => {
    bodies.push(req.body)
    return new Response('{}')
  }
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true })
  try {
    init({ dsn: 'https://k@faundr.test/1', enabled: true })
    const start = Date.now()
    await capture(new Error(`${'a.'.repeat(40_000)} de ana@exemplo.com`))
    assert.ok(Date.now() - start < 1000, `${Date.now() - start} ms`)
    assert.equal(bodies.length, 1)
    const event = JSON.parse(bodies[0].split('\n')[2])
    assert.match(event.event_id, /^[0-9a-f]{32}$/)
    await capture(new Error('falha de ana@exemplo.com'))
    assert.match(bodies[1], /falha de \[e-mail\]/)
  } finally {
    Object.defineProperty(globalThis, 'crypto', cryptoDesc)
    globalThis.fetch = realFetch
  }
})

test('capture nunca rejeita e o errorHandler do Express segue adiante', async () => {
  init({ dsn: 'https://k@faundr.test/1', enabled: true })
  const bad = {
    get message() {
      throw new Error('getter quebrado')
    },
  }
  Object.setPrototypeOf(bad, Error.prototype)
  await assert.doesNotReject(capture(bad))
  let passed = null
  errorHandler()(bad, { method: 'GET', url: '/x' }, {}, (e) => (passed = e))
  assert.equal(passed, bad)
})
