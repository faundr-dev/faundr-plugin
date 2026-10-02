# Next.js
Quando ler: `next` no `package.json`; pastas `app/` ou `pages/` (ou em `src/`); `next.config.(js|mjs|ts)`; `middleware.ts`/`proxy.ts`. Muitas regras valem também para TanStack Start (`createServerFn`), Remix/React Router (loaders/actions) e SvelteKit (`+page.server.ts`): tudo que roda no servidor e é chamável pelo navegador é um endpoint público.

Primeiro passo: anote a versão exata do `next` (lockfile) e se o projeto usa App Router, Pages Router ou os dois. Diferenças de versão importam (CVE-2025-29927 do middleware; RSC/React2Shell CVE-2025-55182 em React Server Components; avisos de image optimizer). Se a versão está numa faixa afetada, registre como achado de dependência com a versão corrigida, e confira se o padrão de uso torna o problema alcançável.

## next-server-action-sem-authz — Server Action sem checar sessão/dono
- Gravidade típica: alta; crítica se a action altera dinheiro, papéis ou apaga dados.
- Onde procurar: arquivos com `'use server'` no topo (todas as funções exportadas viram endpoints) e funções com `'use server'` dentro do corpo. Grep: `'use server'`, `"use server"`, `useActionState`, `action={`, `formAction`.
- Como confirmar lendo o código:
  1. Cada action exportada é chamável por POST com qualquer argumento, fora do fluxo da tela (o ID da action fica no bundle do cliente).
  2. Dentro de cada uma, procure a verificação de sessão (`await auth()`, `getServerSession`, `supabase.auth.getUser()`, `auth()` do Clerk) e a checagem de dono do objeto recebido.
  3. Confira que os argumentos são validados (Zod) e que IDs do argumento são conferidos contra o usuário (ver `acesso-e-idor.md`).
- Descarta se: a action começa com `const user = await requireUser()` (ou equivalente que falha fechado) e filtra por dono; ou usa um wrapper do tipo `next-safe-action` com `authActionClient` que faz essas checagens (confira o middleware do wrapper).
- Não descarta: a página que renderiza o formulário exige login; o `layout.tsx` checa sessão (layouts não protegem actions nem route handlers); argumento "vem de um campo hidden, então é confiável"; a action só é importada em telas de admin.
- Como corrigir:
  ```ts
  'use server';
  export async function deletePost(id: string) {
    const user = await requireUser();
    const parsed = z.string().uuid().parse(id);
    await db.post.deleteMany({ where: { id: parsed, authorId: user.id } });
  }
  ```
- CWE: CWE-862

