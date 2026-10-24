---
description: Marks a task in the Faundr checklist as done (by part of its name or its number).
argument-hint: '<part of the name or no.>'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" done $ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board`

Confirm which task was done and what is still left, in a few lines.
