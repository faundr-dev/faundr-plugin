# Security review check catalog

One file per topic. Read only the ones that apply to the project's stack and code. Each check gives: typical severity, where to look, how to confirm by reading the code, what rules it out (the named control), what does not rule it out, how to fix, and the CWE.

| File | Read when… |
|---|---|
| `access-and-idor.md` | the app has login and per-user, per-team or per-organization data (almost always) |
| `authentication.md` | there is login, session, JWT, OAuth, MFA, password reset or protection middleware |
| `supabase.md` | the project uses `@supabase/*` or has a `supabase/` folder |
| `nextjs.md` | the project uses `next` (and, in part, TanStack Start, Remix, SvelteKit) |
| `firebase.md` | the project uses `firebase`/`firebase-admin` or has rules files |
| `input-and-injection.md` | the server builds SQL, commands, paths or templates with outside data, or the front end renders HTML/markdown |
| `api-and-abuse.md` | there are API routes, public forms, email/SMS, webhooks, upload, URL fetching or input that can overload (regex, compressed file, query) |
| `business-logic.md` | there is payment, plans, credits, coupons, stock or multi-step flows |
| `data-exposure.md` | always, in a quick pass (responses, errors, logs, cookies, headers, public files, unencrypted sensitive data, homemade crypto) |
| `data-lifecycle.md` | the app has login (almost always): deleting, removing someone from the team, invites, export, cache and search, account deletion |
| `least-privilege.md` | always: each key, role and function with only the power it needs (database functions open to visitors, third-party key with full power, connection as owner, single admin) |
| `logging-and-monitoring.md` | always, in a quick pass: logging of sensitive actions, logs the user can delete, abuse alerts, controls that fail silently |
| `browser.md` | the project has a front end: cross-window messages, opened tabs, service worker, data stored in the browser, iframe |
| `ci-and-dependencies.md` | the project has CI (`.github/workflows`…) or a package manifest: outside PR running with the keys, PR text in a command, suspicious package |
| `ai-and-llm.md` | the app calls an LLM, has chat, an agent, tools or vector search |
| `php-laravel.md` | the project has PHP code (with or without Laravel) |
| `python-web.md` | the project uses Django, Flask or FastAPI |
| `flutter.md` | the project is a Flutter app or has Dart code |
| `go.md` | the project has `go.mod` or Go code |
| `java-spring.md` | the project has Java or Kotlin code (Spring Boot, Ktor, Android) |
| `dotnet.md` | the project has `.csproj`/`.sln` or C# code (ASP.NET Core, Blazor) |
| `rust.md` | the project has `Cargo.toml` or Rust code (Axum, Actix Web, Rocket) |
| `c-cpp.md` | the project has C or C++ code (CMake, Makefile, Conan, vcpkg) |

Distilled from Strix's knowledge skills (usestrix/strix, Apache-2.0) and Cloudflare's security-audit-skill (cloudflare/security-audit-skill, MIT), adapted for static code review.
