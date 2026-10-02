// Detecção da Stack do projeto sem IA: lê os arquivos de configuração e de pacotes e diz onde o projeto
// roda (front, back, banco, arquivos, login, deploy), as linguagens, as tecnologias, os serviços externos,
// as variáveis de ambiente (só os NOMES — valores nunca são lidos para fora daqui) e os scripts.
// O agente revisa e explica depois (/faundr:stack). Formato: src/lib/stack.ts.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const SKIP = /(^|\/)(node_modules|\.git|\.faundr|dist|build|out|vendor|third_party|\.next|\.nuxt|\.svelte-kit|\.wrangler|\.vercel|\.output|coverage|__pycache__|\.venv|venv)(\/|$)/
const MAX_FILES = 6000
const MAX_BYTES = 400_000

// ---- linguagens ------------------------------------------------------------------------------------

const LANG = {
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python', go: 'Go', rs: 'Rust', rb: 'Ruby', php: 'PHP', java: 'Java', kt: 'Kotlin', kts: 'Kotlin',
  swift: 'Swift', dart: 'Dart', cs: 'C#', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++',
  ex: 'Elixir', exs: 'Elixir', scala: 'Scala', lua: 'Lua', r: 'R', jl: 'Julia', zig: 'Zig',
  vue: 'Vue', svelte: 'Svelte', astro: 'Astro',
  css: 'CSS', scss: 'SCSS', sass: 'SCSS', less: 'Less', html: 'HTML', htm: 'HTML',
  sql: 'SQL', sh: 'Shell', bash: 'Shell', ps1: 'PowerShell', graphql: 'GraphQL', gql: 'GraphQL',
  prisma: 'Prisma', sol: 'Solidity',
}
const GENERATED = /(\.min\.(js|css)$|\.gen\.(ts|js)$|\.d\.ts$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$)/

// ---- catálogo de pacotes (npm e Python) ------------------------------------------------------------
// tech: [nome, categoria] · svc: [nome, categoria, para quê]

const TECH = {
  next: ['Next.js', 'framework'], nuxt: ['Nuxt', 'framework'], '@sveltejs/kit': ['SvelteKit', 'framework'],
  '@remix-run/react': ['Remix', 'framework'], 'react-router': ['React Router', 'framework'], astro: ['Astro', 'framework'],
  '@tanstack/react-start': ['TanStack Start', 'framework'], '@tanstack/react-router': ['TanStack Router', 'framework'],
  react: ['React', 'framework'], vue: ['Vue', 'framework'], svelte: ['Svelte', 'framework'],
  '@angular/core': ['Angular', 'framework'], 'solid-js': ['Solid', 'framework'], preact: ['Preact', 'framework'],
  'react-native': ['React Native', 'framework'], expo: ['Expo', 'framework'], electron: ['Electron', 'framework'],
  express: ['Express', 'framework'], fastify: ['Fastify', 'framework'], hono: ['Hono', 'framework'],
  '@nestjs/core': ['NestJS', 'framework'], koa: ['Koa', 'framework'], '@trpc/server': ['tRPC', 'framework'],
  graphql: ['GraphQL', 'framework'], '@apollo/client': ['Apollo', 'dados'], '@apollo/server': ['Apollo Server', 'framework'],
  tailwindcss: ['Tailwind CSS', 'estilo'], 'styled-components': ['styled-components', 'estilo'], '@emotion/react': ['Emotion', 'estilo'],
  sass: ['Sass', 'estilo'], bootstrap: ['Bootstrap', 'estilo'], '@mui/material': ['Material UI', 'ui'], '@chakra-ui/react': ['Chakra UI', 'ui'],
  'lucide-react': ['Lucide (ícones)', 'ui'], 'framer-motion': ['Framer Motion', 'ui'], motion: ['Motion', 'ui'],
  'd3-force': ['D3', 'ui'], d3: ['D3', 'ui'], three: ['Three.js', 'ui'], 'react-force-graph-2d': ['React Force Graph', 'ui'],
  recharts: ['Recharts', 'ui'], 'chart.js': ['Chart.js', 'ui'],
  '@tanstack/react-query': ['TanStack Query', 'dados'], swr: ['SWR', 'dados'], zustand: ['Zustand', 'dados'],
  '@reduxjs/toolkit': ['Redux', 'dados'], jotai: ['Jotai', 'dados'], zod: ['Zod', 'dados'], axios: ['Axios', 'dados'],
  '@prisma/client': ['Prisma', 'dados'], prisma: ['Prisma', 'dados'], 'drizzle-orm': ['Drizzle', 'dados'],
  typeorm: ['TypeORM', 'dados'], sequelize: ['Sequelize', 'dados'], mongoose: ['Mongoose', 'dados'], kysely: ['Kysely', 'dados'],
  ai: ['Vercel AI SDK', 'outro'], langchain: ['LangChain', 'outro'],
  vite: ['Vite', 'build'], webpack: ['Webpack', 'build'], esbuild: ['esbuild', 'build'], turbo: ['Turborepo', 'build'],
  typescript: ['TypeScript', 'build'], wrangler: ['Wrangler (CLI da Cloudflare)', 'build'],
  vitest: ['Vitest', 'testes'], jest: ['Jest', 'testes'], '@playwright/test': ['Playwright', 'testes'], cypress: ['Cypress', 'testes'],
  '@testing-library/react': ['Testing Library', 'testes'], mocha: ['Mocha', 'testes'],
  eslint: ['ESLint', 'qualidade'], prettier: ['Prettier', 'qualidade'], '@biomejs/biome': ['Biome', 'qualidade'],
  husky: ['Husky', 'qualidade'], 'lint-staged': ['lint-staged', 'qualidade'],
  // Python
  django: ['Django', 'framework'], flask: ['Flask', 'framework'], fastapi: ['FastAPI', 'framework'], streamlit: ['Streamlit', 'framework'],
  sqlalchemy: ['SQLAlchemy', 'dados'], pydantic: ['Pydantic', 'dados'], celery: ['Celery', 'outro'], pandas: ['pandas', 'dados'],
  pytest: ['pytest', 'testes'], ruff: ['Ruff', 'qualidade'],
}
const TECH_PREFIX = [['@radix-ui/', 'Radix UI', 'ui'], ['@remix-run/', 'Remix', 'framework'], ['@tiptap/', 'Tiptap', 'ui']]

