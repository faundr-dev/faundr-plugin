// Regras de qualidade que olham o projeto inteiro: arquivos sem uso, código duplicado, tsc e ESLint,
// Dockerfile, CSS, dependências sem uso, instruções que apontam para o que não existe, TODOs antigos
// e desempenho no banco (parte de quality-rules.mjs).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ignoreSet } from './design-rules.mjs'
import { projectParts } from './parts.mjs'
import { foreignKeysWithoutIndex, queriesInLoops, unboundedQueries } from './perf-rules.mjs'
import { DOCKERFILE } from './security-langs.mjs'
import { projectFiles } from './security.mjs'
import { t } from './i18n.mjs'
import { MAX_FILE, TEST_PATH, GENERATED, read } from './quality-common.mjs'

// Dependências que a linguagem, o Node ou o navegador já resolvem (tabela do Ponytail, docs/platform-native.md).
// Função: o texto vai para o painel na língua da pessoa, decidida na hora.
const NATIVE = () => {
  const anyEnv = t('any current environment', 'qualquer ambiente atual')
  const nodeBrowsers = (v) => t(`Node ${v}+ and browsers`, `Node ${v}+ e navegadores`)
  const simpleParams = t('for simple parameters (no nested objects)', 'para parâmetros simples (sem objetos aninhados)')
  return {
    uuid: ['crypto.randomUUID()', t('Node 19+ and all current browsers', 'Node 19+ e todos os navegadores atuais')],
    'node-uuid': ['crypto.randomUUID()', t('Node 19+ and all current browsers', 'Node 19+ e todos os navegadores atuais')],
    'lodash.clonedeep': ['structuredClone(obj)', t('Node 17+ and current browsers', 'Node 17+ e navegadores atuais')],
    'clone-deep': ['structuredClone(obj)', t('Node 17+ and current browsers', 'Node 17+ e navegadores atuais')],
    qs: ['URLSearchParams', simpleParams],
    'query-string': ['URLSearchParams', simpleParams],
    rimraf: [t('fs.rm(path, { recursive: true, force: true })', 'fs.rm(caminho, { recursive: true, force: true })'), 'Node 14.14+'],
    mkdirp: [t('fs.mkdir(path, { recursive: true })', 'fs.mkdir(caminho, { recursive: true })'), 'Node 10.12+'],
    'node-fetch': [t('native fetch', 'fetch nativo'), 'Node 18+'],
    'cross-fetch': [t('native fetch', 'fetch nativo'), nodeBrowsers(18)],
    'isomorphic-fetch': [t('native fetch', 'fetch nativo'), nodeBrowsers(18)],
    'left-pad': [t("text.padStart(n, ' ')", "texto.padStart(n, ' ')"), anyEnv],
    'object-assign': [t('Object.assign or { ...obj }', 'Object.assign ou { ...obj }'), anyEnv],
    'array-flatten': [t('list.flat(Infinity)', 'lista.flat(Infinity)'), anyEnv],
    'lodash.flatten': [t('list.flat()', 'lista.flat()'), anyEnv],
    'es6-promise': [t('native Promise', 'Promise nativa'), anyEnv],
    'promise-polyfill': [t('native Promise', 'Promise nativa'), anyEnv],
    'body-parser': ['express.json() / express.urlencoded()', 'Express 4.16+'],
    'is-number': ["typeof x === 'number' && Number.isFinite(x)", anyEnv],
    'abort-controller': [t('native AbortController', 'AbortController nativo'), nodeBrowsers(15)],
    'url-parse': [t('new URL(text)', 'new URL(texto)'), anyEnv],
  }
}

// Pacotes usados sem import no código (ferramentas, plugins por nome na configuração, CSS).
const IMPLICIT = /^(@types\/|typescript$|tslib$|react-dom$|@tailwindcss\/|tailwindcss$|postcss|autoprefixer$|@vitejs\/|vite$|wrangler$|@cloudflare\/workers-types$|eslint|prettier|@?babel|core-js$|regenerator-runtime$|sharp$)/

