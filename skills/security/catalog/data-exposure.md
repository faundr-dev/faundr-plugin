# Data and exposure
When to read: always, in a quick pass. Especially if there is custom error handling, logs, debug/test routes, deploy configuration (`vercel.json`, `netlify.toml`, `wrangler.toml`/`wrangler.jsonc`, `next.config.*`, `_headers`, `nginx.conf`), custom cookies or API responses that return database records.

Calibration: missing headers, version in a header and source maps are, on their own, low. Don't paint them high without a concrete path to restricted data. A response that returns another user's data or a password hash, on the other hand, is high or critical.

## resposta-com-dados-sensiveis — API returns fields it shouldn't
- Typical severity: critical for password hashes, reset/session tokens, user API keys; high for other users' email/phone/CPF/address; medium for the user's own internal fields.
- Where to look: `return Response.json(user)`, `res.json(user)`, `res.json(await db.user.findMany())`, `select('*')` returned directly, `include: { author: true }` in public listings (leaks the author's email), `/api/users`, `/api/me`, `/api/members` routes, comments/posts with author data.
- How to confirm by reading the code: list the fields of the returned object (from the ORM/table schema) and see which go out. In listings of other users, only public fields should go out.
- Ruled out if: there is an explicit field `select`, a DTO/mapper before the response, or an `omit` of sensitive fields (Prisma `omit: { password: true }` or a serializer); in Supabase, sensitive columns in a separate table/per-column GRANT (see `supabase.md`).
- Not ruled out by: "the front end doesn't show it"; `delete user.password` in one branch and not the other.
- How to fix: `select: { id: true, name: true, avatarUrl: true }` or a `toPublicUser(u)` function.
- CWE: CWE-200

## erro-com-stack-trace — Internal details in the error returned to the client
- Typical severity: low; medium if the error exposes SQL, paths, secrets in connection messages or other users' data.
- Where to look: `catch (e) { return Response.json({ error: e }) }`, `res.status(500).json({ error: err.message, stack: err.stack })`, Supabase `return { error: error }` passed through raw, Express error handler with `err.stack`, `NODE_ENV` not set in production, Hono `app.onError((e, c) => c.text(e.stack))`.
- How to confirm by reading the code: see what the global handler and the `catch` blocks return.
- Ruled out if: generic message to the client and details only in the server log (without secrets); or only under `NODE_ENV === 'development'` with production configured.
- Not ruled out by: "it's only in dev" with no environment check in the code.
- How to fix: `console.error(e); return Response.json({ error: 'Internal error' }, { status: 500 })`.
- CWE: CWE-209

## logs-com-segredo-ou-pii — Log with password, token, key or personal data
- Typical severity: medium (logs go to Vercel/Sentry/Datadog and are read by more people); high if it logs passwords, session tokens or card numbers.
- Where to look: `console.log(req.body)` in login/sign-up/payment, `console.log(req.headers)` (includes `authorization`/`cookie`), `console.log(user)`, `console.log(process.env)`, `logger.info({ body })`, logs of full AI prompts with personal data, Sentry without `beforeSend` on sensitive forms.
- How to confirm by reading the code: identify logs in paths that touch credentials or PII.
- Ruled out if: structured logs with redaction (`pino` with `redact: ['req.headers.authorization', 'password']`) or only non-sensitive fields.
- Not ruled out by: a "temporary debug" log already committed.
- How to fix: remove the log or redact fields.
- CWE: CWE-532

## endpoint-de-debug-ou-teste — Debug, seed, temporary admin or test route exposed
- Typical severity: high to critical depending on what it does (database reset, admin creation, env dump); low if it only returns "ok".
- Where to look: `debug`, `test`, `seed`, `reset-db`, `dev`, `health` routes with data, `env`, `phpinfo`-like, `api/admin/make-admin`, `api/cron/*` without a secret; `app/test/*` pages; `if (process.env.NODE_ENV !== 'production')` flags using a variable that may not be set.
- How to confirm by reading the code: list the routes and look for the ones that are not part of the product; see whether they require authentication/a secret and whether they are turned off in production.
- Ruled out if: the route doesn't exist in the production build (file excluded, `notFound()` in production) or requires a strong secret/admin role; cron routes check `Authorization: Bearer ${process.env.CRON_SECRET}` (Vercel's pattern).
- Not ruled out by: "nobody knows the URL" (the bundle and the sitemap reveal it).
- How to fix: remove; or protect with a secret/role; crons with `CRON_SECRET`.
- CWE: CWE-489

## env-e-arquivos-publicos — `.env`, backups or source maps served publicly
- Typical severity: critical for an accessible `.env` with secrets; low for source maps without secrets.
- Where to look: `.env` inside `public/` or `static/`; `.env` committed or outside `.gitignore`; `express.static('.')`/`serveStatic({ root: './' })` at the project root (serves `.env`, `.git`); `*.sql`/`backup.zip` dumps in the public folder; `productionBrowserSourceMaps: true`; `build.sourcemap: true` in `vite.config` for production.
- How to confirm by reading the code: see what the public folder contains and the root of static servers. For a committed `.env`, check `git ls-files`/`.gitignore` (Faundr's automatic layer also checks this; don't duplicate if there is already a finding).
- Ruled out if: the static server points to a dedicated build folder; `.env*` in `.gitignore` and out of the history; maps off or only sent to Sentry.
- Not ruled out by: "the repository is private" (the deploy is public; collaborators and integrations see the repo).
- How to fix: move secrets to the hosting provider's variables, rotate the exposed keys, serve only the build folder.
- CWE: CWE-538

