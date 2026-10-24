---
description: Connects Claude Code to your Faundr account through the browser (the token is created on the computer and does not go through the chat).
argument-hint: [--url https://...]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Faundr login start:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" login --start $ARGUMENTS`

If there was an error above, explain it in one sentence and stop. If the user pasted a token in the arguments, tell them it is no longer needed (login is now through the browser) and that it is better to delete that token under Plugin token in the dashboard.

If it worked:
1. Show the user the code and the link above and ask them to check that the code in the browser is the same and click Authorize.
2. In the same response, run `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" login --wait` with a timeout of 330000 ms (it waits up to 5 minutes for the approval).
3. Report the result in one sentence. If it worked, suggest `/faundr:link` to link this folder to a project. Never read or show the contents of `~/.faundr/`.
