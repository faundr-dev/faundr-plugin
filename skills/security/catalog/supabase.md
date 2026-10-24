# Supabase
When to read: `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/auth-helpers-*` in `package.json`; `supabase/` folder (`migrations/*.sql`, `functions/*/index.ts`, `config.toml`, `seed.sql`); variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_publishable_`, `sb_secret_`.

Mental model: with Supabase, the browser talks directly to the database (PostgREST at `/rest/v1`, RPC at `/rest/v1/rpc/<fn>`, Storage, Realtime, GraphQL). The anon/publishable key is public by design. The only barrier between a user and other people's rows is RLS (and GRANTs). So: every table/view/function in the exposed schema (by default `public`) is a public API, whether or not a screen uses it.

Sources of truth, in this order: (1) the migrations in `supabase/migrations/` (read them in order; a later migration can undo an earlier one); (2) `supabase/schemas/*.sql` if they use a declarative schema; (3) if the Supabase MCP is connected, `get_advisors` (type `security`) and `list_tables` show the real state of the database. If there is no SQL in the repository and no MCP, the policies live only in the dashboard: record it as a proof gap (it can be neither confirmed nor ruled out), not as "safe".

About `UPDATE ... WITH CHECK`: in Postgres, if the UPDATE (or `for all`) policy has no `with check`, the `using` expression is also used as the check. So "missing with check" is only a problem when the `with check` exists and is loose, or on INSERT (which only has `with check`).

## supabase-rls-desligada — Exposed table without RLS
- Typical severity: critical if the table has user data (anyone with the anon key reads, changes and deletes everything). Low if it is a public read-only reference table and write GRANTs were revoked.
- Where to look: `create table` in `supabase/migrations/*.sql` without a matching `alter table ... enable row level security`; tables created by an ORM (Prisma/Drizzle) in the `public` schema (ORM migrations rarely enable RLS); `disable row level security`. Grep: `create table`, `enable row level security`, `disable row level security`.
- How to confirm by reading the code: for each `create table public.X`, look for `alter table public.X enable row level security` in any later migration and check that no newer one disables it. Confirm the table's schema is exposed (`public` is, by default; see `[api] schemas` in `supabase/config.toml`).
- Ruled out if: RLS enabled (even without policies: RLS enabled without a policy denies everything to anon/authenticated, which is safe); or the table is in a non-exposed schema; or there is `revoke all on table X from anon, authenticated`.
- Does not rule out: "the front end does not query that table"; "the app only accesses it from the server with service_role" (the REST API stays open to the anon key); RLS enabled in the dashboard but not in the migrations (confirm through the MCP or record a gap).
- How to fix:
  ```sql
  alter table public.orders enable row level security;
  create policy "dono lê" on public.orders for select to authenticated
    using ((select auth.uid()) = user_id);
  ```
- CWE: CWE-862

## supabase-rls-permissiva — Policy `using (true)` or only `auth.uid() is not null`
- Typical severity: critical on UPDATE/DELETE/INSERT; high on SELECT of personal data; none if the table is public by design (published posts, catalog).
- Where to look: `create policy` with `using (true)`, `with check (true)`, `to public`, `to anon`, `auth.role() = 'authenticated'`, `auth.uid() is not null`, `for all` policies.
- How to confirm by reading the code: for each policy, ask "who, besides the owner, satisfies this?". `auth.uid() is not null` = any registered user (and sign-up is usually open). Remember that permissive policies combine with OR: one open policy cancels the restricted one for the same operation.
- Ruled out if: the content is intentionally public and only public columns exist in the table; or the policy is `as restrictive` and combined with another that restricts to the owner.
- Does not rule out: "only logged-in users use the app"; a restricted SELECT policy living alongside another `using (true)` SELECT policy created "for testing".
- How to fix: replace it with an owner/tenant condition (`(select auth.uid()) = user_id`) and delete test policies.
- CWE: CWE-284

## supabase-rls-sem-update — SELECT-only policy; forgets INSERT/UPDATE/DELETE, or writes are loose
- Typical severity: high to critical. If there is no UPDATE/DELETE policy, the operation is denied (safe, but the app may be using service_role because of that). The real problem is when a write policy is looser than the read one, or `for all` with a weak condition.
- Where to look: group the policies by table and by operation (`for select|insert|update|delete|all`).
- How to confirm by reading the code: build the table × operation matrix. For each allowed operation, confirm the owner condition. On INSERT, check that `with check` ties `user_id = auth.uid()` (otherwise the user creates rows on behalf of someone else). On UPDATE, check that the `with check` (if present) also ties the owner, otherwise the user transfers the row to another owner or moves it to another org.
- Ruled out if: each allowed operation has `using`/`with check` with `auth.uid()` or tenant membership, and operations the app does not use have no policy.
- Does not rule out: a correct SELECT (says nothing about UPDATE); `with check (true)` on INSERT into a table with `user_id`.
- How to fix:
  ```sql
  create policy "dono cria" on public.notes for insert to authenticated
    with check ((select auth.uid()) = user_id);
  create policy "dono edita" on public.notes for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  create policy "dono apaga" on public.notes for delete to authenticated
    using ((select auth.uid()) = user_id);
  ```
- CWE: CWE-862

## supabase-rls-confia-no-payload — Policy, function or trigger that trusts user-controlled data
- Typical severity: critical (includes the classic case of signing up as admin).
- Where to look: policies that compare against columns the user writes themselves (`using (is_admin = true)` on the editable row itself; `org_id` the user can change); `auth.jwt() -> 'user_metadata'` or `raw_user_meta_data` in policies/functions (the user changes `user_metadata` with `supabase.auth.updateUser({ data })` or in `signUp({ options: { data } })`); `current_setting('request.headers')`. Frequent case: a sign-up trigger (`handle_new_user`, `security definer`, `after insert on auth.users`) that copies `new.raw_user_meta_data->>'role'` (or `plan`, `is_admin`, `org_id`, `credits`) into `profiles`.
- How to confirm by reading the code: for each value used in the decision, find out who can write it. If the user can (via an allowed UPDATE on the table, via metadata, via a header), the policy can be bypassed.
- Ruled out if: the decision uses only `auth.uid()`, `auth.jwt() -> 'app_metadata'` (writable only by the server) or tables the user cannot write (roles in a table without a write policy).
- Does not rule out: a `role` column in `profiles` with an "owner edits own profile" policy without a per-column restriction; "the sign-up form does not send role" (the attacker calls `signUp` directly with `options.data`).
- How to fix: move roles to `app_metadata` or a separate table without client writes; `revoke update (role) on public.profiles from authenticated`; in the sign-up trigger, copy only cosmetic fields (name, avatar) and write `role` with a fixed default `'user'`.
- CWE: CWE-639

## supabase-service-role-exposta — `service_role`/`sb_secret_` in the client or in a public place
- Typical severity: critical (bypasses all RLS: reads and writes everything, including `auth.users` via the Admin API).
- Where to look: `NEXT_PUBLIC_*SERVICE*`, `VITE_*SERVICE*`, `EXPO_PUBLIC_*`; `createClient(url, <service key>)` in a file imported by a component with `'use client'`, in `src/` of a Vite/React app (everything goes to the browser), in `app.config`/`expo`; `sb_secret_`; a JWT with `"role":"service_role"` (decode the payload if you find a JWT). Also build files (`.next/static`, `dist/assets`) and a versioned `.env`.
- How to confirm by reading the code: follow the import of the file that creates the admin client up to a client component. In Next, a file without `import 'server-only'` imported by something with `'use client'` goes into the bundle. In Vite, only `VITE_` variables go into the bundle, but any secret written literally in the code does.
- Ruled out if: the key only appears in server code (route handler, Server Action, Edge Function, Worker) read from env without a public prefix, and the admin client file has `import 'server-only'`; the key found is the anon/publishable one (not a secret).
- Does not rule out: "it is in env" with a `NEXT_PUBLIC_` prefix; a key in an Edge Function that returns the key or the full error with headers; a key from another environment (staging) is also a secret.
- How to fix: move the usage to the server, create `lib/supabase/admin.ts` with `import 'server-only'`, and rotate the key in the dashboard (Settings > API Keys) because the old one has already leaked.
- CWE: CWE-798

## supabase-service-role-sem-filtro — Server uses service_role and does not filter by owner
- Typical severity: high to critical (it is the classic IDOR: RLS was turned off by using the key).
- Where to look: route handlers/Server Actions/Edge Functions that use the admin client to answer user requests. Grep: `SUPABASE_SERVICE_ROLE_KEY`, `createAdminClient`, `supabaseAdmin.from(`.
- How to confirm by reading the code: for each query with the admin client triggered by a user, check that the handler gets the verified user (`getUser()`) and filters by them (`.eq('user_id', user.id)`), without using IDs from the body.
- Ruled out if: there is an owner filter derived from the session; or the route is internal (cron with a secret, webhook with a signature).
- Does not rule out: "I used service_role because RLS was throwing errors" (a strong sign of a finding).
- How to fix: prefer the user's client (`createServerClient` with the cookies) so RLS applies; use the admin client only for what requires it, with an explicit filter.
- CWE: CWE-639

## supabase-rpc-security-definer — `security definer` function exposed via RPC without checking the owner
- Typical severity: critical when the function reads/writes other people's data or changes roles; high in other cases.
- Where to look: `create function ... security definer` in an exposed schema (`public`). Parameters `p_user_id`, `user_id`, `org_id`, `target_id`. Missing `set search_path`.
- How to confirm by reading the code:
  1. Every function in `public` is callable via `POST /rest/v1/rpc/<name>`, and Postgres grants EXECUTE to `PUBLIC` by default (includes anon).
  2. `security definer` runs as the owner (usually `postgres`), bypassing RLS.
  3. Inside it, there must be a check with `auth.uid()` (and not trusting the user parameter), or EXECUTE was revoked from anon/authenticated.
  4. Check `set search_path = ''` (or fixed) and qualified names (`public.table`), otherwise an object with the same name in another schema may be resolved.
- Ruled out if: the function is `security invoker` (the default; respects RLS); or it has a check `if auth.uid() is distinct from p_user_id then raise exception` / uses `auth.uid()` instead of the parameter; or `revoke execute on function public.f from public, anon, authenticated` and only the server calls it; or the function is in a non-exposed schema.
- Does not rule out: "only the app calls that function"; a check done in the front end before calling the RPC.
- How to fix:
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

## supabase-view-sem-security-invoker — View that ignores the base table's RLS
- Typical severity: high (exposes the rows RLS was hiding).
- Where to look: `create view` / `create or replace view` in `public` without `with (security_invoker = on)` (or `security_invoker = true`); materialized views in `public` (they have no RLS).
- How to confirm by reading the code: Postgres views, by default, run with the owner's (postgres) permissions and ignore the RLS of the underlying tables. Check the option at creation or in a later `alter view ... set (security_invoker = on)`.
- Ruled out if: `security_invoker = on`; or the view only exposes public data; or `revoke select on public.v from anon, authenticated`.
- Does not rule out: "the base table has RLS" (that is exactly what the view bypasses).
- How to fix: `alter view public.v set (security_invoker = on);`; materialized view: move it to a non-exposed schema.
- CWE: CWE-863

## supabase-colunas-sensiveis — Sensitive columns readable by whoever can see the row
- Typical severity: medium to high (email, phone, CPF, address, tokens, `stripe_customer_id`, internal notes).
- Where to look: tables like `profiles`/`users` with a broad SELECT policy ("all logged-in users see profiles") and personal columns in the same table; a front end doing `select('*')`.
- How to confirm by reading the code: RLS filters rows, not columns. If the row is readable by others, all columns are, even if the screen only shows the name.
- Ruled out if: private data is in a separate table with owner RLS; or there is a per-column GRANT (`revoke select on profiles from authenticated; grant select (id, name, avatar_url) on profiles to authenticated`).
- Does not rule out: the front end selects only `name` (the attacker selects `*`).
- How to fix: split `profiles` (public) from `profiles_private` (owner), or per-column GRANT.
- CWE: CWE-200

## supabase-storage-policies — Public bucket or Storage policy without an owner
- Typical severity: high for personal documents; critical if write/delete is open; low for public avatars/images.
- Where to look: `insert into storage.buckets (id, name, public) values (..., true)`; policies on `storage.objects`; uploads with `supabase.storage.from(bucket).upload(path, ...)` with `path` coming from the client; `getPublicUrl` for private files.
- How to confirm by reading the code: a bucket with `public = true` serves any object through the public URL without a policy. In private ones, the `storage.objects` policies must tie `bucket_id` and the owner, typically through the first folder of the path.
- Ruled out if: private bucket and policies like `bucket_id = 'docs' and (storage.foldername(name))[1] = (select auth.uid())::text` for select/insert/update/delete; or a public bucket with only public content.
- Does not rule out: INSERT policy with an owner, but SELECT `using (bucket_id = 'docs')` (everyone reads everything); path built with the client's `userId`; file type not restricted (HTML/SVG uploaded and served; see `api-and-abuse.md`).
- How to fix:
  ```sql
  create policy "dono lê docs" on storage.objects for select to authenticated
    using (bucket_id = 'docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
  ```
- CWE: CWE-284

## supabase-edge-function-confia-no-header — Edge Function without verifying the user
- Typical severity: high to critical (Edge Functions almost always use service_role).
- Where to look: `supabase/functions/*/index.ts`; `[functions.<name>] verify_jwt = false` in `supabase/config.toml`; reading `userId` from the body; `req.headers.get('x-user-id')`; manual decoding of `Authorization`.
- How to confirm by reading the code: the function must get the user from the verified `Authorization` (`createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization')! } } })` and then `await supabase.auth.getUser()`), and use that `user.id` in the queries. With `verify_jwt` on, the platform only checks that the JWT is valid; the anon key is also a valid JWT (legacy), so that does not prove there is a logged-in user.
- Ruled out if: `getUser()`/`getClaims()` and a non-null `user` check before the work; or the function is a webhook/cron that verifies its own signature or secret.
- Does not rule out: `verify_jwt = true` alone; CORS `*` with a sensitive action; an error response with the full `error`.
- How to fix: get `user` as above, `if (!user) return new Response('unauthorized', { status: 401 })`, filter by `user.id`.
- CWE: CWE-306

## supabase-realtime-canal — Realtime leaking changes or channels without authorization
- Typical severity: medium to high.
- Where to look: `supabase.channel(`, `postgres_changes`, `broadcast`, `presence`, the `supabase_realtime` publication in migrations (`alter publication supabase_realtime add table`).
- How to confirm by reading the code: `postgres_changes` respects the table's SELECT RLS (so it inherits its problems). Broadcast/presence are only authorized in private channels (`supabase.channel('room', { config: { private: true } })`) with policies on `realtime.messages`; public channels are open to anyone with the anon key.
- Ruled out if: correct SELECT RLS on the published table; channels with private data are `private: true` with a policy.
- Does not rule out: a "hard to guess" channel name (`room:${userId}`).
- How to fix: private channels + policies on `realtime.messages`; do not publish tables without RLS.
- CWE: CWE-284
