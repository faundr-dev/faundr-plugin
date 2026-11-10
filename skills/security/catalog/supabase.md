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
  Then, for every INSERT **and** every UPDATE policy, list the columns the server should own (plan, credits, limits and counters, `paused_at`, `created_by`/`owner_id`/`org_id`/`project_id`, `assignee_id`, file paths like `image_path`/`avatar_path`, ingest keys and tokens, flags that make something run, like `run_now`/`approved`) and look for what stops the client from writing them: a per-column GRANT (`revoke insert, update on t from authenticated; grant insert (name, body) on t to authenticated; grant update (name) on t to authenticated`) or a BEFORE INSERT/UPDATE trigger. Supabase grants every privilege on new `public` tables to `anon` and `authenticated` by default, so without a `revoke` every column is writable wherever a policy lets the row through. A policy that only checks the role or the membership lets every column be set. Compare INSERT and UPDATE with each other: a lock that only exists on INSERT (`with check (created_by = auth.uid() and (not run_now or assignee_id = auth.uid()))`) is undone by an UPDATE right after, and a per-column GRANT only on UPDATE is undone by creating the row already with the forbidden value (a member inserts a request with `image_path` pointing to another tenant's file, or a project with `owner_id` of someone else and `paused_at` set).
- Ruled out if: each allowed operation has `using`/`with check` with `auth.uid()` or tenant membership, operations the app does not use have no policy, and the server-owned columns have a per-column GRANT or a trigger on **both** INSERT and UPDATE (or a `default` the client cannot override plus no grant on that column).
- Does not rule out: a correct SELECT (says nothing about UPDATE); `with check (true)` on INSERT into a table with `user_id`; an UPDATE policy that checks the role but not the columns ("admins edit org" also lets the admin change `plan`); a lock on INSERT with no matching lock on UPDATE, or the reverse; a column `default` (the client can send the column and override it); "the panel only sends `name`" (the attacker calls the REST API with the public key and their own login).
- How to fix:
  ```sql
  create policy "dono cria" on public.notes for insert to authenticated
    with check ((select auth.uid()) = user_id);
  create policy "dono edita" on public.notes for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  create policy "dono apaga" on public.notes for delete to authenticated
    using ((select auth.uid()) = user_id);
  -- columns: the client writes only what the screen edits; the rest comes from defaults or the server
  revoke insert, update on public.notes from anon, authenticated;
  grant insert (title, body) on public.notes to authenticated;
  grant update (title, body) on public.notes to authenticated;
  ```
- CWE: CWE-862

## supabase-linha-muda-de-tenant — UPDATE moves a row to another owner, project or organization
- Typical severity: high (data of tenant A ends up in tenant B, or a row is pulled out of a tenant where it was audited/limited and placed where the user has more power); critical if moving the row changes who can read a sensitive record or bypasses a plan limit.
- Where to look: UPDATE policies on tables with a tenant key (`org_id`, `project_id`, `team_id`, `workspace_id`, `owner_id`) whose `using` and `with check` are the same membership function (`using (can_edit(project_id)) with check (can_edit(project_id))`); tables without a per-column UPDATE grant.
- How to confirm by reading the code: `using` is evaluated on the **old** row and `with check` on the **new** row. A member of two projects passes both: `using` (member of the old one) and `with check` (member of the new one). Nothing compares old and new, so `update findings set project_id = '<other project>'` is allowed. Ask, for each tenant key: should it ever change after insert? Usually not.
- Ruled out if: the tenant column is not in the UPDATE grant (`grant update (title, status) …` without `project_id`), or a BEFORE UPDATE trigger refuses `new.project_id is distinct from old.project_id`, or there is no UPDATE policy at all.
- Does not rule out: `with check` repeating the membership check (it only proves the destination is also yours); "the screen has no way to change the project".
- How to fix:
  ```sql
  -- bad: both sides pass for whoever is a member of the two projects
  create policy "edit" on public.findings for update to authenticated
    using (public.can_edit(project_id)) with check (public.can_edit(project_id));
  -- good: the tenant key is not writable after insert
  revoke update on public.findings from authenticated;
  grant update (status, note) on public.findings to authenticated;
  ```
- CWE: CWE-639

## supabase-guarda-com-null — Role guard that lets NULL through (non-member passes the check)
- Typical severity: critical when the guarded action changes roles, owners or members (any registered account becomes owner of any organization); high for other actions.
- Where to look: `security definer` functions and triggers in PL/pgSQL that read a role into a variable and test it with a negative comparison: `if my_role not in ('owner','admin') then raise`, `if my_role <> 'owner' then raise`, `if not is_admin then raise` where `is_admin` comes from a lookup; CHECK constraints with the same shape. Helpers like `org_role(org)`, `get_role(...)`, `select role into me from members where …`.
- How to confirm by reading the code: simulate a caller who is **not a member** (and, if the function is not revoked from `anon`, a visitor with `auth.uid()` NULL). The lookup returns no row, so the variable is NULL. In SQL, `NULL not in (...)`, `NULL <> 'x'` and `not NULL` are all NULL, and `if NULL then` does **not** run the branch: the `raise` is skipped and the function goes on to change the data. (In an RLS `using`/`with check`, NULL counts as false and denies, which is safe; the trap is in `if` inside functions and triggers, and in CHECK constraints, where NULL passes.) Also simulate the member with the lowest role, and an admin trying to promote someone to owner, demote an owner or remove an owner: who may create or touch an owner should be decided explicitly.
- Ruled out if: the guard is written so NULL fails (`if my_role is null or my_role not in (...)`, `if my_role is distinct from 'owner'`, `if not coalesce(is_admin, false)`, or a positive test `if my_role in ('owner','admin') then … else raise`); and `auth.uid() is null` is refused at the start (or execute is revoked from `anon`).
- Does not rule out: `revoke execute … from public, anon` (any logged-in account, including a free second account, is still `authenticated`); "only members see the button"; a test suite that only calls the function as a member.
- How to fix:
  ```sql
  -- bad: a non-member has me = NULL, the if is skipped and the role changes
  me := public.org_role(p_org);
  if me not in ('owner','admin') then raise exception 'forbidden'; end if;
  -- good: NULL fails, and only an owner creates or touches an owner
  if auth.uid() is null then raise exception 'login required'; end if;
  me := public.org_role(p_org);
  if me is null or me not in ('owner','admin') then raise exception 'forbidden'; end if;
  if (current_role = 'owner' or p_new_role = 'owner') and me is distinct from 'owner' then
    raise exception 'only an owner changes owners';
  end if;
  ```
- CWE: CWE-863

## supabase-gatilho-de-guarda-incompleto — Guard trigger that looks at the wrong row or does not fire
- Typical severity: high (the guard looks like protection and is bypassed in two steps); critical if it guards roles, owners or money.
- Where to look: `create trigger … before update of col_a, col_b on t` and their functions; guards like `if new.kind = 'feature' and new.assignee_id <> old.assignee_id and not is_owner() then raise`; triggers that exist only for UPDATE but not INSERT (or only `for each statement`); `when (…)` clauses on the trigger.
- How to confirm by reading the code:
  1. **Which row decides?** If the rule depends on the state of the record ("only the owner changes the assignee of a feature"), it must read `old` (what the row is) and also `new` (what it becomes). A guard that tests only `new.kind` is bypassed by changing `kind` to something unguarded, changing the protected column, and changing `kind` back, three UPDATEs, each one allowed.
  2. **When does it fire?** `before update of a, b` only runs when `a` or `b` appear in the UPDATE's SET list; if the rule also depends on column `c`, an UPDATE that only sets `c` skips it. A `when (old.x is distinct from new.x)` clause has the same effect.
  3. **Which operations?** A guard only on UPDATE is bypassed by an INSERT with the forbidden value (or a DELETE + INSERT).
  4. Simulate a regular member changing each guarded column alone, together with another column, and in several steps.
- Ruled out if: the guard reads `old` for the current state and `new` for the result, refuses any change to the protected columns by someone without the role regardless of other columns, fires on INSERT and UPDATE with no column list (or a list covering every column the rule reads); or per-column GRANTs make the columns unwritable.
- Does not rule out: "the screen changes one column at a time"; a test that tries only the single-step change.
- How to fix:
  ```sql
  -- bad: fires only when assignee_id is in the SET, and trusts new.kind
  create trigger guard before update of assignee_id on public.items
    for each row execute function guard_assignee();
  -- inside: if new.kind = 'feature' and new.assignee_id is distinct from old.assignee_id ...
  -- good: fires on every insert/update and judges by the old state too
  create trigger guard before insert or update on public.items
    for each row execute function guard_assignee();
  -- inside: if (tg_op = 'UPDATE' and (old.kind = 'feature' or new.kind = 'feature')
  --            and (new.assignee_id, new.kind) is distinct from (old.assignee_id, old.kind)
  --            and not public.is_owner(new.org_id)) then raise exception 'forbidden'; end if;
  ```
- CWE: CWE-863

## supabase-cascade-apaga-dado-do-time — Deleting one person's account deletes data that belongs to the team
- Typical severity: high (one account deletion, by the person or by an admin, wipes projects, history and files the whole organization uses); medium if the data is personal anyway.
- Where to look: foreign keys to `auth.users(id)` or `profiles(id)` with `on delete cascade` on shared tables: `projects.owner_id`, `documents.created_by`, `orgs.created_by`; the account deletion route (`auth.admin.deleteUser`). Read the latest migration that touches each FK: a later `alter table … drop constraint … add constraint` can change it.
- How to confirm by reading the code: for each FK to the user, ask: is the row the person's own (their settings, their tokens) or the team's (a project in an organization, a document others edit)? Cascade on the team's rows means "whoever created it takes it away when leaving". Follow the chain: the deleted project cascades to its children too.
- Ruled out if: shared rows reference the user with `on delete set null` (column nullable) or `on delete restrict` with a transfer step, and ownership is decided by membership in the organization, not by the creator column.
- Does not rule out: "people do not delete their accounts"; a soft delete of the user while the FK still cascades on a hard delete by support or by a privacy request.
- How to fix:
  ```sql
  -- bad
  owner_id uuid not null references auth.users(id) on delete cascade
  -- good: the project stays with the organization; the creator becomes NULL
  alter table public.projects alter column owner_id drop not null;
  alter table public.projects drop constraint projects_owner_id_fkey,
    add constraint projects_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null;
  ```
- CWE: CWE-404

## supabase-invariante-sem-trava — "Last owner", quota or uniqueness checked and then changed without a lock
- Typical severity: medium (an organization without an owner nobody can administer, a quota exceeded, a duplicate); high if the result leaves data with nobody able to manage or delete it.
- Where to look: functions that count before changing: `select count(*) into n from members where role = 'owner'; if n <= 1 then raise; end if; delete …`; "leave organization", "demote", "remove member", "use credit", "reserve seat".
- How to confirm by reading the code: two calls at the same time (two owners leaving together, two demotions) both read `n = 2`, both pass, both change: zero owners. Under the default `read committed`, a plain SELECT does not lock anything.
- Ruled out if: the function takes a lock before counting (`perform pg_advisory_xact_lock(hashtext('org-owners:' || p_org::text))`, or `select … for update` on the organization row), or the transaction runs as `serializable` and the caller retries on conflict.
- Does not rule out: "it is rare for two owners to leave at the same time" (a double click or a retry is enough); folding the count into the same statement (`delete … where (select count(*) …) > 1`), which is still racy under `read committed`.
- How to fix:
  ```sql
  perform pg_advisory_xact_lock(hashtext('org-owners:' || p_org::text));
  select count(*) into n from public.members where org_id = p_org and role = 'owner';
  if n <= 1 and v_target_role = 'owner' then raise exception 'last owner'; end if;
  ```
- CWE: CWE-362

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
  5. Simulate three callers and follow each `if`: a visitor (`auth.uid()` NULL, if `anon` still has execute), a logged-in account that is **not a member** of the org/project in the parameters (role lookups return NULL: see `supabase-guarda-com-null`), and a member with the lowest role. For functions that change roles or members, also an admin trying to create, demote or remove an owner.
- Ruled out if: the function is `security invoker` (the default; respects RLS); or it has a check `if auth.uid() is distinct from p_user_id then raise exception` / uses `auth.uid()` instead of the parameter; or `revoke execute on function public.f from public, anon, authenticated` and only the server calls it; or the function is in a non-exposed schema.
- Does not rule out: "only the app calls that function"; a check done in the front end before calling the RPC; `revoke … from public, anon` alone (every free account is still `authenticated`); a role check written as `not in (...)`/`<>` on a value that is NULL for non-members.
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
- Does not rule out: INSERT policy with an owner, but SELECT `using (bucket_id = 'docs')` (everyone reads everything); path built with the client's `userId`; file type not restricted (HTML/SVG uploaded and served; see `api-and-abuse.md`); correct Storage policies when the **server** signs or downloads with service_role a path read from a table the client writes (the policies do not apply to service_role; see `access-and-idor.md` → `arquivo-e-url-assinada`).
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
