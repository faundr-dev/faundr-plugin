---
description: AI code quality review in the project linked to Faundr — reads what changed (or the whole project, with --full) looking for what the automatic check can't see (too much code with the concrete replacement, hidden errors, types that don't protect, confusing names and functions, comments that lie, tests that don't protect, CLAUDE.md rules disobeyed) and records each real problem as Q-n on the dashboard, only with confidence 80 or higher. Use when the user asks for a quality review, "is the code good?", "is there too much code?", or when Faundr suggests it.
argument-hint: '[--full | --files a.ts,b.ts]  (no argument: what changed)'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git diff *) Bash(git log *) Read Grep Glob
---

## Context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" quality-context $ARGUMENTS`

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it's not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

You **only point things out**: don't change any file in this review. Fixing is `/faundr:quality-fix`, when the user asks.

## 1. Prepare

1. Read the whole **catalog** (path in the context): the confidence yardstick, what isn't a finding, what never to cut, the counter-evidence and the themes.
2. Read the listed **project rules** (CLAUDE.md, AGENTS.md, design.md). A rule written there outweighs personal taste.
3. **Session** mode (default): review only the listed files, and within them **only what changed** (`git diff HEAD -- <file>` shows the lines). A problem on a line nobody touched isn't charged now. If the list is empty, tell the user and offer `/faundr:quality --full`.
   **Project** mode (`--full`): inventory by theme, starting with the most complex files in the context. Don't try to read everything: sample with the Grep tool and with `faundr graph-query "<question>"` (if `.faundr/` exists), and say at the end what wasn't looked at.
4. Before saying something "already exists in the project" or "nobody uses it", **search** (Grep) and cite where.

## 2. Look, theme by theme

Follow the catalog's themes in order: `demais`, `falha`, `tipos`, `complexidade`, `comentarios`, `testes`, `instrucoes` (and `arquitetura` only in project mode). Don't repeat what's already in the context's "already recorded and open" list: if one of them is a false alarm, tell the user and suggest ignoring it from the dashboard.

## 3. For each suspicion

1. **Counter-evidence**: argue against your own finding, with the catalog's questions. If you can't point to the file:line of the proof, discard it.
2. **Confidence score** by the catalog's yardstick. Below 80: don't record it (you can mention it in the response as "maybe").
3. **Severity by the yardstick**: `high` = hides an error that will cost data or money, or leaves the code fragile at a central point (many callers); `medium` = gets in the way of understanding or changing, with a workaround; `low` = polish.
4. For too much code: one label (`apagar`, `stdlib`, `nativo`, `yagni`, `encurtar`), **always the concrete replacement** in `--fix` (name the function or feature, or show the short form) and the lines that would go in `--saves`, counted in the code. Never make up a number.

## 4. Record each real problem

One command per problem:

`faundr quality-finding "<short title: the problem>" --theme <theme> [--label <label>] --severity high|medium|low --confidence <80-100> --file <path> --line <n> --detail "<what it is and where, in plain language>" --impact "<why it matters for whoever uses or maintains it>" --fix "<the concrete replacement or the minimal change>" [--saves <n>]`

Write `--detail`, `--impact` and `--fix` for people who **don't code** to read on the dashboard, in the project's content language (Faundr shows it in the context), but with the exact name of the function, component or feature.

## 5. Record the coverage

`faundr quality-review-done --areas "<what you reviewed; separated by ;>" --clean "<what you checked and is fine; separated by ;>" --summary "<2 sentences>" --net "<-N lines, -M possible packages, or empty>" --scores "<theme>=<0-4>; …"` (add `--full` in project mode)

Score per reviewed theme (0 to 4): 4 = nothing to fix; 3 = polish only; 2 = visible problems with a workaround; 1 = gets in the way of changing the code safely; 0 = the theme is bad almost everywhere. Be honest: a theme you didn't look at stays out of the scores.

## 6. Answer

In plain language, in the user's language, a few lines:
1. What was reviewed and how many findings per theme, the biggest cut first.
2. The most important ones (Q-n and one sentence on why).
3. At the end: `−N lines, −M possible packages` (only what you counted), or **"Lean. Good to go."** if there's nothing.
4. What couldn't be looked at (in project mode).

Offer to fix with `/faundr:quality-fix Q-<n>`. **Don't go fixing without the user asking.**
