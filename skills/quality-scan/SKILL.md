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

Never present a clean result as "the code is good": this check only matches known patterns. Say so in one sentence, and say when the last AI review was (`faundr quality-show` prints it; "never" if there is none).

End with the next step: `/faundr:quality-fix Q-<n>` for the most important one, and `/faundr:quality` (or `/faundr:quality --full` for the whole project), the deep review where the AI reads and understands the code and finds what no pattern can: logic bugs, parts that no longer agree, hidden failures, weak tests. Recommend it plainly when there has been no AI review yet or the last one is more than two weeks old. Do not start fixing unless the user asks.
