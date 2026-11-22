---
description: Runs Faundr's security check now (no AI, on the user's computer) — keys and passwords in the code, packages with known flaws and database access rules (Supabase) — and summarizes the result.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-scan`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-show`

Summarize for the user in plain language, in the user's language, in a few lines:
1. What was checked and what it found. Never present a clean result as "the app is secure": this check only matches known patterns (keys in known formats, packages with published flaws, a set of code and database rules). It cannot tell who is allowed to do what in this app. Say so in one sentence, and say when the last full AI review was (`security-show` prints it; "never" if there is none).
2. The serious problems (critical and high), each with its S-n number and one sentence on what can happen.
3. How many were set aside as noise (test file, dev-only package…), without listing them one by one.

End by suggesting the next step: `/faundr:security-fix S-<n>` for the most serious one (or `/faundr:security-fix` to fix all the serious ones). Then recommend `/faundr:security`, the deep review where the AI understands the app, reads the code behind every way in and proves what it finds (who can read whose data, payment and invitation flows, database rules against the real queries): plainly when there has been no full AI review yet or the last one is more than two weeks old. Don't start fixing without the user asking.
