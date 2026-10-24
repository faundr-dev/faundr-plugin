---
description: Adds a task to the current feature's checklist in Faundr.
argument-hint: '<task description>'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task $ARGUMENTS`

Confirm in one sentence. If there was no current feature, suggest creating one with /faundr:feature.
