# API e abuso
Quando ler: o app expõe rotas de API, formulários públicos (login, cadastro, contato, reset), envia e-mail/SMS, chama serviços pagos (IA, mapas, SMS), recebe webhooks (Stripe, Mercado Pago, GitHub, Clerk, Supabase), aceita upload de arquivo ou busca URLs informadas pelo usuário.

Nota sobre rate limit em serverless (Vercel, Netlify, Cloudflare Workers, Supabase Edge Functions): contador em memória (`Map`, `express-rate-limit` com store padrão) não funciona de verdade, porque cada instância tem o seu. O controle válido usa armazenamento compartilhado (Upstash/Redis, KV/Durable Objects, tabela no banco, binding de Rate Limiting do Cloudflare, regras do WAF/firewall da hospedagem) ou o limite embutido de um provedor gerenciado.

## rate-limit-auth — Login, cadastro, reset e OTP sem limite de tentativas
- Gravidade típica: alta para login/OTP/código de verificação sem limite (força bruta; código de 6 dígitos cai em minutos); média para cadastro (contas falsas); média para reset (spam para a vítima).
- Onde procurar: rotas/actions de `login`, `signin`, `signup`, `register`, `forgot`, `reset`, `verify`, `otp`, `2fa`, `magic-link`, `invite`.
- Como confirmar lendo o código: procure limitador aplicado a essas rotas, com chave por IP e por conta/e-mail, e armazenamento compartilhado. Em códigos curtos (OTP), veja se há limite de tentativas por código e expiração.
- Descarta se: a autenticação é feita pelo provedor gerenciado (Supabase Auth `signInWithPassword`/`signInWithOtp`, Firebase Auth, Clerk, Auth0), que aplica limites próprios, e o app não tem rota própria que contorne; ou há `@upstash/ratelimit`/`env.RATE_LIMITER.limit({ key })`/tabela de tentativas nessas rotas; ou CAPTCHA/Turnstile verificado no servidor.
- Não descarta: rate limit em memória em serverless; limite só no front (botão desabilitado); CAPTCHA renderizado mas token não verificado no servidor; limite só por IP em login (o atacante troca de IP, e ataques contra uma conta passam).
- Como corrigir:
  ```ts
  const rl = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, '10 m') });
  const { success } = await rl.limit(`login:${ip}:${email.toLowerCase()}`);
  if (!success) return new Response('Too many attempts', { status: 429 });
  ```
- CWE: CWE-307

## rate-limit-envio-e-rotas-caras — E-mail, SMS, IA e rotas caras sem limite
- Gravidade típica: alta quando cada chamada custa dinheiro (SMS, LLM, geração de imagem, APIs pagas) ou envia mensagens a terceiros (spam em nome do domínio, bloqueio do remetente); média para rotas pesadas (relatórios, exports, buscas).
- Onde procurar: chamadas a `resend.emails.send`, `sgMail.send`, `nodemailer` `sendMail`, `twilio.messages.create`, `openai.chat.completions.create`, `anthropic.messages.create`, `generateText`/`streamText` (Vercel AI SDK), APIs de imagem; formulários de contato, "convidar amigo", "enviar por e-mail"; rotas que geram PDF/CSV.
- Como confirmar lendo o código: para cada rota que dispara custo, confira: exige login? tem limite por usuário (e por IP se anônima)? tem teto de uso por plano/dia? O destinatário do e-mail/SMS é controlado pelo usuário?
- Descarta se: limite por usuário com armazenamento compartilhado + exigência de login; ou cota diária gravada no banco e conferida antes da chamada.
- Não descarta: "só usuários logados usam" (cadastro aberto = qualquer um); limite de gastos configurado no provedor (evita falência, mas um usuário ainda esgota a cota de todos, derrubando o serviço).
- Como corrigir: exigir login, limitar por `user.id`, registrar consumo e checar cota antes de chamar o provedor; em formulários públicos, Turnstile/hCaptcha verificado no servidor.
- CWE: CWE-770

## corpo-e-paginacao-sem-limite — Corpo, upload ou paginação sem teto
- Gravidade típica: média (negação de serviço, custo de banda/banco); baixa se a plataforma já limita.
- Onde procurar: `express.json({ limit: '50mb' })`, `bodyParser` com limite alto, `await req.json()`/`req.formData()` em rotas sem checagem de tamanho; Hono sem `bodyLimit`; `?limit=` sem máximo (`take: Number(req.query.limit)`); `findMany()` sem `take`; `select('*')` sem `.range`/`.limit`; campos de texto sem `max` no schema.
- Como confirmar lendo o código: veja o limite de corpo aplicado (Express `express.json()` tem padrão de 100 kb; Server Actions do Next têm padrão de 1 MB, ajustável em `serverActions.bodySizeLimit`); veja se o `limit` do cliente é limitado (`Math.min(limit, 100)`); veja `max()` em strings/arrays no Zod.
- Descarta se: limites padrão mantidos ou limites explícitos razoáveis; paginação com máximo; schema com `max`.
- Não descarta: limite no front (`maxLength` no input).
- Como corrigir: `const take = Math.min(Number(q.limit) || 20, 100)`; `z.string().max(5000)`; `app.use('/api/*', bodyLimit({ maxSize: 1024 * 1024 }))` no Hono.
- CWE: CWE-770

