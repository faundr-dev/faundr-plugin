---
description: Connects the published app to Faundr so the errors that happen to users show up in the Errors section (E-n). In the browser it adds Faundr's own error snippet (one line in the <head>, nothing to install); on JavaScript servers (Node, Cloudflare Workers) it installs Faundr's @faundr/errors (one file, no dependencies); an app whose Sentry SDK only sends to Faundr is offered the swap; on mobile and other languages it installs the official Sentry SDK (free, MIT) pointing at Faundr, with no Sentry account, without sending performance data or screen recordings. Checks it with a test error. Use when the user asks to track the published app's errors or when the Errors section suggests it.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm install *) Bash(npm uninstall *) Bash(pnpm add *) Bash(pnpm remove *) Bash(yarn add *) Bash(yarn remove *) Bash(bun add *) Bash(bun remove *) Bash(pip install *) Bash(uv add *) Bash(poetry add *) Bash(flutter pub add *) Bash(dart pub add *) Bash(composer require *) Read Grep Glob Edit Write
---

## This project's receiving address

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" errors-dsn`

If an error shows up, tell the user and stop. The address above (DSN) is public by nature (it goes in the site's JavaScript): it can stay in the code or in a public variable.

## Browser: Faundr's snippet

For everything that runs in the browser, use the **website snippet** printed above, not a Sentry package. It is one `<script>` in the `<head>`, before the other scripts, served by Faundr (it updates by itself). It already does what the rules below ask of the Sentry SDK: errors only (unhandled errors, rejected promises and requests with a 5xx or no answer, not `console.error`), the last steps before each error, passwords/tokens/emails/cards removed before leaving the browser, and off on localhost.

- **Version = commit:** add `data-release="<commit hash>"` (Vite: `data-release="%VITE_COMMIT_SHA%"` in `index.html`, with `VITE_COMMIT_SHA` set in the build; Next.js: `data-release={process.env.NEXT_PUBLIC_COMMIT_SHA}`).
- **Login:** after sign-in, `window.faundr?.setUser(user.id)` (only the id).
- **Error boundaries** (React `componentDidCatch`/`ErrorBoundary`, Angular `ErrorHandler`, Vue `app.config.errorHandler`) swallow the error: call `window.faundr?.capture(error)` inside them.
- **CSP:** if the site has a Content-Security-Policy, add the Faundr address to `script-src` and `connect-src`.
- In TypeScript, declare it once: `declare global { interface Window { faundr?: { capture(e: unknown): void; setUser(id: string | number | null): void } } }`.

## JavaScript server: `@faundr/errors`

For JavaScript on the server (Node, Cloudflare Workers, Bun, and the server side of Next.js, SvelteKit, Nuxt, TanStack Start, Remix, React Router, Express, Fastify), don't install a Sentry package: install **`@faundr/errors`** with the package manager the project already uses (`npm install @faundr/errors`, `pnpm add`, `yarn add`, `bun add`). It's one file with no dependency, with TypeScript types, and it updates like any package. If the user doesn't want a new package, `faundr errors-sdk --dir <folder>` copies the same file (`faundr-errors.mjs` and its types) into the project, to import with a relative path.

- It sends unhandled errors and rejected promises without a `catch` (the Node process still ends as it would without it) and errors that escape a Worker's `fetch`/`scheduled` (through `ctx.waitUntil`, without delaying the response). From the request it sends only the method and the path, never headers or body.
- **Production only:** on Node it turns on only with `NODE_ENV=production` (or `enabled: true`). On Workers it's on, except for `localhost` (`wrangler dev`).
- **Version = commit:** `release`; without it, it reads `COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, `RENDER_GIT_COMMIT`, `RAILWAY_GIT_COMMIT_SHA`, `SOURCE_VERSION` or `WORKERS_CI_COMMIT_SHA`.
- **Frameworks catch route errors themselves:** connect their error hook to `capture(error, { request })` (table in step 1).

## Rules (Sentry SDK: mobile and other languages)

- **Don't use the Sentry wizard** (`npx @sentry/wizard`) or create a Sentry account: it creates a project there and asks for a token. Here the SDK only sends errors to Faundr.
- **Errors only.** No performance, screen recording or profiles: `tracesSampleRate: 0` (or no option), no `replayIntegration`, no `browserTracingIntegration`, no `profilesSampleRate`.
- **Privacy:** `sendDefaultPii: false`. Don't send the user's email, name or IP. If the app has login, you may send only the id: `Sentry.setUser({ id })`. Faundr also scrubs passwords, tokens, cards, emails and IPs before storing.
- **Production only:** `enabled` on only in the production build, so development errors don't get mixed in (Faundr already catches those through the commands).
- **Version = commit:** `release` with the build's commit hash, so Faundr links the error to the session that made the change. Use what the platform already offers (Vercel: `VERCEL_GIT_COMMIT_SHA`; Cloudflare: `CF_PAGES_COMMIT_SHA` or `WORKERS_CI_COMMIT_SHA`; Netlify: `COMMIT_REF`) or inject it in the build (`git rev-parse --short HEAD`).
- **No source map upload** and no `authToken`/`SENTRY_AUTH_TOKEN`: Faundr resolves the stack on the user's computer when fixing.
- Minimal change: don't reorganize the project's files.

## 0. Already has a Sentry SDK?

If the `package.json` has a JavaScript `@sentry/*` package, find the DSN it uses (in the code, `.env.example` or the config files; don't read `.env`):

- **It points to this Faundr** (same host as the DSN above): Sentry is there only to send errors to Faundr. Offer the swap in one question: "Swap the Sentry SDK for Faundr's? It's lighter, removes `@sentry/…` and keeps the same DSN." Only with the user's OK: put the snippet in the browser and `@faundr/errors` on the server (step 1), remove the Sentry `init`/`withSentry`/`Sentry.ErrorBoundary` code and its config files (`sentry.*.config.*`, `instrumentation-client.ts` if it only had Sentry), uninstall the `@sentry/*` packages, and check with a test error (step 3). Without the OK, leave it as it is.
- **It points elsewhere** (sentry.io or the user's own Sentry): the person uses Sentry for real. Don't offer the swap and don't touch it; Faundr can bring those errors in with `faundr errors-import-sentry` (step 4).

Mobile and the other languages keep the Sentry SDK: no swap.

## 1. Find out what the app uses

Read the `package.json` (and the configuration files) and choose what goes where. **Browser = Faundr snippet; JavaScript server = `@faundr/errors`**; a Sentry package only for mobile and the other languages:

| The app is | Browser | Server (`@faundr/errors`) |
|---|---|---|
| Next.js | snippet in the `<head>` of `app/layout.tsx` (or `pages/_document.tsx`) | `instrumentation.ts`: `export function register() { init({ dsn, release }) }` and `export const onRequestError = (error, request) => capture(error, { request: { method: request.method, url: request.path } })` |
| React with Vite, plain SPA | snippet in `index.html` | — |
| TanStack Start, Remix, React Router | snippet in the root document's `<head>` | on Cloudflare, `withFaundr` on the server entry's `export default`; on Node, `init` at the top of the server entry |
| SvelteKit | snippet in `src/app.html` | `hooks.server.ts`: `init(...)` at the top and `export const handleError = ({ error, event }) => { capture(error, { request: event.request }) }` |
| Vue / Nuxt | snippet in `index.html` / `app.head.script` in `nuxt.config.ts` | Nuxt, only if the user wants it: a Nitro plugin (`server/plugins/faundr.ts`) with `init(...)` and `nitro.hooks.hook('error', (error, { event }) => capture(error, { request: event?.node.req }))` |
| Angular | snippet in `src/index.html`, plus an `ErrorHandler` that calls `window.faundr?.capture(error)` | — |
| Plain HTML site (no framework) | snippet in the `<head>` of each page | — |
| Cloudflare Worker | — | `export default withFaundr((env) => ({ dsn: env.FAUNDR_DSN, release: env.COMMIT_SHA }), { fetch, scheduled })` |
| Node (Express, Fastify, scripts) | — | `init(...)` at the top of the entry point; Express: `app.use(errorHandler())` after the routes; Fastify: `app.addHook('onError', async (req, _reply, error) => capture(error, { request: req }))` |

For the apps below there is no snippet or `@faundr/errors`: choose **one** package.

| The app is | Package | Where to initialize |
|---|---|---|
| Expo / React Native | `@sentry/react-native` | `App.tsx` |
| Python (FastAPI, Django, Flask, scripts) | `sentry-sdk` (in requirements/pyproject) | `sentry_sdk.init(...)` at the top of `main.py`/`app.py`, or in Django's `settings.py`; the FastAPI, Django and Flask integrations turn on by themselves |
| Flutter | `sentry_flutter` (`flutter pub add sentry_flutter`) | `main()`: `await SentryFlutter.init((o) {…}, appRunner: () => runApp(const App()))` |
| Server-side Dart | `sentry` (`dart pub add sentry`) | `main()`: `await Sentry.init((o) {…}, appRunner: …)` |
| Laravel | `sentry/sentry-laravel` (`composer require sentry/sentry-laravel`) | `SENTRY_LARAVEL_DSN` in `.env` and, on Laravel 11+, `Integration::handles($exceptions)` in `bootstrap/app.php` |
| PHP without a framework | `sentry/sentry` (`composer require sentry/sentry`) | `\Sentry\init([...])` at the entry point (`public/index.php`) |
| Go (net/http, Gin, Echo, Fiber) | `github.com/getsentry/sentry-go` (`go get github.com/getsentry/sentry-go`) and the framework package (`sentry-go/gin`, `/echo`, `/fiber`, `/http`) | `sentry.Init(...)` at the top of `main()`, `defer sentry.Flush(2 * time.Second)` and the framework middleware (with `Repanic: true`) |
| Spring Boot (Java/Kotlin) | `io.sentry:sentry-spring-boot-starter-jakarta` (Boot 3) in `pom.xml`/`build.gradle` | configuration only: `sentry.dsn` and the other keys in `application.properties`/`.yml`; the starter captures the controllers' errors |
| Android (Kotlin/Java) | Gradle plugin `io.sentry.android.gradle` | `io.sentry.dsn` in `AndroidManifest.xml` (`<meta-data>`); the plugin turns it on by itself |
| ASP.NET Core (C#) | `Sentry.AspNetCore` (`dotnet add package Sentry.AspNetCore`) | `builder.WebHost.UseSentry(o => {…})` in `Program.cs` |
| .NET without ASP.NET (console, worker) | `Sentry` (`dotnet add package Sentry`) | `using var _ = SentrySdk.Init(o => {…})` at the top of `Main` |
| Rust (Axum, Actix Web, programs) | `sentry` (`cargo add sentry`) and, on Axum, `sentry-tower` (`cargo add sentry-tower --features http`) | `let _guard = sentry::init(...)` on the first line of `main()`, before the tokio runtime (without `#[tokio::main]`; build the runtime after the init); on Axum, `.layer(NewSentryLayer::new_from_top())` and `.layer(SentryHttpLayer::new())` |
| C and C++ | `sentry-native` (via vcpkg `sentry-native`, Conan `sentry-native` or CMake's FetchContent) | `sentry_init(options)` at the top of `main()` and `sentry_close()` before exiting; the build needs symbols (`-g` or `RelWithDebInfo`) for the error to carry file and line |

If the app has a browser and a server, connect both (it's the same DSN).

## 2. Install and configure

Browser (the snippet above, with the version):

```html
<script src="<Faundr address>/sdk/v1.js" data-dsn="<DSN above>" data-release="%VITE_COMMIT_SHA%"></script>
```

```tsx
// React error boundary: the error caught here doesn't reach the page on its own
componentDidCatch(error: Error) {
  window.faundr?.capture(error)
}
```

JavaScript server (after installing `@faundr/errors`; with `faundr errors-sdk`, import the copied file instead):

```ts
// Node: at the top of the entry point, before the rest
import { init, errorHandler } from '@faundr/errors'
init({ dsn: '<DSN above>', release: process.env.COMMIT_SHA })
// … routes …
app.use(errorHandler()) // Express: after the routes, before the app's own error handler
```

```ts
// Cloudflare Worker: FAUNDR_DSN as a variable in wrangler.jsonc ("vars"); it's public, not a secret
import { withFaundr } from '@faundr/errors'
export default withFaundr((env) => ({ dsn: env.FAUNDR_DSN, release: env.COMMIT_SHA }), { fetch, scheduled })
```

Mobile and the other languages: install the Sentry package with the package manager the project already uses (check the lockfile), following the rules above (errors only, no personal data, production only, version = commit):

```python
# Python: sentry-sdk
import os, sentry_sdk
if os.environ.get("ENV") == "production":
    sentry_sdk.init(dsn="<DSN above>", environment="production", release=os.environ.get("COMMIT_SHA"),
                    send_default_pii=False, traces_sample_rate=0)
```

```dart
// Flutter: sentry_flutter (kReleaseMode = production build)
await SentryFlutter.init((o) {
  o.dsn = kReleaseMode ? '<DSN above>' : '';
  o.environment = 'production';
  o.release = const String.fromEnvironment('COMMIT_SHA'); // flutter build … --dart-define=COMMIT_SHA=$(git rev-parse --short HEAD)
  o.sendDefaultPii = false;
  o.tracesSampleRate = 0;
}, appRunner: () => runApp(const App()));
```

```php
// Laravel: config/sentry.php already reads the .env; leave it like this on the production server
// SENTRY_LARAVEL_DSN=<DSN above>
// SENTRY_ENVIRONMENT=production
// SENTRY_RELEASE=<commit hash>
// SENTRY_SEND_DEFAULT_PII=false
// SENTRY_TRACES_SAMPLE_RATE=0
```

```go
// Go: sentry-go (APP_ENV and COMMIT_SHA come from the server environment)
if os.Getenv("APP_ENV") == "production" {
	if err := sentry.Init(sentry.ClientOptions{Dsn: "<DSN above>", Environment: "production", Release: os.Getenv("COMMIT_SHA"), SendDefaultPII: false, TracesSampleRate: 0}); err != nil {
		log.Printf("sentry: %v", err)
	}
	defer sentry.Flush(2 * time.Second)
}
r.Use(sentrygin.New(sentrygin.Options{Repanic: true})) // Gin; on net/http: sentryhttp.New(...).Handle(mux)
```

```properties
# Spring Boot: application-prod.properties (production profile only)
sentry.dsn=<DSN above>
sentry.environment=production
sentry.release=${COMMIT_SHA:}
sentry.send-default-pii=false
sentry.traces-sample-rate=0
sentry.in-app-includes=com.yourcompany
```

```csharp
// ASP.NET Core: Program.cs
if (builder.Environment.IsProduction())
    builder.WebHost.UseSentry(o =>
    {
        o.Dsn = "<DSN above>";
        o.Environment = "production";
        o.Release = Environment.GetEnvironmentVariable("COMMIT_SHA");
        o.SendDefaultPii = false;
        o.TracesSampleRate = 0;
    });
```

```rust
// Rust: sentry (APP_ENV and COMMIT_SHA come from the server environment). The guard must live until the end of main.
let _guard = (std::env::var("APP_ENV").as_deref() == Ok("production")).then(|| {
    sentry::init(("<DSN above>", sentry::ClientOptions {
        environment: Some("production".into()),
        release: std::env::var("COMMIT_SHA").ok().map(Into::into),
        send_default_pii: false,
        traces_sample_rate: 0.0,
        ..Default::default()
    }))
});
```

```c
// C/C++: sentry-native (production build only)
#ifdef NDEBUG
sentry_options_t *options = sentry_options_new();
sentry_options_set_dsn(options, "<DSN above>");
sentry_options_set_environment(options, "production");
sentry_options_set_release(options, getenv("COMMIT_SHA") ? getenv("COMMIT_SHA") : "dev");
sentry_init(options);
#endif
// … and at the end of main: sentry_close();
```

## 3. Check with a test error

1. Publish and trigger an error on purpose. **Browser snippet:** on the published site, run `faundr.capture(new Error('Faundr test'))` in the browser console (to test on localhost, add `data-dev` to the snippet just for the test and remove it afterwards). **`@faundr/errors` (JavaScript server):** `NODE_ENV=production node -e "import('@faundr/errors').then(async (m) => { m.init({ dsn: '<DSN above>' }); await m.capture(new Error('Faundr test')) })"` in the project folder, or a temporary route that does `await capture(new Error('Faundr test'))`. **Sentry SDK:** a temporary route or button that does `throw new Error('Faundr test')`, or `Sentry.captureException(new Error('Faundr test'))` (on localhost, `enabled: true` just for the test). In the other languages: `sentry_sdk.capture_exception(Exception("Faundr test"))` (Python), `Sentry.captureException(Exception('Faundr test'))` (Flutter/Dart), `\Sentry\captureException(new \Exception('Faundr test'))` (PHP) or `php artisan sentry:test` (Laravel), `sentry.CaptureException(errors.New("Faundr test"))` (Go), `Sentry.captureException(RuntimeException("Faundr test"))` (Java/Kotlin), `SentrySdk.CaptureException(new Exception("Faundr test"))` (C#), `sentry::capture_message("Faundr test", sentry::Level::Error)` (Rust) or `sentry_capture_event(sentry_value_new_message_event(SENTRY_LEVEL_ERROR, NULL, "Faundr test"))` (C/C++).
2. Run `faundr errors` and see whether an E-n "[app publicado]" (published app) showed up. It may take a few seconds.
3. Remove the test button and archive the test E-n: `faundr error-archive E-<n>`.

## 4. Extras (ask the user first)

- **Site up:** `faundr errors-uptime https://<site address>` — Faundr opens the site every 5 minutes; if it goes down, it becomes an E-n and alerts.
- **Alerts on Slack or Discord:** the user pastes the webhook in the dashboard's Errors → Published app section (you don't need the address).
- **CSP:** if the site already has a Content-Security-Policy, add the `report-uri` shown on the same dashboard tab.
- **Already uses Sentry?** `faundr errors-import-sentry --org <org> --project <project>` with `SENTRY_AUTH_TOKEN` set by the user in the terminal (don't ask for the token in the chat).

Answer in a few lines, in the user's language: what was installed and where, how you confirmed it arrived, and what the user needs to do (publish again, if they haven't yet).
