# Access to other users' data (IDOR, BFLA, multi-tenant, mass assignment)
When to read: whenever the app has login and stores data per user, team, organization or workspace. Signs: routes with `[id]`, `:id`, `params.id`, `searchParams.get('id')`; tables with `user_id`, `owner_id`, `org_id`, `team_id`, `tenant_id`; admin panel; roles (`role`, `isAdmin`, `plan`). If data access goes only through Supabase RLS or Firebase rules, also read `supabase.md` or `firebase.md` (the database check is there; the server code check is here).

Golden rule: every ID that comes from the client (path, query, body, header, unsigned cookie) is untrusted until the code proves the object belongs to the caller. The owner comes from the session verified on the server, never from the payload.

## idor-leitura-por-id — Fetch an object by ID without checking the owner
- Typical severity: high. Goes up to critical if the object has PII, financial data, documents or secrets, or if the IDs are sequential/listable. Goes down to medium if the data is not very sensitive and the ID is a UUID that does not leak anywhere (a UUID is not a control, it only reduces the odds).
- Where to look: `app/api/**/[id]/route.ts`, `pages/api/**/[id].ts`, Express/Hono routes with `:id`, Server Actions that receive an `id`, TanStack Start/Remix loaders. Grep: `findUnique\(\{ where: \{ id`, `findById(`, `.eq('id',`, `where(eq(.*\.id,`, `WHERE id = `, `params.id`, `req.params.id`, `c.req.param('id')`.
- How to confirm by reading the code:
  1. Find the handler and the point where the object is loaded.
  2. Look, BEFORE returning or changing it, for one of two things: (a) the owner filter in the query itself (`where: { id, userId: session.user.id }`), or (b) an explicit comparison after loading (`if (doc.ownerId !== session.user.id) return 403`).
  3. Confirm that `session.user.id` comes from the session verified on the server (see `authentication.md`), not from `body.userId`.
  4. If it uses Supabase with the anon key + the user's JWT, the protection may be in RLS: go to `supabase.md` and confirm the table's policy.
- Ruled out if: the query filters by owner/tenant derived from the session (`where: { id, ownerId: user.id }`, `.eq('user_id', user.id)` with `user` coming from `supabase.auth.getUser()`), or there is the explicit comparison before the response, or the read uses the user's Supabase client and the table has SELECT RLS with `auth.uid()`; or the resource is public by design (published post, public profile) and only public fields go out.
- Does not rule out: a check only on the page (the front end hides the button); a check on a sibling route (the list route filters, the detail one does not); middleware that only checks "is logged in"; an "impossible to guess" UUID (it leaks in URLs, emails, listings, logs); a Supabase client with `service_role` on the server (bypasses RLS, so the filter must be in the code); a check done after the object was already returned.
- How to fix: put the owner in the query, derived from the session.
  ```ts
  const user = await requireUser();            // throws 401 if not logged in
  const doc = await db.document.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!doc) return new Response('Not found', { status: 404 });
  ```
- CWE: CWE-639

## idor-escrita-e-exclusao — Change or delete another user's object
- Typical severity: high to critical (integrity and data loss). Critical when it allows mass deletion or changing payment, login email or permissions.
- Where to look: `PUT`/`PATCH`/`DELETE` handlers, `update*`/`delete*`/`remove*` Server Actions, `/api/*/[id]` routes with a write method. Grep: `update({ where: { id`, `delete({ where: { id`, `.update(`...`).eq('id'`, `.delete().eq('id'`, `findByIdAndUpdate(`, `findByIdAndDelete(`, `UPDATE .* WHERE id`.
- How to confirm by reading the code: same as reading, but teams often protect GET and forget writes. Read each verb separately. See whether the update/delete `where` includes the owner or whether there is a prior read with an owner check in the same function.
- Ruled out if: `where: { id, ownerId: user.id }` in the update/delete itself (and the code treats "0 rows affected" as 404), or `updateMany`/`deleteMany` with an owner filter, or UPDATE/DELETE RLS with `auth.uid()` in Supabase with the user's client.
- Does not rule out: reading with the owner and then updating only by `id` in another call that can receive another ID; a check only on the GET of the same route; the delete button only shows up for the owner.
- How to fix: owner filter in the write command itself; for Prisma, `update` requires a unique field, so use `updateMany({ where: { id, ownerId } })` and check `count`, or fetch with the owner and update in the same transaction.
- CWE: CWE-639

