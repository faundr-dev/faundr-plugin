// Checagem de segurança sem IA (seção Segurança do Faundr). Roda no computador do usuário:
// o código nunca sai daqui; para o painel vão só os achados, com a chave mascarada.
//
// Detectores:
// - secret:     chaves e senhas no código (regras do Betterleaks, MIT) + .env no git + variável pública com segredo
// - dependency: pacotes com falha conhecida (lockfile + API pública do OSV.dev; só nomes e versões saem daqui)
// - database:   migrations do Supabase (tabela sem RLS, política sempre verdadeira, bucket público…)
//
// Depois dos detectores, o filtro de ruído (arquivo de teste/exemplo, pacote só de desenvolvimento, falha sem
// correção) rebaixa ou suprime o achado, sempre dizendo o motivo, e a impressão digital (sem número de linha)
// deixa o mesmo problema com o mesmo S-n entre uma checagem e outra.
import { spawnSync } from 'node:child_process'
import { LANG_LOCKFILE } from './lockfiles-langs.mjs'
import { LANG_TECH, langDeps } from './stack-langs.mjs'
import { LOCKFILE } from './lockfiles.mjs'
import { allDeps } from './parts.mjs'
import { remoteDatabaseFindings } from './env-target.mjs'
import { t } from './i18n.mjs'
import { lower, hash, BINARY, LOCKFILES, projectFiles, readText, lineText, mask, TEST_PATH, EXAMPLE_PATH, DOC_PATH } from './security-base.mjs'
import { shownName, keyOf, provider, findSecrets, publicSecretValueFindings, scanSecrets } from './security-secrets.mjs'
import { scanDatabase } from './security-database.mjs'
import { scanDependencies } from './security-deps.mjs'
import { CODE_FILE, OTHER_CODE, SERVER_ROUTE, scanCode, maskSecretsIn } from './security-code.mjs'
import { HEADER_FILES, scanConfig } from './security-config.mjs'
export { projectFiles, mask } from './security-base.mjs'
export { maskPayload, findSecrets, publicSecretValueFindings, guardContent } from './security-secrets.mjs'
export { destructiveMigration, splitSql } from './security-database.mjs'
export { compareVersions, cvss3 } from './security-deps.mjs'

// ---- chaves no histórico do git --------------------------------------------------------------

/**
 * Procura chaves nas linhas adicionadas dos commits (até `maxCommits`, todas as branches).
 * Chave apagada do código continua no histórico: quem clonar o repositório ainda a encontra.
 * Cada chave aparece uma vez (no commit mais antigo em que entrou).
 */
