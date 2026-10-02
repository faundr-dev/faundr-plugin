# Dados e exposição
Quando ler: sempre, numa passada rápida. Especialmente se há tratamento de erro próprio, logs, rotas de debug/teste, configuração de deploy (`vercel.json`, `netlify.toml`, `wrangler.toml`/`wrangler.jsonc`, `next.config.*`, `_headers`, `nginx.conf`), cookies próprios ou respostas de API que devolvem registros do banco.

Calibração: cabeçalhos ausentes, versão no header e source maps, sozinhos, são baixos. Não pinte de alto sem um caminho concreto até dado restrito. Já resposta que devolve dado de outro usuário ou hash de senha é alta ou crítica.

## resposta-com-dados-sensiveis — API devolve campos que não deveria
- Gravidade típica: crítica para hash de senha, tokens de reset/sessão, chaves de API de usuário; alta para e-mail/telefone/CPF/endereço de outros usuários; média para campos internos do próprio usuário.
- Onde procurar: `return Response.json(user)`, `res.json(user)`, `res.json(await db.user.findMany())`, `select('*')` devolvido direto, `include: { author: true }` em listagens públicas (vaza e-mail do autor), rotas `/api/users`, `/api/me`, `/api/members`, comentários/posts com dados do autor.
- Como confirmar lendo o código: liste os campos do objeto devolvido (pelo schema do ORM/tabela) e veja quais saem. Em listagens de outros usuários, só campos públicos devem sair.
- Descarta se: há `select` explícito de campos, DTO/mapper antes da resposta, ou `omit` de campos sensíveis (Prisma `omit: { password: true }` ou serializador); em Supabase, colunas sensíveis em tabela separada/GRANT por coluna (ver `supabase.md`).
- Não descarta: "o front não mostra"; `delete user.password` num ramo e não no outro.
- Como corrigir: `select: { id: true, name: true, avatarUrl: true }` ou função `toPublicUser(u)`.
- CWE: CWE-200

## erro-com-stack-trace — Detalhes internos no erro devolvido ao cliente
- Gravidade típica: baixa; média se o erro expõe SQL, caminhos, segredos em mensagens de conexão ou dados de outros usuários.
- Onde procurar: `catch (e) { return Response.json({ error: e }) }`, `res.status(500).json({ error: err.message, stack: err.stack })`, `return { error: error }` do Supabase repassado cru, error handler do Express com `err.stack`, `NODE_ENV` não definido em produção, Hono `app.onError((e, c) => c.text(e.stack))`.
- Como confirmar lendo o código: veja o que o handler global e os `catch` devolvem.
- Descarta se: mensagem genérica ao cliente e detalhes só no log do servidor (sem segredo); ou só em `NODE_ENV === 'development'` com produção configurada.
- Não descarta: "é só em dev" sem checagem de ambiente no código.
- Como corrigir: `console.error(e); return Response.json({ error: 'Erro interno' }, { status: 500 })`.
- CWE: CWE-209

## logs-com-segredo-ou-pii — Log com senha, token, chave ou dado pessoal
- Gravidade típica: média (logs vão para Vercel/Sentry/Datadog e são lidos por mais gente); alta se loga senhas, tokens de sessão ou números de cartão.
- Onde procurar: `console.log(req.body)` em login/cadastro/pagamento, `console.log(req.headers)` (inclui `authorization`/`cookie`), `console.log(user)`, `console.log(process.env)`, `logger.info({ body })`, logs de prompts completos de IA com dados pessoais, Sentry sem `beforeSend` em formulários sensíveis.
- Como confirmar lendo o código: identifique logs em caminhos que tocam credenciais ou PII.
- Descarta se: logs estruturados com redação (`pino` com `redact: ['req.headers.authorization', 'password']`) ou só campos não sensíveis.
- Não descarta: log "temporário de debug" já commitado.
- Como corrigir: remover o log ou redigir campos.
- CWE: CWE-532

## endpoint-de-debug-ou-teste — Rota de debug, seed, admin temporário ou teste exposta
- Gravidade típica: alta a crítica conforme o que faz (reset do banco, criação de admin, dump de env); baixa se só devolve "ok".
- Onde procurar: rotas `debug`, `test`, `seed`, `reset-db`, `dev`, `health` com dados, `env`, `phpinfo`-like, `api/admin/make-admin`, `api/cron/*` sem segredo; páginas `app/test/*`; flags `if (process.env.NODE_ENV !== 'production')` usando variável que pode não estar definida.
- Como confirmar lendo o código: liste as rotas e procure as que não fazem parte do produto; veja se exigem autenticação/segredo e se são desligadas em produção.
- Descarta se: a rota não existe no build de produção (arquivo excluído, `notFound()` em produção) ou exige segredo forte/papel de admin; rotas de cron checam `Authorization: Bearer ${process.env.CRON_SECRET}` (padrão da Vercel).
- Não descarta: "ninguém sabe a URL" (o bundle e o sitemap revelam).
- Como corrigir: remover; ou proteger com segredo/papel; crons com `CRON_SECRET`.
- CWE: CWE-489