// ---------- pontos de entrada: o que o framework ou a configuração chamam sozinhos ----------

const ENTRY = [
  /(^|\/)(src\/)?routes\//, // TanStack Router, SvelteKit, Remix
  /(^|\/)(src\/)?app\/(.*\/)?(page|layout|route|loading|error|not-found|template|default|global-error|opengraph-image|icon|sitemap|robots|manifest)\.[jt]sx?$/, // Next.js app router
  /(^|\/)(src\/)?pages\//, // Next.js pages, Astro
  /(^|\/)(middleware|instrumentation|proxy)\.[jt]s$/,
  /(^|\/)[^/]+\.config\.[cm]?[jt]s$/, // vite.config, tailwind.config, eslint.config…
  /(^|\/)(src\/)?(main|index|client|server|router|entry[-.]\w+|worker|start|app)\.[cm]?[jt]sx?$/,
  /(^|\/)(bin|scripts)\//,
  /(^|\/)(supabase\/functions|api|netlify\/functions)\//,
  /\.d\.ts$/,
  /\.html?$/, // páginas: o navegador abre pelo endereço, ninguém importa
  // Python: o que o interpretador, o Django ou o servidor carregam pelo nome.
  /(^|\/)(main|app|manage|wsgi|asgi|setup|conftest|settings|urls|admin|apps|models|signals|tasks|celery|__init__|__main__)\.py$/,
  /(^|\/)migrations\//,
  // Dart/Flutter: lib/main.dart, programas em bin/ e tool/, arquivos gerados.
  /(^|\/)lib\/main(_\w+)?\.dart$/,
  /(^|\/)tool\//,
  /\.(g|freezed|gr|config|mocks)\.dart$/,
  // PHP/Laravel: o que o framework acha por convenção.
  /(^|\/)(public\/index|artisan|server)\.php$/,
  /(^|\/)(routes|config|database|bootstrap|resources)\//,
  /(^|\/)app\/(Providers|Console|Http\/Middleware|Http\/Kernel|Exceptions|Listeners|Policies|Observers|Jobs|Events|Mail|Notifications)\b/,
]

