// Guarda de pacote inventado ("slopsquatting"): a IA às vezes inventa o nome de um pacote, e golpistas registram
// esses nomes com código malicioso. Antes de instalar, o Faundr confere no registro (npm ou PyPI):
//
//   não existe            → barra: o nome está errado (e alguém pode registrá-lo depois)
//   novo ou quase sem uso  → pergunta ao usuário antes
//
// Rede curta e com cache; se o registro não responder, deixa passar (nunca trava o trabalho).

import fs from 'node:fs'
import path from 'node:path'

const NEW_DAYS = 30
const FEW_DOWNLOADS = 100 // por semana (npm)
const CACHE_DAYS = 7
const strip = (t) => t.replace(/^["']|["']$/g, '')

// Pacotes que o comando instala: [{ ecosystem: 'npm' | 'pypi', name }]. Só nomes do registro (sem caminho,
// git, URL ou arquivo) e só quando o registro é o padrão.
export function installedPackages(command) {
  const found = []
  for (const part of String(command ?? '').split(/\|\||&&|[;|\n]/)) {
    const words = part.trim().match(/"[^"]*"|'[^']*'|\S+/g)?.map(strip) ?? []
    while (words.length && (/^\w+=/.test(words[0]) || words[0] === 'sudo')) words.shift()
    if (words.some((w) => /^--(registry|index-url|extra-index-url|find-links)\b|^-i$/.test(w))) continue
    const install = installArgs(words)
    if (install) found.push(...namesFrom(install.rest, install.eco))
  }
  return found.filter((p, i, a) => a.findIndex((q) => q.ecosystem === p.ecosystem && q.name === p.name) === i)
}

// uv add x (posição 1) ou uv pip install x (posição 2); -1 quando não instala.
function uvInstallIndex(words) {
  if (words[1] === 'add') return 1
  return words[1] === 'pip' && words[2] === 'install' ? 2 : -1
}

// O programa e o subcomando de instalar: o que vem depois dele e o registro ({ rest, eco }), ou null.
function installArgs(words) {
  const prog = path.basename(words[0] ?? '').toLowerCase().replace(/\.(exe|cmd)$/, '')
  let i = -1
  let eco = 'pypi'
  if (['npm', 'pnpm', 'yarn', 'bun', 'cnpm'].includes(prog)) {
    i = words.findIndex((w, k) => k > 0 && ['install', 'i', 'add', 'isntall'].includes(w))
    eco = 'npm'
  } else if (/^(pip3?|pipx)$/.test(prog) || (/^python3?$/.test(prog) && words[1] === '-m' && /^pip3?$/.test(words[2]))) i = words.indexOf('install')
  else if (prog === 'uv') i = uvInstallIndex(words)
  else if (prog === 'poetry' && words[1] === 'add') i = 1
  return i > 0 ? { rest: words.slice(i + 1), eco } : null
}

// Nomes de pacote entre os argumentos (pula as opções e o valor das que recebem um).
function namesFrom(rest, eco) {
  const found = []
  for (let k = 0; k < rest.length; k++) {
    const w = rest[k]
    if (w.startsWith('-')) {
      if (/^-(r|c|e)$|^--(requirement|constraint|editable|target|prefix|filter|workspace|tag)$/.test(w)) k++
      continue
    }
    const name = eco === 'npm' ? npmName(w) : pypiName(w)
    if (name) found.push({ ecosystem: eco, name })
  }
  return found
}

function npmName(spec) {
  if (/^(\.|\/|~|[a-z]:\\|file:|link:|git[+:]|https?:|github:|workspace:|npm:)/i.test(spec) || /^[\w.-]+\/[\w.-]+$/.test(spec)) return null
  const m = spec.match(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*/i)
  return m ? m[0].toLowerCase() : null
}

function pypiName(spec) {
  if (/^(\.|\/|~|[a-z]:\\|git\+|https?:|file:)/i.test(spec) || /\.(whl|tar\.gz|zip)$/i.test(spec)) return null
  const m = spec.match(/^[A-Za-z0-9][A-Za-z0-9._-]*/)
  return m ? m[0].toLowerCase().replace(/[._]+/g, '-') : null
}

async function getJson(url, fetchImpl, timeoutMs) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } })
  if (res.status === 404) return { missing: true }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return { body: await res.json() }
}

/**
 * Confere um pacote no registro. Devolve { status: 'ok' | 'missing' | 'new' | 'unpopular', created?, weekly? }
 * ou null quando não deu para saber (sem rede, registro fora do ar).
 */