## idor-listagem-e-export — Listing, search or export without an owner filter
- Typical severity: critical when it returns all users' data at once (mass leak); high in other cases.
- Where to look: routes `list`, `search`, `export`, `report`, `csv`, `download`, admin endpoints reused by the app, `findMany()` without `where`, `select('*')` without `.eq`, filters coming from the client (`?userId=`, `?orgId=`, `?filter=`), cursor pagination.
- How to confirm by reading the code: verify that the `where` of every listing includes the session's owner/tenant and whether the client can override that filter (e.g.: `where: { ...req.query }` or `{ userId: req.query.userId ?? user.id }`).
- Ruled out if: the owner/tenant filter is applied by the server and the client's value is ignored or validated against the session; or the read goes through the user's Supabase client with correct RLS.
- Does not rule out: a filter that uses the client's value when present (`req.query.userId ?? user.id`); a text search that filters by owner only on the first page; `include`/`expand`/`select` coming from the client that pull relations from other owners.
- How to fix: build the `where` on the server and never spread the client's query inside it; accept from the client only filters from an allowlist.
- CWE: CWE-639

## bfla-acao-admin — Admin action accessible to a regular user
- Typical severity: critical when it allows becoming admin, seeing all users, changing plans, refunding or impersonating. High for other privileged actions.
- Where to look: folders `admin/`, `dashboard/admin`, `api/admin/*`, Server Actions in admin files, functions named `approve`, `ban`, `impersonate`, `setRole`, `grant`, `refund`, `invite`, `deleteUser`, `sendBroadcast`. Grep: `isAdmin`, `role ===`, `role:`, `hasRole`, `can(`, `permissions`.
- How to confirm by reading the code:
  1. List the privileged actions.
  2. For each one, find the role check INSIDE the handler/action (or in a helper it calls), done on the server, with the role read from the database or from a signed claim.
  3. Confirm that the role does not come from the client (`body.role`, unsigned `role=admin` cookie, `localStorage`) nor from Supabase's `user_metadata` (the user edits it with `supabase.auth.updateUser`).
- Ruled out if: there is `requireAdmin()`/`assertRole('admin')` at the start of each action, reading the role from the database or from `app_metadata`/a signed custom claim; or the endpoint runs behind RLS/a rule that requires the role.
- Does not rule out: only the `admin` layout/page checks the role (the Server Action or the API route it calls is another endpoint); the admin menu only shows up for admins; the check is in a middleware whose matcher does not cover `/api/admin`; role read from `user.user_metadata.role`; feature flag only in the front end.
- How to fix: a single helper called at the top of every privileged action.
  ```ts
  export async function requireAdmin() {
    const user = await requireUser();
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (data?.role !== 'admin') throw new Error('forbidden');
    return user;
  }
  ```
- CWE: CWE-285

## bfla-verbo-e-rota-alternativa — Sibling route or alternative verb without the same check
- Typical severity: high (inherits the severity of the exposed action).
- Where to look: the same operation exposed through two paths (API route + Server Action; `pages/api` + `app/api`; REST + GraphQL/tRPC; a forgotten v1 route), handlers that accept GET and perform writes, jobs/queues/webhooks that execute user actions.
- How to confirm by reading the code: once you find the check on one path, look (grep by the name of the service function or the table) for all other callers and verify each one. One safe instance proves nothing about its sibling.
- Ruled out if: the check is in the shared service layer (the function that actually writes), so all paths go through it.
- Does not rule out: "the other route already checks"; an old route the front end no longer uses but that is still exported.
- How to fix: move authorization into the service function used by all paths; delete old routes.
- CWE: CWE-285

## tenant-isolamento — One organization's data visible to another
- Typical severity: critical in B2B SaaS (leak between customers).
- Where to look: models with `org_id`/`team_id`/`workspace_id`/`tenant_id`; organization switcher in the front end; `x-org-id` header, subdomain, `params.orgId`, `?workspace=`.
- How to confirm by reading the code:
  1. Find out where the current tenant comes from: if it comes from the client (header, path, cookie), confirm that the server checks the user is a member (`memberships where user_id = user.id and org_id = X`) before using it.
  2. Confirm that every tenant data query filters by that validated tenant.
  3. In Supabase, the policy must check membership (`exists (select 1 from members m where m.org_id = t.org_id and m.user_id = (select auth.uid()))`).
- Ruled out if: there is a membership check on the server or in RLS, and all queries use the validated tenant.
- Does not rule out: it checks membership when switching orgs, but the data routes trust the header afterwards; tenant filter on listings but not on detail/writes; invites that accept `orgId` from the body without checking who invited.
- How to fix: resolve the tenant once per request with a membership check and pass the validated `orgId` to the queries; in Supabase, policies with `exists` on the members table.
- CWE: CWE-639