// Em cada parte do projeto: o que o package.json declara (main, bin, exports) e os arquivos citados nos scripts
// e no wrangler, com os caminhos relativos à parte.
export function entryPoints(root) {
  const declared = new Set()
  const cited = []
  for (const { dir, pkg } of projectParts(root)) {
    const addPath = (v) => typeof v === 'string' && declared.add([dir, v.replace(/^\.\//, '')].filter(Boolean).join('/'))
    addPath(pkg.main)
    addPath(pkg.module)
    if (typeof pkg.bin === 'string') addPath(pkg.bin)
    else Object.values(pkg.bin ?? {}).forEach(addPath)
    const walkExports = (v) => (typeof v === 'string' ? addPath(v) : v && typeof v === 'object' && Object.values(v).forEach(walkExports))
    walkExports(pkg.exports)
    // Arquivos citados nos scripts ("node engine/build.mjs") e no wrangler (main).
    const wrangler = read(root, path.join(dir, 'wrangler.jsonc')) ?? read(root, path.join(dir, 'wrangler.toml')) ?? ''
    cited.push({ dir, text: `${Object.values(pkg.scripts ?? {}).join(' ')} ${wrangler}` })
  }
  // Fora do npm, quem roda o programa é um comando escrito nestes arquivos (uvicorn main:app, php artisan…).
  const launchers = ['Procfile', 'Dockerfile', 'docker-compose.yml', 'compose.yaml', 'Makefile', 'pyproject.toml', 'setup.cfg', 'fly.toml', 'render.yaml', 'app.yaml', 'composer.json', 'pubspec.yaml']
  const launchText = launchers.map((f) => read(root, f) ?? '').join('\n')
  // "uvicorn app.main:app" cita app/main.py.
  cited.push({ dir: '', text: `${launchText} ${launchText.replace(/\b([\w]+(?:\.[\w]+)+):\w+/g, (_, mod) => `${mod.replace(/\./g, '/')}.py`)}` })
  // Caminho relativo à parte (null se o arquivo não é dela); a raiz contém tudo.
  const inPart = (rel, dir) => {
    if (!dir) return rel
    return rel.startsWith(`${dir}/`) ? rel.slice(dir.length + 1) : null
  }
  // Nuxt: componentes, composables, utils, layouts, plugins, middleware e server entram sozinhos, sem import.
  const nuxtDirs = projectParts(root)
    .filter(({ dir }) => ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs'].some((f) => read(root, path.join(dir, f)) !== null))
    .map(({ dir }) => dir)
  const nuxtAuto = (rel) => nuxtDirs.some((dir) => /^(src\/|app\/)?(components|composables|utils|layouts|plugins|middleware|server|stores)\//.test(inPart(rel, dir) ?? ''))
  return (rel) => declared.has(rel) || cited.some(({ dir, text }) => inPart(rel, dir) && text.includes(inPart(rel, dir))) || ENTRY.some((re) => re.test(rel)) || nuxtAuto(rel)
}

// ---------- trechos duplicados ----------

const DUP_WINDOW = 8
const DUP_MIN_CHARS = 280
// Linhas que não contam (vazias, comentários, imports, só fechamento).
const TRIVIAL = /^(\/\/|\/\*|\*|#|import\b|from\s+\S+\s+import\b|export \{|[)\]}>;,:]+$|<\/[\w.]+>$)/

/** Blocos de 8+ linhas iguais (ignorando espaços) em dois lugares do projeto. Um item por bloco. */
export function duplicates(texts) {
  // Páginas HTML repetem cabeçalho e rodapé de propósito (site estático): ficam de fora.
  const files = [...texts].filter(([rel]) => !TEST_PATH.test(rel) && !/\.html?$/.test(rel))
  const sig = new Map()
  for (const [rel, text] of files)
    sig.set(
      rel,
      text
        .split('\n')
        .map((l, i) => ({ t: l.trim().replace(/\s+/g, ' '), n: i + 1 }))
        .filter((l) => l.t && !TRIVIAL.test(l.t)),
    )
  const seen = new Map()
  const pairs = new Map()
  for (const [rel, lines] of sig)
    for (let i = 0; i + DUP_WINDOW <= lines.length; i++) {
      const win = lines.slice(i, i + DUP_WINDOW).map((l) => l.t).join('\n')
      if (win.length < DUP_MIN_CHARS) continue
      const first = seen.get(win)
      if (!first) {
        seen.set(win, { rel, i })
        continue
      }
      if (first.rel === rel && i - first.i < DUP_WINDOW) continue
      for (const [a, b] of [[{ rel, i }, first], [first, { rel, i }]]) {
        const key = `${a.rel}|${b.rel}`
        const list = pairs.get(key) ?? []
        list.push({ i: a.i, other: b.i })
        pairs.set(key, list)
      }
    }
  // Junta janelas seguidas num bloco: linhas a–b deste arquivo iguais a linhas c–d do outro.
  const out = []
  for (const [key, wins] of pairs) {
    const [rel, other] = key.split('|')
    const mine = sig.get(rel)
    const theirs = sig.get(other)
    wins.sort((x, y) => x.i - y.i)
    let block = null
    const flush = () => {
      if (!block) return
      const from = mine[block.start].n
      const to = mine[block.end + DUP_WINDOW - 1].n
      out.push({ file: rel, line: from, to, other, otherLine: theirs[block.other].n, size: to - from + 1 })
      block = null
    }
    for (const w of wins) {
      if (block && w.i <= block.end + 1) block.end = w.i
      else {
        flush()
        block = { start: w.i, end: w.i, other: w.other }
      }
    }
    flush()
  }
  return out
}

// ---------- ferramentas do próprio projeto (tsc e ESLint) ----------

const TOOL_TIMEOUT = 180_000

/**
 * Roda o tsc e o ESLint que o projeto já tem instalados, em cada parte que tem a configuração deles (a raiz e,
 * num projeto dividido, frontend/ etc.). O executável pode estar na parte ou na raiz (monorepo). Devolve quais
 * rodaram ("tsc", "eslint em frontend/"…).
 */
export function projectTools(root, c, errors) {
  const ran = []
  const binIn = (dir, rel) => [path.join(root, dir, 'node_modules', rel), path.join(root, 'node_modules', rel)].find((f) => fs.existsSync(f))
  for (const { dir } of projectParts(root)) {
    const cwd = path.join(root, dir)
    const tsc = binIn(dir, 'typescript/bin/tsc')
    if (fs.existsSync(path.join(cwd, 'tsconfig.json')) && tsc) runTsc(tsc, { dir, cwd }, c, errors, ran)
    const eslint = binIn(dir, 'eslint/bin/eslint.js')
    const hasConfig = fs.readdirSync(cwd).some((f) => /^(eslint\.config\.[cm]?[jt]s|\.eslintrc(\.\w+)?)$/.test(f))
    if (hasConfig && eslint) runEslint(eslint, { root, dir, cwd }, c, errors, ran)
  }
  return ran
}

const toolLabel = (tool, dir) => (dir ? `${tool} em ${dir}/` : tool)

// tsc da parte: cada erro de tipo vira achado; se não rodou, vai para `errors`.
function runTsc(tsc, { dir, cwd }, c, errors, ran) {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', '.'], { cwd, encoding: 'utf8', windowsHide: true, timeout: TOOL_TIMEOUT, maxBuffer: 32 * 1024 * 1024 })
  if (r.error) return void errors.push(`${toolLabel('tsc', dir)}: ${r.error.message}`)
  ran.push(toolLabel('tsc', dir))
  // O tsc escreve os caminhos relativos à pasta em que rodou.
  for (const m of r.stdout.matchAll(/^(.+?)\((\d+),\d+\): error (TS\d+): (.+)$/gm))
    c.add('ts/erro-de-tipo', [dir, m[1].replace(/\\/g, '/')].filter(Boolean).join('/'), Number(m[2]), { code: m[3], message: m[4] })
}

// ESLint da parte (saída JSON): cada mensagem vira erro ou aviso; saída que não é JSON vai para `errors`.
function runEslint(eslint, { root, dir, cwd }, c, errors, ran) {
  const r = spawnSync(process.execPath, [eslint, '.', '-f', 'json'], { cwd, encoding: 'utf8', windowsHide: true, timeout: TOOL_TIMEOUT, maxBuffer: 64 * 1024 * 1024 })
  try {
    for (const file of JSON.parse(r.stdout)) {
      const rel = path.relative(root, file.filePath).split(path.sep).join('/')
      for (const msg of file.messages ?? [])
        c.add(msg.severity === 2 ? 'eslint/erro' : 'eslint/aviso', rel, msg.line ?? null, { rule: msg.ruleId, message: msg.message })
    }
    ran.push(toolLabel('eslint', dir))
  } catch {
    errors.push(`${toolLabel('eslint', dir)}: ${(r.stderr || r.error?.message || 'saída inválida').split('\n')[0].slice(0, 200)}`)
  }
}

// Pacotes de cada parte (a raiz e subpastas com package.json, como frontend/), cada uma com os próprios
// arquivos; e as instruções da IA de cada parte, conferidas contra os scripts de todas as partes.
/**
 * Dockerfile: imagem sem versão fixa (sem tag ou :latest), RUN cd no lugar de WORKDIR e apt-get install que não
 * limpa a lista de pacotes. Cada instrução é lida inteira (as linhas que terminam em \ continuam a mesma).
 */
export function dockerfileRules(root, files, c) {
  for (const rel of files.filter((f) => DOCKERFILE.test(f) && !TEST_PATH.test(f))) {
    const text = read(root, rel)
    if (!text) continue
    const stages = new Set()
    for (const { line, body } of dockerInstructions(text)) {
      const from = body.match(/^FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/i)
      if (from) {
        const image = from[1]
        const pinned = /@sha256:/.test(image) || /:(?!latest$)[^/:]+$/.test(image)
        if (!pinned && image !== 'scratch' && !image.includes('$') && !stages.has(image.toLowerCase())) c.add('docker/imagem-sem-versao', rel, line, { image }, text)
        if (from[2]) stages.add(from[2].toLowerCase())
      }
      if (/^RUN\s+cd\s/i.test(body)) c.add('docker/run-cd', rel, line, {}, text)
      if (/^RUN\b.*\bapt-get\s+(-\S+\s+)*install\b/i.test(body) && !/\/var\/lib\/apt\/lists/.test(body)) c.add('docker/apt-sem-limpeza', rel, line, {}, text)
    }
  }
}

// Folhas de estilo do app (sem as geradas e as de bibliotecas).
const STYLE_FILE = /\.(css|scss|sass|less)$/
const IMPORTANT_LIMIT = 5
const NESTING_LIMIT = 4

/**
 * CSS, Sass e Less: !important em excesso (mais de 5 no arquivo), regra vazia e, no Sass/Less, seletor aninhado
 * mais de 4 níveis. Os comentários e os textos entre aspas não contam.
 */
export function styleRules(root, files, c) {
  for (const rel of files.filter((f) => STYLE_FILE.test(f) && !GENERATED.test(f) && !TEST_PATH.test(f) && !/\.min\.css$/.test(f))) {
    const text = read(root, rel)
    if (!text || text.length > MAX_FILE) continue
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length))
    const lineAt = (index) => clean.slice(0, index).split('\n').length
    const important = [...clean.matchAll(/!important\b/g)]
    if (important.length > IMPORTANT_LIMIT) c.add('css/important-em-excesso', rel, lineAt(important[0].index), { count: important.length }, text)
    for (const m of clean.matchAll(/([^{};\s][^{};]*)\{\s*\}/g)) c.add('css/regra-vazia', rel, lineAt(m.index), { selector: m[1].trim().slice(0, 60) }, text)
    if (/\.(scss|sass|less)$/.test(rel)) {
      const worst = deepestNesting(clean)
      if (worst) c.add('css/aninhamento-fundo', rel, lineAt(worst.index), { depth: worst.depth }, text)
    }
  }
}

// Primeiro seletor aninhado além do limite no Sass/Less ({ index, depth }), ou null.
function deepestNesting(clean) {
  // Pilha dos blocos abertos: true quando o bloco é de seletor (@media, @include e afins não contam como nível).
  const open = []
  let worst = null
  for (const [i, ch] of [...clean].entries()) {
    if (ch === '{') {
      open.push(!/^\s*@/.test(clean.slice(clean.lastIndexOf('\n', i) + 1, i)))
      const depth = open.filter(Boolean).length
      if (depth > NESTING_LIMIT && !worst) worst = { index: i, depth }
    } else if (ch === '}') open.pop()
  }
  return worst
}

// As instruções do Dockerfile, com a linha em que cada uma começa (sem comentários; \ no fim continua a linha).
function dockerInstructions(text) {
  const out = []
  let current = null
  for (const [i, raw] of text.split('\n').entries()) {
    const l = raw.trim()
    if (!current && (!l || l.startsWith('#'))) continue
    current ??= { line: i + 1, body: '' }
    current.body += ` ${l.replace(/\\$/, '')}`
    if (!l.endsWith('\\')) {
      out.push({ line: current.line, body: current.body.trim() })
      current = null
    }
  }
  if (current) out.push({ line: current.line, body: current.body.trim() })
  return out
}

export function projectRules(root, files, c) {
  const parts = projectParts(root)
  for (const { dir, pkg } of parts) {
    const manifest = [dir, 'package.json'].filter(Boolean).join('/')
    const deps = Object.keys(pkg.dependencies ?? {})
    const native = NATIVE()
    for (const name of [...deps, ...Object.keys(pkg.devDependencies ?? {})])
      if (native[name]) c.add('demais/dependencia-dispensavel', manifest, null, { pkg: name, native: native[name][0], where: native[name][1] })
    // Raiz de monorepo (workspaces): os pacotes de verdade estão nas partes.
    if (pkg.workspaces) continue
    // Os arquivos da parte; os da raiz são todos menos os das outras partes.
    const others = parts.filter((p) => p.dir && p.dir !== dir && (!dir || !p.dir.startsWith(`${dir}/`))).map((p) => `${p.dir}/`)
    const own = files.filter((f) => (!dir || f.startsWith(`${dir}/`)) && !others.some((o) => f.startsWith(o)))
    const unused = unusedDependencies(root, own, deps, pkg, dir)
    if (unused.length) c.add('demais/dependencia-sem-uso', manifest, null, { pkg: unused[0], list: unused.join(', ') })
  }
  const scripts = new Set(parts.flatMap((p) => Object.keys(p.pkg.scripts ?? {})))
  const docs = parts.flatMap(({ dir }) => (dir ? ['CLAUDE.md', 'AGENTS.md'] : ['CLAUDE.md', 'AGENTS.md', '.claude/CLAUDE.md']).map((d) => [dir, d].filter(Boolean).join('/')))
  for (const doc of docs) instructionRules(root, doc, scripts, c)
}

function unusedDependencies(root, files, deps, pkg, dir = '') {
  const candidates = deps.filter((d) => !IMPLICIT.test(d))
  if (!candidates.length) return []
  // Código + configuração + CSS + HTML da mesma parte: onde um pacote pode ser citado pelo nome.
  const extra = projectFiles(root).files.filter((f) => (!dir || f.startsWith(`${dir}/`)) && /\.(css|scss|html|json|jsonc|vue|svelte|astro|toml|ya?ml)$/.test(f) && !/package(-lock)?\.json$/.test(f))
  const used = new Set()
  const scripts = Object.values(pkg.scripts ?? {}).join('\n')
  const quoted = (name) => new RegExp(`['"\`]${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(/[^'"\`]*)?['"\`]`)
  for (const rel of [...files, ...extra]) {
    const text = read(root, rel)
    if (!text) continue
    for (const d of candidates) if (!used.has(d) && (text.includes(`'${d}`) || text.includes(`"${d}`) || text.includes(`\`${d}`)) && quoted(d).test(text)) used.add(d)
    if (used.size === candidates.length) break
  }
  return candidates.filter((d) => !used.has(d) && !new RegExp(`(^|[\\s/])${d.replace(/^@[^/]+\//, '')}\\b`).test(scripts))
}

const PATH_LIKE = /^(\.{0,2}\/)?[\w@.-]+(\/[\w@.$[\]-]+)+\/?$|^[\w-]+\.(md|json|ts|tsx|js|mjs|jsonc|toml|ya?ml|sql|css)$/

// `scripts`: os nomes dos scripts de todas as partes ("npm run dev" pode ser o de frontend/).
function instructionRules(root, doc, scripts, c) {
  const text = read(root, doc)
  if (!text) return
  const missing = new Set()
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1].replace(/:\d+(-\d+)?$/, '').replace(/[),.;]+$/, '')
    if (!PATH_LIKE.test(p) || /^https?:|[*<>{}]|\$\{/.test(p) || /^@[\w-]+\/[\w-]+$/.test(p)) continue
    const rel = p.replace(/^\.\//, '')
    if (!fs.existsSync(path.join(root, path.dirname(doc), rel)) && !fs.existsSync(path.join(root, rel))) missing.add(p)
  }
  if (missing.size) c.add('instrucoes/arquivo-inexistente', doc, null, { doc, list: [...missing].slice(0, 10).join(', ') })
  if (!scripts.size) return
  const builtin = new Set(['install', 'i', 'ci', 'test', 'start', 'init', 'add', 'remove', 'uninstall', 'update', 'exec', 'dlx', 'create', 'publish', 'link', 'audit', 'outdated', 'why', 'x'])
  const bad = new Set()
  for (const m of text.matchAll(/\b(?:npm run|pnpm(?: run)?|yarn(?: run)?|bun run)\s+([\w:.-]+)/g)) {
    const s = m[1]
    if (!scripts.has(s) && !builtin.has(s)) bad.add(s)
  }
  if (bad.size) c.add('instrucoes/script-inexistente', doc, null, { doc, list: [...bad].slice(0, 10).join(', ') })
}

// TODO/FIXME antigos: data pela autoria da linha no git (git blame), só nas linhas marcadas.
export function oldTodos(root, c) {
  const grep = spawnSync('git', ['grep', '-n', '-I', '-E', '(//|/\\*|\\*|#)\\s*(TODO|FIXME|HACK|XXX)\\b', '--', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs', '*.py', '*.dart', '*.php', '*.go', '*.java', '*.kt', '*.cs', '*.rs', '*.c', '*.h', '*.cpp', '*.cc', '*.hpp'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (grep.status !== 0) return
  const now = Date.now() / 1000
  for (const row of grep.stdout.split('\n').filter(Boolean).slice(0, 200)) {
    const m = row.match(/^(.+?):(\d+):/)
    if (!m || GENERATED.test(m[1])) continue
    const blame = spawnSync('git', ['blame', '--porcelain', '-L', `${m[2]},${m[2]}`, '--', m[1]], { cwd: root, encoding: 'utf8', windowsHide: true })
    const time = Number(blame.stdout?.match(/^author-time (\d+)/m)?.[1])
    if (!time) continue
    const days = Math.floor((now - time) / 86400)
    if (days < 90) continue
    const text = read(root, m[1]) ?? ''
    if (ignoreSet(text).ignored('limpeza/todo-antigo', Number(m[2]))) continue
    const key = `limpeza/todo-antigo|${m[1]}`
    const prev = c.hits.get(key)?.ctx?.days ?? 0
    c.add('limpeza/todo-antigo', m[1], Number(m[2]), { days: Math.max(days, prev) })
    c.hits.get(key).ctx = { days: Math.max(days, prev) }
  }
}

// Desempenho: só no código que vai para o ar (CLIs, scripts e ferramentas rodam uma vez, à mão).
const NOT_APP = /(^|\/)(bin|scripts?|tools?|cli|plugins?|bench(marks?)?|docs?|examples?|engine)\/|\.d\.ts$/
const MIGRATION_DIRS = ['supabase/migrations', 'migrations', 'db/migrations', 'prisma/migrations']

export function performanceRules(root, texts, c) {
  for (const [rel, text] of texts) {
    if (NOT_APP.test(rel) || TEST_PATH.test(rel)) continue
    for (const q of unboundedQueries(rel, text)) c.add('desempenho/consulta-sem-limite', rel, q.line, { table: q.table }, text)
    for (const q of queriesInLoops(rel, text)) c.add('desempenho/consulta-em-laco', rel, q.line, {}, text)
  }
  const migrations = []
  for (const dir of MIGRATION_DIRS) {
    let names
    try {
      names = fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => String(f).endsWith('.sql')).map(String).sort()
    } catch {
      continue
    }
    for (const f of names) migrations.push({ file: `${dir}/${f.split(path.sep).join('/')}`, sql: read(root, `${dir}/${f}`) })
  }
  for (const fk of foreignKeysWithoutIndex(migrations)) c.add('desempenho/fk-sem-indice', fk.file, fk.line, { table: fk.table, column: fk.column })
}