## cookies-sem-flags — Session cookie without HttpOnly, Secure or SameSite
- Typical severity: medium (amplifies XSS and CSRF); low if there is no XSS and no sensitive action.
- Where to look: `cookies().set(`, `res.cookie(`, `setCookie(c, ...)` (Hono), `document.cookie = 'token=`, `serialize(` from the `cookie` package, session settings (`express-session` `cookie: {}`).
- How to confirm by reading the code: session/auth cookies must have `httpOnly: true`, `secure: true` (in production), `sameSite: 'lax'` or `'strict'`, and minimal domain scope.
- Ruled out if: flags present; or the cookies are managed by an auth library with safe defaults (Auth.js, Clerk, `@supabase/ssr`; in Supabase SSR the cookie is not `httpOnly` by design because the browser client needs to read it, which their model accepts).
- Not ruled out by: token saved in `document.cookie` or `localStorage` "so the front end can read it".
- How to fix: `cookies().set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })`.
- CWE: CWE-1004

## cabecalhos-de-seguranca — Missing CSP, HSTS, frame-ancestors, nosniff
- Typical severity: low on its own. Goes up to medium when: there is no `frame-ancestors`/`X-Frame-Options` and the app has a sensitive one-click action (clickjacking); or there is XSS and no CSP to contain it.
- Where to look: `headers()` in `next.config.*`, `vercel.json` (`headers`), `netlify.toml`, `public/_headers` (Netlify/Cloudflare Pages), `helmet()` in Express, Hono's `secureHeaders()`, Workers' `Response`, `middleware.ts` that sets CSP with a nonce.
- How to confirm by reading the code: look for `Content-Security-Policy` (ideally without `unsafe-inline` in `script-src`), `Strict-Transport-Security`, `frame-ancestors 'none'` or `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- Ruled out if: headers configured in one of these places and applied to every route; or the host applies them (Vercel applies HSTS on its domains; check before stating it).
- Not ruled out by: CSP with `script-src 'unsafe-inline' 'unsafe-eval' *` (it exists, but doesn't protect).
- How to fix: `helmet()` / `secureHeaders()`, or in `next.config`:
  ```js
  async headers() { return [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ] }]; }
  ```
- CWE: CWE-693

## segredo-no-codigo-ou-bundle — Literal API key, password or token in the code
- Typical severity: critical for keys with power (service_role, `sk_live_`, AWS, OpenAI/Anthropic, SMTP, GitHub tokens); low for keys public by design.
- Where to look: Faundr's automatic layer already detects known formats. Here, look for what regex doesn't catch: database passwords in connection strings (`postgres://user:password@`), secrets in fallbacks (`process.env.X ?? 'real-value'`), credentials in JS/JSON config files, secrets in client code (Vite: everything in `src/` goes into the bundle), admin tokens in tests that also run in production.
- How to confirm by reading the code: identify the provider and whether the value looks real (not `xxx`, `your-key-here`, `changeme` in `.env.example`).
- Ruled out if: obvious placeholder; key public by design; value in an example file with fake data.
- Not ruled out by: "it's a test key" (`sk_test_` gives access to the account's test mode and is usually swapped for live in the same place); "I already deleted it" (it stays in the git history; the key must be rotated).
- How to fix: move to a server environment variable, rotate the key at the provider, and clean the history if the repository is public.
- CWE: CWE-798

## dado-sensivel-sem-criptografia — Highly sensitive data stored readable in the database
- Typical severity: medium; high for third-party integration tokens (Google OAuth, customers' API keys), health data, documents and cards.
- Where to look: columns like `access_token`, `refresh_token`, `api_key`, `secret`, `cpf`, `rg`, `diagnostico`, `card_number` in the migrations; code that writes these fields.
- How to confirm by reading the code: the Supabase/Postgres database is already encrypted on disk by the provider; that protects against disk theft, not against whoever reads the table (a wrong RLS, a leaked backup, someone with dashboard access). See whether the data is stored as it arrives and whether it really needs to be stored (a single-use token, the full card number).
- Ruled out if: the data isn't even stored (only what's needed, like the last 4 digits); or it is stored encrypted with a key outside the database (Supabase Vault, `pgsodium`, KMS, key in the server environment); or it is a hash when it only needs to be compared.
- Not ruled out by: "the disk is encrypted"; base64 (not encryption); encryption key in the same table or in the code.
- How to fix: don't store what you don't need; third-party tokens and documents in Supabase Vault (`vault.create_secret`) or encrypted with a key from the environment; cards never (use the payment provider's token).
- CWE: CWE-312

## criptografia-caseira — Hand-rolled crypto or a weak algorithm
- Typical severity: medium; high if it protects a password, session token or sensitive data.
- Where to look: `crypto.createCipheriv`, `createCipher` (no iv), `aes-*-ecb`, fixed or reused iv, `Math.random()` for a token/code/password, `md5`/`sha1` to sign or protect, token comparison with `===` instead of `timingSafeEqual`, JWT signed with a short or default secret.
- How to confirm by reading the code: is the algorithm authenticated (AES-GCM, ChaCha20-Poly1305, libsodium)? Is the iv/nonce random per message? Does the security random number come from `crypto.randomBytes`/`crypto.getRandomValues`? Does the key come from the environment and have the right size?
- Ruled out if: high-level library (libsodium, `jose`, Web Crypto with AES-GCM and random iv), random numbers from `crypto`, long secret from the environment.
- Not ruled out by: "nobody knows the algorithm"; encryption without authentication (CBC/CTR without HMAC).
- How to fix: AES-GCM with a random 12-byte iv stored alongside, or libsodium (`crypto_secretbox`); `crypto.randomBytes(32)` for tokens; `timingSafeEqual` to compare.
- CWE: CWE-327
