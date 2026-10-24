---
description: Takes the project files back to a Faundr restore point — "go back to when it worked". Faundr saves one on its own before the first change of each session, every 30 min of edits and before dangerous commands. Use when the user asks to undo, go back, "leave it as it was" or when the agent broke something that worked.
argument-hint: [when or what to undo]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

If the request brings a point's code (letters and numbers copied from the dashboard, under Protection → Restore points), skip to step 3 with that code in place of <n>.

1. List the restore points with the Bash tool:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" checkpoints`
2. Show the user, in plain language, the 3 to 5 most recent: when it was saved, why and what changed since then. If the request already says which (e.g. "before touching the login"), suggest the matching point and say why.
3. See what going back undoes, without changing anything yet:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" restore <n>`
   Explain to the user, in plain language and without hiding anything: which files go back to how they were (and that the changes made to them after the point are lost), which are deleted because they were created afterwards and which come back because they had been deleted. Also say what does not change (.env, node_modules, database, commits) and that the current state is saved. Then **ask whether you can go back** and wait for the answer. Do not go back without their OK, even if the request seems clear.
4. With the OK: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" restore <n> --yes`. Claude Code shows again what changes and asks for confirmation in the terminal; that is expected.
5. Say in one or two sentences what went back, and that the previous state was saved (to undo the going back: `restore 1 --yes`). Remind them that .env, node_modules and the database do not change when going back.

If there is no git in the folder, explain that the restore point needs git and offer to run `git init` (with the user's OK).
