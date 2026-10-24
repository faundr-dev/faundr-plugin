---
description: Merges the work from the workbench (branch mesa/…) into the main project, with the user's OK — gets the newest version, merges, runs the tests, resolves conflicts explaining them in plain language and pushes. Use when the task done on a workbench is finished and the user says it can be merged, or when they ask to "merge", "send it to the main project" or "bring it to everyone".
argument-hint: [what was done on the workbench]
allowed-tools: Bash(git *) Bash(faundr *) Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

User request: $ARGUMENTS

The "workbench" is a `mesa/…` branch where the person works separately from whoever else is on the project. Always say "workbench" and "main project" (in the user's language); do not use "branch", "merge" or "rebase" with the user.

**Only merge with the user's OK.** If they have not said it is fine yet, ask: "Done. Can I merge your work into the main project? That way it reaches everyone on the team." and stop.

With the OK, use the Bash tool:

1. **Everything saved on the workbench.** `git status --short`. If there are changes, commit with a clear message of what was done.
2. **Who else is on the project.** `faundr team`. If someone is touching the same files, tell the user before continuing.
3. **Newest version of the main project.** `git fetch origin`, then `git merge origin/main` (or `origin/master`) inside the workbench. That way any conflict shows up on the workbench, not on the main project.
4. **Conflicts.** If git says there is a conflict:
   - open each conflicting file and understand both versions (yours and the one that came from the main project);
   - when both changes can be kept, combine both;
   - when both changed the same thing in different ways and it is not obvious which one wins, **ask the user**, showing the two options in plain language (what each one does, without jargon);
   - afterwards, explain in 1 to 3 lines what was merged and how.
5. **Tests.** Run whatever the project has (tests, type check, build). If something breaks because of the merge, fix it before continuing; if you cannot, stop and tell the user what broke. Never push something broken.
6. **Push.** `git switch main` (or `master`), `git pull --ff-only`, `git merge --no-ff mesa/<nome> -m "<what was done>"`, `git push`. If the push is rejected because something new arrived, go back to step 3.
7. **Clean up.** Ask whether the workbench can be deleted (`git branch -d mesa/<nome>`; if it is on GitHub, also `git push origin --delete mesa/<nome>`). If the person will keep working with other people on the project, offer to open a new workbench for the next task.
8. **Tell the user** in 2 to 3 lines: the work reached the main project, the tests passed, and what had to be combined with the others' work (if anything).

If the project has no remote (`git remote -v` empty), explain that, to combine the work of two people, the project needs to be on GitHub, and offer to help set it up (create the repository and push).
