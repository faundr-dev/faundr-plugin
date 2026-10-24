---
description: Links the current folder to a Faundr project (by id or name; with no argument, lists the projects).
argument-hint: [project id or name]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Result:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" link $ARGUMENTS`

- If the folder was linked, confirm to the user in one sentence and say that this session's events now start showing up in the dashboard.
- If a list of projects came back, ask the user which one to use (AskUserQuestion, one option per project) and then run with the Bash tool: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" link <chosen id>`.
- If there was an error (no token, invalid token), explain it and suggest `/faundr:login`.
