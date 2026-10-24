# API and abuse
When to read: the app exposes API routes, public forms (login, sign-up, contact, reset), sends email/SMS, calls paid services (AI, maps, SMS), receives webhooks (Stripe, Mercado Pago, GitHub, Clerk, Supabase), accepts file uploads or fetches URLs provided by the user.

Note on rate limiting in serverless (Vercel, Netlify, Cloudflare Workers, Supabase Edge Functions): an in-memory counter (`Map`, `express-rate-limit` with the default store) does not really work, because each instance has its own. A valid control uses shared storage (Upstash/Redis, KV/Durable Objects, a database table, Cloudflare's Rate Limiting binding, the host's WAF/firewall rules) or the built-in limit of a managed provider.

## rate-limit-auth — Login, sign-up, reset and OTP without an attempt limit
- Typical severity: high for login/OTP/verification code without a limit (brute force; a 6-digit code falls in minutes); medium for sign-up (fake accounts); medium for reset (spam to the victim).
- Where to look: routes/actions for `login`, `signin`, `signup`, `register`, `forgot`, `reset`, `verify`, `otp`, `2fa`, `magic-link`, `invite`.
- How to confirm by reading the code: look for a limiter applied to these routes, keyed by IP and by account/email, with shared storage. For short codes (OTP), check whether there is an attempt limit per code and an expiration.
- Ruled out if: authentication is done by the managed provider (Supabase Auth `signInWithPassword`/`signInWithOtp`, Firebase Auth, Clerk, Auth0), which applies its own limits, and the app has no route of its own that bypasses it; or there is `@upstash/ratelimit`/`env.RATE_LIMITER.limit({ key })`/an attempts table on these routes; or CAPTCHA/Turnstile verified on the server.
- Does not rule out: in-memory rate limit in serverless; limit only in the front end (disabled button); CAPTCHA rendered but token not verified on the server; IP-only limit on login (the attacker switches IPs, and attacks against one account get through).
- How to fix:
  ```ts
  const rl = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, '10 m') });
  const { success } = await rl.limit(`login:${ip}:${email.toLowerCase()}`);
  if (!success) return new Response('Too many attempts', { status: 429 });
  ```
- CWE: CWE-307