## cors-permissivo — CORS com origem refletida ou `*` com credenciais
- Gravidade típica: alta quando reflete qualquer origem com `Access-Control-Allow-Credentials: true` em rotas autenticadas por cookie (outro site lê dados do usuário logado); baixa com `*` sem credenciais em API pública ou autenticada por header `Authorization`.
- Onde procurar: `cors({ origin: true, credentials: true })`, `cors({ origin: (o, cb) => cb(null, true) })`, `res.setHeader('Access-Control-Allow-Origin', req.headers.origin)`, `hono/cors` com `origin: (origin) => origin`, `headers()` em `next.config` com `Access-Control-Allow-Origin`, `vercel.json` headers, `corsHeaders` nas Edge Functions do Supabase (`'*'`).
- Como confirmar lendo o código: veja (1) se a origem é refletida sem allowlist; (2) se há `credentials: true`; (3) se a autenticação usa cookies. O perigo real é a combinação.
- Descarta se: allowlist exata de origens; ou `*` sem credenciais e sem cookie de sessão (navegadores recusam `*` com credenciais); ou a API autentica só por header `Authorization` que o site atacante não tem.
- Não descarta: allowlist com `origin.endsWith('meusite.com')` (aceita `evilmeusite.com`) ou regex sem âncora; `null` na allowlist.
- Como corrigir: `cors({ origin: ['https://app.meusite.com'], credentials: true })`.
- CWE: CWE-942

## csrf-cookie-e-mudanca-de-estado — Ação com cookie de sessão sem proteção de origem
- Gravidade típica: média a alta conforme a ação (trocar e-mail/senha, transferir, apagar conta é alta).
- Onde procurar: sessões por cookie (Auth.js, Lucia, sessão própria, `express-session`, cookie do Supabase SSR) + rotas que mudam estado com POST/PUT/DELETE, ou GET que muda estado (`/api/delete?id=`, `/logout` via GET é baixa); cookie com `SameSite=None`.
- Como confirmar lendo o código: veja o `SameSite` do cookie de sessão (padrão moderno `Lax` bloqueia POST cross-site, mas não GET de navegação), se rotas de escrita aceitam GET, se aceitam `application/x-www-form-urlencoded`/`text/plain` (formulário de outro site consegue enviar sem preflight), e se há token CSRF ou checagem de `Origin`.
- Descarta se: Server Actions do Next (comparam `Origin` com `Host` e só aceitam POST); Auth.js nas rotas dele (token CSRF próprio); cookie `SameSite=Lax/Strict` e nenhuma escrita via GET; ou checagem de `Origin` contra allowlist; ou autenticação só por header `Authorization`.
- Não descarta: `SameSite=None` "para funcionar no iframe"; rota que muda estado via GET; `serverActions.allowedOrigins` com curinga amplo.
- Como corrigir: escrita só por POST/PUT/DELETE, cookie `SameSite=Lax`, e checar `Origin` nas rotas de API próprias que usam cookie.
- CWE: CWE-352

## webhook-sem-assinatura — Webhook (Stripe e outros) aceito sem verificar assinatura
- Gravidade típica: crítica quando o webhook libera plano, credita saldo ou marca pedido como pago (qualquer um forja o evento).
- Onde procurar: rotas `webhook`, `webhooks/stripe`, `api/stripe`, `mercadopago`, `clerk`, `github`. Grep: `checkout.session.completed`, `invoice.paid`, `payment_intent.succeeded`, `constructEvent` (ausência é o sinal), `await req.json()` no webhook.
- Como confirmar lendo o código:
  1. Stripe: deve chamar `stripe.webhooks.constructEvent(rawBody, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)` (ou `constructEventAsync` em Workers/Edge) sobre o corpo cru. `await req.json()` antes estraga a verificação (o time costuma "consertar" removendo a verificação).
  2. Outros: Clerk/Resend usam `svix` (`wh.verify(payload, headers)`); GitHub `X-Hub-Signature-256` com HMAC e `crypto.timingSafeEqual`; Mercado Pago `x-signature`.
  3. Confira que o segredo vem de env e que a falha de verificação retorna 400 e para.
- Descarta se: verificação de assinatura do provedor sobre o corpo cru antes de qualquer efeito; ou o handler ignora o conteúdo do evento e busca o objeto na API do provedor pelo ID (`stripe.checkout.sessions.retrieve(id)`) antes de agir.
- Não descarta: `try { constructEvent(...) } catch { console.log(err) }` seguido de processamento (fail-open); checar só a presença do header; verificar assinatura mas confiar em `metadata.userId` sem checar que o objeto é seu (é aceitável, desde que o metadata tenha sido gravado pelo servidor ao criar a sessão).
- Como corrigir:
  ```ts
  export async function POST(req: Request) {
    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, req.headers.get('stripe-signature')!, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch { return new Response('bad signature', { status: 400 }); }
    // ...
  }
  ```
- CWE: CWE-347

