---
description: Deep AI security review of the project connected to Faundr — first understands the app (what is worth stealing, who could attack, which rules must always hold), lists every way in (routes, webhooks, database functions and policies, jobs, CI), reads the code behind each one with helpers in parallel, follows money and invitation flows end to end, looks for races and for small problems that add up, checks whether known package flaws are actually reachable, proves each finding where a test can prove it, sends every suspicion through an independent verifier, rechecks the findings already open, and records each real problem as S-n on the dashboard (or "Needs check", when what decides it is not in the code). Use when the user asks for a security review, before publishing the app, or when Faundr suggests it.
argument-hint: '[--files a.ts,b.ts | S-n]  (no argument: full review; S-n: recheck a "Needs check")'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git log *) Bash(git show *) Bash(git diff *) Bash(npx tsc *) Bash(npm test *) Bash(npm run test *) Bash(node --test *) Read Grep Glob Agent
---

## Context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-context $ARGUMENTS`

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it is not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

**This is the deepest security check Faundr has, and it is meant to be thorough.** The automatic checks match known patterns: leaked keys in known formats, packages with published flaws, a handful of code and database rules. They cannot know who is allowed to do what in *this* app. That is your job, and it takes reading and understanding. Do not shorten the review to save tokens: read whole files, follow every path to its end, use helpers in parallel, prove and verify each finding. A shallow review that says "clean" is worse than no review, because the owner will trust it.

You are reviewing the **user's own code**. Never attack anything: do not call the app's API or any deployed service, do not touch the production database beyond reading its configuration through the tools in step 1.3, do not install anything. You **may** run the project's type check and its tests, and write a throwaway test or request in your scratchpad (outside the project) to prove a finding. A finding that was only read is a hypothesis; say so in its confidence. A finding with a failing test is a fact.

**`S-n` argument** (recheck a "Needs check"): run `faundr security-show S-n`, check the missing fact (through the Supabase MCP, if it is database configuration; otherwise ask the user exactly what to look at and where) and close it: confirmed → record it again the same way, **without** `--needs-check`, with the severity (step 9); not a problem → `faundr security-ignore S-n --reason "not-an-issue" --note "<the control you saw>"`. Skip the rest.

## 1. Prepare

1. Read the catalog topics listed in the context (Read tool), **each one whole**. They say what to look for, where, how to confirm, and what rules out each problem. Always read `threat-model.md`, `flows.md`, `access-and-idor.md`, `data-exposure.md`, `least-privilege.md` and `logging-and-monitoring.md`. Also read a topic that is not listed when the code has its subject: a browser extension or an SDK that runs inside other sites → `browser.md`; hooks, MCP servers or CLIs whose output an AI agent reads → `ai-and-llm.md`; release or publish scripts → `ci-and-dependencies.md`. The catalog is a floor, not the review: it lists mistakes others made. The problems that matter most in this app are the ones its own rules create.
2. **Quick** mode (`--files`): these files, read whole, plus what they call and everything that calls them (`faundr graph-callers "<name>" --depth 2` or Grep). Same depth, smaller area: every step below applies to that area, except the surface helpers of step 4, which you may do yourself. **Full** mode: the whole project. If the context lists **what changed since the last full review**, read those first and recheck what the last one marked as "clean" in them; then everything else.
3. **Supabase**: if the project uses Supabase, check the real database (including what was changed directly in the dashboard and is not in the migrations). If the Supabase MCP is connected, call `get_advisors` with `type: "security"`, save the JSON response to a temporary file and run `faundr security-import <file>`; otherwise, if the user has `SUPABASE_ACCESS_TOKEN` set, run `faundr security-supabase`. Do not ask for the token in the chat.
4. The Faundr graph (`.faundr/`), when it exists, helps you follow a path across files (`faundr graph-query "<question>"`, `faundr graph-callers "<name>"`). It is a map to find what to read, never a replacement for reading it.

## 2. Understand the app before reading for flaws (threat model)

Write this down before opening a single route (catalog `threat-model.md` has the method). It goes into the answer, and every later step is checked against it.

