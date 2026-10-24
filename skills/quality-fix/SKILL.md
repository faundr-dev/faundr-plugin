---
description: Fixes a quality problem recorded in Faundr (Q-n) without changing the app's behavior, and only marks it resolved when the check no longer finds the problem (or, for AI review findings, after rereading and checking). With no argument, fixes the open high ones, one at a time; with --all, fixes all the open ones, without stopping.
argument-hint: '"[Q-<n> | --all]"'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm run *) Bash(npx tsc *) Bash(npm uninstall *) Bash(git diff *) Bash(git status *) Bash(git ls-files *) Read Grep Glob Edit Write
---

## Problem to fix

Arguments: `$ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" quality-show $ARGUMENTS`

If an error, "fixed" or "No open quality problems" shows up, tell the user and stop. With no argument, the list above is the open ones: work only on the **high** ones, one at a time (run `faundr quality-show Q-<n>` to see each one). With `--all`, work on **all** of the list, in its order (high first), following "--all mode" at the end.

## Rules (identical behavior)

- **The app has to do exactly the same afterwards.** Same inputs, same outputs, same errors, same screen. Simplifying isn't changing what happens.
- Fix **at the cause**: before editing a shared function, find all its callers (Grep). A fix in the shared place is smaller than one in each caller and fixes the "siblings".
- Only what the problem describes. Don't refactor what wasn't pointed out or "take the chance to tidy up" the rest of the file.
- **Never cut**: validation of outside data, error handling that prevents data loss, security, accessibility, the only test of a piece of logic. "Fewer lines" isn't the goal: clever code nobody understands isn't better.
- Follow the project's patterns (CLAUDE.md, design.md, neighboring code): names, format, components that already exist.
- **Ask for the OK first** when the fix touches more than 2 files, deletes a file, removes a package or changes something someone else uses (exported function, route, table). Show the plan in 3-5 lines and wait.
- If the problem is in generated code, third-party code or a test, say so instead of changing it.
- **File outside git** (`git status` shows `??`) is the person's work in progress: don't touch it, say so.
- **Database change** (new index, function or table) requires a migration applied to the production database: don't do it without the OK; show the plan (a single migration for all the indexes, for example).
- Simplified on purpose and there's a known limit? Leave the shortcut marked: `// faundr: <the limit>, <when to improve>`. It shows up in Quality → Shortcuts, with owner and age.

## How to fix, by type

- **Swallowed error / one that only logs / replaced by empty**: handle it for real (show a notice, return the error to the caller, log it with context). If ignoring is on purpose (e.g. deleting a temporary file that may not exist), leave a comment inside the block saying why: that's the fix.
- **any / as any / @ts-ignore**: describe the shape with a type; outside data becomes `unknown` checked before use; use the types the library exports. `@ts-expect-error` only with the reason on the line.
- **Complicated / long / nested function**: split it into functions whose names say what they do; replace if ladders with early returns or a table; keep the order of effects (what's saved, called and shown).
- **Nested ternary**: if/else, switch or an object that maps the case to the value.
- **Commented-out code / unused code / unused export**: delete it (git keeps it). First, check with Grep that nothing uses it by name or by string.
- **Repeated snippet**: merge it into a single function or component, in a place both already import, and use it in both. **First, check that both files ship together**: same package and same build/deploy. Separately published folders (e.g. the app and a plugin, a browser extension, a monorepo package with its own `package.json`, bench scripts) and standalone scripts injected into a page (no `import`) can't import from each other: merging breaks whatever runs separately. In that case don't touch it; it's repetition on purpose: suggest `quality-ignore --reason on-purpose`.
- **Unnecessary package**: replace it with the cited native feature everywhere the package is used and only then `npm uninstall <package>` (with the user's OK).
- **AI review**: follow the "How to fix" (the concrete replacement) and the theme in `${CLAUDE_PLUGIN_ROOT}/skills/quality/catalog.md`.

## Verify and close

1. To undo an attempt, edit the file back; never `git checkout`, `git restore`, `git stash` or `git reset`, which also wipe the person's changes (and other problems already fixed).
2. Check that nothing changed in behavior: the project compiles (`npx tsc --noEmit` if it's TypeScript) and the tests pass, if there are any. Reread the diff (`git diff`) looking for unintended behavior changes.
3. Close:
   - Automatic check finding: `faundr quality-resolve Q-<n>`. It reruns the check and only closes if the problem is gone; if it says it still shows up, review. Rules that look at the whole project (repeated snippet, query inside a loop, unused code/file) don't close through `quality-resolve`, which checks a single file: they close on the full check, `faundr quality-scan`.
   - AI review finding: reread the fixed code and close with `faundr quality-resolve Q-<n> --verified "<what changed and how you checked the behavior is the same>"`.
4. False alarm: **don't** ignore it on your own. Explain to the user and suggest ignoring it from the dashboard (Quality section) or `faundr quality-ignore Q-<n> --reason false-alarm|on-purpose --note "<why>"`, if they agree.

## --all mode (all of them, without stopping)

The user asked to resolve everything at once: **don't stop to ask** between one problem and the next. Start right away.

- **One at a time, in list order**, with the rules and "Verify and close" above. For each problem closed, a single line: `Q-<n> fixed (<done>/<total>): <what changed>`.
- **What would need the OK first doesn't block the rest** (more than 2 files, deleting a file, removing a package, changing something someone else uses, a false alarm to ignore): don't do it; note it under "Waiting on you", with the plan in one line, and move on to the next.
- **Problems in the same file**: you can fix them in sequence and compile and test once for the group, but only close each one after compilation and tests pass.
- **Broke and won't come out in 2 attempts** (compilation, test, or `quality-resolve` says it still shows up): undo only that problem's change, note it under "Couldn't do" with the reason and move on.
- **Don't end the response while there's an open problem** that isn't under "Waiting on you" or "Couldn't do". If the conversation gets summarized midway, run `faundr quality-show --all` again: the fixed ones have left the list, and it's what remains.
- **At the end**, run `faundr quality-scan` (closes the whole-project ones and catches what the fix created, like a file that went over the limit by gaining functions) and `faundr quality-show --all` once more and fix whatever showed up again. Run the full tests one last time. Don't commit.

Final answer in --all mode: how many fixed, the "Waiting on you" and "Couldn't do" lists (Q-n and one line each) and how you checked the behavior stays the same.

## Answer

Answer in a few lines, in the user's language: what was wrong, what changed (files), how you checked the behavior stays the same and what was left out.
