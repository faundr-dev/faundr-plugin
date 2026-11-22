---
description: Deep AI code quality review in the project linked to Faundr — reads and understands the code (what changed in the session and everything it can break, or every file of the project with --full) looking for what no fixed rule can see (logic bugs, broken contracts between parts, hidden errors, reads cut silently, races, missing timeouts and ceilings, code that breaks on another OS, types that don't protect, too much code with the concrete replacement, confusing names and functions, comments that lie, tests that don't protect, CLAUDE.md rules disobeyed), sends each suspicion through an independent verifier that tries to knock it down, rechecks the findings already open, and records each real problem as Q-n on the dashboard. Use when the user asks for a quality review, "is the code good?", "is there too much code?", before publishing, or when Faundr suggests it.
argument-hint: '[--full | --files a.ts,b.ts]  (no argument: what the session changed and what it can break)'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(npx tsc *) Bash(npm test *) Bash(npm run test *) Bash(node --test *) Read Grep Glob Agent
---

## Context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" quality-context $ARGUMENTS`

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it's not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

You **only point things out**: don't change any project file in this review. Fixing is `/faundr:quality-fix`, when the user asks.

**This is the deepest check Faundr has, and it is meant to be thorough.** The automatic check only matches known patterns; this review exists to find what takes reading and understanding. Don't shorten it to save tokens: read whole files, follow the callers, use helpers in parallel, verify each finding. A shallow review that says "Lean" is worse than no review, because the owner trusts it.

## 1. Prepare

1. Read the whole **catalog** (path in the context): the confidence yardstick, what isn't a finding, what never to cut, the counter-evidence and the themes.
2. Read the listed **project rules** (CLAUDE.md, AGENTS.md, design.md). A rule written there outweighs personal taste.
3. Read what the feature was **supposed to do**, when Faundr has it: `faundr board` shows the current feature and its "done when" criteria. Code that works but doesn't do what was agreed is a `logica` finding.
4. Before saying something "already exists in the project" or "nobody uses it", **search** (Grep) and cite where.

## 2. What to read

**Session** mode (default): the files the context lists (changed since the session started, committed or not, plus the deleted ones) **and what they can break**:
- Read each changed file **whole**, not only the changed lines. The diff (`git diff <base> -- <file>`, base in the context) tells you where to start, not where to stop.
- For each function, type, route, table or exported name that changed: find who uses it (`faundr graph-callers "<name>" --depth 2` if `.faundr/` exists, otherwise Grep) and read those callers. A changed signature, return shape, error or default with a caller that still assumes the old one is a `contratos` finding.
- Read the tests of what changed. Changed logic whose tests still pass without touching the new branch is a `testes` finding.
- A problem you find in a file you read counts, even on a line nobody touched: it is real and the owner wants to know. Say in the detail whether the session introduced it or it was already there.
- If the list is empty, tell the user and offer `/faundr:quality --full`.

**Project** mode (`--full`): **every code file the context lists gets read by someone.** Don't sample.
- Split the file list into modules (by folder, or by the communities of `.faundr/mapa/GRAPH_REPORT.md` when it exists), each small enough for one helper to read whole (about 3,000 lines of code; split a bigger folder).
- Launch one subagent per module with the Agent tool, **several in the same response** so they run at the same time (in waves of up to 6 until every module is covered). Give each one: the project folder, its list of files, the path of the catalog, the project rules files, and this instruction: "Read the catalog first. Then read every file of your list whole. Review them by all the catalog's themes, in order, asking for each piece of code what happens on the bad day. For each exported name you find suspicious, read its callers (`faundr graph-callers` or Grep), even outside your list. Do not record anything in Faundr and do not change any file. Answer with a list of suspicions, each with: theme, file:line, the concrete scenario (input or state → what goes wrong), the proof (file:line), the proposed severity and the concrete fix; then the list of files you actually read whole, and the ones you could not."
- While they work, do the **cross-module pass** yourself (section 3).
- A file no helper reported as read goes into "what wasn't looked at" at the end. Never say the whole project was reviewed if it wasn't.

No Agent tool in this session? Do the same passes yourself, module by module, and say so in the answer.

## 3. Look, in passes

**Pass 1, inside each file** — follow the catalog's themes in order: `logica`, `falha`, `desempenho`, `contratos`, `tipos`, `demais`, `complexidade`, `comentarios`, `testes`, `instrucoes`, `arquitetura`.

In `logica`, `falha` and `desempenho`, read each piece of code twice. First on the **normal day**: does it do what its name, its comment and the feature say? Walk one real input through it, line by line. Then on the **bad day**: the table has 5,000 rows; the network or the database fails halfway; two processes run this at once; it runs on Windows, in a folder with a space or an accent, on the oldest supported runtime; the input is hostile, empty or huge; the user switches screens before it finishes. A finding needs the concrete scenario ("with more than 1000 findings, …"), not "it could fail".

**Pass 2, between files** (project mode: you do it while the helpers read; session mode: for everything the session changed):
- Each API route or server function against whoever calls it: same fields, same error shapes, same status codes.
- Each table against who writes and who reads it: a column written in one shape and read in another, a status written by one place and never handled by another, a migration the queries don't match.
- Each state (`status`, flags, timestamps): list who moves it to each value. A state nobody can leave, a state closed without proof, two writers that disagree.
- The same thing done two ways (two API clients, two date helpers, the same rule written in the server and in the CLI that can drift apart).

