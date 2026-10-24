---
description: Fixes a security problem recorded in Faundr (S-n, or all of a package's) and only marks it resolved when the check no longer finds the problem. With no argument, fixes the open critical and high ones, one at a time; with --all, fixes all the open ones, without stopping.
argument-hint: '"[S-<n> | package-name | --all]"'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm install *) Bash(npm update *) Bash(npm ls *) Bash(npx tsc *) Bash(npm run *) Bash(git diff *) Read Grep Glob Edit Write
---

## Problem to fix

Arguments: `$ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-show $ARGUMENTS`

If an error, "fixed" or "No open security problems" shows up, tell the user and stop. With no argument, the list above is the open problems: work only on the **critical and high** ones, one at a time, in list order (run `faundr security-show S-<n>` to see each one). With `--all`, work on **all** of the list, of any severity, following "--all mode" at the end. The ones in the **Needs check** part aren't confirmed problems yet: don't fix them (not even with `--all`). If someone asks for a Needs check S-n, say what still needs to be known and offer `/faundr:security S-<n>` to recheck it first.

## Rules

- Fix only what is described. Don't refactor what wasn't pointed out.
- Don't make up a version number or package name: use exactly the values given.
- If the problem is in a test file, example or documentation, say so instead of changing the file.
- When done, list what was changed and what was left out, with the reason.

## How to fix, by type

**Key or password in the code**
1. Take the value out of the code: put it in `.env` (or `.env.local`), check that `.gitignore` covers `.env*`, and read it with `process.env.NAME` (on the server). Never use a public prefix (`NEXT_PUBLIC_`, `VITE_`…) for a secret.
2. Tell the user, prominently, that they **need to rotate the key at the provider** (the link is in "How to fix"): taking it out of the code isn't enough, it may already have leaked, including through the git history. You can't do this for them.
3. `.env` in git: `git rm --cached <file>` (the file stays on disk) and adjust `.gitignore`. Don't rewrite git history without the user asking.

**Package with a known flaw**
1. See who brought in the package (`faundr` shows "Vem de" (comes from); confirm with `npm ls <package>`).
2. Strategy, in this order: (a) direct dependency: `npm install <package>@^<fixed version>`; (b) came from another package: update the parent package (`npm update <parent>` or a new version of it); (c) only if (a) and (b) don't solve it: `overrides` in package.json forcing the fixed version.
3. Breakage risk: patch jump (1.2.3 → 1.2.9) apply it; minor (1.2 → 1.4) apply it and run the build/tests; major (1.x → 2.x) explain the risk and ask the user first.
4. Malicious package: remove it, delete `node_modules`, reinstall, and tell the user to rotate the keys and passwords on that computer.

**Database (Supabase)**
1. Never edit an old migration that has already run: create a new migration (e.g. `supabase/migrations/<date>_security.sql`).
2. Table without RLS: `alter table public.<t> enable row level security;` + policies that check the owner, e.g. `using ((select auth.uid()) = user_id)`. Check in the code whether the app reads this table and whether the new policies don't block normal use.
3. Policy with `true`: `drop policy` + `create policy` with the owner condition.
4. Show the migration to the user before applying it to the database.

**Code and configuration (automatic check or AI review)**
1. Follow the problem's "How to fix" and the matching catalog theme (`${CLAUDE_PLUGIN_ROOT}/skills/security/catalog/`), with the minimal fix.
2. Data access (IDOR, route without login): check the logged-in user on the server and compare with the data's owner before reading, changing or deleting; never trust an id or `user_id` coming from the client.
3. Request limit (rate limit): use what the project's platform offers (Cloudflare: Workers Rate Limiting binding; Vercel/Node: `@upstash/ratelimit`; Express: `express-rate-limit`), start with the sensitive routes (login, sign-up, email, AI, writes) and respond 429. If it needs a new account or configuration at the provider, explain to the user and ask first.
4. Security headers: add them where the project already builds its responses (middleware, Next's `headers()`, `_headers`), with the CSP first in Report-Only mode.

## Verify and close

1. The project compiles (and the tests pass, if there are any).
2. Run with the Bash tool: `faundr security-resolve S-<n>` for each fixed problem. For automatic check findings, it reruns the check and only closes if the problem is gone; if it says it still shows up, review the fix. For AI review findings, reread the fixed code and close with `faundr security-resolve S-<n> --verified "<what changed and how you checked>"`.
3. If a problem turns out to be a false alarm, **don't** ignore it on your own: explain to the user and suggest ignoring it from the dashboard (Security section) or with `faundr security-ignore S-<n> --reason not-an-issue --note "<why>"`, if they agree.

## --all mode (all of them, without stopping)

The user asked to resolve everything at once: **don't stop to ask** between one problem and the next. Start right away, with the critical and high ones, then the rest.

- **One at a time, in list order**, with the rules and "Verify and close" above. Problems from the same package go out in a single update. For each problem closed, a single line: `S-<n> fixed (<done>/<total>): <what changed>`.
- **What would need the user doesn't block the rest**: major version jump, applying a migration to the database (write the migration, don't apply it), new account or configuration at the provider, a false alarm to ignore. Don't do it; note it under "Waiting on you", with the plan in one line, and move on to the next. Key in the code: take it out of the code normally and note the rotation at the provider under "Waiting on you".
- **Broke and won't come out in 2 attempts** (compilation, test, or `security-resolve` says it still shows up): undo only that problem's change, note it under "Couldn't do" with the reason and move on.
- **Don't end the response while there's an open problem** that isn't under "Waiting on you" or "Couldn't do". If the conversation gets summarized midway, run `faundr security-show` again: the fixed ones have left the list, and it's what remains.
- **At the end**, run `faundr security-show` once more and fix whatever showed up again. Don't commit.

Final answer in --all mode: how many fixed and the "Waiting on you" (highlighting keys to rotate and migrations to apply) and "Couldn't do" lists, with the S-n and one line each.

## Answer

Answer in a few lines, in the user's language: what was wrong, what changed, how it was verified and what the user still needs to do (e.g. rotate the key at the provider).