- **What is worth taking or breaking here**: the data (whose, how sensitive), the money (who pays whom, what is metered), the powers (who can invite, delete, publish, run code), the keys the app holds for other services.
- **Who could try**: a visitor; a logged-in account from outside the team; the member with the lowest role; an admin against the owner; someone who was removed; another tenant; a service or webhook caller; someone who can send a pull request; an AI agent reading text an attacker wrote.
- **Trust boundaries**: where data crosses from one of them into something more powerful (browser → server, server → database with a full-power key, outside service → webhook, repository text → CI, stored text → AI agent).
- **10 to 20 invariants of this app**, one line each, in the app's own words: "a project is only read by members of its organization", "only an owner creates or changes an owner", "a paid plan is only granted by a verified payment event", "a removed member loses access at once, including tokens already issued". Each invariant is a promise you will try to break in step 4.

If you cannot write the invariants, you do not understand the app yet: read the overview, the routes and the schema until you can.

## 3. List every way in (your own inventory)

The context lists what Faundr found. Build your own complete, numbered list from the code and compare: anything in yours and not in the context is the most interesting place to look (it is what the automatic checks do not see). Include all of these, when they exist:

- every HTTP route, server function, server action and edge function, with its verbs;
- every webhook and every public endpoint with a key that is public by design (ingestion, SDK endpoints, badges);
- every database function callable through the API (RPC), every `security definer` function, every trigger, every policy (table × operation), every view, every storage bucket and its rules, every realtime channel;
- every scheduled job, queue consumer and background task;
- every CI workflow and every release or publish script;
- every place where text from outside reaches an AI model or an AI agent (prompts, tool results, hook output, reports an agent reads), and every tool an AI can call.

Nothing leaves this list without an answer in step 4.

**Large projects** (hundreds of route, handler or job files): make the inventory per file, not per area. Every file that defines a way in or sends data out is read whole by someone: each route module, each websocket or real-time collaboration handler, each queue task, notification or email that carries content, each presenter a public route uses, each policy file, and each front-end component that puts a user-controlled URL or HTML into the page. Split the helpers by directory so that, together, they cover every one of those files, and give each helper its exact list. A helper that runs out of room returns the files it did not read, and you hand them to a new helper. Do not sample the "most important" routes: in a measurement on a real project of about 1,800 code files, a review that read about a quarter of them found 4 to 7 of 20 published flaws, while it found all of them in small projects it could read whole.

## 4. Read the code behind every way in

**Full mode: split the inventory into surfaces and launch one subagent per surface** (Agent tool), several in the same response so they run at the same time, in waves of up to 6 until every item of the inventory is covered. Surfaces: login and session; each group of routes (by area of the app); the database (every policy and every definer function, one by one); money end to end; invitations, roles, ownership and leaving, end to end; CI and publishing; AI, hooks and agent-facing output; uploads and outside fetches; dependencies (step 5). Give each one: the project folder, the stack, the threat model of step 2 (assets, actors, invariants), its numbered share of the inventory, the catalog topics to read whole, and this instruction: "Read the catalog topics first. Then read, whole, every file behind each item of your list, and every file those call until the effect (the database, another service, the response). For each item answer the questions below from the code, and try to break each invariant that touches your surface as each actor of the threat model. Do not record anything in Faundr and do not change any project file. You may run the project's type check and tests. Answer with: a list of suspicions, each with file:line, the actor, the path from entry to effect, the control you looked for and did not find, and the proposed severity; the list of items you found clean, each with the named control and where it is; and the list of files you actually read whole, and the ones you could not." While they work, do steps 5 and 6 yourself. No Agent tool in this session? Do the same surfaces yourself, one at a time, and say so in the answer.

The questions, for each route, server function, server action, edge function, database function, policy, job and CI workflow:

