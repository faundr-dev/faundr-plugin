// Chrome próprio do navegador rápido: perfil separado (sem as contas do usuário) e conexão CDP por WebSocket.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const findChrome = () => CHROME_PATHS.find((p) => existsSync(p))

export async function launchChrome({ headless = true, profile = join(tmpdir(), 'faundr-browse-profile') } = {}) {
  const exe = findChrome()
  if (!exe) throw new Error('Chrome not found; set CHROME_PATH.')
  mkdirSync(profile, { recursive: true })
  const portFile = join(profile, 'DevToolsActivePort')
  const before = existsSync(portFile) ? readFileSync(portFile, 'utf8') : null
  const args = [
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1160,900',
    ...(headless ? ['--headless=new'] : []),
    'about:blank',
  ]
  const child = spawn(exe, args, { stdio: 'ignore', detached: false })
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (existsSync(portFile)) {
      const now = readFileSync(portFile, 'utf8')
      if (now !== before && now.includes('\n')) {
        const [port, path] = now.trim().split('\n')
        return { child, ws: `ws://127.0.0.1:${port}${path}` }
      }
    }
    await sleep(50)
  }
  child.kill()
  throw new Error('Chrome did not open the debugging port in time.')
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((ok, fail) => {
    ws.onopen = ok
    ws.onerror = () => fail(new Error('Could not connect to Chrome.'))
  })
  let next = 1
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (!msg.id || !pending.has(msg.id)) return
    const { ok, fail } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) fail(new Error(`${msg.error.message} (${msg.error.code})`))
    else ok(msg.result)
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, fail) => {
      const id = next++
      pending.set(id, { ok, fail })
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  return { send, close: () => ws.close() }
}
