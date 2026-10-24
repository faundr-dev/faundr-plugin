---
description: Marks a Faundr concern as resolved by its identifier (P-1, P-2…). With no argument, lists the open concerns.
argument-hint: [P-<n>]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" resolve $ARGUMENTS`

- If a concern was resolved, confirm in one sentence (with the identifier).
- If the list of open concerns came back, ask the user which one to resolve (AskUserQuestion, one option per concern, with the identifier in the label) and run with the Bash tool: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" resolve P-<n>`.
- If there are none open, say so.
