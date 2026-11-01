// Regras por linha e por arquivo no código (JS/TS e, via security-langs.mjs, as outras linguagens),
// webhooks, pagamentos e Dockerfile (parte de security.mjs).
import { DOCKERFILE, LANG_LINE_RULES } from './security-langs.mjs'
import { t } from './i18n.mjs'
import { hash, readText, lineOf, lineText, mask, TEST_PATH } from './security-base.mjs'
import { findSecrets } from './security-secrets.mjs'

// ---- código (padrões perigosos, sem IA) -----------------------------------------------------

export const CODE_FILE = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro|py|php|dart|go|java|kt|kts|cs|cshtml|razor|rs|c|cc|cpp|cxx|h|hh|hpp|hxx|html?)$/i
// Código das linguagens sem regras de linha (o Claude lê na revisão).
export const OTHER_CODE = /\.(go|rs|java|kts?|cs|c|cc|cpp|cxx|h|hpp|rb|swift)$/i
export const SERVER_ROUTE = /(^|\/)(app\/(.*\/)?api\/.*\/?route\.[mc]?[jt]s|pages\/api\/.*\.[mc]?[jt]sx?|src\/routes\/api\/.*\.[mc]?[jt]sx?|supabase\/functions\/[^/]+\/index\.[jt]s|functions\/.*\.[jt]s|server\/.*\.[mc]?[jt]s|api\/.*\.[mc]?[jt]s)$/i

// Regras por linha: o que é quase sempre perigoso quando aparece com dado variável.
// Cada regra: padrão da linha, exceção (se a linha tiver isto, está ok) e o texto do achado.
// Onde as regras gerais (comando, SQL, eval, CORS) valem: Go, Java/Kotlin, C#, Rust e C/C++ têm as próprias em security-langs.mjs.
const GENERAL_RULE_FILES = /\.(m?[jt]sx?|cjs|cts|vue|svelte|astro|py|php|dart)$/i

