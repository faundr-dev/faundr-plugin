import assert from 'node:assert/strict'
import fs from 'node:fs'
import { request } from 'node:http'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { decodeFrames, openBridge } from '../bin/browse-bridge.mjs'
import { pairCode } from '../bin/browse-pair-code.mjs'
import { setLang } from '../bin/i18n.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const extensionCopy = path.join(here, '..', '..', 'extension', 'pair-code.js')
const hasExtension = fs.existsSync(extensionCopy)

test('código da ponte: mesma senha, mesmo código; formato "KX-42"', async () => {
  const token = 'r3Xf8w2Qm9-aBcDeFgHiJkLmNoPqRsTu'
  assert.equal(await pairCode(token), await pairCode(token))
  assert.match(await pairCode(token), /^[A-HJ-NP-Z]{2}-\d{2}$/)
  // Valor fixo: se a conta mudar, a extensão e a CLI param de bater.
  assert.equal(await pairCode('abc'), 'RC-06')
  const codes = new Set()
  for (let i = 0; i < 200; i++) codes.add(await pairCode(`token-${i}`))
  assert.ok(codes.size > 190, 'senhas diferentes quase sempre dão códigos diferentes')
})

test('extensão calcula o mesmo código que a CLI', { skip: !hasExtension && 'sem a pasta extension/' }, async () => {
  assert.equal(
    fs.readFileSync(extensionCopy, 'utf8'),
    fs.readFileSync(path.join(here, '..', 'bin', 'browse-pair-code.mjs'), 'utf8'),
    'rode: cp plugin/bin/browse-pair-code.mjs extension/pair-code.js',
  )
  const ext = await import(new URL(`file:///${extensionCopy.replace(/\\/g, '/')}`).href)
  for (const token of ['abc', 'r3Xf8w2Qm9-aBcDeFgHiJkLmNoPqRsTu', 'ç-ü-漢']) assert.equal(await ext.pairCode(token), await pairCode(token))
})

// Finge ser a extensão: conecta com a origem chrome-extension:// e manda os quadros com máscara.
function fakeExtension(address, token) {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port: address.port,
      path: `/bridge?t=${encodeURIComponent(token)}`,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        Origin: 'chrome-extension://faundr',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    })
    req.on('upgrade', (_res, sock) => {
      let buffer = Buffer.alloc(0)
      sock.on('data', (chunk) => {
        buffer = decodeFrames(Buffer.concat([buffer, chunk])).rest
      })
      resolve({
        send(obj) {
          const payload = Buffer.from(JSON.stringify(obj))
          const mask = Buffer.from([9, 8, 7, 6])
          sock.write(Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, Buffer.from(payload.map((b, i) => b ^ mask[i % 4]))]))
        },
        close: () => sock.destroy(),
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function bridgeWithFake(opts) {
  let address
  let opened
  const ready = new Promise((r) => (opened = r))
  const lines = []
  const opening = openBridge({
    open: (url) => {
      address = new URL(url)
      opened()
    },
    log: (line) => lines.push(line),
    ...opts,
  })
  await Promise.race([ready, opening])
  const token = new URLSearchParams(address.hash.slice(1)).get('t')
  const ext = await fakeExtension(address, token)
  return { opening, ext, lines, code: await pairCode(token) }
}

test('CLI mostra o código e avisa quando a extensão recusa', async () => {
  setLang('pt')
  const { opening, ext, lines, code } = await bridgeWithFake({ timeoutMs: 3000 })
  assert.ok(lines.some((l) => l.includes(`Código da ponte: ${code}`)), lines.join('\n'))
  ext.send({ asking: true, code })
  ext.send({ hello: false, refused: 'deny' })
  await assert.rejects(opening, /recusou/)
  ext.close()
  setLang(null)
})

test('CLI avisa quando o pedido fica sem resposta', async () => {
  setLang('en')
  const { opening, ext, code } = await bridgeWithFake({ timeoutMs: 3000, askTimeoutMs: 200 })
  ext.send({ asking: true, code })
  await assert.rejects(opening, /No answer in Chrome/)
  ext.close()
  setLang(null)
})
