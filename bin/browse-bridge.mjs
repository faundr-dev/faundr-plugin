// Ponte para o navegador rápido usar o Chrome do dono (faundr browse --chrome): a CLI abre um servidor só em
// 127.0.0.1 e uma aba no Chrome apontando para ele, com uma senha aleatória no endereço. A extensão do Faundr
// reconhece essa aba, conecta por WebSocket e repassa os comandos do protocolo do Chrome (CDP) só para ela,
// pelo chrome.debugger. WebSocket mínimo, sem dependências: só texto, ping e fechar.
import { spawn } from 'node:child_process'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { findChrome } from './browse-cdp.mjs'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export const acceptKey = (key) =>
  createHash('sha1')
    .update(key + GUID)
    .digest('base64')

/** Quadro de texto do servidor (sem máscara). */
export function encodeFrame(text, opcode = 0x1) {
  const payload = Buffer.from(text)
  const n = payload.length
  const head = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536 ? Buffer.alloc(4) : Buffer.alloc(10)
  if (n >= 126 && n < 65536) {
    head[0] = 0x80 | opcode
    head[1] = 126
    head.writeUInt16BE(n, 2)
  } else if (n >= 65536) {
    head[0] = 0x80 | opcode
    head[1] = 127
    head.writeBigUInt64BE(BigInt(n), 2)
  }
  return Buffer.concat([head, payload])
}

/** Lê os quadros completos do buffer (os do cliente vêm com máscara); devolve o que sobrou. */
export function decodeFrames(buffer) {
  const frames = []
  let at = 0
  while (buffer.length - at >= 2) {
    const fin = (buffer[at] & 0x80) !== 0
    const opcode = buffer[at] & 0x0f
    const masked = (buffer[at + 1] & 0x80) !== 0
    let len = buffer[at + 1] & 0x7f
    let p = at + 2
    if (len === 126) {
      if (buffer.length < p + 2) break
      len = buffer.readUInt16BE(p)
      p += 2
    } else if (len === 127) {
      if (buffer.length < p + 8) break
      len = Number(buffer.readBigUInt64BE(p))
      p += 8
    }
    const mask = masked ? buffer.subarray(p, p + 4) : null
    if (masked) p += 4
    if (buffer.length < p + len) break
    const payload = Buffer.from(buffer.subarray(p, p + len))
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]
    frames.push({ fin, opcode, payload })
    at = p + len
  }
  return { frames, rest: buffer.subarray(at) }
}

const PAGE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Faundr · navegador rápido</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#151515;color:#fff;font:15px/1.5 system-ui,sans-serif">
<p style="max-width:28rem;padding:0 24px">O Faundr vai usar esta aba para o navegador rápido. Se nada acontecer em alguns segundos,
confira se a extensão do Faundr está instalada e ligada.</p></body></html>`

function openInChrome(url) {
  const exe = findChrome()
  if (!exe) throw new Error('Chrome não encontrado; defina CHROME_PATH.')
  spawn(exe, [url], { detached: true, stdio: 'ignore' })
    .on('error', () => {})
    .unref()
}

/**
 * Abre a ponte e espera a extensão conectar. Devolve { send(method, params), close() } no formato do cliente CDP.
 * FAUNDR_BROWSE_OPEN=print só mostra o endereço (testes): quem chama abre a aba.
 */
export async function openBridge({ log = () => {}, timeoutMs = 20000, open = openInChrome } = {}) {
  const token = randomBytes(24).toString('base64url')
  let socket = null
  let next = 1
  const pending = new Map()
  let connected
  const ready = new Promise((ok, fail) => {
    connected = { ok, fail }
  })

  const server = createServer((req, res) => {
    if (req.url?.startsWith('/faundr-browse')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(PAGE)
    }
    res.writeHead(404).end()
  })

  server.on('upgrade', (req, sock) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const given = Buffer.from(url.searchParams.get('t') ?? '')
    const okToken = given.length === Buffer.byteLength(token) && timingSafeEqual(given, Buffer.from(token))
    // Só a extensão (origem chrome-extension://) e só uma conexão; página de site nenhum consegue entrar.
    if (url.pathname !== '/bridge' || !okToken || !String(req.headers.origin ?? '').startsWith('chrome-extension://') || socket) {
      sock.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    sock.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(req.headers['sec-websocket-key'])}\r\n\r\n`,
    )
    socket = sock
    let buffer = Buffer.alloc(0)
    let parts = []
    sock.on('data', (chunk) => {
      const { frames, rest } = decodeFrames(Buffer.concat([buffer, chunk]))
      buffer = rest
      for (const f of frames) {
        if (f.opcode === 0x9) sock.write(encodeFrame(f.payload.toString(), 0xa))
        else if (f.opcode === 0x8) sock.end()
        else if (f.opcode === 0x1 || f.opcode === 0x0) {
          parts.push(f.payload)
          if (!f.fin) continue
          const msg = JSON.parse(Buffer.concat(parts).toString())
          parts = []
          if (msg.hello === true) connected.ok(msg)
          else if (msg.hello === false) connected.fail(new Error(`A extensão não conseguiu controlar a aba: ${msg.error}`))
          else if (pending.has(msg.id)) {
            const { ok, fail } = pending.get(msg.id)
            pending.delete(msg.id)
            if (msg.error) fail(new Error(msg.error))
            else ok(msg.result)
          }
        }
      }
    })
    sock.on('close', () => {
      for (const { fail } of pending.values()) fail(new Error('A extensão fechou a ponte (aba fechada ou controle cancelado).'))
      pending.clear()
      connected.fail(new Error('A extensão fechou a ponte.'))
    })
    sock.on('error', () => {})
  })

  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  const address = `http://127.0.0.1:${server.address().port}/faundr-browse#t=${token}`
  if (process.env.FAUNDR_BROWSE_OPEN === 'print') log(`ponte: ${address}`)
  else open(address)
  const timer = setTimeout(
    () =>
      connected.fail(
        new Error('A extensão do Faundr não respondeu. Instale ou recarregue a extensão (chrome://extensions) e rode de novo.'),
      ),
    timeoutMs,
  )
  try {
    const hello = await ready
    log(`ponte ligada na aba ${hello.tabId} do seu Chrome`)
  } catch (err) {
    server.close()
    socket?.destroy()
    throw err
  } finally {
    clearTimeout(timer)
  }

  return {
    send(method, params = {}) {
      return new Promise((ok, fail) => {
        if (!socket || socket.destroyed) return fail(new Error('Ponte fechada'))
        const id = next++
        pending.set(id, { ok, fail })
        socket.write(encodeFrame(JSON.stringify({ id, method, params })))
      })
    },
    close() {
      if (socket && !socket.destroyed) {
        socket.write(encodeFrame(JSON.stringify({ type: 'done' })))
        socket.end()
      }
      server.close()
    },
  }
}
