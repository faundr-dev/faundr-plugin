# Browser (cross-window messages, opened tabs, service worker, data stored in the browser)
When to read: the project has a front end (React, Vue, Svelte, Astro, HTML), a browser extension (`manifest.json` with `manifest_version`) or a script/SDK that runs inside other people's sites. This file covers problems that happen inside the user's browser and that the server check doesn't see. XSS via `dangerouslySetInnerHTML` and `href` is in `input-and-injection.md`; cookies and headers in `data-exposure.md`; token in `localStorage` in `authentication.md`.

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

## extensao-confia-em-servidor-local — Browser extension that hands a powerful capability to whatever answers on localhost
- Typical severity: high (any program on the machine, or a malicious package run by `npm install`, takes over the user's logged-in tabs: reads pages, cookies and tokens, clicks, submits); critical if the capability is `chrome.debugger`/CDP, `cookies` or `<all_urls>` scripting.
- Where to look: extensions (`manifest.json`) with `debugger`, `tabs`, `scripting`, `cookies`, `nativeMessaging` permissions or `host_permissions` for `http://127.0.0.1/*`/`localhost`; background/service worker code that `fetch`es or opens a `WebSocket` to `127.0.0.1:<port>`, polls a local endpoint, or accepts `externally_connectable` messages; a "bridge" or "pairing" step.
- How to confirm by reading the code: ask who the extension trusts and how it knows. If it connects to a local port and accepts commands from whatever answers there, with a token the **server** chooses (or no token), then any process that binds that port first (or a second copy of the tool) is trusted. Check also whether a web page can reach the same bridge (`externally_connectable.matches` too broad, a local HTTP server without an `Origin` check, DNS rebinding to `127.0.0.1`). Then check whether the user sees and approves each new controller, and per tab or session.
- Ruled out if: a pairing secret generated and stored by the **extension** (and copied once by the user into the CLI, or exchanged via native messaging, which only the installed host can use), checked on every connection; plus a visible confirmation in the browser before taking a tab (with a short code the user compares with the one shown by the tool), timing out to "deny"; and minimal permissions (`activeTab` instead of `<all_urls>`, debugger attached only to the approved tab).
- Not ruled out by: "only our CLI listens on that port"; a random port (local processes can scan); a token sent by the server itself; checking `sender.url` on localhost.
- How to fix:
  ```js
  // bad: whoever answers on the port gets CDP on the active tab
  const ws = new WebSocket(`ws://127.0.0.1:${port}/bridge`)
  ws.onmessage = async ({ data }) => chrome.debugger.sendCommand({ tabId }, ...JSON.parse(data))
  // good: the extension's own secret + the user's approval for this tab
  const { secret } = await chrome.storage.local.get('secret')        // created at install
  if (hello.proof !== await hmac(secret, hello.nonce)) return ws.close()
  if (!(await askUser(tabId, hello.code, { timeoutMs: 60_000 }))) return ws.close()
  ```
- CWE: CWE-346

## sdk-injetado-quebra-o-app — Script or SDK injected into someone else's page that can break it or leak through it
- Typical severity: medium (one bug in the SDK takes down the customer's checkout or login, or every `fetch` of the app starts throwing); high if the wrapper reads request/response bodies and sends them out (tokens, personal data).
- Where to look: code the project ships to run inside other apps: monitoring/analytics/error SDKs, widgets, browser-extension content scripts. Look for wrappers of `window.fetch`, `XMLHttpRequest.prototype.open/send`, `console.*`, `window.onerror`, `history.pushState`, `addEventListener`; also server SDKs that wrap the framework's error handler or `process.on('uncaughtException')`.
- How to confirm by reading the code: inside the wrapper, is every line of the SDK's own work (building the event, `crypto.randomUUID()`, `JSON.stringify`, `navigator.sendBeacon`, its own `fetch`) in a `try/catch` of its own, **outside** the path that returns the app's response or rethrows the app's error? Does it use APIs that may not exist in the host (`crypto.randomUUID` is missing on plain `http://` pages and older browsers; global `crypto` is missing in old Node)? On the server, is the capture function awaited or `.catch`ed (an unhandled rejection inside the error handler can crash the process)? Does the wrapper read bodies or headers it then sends?
- Ruled out if: the app's call is made and returned untouched, and the SDK's work runs in an isolated `try/catch` (or `queueMicrotask`/`setTimeout` with its own catch); feature detection with fallbacks; capture never rejects; only metadata (status, URL without query) is collected unless the integrator opts in.
- Not ruled out by: "it works on our test page"; a `try` around the whole wrapper whose `catch` rethrows or returns nothing.
- How to fix:
  ```js
  // bad: if report() throws, the app's fetch throws too
  window.fetch = async (...a) => { const r = await orig(...a); if (r.status >= 500) report(r); return r }
  // good: the SDK can fail; the app's fetch cannot
  window.fetch = async (...a) => {
    const r = await orig(...a)
    try { if (r.status >= 500) report({ status: r.status, url: String(r.url).split('?')[0] }) } catch {}
    return r
  }
  const id = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  ```
- CWE: CWE-754
