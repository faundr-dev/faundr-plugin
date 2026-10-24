# Authentication and session
When to read: the app has login, sign-up, sessions, its own JWT, OAuth/social login, magic link or password reset. Signs: `jsonwebtoken`, `jose`, `next-auth`/`@auth/*`, `better-auth`, `lucia`, `@clerk/*`, `@supabase/ssr`, `firebase/auth`, `bcrypt`/`argon2`, `passport`, routes `login`, `signup`, `reset`, `callback`, `middleware.ts`/`proxy.ts`.

Golden rule: identity only counts if it was verified on the server in every request that needs it. If the app uses a ready-made provider (Supabase Auth, Clerk, Auth.js, Firebase Auth), the risk is almost never in the provider, but in how the code reads the session and where it fails to read it.

## rota-sem-login — API route, Server Action or loader without a session check
- Typical severity: high; critical if the route reads/writes sensitive data or performs an expensive action. Low if the route is public by design (webhook with a signature, healthcheck, public content).
- Where to look: every file in `app/api/**/route.ts`, `pages/api/**`, files with `'use server'`, `createServerFn` (TanStack Start), Express/Hono/Workers routes (`app.post(`, `router.get(`, `export default { fetch }`), Supabase Edge Functions, Cloud Functions `onRequest`.
- How to confirm by reading the code:
  1. List the handlers that touch user data or have side effects.
  2. In each one, find the call that gets the verified user: `await auth()` (Auth.js v5), `getServerSession(authOptions)` (NextAuth v4), `await supabase.auth.getUser()`/`getClaims()`, `auth()` from `@clerk/nextjs/server`, `admin.auth().verifyIdToken(token)`, `jwt.verify(...)`.
  3. Confirm that a null return stops the flow (`if (!user) return 401`) before any effect.
- Ruled out if: the verification call is at the top of the handler (or in a wrapper like `withAuth(handler)` that wraps this specific handler) and fails closed; or the route is public by design and exposes nothing sensitive.
- Does not rule out: only the middleware protects it (see `middleware-unica-barreira`); the page that calls the route requires login (the route can be called directly); `try { user = await getUser() } catch {}` followed by use without a null check; a check that only logs the error and continues.
- How to fix: a `requireUser()` helper that throws/returns 401, called on the first line of every handler and Server Action.
- CWE: CWE-306

## middleware-unica-barreira — Middleware/proxy as the only protection
- Typical severity: high. Critical in Next.js vulnerable to CVE-2025-29927 (`x-middleware-subrequest` skips the middleware; fixed in 12.3.5, 13.5.9, 14.2.25 and 15.2.3).
- Where to look: `middleware.ts`/`middleware.js` (Next ≤15), `proxy.ts` (Next 16), the `config.matcher`, and the routes it protects. The `next` version in `package.json`/lockfile.
- How to confirm by reading the code:
  1. Read the `matcher` and the logic: which paths it covers and what it does (checks a cookie? verifies a token? only redirects?).
  2. Look for sensitive routes outside the matcher (it is common for the matcher to exclude `api`, or to use a regex that does not cover `/api/...`).
  3. Check whether the handlers/Server Actions behind it repeat the check. Server Actions are POSTs to the page they live on; the middleware intercepts them by the page's path, which may not be in the matcher.
  4. See whether the middleware only checks that the cookie exists (`request.cookies.has('session')`) without verifying it.
- Ruled out if: every sensitive handler/action also calls the session verification (defense in depth) and the Next version is not vulnerable.
- Does not rule out: "the middleware already handles it"; a check that the cookie is present without validating it; a matcher with broad exclusions; vulnerable Next even with a host that claims to filter the header (confirm it, do not assume).
- How to fix: keep the middleware to redirect the UI, but also verify the session inside each handler/action; update `next`.
- CWE: CWE-288

## sessao-nao-verificada — Session read without verifying the signature (getSession, decode)
- Typical severity: high to critical (anyone can forge an identity).
- Where to look: the server using `supabase.auth.getSession()` to decide access; `jwt.decode(`; `jose.decodeJwt(`; `atob(token.split('.')[1])`; `JSON.parse(Buffer.from(...split('.')[1], 'base64'))`; a `user`/`role` cookie in plain JSON; `req.headers['x-user-id']`.
- How to confirm by reading the code: identify the function that turns a cookie/header into a user. It must verify the signature with a secret/JWKS. In Supabase, `getSession()` on the server reads the cookie without revalidating; the documentation says to use `getUser()` (queries Auth) or `getClaims()` (verifies the signature) for authorization decisions.
- Ruled out if: it uses `jwt.verify`, `jose.jwtVerify`, `getUser()`/`getClaims()`, `verifyIdToken`, or the session is opaque and looked up in the database by ID.
- Does not rule out: `getSession()` "because it is faster"; decode only to "show the name", if the same value later decides access; an identity header set by a proxy but also accepted from outside.
- How to fix: `const { data: { user } } = await supabase.auth.getUser(); if (!user) return 401;` or `jwt.verify(token, secret, { algorithms: ['HS256'] })`.
- CWE: CWE-345