## rate-limit-envio-e-rotas-caras — Email, SMS, AI and expensive routes without a limit
- Typical severity: high when each call costs money (SMS, LLM, image generation, paid APIs) or sends messages to third parties (spam on behalf of the domain, sender blocked); medium for heavy routes (reports, exports, searches).
- Where to look: calls to `resend.emails.send`, `sgMail.send`, `nodemailer` `sendMail`, `twilio.messages.create`, `openai.chat.completions.create`, `anthropic.messages.create`, `generateText`/`streamText` (Vercel AI SDK), image APIs; contact forms, "invite a friend", "send by email"; routes that generate PDF/CSV.
- How to confirm by reading the code: for each route that triggers cost, check: does it require login? does it have a per-user limit (and per-IP if anonymous)? does it have a usage cap per plan/day? Is the email/SMS recipient controlled by the user?
- Ruled out if: per-user limit with shared storage + login required; or a daily quota stored in the database and checked before the call.
- Does not rule out: "only logged-in users use it" (open sign-up = anyone); spending limit configured at the provider (avoids bankruptcy, but one user still exhausts everyone's quota, taking the service down).
- How to fix: require login, limit by `user.id`, record usage and check the quota before calling the provider; on public forms, Turnstile/hCaptcha verified on the server.
- CWE: CWE-770

## corpo-e-paginacao-sem-limite — Body, upload or pagination without a cap
- Typical severity: medium (denial of service, bandwidth/database cost); low if the platform already limits it.
- Where to look: `express.json({ limit: '50mb' })`, `bodyParser` with a high limit, `await req.json()`/`req.formData()` in routes without a size check; Hono without `bodyLimit`; `?limit=` without a maximum (`take: Number(req.query.limit)`); `findMany()` without `take`; `select('*')` without `.range`/`.limit`; text fields without `max` in the schema.
- How to confirm by reading the code: see the body limit applied (Express `express.json()` defaults to 100 kb; Next Server Actions default to 1 MB, adjustable in `serverActions.bodySizeLimit`); see whether the client's `limit` is capped (`Math.min(limit, 100)`); see `max()` on strings/arrays in Zod.
- Ruled out if: default limits kept or reasonable explicit limits; pagination with a maximum; schema with `max`.
- Does not rule out: limit in the front end (`maxLength` on the input).
- How to fix: `const take = Math.min(Number(q.limit) || 20, 100)`; `z.string().max(5000)`; `app.use('/api/*', bodyLimit({ maxSize: 1024 * 1024 }))` in Hono.
- CWE: CWE-770

## cors-permissivo — CORS with reflected origin or `*` with credentials
- Typical severity: high when it reflects any origin with `Access-Control-Allow-Credentials: true` on cookie-authenticated routes (another site reads the logged-in user's data); low with `*` without credentials on a public API or one authenticated by the `Authorization` header.
- Where to look: `cors({ origin: true, credentials: true })`, `cors({ origin: (o, cb) => cb(null, true) })`, `res.setHeader('Access-Control-Allow-Origin', req.headers.origin)`, `hono/cors` with `origin: (origin) => origin`, `headers()` in `next.config` with `Access-Control-Allow-Origin`, `vercel.json` headers, `corsHeaders` in Supabase Edge Functions (`'*'`).
- How to confirm by reading the code: see (1) whether the origin is reflected without an allowlist; (2) whether there is `credentials: true`; (3) whether authentication uses cookies. The real danger is the combination.
- Ruled out if: exact origin allowlist; or `*` without credentials and without a session cookie (browsers refuse `*` with credentials); or the API authenticates only through the `Authorization` header, which the attacking site does not have.
- Does not rule out: an allowlist with `origin.endsWith('meusite.com')` (accepts `evilmeusite.com`) or an unanchored regex; `null` in the allowlist.
- How to fix: `cors({ origin: ['https://app.meusite.com'], credentials: true })`.
- CWE: CWE-942

## csrf-cookie-e-mudanca-de-estado — Action with a session cookie without origin protection
- Typical severity: medium to high depending on the action (changing email/password, transferring, deleting the account is high).
- Where to look: cookie sessions (Auth.js, Lucia, custom session, `express-session`, Supabase SSR cookie) + routes that change state with POST/PUT/DELETE, or a GET that changes state (`/api/delete?id=`, `/logout` via GET is low); cookie with `SameSite=None`.
- How to confirm by reading the code: see the session cookie's `SameSite` (the modern default `Lax` blocks cross-site POST, but not navigation GET), whether write routes accept GET, whether they accept `application/x-www-form-urlencoded`/`text/plain` (a form on another site can send without a preflight), and whether there is a CSRF token or an `Origin` check.
- Ruled out if: Next Server Actions (they compare `Origin` with `Host` and only accept POST); Auth.js on its own routes (its own CSRF token); cookie `SameSite=Lax/Strict` and no writes via GET; or an `Origin` check against an allowlist; or authentication only through the `Authorization` header.
- Does not rule out: `SameSite=None` "so it works in the iframe"; a route that changes state via GET; `serverActions.allowedOrigins` with a broad wildcard.
- How to fix: writes only via POST/PUT/DELETE, cookie `SameSite=Lax`, and check `Origin` on your own API routes that use cookies.
- CWE: CWE-352

## webhook-sem-assinatura — Webhook (Stripe and others) accepted without verifying the signature
- Typical severity: critical when the webhook unlocks a plan, credits a balance or marks an order as paid (anyone can forge the event).
- Where to look: routes `webhook`, `webhooks/stripe`, `api/stripe`, `mercadopago`, `clerk`, `github`. Grep: `checkout.session.completed`, `invoice.paid`, `payment_intent.succeeded`, `constructEvent` (its absence is the signal), `await req.json()` in the webhook.
- How to confirm by reading the code:
  1. Stripe: it must call `stripe.webhooks.constructEvent(rawBody, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)` (or `constructEventAsync` in Workers/Edge) on the raw body. `await req.json()` beforehand breaks the verification (teams often "fix" it by removing the verification).
  2. Others: Clerk/Resend use `svix` (`wh.verify(payload, headers)`); GitHub `X-Hub-Signature-256` with HMAC and `crypto.timingSafeEqual`; Mercado Pago `x-signature`.
  3. Check that the secret comes from env and that a verification failure returns 400 and stops.
- Ruled out if: the provider's signature verification on the raw body before any effect; or the handler ignores the event content and fetches the object from the provider's API by ID (`stripe.checkout.sessions.retrieve(id)`) before acting.
- Does not rule out: `try { constructEvent(...) } catch { console.log(err) }` followed by processing (fail-open); checking only that the header is present; verifying the signature but trusting `metadata.userId` without checking the object is yours (this is acceptable, as long as the metadata was written by the server when creating the session).
- How to fix:
  ```ts
  export async function POST(req: Request) {
    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, req.headers.get('stripe-signature')!, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch { return new Response('bad signature', { status: 400 }); }
    // ...
  }
  ```
- CWE: CWE-347

## webhook-sem-idempotencia — Same event processed twice
- Typical severity: medium to high (duplicate credit, duplicate email, wrong stock). Providers resend events by design.
- Where to look: webhook handlers that increment balance/credits or create records without storing `event.id`.
- How to confirm by reading the code: see whether there is a processed-events table with `unique(event_id)` or an idempotent upsert (e.g.: `update ... set plan = 'pro'` is naturally idempotent; `credits = credits + 100` is not).
- Ruled out if: the operation is idempotent by nature, or `insert into processed_events (id)` with a unique constraint before the effect, in the same transaction.
- Does not rule out: checking "did I already process it?" with a SELECT and then inserting (race between simultaneous resends).
- How to fix: `insert ... on conflict (event_id) do nothing returning id`; only apply the effect if a row was returned.
- CWE: CWE-837

## ssrf-fetch-url-do-usuario — Server fetches a URL provided by the user
- Typical severity: high on your own server/VPS/container with an internal network or cloud metadata (`169.254.169.254`); medium on isolated serverless platforms (it still lets someone reach internal services through public URLs, scan ports and abuse the app's IP).
- Where to look: `fetch(body.url)`, `axios.get(req.query.url)`, "import from URL", link previews (unfurl), user-configurable webhooks, PDF/screenshot generation from a URL (Puppeteer/Playwright `page.goto(url)`), AI agent tools that fetch pages, `next/image` with a wildcard (see `nextjs.md`).
- How to confirm by reading the code: see whether there is destination validation (`https:` protocol, host in an allowlist, blocking private IPs after resolving DNS) and whether redirects are followed without revalidating (`redirect: 'follow'` is `fetch`'s default).
- Ruled out if: host allowlist; or a protection library (`ssrf-req-filter`, `request-filtering-agent`) applied to the HTTP client; or the fetch runs in an environment without an internal network and the returned content does not go back to the user and carries no credentials.
- Does not rule out: blocking the string `localhost`/`127.0.0.1` (there is `0x7f000001`, `[::1]`, DNS that resolves to an internal IP, a redirect to an internal IP); validation before the redirect.
- How to fix: allowlist when possible; otherwise resolve DNS, refuse private/link-local ranges, `redirect: 'manual'` and revalidate each hop, timeout and response size limit.
- CWE: CWE-918

## upload-de-arquivo — Upload without restricting type, size or how it is served
- Typical severity: high when uploaded HTML/SVG is served on the app's own domain (stored XSS); medium for a missing size limit (cost) or type limit; critical if the file is written to a folder the server executes.
- Where to look: `multer`, `formidable`, `busboy`, `req.formData()` + `file`, `supabase.storage.from().upload(`, `uploadBytes` (Firebase), S3/R2 presigned URLs (`getSignedUrl(new PutObjectCommand(...))`), `uploadthing`.
- How to confirm by reading the code: (1) type validated on the server by an allowlist (extension and, ideally, magic bytes; the client's `Content-Type` can be forged); (2) maximum size; (3) name generated by the server; (4) file served from a separate domain (bucket/CDN) or with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`; (5) on a presigned URL, `ContentType` and size fixed in the signature.
- Ruled out if: the 5 points, or files served from a storage domain separate from the app (e.g.: `*.supabase.co`) and only images accepted with a maximum size.
- Does not rule out: `accept="image/*"` on the input (that is only the front end); checking the extension by the last part after the `.` but accepting `.svg`; `file.type` coming from the browser.
- How to fix: type allowlist (`['image/png','image/jpeg','image/webp']`) checked on the server, size limit, UUID name, serve as an attachment or from a separate domain; SVG converted to PNG or rejected.
- CWE: CWE-434

## enumeracao-e-ids-sequenciais — Enumeration of resources and users
- Typical severity: low on its own; goes up when combined with IDOR (see `access-and-idor.md`) or when it reveals personal data (list of registered emails).
- Where to look: auto-incrementing integer IDs exposed in URLs (`/invoice/1043`); "check availability" endpoints for email/username without a limit; different error messages for "does not exist" vs "no permission".
- How to confirm by reading the code: see whether the endpoint reveals the existence of other people's objects and whether it has a limit.
- Ruled out if: correct authorization + identical responses (404) for nonexistent and someone else's; rate limit on availability checks.
- Does not rule out: "switching to UUID fixes it" (reduces, does not replace authorization).
- How to fix: respond 404 in both cases; limit availability checks.
- CWE: CWE-203

## sobrecarga-regex — Regular expression that hangs on a crafted text
- Typical severity: medium (one small request ties up the server's CPU for seconds or minutes; in serverless, it becomes a high bill and a queue).
- Where to look: `new RegExp(` with user text (they choose the pattern); a regex with nested repetition applied to user input: `(a+)+`, `(\w+\s?)*`, `(.*,)*`, `([a-z]+)*$`; homemade email/URL validation.
- How to confirm by reading the code: the pattern has a repeated group that contains another repetition (or alternatives that match the same text) and is applied to outside text without a size limit.
- Ruled out if: the text is cut to a small size beforehand (e.g.: 200 characters), or the pattern is linear, or it runs on an engine without backtracking (RE2, Rust `regex`, Go `regexp`).
- Does not rule out: "nobody is going to send that".
- How to fix: size limit before the regex, a pattern without nested repetition, a `RegExp` never built from user text (escape it with `escapeRegExp` if you need to search for the text).
- CWE: CWE-1333

## sobrecarga-arquivo-e-descompactar — Small file that becomes huge when opened
- Typical severity: medium; high when it hangs a shared worker.
- Where to look: decompressing an uploaded zip/gzip (`adm-zip`, `unzipper`, `zlib.gunzip`, `JSZip`), reading an uploaded spreadsheet/PDF/image (`xlsx`, `sharp`, `pdf-parse`), `JSON.parse`/YAML/XML of a body without a limit, XML with entities (`<!ENTITY`).
- How to confirm by reading the code: there is a limit on the size **after** opening (decompressed bytes, number of files in the zip, spreadsheet rows, image pixels), not only on the upload size.
- Ruled out if: limits after opening; `sharp` with `limitInputPixels`; XML parser with entities disabled.
- Does not rule out: a limit only on the uploaded file size (1 MB of zip becomes gigabytes).
- How to fix: count bytes while decompressing and stop at the limit; limit entries, rows and pixels; XML entities disabled.
- CWE: CWE-409

## sobrecarga-consulta-multiplicada — One request that becomes thousands of queries or an endless query
- Typical severity: medium (slowness for everyone, database cost); high on a public route without login.
- Where to look: a loop that runs one query per item (`for … await db…`) with a count coming from the request; `limit` coming from the client without a cap; nested `include`/`select` chosen by the client (GraphQL without a depth limit, `?expand=`); search with `ilike '%texto%'` on a large table without an index on a public route; exporting "everything".
- How to confirm by reading the code: who controls the number of items, the depth or the page size, and whether there is a cap on the server.
- Ruled out if: cap on the server (`Math.min(limit, 100)`), limited depth, a single batched query, route with login and request limit.
- Does not rule out: cap only in the front end.
- How to fix: cap on the server, batched queries (`in (...)`), depth limit in GraphQL, request limit on the route.
- CWE: CWE-400