## mass-assignment-campos-privilegiados — Client can write role, isAdmin, owner_id, plan, credits
- Typical severity: critical when it writes `role`/`isAdmin`/`plan`/`credits`/`balance`/`verified`/`owner_id`/`org_id`. Medium if it only writes cosmetic fields it should not.
- Where to look: create/update that spreads the whole body. Grep: `data: body`, `data: req.body`, `data: { ...body`, `.update(body)`, `.insert(body)`, `.upsert(`, `Object.assign(user, req.body)`, `new Model(req.body)`, `findByIdAndUpdate(id, req.body)`, `formData` converted with `Object.fromEntries(formData)`, Zod schemas with `.passthrough()` or without `.strict()` + spread. Profile, sign-up and settings forms.
- How to confirm by reading the code:
  1. Find the input schema (Zod/Valibot/Yup) or its absence.
  2. See whether the written object is built field by field from an allowlist, or whether the body is spread.
  3. Compare with the model/table columns: is there a sensitive column that would get through?
  4. In Supabase with direct client writes (`supabase.from('profiles').update(...)` in the browser), UPDATE RLS lets the user change any column of their own row, including `role`, unless there is a per-column restriction or a trigger.
- Ruled out if: the schema is an allowlist without the sensitive fields and Zod drops extra keys (the default behavior of `z.object().parse` is to strip unknown keys; check there is no `.passthrough()`), and the value written is the parse result, not the original body; or sensitive columns have `revoke update (role, plan) on profiles from authenticated` / a blocking trigger; or the server recalculates the field and ignores what came in.
- Does not rule out: validation that checks types but writes `body` instead of `parsed`; a safe create schema but the edit one spreads; nested fields (`{ profile: { role } }`) in an ORM with nested writes; the front-end form does not show the field (the attacker sends it anyway).
- How to fix:
  ```ts
  const Input = z.object({ name: z.string().max(80), bio: z.string().max(500) });
  const { name, bio } = Input.parse(await req.json());
  await db.user.update({ where: { id: user.id }, data: { name, bio } });
  ```
  In Supabase: `revoke update on public.profiles from authenticated; grant update (name, bio) on public.profiles to authenticated;`
- CWE: CWE-915

## owner-vindo-do-cliente — Record owner defined by the payload
- Typical severity: high. Allows creating records on behalf of another user or inside someone else's organization.
- Where to look: inserts with `user_id: body.userId`, `ownerId: input.ownerId`, `orgId: body.orgId`, `author_id` coming from the form; hidden fields in forms.
- How to confirm by reading the code: see where the owner value in the insert comes from. It must be the session (`user.id`) or a validated tenant.
- Ruled out if: the server overwrites it with `user.id` after the parse; or in Supabase the INSERT policy has `with check (user_id = (select auth.uid()))`; or the column has `default auth.uid()` and is not writable by the client.
- Does not rule out: "the front end always sends the right id".
- How to fix: `data: { ...parsed, ownerId: user.id }` with `ownerId` outside the input schema.
- CWE: CWE-639

## acesso-em-lote — Bulk operation checks only the first item
- Typical severity: high.
- Where to look: endpoints with `ids: string[]`, `bulkDelete`, `moveMany`, `markAsRead`, `in('id', ids)`, `where: { id: { in: ids } }`.
- How to confirm by reading the code: see whether the owner check covers every ID (owner filter in the same query) or only `ids[0]`/a parent object.
- Ruled out if: the operation is `where: { id: { in: ids }, ownerId: user.id }` or equivalent RLS.
- Does not rule out: a loop that checks the parent and then operates on children provided by the client without checking they belong to the parent.
- How to fix: owner filter in the bulk query.
- CWE: CWE-639

## arquivo-e-url-assinada — File download by key/URL without a check
- Typical severity: high (personal documents, invoices, medical exams).
- Where to look: routes `download`, `file`, `attachment`, signed URL generation (`createSignedUrl`, S3's `getSignedUrl`, Firebase's `getDownloadURL`) from a `path` or `key` coming from the client.
- How to confirm by reading the code: before signing/serving, does the code check that the file belongs to the user (a database record with an owner, or a path prefix equal to the validated `user.id`)?
- Ruled out if: the path is built by the server from the user's record, or there is an owner check on the associated record, or the bucket policy restricts by `auth.uid()` (see `supabase.md`).
- Does not rule out: a signed URL with long validity sent to public places; a `${userId}/${file}` path with `userId` coming from the client.
- How to fix: fetch the file's record with an owner filter and only then generate a short signed URL (minutes).
- CWE: CWE-639