- **Who can call it?** Does it require login? Where is that checked (in the handler itself, in a middleware that covers this route)?
- **Hostile input before the identity check** (public routes and routes with a key that is public by design: ingestion, webhooks, badges, SDK endpoints): walk the handler in order and stop at the check of who is calling. Everything before it (reading the body, parsing, decompressing, writing to an in-memory map, calling a third-party API) is open to anyone. Try lengths and counts that are negative, zero, fractional and huge; ask whether the route is inside the global rate limit and whether outgoing calls have a timeout and a cache for failures (`api-and-abuse.md`).
- **Do they own the data?** Is the id that arrives (URL, body, query) checked against the logged-in user before reading, changing or deleting? Does the sibling route (another verb, bulk version, export, old route) check the same way? A path, URL or id read from a row the client can write is still client input when a full-power client (service role, admin SDK) uses it. For actions that close, consume or delete a colleague's item, is the caller the author, the recipient or an admin?
- **What comes in?** Does any client field go straight to the database, to SQL, to a command, to HTML, to a URL fetch, to an AI prompt, or into the context of an AI agent (hook output, tool result, a report the agent reads)? Are there fields the client should not be able to set, on INSERT as well as UPDATE (role, owner_id, tenant key, plan, price, file path, flags that trigger work)? Does data stored safely later come back to a dangerous place (second order: a name becomes a path, a text becomes HTML, a URL or an instruction to an agent)?
- **Database functions, triggers and invariants** (when there is SQL): for each `security definer` function, simulate three callers and follow every `if`: a visitor (`auth.uid()` NULL), a logged-in account that is **not a member** (role lookups return NULL, and `NULL not in (...)` skips the `raise`), and the member with the lowest role; for role changes, also an admin creating or touching an owner. For each guard trigger, try changing the protected column alone, together with another column, and in several steps (change what the guard looks at, change the protected column, change it back), and by INSERT instead of UPDATE. For each UPDATE policy, can a tenant key move the row to another tenant? (`supabase.md`).
- **Limits:** body size, pagination, number of requests per minute (login, sign-up, email, AI, writes), regex and compressed files, in-memory maps keyed by request data. Does a spending or quota lock fail closed (error recording the spend → stop) and is it checked before each paid call?
- **What goes out?** Does the response return more data than the screen needs (password hash, other people's emails, tokens)? Do errors leak details (including the database's own `error.message`)? Does text that leaves the machine (logs, telemetry, command history, error reports) pass through masking that catches `NAME_PASSWORD=…`, `*_SECRET_KEY=…`, URL credentials and `-p<password>`?
- **And afterwards?** Do deletion, removing someone from the team, invites, export, cache and search follow the same rule (catalog `data-lifecycle.md`)? When a row goes, does its file in storage go too? Does the cleanup job delete everything the plan or privacy policy promises? Does deleting one person's account take the team's data with it (`on delete cascade` from the creator)?
- **With what power?** Can the key, the database role or the function serving this entry point do more than it needs (`least-privilege.md`)? If something goes wrong here, is it recorded who did it (`logging-and-monitoring.md`)?

**The database surface, in particular.** Fill in the matrix **role × table × operation** (visitor, logged-in outsider, lowest member, admin, owner; select, insert, update, delete), one cell at a time, from the final state of the migrations (a later migration may drop, replace or revoke) and from the real database of step 1.3. Then read each policy against **the queries the app actually runs** (`.from('table')`, SQL, RPC): a policy can be correct and the app can still go around it with a full-power key; a query can rely on a filter in the client that the policy does not enforce. Every column the browser can write is checked for "should the user be able to set this?".

Follow each path **to its end**. Finding a control is not the end: check that it covers this verb, this caller and this field, and that it fails closed. Record what is **clean**, with the control and where it is: coverage is information.

## 5. Passes across the whole app

Do these yourself while the surface helpers read (full mode), or for the area under review (quick mode). In full mode, also launch **the obvious** and **the wildcard** as two more subagents at the start.

