---
description: Where we left off — fetches from Faundr what happened in the previous session (requests, commits, tasks, handoff note) and everything open in the project (tasks, concerns, design findings, security problems, errors in commands, outdated Overview). Use when the user asks "where did we leave off?", "what is left?" or wants to resume work.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" resume`

Answer in plain language, in the user's language, based only on what is above (do not make anything up):

1. **Where we left off**: in 2 to 4 sentences, what was done in the previous session, citing the last commit and the handoff note, if any.
2. **What is pending**: a short numbered list, starting with the handoff note and the open tasks, then the planned next stages (say which is the next one of each staged feature, by name); if there are stalled features, suggest checking the board with /faundr:tidy-board; then errors in commands (E-n, the ones that came back first), security problems, design findings and the outdated Overview.
3. **Watch out**: open concerns that affect the next step, one line each.

End by asking which pending item the user wants to start with, suggesting one (if a stage just finished, the natural suggestion is its next stage). Do not start working until they choose.
