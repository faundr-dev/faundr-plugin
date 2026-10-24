# Browser (cross-window messages, opened tabs, service worker, data stored in the browser)
When to read: the project has a front end (React, Vue, Svelte, Astro, HTML). This file covers problems that happen inside the user's browser and that the server check doesn't see. XSS via `dangerouslySetInnerHTML` and `href` is in `input-and-injection.md`; cookies and headers in `data-exposure.md`; token in `localStorage` in `authentication.md`.

Golden rule: another tab, another site or an iframe can send messages to, open and navigate your page. Everything that arrives through them is user input.

## postmessage-sem-origem — Message from another window accepted without checking who sent it
- Typical severity: high when the message triggers an action (login, data exchange, navigation, saving) or becomes HTML; medium when it only reads.
- Where to look: `addEventListener('message'`, `window.onmessage`, `postMessage(`; embedded widgets, login/payment popups, extensions, third-party iframes.
- How to confirm by reading the code: (1) the receiver checks `event.origin` against an exact list (`===`, not `includes`/`endsWith`/`indexOf`); (2) the sender passes the target origin, not `'*'`, when the message has a token or personal data; (3) the received content doesn't go into `innerHTML`, `eval`, `location` or an action without validating its shape.
- Ruled out if: all three points, with exact origin comparison.
- Not ruled out by: `event.origin.includes('mysite.com')` (lets `mysite.com.attacker.io` through); checking `event.source` without the origin; `postMessage(token, '*')`.
- How to fix: `if (event.origin !== 'https://app.mysite.com') return`, validate the message's shape and send with the exact origin.
- CWE: CWE-346

## window-opener-e-target-blank — Page opened by the app can redirect the original tab
- Typical severity: low to medium (phishing: the original tab turns into a fake login page).
- Where to look: `window.open(url)` with a user URL, `<a target="_blank">` with an `href` coming from user content, without `rel="noopener"`.
- How to confirm by reading the code: modern browsers already treat `target="_blank"` as `noopener`; the risk remains in `window.open` without `noopener` and in links to content posted by other users.
- Ruled out if: `rel="noopener noreferrer"` or `window.open(url, '_blank', 'noopener')`, or the link only points to the app's own domains.
- Not ruled out by: another user's profile/comment link opened with `window.open` without `noopener`.
- How to fix: `noopener` on every `window.open` and external link.
- CWE: CWE-1022

## service-worker-cache-privado — Service worker stores one user's data and serves it to another
- Typical severity: high on a shared computer or when switching accounts doesn't clear the cache; medium otherwise.
- Where to look: `sw.js`, `service-worker.ts`, Workbox (`registerRoute`, `CacheFirst`, `StaleWhileRevalidate`), `next-pwa`, `vite-plugin-pwa`.
- How to confirm by reading the code: see which routes the service worker caches. If `/api/` responses with user data go into the cache, check whether logout or switching accounts deletes that cache (`caches.delete`) and whether the service worker's scope doesn't cover another app's routes on the same domain.
- Ruled out if: only static files (JS, CSS, images) and public pages go into the cache, or the API cache is deleted on logout.
- Not ruled out by: "it's just so it works offline" when it includes authenticated responses.
- How to fix: cache only static files; API responses with `NetworkOnly`; delete caches on logout.
- CWE: CWE-524

## dados-sensiveis-no-navegador — Sensitive data stored in the browser beyond the session
- Typical severity: medium; high when there is a known XSS or the data belongs to other users.
- Where to look: `localStorage.setItem`, `sessionStorage`, IndexedDB, persisted state (`zustand/persist`, `redux-persist`), `BroadcastChannel`.
- How to confirm by reading the code: what is stored (personal data, whole API responses, keys) and whether it is deleted on logout. Stored data is readable by any script on the page and survives a change of user.
- Ruled out if: only preferences and non-sensitive IDs, or everything is deleted on logout.
- Not ruled out by: "it's encrypted" with the key in the same JS.
- How to fix: store the minimum, clear it on logout and keep sensitive data on the server.
- CWE: CWE-922

## clickjacking — App can be loaded inside another site's iframe
- Typical severity: medium when there are one-click actions with an effect (delete, pay, change email, grant access); low on read-only pages.
- Where to look: `X-Frame-Options` and `Content-Security-Policy: frame-ancestors` headers (see `data-exposure.md` → `cabecalhos-de-seguranca`); destructive actions without confirmation.
- How to confirm by reading the code: without `frame-ancestors`/`X-Frame-Options` and with a one-click action that changes something important, the attack is real. Without such an action, it's just a hardening note.
- Ruled out if: `frame-ancestors 'none'` (or `'self'`) or `X-Frame-Options: DENY`; or every important action asks for a typed confirmation.
- Not ruled out by: a "frame-busting" script (`if (top !== self)`), which can be bypassed.
- How to fix: `Content-Security-Policy: frame-ancestors 'none'`.
- CWE: CWE-1021
