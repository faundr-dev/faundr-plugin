---
description: Records a concern in Faundr — something that needs to be reviewed later (it is not a decision or a task). It stays highlighted in the dashboard until someone marks it resolved.
argument-hint: '<what is worrying> [— details, what to review]'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

Separate a short, direct title (what is worrying) from the details (why it is worrying, what needs to be reviewed, when), without changing the meaning of what the user said, in the user's language. Run with the Bash tool, with quotes:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" concern "<title>" --why "<details>"`

Confirm in one sentence. Do not treat the concern as a decision or start resolving it now.
