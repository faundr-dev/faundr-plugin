import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptKey, decodeFrames, encodeFrame, openBridge } from '../bin/browse-bridge.mjs'

test('aperto de mão do WebSocket: exemplo da RFC 6455', () => {
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=')
})

// Quadro como o navegador manda: com máscara.
function clientFrame(text) {
  const payload = Buffer.from(text)
  const mask = Buffer.from([1, 2, 3, 4])
  const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]))
  const n = payload.length
  const head = n < 126 ? Buffer.from([0x81, 0x80 | n]) : Buffer.from([0x81, 0x80 | 126, n >> 8, n & 0xff])
  return Buffer.concat([head, mask, masked])
}

test('lê quadros com máscara, inclusive cortados no meio', () => {
  const long = 'x'.repeat(5000)
  const all = Buffer.concat([clientFrame('{"id":1}'), clientFrame(long)])
  const first = decodeFrames(all.subarray(0, 30))
  assert.deepEqual(first.frames.map((f) => f.payload.toString()), ['{"id":1}'])
  const second = decodeFrames(Buffer.concat([first.rest, all.subarray(30)]))
  assert.equal(second.frames[0].payload.toString(), long)
  assert.equal(second.rest.length, 0)
})

test('quadro do servidor: tamanhos de 1, 2 e 8 bytes', () => {
  for (const n of [10, 300, 70000]) {
    const { frames } = decodeFrames(encodeFrame('y'.repeat(n)))
    assert.equal(frames[0].payload.length, n)
    assert.equal(frames[0].opcode, 1)
  }
})

test('ponte recusa quem não é a extensão ou não tem a senha', async () => {
  let address
  const opening = openBridge({ open: (url) => (address = new URL(url)), timeoutMs: 1500 })
  await new Promise((r) => setTimeout(r, 50))
  const token = new URLSearchParams(address.hash.slice(1)).get('t')
  const tries = [
    `ws://127.0.0.1:${address.port}/bridge?t=errada`,
    // Senha certa, mas sem a origem chrome-extension:// (uma página ou outro programa).
    `ws://127.0.0.1:${address.port}/bridge?t=${token}`,
  ]
  for (const url of tries) {
    const refused = await new Promise((done) => {
      const ws = new WebSocket(url)
      ws.onopen = () => done(false)
      ws.onerror = () => done(true)
    })
    assert.equal(refused, true, url)
  }
  await assert.rejects(opening, /não respondeu/)
})