- **Flows end to end** (`flows.md`): money (from the price shown to the plan granted: who decides the amount, what proves the payment, what happens on refund, failure, replay and out-of-order events, can a plan be granted without paying or kept after cancelling); invitation, role and ownership (invite → accept → role change → removal → what the removed person can still do with tokens, sessions, cached data, pending invites; can someone invite themselves up, accept an invite meant for another address, be the last owner and leave); account and data deletion; anything the app meters or limits. Walk each one as each actor, step by step, out of order and twice.
- **Races**: find every "read, check, then write" (last owner, quota, seat, balance, single-use token or code, coupon, unique name, "if it does not exist, create") and imagine two calls at once, or the same call twice. The check must be enforced by the database (constraint, lock, conditional update) or it is a finding.
- **Chains**: at the end, put side by side everything you marked low, ruled out or noted as hardening, plus what a regular user can write and read. Do two or three of them together make something serious (a value a user controls that becomes the input of a trust decision somewhere else; an information leak that makes a guess feasible; a missing limit that turns a small flaw into account takeover)? A chain is one finding, with each link in the detail.
- **Packages with known flaws** (the context lists the open high and critical ones): do not stop at "the package has a flaw". Read the advisory, find the vulnerable function or condition, and say whether this project reaches it (which file calls it, with what input) → reachable (say so in the answer, with the file that reaches it: this one goes first), not reachable (say why), or cannot tell from the code. Also look at what no list knows: a package nobody has heard of, a typo of a famous name, a dependency pulled from a URL or a git branch, install scripts.
- **The obvious** (subagent) — "Check, one by one, without skipping: literal secret in the code (grep `password`, `secret`, `apikey`, `token`, `Bearer`, `-----BEGIN`); `TODO`/`FIXME`/`HACK` that talk about auth, permission or validation; debug mode that turns on by variable, query or header; test/seed password or user that works in production; `/debug`, `/admin`, `/test`, `/health`, `/metrics`, `/env`, `/config` routes without login; versioned `.env`, `*.pem`, `*.key`, `credentials.json` and a `.gitignore` that does not cover them; `eval`, `exec`, `child_process`, `Function()`, `import()` with outside text; CORS `*` with credentials; session cookie without `HttpOnly`/`Secure`/`SameSite`; `redirect`/`next`/`url`/`returnTo` parameter that goes to a redirect without validation; production error returning a stack trace or SQL; secret-masking regexes (try them against `PGPASSWORD=x`, `STRIPE_SECRET_KEY=x`, `mysql -pX`); dependencies at `latest`/`*` or imported without being declared; CI that does not run the production build; publish scripts that do not check for a clean, pushed tree; limits checked by counting and then creating (grep `count(` near `create(`/`insert`, and model hooks like `beforeCreate` that count: try two requests at once, and the path that reuses an existing row with `save`/`update`/`upsert` and skips a create-only hook). The signal is not enough: follow the path until you can say what someone can do. A signal without harm is not a suspicion."
- **The wildcard** (subagent) — "Find what the common categories miss. Read the code that looks boring or unrelated to security: the strangest thing in the project, a half-done or experimental feature, a route that exists but the front end never calls (the API accepts what the screen does not allow), an undocumented parameter or header, a mix of features that were not made to work together, a comment explaining why something is safe (check the explanation), `temp`/`hack`/`legacy` variables, and what the tests do **not** test. Run `git log -p -S` looking for removed permission checks and secrets that were once committed. Also: chained problems, where what a regular user can write or read becomes the input of a trust decision somewhere else."

Treat every suspicion that comes back from a helper like your own (step 7).

## 6. Recheck what is already open

The context lists every open finding from earlier AI reviews and every "Needs check", with a mark when its file changed or is gone. For **each one**: read today's code. Still true → leave it (do not record it again), and say so in the answer. No longer applies (fixed by hand, code rewritten, file deleted) → close it with `faundr security-resolve S-<n> --verified "<what you reread and why it no longer applies>"`. A "Needs check" you can now decide from the code or from the database tools → confirm it or drop it as the `S-n` paragraph at the top says. Do not leave stale findings open: an owner who sees three false ones stops reading the list.

The findings from the **automatic checks** in the files you read deserve one look too: a false alarm → say so in the answer and suggest ignoring it from the dashboard (never ignore on your own); several with one cause → say which.

## 7. For each suspicion, close it in one of three states

