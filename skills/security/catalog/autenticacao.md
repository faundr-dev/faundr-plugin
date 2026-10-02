# Autenticação e sessão
Quando ler: o app tem login, cadastro, sessão, JWT próprio, OAuth/login social, magic link ou reset de senha. Sinais: `jsonwebtoken`, `jose`, `next-auth`/`@auth/*`, `better-auth`, `lucia`, `@clerk/*`, `@supabase/ssr`, `firebase/auth`, `bcrypt`/`argon2`, `passport`, rotas `login`, `signup`, `reset`, `callback`, `middleware.ts`/`proxy.ts`.

Regra de ouro: identidade só vale se foi verificada no servidor em cada request que precisa dela. Se o app usa um provedor pronto (Supabase Auth, Clerk, Auth.js, Firebase Auth), o risco quase nunca está no provedor, e sim em como o código lê a sessão e onde deixa de ler.

## rota-sem-login — Rota de API, Server Action ou loader sem checar sessão
- Gravidade típica: alta; crítica se a rota lê/escreve dados sensíveis ou executa ação cara. Baixa se a rota é pública por desenho (webhook com assinatura, healthcheck, conteúdo público).
- Onde procurar: todo arquivo em `app/api/**/route.ts`, `pages/api/**`, arquivos com `'use server'`, `createServerFn` (TanStack Start), rotas Express/Hono/Workers (`app.post(`, `router.get(`, `export default { fetch }`), Edge Functions do Supabase, Cloud Functions `onRequest`.
- Como confirmar lendo o código:
  1. Liste os handlers que tocam dados de usuário ou fazem efeito colateral.
  2. Em cada um, ache a chamada que obtém o usuário verificado: `await auth()` (Auth.js v5), `getServerSession(authOptions)` (NextAuth v4), `await supabase.auth.getUser()`/`getClaims()`, `auth()` do `@clerk/nextjs/server`, `admin.auth().verifyIdToken(token)`, `jwt.verify(...)`.
  3. Confirme que o retorno nulo interrompe o fluxo (`if (!user) return 401`) antes de qualquer efeito.
- Descarta se: a chamada de verificação está no topo do handler (ou num wrapper como `withAuth(handler)` que envolve este handler específico) e falha fechado; ou a rota é pública por desenho e não expõe nada sensível.
- Não descarta: só o middleware protege (ver `middleware-unica-barreira`); a página que chama a rota exige login (a rota é chamável direto); `try { user = await getUser() } catch {}` seguido de uso sem checar nulo; checagem que só loga o erro e continua.
- Como corrigir: helper `requireUser()` que lança/retorna 401, chamado na primeira linha de cada handler e Server Action.
- CWE: CWE-306

## middleware-unica-barreira — Middleware/proxy como única proteção
- Gravidade típica: alta. Crítica em Next.js vulnerável à CVE-2025-29927 (`x-middleware-subrequest` pula o middleware; corrigida em 12.3.5, 13.5.9, 14.2.25 e 15.2.3).
- Onde procurar: `middleware.ts`/`middleware.js` (Next ≤15), `proxy.ts` (Next 16), o `config.matcher`, e as rotas protegidas por ele. Versão do `next` no `package.json`/lockfile.
- Como confirmar lendo o código:
  1. Leia o `matcher` e a lógica: quais caminhos ele cobre e o que faz (checa cookie? verifica token? só redireciona?).
  2. Procure rotas sensíveis fora do matcher (é comum o matcher excluir `api`, ou usar regex que não cobre `/api/...`).
  3. Confira se os handlers/Server Actions por trás repetem a checagem. Server Actions são POST para a página onde estão; o middleware as intercepta pelo caminho da página, que pode não estar no matcher.
  4. Veja se o middleware só confere a existência do cookie (`request.cookies.has('session')`) sem verificar.
- Descarta se: cada handler/action sensível também chama a verificação de sessão (defesa em profundidade) e a versão do Next não é vulnerável.
- Não descarta: "o middleware já cuida"; checagem de cookie presente sem validar; matcher com exclusões amplas; Next vulnerável mesmo com hospedagem que diz filtrar o header (confirme, não presuma).
- Como corrigir: manter o middleware para redirecionar a UI, mas verificar a sessão também dentro de cada handler/action; atualizar o `next`.
- CWE: CWE-288

## sessao-nao-verificada — Sessão lida sem verificar assinatura (getSession, decode)
- Gravidade típica: alta a crítica (qualquer um forja identidade).
- Onde procurar: servidor usando `supabase.auth.getSession()` para decidir acesso; `jwt.decode(`; `jose.decodeJwt(`; `atob(token.split('.')[1])`; `JSON.parse(Buffer.from(...split('.')[1], 'base64'))`; cookie `user`/`role` em JSON puro; `req.headers['x-user-id']`.
- Como confirmar lendo o código: identifique a função que transforma cookie/header em usuário. Ela deve verificar assinatura com segredo/JWKS. No Supabase, `getSession()` no servidor lê o cookie sem revalidar; a documentação manda usar `getUser()` (consulta o Auth) ou `getClaims()` (verifica assinatura) para decisões de autorização.
- Descarta se: usa `jwt.verify`, `jose.jwtVerify`, `getUser()`/`getClaims()`, `verifyIdToken`, ou a sessão é opaca e buscada no banco pelo ID.
- Não descarta: `getSession()` "porque é mais rápido"; decode só para "mostrar o nome", se o mesmo valor depois decide acesso; header de identidade setado por um proxy mas também aceito de fora.
- Como corrigir: `const { data: { user } } = await supabase.auth.getUser(); if (!user) return 401;` ou `jwt.verify(token, secret, { algorithms: ['HS256'] })`.
- CWE: CWE-345