## next-route-handler-sem-authz — Route handler/API route sem checagem
- Gravidade típica: alta.
- Onde procurar: `app/**/route.ts` (exports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`), `pages/api/**`. Rotas que convivem nos dois routers.
- Como confirmar lendo o código: igual à `rota-sem-login` em `autenticacao.md`, verbo por verbo. Um `route.ts` pode exportar `GET` protegido e `DELETE` sem proteção.
- Descarta se: cada verbo exportado verifica sessão e dono, ou a rota é pública por desenho.
- Não descarta: proteção no `pages/api` e não na rota equivalente em `app/api` (ou vice-versa).
- Como corrigir: helper de autenticação no topo de cada verbo.
- CWE: CWE-306

## next-middleware-bypass — Middleware como única barreira ou matcher com buracos
- Gravidade típica: alta; crítica em versões afetadas pela CVE-2025-29927 (corrigidas em 12.3.5, 13.5.9, 14.2.25, 15.2.3) quando o middleware é a única proteção.
- Onde procurar: `middleware.ts` ou `proxy.ts` (nome no Next 16), `export const config = { matcher: [...] }`.
- Como confirmar lendo o código: (1) veja se o matcher exclui `/api`, `/_next`, arquivos com extensão, ou usa regex negativa que também exclui rotas sensíveis; (2) veja se o middleware só confere a existência de cookie; (3) confira se as rotas/actions por trás repetem a checagem. Detalhes em `autenticacao.md` → `middleware-unica-barreira`.
- Descarta se: handlers e actions verificam sessão por conta própria e a versão não é afetada.
- Não descarta: redirecionar a página para `/login` (não protege o endpoint de dados).
- Como corrigir: autorização dentro de cada handler/action/página server; atualizar `next`.
- CWE: CWE-288

## next-props-com-dados-demais — Objeto inteiro serializado para o cliente
- Gravidade típica: alta quando vaza hash de senha, tokens, e-mail/telefone de outros usuários, campos de admin; média quando vaza campos internos do próprio usuário; baixa para IDs internos.
- Onde procurar: `getServerSideProps`/`getStaticProps` retornando registros do banco inteiros (vão para `__NEXT_DATA__` no HTML); Server Component passando objeto do banco para Client Component (`<Profile user={user} />` onde `Profile` tem `'use client'`; tudo que vai como prop é serializado no payload RSC); `findMany()`/`select('*')` sem `select` de campos; `include: { author: true }`.
- Como confirmar lendo o código: ache a fronteira servidor→cliente e liste os campos do objeto passado. Pergunte: o componente usa todos? Algum é sensível? Algum pertence a outro usuário (ex.: `post.author` inteiro com e-mail)?
- Descarta se: a consulta seleciona só os campos necessários (`select: { id: true, name: true }`) ou há um DTO/mapper que monta o objeto enviado; ou só dados públicos do próprio usuário atravessam.
- Não descarta: "o componente não mostra o campo" (está no HTML/payload mesmo assim); remover do JSX e esquecer da consulta.
- Como corrigir: selecionar campos na consulta ou mapear para DTO antes de passar como prop. Em módulos de dados, `import 'server-only'` para garantir que não sejam importados pelo cliente.
- CWE: CWE-200

## next-env-publica-com-segredo — Segredo em `NEXT_PUBLIC_` ou importado pelo cliente
- Gravidade típica: crítica para chaves que dão poder (service_role, `sk_live_`, OpenAI/Anthropic, AWS, SMTP); baixa para chaves feitas para o público (Supabase anon/publishable, `pk_live_` do Stripe, config do Firebase, chave de mapas restrita por domínio).
- Onde procurar: `.env*`, `next.config.*` (bloco `env: {}` também embute no bundle), código com `process.env.NEXT_PUBLIC_`. Grep: `NEXT_PUBLIC_.*(SECRET|SERVICE|PRIVATE|KEY|TOKEN)`, `env: {` em `next.config`. Arquivos `'use client'` que importam módulos que leem segredos.
- Como confirmar lendo o código: toda variável `NEXT_PUBLIC_*` é substituída no bundle do navegador no build. Valores no bloco `env` do `next.config` também. Identifique o provedor da chave e se ela é pública por desenho.
- Descarta se: a chave é pública por desenho e restrita no provedor (domínio/escopo), ou o nome tem `NEXT_PUBLIC_` mas o valor é inofensivo (URL).
- Não descarta: "é só a chave de teste" (vira de produção); "o repositório é privado" (o bundle é público).
- Como corrigir: remover o prefixo, usar a chave só em route handler/Server Action, e trocar (rotacionar) a chave no provedor.
- CWE: CWE-798

## next-cache-dado-pessoal — Resposta personalizada guardada em cache compartilhado
- Gravidade típica: alta (usuário B vê a página/dados do usuário A).
- Onde procurar: `unstable_cache(`, `'use cache'`, `cacheTag`, `cacheLife`, `export const revalidate`, `export const dynamic = 'force-static'`, `fetch(..., { cache: 'force-cache' })` ou `next: { revalidate }` em fetch que carrega dado do usuário; `getStaticProps` com dado de sessão; headers `Cache-Control: public, s-maxage` em route handler autenticado.
- Como confirmar lendo o código: veja se a função cacheada depende do usuário (lê cookies/sessão, ou recebe `userId`). Se depende e a chave de cache não inclui o usuário (argumentos de `unstable_cache`/`'use cache'` fazem parte da chave; valores lidos dentro dela sem estar nos argumentos não), o resultado de um vai para outro. Confira o CDN: `Cache-Control: public` em resposta com dado pessoal.
- Descarta se: a função cacheada recebe o `userId` como argumento (entra na chave) ou o dado cacheado é igual para todos; respostas autenticadas usam `private`/`no-store`.
- Não descarta: "o cache é curto" (segundos bastam para vazar).
- Como corrigir: passar o ID do usuário como argumento da função cacheada, ou não cachear; em route handlers com sessão, `Cache-Control: private, no-store`.
- CWE: CWE-524

## next-image-ssrf — `remotePatterns`/`domains` amplos ou loader próprio
- Gravidade típica: média; alta se roda num servidor com acesso a rede interna/metadata (VPS, container próprio). Menor na Vercel.
- Onde procurar: `next.config.*` → `images.remotePatterns` com `hostname: '**'` ou `'*'`, `images.domains` amplo, `dangerouslyAllowSVG: true`, loaders customizados que buscam URL do usuário.
- Como confirmar lendo o código: o otimizador `/_next/image?url=` busca qualquer URL que case com os padrões. Com curinga total, vira proxy para qualquer host. `dangerouslyAllowSVG` sem `contentSecurityPolicy` e `contentDispositionType: 'attachment'` permite SVG com script.
- Descarta se: padrões restritos a hosts específicos (CDN do próprio app, bucket do Supabase do projeto); ou `images.unoptimized: true`.
- Não descarta: curinga "temporário para aceitar avatares de qualquer lugar".
- Como corrigir: listar hosts exatos em `remotePatterns`; se precisar de SVG, manter `contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"` e `contentDispositionType: 'attachment'`.
- CWE: CWE-918

## next-source-maps-publicos — Source maps de produção publicados
- Gravidade típica: baixa; média se os maps revelam segredos ou lógica sensível de autorização no cliente.
- Onde procurar: `productionBrowserSourceMaps: true` no `next.config`; configurações de Sentry que sobem maps mas não os removem (`hideSourceMaps`/`sourcemaps.deleteSourcemapsAfterUpload`).
- Como confirmar lendo o código: veja a opção e se o deploy publica os `.map`.
- Descarta se: opção desligada (padrão) ou maps enviados só ao Sentry e apagados do build.
- Não descarta: nada específico; é achado de baixa gravidade por si só.
- Como corrigir: remover `productionBrowserSourceMaps` ou configurar o upload privado.
- CWE: CWE-540

## next-revalidate-e-preview — Endpoint de revalidação/preview com segredo fraco
- Gravidade típica: média (revalidação forçada em massa, conteúdo de rascunho exposto).
- Onde procurar: rotas que chamam `revalidatePath`/`revalidateTag`, `draftMode().enable()`, `res.setPreviewData`; parâmetros `?secret=`.
- Como confirmar lendo o código: a rota confere um segredo forte vindo de env e sem prefixo público? Compara antes de agir?
- Descarta se: segredo forte de env servidor e comparação antes do efeito; ou a revalidação é chamada só por Server Actions já autorizadas.
- Não descarta: segredo em `NEXT_PUBLIC_`; segredo hard-coded.
- Como corrigir: `if (req.nextUrl.searchParams.get('secret') !== process.env.REVALIDATE_SECRET) return 401`.
- CWE: CWE-306

## next-xss-sinks — `dangerouslySetInnerHTML`, `href` do usuário, markdown
- Gravidade típica: alta para XSS armazenado; ver detalhes em `entrada-e-injecao.md` (`xss-dangerously-set-inner-html`, `xss-href-javascript`).
- Onde procurar: `dangerouslySetInnerHTML`, `<a href={user.website}>`, `react-markdown` com `rehype-raw`, `marked(` + `dangerouslySetInnerHTML`, `<Script>` com conteúdo dinâmico, JSON injetado em `<script>` sem escape (`JSON.stringify` dentro de `dangerouslySetInnerHTML` sem escapar `<`).
- Como confirmar lendo o código: trace a origem do conteúdo. Se é do usuário (ou de LLM), precisa de sanitização (`DOMPurify.sanitize`, `isomorphic-dompurify`, `sanitize-html`).
- Descarta se: conteúdo estático do próprio código, ou sanitizado com allowlist.
- Não descarta: sanitização só na hora de salvar por outro caminho que não cobre todas as escritas.
- Como corrigir: sanitizar na renderização; para JSON-LD, `JSON.stringify(data).replace(/</g, '\\u003c')`.
- CWE: CWE-79

## next-server-only-vazando — Código de servidor importado por componente de cliente
- Gravidade típica: média a crítica, conforme o que vaza (lógica, URLs internas, segredos literais).
- Onde procurar: módulos em `lib/` que usam `process.env.<SEGREDO>`, clientes de banco ou SDKs admin, importados por arquivos `'use client'` (direta ou indiretamente). Grep: `from 'server-only'` (ausência é o sinal).
- Como confirmar lendo o código: siga a cadeia de imports de um componente `'use client'`. Variáveis sem `NEXT_PUBLIC_` viram `undefined` no cliente (não vazam o valor), mas strings literais, URLs internas e lógica vazam.
- Descarta se: módulos sensíveis têm `import 'server-only'` (o build falha se o cliente importar) ou não são alcançáveis a partir do cliente.
- Não descarta: "o valor vem de env, então não vaza" quando há fallback literal (`process.env.X ?? 'sk-...'`).
- Como corrigir: `import 'server-only'` no topo dos módulos de dados/segredos.
- CWE: CWE-200
