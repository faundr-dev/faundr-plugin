// Variáveis por ambiente: cada variável que o código lê está no arquivo de exemplo, no .env do computador e na
// hospedagem? O erro clássico de quem publica: funciona no computador e quebra no ar porque faltou uma variável.
//
// Só NOMES: os valores dos .env nunca são lidos para fora daqui. A hospedagem vem da configuração versionada
// (wrangler vars, vercel.json, netlify.toml, fly.toml, render.yaml, GitHub Actions) e, se a pessoa pedir
// (faundr env-check --hosting), da CLI do provedor (lista só os nomes), guardada em .faundr/env-hosting.json.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const PUBLIC_PREFIX = /^(VITE_|NEXT_PUBLIC_|NUXT_PUBLIC_|EXPO_PUBLIC_|REACT_APP_|GATSBY_)/
// PUBLIC_ só vai para o navegador no SvelteKit e no Astro; em outros projetos é um nome qualquer.
const SVELTE_ASTRO = /(^|\/)(svelte|astro)\.config\.[cm]?[jt]s$/
const IGNORE = new Set([
  'NODE_ENV', 'CI', 'DEV', 'PROD', 'MODE', 'SSR', 'BASE_URL', 'HOME', 'PATH', 'PWD', 'USER', 'SHELL', 'TMPDIR', 'TEMP', 'TMP',
  'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'PORT', 'HOSTNAME', 'TZ', 'LANG', 'DEBUG', 'TERM', 'GITHUB_TOKEN', 'GITHUB_OUTPUT',
  'GITHUB_ENV', 'GITHUB_SHA', 'GITHUB_REF', 'RUNNER_OS', 'ACTIONS_STEP_DEBUG', 'VIRTUAL_ENV', 'CONDA_PREFIX', 'XDG_CONFIG_HOME',
])
// Ferramentas do próprio sistema (Claude Code, npm…): não são configuração do app.
const IGNORE_PREFIX = /^(CLAUDE_|npm_|ANTHROPIC_|GIT_|VSCODE_|TERM_)/
// Código que não vai para o ar: CLIs, scripts e ferramentas leem o ambiente de quem roda, não do app.
const NOT_APP = /(^|\/)(bin|scripts?|tools?|cli|plugins?|bench(marks?)?|docs?|examples?)\/|\.d\.ts$/
const LOCAL = ['.env', '.env.local', '.env.development', '.env.development.local', '.dev.vars']
const EXAMPLE = /(^|\/)\.(env|dev\.vars)[\w.-]*\.(example|sample|template|dist)$|(^|\/)\.env\.(example|sample|template)$/
const CODE = /\.(m?[jt]sx?|cjs|py|rb|go|php|vue|svelte|astro)$/
const SKIP = /(^|\/)(node_modules|dist|build|\.next|\.output|\.svelte-kit|\.git|\.faundr|vendor|coverage|\.wrangler|\.vercel)\/|routeTree\.gen\./
const TEST = /(^|\/)(tests?|__tests__|e2e|spec|fixtures?|bench)\/|\.(test|spec)\.[a-z]+$/i
const ENV_USE = /(?:process\.env\.|import\.meta\.env\.|Deno\.env\.get\(\s*['"]|os\.environ(?:\.get)?\(?\s*\[?\s*['"]|os\.getenv\(\s*['"]|process\.env\[\s*['"]|\benv\.)([A-Z][A-Z0-9_]{2,})/g
const NAMES = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=/gm

function read(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8')
  } catch {
    return ''
  }
}
const namesIn = (text) => [...text.matchAll(NAMES)].map((m) => m[1])

function jsonc(text) {
  try {
    return JSON.parse(text.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1'))
  } catch {
    return null
  }
}

/** Nomes que a configuração versionada do deploy define: { names: Set, sources: string[] }. */
export function configuredHosting(root, files) {
  const names = new Set()
  const sources = []
  const add = (list, src) => {
    let n = 0
    for (const x of list) if (/^[A-Z][A-Z0-9_]{1,}$/.test(x)) (names.add(x), n++)
    if (n) sources.push(src)
  }
  for (const f of files.filter((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x) && !SKIP.test(x))) {
    const text = read(root, f)
    if (f.endsWith('.toml')) {
      const blocks = [...text.matchAll(/^\[(?:env\.[\w-]+\.)?vars\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)].map((m) => m[1]).join('\n')
      add([...blocks.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]), f)
    } else {
      const w = jsonc(text)
      add([...Object.keys(w?.vars ?? {}), ...Object.values(w?.env ?? {}).flatMap((e) => Object.keys(e?.vars ?? {}))], f)
    }
  }
  for (const f of files.filter((x) => /(^|\/)vercel\.json$/.test(x))) {
    const v = jsonc(read(root, f))
    add([...Object.keys(v?.env ?? {}), ...Object.keys(v?.build?.env ?? {})], f)
  }
  for (const f of files.filter((x) => /(^|\/)(netlify|fly)\.toml$/.test(x))) {
    const text = read(root, f)
    const block = text.match(/^\[(?:build\.environment|env)\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1] ?? ''
    add([...block.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]), f)
  }
  for (const f of files.filter((x) => /(^|\/)render\.ya?ml$/.test(x))) add([...read(root, f).matchAll(/-\s*key:\s*([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]), f)
  for (const f of files.filter((x) => /^\.github\/workflows\/.+\.ya?ml$/.test(x))) {
    const text = read(root, f)
    if (!/deploy|wrangler|vercel|netlify|fly|pages|publish/i.test(text)) continue
    add([...text.matchAll(/\b([A-Z][A-Z0-9_]{2,}):\s*\$\{\{\s*(?:secrets|vars)\.[A-Z0-9_]+\s*\}\}/g)].map((m) => m[1]), f)
  }
  return { names, sources }
}

/** Nomes na hospedagem pela CLI do provedor (só nomes). { provider, names } ou { provider, error }. */
export function hostingFromCli(root, provider, { run = spawnSync } = {}) {
  // Comando fixo (nada vem do usuário): roda pelo shell para achar o npx também no Windows.
  const cmds = {
    cloudflare: 'npx --no-install wrangler secret list --format json',
    vercel: 'npx --no-install vercel env ls production',
    netlify: 'npx --no-install netlify env:list --json',
  }
  const cmd = cmds[provider]
  if (!cmd) return { provider, error: 'provedor sem CLI conhecida' }
  const r = run(cmd, { cwd: root, encoding: 'utf8', timeout: 60_000, shell: true })
  if (r.status !== 0) return { provider, error: (r.stderr || r.stdout || r.error?.message || 'falhou').toString().trim().split('\n').slice(-1)[0].slice(0, 200) }
  const out = String(r.stdout ?? '')
  let names = []
  if (provider === 'cloudflare') names = (JSON.parse(out.slice(out.indexOf('['))) ?? []).map((s) => s.name)
  else if (provider === 'netlify') names = Object.keys(JSON.parse(out.slice(out.indexOf('{'))) ?? {})
  else names = [...out.matchAll(/^\s*([A-Z][A-Z0-9_]{1,})\s+/gm)].map((m) => m[1])
  return { provider, names: [...new Set(names)].sort() }
}

/** Qual CLI de hospedagem faz sentido neste projeto. */
export function hostingProvider(files) {
  if (files.some((f) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(f))) return 'cloudflare'
  if (files.some((f) => /(^|\/)(vercel\.json|\.vercel\/project\.json)$/.test(f))) return 'vercel'
  if (files.some((f) => /(^|\/)netlify\.toml$/.test(f))) return 'netlify'
  return null
}

export function readHostingCache(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'env-hosting.json'), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Matriz: [{ name, scope, code, example, local, hosting }] e problemas.
 * hosting: true (está), false (a CLI listou tudo e ela não está), null (não dá para saber sem a CLI).
 * Variável pública é embutida na hora do build: no ar, ela precisa estar onde o build roda.
 */
export function envMatrix(root, files, { cache = readHostingCache(root) } = {}) {
  const code = new Map()
  const optional = new Map()
  for (const f of files.filter((x) => CODE.test(x) && !SKIP.test(x) && !TEST.test(x) && !NOT_APP.test(x)).slice(0, 4000)) {
    const text = read(root, f)
    for (const m of text.matchAll(ENV_USE)) {
      if (IGNORE.has(m[1]) || IGNORE_PREFIX.test(m[1])) continue
      // Dentro de texto (mensagem que cita process.env.X) não é leitura.
      const line = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index)
      if ((line.match(/[`'"]/g) ?? []).length % 2 === 1) continue
      const list = code.get(m[1]) ?? []
      if (!list.includes(f) && list.length < 3) list.push(f)
      code.set(m[1], list)
      // Com valor padrão (process.env.X ?? 'y' / || 'y'), faltar não quebra.
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 8)
      // Também "if (process.env.X)", "process.env.X ? … : …" e "process.env.X && …": só usa quando existe.
      const opt = /^\s*(\?\?|\|\||&&|\?(?![?.]))/.test(after) || /^['"]\s*\]?\s*,/.test(after) || /\bif\s*\(\s*$/.test(line)
      // Basta um uso opcional: o resto costuma estar protegido por ele ("if (process.env.X) return process.env.X").
      optional.set(m[1], (optional.get(m[1]) ?? false) || opt)
    }
  }
  const example = new Set(files.filter((f) => EXAMPLE.test(f)).flatMap((f) => namesIn(read(root, f))))
  const local = new Set(LOCAL.flatMap((f) => namesIn(read(root, f))))
  const config = configuredHosting(root, files)
  const cli = cache?.names ? new Set(cache.names) : null
  const publicPrefix = files.some((f) => SVELTE_ASTRO.test(f)) ? /^(PUBLIC_|VITE_|NEXT_PUBLIC_|NUXT_PUBLIC_|EXPO_PUBLIC_|REACT_APP_|GATSBY_)/ : PUBLIC_PREFIX

  const names = [...new Set([...code.keys(), ...example, ...local])].filter((n) => !IGNORE.has(n) && !IGNORE_PREFIX.test(n)).sort()
  const rows = names.map((name) => {
    const inConfig = config.names.has(name)
    const hosting = inConfig || cli?.has(name) ? true : cli && !publicPrefix.test(name) ? false : null
    return {
      name,
      scope: publicPrefix.test(name) ? 'publica' : 'servidor',
      code: code.get(name) ?? [],
      optional: optional.get(name) ?? false,
      example: example.has(name) || inConfig,
      local: local.has(name) || inConfig,
      hosting,
    }
  })

  const problems = []
  for (const r of rows) {
    if (r.optional) continue
    if (r.code.length && r.hosting === false)
      problems.push({ kind: 'falta-no-ar', severity: 'high', name: r.name, text: `${r.name} é lida pelo código (${r.code[0]}) mas não está na hospedagem: essa parte do app quebra no ar.` })
    if (r.code.length && !r.local)
      problems.push({ kind: 'falta-no-computador', severity: 'medium', name: r.name, text: `${r.name} é lida pelo código (${r.code[0]}) mas não está em nenhum .env do computador: rodando local, essa parte não funciona.` })
    if (r.code.length && !r.example)
      problems.push({ kind: 'fora-do-exemplo', severity: 'low', name: r.name, text: `${r.name} não está no arquivo de exemplo (.env.example): quem for configurar o projeto (ou o servidor) não sabe que ela existe.` })
    if (!r.code.length && (r.example || r.local))
      problems.push({ kind: 'sobrando', severity: 'low', name: r.name, text: `${r.name} está no ${r.example ? 'exemplo' : '.env'}, mas nenhum código lê: pode ser resto de algo que saiu (ou é lida por uma ferramenta).` })
  }
  return {
    at: new Date().toISOString(),
    hosting: cli ? { provider: cache.provider, at: cache.at } : null,
    hostingConfig: config.sources,
    rows: rows.slice(0, 200),
    problems: problems.slice(0, 100),
  }
}