## jwt-algoritmo-e-claims — JWT sem fixar algoritmo, sem iss/aud/exp
- Gravidade típica: crítica com `alg: none` aceito ou confusão RS256→HS256; média se só falta `aud`/`iss` num sistema com um único emissor.
- Onde procurar: `jwt.verify(` sem `algorithms`; `jwtVerify(` sem `issuer`/`audience`; verificação manual com `crypto.createHmac`; chave pública usada como segredo HMAC; `ignoreExpiration: true`; segredo fraco (`'secret'`, `'changeme'`, segredo curto no código ou com fallback `process.env.JWT_SECRET || 'dev'`).
- Como confirmar lendo o código: leia a chamada de verificação e as opções. Veja se o algoritmo é fixo, se `exp` é checado, se `iss`/`aud` são validados quando há mais de um emissor (ex.: aceita token do Supabase de outro projeto ou ID token no lugar de access token), e de onde vem o segredo.
- Descarta se: `algorithms` fixo, segredo forte vindo de env sem fallback, `issuer` e `audience` validados, e a lib é atual (`jsonwebtoken` ≥9 rejeita `none` sem opção explícita).
- Não descarta: "a lib é segura" sem olhar as opções; fallback de segredo para dev que vai para produção; `kid`/`jku` do header usados para buscar chave de URL arbitrária.
- Como corrigir:
  ```ts
  const { payload } = await jwtVerify(token, JWKS, { issuer: ISS, audience: AUD, algorithms: ['RS256'] });
  ```
- CWE: CWE-347

## senha-armazenamento — Senha guardada sem hash lento
- Gravidade típica: alta (vazamento do banco vira vazamento de senhas).
- Onde procurar: cadastro/login próprio (sem provedor). Grep: `createHash('sha256')`, `md5`, `sha1`, `password:` gravado direto, `bcrypt.hash(pw, 4)`, comparação `user.password === password`.
- Como confirmar lendo o código: veja como a senha é gravada e comparada.
- Descarta se: `bcrypt` (custo ≥10), `argon2`/`@node-rs/argon2`, `scrypt` com parâmetros fortes, ou autenticação delegada a provedor (Supabase Auth, Clerk, Firebase Auth, Auth.js com provedor OAuth).
- Não descarta: SHA-256 "com salt"; comparação com `===` (também tem risco de tempo).
- Como corrigir: `const hash = await argon2.hash(pw)`; `await argon2.verify(hash, pw)`.
- CWE: CWE-916

## senha-politica-e-forca-bruta — Login sem limite de tentativas / senha fraca aceita
- Gravidade típica: média; alta se não há MFA e o app guarda dados sensíveis ou dinheiro.
- Onde procurar: rota de login própria; validação de senha no cadastro (`min(6)`); ausência de rate limit (detalhe em `api-e-abuso.md`).
- Como confirmar lendo o código: veja o tamanho mínimo exigido e se há limitação de tentativas por conta e por IP no login próprio.
- Descarta se: login feito pelo provedor gerenciado (Supabase Auth, Firebase Auth, Clerk) que já aplica limites; ou há rate limit por IP e por conta; senha mínima ≥8 (NIST sugere 15 se não houver MFA) com checagem de senhas vazadas quando possível.
- Não descarta: rate limit só no front (botão desabilitado); limite em memória num ambiente serverless (cada instância tem o seu contador).
- Como corrigir: limitar tentativas (ex.: `@upstash/ratelimit` por `ip` e por `email`), mínimo de 8+ caracteres, mensagens genéricas ("e-mail ou senha incorretos").
- CWE: CWE-307

## reset-de-senha — Reset com token fraco, reutilizável ou link montado com Host
- Gravidade típica: crítica (tomada de conta).
- Onde procurar: rotas `forgot`, `reset`, `recover`, `verify-email`, `magic`. Grep: `Math.random()`, `Date.now().toString(36)`, `uuidv1`, `req.headers.host`, `x-forwarded-host`, `resetToken`.
- Como confirmar lendo o código:
  1. Geração do token: deve ser `crypto.randomBytes(32)`/`crypto.randomUUID()`.
  2. Armazenamento: idealmente hash do token; validade curta (≤1 h); uso único (apagado/invalidado após uso).
  3. Link: base da URL vem de configuração (`process.env.APP_URL`), não do header `Host` (senão o atacante envia o link com domínio dele para a vítima).
  4. Resposta: não revela se o e-mail existe; não devolve o token na resposta da API.
  5. Após trocar a senha, outras sessões são encerradas.