const SVC = {
  stripe: ['Stripe', 'pagamentos', 'cobrança e pagamentos'], '@stripe/stripe-js': ['Stripe', 'pagamentos', 'cobrança e pagamentos'],
  mercadopago: ['Mercado Pago', 'pagamentos', 'cobrança e pagamentos'], '@lemonsqueezy/lemonsqueezy.js': ['Lemon Squeezy', 'pagamentos', 'cobrança e pagamentos'],
  resend: ['Resend', 'email', 'envio de e-mails'], '@sendgrid/mail': ['SendGrid', 'email', 'envio de e-mails'],
  nodemailer: ['SMTP (Nodemailer)', 'email', 'envio de e-mails'], postmark: ['Postmark', 'email', 'envio de e-mails'],
  openai: ['OpenAI', 'ia', 'inteligência artificial'], '@anthropic-ai/sdk': ['Anthropic (Claude)', 'ia', 'inteligência artificial'],
  anthropic: ['Anthropic (Claude)', 'ia', 'inteligência artificial'], '@google/genai': ['Google Gemini', 'ia', 'inteligência artificial'],
  '@google/generative-ai': ['Google Gemini', 'ia', 'inteligência artificial'], replicate: ['Replicate', 'ia', 'inteligência artificial'],
  posthog: ['PostHog', 'analytics', 'métricas de uso'], 'posthog-js': ['PostHog', 'analytics', 'métricas de uso'],
  '@vercel/analytics': ['Vercel Analytics', 'analytics', 'métricas de uso'], mixpanel: ['Mixpanel', 'analytics', 'métricas de uso'],
  'mixpanel-browser': ['Mixpanel', 'analytics', 'métricas de uso'], '@amplitude/analytics-browser': ['Amplitude', 'analytics', 'métricas de uso'],
  twilio: ['Twilio', 'mensagens', 'SMS e WhatsApp'], '@slack/web-api': ['Slack', 'mensagens', 'mensagens no Slack'], pusher: ['Pusher', 'mensagens', 'tempo real'],
  '@aws-sdk/client-s3': ['AWS S3', 'armazenamento', 'guardar arquivos'], boto3: ['AWS', 'armazenamento', 'serviços da AWS'],
  cloudinary: ['Cloudinary', 'armazenamento', 'imagens e vídeos'], uploadthing: ['UploadThing', 'armazenamento', 'upload de arquivos'],
  'mapbox-gl': ['Mapbox', 'mapas', 'mapas'], '@googlemaps/js-api-loader': ['Google Maps', 'mapas', 'mapas'],
  algoliasearch: ['Algolia', 'outro', 'busca'], '@upstash/redis': ['Upstash Redis', 'armazenamento', 'cache'],
  '@clerk/nextjs': ['Clerk', 'auth', 'login de usuários'], '@clerk/clerk-react': ['Clerk', 'auth', 'login de usuários'],
  'next-auth': ['Auth.js', 'auth', 'login de usuários'], '@auth/core': ['Auth.js', 'auth', 'login de usuários'],
  'better-auth': ['Better Auth', 'auth', 'login de usuários'], '@auth0/auth0-react': ['Auth0', 'auth', 'login de usuários'],
}
const SVC_PREFIX = [['@sentry/', 'Sentry', 'monitoramento', 'erros do app publicado']]