## env-e-arquivos-publicos — `.env`, backups ou source maps servidos publicamente
- Gravidade típica: crítica para `.env` com segredos acessível; baixa para source maps sem segredos.
- Onde procurar: `.env` dentro de `public/` ou `static/`; `.env` versionado ou fora do `.gitignore`; `express.static('.')`/`serveStatic({ root: './' })` na raiz do projeto (serve `.env`, `.git`); dumps `*.sql`/`backup.zip` na pasta pública; `productionBrowserSourceMaps: true`; `build.sourcemap: true` no `vite.config` para produção.
- Como confirmar lendo o código: veja o que a pasta pública contém e a raiz dos servidores estáticos. Para `.env` versionado, confira `git ls-files`/`.gitignore` (a camada automática do Faundr também checa isso; não duplique se já houver achado).
- Descarta se: servidor estático aponta para pasta de build dedicada; `.env*` no `.gitignore` e fora do histórico; maps desligados ou só enviados ao Sentry.
- Não descarta: "o repositório é privado" (o deploy é público; colaboradores e integrações veem o repo).
- Como corrigir: mover segredos para variáveis do provedor de hospedagem, trocar as chaves expostas, servir só a pasta de build.
- CWE: CWE-538

## cookies-sem-flags — Cookie de sessão sem HttpOnly, Secure ou SameSite
- Gravidade típica: média (amplifica XSS e CSRF); baixa se não há XSS nem ação sensível.
- Onde procurar: `cookies().set(`, `res.cookie(`, `setCookie(c, ...)` (Hono), `document.cookie = 'token=`, `serialize(` do pacote `cookie`, configurações de sessão (`express-session` `cookie: {}`).
- Como confirmar lendo o código: cookies de sessão/autenticação devem ter `httpOnly: true`, `secure: true` (em produção), `sameSite: 'lax'` ou `'strict'`, e escopo de domínio mínimo.
- Descarta se: flags presentes; ou os cookies são gerenciados por lib de autenticação com padrões seguros (Auth.js, Clerk, `@supabase/ssr`; no Supabase SSR o cookie não é `httpOnly` por desenho porque o cliente do navegador precisa lê-lo, o que é aceito pelo modelo deles).
- Não descarta: token salvo em `document.cookie` ou `localStorage` "para o front ler".
- Como corrigir: `cookies().set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })`.
- CWE: CWE-1004

## cabecalhos-de-seguranca — CSP, HSTS, frame-ancestors, nosniff ausentes
- Gravidade típica: baixa isolado. Sobe para média quando: não há `frame-ancestors`/`X-Frame-Options` e o app tem ação sensível de um clique (clickjacking); ou há XSS e nenhuma CSP para conter.
- Onde procurar: `headers()` em `next.config.*`, `vercel.json` (`headers`), `netlify.toml`, `public/_headers` (Netlify/Cloudflare Pages), `helmet()` no Express, `secureHeaders()` do Hono, `Response` dos Workers, `middleware.ts` que seta CSP com nonce.
- Como confirmar lendo o código: procure `Content-Security-Policy` (sem `unsafe-inline` em `script-src` idealmente), `Strict-Transport-Security`, `frame-ancestors 'none'` ou `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- Descarta se: headers configurados em algum desses lugares e aplicados a todas as rotas; ou a hospedagem aplica (Vercel aplica HSTS nos domínios dela; confira antes de afirmar).
- Não descarta: CSP com `script-src 'unsafe-inline' 'unsafe-eval' *` (existe, mas não protege).
- Como corrigir: `helmet()` / `secureHeaders()`, ou no `next.config`:
  ```js
  async headers() { return [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ] }]; }
  ```
- CWE: CWE-693

## segredo-no-codigo-ou-bundle — Chave de API, senha ou token literal no código
- Gravidade típica: crítica para chaves com poder (service_role, `sk_live_`, AWS, OpenAI/Anthropic, SMTP, tokens de GitHub); baixa para chaves públicas por desenho.
- Onde procurar: a camada automática do Faundr já detecta formatos conhecidos. Aqui, procure o que regex não pega: senhas de banco em strings de conexão (`postgres://user:senha@`), segredos em fallback (`process.env.X ?? 'valor-real'`), credenciais em arquivos de config JS/JSON, segredos em código cliente (Vite: tudo em `src/` vai para o bundle), tokens de admin em testes que também rodam em produção.
- Como confirmar lendo o código: identifique o provedor e se o valor parece real (não `xxx`, `your-key-here`, `changeme` em `.env.example`).
- Descarta se: placeholder evidente; chave pública por desenho; valor em arquivo de exemplo com dados falsos.
- Não descarta: "é chave de teste" (`sk_test_` dá acesso ao modo teste da conta e costuma ser trocada por live no mesmo lugar); "já apaguei" (continua no histórico do git; a chave precisa ser trocada).
- Como corrigir: mover para variável de ambiente do servidor, trocar a chave no provedor, e limpar o histórico se o repositório for público.
- CWE: CWE-798