## jwt-algoritmo-e-claims — JWT without a fixed algorithm, without iss/aud/exp
- Typical severity: critical with `alg: none` accepted or RS256→HS256 confusion; medium if only `aud`/`iss` is missing in a system with a single issuer.
- Where to look: `jwt.verify(` without `algorithms`; `jwtVerify(` without `issuer`/`audience`; manual verification with `crypto.createHmac`; a public key used as an HMAC secret; `ignoreExpiration: true`; a weak secret (`'secret'`, `'changeme'`, a short secret in the code or with a fallback `process.env.JWT_SECRET || 'dev'`).
- How to confirm by reading the code: read the verification call and its options. See whether the algorithm is fixed, whether `exp` is checked, whether `iss`/`aud` are validated when there is more than one issuer (e.g.: it accepts a Supabase token from another project or an ID token in place of an access token), and where the secret comes from.
- Ruled out if: fixed `algorithms`, a strong secret coming from env without a fallback, `issuer` and `audience` validated, and the library is current (`jsonwebtoken` ≥9 rejects `none` without an explicit option).
- Does not rule out: "the library is safe" without looking at the options; a dev secret fallback that goes to production; `kid`/`jku` from the header used to fetch a key from an arbitrary URL.
- How to fix:
  ```ts
  const { payload } = await jwtVerify(token, JWKS, { issuer: ISS, audience: AUD, algorithms: ['RS256'] });
  ```
- CWE: CWE-347

## senha-armazenamento — Password stored without a slow hash
- Typical severity: high (a database leak becomes a password leak).
- Where to look: custom sign-up/login (without a provider). Grep: `createHash('sha256')`, `md5`, `sha1`, `password:` written directly, `bcrypt.hash(pw, 4)`, comparison `user.password === password`.
- How to confirm by reading the code: see how the password is stored and compared.
- Ruled out if: `bcrypt` (cost ≥10), `argon2`/`@node-rs/argon2`, `scrypt` with strong parameters, or authentication delegated to a provider (Supabase Auth, Clerk, Firebase Auth, Auth.js with an OAuth provider).
- Does not rule out: SHA-256 "with salt"; comparison with `===` (also has a timing risk).
- How to fix: `const hash = await argon2.hash(pw)`; `await argon2.verify(hash, pw)`.
- CWE: CWE-916

## senha-politica-e-forca-bruta — Login without an attempt limit / weak password accepted
- Typical severity: medium; high if there is no MFA and the app stores sensitive data or money.
- Where to look: custom login route; password validation on sign-up (`min(6)`); missing rate limit (details in `api-and-abuse.md`).
- How to confirm by reading the code: see the minimum length required and whether there is attempt limiting per account and per IP on the custom login.
- Ruled out if: login done by the managed provider (Supabase Auth, Firebase Auth, Clerk), which already applies limits; or there is a rate limit per IP and per account; minimum password ≥8 (NIST suggests 15 if there is no MFA) with a leaked-password check when possible.
- Does not rule out: rate limit only in the front end (disabled button); in-memory limit in a serverless environment (each instance has its own counter).
- How to fix: limit attempts (e.g.: `@upstash/ratelimit` by `ip` and by `email`), minimum of 8+ characters, generic messages ("incorrect email or password").
- CWE: CWE-307

## reset-de-senha — Reset with a weak or reusable token, or a link built from Host
- Typical severity: critical (account takeover).
- Where to look: routes `forgot`, `reset`, `recover`, `verify-email`, `magic`. Grep: `Math.random()`, `Date.now().toString(36)`, `uuidv1`, `req.headers.host`, `x-forwarded-host`, `resetToken`.
- How to confirm by reading the code:
  1. Token generation: it must be `crypto.randomBytes(32)`/`crypto.randomUUID()`.
  2. Storage: ideally a hash of the token; short validity (≤1 h); single use (deleted/invalidated after use).
  3. Link: the URL base comes from configuration (`process.env.APP_URL`), not from the `Host` header (otherwise the attacker sends the victim the link with their own domain).
  4. Response: does not reveal whether the email exists; does not return the token in the API response.
  5. After changing the password, other sessions are ended.
- Ruled out if: it uses the provider's flow (`supabase.auth.resetPasswordForEmail` with a fixed `redirectTo` and restricted Redirect URLs in the dashboard; Firebase's `sendPasswordResetEmail`) or the 5 points above are met.
- Does not rule out: a random token but without expiration; token returned in the JSON "for debugging"; `redirectTo` built from the request's `origin`.
- How to fix: `const token = crypto.randomBytes(32).toString('hex')`, store `sha256(token)` with `expiresAt`, delete it on use, link with `new URL('/reset?token=' + token, process.env.APP_URL)`.
- CWE: CWE-640