## webhook-sem-idempotencia — Mesmo evento processado duas vezes
- Gravidade típica: média a alta (crédito duplicado, e-mail duplicado, estoque errado). Provedores reenviam eventos por desenho.
- Onde procurar: handlers de webhook que incrementam saldo/créditos ou criam registros sem guardar `event.id`.
- Como confirmar lendo o código: veja se há tabela de eventos processados com `unique(event_id)` ou upsert idempotente (ex.: `update ... set plan = 'pro'` é naturalmente idempotente; `credits = credits + 100` não é).
- Descarta se: operação idempotente por natureza, ou `insert into processed_events (id)` com restrição única antes do efeito, na mesma transação.
- Não descarta: checar "já processei?" com SELECT e depois inserir (corrida entre reenvios simultâneos).
- Como corrigir: `insert ... on conflict (event_id) do nothing returning id`; só aplicar o efeito se retornou linha.
- CWE: CWE-837

## ssrf-fetch-url-do-usuario — Servidor busca URL informada pelo usuário
- Gravidade típica: alta em servidor próprio/VPS/container com rede interna ou metadata de nuvem (`169.254.169.254`); média em plataformas serverless isoladas (ainda permite atingir serviços internos por URL pública, varrer portas e abusar do IP do app).
- Onde procurar: `fetch(body.url)`, `axios.get(req.query.url)`, "importar de URL", preview de links (unfurl), webhooks configuráveis pelo usuário, geração de PDF/screenshot de URL (Puppeteer/Playwright `page.goto(url)`), ferramentas de agente de IA que buscam páginas, `next/image` com curinga (ver `nextjs.md`).
- Como confirmar lendo o código: veja se há validação de destino (protocolo `https:`, host em allowlist, bloqueio de IPs privados após resolver DNS) e se redirecionamentos são seguidos sem revalidar (`redirect: 'follow'` é o padrão do `fetch`).
- Descarta se: allowlist de hosts; ou lib de proteção (`ssrf-req-filter`, `request-filtering-agent`) aplicada ao cliente HTTP; ou o fetch roda num ambiente sem rede interna e o conteúdo retornado não volta ao usuário e não carrega credenciais.
- Não descarta: bloquear a string `localhost`/`127.0.0.1` (há `0x7f000001`, `[::1]`, DNS que resolve para IP interno, redirect para IP interno); validação antes do redirect.
- Como corrigir: allowlist quando possível; senão resolver DNS, recusar faixas privadas/link-local, `redirect: 'manual'` e revalidar cada salto, timeout e limite de tamanho da resposta.
- CWE: CWE-918

## upload-de-arquivo — Upload sem restrição de tipo, tamanho ou forma de servir
- Gravidade típica: alta quando HTML/SVG enviado é servido no mesmo domínio do app (XSS armazenado); média para falta de limite de tamanho (custo) ou tipo; crítica se o arquivo é gravado em pasta executada pelo servidor.
- Onde procurar: `multer`, `formidable`, `busboy`, `req.formData()` + `file`, `supabase.storage.from().upload(`, `uploadBytes` (Firebase), URLs pré-assinadas S3/R2 (`getSignedUrl(new PutObjectCommand(...))`), `uploadthing`.
- Como confirmar lendo o código: (1) tipo validado no servidor por allowlist (extensão e, idealmente, bytes mágicos; o `Content-Type` do cliente é falsificável); (2) tamanho máximo; (3) nome gerado pelo servidor; (4) arquivo servido de domínio separado (bucket/CDN) ou com `Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`; (5) em URL pré-assinada, `ContentType` e tamanho fixados na assinatura.
- Descarta se: os 5 pontos, ou arquivos servidos por domínio de storage separado do app (ex.: `*.supabase.co`) e só imagens aceitas com tamanho máximo.
- Não descarta: `accept="image/*"` no input (é só o front); checar extensão pela última parte depois do `.` mas aceitar `.svg`; `file.type` vindo do navegador.
- Como corrigir: allowlist de tipos (`['image/png','image/jpeg','image/webp']`) conferida no servidor, limite de tamanho, nome UUID, servir como anexo ou de domínio separado; SVG convertido para PNG ou rejeitado.
- CWE: CWE-434

## enumeracao-e-ids-sequenciais — Enumeração de recursos e usuários
- Gravidade típica: baixa por si só; sobe quando combinada com IDOR (ver `acesso-e-idor.md`) ou quando revela dado pessoal (lista de e-mails cadastrados).
- Onde procurar: IDs inteiros autoincrementais expostos em URLs (`/invoice/1043`); endpoints de "checar disponibilidade" de e-mail/username sem limite; mensagens de erro diferentes para "não existe" vs "sem permissão".
- Como confirmar lendo o código: veja se o endpoint revela existência de objetos alheios e se tem limite.
- Descarta se: autorização correta + respostas iguais (404) para inexistente e alheio; rate limit em verificações de disponibilidade.
- Não descarta: "trocar para UUID resolve" (reduz, não substitui autorização).
- Como corrigir: responder 404 nos dois casos; limitar checagens de disponibilidade.
- CWE: CWE-203