export function scanHistory(root, { maxCommits = 3000 } = {}) {
  const r = spawnSync(
    'git',
    ['log', '--all', '-p', '--no-color', '--no-ext-diff', '--unified=0', '--reverse', `--max-count=${maxCommits}`, '--format=%x01%H%x09%ad', '--date=short'],
    { cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true },
  )
  if (r.status !== 0) throw new Error(`git log failed: ${(r.stderr || '').trim().slice(0, 200)}`)
  const current = new Set(projectFiles(root).files)
  const seen = new Map()
  let commit = null
  let date = null
  let file = null
  let added = []
  let commits = 0
  const flush = () => {
    if (!file || !added.length || BINARY.test(file) || LOCKFILES.test(file)) return (added = [])
    const text = added.join('\n')
    for (const s of findSecrets(text, file)) {
      if (s.confidence === 'low' || seen.has(s.secret)) continue
      seen.set(s.secret, { ...s, commit, date, file, line: lineText(text, s.index) })
    }
    added = []
  }
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('\x01')) {
      flush()
      ;[commit, date] = line.slice(1).split('\t')
      commits++
      file = null
    } else if (line.startsWith('+++ ')) {
      flush()
      file = line.startsWith('+++ b/') ? line.slice(6).trim() : null
    } else if (line.startsWith('+') && file) added.push(line.slice(1))
  }
  flush()

  const findings = []
  for (const [secret, s] of seen) {
    const p = provider(s.ruleId)
    const stillThere = current.has(s.file) && (readText(root, s.file) ?? '').includes(secret)
    const f = {
      source: 'history',
      rule_id: s.ruleId,
      severity: s.dangerous ? 'critical' : 'high',
      confidence: s.confidence,
      title: t(`${keyOf(p)} in the git history`, `${keyOf(p)} no histórico do git`),
      detail: t(
        `Commit ${s.commit.slice(0, 8)} (${s.date}) added to ${s.file} what looks like a secret key: ${mask(secret)}. ${stillThere ? 'It is still in the file today.' : 'It was already deleted from the code, but it stays in the history.'}`,
        `O commit ${s.commit.slice(0, 8)} (${s.date}) adicionou em ${s.file} o que parece ser uma chave secreta: ${mask(secret)}. ${stillThere ? 'Ela ainda está no arquivo hoje.' : 'Ela já foi apagada do código, mas continua no histórico.'}`,
      ),
      impact: t(
        'Anyone who has or gets a copy of the repository (partner, former collaborator, a repository made public by mistake, a GitHub leak) finds the key in the history, even after it was deleted from the code.',
        'Quem tiver ou conseguir uma cópia do repositório (sócio, ex-colaborador, repositório público por engano, vazamento do GitHub) encontra a chave no histórico, mesmo depois de apagada do código.',
      ),
      fix: t(
        `1. Replace the key on ${shownName(p)}${p.url ? ` (${p.url})` : ''}: it is the only step that truly fixes it. ` +
          '2. Take the key out of the code (if it is still there) and use .env. ' +
          '3. Optional, and only if the repository is shared: rewriting the history (git filter-repo or BFG) removes the key from the commits, but changes every commit and requires everyone to clone again. Do it only with guidance.',
        `1. Troque a chave no ${shownName(p)}${p.url ? ` (${p.url})` : ''}: é o único passo que resolve de verdade. ` +
          '2. Tire a chave do código (se ainda estiver lá) e use o .env. ' +
          '3. Opcional, e só se o repositório for compartilhado: reescrever o histórico (git filter-repo ou BFG) apaga a chave dos commits, mas muda todos os commits e exige que todo mundo clone de novo. Faça isso só com orientação.',
      ),
      file: s.file,
      line: null,
      snippet: maskSecretsIn(s.line.trim()).slice(0, 240),
      fingerprint: `history|${s.ruleId}|${hash(secret)}`,
    }
    findings.push(TEST_PATH.test(s.file) || EXAMPLE_PATH.test(s.file) ? { ...f, severity: 'low' } : f)
  }
  return { findings, commits }
}

// ---- mapa do projeto para a revisão com IA ---------------------------------------------------

const STACK_SIGNS = [
  ['Next.js', (d) => d.next],
  ['React', (d) => d.react],
  ['Vite', (d) => d.vite],
  ['TanStack Start', (d) => d['@tanstack/react-start'] || d['@tanstack/start']],
  ['Remix / React Router', (d) => d['@remix-run/node'] || d['@react-router/node']],
  ['SvelteKit', (d) => d['@sveltejs/kit']],
  ['Nuxt / Vue', (d) => d.nuxt || d.vue],
  ['Express', (d) => d.express],
  ['Hono', (d) => d.hono],
  ['Fastify', (d) => d.fastify],
  ['FastAPI', (d) => d.fastapi],
  ['Django', (d) => d.django],
  ['Flask', (d) => d.flask],
  ['Supabase', (d, f) => d['@supabase/supabase-js'] || d['@supabase/ssr'] || d.supabase || f.some((x) => x.startsWith('supabase/'))],
  ['Firebase', (d, f) => d.firebase || d['firebase-admin'] || f.some((x) => /(^|\/)(firebase\.json|firestore\.rules)$/.test(x))],
  ['Stripe', (d) => d.stripe || d['@stripe/stripe-js']],
  ['Prisma', (d) => d.prisma || d['@prisma/client']],
  ['Drizzle', (d) => d['drizzle-orm']],
  ['Cloudflare Workers', (d, f) => d.wrangler || f.some((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x))],
  ['AI / LLM', (d) => d.openai || d['@anthropic-ai/sdk'] || d.ai || d['@ai-sdk/openai'] || d.langchain || d['@langchain/core'] || d['@google/generative-ai'] || d.anthropic],
  ['Auth.js / NextAuth', (d) => d['next-auth'] || d['@auth/core']],
  ['Clerk', (d) => d['@clerk/nextjs'] || d['@clerk/clerk-react']],
]

