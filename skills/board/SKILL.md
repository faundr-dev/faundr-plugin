---
description: Shows the project's features in Faundr and each one's checklist.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --all`

Summarize: which feature is in progress, how much has been done and what the next task is.
