---
description: Tidies the Features board in Faundr — checks each feature in progress and each next stage against the commits and the code, and proposes to the owner to mark as done the tasks already done (with the proof), discard what will no longer be done and keep the rest. Only changes what the owner approves. Use when the user says the board is old or messy, when Faundr warns about stalled features, or before updating the Overview.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git log *) Bash(git show *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --review`

The board above has everything that is open: **In progress** and **Not started** (planned stages and ideas for later), with the short id in brackets, when it was created and when it was last touched. "stalled" = not touched for more than 14 days (stalled). A feature with "(no tasks)" shows how many Done when criteria are met.

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

In plain language, a short table per group (Done, Discard, Keep, Don't know), with: name, what to do, and the proof in a few words. Remember that a feature moves to Completed when **all its build tasks** are done (open review tasks, marked `(review)` in `faundr board`, only leave the "review pending" badge and are not a reason to keep it open); with **no tasks**, when every Done when is met; or when it is **closed by hand**. Under "Done", say which open build tasks will be marked. If a task is left over and will not be done (e.g. a test nobody will run), propose removing that task, discarding the feature or keeping the task, and let the owner choose. If an open task is really a check (the owner trying it, a real purchase), propose making it a review instead. A feature in progress with no tasks: if a workflow was followed for it, propose linking the run (its steps become the tasks); otherwise propose recording what was done as tasks, or closing it by hand.

Ask: **"Can I apply it? If you want to change any, tell me which."** Do not apply anything before the answer.

## 3. Apply only what was approved

- Task done: `faundr done "<task short id>" --already-committed` (the short id finds the task in any feature; the option avoids marking as "not committed" work that is already in git)
- Discard: `faundr feature-discard "<short id>"` (can be undone with `faundr feature-restore "<short id>"`, or with the Restore button in the dashboard)
- Remove a leftover task that will not be done: `faundr task-remove "<task short id>"` (it leaves the checklist; if it was the last open one, the feature moves to Completed)
- A task that is a check, not a build step: `faundr task-review "<task short id>"` (it stops holding the feature)
- A workflow followed for a feature that has no tasks: `faundr workflow link <W-n> --feature "<short id>" --run <start of the run id>` (the steps go in as tasks, with what was done)
- The whole feature is done by the owner's word, with no proof per task: `faundr feature-done "<short id>"` (closed by hand; `--reopen` undoes it)
- Keep: nothing.

At the end, run `faundr board --review` again and say in one sentence how many were completed, discarded and kept. If the Project overview exists, remind them that its "Where we are" already reflects the board live.