## oauth-redirect-e-next — Post-login redirect controlled by the user
- Typical severity: medium as an isolated open redirect; high if it leaks a `code`/token to another domain.
- Where to look: callback route (`app/auth/callback/route.ts`, `/api/auth/callback`), parameters `next`, `redirect`, `returnTo`, `callbackUrl`. Common pattern in Supabase templates: `const next = searchParams.get('next') ?? '/'; return NextResponse.redirect(`${origin}${next}`)`. With `next=.evil.com` that becomes `https://app.com.evil.com`.
- How to confirm by reading the code: see whether `next` is validated as a relative path (`startsWith('/')` and not `startsWith('//')` nor containing `\`), or compared to an allowlist. In Auth.js, see the `redirect` callback (the default only allows the same origin; customizations often open it up).
- Ruled out if: relative-path validation or an allowlist; `new URL(next, origin)` followed by the check `url.origin === origin`.
- Does not rule out: `includes('meusite.com')`; an unanchored regex; a check only in the front end.
- How to fix:
  ```ts
  const raw = searchParams.get('next') ?? '/';
  const next = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  ```
- CWE: CWE-601

## oauth-state-pkce — Custom OAuth without state/PKCE or with a loose redirect_uri
- Typical severity: high (login CSRF, account swapping, code theft).
- Where to look: manual OAuth implementation (building an `authorize?client_id=` URL), `passport` with `state: false`, connections to external accounts ("connect Google Drive/GitHub"), `redirect_uri` built from the request.
- How to confirm by reading the code: see whether `state` is randomly generated, stored in a cookie/session and compared in the callback; whether there is an S256 `code_verifier`/`code_challenge` for a public client; whether `redirect_uri` is fixed.
- Ruled out if: it uses Auth.js, Supabase Auth (`signInWithOAuth` + `exchangeCodeForSession`, which uses PKCE), Clerk or Firebase Auth without customizing the flow; or `state` and PKCE are implemented and checked.
- Does not rule out: `state` generated but never compared in the callback; an external account linked to the session's user without `state` (the attacker links their account to the victim).
- How to fix: generate `state` and `code_verifier` with `crypto.randomBytes`, store them in a short-lived `httpOnly` cookie, compare in the callback and delete.
- CWE: CWE-352

## sessao-ciclo-de-vida — Logout that does not invalidate, eternal session, token in localStorage
- Typical severity: medium; low on its own (requires stealing the token first).
- Where to look: logout implementation, `expiresIn`, `maxAge`, `localStorage.setItem('token'`, refresh token without rotation.
- How to confirm by reading the code: does logout delete/invalidate on the server (session in the database, `supabase.auth.signOut()`)? Is the access token short-lived? Are custom tokens kept in an `httpOnly` cookie instead of `localStorage` (accessible by any XSS)?
- Ruled out if: managed provider with its defaults; `httpOnly; Secure; SameSite=Lax` cookies; expiration of hours/days with renewal.
- Does not rule out: a custom 30-day JWT with no way to revoke it and no rotation.
- How to fix: short access token + rotating refresh, or an opaque session in the database; store it in an `httpOnly` cookie.
- CWE: CWE-613

## enumeracao-de-contas — Login/sign-up/reset reveal whether the email exists
- Typical severity: low (medium if the app is sensitive, like health or dating).
- Where to look: messages "user not found" vs "incorrect password"; a reset that answers "email not registered"; sign-up with "email already in use" without an attempt limit.
- How to confirm by reading the code: compare the error branches.
- Ruled out if: a single message and the same response time in the branches, or the information is already public in the product.
- Does not rule out: a generic message, but a different HTTP status.
- How to fix: identical message and status; on reset, always "if the email exists, we sent the link".
- CWE: CWE-204

## mfa-ausente-ou-contornavel — Sensitive account without a second factor, or a second factor that can be skipped
- Typical severity: high when MFA exists but can be skipped (the control is fake); medium when MFA is missing for admin or in an app with money, health or documents; low in a low-risk app.
- Where to look: Supabase (`supabase.auth.mfa.*`, `aal1`/`aal2`, `auth.jwt() ->> 'aal'` in policies), Clerk/Auth0/Firebase (MFA configuration), custom TOTP (`otplib`, `speakeasy`), admin routes, email/password change, withdrawal, data export.
- How to confirm by reading the code: (1) do those who need MFA (admin, organization owner, whoever handles money) have it? (2) after password login, does the "half-logged-in" session (`aal1`) already access everything, or do sensitive routes and policies require `aal2`? (3) can MFA be turned off, the email changed or the account recovered without the second factor? (4) does the 6-digit code have an attempt limit (see `rate-limit-auth`)?
- Ruled out if: sensitive routes and policies require `aal2` (or the provider's equivalent) on the server; turning off MFA and recovering the account require the second factor or a strong verification; the code has an attempt limit.
- Does not rule out: a screen that asks for the code but the API accepts the `aal1` session; "MFA is optional" for admins; account recovery by email alone that turns off MFA.
- How to fix: require `aal2` in sensitive policies and routes (`(auth.jwt() ->> 'aal') = 'aal2'`), mandatory MFA for admin, turn off MFA only with the second factor, attempt limit on the code.
- CWE: CWE-308
