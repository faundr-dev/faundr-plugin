---
description: Runs Faundr's security check now (no AI, on the user's computer) — keys and passwords in the code, packages with known flaws and database access rules (Supabase) — and summarizes the result.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-scan`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-show`

Summarize for the user in plain language, in the user's language, in a few lines:
1. What was checked and whether everything is clean.
2. The serious problems (critical and high), each with its S-n number and one sentence on what can happen.
3. How many were set aside as noise (test file, dev-only package…), without listing them one by one.

End by suggesting the next step: `/faundr:security-fix S-<n>` for the most serious one (or `/faundr:security-fix` to fix all the serious ones). Don't start fixing without the user asking.