// Prefixo da variável → serviço (para dizer de quem é cada chave).
const ENV_SERVICE = [
  [/^(VITE_|NEXT_PUBLIC_|PUBLIC_)?SUPABASE_/, 'Supabase'], [/STRIPE_/, 'Stripe'], [/^OPENAI_/, 'OpenAI'],
  [/^ANTHROPIC_/, 'Anthropic (Claude)'], [/^(GOOGLE_|GEMINI_)/, 'Google'], [/RESEND_/, 'Resend'], [/SENDGRID_/, 'SendGrid'],
  [/SENTRY_/, 'Sentry'], [/^(CLOUDFLARE_|CF_)/, 'Cloudflare'], [/^VERCEL_/, 'Vercel'], [/^(AWS_|S3_)/, 'AWS'],
  [/POSTHOG_/, 'PostHog'], [/CLERK_/, 'Clerk'], [/^TWILIO_/, 'Twilio'], [/^(GITHUB_|GH_)/, 'GitHub'],
  [/MERCADO_?PAGO/, 'Mercado Pago'], [/^(DATABASE_URL|POSTGRES_|PG)/, 'Banco de dados'], [/^REDIS_/, 'Redis'],
  [/^(SMTP_|MAIL_|EMAIL_)/, 'E-mail'], [/^SLACK_/, 'Slack'], [/^DISCORD_/, 'Discord'],
]
const PUBLIC_PREFIX = /^(VITE_|NEXT_PUBLIC_|PUBLIC_|NUXT_PUBLIC_|EXPO_PUBLIC_|REACT_APP_|GATSBY_)/
// Variáveis do próprio sistema/ferramenta: não são configuração do projeto.
const ENV_IGNORE = new Set([
  'NODE_ENV', 'CI', 'DEV', 'PROD', 'MODE', 'SSR', 'BASE_URL', 'HOME', 'PATH', 'PWD', 'USER', 'SHELL', 'TMPDIR', 'TEMP', 'TMP',
  'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'PORT', 'HOSTNAME', 'TZ', 'LANG', 'DEBUG', 'TERM', 'npm_package_version',
])

const SCRIPT_WHAT = {
  dev: 'roda o projeto no seu computador', start: 'inicia o projeto', build: 'gera a versão para publicar',
  preview: 'testa localmente a versão de publicação', deploy: 'publica o projeto', test: 'roda os testes',
  lint: 'confere o estilo do código', typecheck: 'confere os tipos do TypeScript', format: 'formata o código',
}

// ---- utilidades ------------------------------------------------------------------------------------

function listFiles(root) {
  const r = spawnSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
  let files = r.status === 0 ? r.stdout.split('\n').filter(Boolean) : walk(root, root)
  files = files.filter((f) => !SKIP.test(f) && fs.existsSync(path.join(root, f)))
  return files.slice(0, MAX_FILES * 2)
}
function walk(dir, root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    const rel = path.relative(root, abs).split(path.sep).join('/')
    if (SKIP.test(rel)) continue
    if (e.isDirectory()) walk(abs, root, out)
    else out.push(rel)
    if (out.length > MAX_FILES * 2) break
  }
  return out
}
const read = (root, rel) => {
  try {
    const st = fs.statSync(path.join(root, rel))
    return st.size > MAX_BYTES ? '' : fs.readFileSync(path.join(root, rel), 'utf8')
  } catch {
    return ''
  }
}
/** JSON com comentários e vírgulas sobrando (wrangler.jsonc, tsconfig). Respeita "//" dentro de strings. */
export function parseJsonc(text) {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      out += text.slice(i, j + 1)
      i = j
    } else if (c === '/' && text[i + 1] === '/') i = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i) - 1
    else if (c === '/' && text[i + 1] === '*') i = text.indexOf('*/', i + 2) === -1 ? text.length : text.indexOf('*/', i + 2) + 1
    else out += c
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
  } catch {
    return null
  }
}
const tomlValue = (text, key) => text.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, 'm'))?.[1]
const cleanVersion = (v) => String(v ?? '').replace(/^[\^~>=<\s]+/, '').split(/\s/)[0]

