// Base comum da checagem de segurança: arquivos do projeto, leitura, linha do achado,
// máscara e os caminhos de teste/exemplo/documentação (usados por security.mjs e seus módulos).
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
export const lower = (s) => SEVERITIES[Math.min(SEVERITIES.indexOf(s) + 1, SEVERITIES.length - 1)]
const MAX_FILE = 1_000_000
export const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

// ---- arquivos do projeto --------------------------------------------------------------------

const SKIP_PATH = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|\.next|\.nuxt|\.svelte-kit|\.wrangler|\.vercel|\.turbo|coverage|vendor|\.venv|venv|__pycache__|\.claude|\.remember)(\/|$)/
export const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|svg|pdf|zip|gz|tgz|rar|7z|woff2?|ttf|otf|eot|mp[34]|mov|webm|wav|ogg|wasm|exe|dll|so|dylib|bin|lockb|jar|class|pyc|ai|psd|sketch|fig|docx?|xlsx?|pptx?|odp)$/i
export const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|deno\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock|pubspec\.lock|packages\.lock\.json|gradle\.lockfile|conan\.lock)$/

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

export function readText(root, rel) {
  try {
    const abs = path.join(root, rel)
    const st = fs.statSync(abs)
    if (!st.isFile() || st.size > MAX_FILE) return null
    const text = fs.readFileSync(abs, 'utf8')
    return text.includes('\0') ? null : text
  } catch {
    // Arquivo que sumiu, sem permissão ou ilegível: fica fora da checagem, como se não existisse.
    return null
  }
}

export function lineOf(text, index) {
  let line = 1
  for (let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) line++
  return line
}

export function lineText(text, index) {
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

export function entropy(s) {
  const counts = new Map()
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) {
    const p = n / s.length
    h -= p * Math.log2(p)
  }
  return h
}

export const TEST_PATH = /(^|\/)(__tests__|__mocks__|tests?|spec|specs|fixtures?|mocks?|e2e|cypress|playwright|stories)(\/|$)|\.(test|spec|stories)\.[a-z]+$|_test\.go$|Tests?\.(java|kt|cs)$|(^|\/)[^/]+\.Tests?\/|_(unit)?tests?\.(c|cc|cpp|cxx)$/i
export const EXAMPLE_PATH = /\.(example|sample|template|dist|defaults?)(\.[a-z]+)?$|(^|\/)examples?(\/|$)/i
export const DOC_PATH = /\.(md|mdx|txt|rst|adoc)$/i