**Pass 3, the findings already open** — the context lists the open findings from earlier AI reviews (rule `ia/…`). For each one whose file you read: is it still true in today's code? Still true: leave it (don't record it again). Gone (fixed by hand, code rewritten, file deleted): close it with `faundr quality-resolve Q-<n> --verified "<what you reread and why it no longer applies>"`. Don't leave stale findings open: an owner who sees three false ones stops reading the list.

The context also lists the findings **to confirm** from earlier reviews, each with the fact that was missing. Try to settle each one now (read further, run the tests, send it to the verifier): confirmed → record it again with the same title, no `--needs-check` and confidence 80 or more (it becomes a normal open finding); knocked down → close it with `faundr quality-resolve Q-<n> --verified "<what rules it out and where>"`; still not settled → leave it.

The findings from the **automatic check** in the files you read deserve one look too: if one is a false alarm, say so in the answer and suggest ignoring it from the dashboard (never ignore on your own); if several share one cause, say which.

**Repeat**: when a pass turns up a finding, look for the same mistake elsewhere (same helper, same pattern, same table). The same cause in several places is **one** Q-n with the places in the detail.

## 4. For each suspicion (yours and the helpers')

1. **Counter-evidence**: argue against the finding, with the catalog's questions. If you can't point to the file:line of the proof, it is not confirmed yet.
2. **Run it when running settles it.** You may run the project's type check and tests (`npx tsc --noEmit`, `npm test`, `node --test <file>`) to confirm that a type really is unprotected, that a test really passes with the logic broken in your head, that a case really has no test. Don't write files in the project to do it.
3. **Independent verifier.** Whoever found it does not confirm it. Send the suspicions that survived to a new subagent (Agent tool) that **has not seen your reasoning** — in project mode all of them, in session mode the `high` and `medium` ones. Up to 5 independent suspicions per verifier. Send for each one only: title, theme, file:line, the scenario and the proposed severity. Instruction: "You did not write these suspicions. For each one, try to knock it down by reading the project's code (do not change any file). Reread each cited file and line and the callers; look for what would make the scenario impossible (a check further up, a constraint in the database, a caller that never passes that input, a test that covers it). You may run the type check and the tests. Answer for each one: `confirmed` (with the severity you would give, a confidence from 0 to 100 by what you verified, and the proof file:line), `ruled out` (naming what prevents it and where) or `not settled` (with the exact fact that is missing)."
4. Follow the answer: **ruled out** is dropped (mention it in the answer, with what prevents it); **confirmed** is recorded with the verifier's severity and confidence; **not settled** is recorded as "to confirm": the same command with `--needs-check "<the exact fact that is missing, and where someone could check it>"` and the verifier's confidence (50 or more). It stays out of the open count and shows on the dashboard under "To confirm". Below 50 with nothing concrete missing, it is not a finding: drop it.
5. **Severity by the yardstick**: `high` = wrong result on the normal path, hides an error that will cost data or money, loses data silently (cut read, half-written file, consumed message), breaks for a whole group of users (Windows, big accounts, old runtime), can freeze or take down a hot path, or leaves the code fragile at a central point (many callers); `medium` = gets in the way of understanding or changing, with a workaround; `low` = polish.
6. For too much code: one label (`apagar`, `stdlib`, `nativo`, `yagni`, `encurtar`), **always the concrete replacement** in `--fix` (name the function or feature, or show the short form) and the lines that would go in `--saves`, counted in the code. Never make up a number.

## 5. Record each real problem

One command per problem:

`faundr quality-finding "<short title: the problem>" --theme <theme> [--label <label>] --severity high|medium|low --confidence <80-100> --file <path> --line <n> --detail "<what it is and where, in plain language, with the concrete scenario>" --impact "<why it matters for whoever uses or maintains it>" --fix "<the concrete replacement or the minimal change>" [--saves <n>] [--needs-check "<missing fact>" (then --confidence 50-100)]`

Write `--detail`, `--impact` and `--fix` for people who **don't code** to read on the dashboard, in the project's content language (Faundr shows it in the context), but with the exact name of the function, component or feature. Put the proof (file:line the verifier confirmed) at the end of `--detail`.

## 6. Record the coverage

`faundr quality-review-done --areas "<what was read whole; separated by ;>" --clean "<what was checked and is fine; separated by ;>" --summary "<2 sentences>" --net "<-N lines, -M possible packages, or empty>" --scores "<theme>=<0-4>; …"` (add `--full` in project mode)

Score per reviewed theme (0 to 4): 4 = nothing to fix; 3 = polish only; 2 = visible problems with a workaround; 1 = gets in the way of changing the code safely; 0 = the theme is bad almost everywhere. Be honest: a theme you didn't look at stays out of the scores, and `--areas` only names what was actually read.

## 7. Answer

In plain language, in the user's language. Complete, not short: this is the report the owner decides from.
1. What was read (how many files, which modules, how many helpers) and how many findings per theme.
2. Every `high` finding (Q-n, one sentence on what goes wrong and when) and the most important of the rest.
3. What was rechecked from earlier reviews: how many still stand, which were closed.
4. "To confirm": the suspicions the verifier could not settle (Q-n recorded with `--needs-check`), each with the missing fact, and which older ones you settled this time.
5. What the verifier ruled out, in one line each (so the owner sees the review argued with itself).
6. `−N lines, −M possible packages` (only what you counted), or **"Lean. Good to go."** only if every pass ran and nothing was found.
7. What wasn't looked at, if anything.

Offer to fix with `/faundr:quality-fix Q-<n>`. **Don't go fixing without the user asking.**
