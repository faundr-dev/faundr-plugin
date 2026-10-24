# Data lifecycle (deleting, removing access, invites, export, copies)
When to read: whenever the app has login. Access is usually checked on the main route and forgotten at the edges of the lifecycle: after deleting, after removing someone from the team, on invites, on export, on the copy kept in a cache or search index, and on restore. Signals: `deleted_at`, `archived`, `is_deleted`, `status` columns; `members`, `invites`, `memberships` tables; `export`, `download`, `backup`, `restore`, `undo`, `duplicate` routes; cache (`unstable_cache`, Redis, KV), search (Algolia, Meilisearch, pgvector), queues and jobs.

Golden rule: every copy of the data (cache, search index, exported file, signed URL, queued job, stored AI response) needs the same access rule as the original, and that rule has to apply **again** at the moment of use, not only when the copy was made.

## soft-delete-ainda-acessivel — "Deleted" item that still shows up or can be edited
- Typical severity: medium; high if the deleted item has personal data or if deleting was the way to remove someone's access.
- Where to look: `deleted_at`, `is_deleted`, `archived_at`; detail, search, export, count and RPC queries and RLS policies of the same table. Grep: `deleted_at is null`, `.is('deleted_at', null)`, `where: { deletedAt: null }`.
- How to confirm by reading the code: list all reads and writes of the table. The listing filters out the deleted ones; check whether the by-id detail, search, export, RPC and RLS policy also filter. Check whether the item can be edited or "undeleted" through the regular PATCH.
- Ruled out if: the deleted filter is in a single place that every read uses (view, RLS policy `using (deleted_at is null and ...)`, ORM default scope) and the PATCH refuses deleted items.
- Not ruled out by: filter only in the listing; RLS that filters SELECT but not UPDATE; a front end that hides the item.
- How to fix: put the filter in the RLS policy or in a view used by every read; refuse writes to deleted items on the server.
- CWE: CWE-285

## membro-removido-mantem-acesso — Someone who left the team keeps reading or changing things
- Typical severity: high (access to data of an organization the person is no longer part of).
- Where to look: member removal, role change, leaving the organization; where the role is read (JWT with `role`/`org_id` in the claims, cookie, session cache, `app_metadata`); API tokens and invites created by the member.
- How to confirm by reading the code: see where "is a member" comes from on each request. If it comes from a JWT claim or a cache, access lasts until the token or cache expires. Also check whether API keys, signed URLs, pending invites and agent sessions created by that person are revoked.
- Ruled out if: every request checks membership in the database (or in RLS with `exists (select 1 from members ...)`), and removing the member deletes or invalidates the credentials they created.
- Not ruled out by: "the token expires in an hour" when the refresh renews the old claims; a removal that only disappears from the screen.
- How to fix: check membership in the database on every request (or RLS); on removal, revoke keys, invites and sessions; claims only as a hint, never as the decision.
- CWE: CWE-613

## convite-reaproveitavel — Invite that works for someone else, more than once or forever
- Typical severity: high when the invite gives access to an organization or an admin role; medium when it only creates an account.
- Where to look: `invites` table, `accept-invite`, `join` routes, links with `?token=`/`?code=`.
- How to confirm by reading the code: on accept, check whether the code (1) ties the invite to the invited email and compares it with the verified email of whoever accepts, (2) marks it as used atomically, (3) has an expiry, (4) uses the role stored in the invite and not a role coming from the request, (5) stops working if the inviter lost access.
- Ruled out if: all five points, with atomic use (`update ... where used_at is null returning`).
- Not ruled out by: a long random token not tied to the email (leaks through forwarding and logs); checking "already used" in a SELECT and marking it in a separate UPDATE (race).
- How to fix: tie to the email, mark as used in the same command that accepts, short expiry, role read from the invite.
- CWE: CWE-639

## export-com-dados-demais — Export, backup or report with more than the person can see
- Typical severity: high (leaks in bulk, all at once).
- Where to look: `export`, `download`, `csv`, `report`, `backup` routes, jobs that generate files, `security definer` functions used for reports.
- How to confirm by reading the code: compare the export's filter with the screen's. Exports often use the service client or a report function, which ignores RLS. See whether it includes deleted items, drafts, sensitive columns (others' email, hashes, internal notes) and whether the generated file sits at a public URL or one with no expiry.
- Ruled out if: the export uses the same query (or the user's client with RLS) as the screen, selects explicit columns and the file goes out via a short signed URL tied to whoever requested it.
- Not ruled out by: "only admins see the export button" without a server check; a file in a public bucket with a "hard to guess" name.
- How to fix: reuse the screen's query with the user's filter, explicit columns, a private file with a signed URL valid for a few minutes.
- CWE: CWE-200

## import-e-restaurar-sem-regra — Importing, duplicating or restoring bypasses validation
- Typical severity: medium to high, depending on what can be written.
- Where to look: `import`, `restore`, `undo`, `duplicate`, `clone`, `rollback`, versions/history.
- How to confirm by reading the code: importing or restoring usually writes the whole record at once. Check whether `owner_id`, `org_id`, `role`, `plan`, price or status come from the file or the old version instead of the current user, and whether restoring gives back access to someone who was already removed.
- Ruled out if: the import goes through the same validation and owner filter as regular creation; restoring recalculates owner and permissions from the current state.
- Not ruled out by: "the file is ours" when the user can edit it before importing.
- How to fix: import field by field through the same creation function; on restore, apply the current owner and permissions.
- CWE: CWE-915

## copia-sem-regra — Cache, search, queue or signed URL that doesn't follow the original's rule
- Typical severity: high when the copy serves one user's data to another; medium when it only extends access.
- Where to look: cache key without the user/organization id (`cache.get('dashboard')`); search index or vectors queried without an owner/tenant filter; jobs that carry the data in the queue and run after access changed; signed URLs with long expiry (days); stored and reused AI responses.
- How to confirm by reading the code: for each copy, find where it is read and see whether the read filters by the requester. In the queue, see whether the job re-checks access when it runs.
- Ruled out if: the cache key includes user/tenant (or the data is the same for everyone), search filters by tenant on the server, the job reloads and re-checks, signed URLs last minutes.
- Not ruled out by: filtering on the front end after the search returned everything; "the cache lasts only 60 seconds" when the data belongs to another user.
- How to fix: user/tenant in the cache key, tenant filter in the search query, a job that re-checks, a short signed URL.
- CWE: CWE-524

## exclusao-de-conta-incompleta — Deleted account leaves data and access behind
- Typical severity: medium (LGPD: the deletion request must be honored; see `/faundr:privacy`); high if the session or keys keep working.
- Where to look: delete-account route, `auth.admin.deleteUser`, `on delete cascade`/`set null` in the migrations, files in storage, external services (Stripe, email marketing, analytics).
- How to confirm by reading the code: see what happens to the tables that point to the user, their files, sessions and API keys and their records in external services.
- Ruled out if: cascade or explicit cleanup in the tables, files deleted, sessions revoked, and what is kept by law is documented.
- Not ruled out by: deleting only the `auth.users`/`profiles` row and leaving the rest; hiding the account without deleting it.
- How to fix: a deletion routine that walks through tables, storage and external services, and revokes sessions and keys.
- CWE: CWE-459
