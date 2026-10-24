---
description: Shows the Faundr connection in this folder (token, linked project, branch).
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" status`

Summarize the status above for the user in a few lines, saying what is left to configure, if anything.
