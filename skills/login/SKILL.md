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
1. Show the user the code and the link above and ask them to type the code on that page and click Authorize (the page never comes with the code filled in). Anyone who types this code approves this computer, so it is only for the user's own account.
2. In the same response, run `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" login --wait` with a timeout of 330000 ms (it waits up to 5 minutes for the approval).
3. Report the result in one sentence, then pass on what the output says about this folder (already linked, linked now, linked to a project this account cannot open, or not linked). Suggest `/faundr:link` only when the output says the folder is not linked or was linked to the wrong project. Never read or show the contents of `~/.faundr/`.