const LINE_RULES = [
  {
    id: 'xss-dangerously-set-inner-html',
    re: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!['"`])/,
    ok: /sanitize|DOMPurify|purify|escape/i,
    severity: 'medium',
    cwe: 'CWE-79',
    title: ['HTML put on the screen without cleaning (dangerouslySetInnerHTML)', 'HTML inserido na tela sem limpar (dangerouslySetInnerHTML)'],
    detail: ['The component puts HTML straight into the page from a variable.', 'O componente coloca HTML direto na página a partir de uma variável.'],
    impact: ['If that content comes from a user (comment, name, text from the database, AI answer), someone can inject a script that runs in the browser of whoever opens the page and steal their session.', 'Se esse conteúdo vier de um usuário (comentário, nome, texto do banco, resposta de IA), alguém pode injetar um script que roda no navegador de quem abrir a página e roubar a sessão.'],
    fix: ['Avoid raw HTML: show it as text. If you need HTML (e.g. markdown), clean it first with DOMPurify.sanitize(html).', 'Evite HTML cru: mostre como texto. Se precisar de HTML (ex.: markdown), limpe antes com DOMPurify.sanitize(html).'],
  },
  {
    id: 'xss-inner-html',
    re: /\.(innerHTML|outerHTML)\s*[+]?=\s*(?!['"`]\s*[;)]?$)(?!['"][^'"]*['"]\s*;?\s*$)|document\.write\s*\(/,
    ok: /sanitize|DOMPurify|purify|escape|textContent/i,
    severity: 'medium',
    cwe: 'CWE-79',
    title: ['HTML built with innerHTML', 'HTML montado com innerHTML'],
    detail: ['The code writes HTML into the page with innerHTML/outerHTML/document.write from a variable.', 'O código escreve HTML na página com innerHTML/outerHTML/document.write a partir de uma variável.'],
    impact: ['If the value comes from a user or from outside, someone can inject a script that runs in the browser of whoever opens the page.', 'Se o valor vier de um usuário ou de fora, alguém pode injetar um script que roda no navegador de quem abrir a página.'],
    fix: ['Use textContent for text; if you need HTML, clean it first with DOMPurify.sanitize().', 'Use textContent para texto; se precisar de HTML, limpe antes com DOMPurify.sanitize().'],
  },
  {
    id: 'code-eval',
    files: GENERAL_RULE_FILES,
    re: /(?<![\w.])(eval|new\s+Function)\s*\(\s*(?!['"`][^'"`$]*['"`]\s*\))/,
    severity: 'high',
    cwe: 'CWE-95',
    title: ['Code run from text (eval / new Function)', 'Código executado a partir de texto (eval / new Function)'],
    detail: ['The code runs text as a program (eval or new Function) with a value that is not fixed.', 'O código executa um texto como programa (eval ou new Function) com um valor que não é fixo.'],
    impact: ['If that text can come from a user or from outside, whoever controls it runs whatever they want on the server or in the browser.', 'Se esse texto puder vir de um usuário ou de fora, quem controlar o texto executa o que quiser no servidor ou no navegador.'],
    fix: ['Replace eval with a safe alternative: JSON.parse for data, a map of allowed functions for actions.', 'Troque eval por uma alternativa segura: JSON.parse para dados, um mapa de funções permitidas para ações.'],
  },
  {
    id: 'command-injection',
    files: GENERAL_RULE_FILES,
    re: /\b(exec|execSync|spawn|spawnSync)\s*\(\s*(`[^`]*\$\{|['"][^'"]*['"]\s*\+|[a-zA-Z_$][\w$.]*\s*\+)/,
    ok: /shell\s*:\s*false/,
    severity: 'high',
    cwe: 'CWE-78',
    title: ['System command built from variable text', 'Comando do sistema montado com texto variável'],
    detail: ['An operating system command is built by joining text with a variable.', 'Um comando do sistema operacional é montado juntando texto com uma variável.'],
    impact: ['If the variable can come from a user, they can run any command on the server (delete files, steal keys).', 'Se a variável puder vir de um usuário, ele consegue rodar qualquer comando no servidor (apagar arquivos, roubar chaves).'],
    fix: ['Use execFile/spawn with a separate argument list (no shell) and check the value against a list of what is allowed.', 'Use execFile/spawn com a lista de argumentos separada (sem shell) e valide o valor contra uma lista do que é permitido.'],
  },
  {
    id: 'sql-injection',
    files: GENERAL_RULE_FILES,
    re: /\b(query|execute|raw|whereRaw|orderByRaw|\$queryRawUnsafe|\$executeRawUnsafe|unsafe)\s*\(\s*`[^`]*\b(select|insert|update|delete|where|order by)\b[^`]*\$\{/i,
    severity: 'high',
    cwe: 'CWE-89',
    title: ['SQL query built from variable text', 'Consulta SQL montada com texto variável'],
    detail: ['The SQL query is built by pasting a variable into the text (${...}).', 'A consulta SQL é montada colando uma variável dentro do texto (${...}).'],
    impact: ["If the variable comes from a user, they can change the query and read, change or delete other people's data (SQL injection).", 'Se a variável vier de um usuário, ele pode mudar a consulta e ler, alterar ou apagar dados de outras pessoas (SQL injection).'],
    fix: ["Use parameters: query(\"... where id = $1\", [id]) or the library's query builder (sql`...` with safely interpolated values, .eq(), where({ id })).", 'Use parâmetros: query("... where id = $1", [id]) ou o construtor de consultas da biblioteca (sql`...` com valores interpolados de forma segura, .eq(), where({ id })).'],
  },
  {
    id: 'cors-any-origin',
    files: GENERAL_RULE_FILES,
    re: /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]|\borigin\s*:\s*['"]\*['"]|\borigin\s*:\s*true\b/,
    severity: 'medium',
    cwe: 'CWE-942',
    title: ['CORS open to any site', 'CORS liberado para qualquer site'],
    detail: ['The API accepts requests from any site (Access-Control-Allow-Origin: * or a reflected origin).', 'A API aceita pedidos vindos de qualquer site (Access-Control-Allow-Origin: * ou origin refletida).'],
    impact: ["Any site can call this API through a logged-in person's browser; with cookies or credentials, it reads that person's data.", 'Qualquer site pode chamar esta API pelo navegador de quem está logado; com cookies ou credenciais, ele lê dados da pessoa.'],
    fix: ["List only your app's domains in origin (e.g. origin: [\"https://myapp.com\"]). Never combine \"*\" with credentials: true.", 'Liste só os domínios do seu app em origin (ex.: origin: ["https://meuapp.com"]). Nunca combine "*" com credentials: true.'],
  },
  {
    id: 'jwt-decode-without-verify',
    // Só JS/TS: no Python, o jwt.decode do PyJWT confere a assinatura (a regra de lá é python-jwt-without-verify).
    files: /\.(m?[jt]sx?|c[jt]s|vue|svelte|astro)$/i,
    re: /\bjwt\.decode\s*\(|\bjwtDecode\s*\(|\bdecodeJwt\s*\(/,
    fileOk: /jwt\.verify|jwtVerify|verifyIdToken|getUser\(|getClaims\(/,
    severity: 'medium',
    cwe: 'CWE-347',
    title: ['Token read without checking the signature', 'Token lido sem conferir a assinatura'],
    detail: ['The code reads the content of a JWT token (decode) and the file never checks the signature (verify).', 'O código lê o conteúdo de um token JWT (decode) e o arquivo não confere a assinatura em nenhum lugar (verify).'],
    impact: ['If access decisions use that content, anyone can forge a token claiming to be another user or an admin.', 'Se a decisão de acesso usar esse conteúdo, qualquer pessoa monta um token falso dizendo ser outro usuário ou admin.'],
    fix: ['Check the signature with jwt.verify / jose.jwtVerify (or supabase.auth.getUser()) before trusting what the token says.', 'Confira a assinatura com jwt.verify / jose.jwtVerify (ou supabase.auth.getUser()) antes de confiar no que o token diz.'],
  },
  {
    id: 'open-redirect',
    re: /\b(redirect|NextResponse\.redirect|res\.redirect|location\.href\s*=|window\.location\s*=)\s*\(?[^;\n]*(searchParams\.get|req\.query|query\.|params\.(next|redirect|url|return))/i,
    ok: /startsWith\(['"]\/['"]\)|allowed|whitelist|allowlist|new URL\([^)]*origin/i,
    severity: 'medium',
    cwe: 'CWE-601',
    title: ['Redirect to an address taken from the URL', 'Redirecionamento para endereço vindo da URL'],
    detail: ['The app redirects to an address that comes from a URL parameter (e.g. ?next=...).', 'O app redireciona para um endereço que vem de um parâmetro da URL (ex.: ?next=...).'],
    impact: ["Someone sends a link to your site that takes the victim to a fake site (phishing), borrowing your domain's trustworthy look.", 'Alguém manda um link do seu site que leva a vítima para um site falso (phishing), com a cara de confiável do seu domínio.'],
    fix: ['Accept only internal paths (starting with "/" and not "//") or a list of allowed destinations.', 'Só aceite caminhos internos (começando com "/" e não com "//") ou uma lista de destinos permitidos.'],
  },
  {
    id: 'tls-verification-disabled',
    re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|rejectUnauthorized\s*:\s*false|verify\s*=\s*False/,
    severity: 'medium',
    cwe: 'CWE-295',
    title: ['HTTPS certificate check turned off', 'Conferência de certificado HTTPS desligada'],
    detail: ['The code turns off the HTTPS certificate check on connections.', 'O código desliga a conferência do certificado HTTPS nas conexões.'],
    impact: ['Someone in the middle (public Wi-Fi, a compromised network) can pose as the server and read or change the data, keys included.', 'Alguém no meio do caminho (Wi-Fi público, rede comprometida) pode se passar pelo servidor e ler ou alterar os dados, inclusive chaves.'],
    fix: ['Remove this option. If it is your own certificate, provide the certificate authority (ca) instead of turning off the check.', 'Remova essa opção. Se for um certificado próprio, informe a autoridade certificadora (ca) em vez de desligar a conferência.'],
  },
  {
    id: 'python-shell-true',
    re: /subprocess\.\w+\([^)]*shell\s*=\s*True/,
    severity: 'high',
    cwe: 'CWE-78',
    title: ['System command with shell=True', 'Comando do sistema com shell=True'],
    detail: ['subprocess runs the command through the shell.', 'O subprocess roda o comando através do shell.'],
    impact: ['If part of the command comes from a user, they can run any command on the server.', 'Se parte do comando vier de um usuário, ele consegue rodar qualquer comando no servidor.'],
    fix: ['Pass the command as a list of arguments, without shell=True.', 'Passe o comando como lista de argumentos, sem shell=True.'],
  },
  {
    id: 'python-unsafe-deserialization',
    re: /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*SafeLoader)/,
    severity: 'high',
    cwe: 'CWE-502',
    title: ['Unsafe data loading (pickle / yaml.load)', 'Leitura insegura de dados (pickle / yaml.load)'],
    detail: ['The code turns data into objects with pickle or yaml.load without the safe loader.', 'O código transforma dados em objetos com pickle ou yaml.load sem o carregador seguro.'],
    impact: ['If the data comes from outside, whoever controls it runs code on the server.', 'Se os dados vierem de fora, quem os controla executa código no servidor.'],
    fix: ['Use json for outside data; for YAML, yaml.safe_load().', 'Use json para dados de fora; para YAML, yaml.safe_load().'],
  },
]
// As regras de PHP, Dart e Python moram em security-langs.mjs.
const ALL_LINE_RULES = [...LINE_RULES, ...LANG_LINE_RULES]

// Webhooks do Stripe: assinatura não conferida, conferida com o corpo já convertido, pagamento sem idempotência.
function webhookRules(rel, text, isRoute) {
  const out = []
  // Webhook do Stripe sem conferir a assinatura.
  if (isRoute && /stripe/i.test(text) && /webhook|stripe-signature/i.test(rel + text) && /(checkout\.session|payment_intent|invoice\.|customer\.subscription|event\.type)/.test(text) && !/constructEvent(Async)?\s*\(/.test(text))
    out.push({
      rule_id: 'stripe-webhook-without-signature',
      severity: 'high',
      cwe: 'CWE-345',
      index: text.search(/event\.type|checkout\.session|payment_intent/),
      title: t('Stripe webhook without checking the signature', 'Webhook do Stripe sem conferir a assinatura'),
      detail: t('The route handles Stripe events (payment, subscription) but does not call stripe.webhooks.constructEvent to check that the notice really came from Stripe.', 'A rota trata eventos do Stripe (pagamento, assinatura) mas não chama stripe.webhooks.constructEvent para conferir que o aviso veio mesmo do Stripe.'),
      impact: t('Anyone can call this route pretending to be Stripe and mark a payment as done, unlock a plan or credits without paying.', 'Qualquer pessoa pode chamar essa rota fingindo ser o Stripe e marcar um pagamento como feito, liberar um plano ou créditos sem pagar.'),
      fix: t('Read the raw body (await request.text()) and use stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET) before handling the event.', 'Leia o corpo cru (await request.text()) e use stripe.webhooks.constructEvent(corpo, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET) antes de tratar o evento.'),
    })
  const verifies = /constructEvent(Async)?\s*\(/.test(text)
  // Webhook que confere a assinatura com o corpo já transformado em objeto: a conferência falha sempre (e alguém
  // "conserta" desligando) ou só passa porque o corpo foi remontado.
  if (isRoute && verifies && (/constructEvent(Async)?\(\s*JSON\.stringify/.test(text) || /(req|request|c\.req)\.json\(\)/.test(text.slice(0, text.search(/constructEvent/)))))
    out.push({
      rule_id: 'stripe-webhook-parsed-body',
      severity: 'medium',
      cwe: 'CWE-345',
      index: text.search(/constructEvent/),
      title: t('Stripe webhook checks the signature against an already parsed body', 'Webhook do Stripe confere a assinatura com o corpo já convertido'),
      detail: t("Stripe's signature covers the raw request body, byte for byte. Here the body is read as JSON (or rebuilt with JSON.stringify) before the check.", 'A assinatura do Stripe vale para o corpo cru do pedido, byte a byte. Aqui o corpo é lido como JSON (ou remontado com JSON.stringify) antes da conferência.'),
      impact: t('The check fails with real payments (and the temptation is to turn it off) or passes by luck; either way the webhook is fragile.', 'A conferência falha com pagamentos de verdade (e a tentação é desligá-la) ou passa por acaso; nos dois casos o webhook fica frágil.'),
      fix: t('Read the raw body (await request.text(), or express.raw({ type: "application/json" }) on that route only) and pass that text to constructEvent; parse it into an object afterwards.', 'Leia o corpo cru (await request.text(), ou express.raw({ type: "application/json" }) só nessa rota) e passe esse texto para constructEvent; transforme em objeto depois.'),
    })
  // Webhook de pagamento que não guarda o id do evento: o Stripe reenvia avisos e cada reenvio libera de novo.
  if (isRoute && verifies && /checkout\.session\.completed|payment_intent\.succeeded|invoice\.(paid|payment_succeeded)/.test(text) && !/\b(event|evt)\.id\b|idempot|processed_events|webhook_events|onConflict|on conflict|upsert/i.test(text))
    out.push({
      rule_id: 'payment-webhook-not-idempotent',
      severity: 'medium',
      cwe: 'CWE-841',
      index: text.search(/checkout\.session\.completed|payment_intent\.succeeded|invoice\./),
      title: t('Payment webhook may grant twice', 'Webhook de pagamento pode liberar duas vezes'),
      detail: t('The route handles the confirmed payment, but does not store the event id or write in a way that makes a repeat harmless.', 'A rota trata o pagamento confirmado, mas não guarda o id do evento nem grava de forma que repetir não mude nada.'),
      impact: t('Stripe resends the same notice when the response is slow or fails: the customer gets credits, emails or orders twice.', 'O Stripe reenvia o mesmo aviso quando a resposta demora ou falha: o cliente ganha créditos, e-mails ou pedidos em dobro.'),
      fix: t('Store event.id in a table with a unique key and stop if it already exists; or write with an upsert on the payment id, so a repeat has no effect.', 'Guarde event.id numa tabela com chave única e pare se já existir; ou grave com upsert pelo id do pagamento, para repetir não ter efeito.'),
    })
  return out
}

// Pagamento: valor vindo do navegador, produto liberado na página de obrigado e chave de admin no navegador.
function paymentRules(rel, text, isRoute) {
  const out = []
  // Preço ou valor vindo do navegador na criação da cobrança.
  const clientAmount = text.search(/\b(unit_amount|amount|transaction_amount)\s*:\s*(Number\(|parseInt\(|parseFloat\()?\s*(req\.|request\.|c\.req\.)?(body|data|input|params|query|payload)\??\.\w*(price|amount|valor|total|preco|preço)/i)
  if (isRoute && clientAmount >= 0 && /stripe|mercadopago|checkout|payment|pagamento|pix/i.test(text))
    out.push({
      rule_id: 'payment-amount-from-client',
      severity: 'high',
      cwe: 'CWE-602',
      index: clientAmount,
      title: t('Charge amount comes from the browser', 'Valor da cobrança vem do navegador'),
      detail: t('The route creates the charge with the price or amount that came in the request, instead of looking the price up on the server.', 'A rota cria a cobrança com o preço ou valor que chegou no pedido, em vez de buscar o preço no servidor.'),
      impact: t('Anyone can change the amount in the browser and pay $0.01 for any product.', 'Qualquer pessoa pode mudar o valor no navegador e pagar R$ 0,01 por qualquer produto.'),
      fix: t('Receive only the product id (or the Stripe price id, price_…) and look the amount up on the server or in the database; never trust the amount sent by the browser.', 'Receba só o id do produto (ou do preço do Stripe, price_…) e busque o valor no servidor ou no banco; nunca confie no valor enviado pelo navegador.'),
    })
  // Produto liberado na página de "obrigado": quem abre o endereço sem pagar ganha o mesmo.
  if (/(^|\/)[^/]*(success|sucesso|obrigado|thank-?you|pagamento-aprovado|payment-success)[^/]*\.[cm]?[jt]sx?$/i.test(rel) || /(success|sucesso|obrigado)\/(page|route|index)\.[jt]sx?$/i.test(rel)) {
    const grant = text.search(/\.(update|insert|upsert)\(\s*\{[^}]{0,300}\b(plan|plano|paid|pago|is_pro|premium|credits|creditos|créditos|subscription|assinatura|status\s*:\s*['"](active|ativo|paid|pago))/i)
    if (grant >= 0 && !/sessions\.retrieve|payment_status|paymentIntents\.retrieve|verif/i.test(text))
      out.push({
        rule_id: 'payment-fulfilled-on-redirect',
        severity: 'high',
        cwe: 'CWE-840',
        index: grant,
        title: t('Product granted on the "payment approved" page', 'Produto liberado na página de "pagamento aprovado"'),
        detail: t('The page the customer returns to after paying saves the plan, the payment or the credits, without confirming with the payment service.', 'A página para onde o cliente volta depois do pagamento grava o plano, o pagamento ou os créditos, sem confirmar com o serviço de pagamento.'),
        impact: t('Whoever opens that address directly, without paying, gets the product. The payment can also fail after the person sees that page.', 'Quem abrir esse endereço direto, sem pagar, ganha o produto. O pagamento também pode falhar depois de a pessoa ver essa página.'),
        fix: t('Grant the product only in the payment webhook (with the signature checked). The thank-you page only shows the message, or checks the status with stripe.checkout.sessions.retrieve(id) first.', 'Libere o produto só no webhook do pagamento (com a assinatura conferida). A página de obrigado só mostra a mensagem, ou confere o status com stripe.checkout.sessions.retrieve(id) antes.'),
      })
  }
  // Chave de admin do Supabase num arquivo que roda no navegador.
  if (/^\s*['"]use client['"]/m.test(text) && /SERVICE_ROLE|sb_secret_|serviceRole/i.test(text))
    out.push({
      rule_id: 'supabase-service-role-in-client',
      severity: 'critical',
      cwe: 'CWE-522',
      index: text.search(/SERVICE_ROLE|sb_secret_|serviceRole/i),
      title: t('Supabase admin key used in a browser file', 'Chave de admin do Supabase usada em arquivo do navegador'),
      detail: t('A file marked "use client" (runs in the browser) uses the Supabase service_role/secret key.', 'Um arquivo marcado com "use client" (roda no navegador) usa a chave service_role/secret do Supabase.'),
      impact: t('The service_role key bypasses all access rules: whoever opens the site can grab it and read, change or delete any data.', 'A service_role ignora todas as regras de acesso: quem abrir o site pode pegá-la e ler, alterar ou apagar qualquer dado.'),
      fix: t('In the browser, use only the public key (anon/publishable) with RLS. Admin operations go to the server (API route, server action, edge function).', 'No navegador, use só a chave pública (anon/publishable) com RLS. Operações de admin vão para o servidor (rota de API, server action, edge function).'),
    })
  return out
}

// Regras por arquivo: o que falta no arquivo inteiro (ex.: webhook que não confere a assinatura).
function fileRules(rel, text) {
  const isRoute = SERVER_ROUTE.test(rel)
  return [...webhookRules(rel, text, isRoute), ...paymentRules(rel, text, isRoute), ...dockerRules(rel, text)]
}

/** Dockerfile: a imagem final (a do último FROM) roda como root quando nenhum USER troca o usuário depois dele. */
function dockerRules(rel, text) {
  if (!DOCKERFILE.test(rel)) return []
  const froms = [...text.matchAll(/^\s*FROM\s+(\S+)/gim)]
  const last = froms.at(-1)
  if (!last) return []
  const finalStage = text.slice(last.index)
  // Imagens que já trocam o usuário (distroless :nonroot, chainguard) não precisam do USER.
  if (/^\s*USER\s+(?!root\b|0\b)\S+/im.test(finalStage) || /:nonroot\b|chainguard/i.test(last[1])) return []
  return [
    {
      rule_id: 'docker-runs-as-root',
      severity: 'medium',
      cwe: 'CWE-250',
      index: last.index,
      title: t('Container runs as root', 'Contêiner roda como root'),
      detail: t('The final image has no USER instruction: the program runs as root inside the container.', 'A imagem final não tem uma instrução USER: o programa roda como root dentro do contêiner.'),
      impact: t('If someone exploits a flaw in the app, they get full control of the container and get closer to reaching the server.', 'Se alguém explorar uma falha do app, ganha o controle total do contêiner e fica mais perto de chegar ao servidor.'),
      fix: t('Create a user and switch to it before CMD (in Node: USER node; in others: RUN adduser -D app and USER app).', 'Crie um usuário e troque para ele antes do CMD (no Node: USER node; nas outras: RUN adduser -D app e USER app).'),
    },
  ]
}

export function scanCode(root, files) {
  const out = []
  for (const rel of files) {
    if ((!CODE_FILE.test(rel) && !DOCKERFILE.test(rel)) || /\.(d\.ts|min\.js)$/.test(rel) || TEST_PATH.test(rel)) continue
    const text = readText(root, rel)
    if (!text || text.startsWith('// Gerado por')) continue
    const lines = text.split('\n')
    let offset = 0
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim()
      if (trimmed.length > 2000 || /^(\/\/|\*|\/\*|#)/.test(trimmed)) {
        offset += line.length + 1
        continue
      }
      for (const r of ALL_LINE_RULES) {
        if ((r.files && !r.files.test(rel)) || !r.re.test(line) || r.ok?.test(line) || r.fileOk?.test(text)) continue
        out.push(codeFinding(rel, r.id, r, i + 1, trimmed))
      }
      offset += line.length + 1
    }
    for (const f of fileRules(rel, text)) out.push(codeFinding(rel, f.rule_id, f, f.index >= 0 ? lineOf(text, f.index) : null, f.index >= 0 ? lineText(text, f.index).trim() : null))
  }
  return out
}

// Texto de regra: [en, pt] (regras montadas ao carregar o módulo) ou já na língua da pessoa.
const ruleText = (v) => (Array.isArray(v) ? t(v[0], v[1]) : v)

function codeFinding(rel, ruleId, r, line, snippet) {
  return {
    source: 'code',
    rule_id: ruleId,
    severity: r.severity,
    confidence: 'medium',
    title: ruleText(r.title),
    detail: t(
      `${ruleText(r.detail)} Check whether the value can come from outside: if it is always a fixed value from the code itself, it is not a problem.`,
      `${ruleText(r.detail)} Confira se o valor pode vir de fora: se for sempre um valor fixo do próprio código, não é problema.`,
    ),
    impact: ruleText(r.impact),
    fix: ruleText(r.fix),
    file: rel,
    line,
    // O trecho passa pela máscara de chaves, por garantia.
    snippet: snippet ? maskSecretsIn(snippet).slice(0, 240) : null,
    cwe: [r.cwe],
    fingerprint: `code|${ruleId}|${rel}|${hash((snippet ?? '').replace(/\s+/g, ' '))}`,
  }
}

export function maskSecretsIn(text) {
  let out = text
  for (const s of findSecrets(text)) out = out.replace(s.secret, mask(s.secret))
  return out
}
