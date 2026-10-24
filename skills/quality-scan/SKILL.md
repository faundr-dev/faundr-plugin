---
description: Runs Faundr's code quality check now (no AI, on the user's computer) — silently swallowed errors, weak types (any, @ts-ignore), overly complicated functions, commented-out code, unnecessary packages, skipped tests and broken AI instructions — and summarizes the result.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" quality-scan`

Summarize for the user in plain language, in a few lines:
1. What was checked (files, lines) and whether it is lean.
2. The high findings, each with its Q-n number (see with `faundr quality-show`) and one sentence on why it matters.
3. How many findings there are per type (hidden failure, weak type, too complicated, too much code, cleanup, tests, AI instructions), without listing them one by one.

End by suggesting the next step: `/faundr:quality-fix Q-<n>` for the most important one, and `/faundr:quality` for the AI review of what the automatic check cannot see. Do not start fixing unless the user asks.