- Descarta se: usa o fluxo do provedor (`supabase.auth.resetPasswordForEmail` com `redirectTo` fixo e Redirect URLs restritas no painel; `sendPasswordResetEmail` do Firebase) ou os 5 pontos acima estão atendidos.
- Não descarta: token aleatório mas sem expiração; token devolvido no JSON "para debug"; `redirectTo` montado com `origin` do request.
- Como corrigir: `const token = crypto.randomBytes(32).toString('hex')`, guardar `sha256(token)` com `expiresAt`, apagar ao usar, link com `new URL('/reset?token=' + token, process.env.APP_URL)`.
- CWE: CWE-640

## oauth-redirect-e-next — Redirecionamento pós-login controlado pelo usuário
- Gravidade típica: média como open redirect isolado; alta se vaza `code`/token para outro domínio.
- Onde procurar: rota de callback (`app/auth/callback/route.ts`, `/api/auth/callback`), parâmetros `next`, `redirect`, `returnTo`, `callbackUrl`. Padrão comum em templates Supabase: `const next = searchParams.get('next') ?? '/'; return NextResponse.redirect(`${origin}${next}`)`. Com `next=.evil.com` isso vira `https://app.com.evil.com`.
- Como confirmar lendo o código: veja se `next` é validado como caminho relativo (`startsWith('/')` e não `startsWith('//')` nem contém `\`), ou comparado a uma allowlist. No Auth.js, veja o callback `redirect` (o padrão só permite mesma origem; customizações costumam abrir).
- Descarta se: validação de caminho relativo ou allowlist; `new URL(next, origin)` seguido de checagem `url.origin === origin`.
- Não descarta: `includes('meusite.com')`; regex sem âncora; checagem só no front.
- Como corrigir:
  ```ts
  const raw = searchParams.get('next') ?? '/';
  const next = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  ```
- CWE: CWE-601

## oauth-state-pkce — OAuth próprio sem state/PKCE ou com redirect_uri frouxo
- Gravidade típica: alta (login CSRF, troca de conta, roubo de code).
- Onde procurar: implementação manual de OAuth (montagem de URL `authorize?client_id=`), `passport` com `state: false`, conexões de contas externas ("conectar Google Drive/GitHub"), `redirect_uri` montado a partir do request.
- Como confirmar lendo o código: veja se `state` é gerado aleatoriamente, guardado em cookie/sessão e comparado no callback; se há `code_verifier`/`code_challenge` S256 para cliente público; se `redirect_uri` é fixo.
- Descarta se: usa Auth.js, Supabase Auth (`signInWithOAuth` + `exchangeCodeForSession`, que usa PKCE), Clerk ou Firebase Auth sem customizar o fluxo; ou `state` e PKCE estão implementados e conferidos.
- Não descarta: `state` gerado mas nunca comparado no callback; conta externa vinculada ao usuário da sessão sem `state` (atacante vincula a conta dele à vítima).
- Como corrigir: gerar `state` e `code_verifier` com `crypto.randomBytes`, gravar em cookie `httpOnly` curto, comparar no callback e apagar.
- CWE: CWE-352

## sessao-ciclo-de-vida — Logout que não invalida, sessão eterna, token em localStorage
- Gravidade típica: média; baixa isolada (exige roubar o token antes).
- Onde procurar: implementação de logout, `expiresIn`, `maxAge`, `localStorage.setItem('token'`, refresh token sem rotação.
- Como confirmar lendo o código: logout apaga/invalida no servidor (sessão no banco, `supabase.auth.signOut()`)? O token de acesso tem validade curta? Tokens próprios ficam em cookie `httpOnly` em vez de `localStorage` (acessível por qualquer XSS)?
- Descarta se: provedor gerenciado com padrões dele; cookies `httpOnly; Secure; SameSite=Lax`; expiração de horas/dias com renovação.
- Não descarta: JWT próprio de 30 dias sem forma de revogar e sem rotação.
- Como corrigir: access token curto + refresh rotativo, ou sessão opaca no banco; guardar em cookie `httpOnly`.
- CWE: CWE-613

## enumeracao-de-contas — Login/cadastro/reset revelam se o e-mail existe
- Gravidade típica: baixa (média se o app é sensível, como saúde ou relacionamento).
- Onde procurar: mensagens "usuário não encontrado" vs "senha incorreta"; reset que responde "e-mail não cadastrado"; cadastro com "e-mail já em uso" sem limite de tentativas.
- Como confirmar lendo o código: compare os ramos de erro.
- Descarta se: mensagem única e mesmo tempo de resposta nos ramos, ou a informação já é pública no produto.
- Não descarta: mensagem genérica, mas status HTTP diferente.
- Como corrigir: mensagem e status iguais; no reset, sempre "se o e-mail existir, enviamos o link".
- CWE: CWE-204
