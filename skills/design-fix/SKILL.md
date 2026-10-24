---
description: Fixes design problems recorded in Faundr (D-n) following design.md and the quality floor and, after verifying, marks them resolved. With a number, fixes that one; with no number, fixes the open ones in order (what breaks usage first, polish last), stopping at the end of each stage; with --all, fixes all of them at once, without stopping.
argument-hint: '"[D-<n> … | --all]  (no argument: all open ones, stage by stage; --all: all of them, without stopping)"'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npx tsc *) Bash(npm run *) Bash(git diff *) Read Grep Glob Edit Write
---

## Problem to fix

Arguments: `$ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-show $ARGUMENTS`

If it says "ALREADY RESOLVED", "ARCHIVED" or an error, tell the user and stop (archived = the owner decided it does not apply to the project; to reopen: `faundr design-reopen D-<n>`).

If it says "NO NUMBER", the list above is already in fix order. Fix **one at a time**, in that order, repeating the steps of "How to fix" for each D-n (see each one's details with `faundr design-show D-<n>`).
- **Without `--all`**: show the user the stages and how many findings are in each, and confirm where to start (suggest stage 1). Stop at the end of each stage and say what was done before moving on.
- **With `--all`**: follow "--all mode" below.

## How to fix

1. Read the project's design.md, Faundr's quality floor (`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-context` shows the path) and the indicated file. design.md is the rule: the fix uses its colors, fonts and components, and reuses existing components instead of recreating styles.
2. Make the minimal fix that solves the described problem. If the problem is big (e.g. a whole screen off the standard), state the plan in 2–3 lines and confirm with the user before starting. Never change, without asking: URLs, navigation labels, names and order of form fields, logo, legal texts.
3. Verify: the project compiles and, if the dev server is up and the problem is visual or mobile, open the screen in the browser (Claude in Chrome), at the right width, and check that the problem is gone.
4. Only after verifying, mark it resolved with the Bash tool: `faundr design-resolve D-<n>`
   If, when looking at the code, the problem does not really exist (false alarm) or contradicts a decision recorded in the scope/design.md, do not "fix" it: archive it with the evidence (`faundr design-archive D-<n> --reason false-alarm|design-decision --note "<why>"`) and tell the user.
5. If the fix reveals another design problem, record it with `faundr design-finding "<title>" --kind ... --rule <theme/name> --file ... --detail "..."`.

## --all mode (all of them, without stopping)

The user asked to resolve everything at once: **do not stop to ask, not even at the end of stages**. Start right away, without confirming where to start.

- **One at a time, in list order**, with the steps of "How to fix". For each finding closed, a single line: `D-<n> resolved (<done>/<total>): <what changed>`.
- **What would need the user's OK does not block the rest**: a big problem (step 2 would ask for confirmation), a change to a URL, navigation, form, logo or legal text, or doubt about what design.md wants. Do not do it; note it under "Waiting on you", with the plan in one line, and move on to the next.
- **Findings in the same file**: you can fix them in sequence and compile once for the group, but only mark each one resolved after the compile passes.
- **Compile broke and is not fixed in 2 attempts**: undo only that finding's change, note it under "Couldn't fix" with the error, and move on.
- **Browser**: check mobile and visual findings on screen when the server is up; if it is not, check through the code and say so in the summary, without starting the server on your own.
- **Do not end the response while there is an open finding** that is not under "Waiting on you" or "Couldn't fix". If the conversation is summarized midway, run `faundr design-show` again: the resolved ones have left the list, and it is what remains.
- **At the end**, run `faundr design-show` once more: if the fixes opened new findings, fix them too. Do not commit.

Final response of --all mode: how many were resolved, how many archived (and why), and the "Waiting on you" and "Couldn't fix" lists, with the D-n and one line each.

## Response

In a few lines, in the user's language: what was wrong, what changed and how it was verified (per D-n).
