---
description: Turns on the Faundr status line in Claude Code (current project, feature and step, code map up to date, open concerns).
argument-hint: [--force]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" statusline-install $ARGUMENTS`

Tell the user, in one or two sentences, the result above. If there was already another status line, explain that it was not replaced and that `/faundr:statusline --force` replaces it with Faundr's (the previous one is in the text above, if they want to go back). The status line only reads files on the computer: it does not spend tokens or use the network.
