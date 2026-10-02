# Supabase
Quando ler: `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/auth-helpers-*` no `package.json`; pasta `supabase/` (`migrations/*.sql`, `functions/*/index.ts`, `config.toml`, `seed.sql`); variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_publishable_`, `sb_secret_`.

Modelo mental: com Supabase, o navegador fala direto com o banco (PostgREST em `/rest/v1`, RPC em `/rest/v1/rpc/<fn>`, Storage, Realtime, GraphQL). A chave anon/publishable é pública por desenho. A única barreira entre um usuário e as linhas dos outros é a RLS (e os GRANTs). Então: toda tabela/view/função no schema exposto (por padrão `public`) é uma API pública, com ou sem tela que a use.

Fontes de verdade, nesta ordem: (1) as migrations em `supabase/migrations/` (leia na ordem; uma migration posterior pode desfazer a anterior); (2) `supabase/schemas/*.sql` se usam schema declarativo; (3) se o MCP do Supabase estiver ligado, `get_advisors` (tipo `security`) e `list_tables` mostram o estado real do banco. Se não há SQL no repositório e nem MCP, as políticas vivem só no painel: registre como lacuna de prova (não dá para confirmar nem descartar), não como "seguro".

Sobre `UPDATE ... WITH CHECK`: no Postgres, se a política de UPDATE (ou `for all`) não tem `with check`, a expressão do `using` é usada também como check. Então "faltou with check" só é problema quando o `with check` existe e é frouxo, ou em INSERT (que só tem `with check`).

## supabase-rls-desligada — Tabela exposta sem RLS
- Gravidade típica: crítica se a tabela tem dados de usuários (qualquer pessoa com a chave anon lê, altera e apaga tudo). Baixa se é tabela de referência pública só leitura e os GRANTs de escrita foram revogados.
- Onde procurar: `create table` em `supabase/migrations/*.sql` sem `alter table ... enable row level security` correspondente; tabelas criadas por ORM (Prisma/Drizzle) no schema `public` (migrations do ORM raramente ligam RLS); `disable row level security`. Grep: `create table`, `enable row level security`, `disable row level security`.
- Como confirmar lendo o código: para cada `create table public.X`, procure `alter table public.X enable row level security` em qualquer migration posterior e confira que nenhuma mais nova a desliga. Confirme que o schema da tabela é exposto (`public` é, por padrão; veja `[api] schemas` no `supabase/config.toml`).
- Descarta se: RLS ligada (mesmo sem políticas: RLS ligada sem política nega tudo para anon/authenticated, o que é seguro); ou a tabela está num schema não exposto; ou há `revoke all on table X from anon, authenticated`.
- Não descarta: "o front não consulta essa tabela"; "o app só acessa pelo servidor com service_role" (a API REST continua aberta para a chave anon); RLS ligada no painel mas não nas migrations (confirme pelo MCP ou registre lacuna).
- Como corrigir:
  ```sql
  alter table public.orders enable row level security;
  create policy "dono lê" on public.orders for select to authenticated
    using ((select auth.uid()) = user_id);
  ```
- CWE: CWE-862

## supabase-rls-permissiva — Política `using (true)` ou só `auth.uid() is not null`
- Gravidade típica: crítica em UPDATE/DELETE/INSERT; alta em SELECT de dados pessoais; nenhuma se a tabela é pública por desenho (posts publicados, catálogo).
- Onde procurar: `create policy` com `using (true)`, `with check (true)`, `to public`, `to anon`, `auth.role() = 'authenticated'`, `auth.uid() is not null`, políticas `for all`.
- Como confirmar lendo o código: para cada política, pergunte "quem, além do dono, satisfaz isso?". `auth.uid() is not null` = qualquer usuário cadastrado (e o cadastro costuma ser aberto). Lembre que políticas permissivas se somam com OR: uma política aberta anula a restrita da mesma operação.
- Descarta se: o conteúdo é intencionalmente público e só colunas públicas existem na tabela; ou a política é `as restrictive` e combinada com outra que restringe dono.
- Não descarta: "só usuários logados usam o app"; política restrita de SELECT convivendo com outra `using (true)` de SELECT criada "para testar".
- Como corrigir: trocar por condição de dono/tenant (`(select auth.uid()) = user_id`) e apagar políticas de teste.
- CWE: CWE-284

## supabase-rls-sem-update — Política só de SELECT; esquece INSERT/UPDATE/DELETE, ou a escrita é frouxa
- Gravidade típica: alta a crítica. Se não há política de UPDATE/DELETE, a operação é negada (seguro, mas o app pode estar usando service_role por isso). O problema real é quando existe política de escrita mais frouxa que a de leitura, ou `for all` com condição fraca.
- Onde procurar: agrupe as políticas por tabela e por operação (`for select|insert|update|delete|all`).
- Como confirmar lendo o código: monte a matriz tabela × operação. Para cada operação permitida, confirme a condição de dono. Em INSERT, confira que `with check` amarra `user_id = auth.uid()` (senão o usuário cria linhas em nome de outro). Em UPDATE, confira que o `with check` (se presente) também amarra o dono, senão o usuário transfere a linha para outro dono ou move para outra org.
- Descarta se: cada operação permitida tem `using`/`with check` com `auth.uid()` ou associação ao tenant, e operações não usadas pelo app não têm política.
- Não descarta: SELECT correto (não diz nada sobre UPDATE); `with check (true)` no INSERT de uma tabela com `user_id`.
- Como corrigir:
  ```sql
  create policy "dono cria" on public.notes for insert to authenticated
    with check ((select auth.uid()) = user_id);
  create policy "dono edita" on public.notes for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  create policy "dono apaga" on public.notes for delete to authenticated
    using ((select auth.uid()) = user_id);
  ```
- CWE: CWE-862

## supabase-rls-confia-no-payload — Política, função ou trigger que confia em dado controlado pelo usuário
- Gravidade típica: crítica (inclui o caso clássico de se cadastrar como admin).
- Onde procurar: políticas que comparam com colunas que o próprio usuário grava (`using (is_admin = true)` na própria linha editável; `org_id` que o usuário pode alterar); `auth.jwt() -> 'user_metadata'` ou `raw_user_meta_data` em políticas/funções (o usuário altera `user_metadata` com `supabase.auth.updateUser({ data })` ou no `signUp({ options: { data } })`); `current_setting('request.headers')`. Caso frequente: trigger de cadastro (`handle_new_user`, `security definer`, `after insert on auth.users`) que copia `new.raw_user_meta_data->>'role'` (ou `plan`, `is_admin`, `org_id`, `credits`) para `profiles`.
- Como confirmar lendo o código: para cada valor usado na decisão, descubra quem consegue escrevê-lo. Se o usuário consegue (via UPDATE permitido na tabela, via metadata, via header), a política é contornável.
- Descarta se: a decisão usa só `auth.uid()`, `auth.jwt() -> 'app_metadata'` (gravável só pelo servidor) ou tabelas que o usuário não pode escrever (papéis em tabela sem política de escrita).
- Não descarta: coluna `role` na `profiles` com política "dono edita o próprio perfil" sem restrição por coluna; "o formulário de cadastro não manda role" (o atacante chama `signUp` direto com `options.data`).
- Como corrigir: mover papéis para `app_metadata` ou tabela separada sem escrita pelo cliente; `revoke update (role) on public.profiles from authenticated`; no trigger de cadastro, copiar só campos cosméticos (nome, avatar) e gravar `role` com default fixo `'user'`.
- CWE: CWE-639

## supabase-service-role-exposta — `service_role`/`sb_secret_` no cliente ou em lugar público
- Gravidade típica: crítica (ignora toda a RLS: leitura e escrita de tudo, inclusive `auth.users` via Admin API).
- Onde procurar: `NEXT_PUBLIC_*SERVICE*`, `VITE_*SERVICE*`, `EXPO_PUBLIC_*`; `createClient(url, <service key>)` em arquivo importado por componente com `'use client'`, em `src/` de app Vite/React (tudo vai para o navegador), em `app.config`/`expo`; `sb_secret_`; JWT com `"role":"service_role"` (decodifique o payload se achar um JWT). Também arquivos de build (`.next/static`, `dist/assets`) e `.env` versionado.
- Como confirmar lendo o código: siga o import do arquivo que cria o cliente admin até um componente de cliente. Em Next, arquivo sem `import 'server-only'` importado por algo com `'use client'` vai para o bundle. Em Vite, só variáveis `VITE_` vão ao bundle, mas qualquer segredo escrito literal no código vai.
- Descarta se: a chave só aparece em código de servidor (route handler, Server Action, Edge Function, Worker) lida de env sem prefixo público, e o arquivo do cliente admin tem `import 'server-only'`; a chave encontrada é a anon/publishable (não é segredo).
- Não descarta: "está em env" com prefixo `NEXT_PUBLIC_`; chave em Edge Function que devolve a chave ou o erro completo com headers; chave de outro ambiente (staging) também é segredo.
- Como corrigir: mover o uso para o servidor, criar `lib/supabase/admin.ts` com `import 'server-only'`, e trocar a chave no painel (Settings > API Keys) porque a antiga já vazou.
- CWE: CWE-798

## supabase-service-role-sem-filtro — Servidor usa service_role e não filtra por dono
- Gravidade típica: alta a crítica (é o IDOR clássico: a RLS foi desligada pelo uso da chave).
- Onde procurar: route handlers/Server Actions/Edge Functions que usam o cliente admin para responder a pedidos de usuário. Grep: `SUPABASE_SERVICE_ROLE_KEY`, `createAdminClient`, `supabaseAdmin.from(`.
- Como confirmar lendo o código: para cada consulta com o cliente admin disparada por um usuário, confira que o handler obtém o usuário verificado (`getUser()`) e filtra por ele (`.eq('user_id', user.id)`), sem usar IDs do corpo.
- Descarta se: há o filtro de dono derivado da sessão; ou a rota é interna (cron com segredo, webhook com assinatura).
- Não descarta: "usei service_role porque a RLS estava dando erro" (sinal forte de achado).
- Como corrigir: preferir o cliente do usuário (`createServerClient` com os cookies) para que a RLS valha; usar o admin só para o que exige, com filtro explícito.
- CWE: CWE-639

## supabase-rpc-security-definer — Função `security definer` exposta via RPC sem checar dono
- Gravidade típica: crítica quando a função lê/escreve dados de outros ou muda papéis; alta nos demais casos.
- Onde procurar: `create function ... security definer` em schema exposto (`public`). Parâmetros `p_user_id`, `user_id`, `org_id`, `target_id`. Falta de `set search_path`.
- Como confirmar lendo o código:
  1. Toda função em `public` é chamável por `POST /rest/v1/rpc/<nome>`, e o Postgres dá EXECUTE para `PUBLIC` por padrão (inclui anon).
  2. `security definer` roda como o dono (geralmente `postgres`), ignorando RLS.
  3. Dentro dela, deve haver checagem com `auth.uid()` (e não confiar no parâmetro de usuário), ou o EXECUTE foi revogado de anon/authenticated.
  4. Confira `set search_path = ''` (ou fixo) e nomes qualificados (`public.tabela`), senão um objeto com mesmo nome em outro schema pode ser resolvido.
- Descarta se: a função é `security invoker` (padrão; respeita RLS); ou tem checagem `if auth.uid() is distinct from p_user_id then raise exception` / usa `auth.uid()` em vez do parâmetro; ou `revoke execute on function public.f from public, anon, authenticated` e só o servidor chama; ou a função está num schema não exposto.
- Não descarta: "só o app chama essa função"; checagem feita no front antes de chamar o RPC.
- Como corrigir:
  ```sql
  create or replace function public.transfer_credits(p_to uuid, p_amount int)
  returns void language plpgsql security definer set search_path = '' as $$
  begin
    if p_amount <= 0 then raise exception 'invalid'; end if;
    update public.wallets set balance = balance - p_amount
      where user_id = (select auth.uid()) and balance >= p_amount;
    if not found then raise exception 'saldo'; end if;
    update public.wallets set balance = balance + p_amount where user_id = p_to;
  end $$;
  revoke execute on function public.transfer_credits from public, anon;
  ```
- CWE: CWE-862

## supabase-view-sem-security-invoker — View que ignora a RLS da tabela base
- Gravidade típica: alta (expõe as linhas que a RLS escondia).
- Onde procurar: `create view` / `create or replace view` em `public` sem `with (security_invoker = on)` (ou `security_invoker = true`); views materializadas em `public` (não têm RLS).
- Como confirmar lendo o código: views do Postgres, por padrão, rodam com as permissões do dono (postgres) e ignoram a RLS das tabelas por baixo. Verifique a opção na criação ou num `alter view ... set (security_invoker = on)` posterior.
- Descarta se: `security_invoker = on`; ou a view só expõe dados públicos; ou `revoke select on public.v from anon, authenticated`.
- Não descarta: "a tabela base tem RLS" (é justamente o que a view contorna).
- Como corrigir: `alter view public.v set (security_invoker = on);`; materialized view: mover para schema não exposto.
- CWE: CWE-863

## supabase-colunas-sensiveis — Colunas sensíveis legíveis por quem pode ver a linha
- Gravidade típica: média a alta (e-mail, telefone, CPF, endereço, tokens, `stripe_customer_id`, notas internas).
- Onde procurar: tabelas como `profiles`/`users` com política de SELECT ampla ("todos os logados veem perfis") e colunas pessoais na mesma tabela; front que faz `select('*')`.
- Como confirmar lendo o código: RLS filtra linhas, não colunas. Se a linha é legível por outros, todas as colunas são, mesmo que a tela mostre só o nome.
- Descarta se: dados privados estão numa tabela separada com RLS de dono; ou há GRANT por coluna (`revoke select on profiles from authenticated; grant select (id, name, avatar_url) on profiles to authenticated`).
- Não descarta: o front seleciona só `name` (o atacante seleciona `*`).
- Como corrigir: separar `profiles` (público) de `profiles_private` (dono), ou GRANT por coluna.
- CWE: CWE-200

## supabase-storage-policies — Bucket público ou política de Storage sem dono
- Gravidade típica: alta para documentos pessoais; crítica se escrita/exclusão é aberta; baixa para avatares/imagens públicas.
- Onde procurar: `insert into storage.buckets (id, name, public) values (..., true)`; políticas em `storage.objects`; uploads com `supabase.storage.from(bucket).upload(path, ...)` com `path` vindo do cliente; `getPublicUrl` para arquivos privados.
- Como confirmar lendo o código: bucket `public = true` serve qualquer objeto pela URL pública sem política. Nos privados, as políticas de `storage.objects` devem amarrar `bucket_id` e o dono, tipicamente pela primeira pasta do caminho.
- Descarta se: bucket privado e políticas como `bucket_id = 'docs' and (storage.foldername(name))[1] = (select auth.uid())::text` para select/insert/update/delete; ou bucket público só com conteúdo público.
- Não descarta: política de INSERT com dono, mas SELECT `using (bucket_id = 'docs')` (todos leem tudo); caminho montado com `userId` do cliente; tipo de arquivo não restrito (HTML/SVG enviado e servido; ver `api-e-abuso.md`).
- Como corrigir:
  ```sql
  create policy "dono lê docs" on storage.objects for select to authenticated
    using (bucket_id = 'docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
  ```
- CWE: CWE-284

## supabase-edge-function-confia-no-header — Edge Function sem verificar o usuário
- Gravidade típica: alta a crítica (Edge Functions quase sempre usam service_role).
- Onde procurar: `supabase/functions/*/index.ts`; `[functions.<nome>] verify_jwt = false` em `supabase/config.toml`; leitura de `userId` do corpo; `req.headers.get('x-user-id')`; decode manual do `Authorization`.
- Como confirmar lendo o código: a função deve obter o usuário a partir do `Authorization` verificado (`createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization')! } } })` e então `await supabase.auth.getUser()`), e usar esse `user.id` nas consultas. Com `verify_jwt` ligado, a plataforma checa só que o JWT é válido; a chave anon também é um JWT válido (legado), então isso não prova que há um usuário logado.
- Descarta se: `getUser()`/`getClaims()` e checagem de `user` não nulo antes do trabalho; ou a função é webhook/cron que verifica assinatura ou segredo próprio.
- Não descarta: `verify_jwt = true` sozinho; CORS `*` com ação sensível; resposta de erro com `error` completo.
- Como corrigir: obter `user` como acima, `if (!user) return new Response('unauthorized', { status: 401 })`, filtrar por `user.id`.
- CWE: CWE-306

## supabase-realtime-canal — Realtime vazando mudanças ou canais sem autorização
- Gravidade típica: média a alta.
- Onde procurar: `supabase.channel(`, `postgres_changes`, `broadcast`, `presence`, publicação `supabase_realtime` nas migrations (`alter publication supabase_realtime add table`).
- Como confirmar lendo o código: `postgres_changes` respeita a RLS de SELECT da tabela (então herda os problemas dela). Broadcast/presence só são autorizados em canais privados (`supabase.channel('room', { config: { private: true } })`) com políticas em `realtime.messages`; canais públicos são abertos a quem tem a chave anon.
- Descarta se: RLS de SELECT correta na tabela publicada; canais com dado privado são `private: true` com política.
- Não descarta: nome de canal "difícil de adivinhar" (`room:${userId}`).
- Como corrigir: canais privados + políticas em `realtime.messages`; não publicar tabelas sem RLS.
- CWE: CWE-284
