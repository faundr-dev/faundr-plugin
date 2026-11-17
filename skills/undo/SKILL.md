---
description: Takes the project files back to a Faundr checkpoint — "go back to when it worked". Faundr saves one on its own before the first change of each session, every 30 min of edits and before dangerous commands. Use when the user asks to undo, go back, "leave it as it was" or when the agent broke something that worked.
argument-hint: [when or what to undo]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

Always point to a checkpoint by its **code** (the 10 letters and numbers in brackets in the list, or copied from the dashboard under Checkpoints), never by its position number: the numbers shift as soon as a new checkpoint is saved, so a number can land on a different checkpoint. If the request brings a code, skip to step 3 with it.

1. List the checkpoints with the Bash tool:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" checkpoints`
2. Show the user, in plain language, the 3 to 5 most recent: when it was saved, why and what changed since then. If the request already says which (e.g. "before touching the login"), suggest the matching checkpoint and say why.
3. See what going back undoes, without changing anything yet:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" restore <code>`
   Explain to the user, in plain language and without hiding anything: which files go back to how they were (and that the changes made to them after the checkpoint are lost), which are deleted because they were created afterwards and which come back because they had been deleted. Also say what does not change (.env, node_modules, files ignored by git, database, commits) and that the current state is saved first.
4. **You are the only confirmation.** Nothing else asks the user: this command is pre-approved, and Faundr does not show a prompt in the terminal. So ask in the chat whether you can go back and wait for a clear yes. Do not go back without it, even if the request seems clear.
5. With the OK, run exactly the line the preview printed at the end (it carries the commit code): `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" restore <code> --yes`
6. Say in one or two sentences what went back, and that the previous state was saved (to undo the going back, use the `restore <code> --yes` line the output printed, with the code of the saved state). If the output lists files it could not change (open in another program, OneDrive, antivirus, dev server), tell the user which ones, ask them to close what is using them and offer to run the same restore again. Remind them that .env, node_modules and the database do not change when going back.

If there is no git in the folder, explain that checkpoints need git and offer to run `git init` (with the user's OK).
