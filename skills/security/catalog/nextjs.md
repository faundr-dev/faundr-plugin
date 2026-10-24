# Next.js
When to read: `next` in `package.json`; `app/` or `pages/` folders (or under `src/`); `next.config.(js|mjs|ts)`; `middleware.ts`/`proxy.ts`. Many rules also apply to TanStack Start (`createServerFn`), Remix/React Router (loaders/actions) and SvelteKit (`+page.server.ts`): anything that runs on the server and can be called by the browser is a public endpoint.

First step: note the exact `next` version (lockfile) and whether the project uses App Router, Pages Router or both. Version differences matter (CVE-2025-29927 in middleware; RSC/React2Shell CVE-2025-55182 in React Server Components; image optimizer advisories). If the version is in an affected range, record it as a dependency finding with the fixed version, and check whether the usage pattern makes the issue reachable.

## next-server-action-sem-authz — Server Action without checking session/owner
- Typical severity: high; critical if the action changes money, roles or deletes data.
- Where to look: files with `'use server'` at the top (every exported function becomes an endpoint) and functions with `'use server'` inside the body. Grep: `'use server'`, `"use server"`, `useActionState`, `action={`, `formAction`.
- How to confirm by reading the code:
  1. Every exported action can be called by POST with any argument, outside the screen flow (the action ID is in the client bundle).
  2. Inside each one, look for the session check (`await auth()`, `getServerSession`, `supabase.auth.getUser()`, Clerk's `auth()`) and the ownership check of the received object.
  3. Check that the arguments are validated (Zod) and that IDs from the argument are checked against the user (see `access-and-idor.md`).
- Ruled out if: the action starts with `const user = await requireUser()` (or an equivalent that fails closed) and filters by owner; or uses a `next-safe-action`-style wrapper with an `authActionClient` that does these checks (check the wrapper's middleware).
- Not ruled out by: the page that renders the form requires login; `layout.tsx` checks the session (layouts do not protect actions or route handlers); the argument "comes from a hidden field, so it's trusted"; the action is only imported in admin screens.
- How to fix:
  ```ts
  'use server';
  export async function deletePost(id: string) {
    const user = await requireUser();
    const parsed = z.string().uuid().parse(id);
    await db.post.deleteMany({ where: { id: parsed, authorId: user.id } });
  }
  ```
- CWE: CWE-862

## next-route-handler-sem-authz — Route handler/API route without a check
- Typical severity: high.
- Where to look: `app/**/route.ts` (exports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`), `pages/api/**`. Routes that live in both routers.
- How to confirm by reading the code: same as `rota-sem-login` in `authentication.md`, verb by verb. A `route.ts` can export a protected `GET` and an unprotected `DELETE`.
- Ruled out if: every exported verb checks session and owner, or the route is public by design.
- Not ruled out by: protection in `pages/api` and not in the equivalent route in `app/api` (or vice versa).
- How to fix: auth helper at the top of each verb.
- CWE: CWE-306

## next-middleware-bypass — Middleware as the only barrier, or a matcher with holes
- Typical severity: high; critical in versions affected by CVE-2025-29927 (fixed in 12.3.5, 13.5.9, 14.2.25, 15.2.3) when the middleware is the only protection.
- Where to look: `middleware.ts` or `proxy.ts` (name in Next 16), `export const config = { matcher: [...] }`.
- How to confirm by reading the code: (1) see whether the matcher excludes `/api`, `/_next`, files with an extension, or uses a negative regex that also excludes sensitive routes; (2) see whether the middleware only checks that a cookie exists; (3) check whether the routes/actions behind it repeat the check. Details in `authentication.md` → `middleware-unica-barreira`.
- Ruled out if: handlers and actions check the session on their own and the version is not affected.
- Not ruled out by: redirecting the page to `/login` (does not protect the data endpoint).
- How to fix: authorization inside each handler/action/server page; update `next`.
- CWE: CWE-288

## next-props-com-dados-demais — Whole object serialized to the client
- Typical severity: high when it leaks password hashes, tokens, other users' email/phone, admin fields; medium when it leaks the user's own internal fields; low for internal IDs.
- Where to look: `getServerSideProps`/`getStaticProps` returning whole database records (they go into `__NEXT_DATA__` in the HTML); Server Component passing a database object to a Client Component (`<Profile user={user} />` where `Profile` has `'use client'`; everything passed as a prop is serialized into the RSC payload); `findMany()`/`select('*')` without a field `select`; `include: { author: true }`.
- How to confirm by reading the code: find the server→client boundary and list the fields of the object passed. Ask: does the component use all of them? Is any sensitive? Does any belong to another user (e.g., the whole `post.author` with email)?
- Ruled out if: the query selects only the needed fields (`select: { id: true, name: true }`) or there is a DTO/mapper that builds the object sent; or only the user's own public data crosses.
- Not ruled out by: "the component doesn't show the field" (it is in the HTML/payload anyway); removing it from the JSX and forgetting the query.
- How to fix: select fields in the query or map to a DTO before passing as a prop. In data modules, `import 'server-only'` to make sure they are not imported by the client.
- CWE: CWE-200

## next-env-publica-com-segredo — Secret in `NEXT_PUBLIC_` or imported by the client
- Typical severity: critical for keys that grant power (service_role, `sk_live_`, OpenAI/Anthropic, AWS, SMTP); low for keys meant to be public (Supabase anon/publishable, Stripe `pk_live_`, Firebase config, maps key restricted by domain).
- Where to look: `.env*`, `next.config.*` (the `env: {}` block also embeds into the bundle), code with `process.env.NEXT_PUBLIC_`. Grep: `NEXT_PUBLIC_.*(SECRET|SERVICE|PRIVATE|KEY|TOKEN)`, `env: {` in `next.config`. `'use client'` files that import modules that read secrets.
- How to confirm by reading the code: every `NEXT_PUBLIC_*` variable is substituted into the browser bundle at build time. Values in the `env` block of `next.config` too. Identify the key's provider and whether it is public by design.
- Ruled out if: the key is public by design and restricted at the provider (domain/scope), or the name has `NEXT_PUBLIC_` but the value is harmless (URL).
- Not ruled out by: "it's just the test key" (it becomes production); "the repository is private" (the bundle is public).
- How to fix: remove the prefix, use the key only in a route handler/Server Action, and rotate the key at the provider.
- CWE: CWE-798

## next-cache-dado-pessoal — Personalized response stored in a shared cache
- Typical severity: high (user B sees user A's page/data).
- Where to look: `unstable_cache(`, `'use cache'`, `cacheTag`, `cacheLife`, `export const revalidate`, `export const dynamic = 'force-static'`, `fetch(..., { cache: 'force-cache' })` or `next: { revalidate }` on a fetch that loads user data; `getStaticProps` with session data; `Cache-Control: public, s-maxage` headers on an authenticated route handler.
- How to confirm by reading the code: see whether the cached function depends on the user (reads cookies/session, or receives `userId`). If it does and the cache key does not include the user (arguments of `unstable_cache`/`'use cache'` are part of the key; values read inside it that are not in the arguments are not), one user's result goes to another. Check the CDN: `Cache-Control: public` on a response with personal data.
- Ruled out if: the cached function receives `userId` as an argument (it goes into the key) or the cached data is the same for everyone; authenticated responses use `private`/`no-store`.
- Not ruled out by: "the cache is short" (seconds are enough to leak).
- How to fix: pass the user ID as an argument to the cached function, or don't cache; in route handlers with a session, `Cache-Control: private, no-store`.
- CWE: CWE-524

## next-image-ssrf — Broad `remotePatterns`/`domains` or a custom loader
- Typical severity: medium; high if it runs on a server with access to the internal network/metadata (VPS, own container). Lower on Vercel.
- Where to look: `next.config.*` → `images.remotePatterns` with `hostname: '**'` or `'*'`, broad `images.domains`, `dangerouslyAllowSVG: true`, custom loaders that fetch a user URL.
- How to confirm by reading the code: the `/_next/image?url=` optimizer fetches any URL that matches the patterns. With a full wildcard, it becomes a proxy to any host. `dangerouslyAllowSVG` without `contentSecurityPolicy` and `contentDispositionType: 'attachment'` allows SVG with script.
- Ruled out if: patterns restricted to specific hosts (the app's own CDN, the project's Supabase bucket); or `images.unoptimized: true`.
- Not ruled out by: a wildcard "temporarily, to accept avatars from anywhere".
- How to fix: list exact hosts in `remotePatterns`; if SVG is needed, keep `contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"` and `contentDispositionType: 'attachment'`.
- CWE: CWE-918

## next-source-maps-publicos — Production source maps published
- Typical severity: low; medium if the maps reveal secrets or sensitive authorization logic on the client.
- Where to look: `productionBrowserSourceMaps: true` in `next.config`; Sentry setups that upload maps but don't remove them (`hideSourceMaps`/`sourcemaps.deleteSourcemapsAfterUpload`).
- How to confirm by reading the code: see the option and whether the deploy publishes the `.map` files.
- Ruled out if: option off (default) or maps sent only to Sentry and deleted from the build.
- Not ruled out by: nothing specific; it is a low-severity finding on its own.
- How to fix: remove `productionBrowserSourceMaps` or configure private upload.
- CWE: CWE-540

## next-revalidate-e-preview — Revalidation/preview endpoint with a weak secret
- Typical severity: medium (forced mass revalidation, draft content exposed).
- Where to look: routes that call `revalidatePath`/`revalidateTag`, `draftMode().enable()`, `res.setPreviewData`; `?secret=` parameters.
- How to confirm by reading the code: does the route check a strong secret coming from env and without a public prefix? Does it compare before acting?
- Ruled out if: strong secret from server env and comparison before the effect; or revalidation is called only by already-authorized Server Actions.
- Not ruled out by: secret in `NEXT_PUBLIC_`; hard-coded secret.
- How to fix: `if (req.nextUrl.searchParams.get('secret') !== process.env.REVALIDATE_SECRET) return 401`.
- CWE: CWE-306

## next-xss-sinks — `dangerouslySetInnerHTML`, user `href`, markdown
- Typical severity: high for stored XSS; see details in `input-and-injection.md` (`xss-dangerously-set-inner-html`, `xss-href-javascript`).
- Where to look: `dangerouslySetInnerHTML`, `<a href={user.website}>`, `react-markdown` with `rehype-raw`, `marked(` + `dangerouslySetInnerHTML`, `<Script>` with dynamic content, JSON injected into `<script>` without escaping (`JSON.stringify` inside `dangerouslySetInnerHTML` without escaping `<`).
- How to confirm by reading the code: trace the content's origin. If it comes from the user (or from an LLM), it needs sanitization (`DOMPurify.sanitize`, `isomorphic-dompurify`, `sanitize-html`).
- Ruled out if: static content from the code itself, or sanitized with an allowlist.
- Not ruled out by: sanitization only at save time through another path that doesn't cover every write.
- How to fix: sanitize at render time; for JSON-LD, `JSON.stringify(data).replace(/</g, '\\u003c')`.
- CWE: CWE-79

## next-server-only-vazando — Server code imported by a client component
- Typical severity: medium to critical, depending on what leaks (logic, internal URLs, literal secrets).
- Where to look: modules in `lib/` that use `process.env.<SECRET>`, database clients or admin SDKs, imported by `'use client'` files (directly or indirectly). Grep: `from 'server-only'` (its absence is the signal).
- How to confirm by reading the code: follow the import chain of a `'use client'` component. Variables without `NEXT_PUBLIC_` become `undefined` on the client (they don't leak the value), but literal strings, internal URLs and logic do leak.
- Ruled out if: sensitive modules have `import 'server-only'` (the build fails if the client imports them) or are not reachable from the client.
- Not ruled out by: "the value comes from env, so it doesn't leak" when there is a literal fallback (`process.env.X ?? 'sk-...'`).
- How to fix: `import 'server-only'` at the top of data/secret modules.
- CWE: CWE-200
