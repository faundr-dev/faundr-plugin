---
description: Tidies the Features board in Faundr — checks each feature in progress and each next stage against the commits and the code, and proposes to the owner to mark as done the tasks already done (with the proof), discard what will no longer be done and keep the rest. Only changes what the owner approves. Use when the user says the board is old or messy, when Faundr warns about stalled features, or before updating the Overview.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git log *) Bash(git show *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --review`

The board above has everything that is open: **In progress** and **Next stages (planned)**, with the short id in brackets, when it was created and when it was last touched. "stalled" = not touched for more than 14 days (stalled).

## 1. Check each item with proof

For each feature (start with the stalled and the oldest ones), find out whether the work has already been done:

- `git log --oneline --since=<creation date> -i --grep "<word from the title>"`, and `git log --oneline -30` for recent commits. The project's commit messages usually say what went in.
- `faundr graph-query "<topic>"` to see whether the screen, command or table exists in the code. Prefer this to opening files.
- Features on the same topic (e.g. a planned stage that another feature already delivered) count as proof.

Classify each one:
- **Done**: there is a commit or code that delivers what it asks for. Say which (short hash or file).
- **Discard**: it was replaced by another path (e.g. a decision changed the plan), went stale (version already past) or duplicates another one.
- **Keep**: something is really still missing. Say in a few words what.
- **Don't know**: no proof either way. Do not guess: ask the owner.

Do not mark anything yet. Spend at most 3 searches per feature.

## 2. Show the proposal and wait for the OK

In plain language, a short table per group (Done, Discard, Keep, Don't know), with: name, what to do, and the proof in a few words. Remember that a feature only moves to Completed with **all** its tasks done: under "Done", say which open tasks will be marked. If a task is left over and will not be done (e.g. a test nobody will run), propose discarding the feature or keeping only that task, and let the owner choose.

Ask: **"Can I apply it? If you want to change any, tell me which."** Do not apply anything before the answer.

## 3. Apply only what was approved

- Task done: `faundr done "<task short id>" --already-committed` (the short id finds the task in any feature; the option avoids marking as "not committed" work that is already in git)
- Discard: `faundr feature-discard "<short id>"` (can be undone with `faundr feature-restore "<short id>"`, or with the Restore button in the dashboard)
- Keep: nothing.

At the end, run `faundr board --review` again and say in one sentence how many were completed, discarded and kept. If the Project overview exists, remind them that its "Where we are" already reflects the board live.
