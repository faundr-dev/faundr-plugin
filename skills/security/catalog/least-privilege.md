# Least privilege (each key, role and function with only the power it needs)
When to read: always. Principle of least privilege: if a piece is compromised (a leaked key, a tricked function, a careless admin), the damage is limited to what it needed to do. Several cases already have their own check; here is the map, plus the ones that aren't anywhere else.

Already covered in other topics (read them there): `service_role` on the client and without an owner filter (`supabase.md`), exposed `security definer` function (`supabase.md`), admin action available to a regular user (`access-and-idor.md` → `bfla-acao-admin`), AI tools with too much power (`ai-and-llm.md`), CI token with too much permission (`ci-and-dependencies.md`), container running as root (automatic check).

Golden rule: for each credential and each role, write down what it **needs** to do; anything beyond that is risk with no gain.

## banco-funcoes-e-tabelas-abertas-ao-anon — Function or table the visitor can call without needing to
- Typical severity: high when the function changes data or returns other people's data; medium when it only exposes structure.
- Where to look: Supabase migrations. New functions in the `public` schema are executable by `anon` and `authenticated` by default (Postgres grants `EXECUTE` to `public`); tables in `public` are reachable through the API if RLS allows. Grep: `create function public.`, `grant .* to anon`, `grant all`, `revoke execute`.
- How to confirm by reading the code: for each function in `public`, does the app call it as an RPC? If it is internal only (trigger, job, called by the server), is there a `revoke execute on function ... from public, anon, authenticated`? Do functions used only by logged-in users have `revoke ... from anon`?
- Ruled out if: the `revoke` exists for the internal functions, or they live in a schema not exposed by the API (e.g., `private`), or the function checks the caller right at the start.
- Not ruled out by: "the front end doesn't call this function" (the REST API calls any exposed function).
- How to fix: `revoke execute on function public.f(...) from public, anon, authenticated;` for internal functions, or move them to a `private` schema outside the API.
- CWE: CWE-269

## chave-de-terceiro-com-poder-total — External service API key with every permission
- Typical severity: medium; high if the key moves money (Stripe), sends email on behalf of the domain or touches infrastructure (AWS, Cloudflare).
- Where to look: `STRIPE_SECRET_KEY`, `AWS_ACCESS_KEY_ID`, `CLOUDFLARE_API_TOKEN`, `RESEND_API_KEY`, `OPENAI_API_KEY` variables and where they are used; what the code does with each one.
- How to confirm by reading the code: list what the app does with each key (e.g., Stripe only creates checkouts and reads subscriptions). If it does little, a restricted key would be enough. Is the key used by the server the same as the account owner's (the "master" one)?
- Ruled out if: the code uses permission-restricted keys (Stripe restricted key, scoped Cloudflare token, IAM user with a minimal policy) — this lives outside the code: if you can't tell, record it as "Needs check" saying where to look.
- Not ruled out by: "the key is in .env" (it's protected from leaking through git, but if it leaks some other way, it takes everything).
- How to fix: create a restricted key at the provider with only what the app uses, and rotate the master one.
- CWE: CWE-250

## conexao-do-banco-como-dono — Server connected to the database as the user that owns everything
- Typical severity: medium; high if there is SQL built with user text somewhere (the injection gains full power).
- Where to look: `DATABASE_URL`/`POSTGRES_URL` with the `postgres` user or the database owner, used by an ORM (Prisma, Drizzle) on the app server; direct connection that bypasses RLS.
- How to confirm by reading the code: does the app access the database through a user that bypasses RLS (owner, `postgres`, `service_role`)? If so, every owner filter depends on the code (see `supabase-service-role-sem-filtro`).
- Ruled out if: the app uses its own role with only the needed permissions, or the Supabase client with the user's JWT (RLS applies).
- Not ruled out by: "only the server has this URL".
- How to fix: a database role for the app with `grant` only on the tables and operations used; or access through the user's client with RLS.
- CWE: CWE-250

## papel-unico-de-admin — Every admin can do everything
- Typical severity: low to medium; medium in an app with several organizations or with a support team.
- Where to look: `role === 'admin'` as the only check for very different actions (view customers, refund, delete an organization, change plan, log in as another user).
- How to confirm by reading the code: can someone who only needs to read (support) delete or refund? Is "log in as another user" recorded (see `logging-and-monitoring.md`)?
- Ruled out if: separate roles for destructive or money actions, or the app has only one admin.
- Not ruled out by: "our admins are trustworthy" (their account can be hacked).
- How to fix: roles by type of action (support only reads; finance refunds; owner deletes), MFA for admins, logging of actions.
- CWE: CWE-269