// Pacotes Python citados em requirements*.txt e pyproject.toml (só os nomes, em minúsculas).
function pythonDeps(root, files) {
  const out = {}
  for (const f of files.filter((x) => /(^|\/)(requirements[\w.-]*\.txt|pyproject\.toml)$/.test(x)).slice(0, 20)) {
    const text = readText(root, f) ?? ''
    // pyproject: os nomes entre aspas das listas de dependências ("fastapi>=0.110"); requirements: o começo da linha.
    const names = f.endsWith('.toml') ? [...text.matchAll(/["']([A-Za-z][\w.-]*)\s*(?:[<>=~!\[;]|["'])/g)] : [...text.matchAll(/^\s*([A-Za-z][\w.-]*)/gm)]
    for (const m of names) out[m[1].toLowerCase().replace(/_/g, '-')] = true
  }
  return out
}

// Temas do catálogo (plugin/skills/security/catalog/<tema>.md) e quando cada um vale.
const CI_FILE = /^\.github\/workflows\/.+\.ya?ml$|(^|\/)\.gitlab-ci\.ya?ml$|^\.circleci\/|(^|\/)bitbucket-pipelines\.yml$|(^|\/)azure-pipelines\.ya?ml$/
// Plugin ou integração de agente: hooks, MCP, skills e plugins do Claude Code/Codex.
const AGENT_FILE = /(^|\/)(hooks\/hooks\.json|\.mcp\.json|mcp\.json|\.claude-plugin\/plugin\.json|\.codex-plugin\/plugin\.json|SKILL\.md)$/
const PACKAGE_MANIFEST = /(^|\/)(package\.json|requirements[\w.-]*\.txt|pyproject\.toml|composer\.json|go\.mod|Cargo\.toml|Gemfile|pom\.xml|build\.gradle(\.kts)?|pubspec\.yaml)$/

// Tema do catálogo e quando ler: pela stack detectada ou pelos arquivos do projeto.
const TOPICS = [
  ['access-and-idor', () => true],
  ['authentication', () => true],
  ['input-and-injection', () => true],
  ['api-and-abuse', () => true],
  ['business-logic', () => true],
  ['data-exposure', () => true],
  ['data-lifecycle', () => true],
  ['least-privilege', () => true],
  ['logging-and-monitoring', () => true],
  // Extensão de navegador (manifest.json) e SDK servido para sites também são "navegador", mesmo sem telas.
  ['browser', (_, files) => files.some((f) => /\.(jsx|tsx|vue|svelte|astro|html)$/.test(f) || /(^|\/)manifest\.json$/.test(f))],
  ['ci-and-dependencies', (_, files) => files.some((f) => CI_FILE.test(f) || PACKAGE_MANIFEST.test(f) || /(^|\/)scripts\/(publish|release|deploy)[^/]*$/.test(f))],
  ['supabase', (s) => s.includes('Supabase')],
  ['nextjs', (s) => s.includes('Next.js')],
  ['firebase', (s) => s.includes('Firebase')],
  // Plugin de agente (hooks, MCP) põe texto no contexto de uma IA mesmo sem SDK de LLM: injeção de prompt vale.
  ['ai-and-llm', (s, files) => s.includes('AI / LLM') || files.some((f) => AGENT_FILE.test(f))],
  ['php-laravel', (s) => s.includes('PHP') || s.includes('Laravel') || s.includes('Symfony')],
  ['python-web', (s) => s.includes('Django') || s.includes('Flask') || s.includes('FastAPI')],
  ['flutter', (s) => s.includes('Flutter') || s.includes('Dart')],
  ['go', (s) => s.includes('Go')],
  ['java-spring', (s) => s.includes('Java') || s.includes('Kotlin')],
  ['dotnet', (s) => s.includes('C#')],
  ['rust', (s) => s.includes('Rust')],
  ['c-cpp', (s) => s.includes('C') || s.includes('C++')],
]

/** O que a revisão com IA precisa saber para começar: stack, onde estão as portas de entrada e que temas ler. */
export function projectMap(root) {
  const { files } = projectFiles(root)
  const deps = { ...pythonDeps(root, files), ...allDeps(root) }
  const langFrameworks = [...langDeps(root, files).keys()].map((k) => LANG_TECH[k]).filter((t) => t?.[1] === 'framework').map((t) => t[0])
  // Linguagem sem framework conhecido também puxa o tema dela (PHP puro, Dart, Go, Rust, C/C++…).
  const langs = [
    ['PHP', /\.php$/],
    ['Dart', /\.dart$/],
    ['Go', /\.go$/],
    ['Java', /\.java$/],
    ['Kotlin', /\.kts?$/],
    ['C#', /\.cs$/],
    ['Rust', /\.rs$/],
    ['C', /\.c$/],
    ['C++', /\.(cc|cpp|cxx|hpp|hh|hxx)$/],
  ].filter(([, re]) => files.some((f) => re.test(f))).map(([name]) => name)
  const stack = [...new Set([...STACK_SIGNS.filter(([, test]) => test(deps, files)).map(([name]) => name), ...langFrameworks, ...langs])]
  const other = files.filter((f) => OTHER_CODE.test(f) && !TEST_PATH.test(f))
  const code = files.filter((f) => CODE_FILE.test(f) && !TEST_PATH.test(f) && !/\.d\.ts$/.test(f))
  const pick = (re) => code.filter((f) => re.test(f)).slice(0, 60)
  return {
    stack,
    topics: TOPICS.filter(([, when]) => when(stack, files)).map(([t]) => t),
    entry: {
      'Server routes and functions': code.filter((f) => SERVER_ROUTE.test(f)).slice(0, 80),
      'Server actions / server functions': code.filter((f) => /^\s*['"]use server['"]|createServerFn\(/m.test(readText(root, f) ?? '')).slice(0, 40),
      'Middleware and route protection': pick(/(^|\/)(middleware|proxy)\.[mc]?[jt]s$|auth[^/]*\.(t|j)sx?$|guard/i),
      'Routes, controllers and handlers in other languages': other.filter((f) => /(controller|handler|route|router|endpoint|api|server|middleware|auth|main)[^/]*\.\w+$|\/(controllers?|handlers?|routes?|api|endpoints?)\//i.test(f)).slice(0, 80),
      'Migrations and database rules': files.filter((f) => /(^|\/)supabase\/.*\.sql$|\.rules$|database\.rules\.json$|prisma\/schema\.prisma$|drizzle\/.*\.(sql|ts)$|(^|\/)(migrations?|db\/migrate)\/.*\.(sql|php|rb|py|go|cs|java|kt)$/i.test(f)).slice(0, 60),
      'CI and automation': files.filter((f) => CI_FILE.test(f)).slice(0, 30),
      'Containers and server': files.filter((f) => /(^|\/)(Dockerfile[\w.-]*|(docker-)?compose\.ya?ml|nginx\.conf|Caddyfile)$|(^|\/)(k8s|kubernetes|helm)\/.*\.ya?ml$/i.test(f)).slice(0, 30),
      Configuration: files.filter((f) => HEADER_FILES.test(f) || /(^|\/)(\.env\.example|firebase\.json)$/.test(f)).slice(0, 30),
    },
  }
}

// ---- filtro de ruído e checagem completa -----------------------------------------------------

/** Rebaixa ou suprime (sem esconder) o que quase sempre é ruído, dizendo o motivo. */
export function applyNoiseRules(f) {
  const adjust = (severity, reason, suppressed = false) => ({
    ...f,
    severity_original: f.severity,
    severity,
    adjust_reason: reason,
    suppressed: f.suppressed || suppressed,
  })
  if (f.source === 'history' && f.severity === 'low')
    return { ...f, severity_original: 'high', adjust_reason: t('test or example file', 'arquivo de teste ou exemplo'), suppressed: true }
  if (f.source === 'secret' && f.file) {
    if (EXAMPLE_PATH.test(f.file)) return adjust('low', t('example file', 'arquivo de exemplo'), true)
    if (TEST_PATH.test(f.file)) return adjust('low', t('test file', 'arquivo de teste'), true)
    if (DOC_PATH.test(f.file))
      return adjust('low', t('documentation: it may be just an example; if it is a real key, replace it', 'documentação: pode ser só um exemplo; se for chave de verdade, troque-a'))
  }
  if (f.source === 'dependency' && !f.rule_id.startsWith('MAL-')) {
    if (f.dev) return adjust(lower(f.severity), t('only used during development: it does not go to the live site', 'só usado no desenvolvimento: não vai para o site publicado'), true)
    if (!f.fixed_in) return adjust(f.severity, t('there is no fixed version yet', 'ainda não existe versão corrigida'), true)
  }
  return { ...f, severity_original: f.severity, adjust_reason: null, suppressed: false }
}

/**
 * Checagem completa (ou só de alguns arquivos). `scopes` diz ao servidor o que foi olhado, para que só
 * o que foi olhado e não apareceu mais conte como corrigido.
 */
export async function scanProject(root, { only = null, deps = true, history = false } = {}) {
  const started = Date.now()
  const { files: all, tracked } = projectFiles(root)
  const files = only ? all.filter((f) => only.includes(f)) : all
  const scopes = [
    { source: 'secret', files: only ? files : null },
    { source: 'code', files: only ? files : null },
  ]
  const findings = [...scanSecrets(root, files, { tracked, envDir: only ? null : root }), ...scanCode(root, files)]
  const stats = { files: files.length }
  const errors = []
  let snapshot = null

  // O que falta no projeto inteiro (limite de pedidos, cabeçalhos, regras do Firebase): na checagem completa
  // ou quando um arquivo que muda essa resposta foi editado.
  if (!only || files.some((f) => SERVER_ROUTE.test(f) || HEADER_FILES.test(f) || /(^|\/)(package\.json|firestore\.rules|storage\.rules|database\.rules\.json)$/.test(f))) {
    findings.push(...scanConfig(root, all))
    // O .env do computador apontando para o banco da nuvem (o dos usuários, muitas vezes).
    findings.push(...remoteDatabaseFindings(root))
    findings.push(...publicSecretValueFindings(root))
    scopes.push({ source: 'config', files: null })
  }

  if (!only || files.some((f) => /(^|\/)supabase\/.*\.sql$/i.test(f))) {
    const db = scanDatabase(root, all)
    findings.push(...db.findings)
    scopes.push({ source: 'database', files: null })
    stats.tables = db.tables
  }
  if (deps && (!only || files.some((f) => LOCKFILE.test(f) || LANG_LOCKFILE.test(f) || /(^|\/)package\.json$/.test(f)))) {
    try {
      const d = await scanDependencies(root, all)
      findings.push(...d.findings)
      scopes.push({ source: 'dependency', files: null })
      stats.packages = d.packages
      stats.lockfiles = d.lockfiles.length
      snapshot = d.snapshot
    } catch (err) {
      // Sem internet: os achados de pacotes da checagem anterior continuam valendo.
      errors.push(t(`packages: ${err.message}`, `pacotes: ${err.message}`))
    }
  }
  if (history && !only) {
    try {
      const h = scanHistory(root)
      findings.push(...h.findings)
      scopes.push({ source: 'history', files: null })
      stats.commits = h.commits
    } catch (err) {
      errors.push(t(`git history: ${err.message}`, `histórico do git: ${err.message}`))
    }
  }
  const unique = [...new Map(findings.map((f) => [f.fingerprint, f])).values()].map(applyNoiseRules)
  return { findings: unique, scopes, stats: { ...stats, ms: Date.now() - started }, errors, snapshot }
}