export async function checkPackage({ ecosystem, name }, { fetchImpl = fetch, now = Date.now(), timeoutMs = 3000 } = {}) {
  try {
    if (ecosystem === 'npm') {
      const downloads = await getJson(`https://api.npmjs.org/downloads/point/last-week/${name}`, fetchImpl, timeoutMs)
      const weekly = downloads.body?.downloads
      if (typeof weekly === 'number' && weekly >= FEW_DOWNLOADS * 10) return { status: 'ok', weekly }
      // Pouco usado (ou recém-criado, ainda sem contagem): o documento do pacote é pequeno nesses casos.
      const doc = await getJson(`https://registry.npmjs.org/${name.replace('/', '%2f')}`, fetchImpl, timeoutMs)
      if (doc.missing || doc.body?.error === 'not_found' || (doc.body && !doc.body.versions && !doc.body.time)) return { status: 'missing' }
      const created = doc.body?.time?.created ? new Date(doc.body.time.created).getTime() : null
      if (created && now - created < NEW_DAYS * 86400_000) return { status: 'new', created, weekly }
      if (typeof weekly === 'number' && weekly < FEW_DOWNLOADS) return { status: 'unpopular', created, weekly }
      return { status: 'ok', weekly }
    }
    const doc = await getJson(`https://pypi.org/pypi/${name}/json`, fetchImpl, timeoutMs)
    if (doc.missing) return { status: 'missing' }
    const uploads = Object.values(doc.body?.releases ?? {})
      .flat()
      .map((f) => new Date(f.upload_time_iso_8601 ?? f.upload_time).getTime())
      .filter((t) => !Number.isNaN(t))
    const created = uploads.length ? Math.min(...uploads) : null
    if (created && now - created < NEW_DAYS * 86400_000) return { status: 'new', created }
    return { status: 'ok' }
  } catch {
    // Sem rede ou registro fora do ar: não dá para saber, e quem chama deixa passar (nunca trava o trabalho).
    return null
  }
}

// Cache local dos pacotes que deram "ok" (7 dias): o mesmo pacote não vai à rede de novo.
function readCache(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // Cache ausente ou corrompido: começa vazio e confere tudo na rede.
    return {}
  }
}

/** Confere todos os pacotes do comando em paralelo. Devolve { level: 'deny'|'ask', message } ou null. */
export async function guardInstall(command, { configDir, fetchImpl, now = Date.now() } = {}) {
  const pkgs = installedPackages(command)
  if (!pkgs.length) return null
  const cacheFile = configDir ? path.join(configDir, 'packages-ok.json') : null
  const cache = cacheFile ? readCache(cacheFile) : {}
  const key = (p) => `${p.ecosystem}:${p.name}`
  const todo = pkgs.filter((p) => !(cache[key(p)] && now - cache[key(p)] < CACHE_DAYS * 86400_000))
  const results = await Promise.all(todo.map(async (p) => ({ ...p, r: await checkPackage(p, { fetchImpl, now }) })))
  const fresh = results.filter((x) => x.r?.status === 'ok')
  if (cacheFile && fresh.length) {
    for (const x of fresh) cache[key(x)] = now
    try {
      fs.mkdirSync(configDir, { recursive: true })
      fs.writeFileSync(cacheFile, JSON.stringify(cache))
    } catch {
      // O cache é só atalho: sem gravar, a próxima vez confere de novo na rede.
    }
  }
  const registry = (p) => (p.ecosystem === 'npm' ? 'npm' : 'PyPI')
  const missing = results.filter((x) => x.r?.status === 'missing')
  if (missing.length)
    return {
      level: 'deny',
      message: `[Faundr] Barrado: ${missing.map((x) => `"${x.name}"`).join(', ')} não existe${missing.length > 1 ? 'm' : ''} no ${registry(missing[0])}. Deve ser um nome inventado ou digitado errado; golpistas registram esses nomes com código malicioso. Confira o nome certo na documentação oficial da biblioteca antes de instalar.`,
    }
  const risky = results.filter((x) => x.r?.status === 'new' || x.r?.status === 'unpopular')
  if (!risky.length) return null
  const why = (x) =>
    x.r.status === 'new'
      ? `"${x.name}" foi criado há ${Math.max(1, Math.floor((now - x.r.created) / 86400_000))} dia(s)`
      : `"${x.name}" tem só ${x.r.weekly} download(s) por semana`
  return {
    level: 'ask',
    message: `[Faundr] Atenção: ${risky.map(why).join('; ')} no ${registry(risky[0])}. Pacote novo ou quase sem uso pode ser um nome inventado pela IA e registrado por golpistas. Aprove só se você conhece o pacote ou conferiu o nome na documentação oficial.`,
  }
}
