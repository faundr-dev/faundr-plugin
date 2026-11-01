// Configuração do projeto: rate limit nas rotas, cabeçalhos de segurança, segredos no wrangler e
// regras do Firebase (parte de security.mjs).
import path from 'node:path'
import { allDeps, partWith, projectParts } from './parts.mjs'
import { t } from './i18n.mjs'
import { hash, readText, lineOf, TEST_PATH } from './security-base.mjs'
import { CODE_FILE, SERVER_ROUTE } from './security-code.mjs'

// ---- configuração do projeto (o que falta no projeto inteiro) -------------------------------

// Sinais de limite de pedidos EM USO (não basta a palavra aparecer num comentário ou texto).
const RATE_LIMIT_DEPS = /rate-?limit|ratelimit|limiter|throttl|slow-down|bottleneck/i
const RATE_LIMIT_CODE = /from\s+['"][^'"]*(rate-?limit|ratelimit|limiter|throttl)[^'"]*['"]|\b(rateLimit|rateLimiter|RateLimiter|Ratelimit|RATE_LIMITER|limiter)\s*[.(]|status\s*[:=]\s*429\b|\(\s*['"][^'"]*['"]\s*,\s*429\s*\)|new Response\([^)]*429/
export const HEADER_FILES = /(^|\/)(next\.config\.[mc]?[jt]s|vercel\.json|netlify\.toml|_headers|middleware\.[jt]s|wrangler\.(jsonc?|toml)|nginx\.conf|server\.[mc]?[jt]s|app\.[mc]?[jt]s|entry[-.]server\.[jt]sx?|__root\.tsx|root\.tsx|hooks\.server\.[jt]s|index\.html)$/i

function configFinding(ruleId, severity, file, extra) {
  return { source: 'config', rule_id: ruleId, severity, confidence: 'medium', file, line: null, snippet: null, fingerprint: `config|${ruleId}${extra?.key ? `|${extra.key}` : ''}`, ...extra }
}

// Limite de pedidos e de tamanho do corpo nas rotas do servidor.
function routeLimitFindings({ routes, code, files, deps, read }) {
  const out = []
  const serverCode = code.filter((f) => SERVER_ROUTE.test(f) || /(^|\/)(server|middleware|lib\/server|src\/server)(\/|\.)/i.test(f))
  const hasLimit =
    Object.keys(deps).some((d) => RATE_LIMIT_DEPS.test(d)) ||
    serverCode.some((f) => RATE_LIMIT_CODE.test(read(f))) ||
    files.filter((f) => /wrangler\.(jsonc?|toml)$/.test(f)).some((f) => /ratelimit/i.test(read(f)))
  if (!hasLimit)
    out.push(
      configFinding('no-rate-limit', 'high', routes[0], {
        title: t('No request limit (rate limit) on the server routes', 'Nenhum limite de pedidos (rate limit) nas rotas do servidor'),
        detail: t(
          `The project has ${routes.length} server route(s) (e.g. ${routes.slice(0, 4).join(', ')}) and none of them limits how many requests a person can make per minute.`,
          `O projeto tem ${routes.length} rota(s) de servidor (ex.: ${routes.slice(0, 4).join(', ')}) e nenhuma delas limita quantos pedidos uma pessoa pode fazer por minuto.`,
        ),
        impact: t('Someone can call the routes nonstop: try passwords and tokens in bulk, flood the database, send emails or burn through your AI and server account until the app goes down or the bill gets high.', 'Alguém pode chamar as rotas sem parar: tentar senhas e tokens em massa, encher o banco, disparar e-mails ou gastar a sua conta de IA e de servidor até derrubar o app ou gerar uma conta alta.'),
        fix: t('Limit per user/IP on sensitive routes (login, sign-up, sending email, AI, database writes). On Cloudflare: the Workers Rate Limiting binding; on Vercel/Node: @upstash/ratelimit or express-rate-limit. Answer 429 when the limit is passed.', 'Limite por usuário/IP nas rotas sensíveis (login, cadastro, envio de e-mail, IA, escrita no banco). Na Cloudflare: binding de Rate Limiting do Workers; na Vercel/Node: @upstash/ratelimit ou express-rate-limit. Responda 429 quando passar do limite.'),
        cwe: ['CWE-770'],
      }),
    )
  // Corpo do pedido lido inteiro sem limite de tamanho.
  const noBodyLimit = routes.filter((f) => /request\.(json|text|formData|arrayBuffer)\(\)|req\.(json|text)\(\)/.test(read(f)) && !/content-length|maxBody|bodyLimit|MAX_BYTES|MAX_BODY/i.test(read(f)))
  if (noBodyLimit.length && !deps.express)
    out.push(
      configFinding('no-body-size-limit', 'medium', noBodyLimit[0], {
        title: t(`Routes read the whole request with no size limit (${noBodyLimit.length})`, `Rotas leem o pedido inteiro sem limite de tamanho (${noBodyLimit.length})`),
        detail: t(
          `These routes read the request body without checking its size first: ${noBodyLimit.slice(0, 6).join(', ')}${noBodyLimit.length > 6 ? '…' : ''}.`,
          `Estas rotas leem o corpo do pedido sem conferir o tamanho antes: ${noBodyLimit.slice(0, 6).join(', ')}${noBodyLimit.length > 6 ? '…' : ''}.`,
        ),
        impact: t("A huge request can blow the server's memory or time limit and take the app down, or fill the database.", 'Um pedido gigante pode estourar a memória ou o tempo do servidor e derrubar o app, ou encher o banco.'),
        fix: t('Before reading the body, check the content-length header (e.g. above 1 MB answer 413) and also limit the size of the fields that go to the database.', 'Antes de ler o corpo, confira o cabeçalho content-length (ex.: acima de 1 MB responda 413) e limite também o tamanho dos campos que vão para o banco.'),
        cwe: ['CWE-400'],
      }),
    )
  return out
}

// Cabeçalhos de segurança do site (só quando o projeto tem um site).
function securityHeaderFindings({ root, parts, files, code, deps, read }) {
  const out = []
  const webDep = ['react', 'next', 'vue', 'svelte', '@sveltejs/kit', 'astro', 'nuxt', 'solid-js', 'vite'].find((d) => deps[d])
  if (!webDep) return out
  const sitePkg = [partWith(root, webDep, parts)?.dir, 'package.json'].filter(Boolean).join('/')
  const headerText = files.filter((f) => HEADER_FILES.test(f)).map(read).join('\n') + code.filter((f) => /middleware|headers|security/i.test(f)).map(read).join('\n')
  // O cabeçalho precisa estar sendo definido (nome seguido de valor), não só citado num texto.
  const sets = (name) => new RegExp(`(^|['"\\s])(${name})['"]?\\s*[:,=]\\s*['"]?[\\w'-]`, 'im')
  const missing = [
    [sets('Content-Security-Policy'), 'Content-Security-Policy (CSP)'],
    [sets('X-Frame-Options|frame-ancestors'), 'X-Frame-Options / frame-ancestors'],
    [sets('Strict-Transport-Security'), 'Strict-Transport-Security (HSTS)'],
    [sets('X-Content-Type-Options'), 'X-Content-Type-Options'],
  ].filter(([re]) => !re.test(headerText))
  if (missing.length >= 2)
    out.push(
      configFinding('missing-security-headers', 'medium', sitePkg, {
        title: t('Site security headers missing', 'Cabeçalhos de segurança do site ausentes'),
        detail: t(
          `I did not find these security headers in the site configuration: ${missing.map(([, n]) => n).join(', ')}.`,
          `Não encontrei estes cabeçalhos de segurança na configuração do site: ${missing.map(([, n]) => n).join(', ')}.`,
        ),
        impact: t('Without them, it is easier to exploit an XSS flaw, load your site hidden inside another one to trick clicks (clickjacking) or force a connection without HTTPS.', 'Sem eles, fica mais fácil explorar uma falha de XSS, abrir o seu site escondido dentro de outro para enganar cliques (clickjacking) ou forçar conexão sem HTTPS.'),
        fix: t('Send the headers on every response of the site (middleware, headers() in next.config, _headers on Cloudflare/Netlify or vercel.json). Start the CSP in "Report-Only" mode so nothing breaks.', 'Envie os cabeçalhos em todas as respostas do site (middleware, headers() do next.config, _headers da Cloudflare/Netlify ou vercel.json). Comece pela CSP em modo "Report-Only" para não quebrar nada.'),
        cwe: ['CWE-693'],
      }),
    )
  return out
}

// Segredo em "vars" do wrangler (vai em texto claro para o código e para o git).
function wranglerVarsFindings(files, read) {
  const out = []
  for (const f of files.filter((x) => /(^|\/)wrangler\.(jsonc?|toml)$/.test(x))) {
    const text = read(f)
    const vars = text.match(/"vars"\s*:\s*\{([^}]*)\}|\[vars\]([\s\S]*?)(\n\[|$)/)
    const names = [...(vars?.[1] ?? vars?.[2] ?? '').matchAll(/["']?([A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY)[A-Z0-9_]*)["']?\s*[:=]/g)].map((m) => m[1])
    if (names.length)
      out.push(
        configFinding('wrangler-secret-in-vars', 'high', f, {
          key: f,
          title: t(`Secret in "vars" of ${path.posix.basename(f)}`, `Segredo em "vars" do ${path.posix.basename(f)}`),
          detail: t(
            `The variables ${names.join(', ')} are in "vars", which sits as plain text in the file (and in git).`,
            `As variáveis ${names.join(', ')} estão em "vars", que fica em texto claro no arquivo (e no git).`,
          ),
          impact: t('Anyone with access to the repository sees the key.', 'Quem tiver acesso ao repositório vê a chave.'),
          fix: t(
            `Remove it from the file and register it with "wrangler secret put ${names[0]}". Replace the key with the provider, because it is already in the git history.`,
            `Remova do arquivo e cadastre com "wrangler secret put ${names[0]}". Troque a chave no provedor, porque ela já está no histórico do git.`,
          ),
          cwe: ['CWE-798'],
        }),
      )
  }

  return out
}

// Tipo de regra aberta do Firestore/Storage: liberada para todos, modo de teste (só data) ou qualquer logado escrevendo.
function firebaseRuleKind(cond, ops) {
  if (/^true$/.test(cond)) return 'open'
  if (/request\.time\s*<\s*timestamp\.date/.test(cond)) return 'testMode'
  if (/^request\.auth\s*!=\s*null$/.test(cond) && /write|create|update|delete/.test(ops)) return 'anyUser'
  return null
}

const FIREBASE_RULE_KINDS = {
  open: {
    id: 'firebase-rules-open',
    anyone: true,
    title: (ops) => t(`Firebase rule allows ${ops} for anyone`, `Regra do Firebase libera ${ops} para qualquer pessoa`),
    why: () => t('checks nothing', 'não confere nada'),
  },
  testMode: {
    id: 'firebase-rules-test-mode',
    anyone: true,
    title: () => t('Firebase rules in test mode', 'Regras do Firebase em modo de teste'),
    why: () => t('only checks a date (test mode)', 'só confere uma data (modo de teste)'),
  },
  anyUser: {
    id: 'firebase-rules-any-user',
    anyone: false,
    title: (ops) => t(`Firebase rule allows ${ops} for any logged-in user`, `Regra do Firebase libera ${ops} para qualquer usuário logado`),
    why: () => t('only checks that the person is logged in, not that the data is theirs', 'só confere se a pessoa está logada, não se o dado é dela'),
  },
}

// Regras do Firebase (Firestore e Storage) abertas.
function firebaseRulesFindings(files, read) {
  const out = []
  for (const f of files.filter((x) => /(^|\/)(firestore|storage)\.rules$/.test(x))) {
    const text = read(f)
    for (const m of text.matchAll(/allow\s+([\w, ]+?)\s*(?::\s*if\s+([^;]+))?;/g)) {
      const cond = (m[2] ?? 'true').trim()
      const ops = m[1]
      const kind = firebaseRuleKind(cond, ops)
      if (!kind) continue
      const k = FIREBASE_RULE_KINDS[kind]
      out.push({
        source: 'config',
        rule_id: k.id,
        severity: k.anyone ? 'critical' : 'high',
        confidence: 'high',
        title: k.title(ops),
        detail: t(`In ${f}, the rule "allow ${ops}${m[2] ? `: if ${cond}` : ''}" ${k.why()}.`, `Em ${f}, a regra "allow ${ops}${m[2] ? `: if ${cond}` : ''}" ${k.why()}.`),
        impact: k.anyone
          ? t('Anyone on the internet can read and change this data, without logging in.', 'Qualquer pessoa na internet pode ler e mudar esses dados, sem login.')
          : t("Anyone who creates an account can change or delete other users' data.", 'Qualquer pessoa que criar uma conta pode mudar ou apagar dados de outros usuários.'),
        fix: t(
          'Check the owner of the data in the rule, e.g.: allow read, write: if request.auth != null && request.auth.uid == resource.data.userId; and restrict per collection.',
          'Confira o dono do dado na regra, ex.: allow read, write: if request.auth != null && request.auth.uid == resource.data.userId; e restrinja por coleção.',
        ),
        file: f,
        line: lineOf(text, m.index),
        snippet: m[0].slice(0, 240),
        cwe: ['CWE-284'],
        fingerprint: `config|firebase-rules|${f}|${hash(m[0])}`,
      })
    }
  }
  return out
}

// Realtime Database com ".read"/".write": true.
function rtdbRulesFindings(files, read) {
  const out = []
  for (const f of files.filter((x) => /(^|\/)database\.rules\.json$/.test(x))) {
    const text = read(f)
    for (const m of text.matchAll(/"\.(read|write)"\s*:\s*(true|"true")/g))
      out.push({
        source: 'config',
        rule_id: 'firebase-rtdb-open',
        severity: 'critical',
        confidence: 'high',
        title: t(
          `Realtime Database allows ${m[1] === 'read' ? 'reading' : 'writing'} for anyone`,
          `Realtime Database libera ${m[1] === 'read' ? 'leitura' : 'escrita'} para qualquer pessoa`,
        ),
        detail: t(
          `In ${f}, ".${m[1]}": true does not check who is asking (and applies to everything below that point).`,
          `Em ${f}, ".${m[1]}": true não confere quem está pedindo (e vale para tudo abaixo desse ponto).`,
        ),
        impact: t(
          `Anyone on the internet can ${m[1] === 'read' ? 'read' : 'change and delete'} this data.`,
          `Qualquer pessoa na internet pode ${m[1] === 'read' ? 'ler' : 'alterar e apagar'} esses dados.`,
        ),
        fix: t(
          'Replace true with a condition that checks the owner, e.g.: "auth != null && auth.uid === $uid".',
          'Troque true por uma condição que confira o dono, ex.: "auth != null && auth.uid === $uid".',
        ),
        file: f,
        line: lineOf(text, m.index),
        snippet: m[0],
        cwe: ['CWE-284'],
        fingerprint: `config|firebase-rtdb|${f}|${hash(m[0] + lineOf(text, m.index))}`,
      })
  }
  return out
}

export function scanConfig(root, files) {
  const code = files.filter((f) => CODE_FILE.test(f) && !TEST_PATH.test(f) && !/\.d\.ts$/.test(f))
  const routes = code.filter((f) => SERVER_ROUTE.test(f))
  // Dependências da raiz e das partes (num projeto dividido, o React fica em frontend/package.json).
  const parts = projectParts(root)
  const deps = allDeps(root, parts)
  const texts = new Map()
  const read = (f) => {
    if (!texts.has(f)) texts.set(f, readText(root, f) ?? '')
    return texts.get(f)
  }
  return [
    // Limite de pedidos: nenhuma rota do servidor tem, nem o projeto usa biblioteca ou configuração para isso.
    ...(routes.length ? routeLimitFindings({ routes, code, files, deps, read }) : []),
    ...securityHeaderFindings({ root, parts, files, code, deps, read }),
    ...wranglerVarsFindings(files, read),
    ...firebaseRulesFindings(files, read),
    ...rtdbRulesFindings(files, read),
  ]
}