// ---- detecção --------------------------------------------------------------------------------------

export function detectStack(root) {
  const files = listFiles(root)
  const has = (re) => files.filter((f) => re.test(f))
  const stack = { version: 1, hosting: [], languages: [], runtime: [], tech: [], services: [], env: [], environments: [], scripts: [] }
  const hostingSeen = new Set()
  const envMap = new Map() // variáveis de ambiente: nome → { documented, files }
  const addHosting = (layer, provider, detail, evidence, url) => {
    const k = `${layer}|${provider}`
    if (hostingSeen.has(k)) return
    hostingSeen.add(k)
    stack.hosting.push({ layer, provider, ...(detail ? { detail } : {}), ...(url ? { url } : {}), evidence: evidence.filter(Boolean) })
  }

  // Linguagens: arquivos e linhas por linguagem (o que está no git, sem gerados).
  const langs = new Map()
  let counted = 0
  for (const f of files) {
    const lang = LANG[f.split('.').pop()?.toLowerCase() ?? '']
    if (!lang || GENERATED.test(f) || counted >= MAX_FILES) continue
    counted++
    const lines = read(root, f).split('\n').filter((l) => l.trim()).length
    const cur = langs.get(lang) ?? { files: 0, lines: 0 }
    langs.set(lang, { files: cur.files + 1, lines: cur.lines + lines })
  }
  const totalLines = [...langs.values()].reduce((s, l) => s + l.lines, 0) || 1
  stack.languages = [...langs]
    .map(([name, l]) => ({ name, files: l.files, lines: l.lines, percent: Math.round((l.lines / totalLines) * 1000) / 10 }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 30)

  // Pacotes: todos os package.json (monorepo) + Python.
  const deps = new Map() // nome → { version, file }
  for (const f of has(/(^|\/)package\.json$/).slice(0, 25)) {
    const pkg = parseJsonc(read(root, f)) ?? {}
    for (const [n, v] of Object.entries({ ...pkg.devDependencies, ...pkg.dependencies })) if (!deps.has(n)) deps.set(n, { version: cleanVersion(v), file: f })
  }
  for (const f of has(/(^|\/)(requirements[\w.-]*\.txt|pyproject\.toml|Pipfile)$/).slice(0, 10)) {
    for (const m of read(root, f).matchAll(/^\s*["']?([A-Za-z][\w.-]*)(?:\[[^\]]*\])?\s*(?:[=~<>!]=?\s*["']?([\w.]+))?/gm)) {
      const n = m[1].toLowerCase()
      if ((TECH[n] || SVC[n]) && !deps.has(n)) deps.set(n, { version: m[2] ?? '', file: f })
    }
  }
  const dep = (n) => deps.get(n)
  const techSeen = new Set()
  const svcSeen = new Map()
  for (const [n, d] of deps) {
    const t = TECH[n] ?? TECH_PREFIX.find(([p]) => n.startsWith(p))?.slice(1)
    if (t && !techSeen.has(t[0])) {
      techSeen.add(t[0])
      stack.tech.push({ name: t[0], category: t[1], ...(TECH[n] && d.version ? { version: d.version } : {}), evidence: [d.file] })
    }
    const s = SVC[n] ?? SVC_PREFIX.find(([p]) => n.startsWith(p))?.slice(1)
    if (s && !svcSeen.has(s[0])) {
      const svc = { name: s[0], category: s[1], purpose: s[2], env: [], evidence: [d.file] }
      svcSeen.set(s[0], svc)
      stack.services.push(svc)
    }
  }
  // Monorepo/linguagens que não usam npm.
  if (has(/(^|\/)go\.mod$/).length) {
    const f = has(/(^|\/)go\.mod$/)[0]
    const v = read(root, f).match(/^go\s+([\d.]+)/m)?.[1]
    if (v) stack.runtime.push({ name: 'Go', version: v, evidence: [f] })
  }
  if (has(/(^|\/)Gemfile$/).length && /['"]rails['"]/.test(read(root, has(/(^|\/)Gemfile$/)[0]))) stack.tech.push({ name: 'Ruby on Rails', category: 'framework', evidence: [has(/(^|\/)Gemfile$/)[0]] })
  if (has(/(^|\/)composer\.json$/).length && /laravel\/framework/.test(read(root, has(/(^|\/)composer\.json$/)[0]))) stack.tech.push({ name: 'Laravel', category: 'framework', evidence: [has(/(^|\/)composer\.json$/)[0]] })
  if (has(/(^|\/)pubspec\.yaml$/).length && /flutter:/.test(read(root, has(/(^|\/)pubspec\.yaml$/)[0]))) stack.tech.push({ name: 'Flutter', category: 'framework', evidence: [has(/(^|\/)pubspec\.yaml$/)[0]] })

  // Ambiente de execução: versão do Node/Python e gerenciador de pacotes.
  const rootPkg = parseJsonc(read(root, 'package.json')) ?? {}
  const nodeFile = ['.nvmrc', '.node-version'].find((f) => files.includes(f))
  const nodeV = nodeFile ? read(root, nodeFile).trim() : rootPkg.engines?.node ?? rootPkg.volta?.node
  if (nodeV) stack.runtime.push({ name: 'Node.js', version: cleanVersion(nodeV) || nodeV, evidence: [nodeFile ?? 'package.json'] })
  const pyFile = files.includes('.python-version') ? '.python-version' : null
  if (pyFile) stack.runtime.push({ name: 'Python', version: read(root, pyFile).trim(), evidence: [pyFile] })
  const manager = rootPkg.packageManager?.split('@')[0] ??
    (files.includes('pnpm-lock.yaml') ? 'pnpm' : files.includes('yarn.lock') ? 'yarn' : files.includes('bun.lock') || files.includes('bun.lockb') ? 'bun' : files.includes('package-lock.json') ? 'npm' : null)
  if (manager) {
    const lock = { pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock', bun: 'bun.lock', npm: 'package-lock.json' }[manager]
    stack.runtime.push({ name: 'Gerenciador de pacotes', version: manager, evidence: [rootPkg.packageManager ? 'package.json' : lock] })
  }

  // O que o projeto tem: tela (front) e/ou servidor (back).
  const fullStack = ['next', 'nuxt', '@sveltejs/kit', '@remix-run/node', '@remix-run/cloudflare', 'react-router', '@tanstack/react-start', 'astro'].find((n) => dep(n))
  const backFw = ['express', 'fastify', 'hono', '@nestjs/core', 'koa', 'django', 'flask', 'fastapi', '@apollo/server'].find((n) => dep(n))
  const frontFw = fullStack ?? ['react', 'vue', 'svelte', '@angular/core', 'solid-js', 'preact'].find((n) => dep(n))
  const fwName = (n) => TECH[n]?.[0] ?? n

  // Hospedagem: arquivos de configuração de cada provedor.
  const providers = []
  const wranglerFile = files.find((f) => /^wrangler\.(jsonc?|toml)$/.test(f)) ?? has(/(^|\/)wrangler\.(jsonc?|toml)$/)[0]
  if (wranglerFile) {
    const text = read(root, wranglerFile)
    const w = wranglerFile.endsWith('.toml') ? null : parseJsonc(text) ?? {}
    const isPages = w ? !!w.pages_build_output_dir : /pages_build_output_dir/.test(text)
    const name = w?.name ?? tomlValue(text, 'name')
    const provider = isPages ? 'Cloudflare Pages' : 'Cloudflare Workers'
    providers.push({ provider, file: wranglerFile, detail: name ? `projeto "${name}" na Cloudflare` : undefined })
    const crons = w?.triggers?.crons ?? (text.match(/crons\s*=\s*\[([^\]]*)\]/)?.[1]?.match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1))
    if (crons.length) addHosting('agendado', 'Cloudflare Cron Triggers', `tarefas automáticas: ${crons.join(', ')}`, [wranglerFile])
    for (const db of w?.d1_databases ?? []) addHosting('banco', 'Cloudflare D1', db.database_name ? `banco "${db.database_name}"` : undefined, [wranglerFile])
    for (const b of w?.r2_buckets ?? []) addHosting('arquivos', 'Cloudflare R2', b.bucket_name ? `bucket "${b.bucket_name}"` : undefined, [wranglerFile])
    if ((w?.kv_namespaces ?? []).length) addHosting('banco', 'Cloudflare KV', 'chave-valor (cache/configuração)', [wranglerFile])
    const routes = [...(w?.routes ?? []), ...(w?.route ? [w.route] : [])].map((r) => (typeof r === 'string' ? r : r.pattern)).filter(Boolean)
    if (routes.length) addHosting('dominio', 'Cloudflare', `endereços: ${routes.join(', ')}`, [wranglerFile])
    for (const env of Object.keys(w?.env ?? {})) stack.environments.push({ name: env, detail: `ambiente "${env}" no ${wranglerFile}` })
    for (const v of Object.keys(w?.vars ?? {})) addEnv(v, wranglerFile, true)
    for (const [k, v] of Object.entries(w?.vars ?? {}))
      if (typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) && /BASE_URL|SITE_URL|APP_URL|PUBLIC_URL/.test(k)) providers[providers.length - 1].url = v
  }
  const simple = [
    [/^(vercel\.json|\.vercel\/project\.json)$/, 'Vercel'], [/^netlify\.toml$/, 'Netlify'], [/^fly\.toml$/, 'Fly.io'],
    [/^render\.ya?ml$/, 'Render'], [/^railway\.(json|toml)$/, 'Railway'], [/^firebase\.json$/, 'Firebase Hosting'],
    [/^app\.ya?ml$/, 'Google App Engine'], [/^amplify\.ya?ml$/, 'AWS Amplify'], [/^serverless\.ya?ml$/, 'AWS Lambda (Serverless)'],
    [/^Procfile$/, 'Heroku'], [/^apphosting\.ya?ml$/, 'Firebase App Hosting'],
  ]
  for (const [re, provider] of simple) {
    const f = files.find((x) => re.test(x))
    if (!f) continue
    const text = read(root, f)
    const app = provider === 'Fly.io' ? tomlValue(text, 'app') : null
    const region = provider === 'Fly.io' ? tomlValue(text, 'primary_region') : null
    providers.push({ provider, file: f, detail: [app && `app "${app}"`, region && `região ${region}`].filter(Boolean).join(', ') || undefined })
  }
  if (!providers.length && dep('@cloudflare/vite-plugin')) providers.push({ provider: 'Cloudflare Workers', file: dep('@cloudflare/vite-plugin').file })
  if (!providers.length && files.includes('CNAME') && !rootPkg.dependencies) providers.push({ provider: 'GitHub Pages', file: 'CNAME' })
  const dockerFile = files.find((f) => /(^|\/)Dockerfile$/.test(f))
  if (!providers.length && dockerFile) providers.push({ provider: 'Docker (contêiner)', file: dockerFile, detail: 'roda em contêiner; o provedor não aparece nos arquivos' })

  const main = providers[0]
  if (main && frontFw)
    addHosting('front', main.provider, `telas feitas com ${fwName(frontFw)}${fullStack ? ' (o mesmo serviço também entrega o servidor)' : ''}${main.detail ? ` · ${main.detail}` : ''}`, [main.file, dep(frontFw)?.file], main.url)
  else if (main && !backFw) addHosting('front', main.provider, main.detail, [main.file], main.url)
  if (main && (fullStack || backFw)) addHosting('back', main.provider, `servidor${backFw ? ` em ${fwName(backFw)}` : fullStack ? ` do ${fwName(fullStack)} (rotas de API e páginas geradas no servidor)` : ''}`, [main.file, dep(backFw ?? fullStack)?.file], main.url)
  for (const p of providers.slice(1)) addHosting(p.provider.startsWith('Docker') ? 'outro' : 'front', p.provider, p.detail, [p.file])

  // Banco de dados, login e arquivos.
  const codeFiles = files.filter((f) => /\.(m?[jt]sx?|py|vue|svelte|astro)$/.test(f) && !GENERATED.test(f)).slice(0, MAX_FILES)
  const appFirst = [...codeFiles].sort((a, b) => Number(!/^(src|app|lib|pages|components)\//.test(a)) - Number(!/^(src|app|lib|pages|components)\//.test(b)))
  const grepCode = (re) => appFirst.find((f) => re.test(read(root, f)))
  const supa = dep('@supabase/supabase-js') ?? dep('supabase') ?? dep('@supabase/ssr')
  const supaDir = files.some((f) => f.startsWith('supabase/'))
  if (supa || supaDir) {
    const ev = [supa?.file, files.find((f) => f === 'supabase/config.toml') ?? files.find((f) => f.startsWith('supabase/migrations/'))]
    const migrations = files.filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f)).length
    addHosting('banco', 'Supabase', `Postgres gerenciado${migrations ? ` · ${migrations} migrações em supabase/migrations` : ''}`, ev)
    const authFile = grepCode(/\bauth\.(signIn\w*|signUp|getUser|getSession|onAuthStateChange)\(/)
    if (authFile) addHosting('auth', 'Supabase Auth', 'login dos usuários', [authFile])
    const storageFile = grepCode(/\.storage\s*\.from\(/)
    if (storageFile) addHosting('arquivos', 'Supabase Storage', 'arquivos enviados pelos usuários', [storageFile])
    if (files.some((f) => /^supabase\/functions\//.test(f))) addHosting('back', 'Supabase Edge Functions', 'funções de servidor em supabase/functions', ['supabase/functions'])
  }
  const prismaFile = has(/(^|\/)schema\.prisma$/)[0]
  if (prismaFile) {
    const provider = read(root, prismaFile).match(/datasource\s+\w+\s*\{[^}]*provider\s*=\s*"(\w+)"/)?.[1]
    if (provider) addHosting('banco', { postgresql: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite', mongodb: 'MongoDB', sqlserver: 'SQL Server', cockroachdb: 'CockroachDB' }[provider] ?? provider, 'via Prisma', [prismaFile])
  }
  const dbDeps = [
    ['@neondatabase/serverless', 'Neon (Postgres)'], ['@libsql/client', 'Turso (SQLite)'], ['@planetscale/database', 'PlanetScale (MySQL)'],
    ['pg', 'PostgreSQL'], ['postgres', 'PostgreSQL'], ['psycopg2', 'PostgreSQL'], ['psycopg2-binary', 'PostgreSQL'], ['mysql2', 'MySQL'],
    ['mongodb', 'MongoDB'], ['mongoose', 'MongoDB'], ['better-sqlite3', 'SQLite'], ['firebase-admin', 'Firebase Firestore'],
    ['redis', 'Redis'], ['ioredis', 'Redis'],
  ]
  for (const [n, name] of dbDeps)
    if (dep(n) && !(supa && name === 'PostgreSQL') && ![...hostingSeen].some((k) => k.startsWith('banco|') && k.includes(name.split(' ')[0])))
      addHosting('banco', name, name === 'Redis' ? 'cache / filas' : undefined, [dep(n).file])
  const compose = has(/(^|\/)(docker-)?compose\.ya?ml$/)[0]
  if (compose) {
    const text = read(root, compose)
    for (const [re, name] of [[/image:\s*["']?postgres/, 'PostgreSQL'], [/image:\s*["']?mysql/, 'MySQL'], [/image:\s*["']?mongo/, 'MongoDB'], [/image:\s*["']?redis/, 'Redis']])
      if (re.test(text) && !hostingSeen.has(`banco|${name}`)) addHosting('banco', name, 'roda em Docker (docker compose)', [compose])
  }
  for (const s of stack.services) if (s.category === 'auth') addHosting('auth', s.name, 'login dos usuários', s.evidence)
  for (const s of stack.services) if (s.category === 'armazenamento' && s.name !== 'Upstash Redis') addHosting('arquivos', s.name, s.purpose, s.evidence)

  // Deploy: como o código chega ao ar (CI e scripts).
  for (const f of has(/^\.github\/workflows\/.*\.ya?ml$/)) {
    const text = read(root, f)
    const target = /wrangler|cloudflare/i.test(text) ? 'Cloudflare' : /vercel/i.test(text) ? 'Vercel' : /netlify/i.test(text) ? 'Netlify' : /flyctl|fly deploy/i.test(text) ? 'Fly.io' : /firebase deploy/i.test(text) ? 'Firebase' : /gh-pages|deploy-pages/i.test(text) ? 'GitHub Pages' : null
    addHosting('deploy', 'GitHub Actions', target ? `publica na ${target} (${path.posix.basename(f)})` : `automação ${path.posix.basename(f)}${/\btest|vitest|jest|pytest/.test(text) ? ' (roda testes)' : ''}`, [f])
  }
  if (files.includes('.gitlab-ci.yml')) addHosting('deploy', 'GitLab CI', undefined, ['.gitlab-ci.yml'])
  const deployScript = Object.entries(rootPkg.scripts ?? {}).find(([k]) => /^deploy/.test(k))
  if (deployScript) addHosting('deploy', 'Manual (npm run ' + deployScript[0] + ')', deployScript[1], ['package.json'])

  // Variáveis de ambiente: só os nomes. Documentadas = estão num arquivo de exemplo (ou na config versionada).
  function addEnv(name, file, documented) {
    if (ENV_IGNORE.has(name) || !/^[A-Za-z_][A-Za-z0-9_]{1,99}$/.test(name)) return
    const cur = envMap.get(name) ?? { name, documented: false, files: [] }
    if (documented) cur.documented = true
    if (!cur.files.includes(file) && cur.files.length < 5) cur.files.push(file)
    envMap.set(name, cur)
  }
  const envNames = (text) => [...text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map((m) => m[1])
  const exampleFiles = files.filter((f) => /(^|\/)\.(env|dev\.vars)[\w.-]*\.(example|sample|template|dist)$|(^|\/)\.env\.(example|sample|template)$/.test(f))
  for (const f of exampleFiles) for (const n of envNames(read(root, f))) addEnv(n, f, true)
  // .env locais: lidos só para pegar os NOMES (o valor nunca sai desta função).
  for (const f of ['.env', '.env.local', '.env.development', '.env.production', '.dev.vars']) {
    if (!fs.existsSync(path.join(root, f))) continue
    for (const n of envNames(read(root, f))) addEnv(n, f, false)
  }
  const ENV_USE = /(?:process\.env\.|import\.meta\.env\.|Deno\.env\.get\(\s*['"]|os\.environ(?:\.get)?\(?\s*\[?\s*['"]|os\.getenv\(\s*['"]|process\.env\[\s*['"]|\benv\.)([A-Z][A-Z0-9_]{2,})/g
  for (const f of codeFiles) for (const m of read(root, f).matchAll(ENV_USE)) addEnv(m[1], f, false)
  stack.env = [...envMap.values()]
    .map((e) => ({ ...e, scope: PUBLIC_PREFIX.test(e.name) ? 'publica' : 'servidor', service: ENV_SERVICE.find(([re]) => re.test(e.name))?.[1] }))
    .sort((a, b) => (a.service ?? 'zz').localeCompare(b.service ?? 'zz') || a.name.localeCompare(b.name))
    .slice(0, 150)
  for (const e of stack.env) {
    if (!e.service) continue
    const svc = stack.services.find((s) => s.name === e.service || s.name.startsWith(e.service))
    if (svc && svc.env.length < 15) svc.env.push(e.name)
  }
  if (supa && !stack.services.some((s) => s.name === 'Supabase'))
    stack.services.unshift({ name: 'Supabase', category: 'outro', purpose: 'banco de dados e backend', env: stack.env.filter((e) => e.service === 'Supabase').map((e) => e.name), evidence: [supa.file] })

  // Scripts: como rodar, testar e publicar.
  for (const [name, command] of Object.entries(rootPkg.scripts ?? {}).slice(0, 40))
    stack.scripts.push({ name: `${manager === 'npm' || !manager ? 'npm run' : manager} ${name}`, command: String(command), ...(SCRIPT_WHAT[name] ? { what: SCRIPT_WHAT[name] } : {}) })
  const makefile = files.includes('Makefile') ? read(root, 'Makefile') : ''
  for (const m of makefile.matchAll(/^([a-zA-Z][\w-]*):(?!=)/gm)) if (stack.scripts.length < 40) stack.scripts.push({ name: `make ${m[1]}`, command: `make ${m[1]}` })

  return { stack, hash: stackHash(stack) }
}

/** Impressão digital do que importa (não muda a cada linha editada; muda com pacote, deploy, serviço, variável). */
export function stackHash(stack) {
  const key = {
    hosting: stack.hosting.map((h) => `${h.layer}:${h.provider}`).sort(),
    tech: stack.tech.map((t) => t.name).sort(),
    services: stack.services.map((s) => s.name).sort(),
    env: stack.env.map((e) => e.name).sort(),
    runtime: stack.runtime.map((r) => `${r.name}:${r.version}`).sort(),
    languages: stack.languages.slice(0, 5).map((l) => l.name),
  }
  return createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 16)
}
