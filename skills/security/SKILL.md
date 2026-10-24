---
description: AI security review of the project connected to Faundr — reads the code (routes, login, data access, database rules, user input, limits, CI) looking for what automated checks cannot see (access to another user's data, route without login, badly written RLS, payment logic, rate limit, AI, removed member who keeps access, outside PR running with the keys), sends each serious suspicion through an independent verifier and records each real problem as S-n on the dashboard (or "Needs check", when what decides it is not in the code). Use when the user asks for a security review, before publishing the app, or when Faundr suggests it.
argument-hint: '[--files a.ts,b.ts | S-n]  (no argument: full review; S-n: recheck a "Needs check")'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Read Grep Glob
---

## Context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-context $ARGUMENTS`

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it is not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

You are reviewing the **user's own code**, by reading files. Do not run attacks, do not call the app's API, do not install anything, do not run the project's build or tests to prove a finding. A finding of yours is a **hypothesis read in the code**: be honest about the confidence.

**`S-n` argument** (recheck a "Needs check"): run `faundr security-show S-n`, check the missing fact (through the Supabase MCP, if it is database configuration; otherwise ask the user exactly what to look at and where) and close it: confirmed → record it again the same way, **without** `--needs-check`, with the severity (step 5); not a problem → `faundr security-ignore S-n --reason "not-an-issue" --note "<the control you saw>"`. Skip the rest.

## 1. Prepare

1. Read the catalog topics listed in the context (Read tool). They say what to look for, where, how to confirm, and what rules out each problem.
2. **Quick** mode (`--files`): review only these files and what they call directly. **Full** mode: the whole project, starting with the entry points. If the context lists **what changed since the last review**, start with those files and recheck what the last one marked as "clean" in them. One round never exhausts the project: later rounds add up.
3. **Supabase**: if the project uses Supabase, check the real database (including what was changed directly in the dashboard and is not in the migrations). If the Supabase MCP is connected, call `get_advisors` with `type: "security"`, save the JSON response to a temporary file and run `faundr security-import <file>`; otherwise, if the user has `SUPABASE_ACCESS_TOKEN` set, run `faundr security-supabase`. Do not ask for the token in the chat.
4. If the Faundr graph exists (`.faundr/`), use `faundr graph-query "<question>"` to follow the data path (e.g.: "who calls the function that deletes a project?") instead of reading everything.
5. **Full** mode: launch now, in parallel and without waiting, the two extra-pass subagents (section 3). They work while you map.

## 2. Map the entry points

For each route, server function, server action, edge function, database policy and CI workflow listed in the context, answer by reading the code:
- **Who can call it?** Does it require login? Where is that checked (in the handler itself, in a middleware that covers this route)?
- **Do they own the data?** Is the id that arrives (URL, body, query) checked against the logged-in user before reading, changing or deleting? Does the sibling route (another verb, bulk version, export, old route) check the same way?
- **What comes in?** Does any client field go straight to the database, to SQL, to a command, to HTML, to a URL fetch, to an AI prompt? Are there fields the client should not be able to change (role, owner_id, plan, price)? Does data stored safely later come back to a dangerous place (second order: a name becomes a path, a text becomes HTML or a URL)?
- **Limits:** body size, pagination, number of requests per minute (login, sign-up, email, AI, writes), regex and compressed files.
- **What goes out?** Does the response return more data than the screen needs (password hash, other people's emails, tokens)? Do errors leak details?
- **And afterwards?** Do deletion, removing someone from the team, invites, export, cache and search follow the same rule (catalog `data-lifecycle.md`)?
- **With what power?** Can the key, the database role or the function serving this entry point do more than it needs (`least-privilege.md`)? If something goes wrong here, is it recorded who did it (`logging-and-monitoring.md`)?

Use the shortest path to the answer: it stopped being worth following once the control was found (or it became clear it is missing). Also record what is **clean**: coverage is information.

## 3. Extra passes (full mode)

Two subagents (Agent tool), launched together in step 1.5. Each one receives: the project folder, the stack and the list of entry points from the context, and the instruction below. Ask for the answer as a list of suspicions, each with file:line, the data path and the control it looked for; without recording anything in Faundr.

- **The obvious** — "Check, one by one, without skipping: literal secret in the code (grep `password`, `secret`, `apikey`, `token`, `Bearer`, `-----BEGIN`); `TODO`/`FIXME`/`HACK` that talk about auth, permission or validation; debug mode that turns on by variable, query or header; test/seed password or user that works in production; `/debug`, `/admin`, `/test`, `/health`, `/metrics`, `/env`, `/config` routes without login; versioned `.env`, `*.pem`, `*.key`, `credentials.json` and a `.gitignore` that does not cover them; `eval`, `exec`, `child_process`, `Function()`, `import()` with outside text; CORS `*` with credentials; session cookie without `HttpOnly`/`Secure`/`SameSite`; `redirect`/`next`/`url`/`returnTo` parameter that goes to a redirect without validation; production error returning a stack trace or SQL. The signal is not enough: follow the path until you can say what someone can do. A signal without harm is not a suspicion."
- **The wildcard** — "Find what the common categories miss. Read the code that looks boring or unrelated to security: the strangest thing in the project, a half-done or experimental feature, a route that exists but the front end never calls (the API accepts what the screen does not allow), an undocumented parameter or header, a mix of features that were not made to work together, a comment explaining why something is safe (check the explanation), `temp`/`hack`/`legacy` variables, and what the tests do **not** test. Run `git log -p -S` looking for removed permission checks and secrets that were once committed. Also: chained problems, where what a regular user can write or read becomes the input of a trust decision somewhere else."

When they come back, treat each of their suspicions like your own (section 4).

## 4. For each suspicion, close it in one of three states

First write the **invariant**, one line each: (1) who attacks and what they already have (visitor, logged-in user, member of another team); (2) what they send or do; (3) the control that should block it and where it should be; (4) the path in the code, from entry to effect (file:line); (5) the smallest concrete effect (reads another user's order, becomes admin, runs a command); (6) the minimal fix at the last trusted point and the test that would prove it works. If you cannot write (1) and (5), it is not a security problem.

- **Confirmed**: you read the complete path and the control that should exist does not exist. It goes to the verifier (section 5).
- **Ruled out**: you found the specific control that prevents the problem. **Name the control** (e.g.: "the RLS policy `own rows` checks `auth.uid() = user_id`", "the handler calls `findToken` and compares `owner_id`"). Without naming the control, do not rule it out.
- **Needs check**: the path is in the code, but the deciding fact is not (Supabase dashboard configuration, production environment variable, provider rule, proxy, deploy). **Missing information is never proof of safety, nor of a problem.** Record it with `--needs-check "<the exact missing fact>" --how-to-check "<where and how the owner checks it, without attacking anything>"`. It is not "confirmed with low confidence": it stays out of the count until someone checks.

**Counter-evidence before moving on**: argue against your own finding. Look for the control that would knock it down (global middleware, RLS doing the work, validation in a helper, the route is not exposed). These do not rule out a problem:
- "the library must handle that" without seeing where;
- the control existing in another similar route, but not in this one;
- the check only in the front end (hiding a button is not authorization);
- a control that fails open (error → lets it through);
- the variable "looking" internal when it comes from a parameter.

**Defense in depth is not a problem**: if layer A already blocks the attack, the lack of layer B is a hardening note (tell the user at the end), not an S-n. The same for "missing good practice" with nobody harmed.

**Variants**: found a high or critical problem? Look for the same mistake in other routes and functions of the same kind (same code pattern, same helper, same table). The same cause in several places is **one** S-n with the places in the detail; independent causes are separate S-n.

**Calibrate the severity** by what an attacker can actually do (never above the effect you described):
- **critical**: read/change/delete any user's data without login, take over another account, execute code on the server or in CI with the keys, payment without paying;
- **high**: completely break an explicit control with real consequences, requiring being logged in (read another organization's data, become admin, XSS that hits other users); or abuse that generates high cost (AI route without a limit);
- **medium**: real violation with limited reach, unusual condition or only some resources affected (no rate limit on login, open CORS without credentials);
- **low**: non-secret internal detail, or great effort for minimal gain.

Question that separates high from medium: does the effect **break** the control on an action that matters, or only **weaken** it? If you cannot state the concrete harm, the severity is lower than it looks. Do not inflate: a missing header alone, self-XSS and an isolated open redirect are not critical.

## 5. Independent verifier (before recording)

Whoever found it does not confirm it. Before recording, send the confirmed suspicions to a new subagent (Agent tool) that **has not seen your reasoning**:
- **Full** mode: all of them. **Quick** mode: the high and critical ones (you record the medium and low ones yourself).
- One subagent can receive several independent suspicions at once (up to 5); never a suspicion of yours together with your verdict.
- Send for each suspicion only: title, files and lines of the path, the invariant (steps 1 to 5) and the proposed severity. **Do not send** why you think it is real.
- Instruction: "You did not write these suspicions. For each one, try to knock it down by reading the project's code (read only; do not run anything, do not call services). Reread each cited file and line; check whether the entry is really reachable by whoever has the least access and whether the final effect happens. Look for the strongest control on the path: login, data ownership, RLS, validation, middleware, framework, versioned configuration. Check whether the severity and the fix match only what the code shows. Answer for each one: `confirmed` (with the severity you would give and one sentence on why), `ruled out` (naming the control and where it is) or `needs check` (with the exact fact that is not in the code)."

Follow the answer: ruled out is dropped (tell the user, with the named control); needs check becomes `--needs-check`; confirmed with a different severity keeps the verifier's, unless you point out in the code why it was wrong. Nobody confirms their own findings in its place.

## 6. Record

One command per problem (do not repeat what is already in the context's list of open ones; if an automatic one is a false alarm, tell the user and suggest ignoring it from the dashboard):

`faundr security-finding "<short title: the problem>" --severity critical|high|medium|low --category <check id in the catalog> --file <path> --line <n> --confidence high|medium|low --cwe CWE-xxx --detail "<what it is, in plain language, and the path in the code>" --impact "<what someone can do, concrete>" --fix "<the minimal fix and the test that proves it>"`

"Needs check": the same command, with `--severity` being the severity **if confirmed**, plus `--needs-check "<the missing fact>" --how-to-check "<how the owner checks it>"`.

Write `--detail`, `--impact`, `--fix`, `--needs-check` and `--how-to-check` in the user's language, for **people who don't code** to read on the dashboard. Never paste a whole key: mask it.

## 7. Coverage critic (full mode)

Before closing, send to a new subagent (Agent tool): the list of entry points from the context, the catalog topics read, what you reviewed and what was clean (with the control). Instruction: "Read the project's code (read only) and point out what this review left out: entry point without an answer, sibling route or parallel path to the same effect that nobody looked at, catalog topic that applies and was not read, area marked as clean without the named control, deletion/access removal/export/cache not checked. List only gaps with a file, not findings."

Review yourself the gaps it points out (sections 2 and 4, with the verifier for what you confirm). What cannot be reviewed now goes into `--summary` as not covered.

## 8. Record the coverage

At the end, with the Bash tool:

`faundr security-review-done --areas "<what you reviewed; separated by ;>" --clean "<what you checked and is ok, with the named control; separated by ;>" --summary "<2 sentences, including what was left out>"` (add `--quick` in quick mode)

Write these texts in the user's language.

## 9. Answer

In plain language, in the user's language, a few lines:
1. What was reviewed and how many problems by severity (and how many "Needs check").
2. The most serious ones (S-n and one sentence on what can happen).
3. How many suspicions the verifier knocked down (and the control for each, in a few words).
4. What was clean, the hardening notes (defense in depth) and what could **not** be checked from the code alone.

Offer to fix with `/faundr:security-fix S-<n>` and, for the "Needs check" ones, to recheck with `/faundr:security S-<n>`. **Do not start fixing without the user asking.**