First write the **invariant**, one line each: (1) who attacks and what they already have (visitor, logged-in user, member of another team); (2) what they send or do; (3) the control that should block it and where it should be; (4) the path in the code, from entry to effect (file:line); (5) the smallest concrete effect (reads another user's order, becomes admin, runs a command); (6) the minimal fix at the last trusted point and the test that would prove it works. If you cannot write (1) and (5), it is not a security problem.

- **Confirmed**: you read the complete path and the control that should exist does not exist. It goes to the proof and the verifier (step 8).
- **Ruled out**: you found the specific control that prevents the problem. **Name the control** (e.g.: "the RLS policy `own rows` checks `auth.uid() = user_id`", "the handler calls `findToken` and compares `owner_id`"). Without naming the control, do not rule it out. When the suspicion matches a catalog item, the control must be the one its "Ruled out if" line asks for; any other reason ("the token travels in a header", "the CSP would block it", "it is an unusual setup") does not rule it out, and the suspicion goes to the verifier. Helpers follow the same rule: a helper's "ruled out" or "note" with a reason that is not the catalog's comes back to you as a suspicion.
- **Needs check**: the path is in the code, but the deciding fact is not (Supabase dashboard configuration, production environment variable, provider rule, proxy, deploy). **Missing information is never proof of safety, nor of a problem.** Record it with `--needs-check "<the exact missing fact>" --how-to-check "<where and how the owner checks it, without attacking anything>"`. It is not "confirmed with low confidence": it stays out of the count until someone checks.

**Counter-evidence before moving on**: argue against your own finding. Look for the control that would knock it down (global middleware, RLS doing the work, validation in a helper, the route is not exposed). These do not rule out a problem:
- "the library must handle that" without seeing where;
- the control existing in another similar route, but not in this one;
- the check only in the front end (hiding a button is not authorization);
- a control that fails open (error → lets it through);
- the variable "looking" internal when it comes from a parameter.

**What the actor can already do is not a finding.** Before calling it a leak or an escalation, compare with the power the actor already has: the read policy already lets them see it (compare the recipient of an email, notification or webhook with the real read check, not with the route's gate); the role already does it by design (an admin changing another member's email, suspending, demoting); another route already gives the same access (open the authorization inside the command, not only the gate on the route). An operator secret (a value in `.env`, the sample in `.env.example`) is configuration, not something the attacker holds. And check who really runs the path (a cron, a handler that exists) before blaming the actor.

**Defense in depth is not a problem**: if layer A already blocks the attack, the lack of layer B is a hardening note (tell the user at the end, and keep it for the chains pass), not an S-n. The same for "missing good practice" with nobody harmed. **The CSP is never layer A for an injection**: a user-controlled URL or HTML that reaches a dangerous sink (`href`, `src`, `<embed>`, `<iframe>`, `window.open`, `link.click()`, `innerHTML`, `dangerouslySetInnerHTML`) without a scheme allowlist or sanitizer in the code is the finding. The CSP can be turned off by configuration, does not cover every element, export or email, and has its own bypasses; at most it lowers the severity one level, when you read it and it blocks this exact element in every deployment.

**Variants, for every confirmed finding**: look for the same mistake in other routes and functions of the same kind (same code pattern, same helper, same table, the sibling verb, the bulk and export versions). The same cause in several places is **one** S-n with the places in the detail; independent causes are separate S-n.

**Calibrate the severity** by what an attacker can actually do (never above the effect you described):
- **critical**: read/change/delete any user's data without login, take over another account, execute code on the server or in CI with the keys, payment without paying;
- **high**: completely break an explicit control with real consequences, requiring being logged in (read another organization's data, become admin, XSS that hits other users); or abuse that generates high cost (AI route without a limit);
- **medium**: real violation with limited reach, unusual condition or only some resources affected (no rate limit on login, open CORS without credentials);
- **low**: non-secret internal detail, or great effort for minimal gain.

Lower one level when the precondition is already a privileged role (admin, owner of the integration), when it needs a random id the attacker cannot list, or when it only exists in a multi-tenant cloud deployment of a self-hosted product; never two levels for the same reason.

Question that separates high from medium: does the effect **break** the control on an action that matters, or only **weaken** it? If you cannot state the concrete harm, the severity is lower than it looks. Do not inflate: a missing header alone, self-XSS and an isolated open redirect are not critical.

## 8. Prove it, then have someone else try to knock it down

**Proof.** For each confirmed suspicion, write what would demonstrate it, without attacking anything: a test in the project's own test style (a function called as the wrong actor, a policy checked as another user, a parser fed the hostile input) or the exact request someone would send (method, path, body, which account), with the response the code would give. When the project's tests can run it, write the test in your scratchpad, run it and keep the output: a failing assertion is the strongest evidence there is. When it cannot be run (it needs the deployed app or the real database), say so and keep the written request. The proof goes in `--detail` (short) and in `--fix` ("the test that proves the fix").

**Independent verifier — for every confirmed suspicion, in every mode.** Whoever found it does not confirm it. Send them to a new subagent (Agent tool) that **has not seen your reasoning**:
- Critical and high: one verifier per suspicion. Medium and low: up to 5 independent suspicions per verifier. Never a suspicion together with your verdict.
- Send for each suspicion only: title, files and lines of the path, the invariant (points 1 to 5), the proof (the test or the request) and the proposed severity. **Do not send** why you think it is real.
- Instruction: "You did not write these suspicions. For each one, try to knock it down by reading the project's code (do not change any project file; do not call the app or any service). Reread each cited file and line; check whether the entry is really reachable by whoever has the least access and whether the final effect happens. Look for the strongest control on the path: login, data ownership, RLS, validation, middleware, framework, versioned configuration. You may run the project's type check and tests, and the proof you were given. Check whether the severity and the fix match only what the code shows. Answer for each one: `confirmed` (with the severity you would give, what you ran and saw, and one sentence on why), `ruled out` (naming the control and where it is) or `needs check` (with the exact fact that is not in the code)."

**No suspicion disappears on the way.** Before the final list, every suspicion in your notes and in the helpers' reports has one fate: verified (confirmed or knocked down), needs check, or ruled out with the named control. "Low, not verified" is not a fate: low ones go to the verifier in batches like the others, and if time runs out they go in the final list as needs check, never only in the text. Recalibrate the helpers' severities by the effect, not by how unlikely the setup looks: a condition (a provider that sends unverified email, a self-hosted option) lowers one level at most, so taking over another account through it is still high or medium, never low.

Follow the answer: ruled out is dropped (tell the user, with the named control, and keep it for the chains pass); needs check becomes `--needs-check`; confirmed with a different severity keeps the verifier's, unless you point out in the code why it was wrong. Nobody confirms their own findings in its place. Count how many went to the verifier and how many it knocked down: both numbers go into step 11.

## 9. Record

One command per problem (do not repeat what is already in the context's list of open ones):

`faundr security-finding "<short title: the problem>" --severity critical|high|medium|low --category <check id in the catalog> --file <path> --line <n> --confidence high|medium|low --cwe CWE-xxx --detail "<what it is, in plain language, the path in the code and the proof>" --impact "<what someone can do, concrete>" --fix "<the minimal fix and the test that proves it>"`

`--confidence high` only when the proof ran or the verifier reproduced the path; read-only findings are `medium`.

"Needs check": the same command, with `--severity` being the severity **if confirmed**, plus `--needs-check "<the missing fact>" --how-to-check "<how the owner checks it>"`.

Write `--detail`, `--impact`, `--fix`, `--needs-check` and `--how-to-check` in the project's content language (Faundr shows it in the context), for **people who don't code** to read on the dashboard. Never paste a whole key: mask it.

## 10. Coverage critic (full mode)

Before closing, send to a new subagent (Agent tool): your inventory of step 3, the threat model, the catalog topics read, what was reviewed and what was clean (with the control), and the lists of files each helper said it read. Instruction: "Read the project's code (do not change anything) and point out what this review left out: a way in that is not in the inventory, an inventory item without an answer, an invariant nobody tried to break as some actor, a sibling route or parallel path to the same effect that nobody looked at, a catalog topic that applies and was not read, an area marked as clean without the named control, deletion/access removal/export/cache not checked, a code file nobody read. List only gaps with a file, not findings."

In a large project, also give it the list of way-in files (step 3) that nobody read whole: each one is a gap until someone reads it.

Review yourself every gap it points out (steps 4 and 7, with proof and verifier for what you confirm). Repeat the critic once if the first round found more than a few gaps. What truly cannot be reviewed now goes into `--summary` as not covered, by name.

## 11. Record the coverage

Write to a temporary file the project-relative path of every code file that was **read whole** by you or a helper (one per line; only what was really read). Then, with the Bash tool:

`faundr security-review-done --areas "<each surface and pass that was done; separated by ;>" --clean "<what was checked and is ok, with the named control; separated by ;>" --summary "<what the review found, the threat model in two lines, and what was left out, by name>" --files-read <that file> --verified <how many suspicions went to the verifier> --ruled-out <how many it knocked down>` (add `--quick` in quick mode)

The command prints the code files nobody read. In full mode, read them now or name them in the answer; never say the whole project was reviewed if that list is not empty.

Write these texts in the project's content language (Faundr shows it in the context).

## 12. Answer

In plain language, in the user's language. Complete, not short: this is the report the owner decides from.
1. The threat model in a few lines: what is worth protecting here, who could try, and the invariants.
2. What was reviewed: how many ways in, how many files read whole of how many, which surfaces, how many helpers.
3. How many problems by severity (and how many "Needs check"), and **every** critical and high one: S-n, what someone can do, and how it was proved.
4. What was rechecked from earlier reviews: which still stand, which were closed, which "Needs check" got decided.
5. How many suspicions the verifier knocked down (and the control for each, in a few words).
6. Packages: which known flaws this code can actually reach.
7. What was clean (with the control), the hardening notes (defense in depth) and what could **not** be checked from the code alone.
8. What was not read, if anything.

Offer to fix with `/faundr:security-fix S-<n>` and, for the "Needs check" ones, to recheck with `/faundr:security S-<n>`. **Do not start fixing without the user asking.**
