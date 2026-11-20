---
name: track
description: Records in Faundr what is being built. Use ALWAYS when, in a project linked to Faundr (.faundr.json exists), you start a feature or multi-step task, finish a step, or the user makes a technical decision — that way the team follows progress in the dashboard and nobody gets lost between sessions.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Use the Faundr CLI through the Bash tool (`faundr ...`; if it is not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`). Always with quotes. Write titles, tasks and decisions in the project's content language (Faundr shows it in the context).

**When starting multi-step work** (new screen, integration, refactor, big improvement, "now let's go to phase 2"), **before building**:
1. If there is no suitable current feature (`faundr board`), create one: `faundr feature "<short title>" --desc "<goal>" --done-when "<criterion>; <criterion>"` (how to know it is done, in a way that can be checked).
   If the request is vague (it does not say who it is for, what stays out or how to know it is done), first ask 2 to 3 short questions in a single round, with the user question tool (concrete options, the recommended one first). If the request is clear, do not ask.
   If one with that goal already exists, switch to it: `faundr focus "<name>"`.
2. Record the plan as a checklist: one `faundr task "<step>"` per step (3 to 8 steps, starting with a verb). Never leave the feature you are working on without tasks: the board only shows the work through them, and with no tasks a feature is only done when every Done when is met.
   - **Following a project workflow** (`faundr workflow run`): do not repeat its steps with `faundr task`. Its steps become the feature's tasks by themselves when you create the feature during the run; for a feature that already exists: `faundr workflow link <W-n> --feature "<name>"`. Add `faundr task` only for what the workflow does not cover.
   - A step that only **checks the result** (testing in the browser, the owner trying it, a real purchase) is a review, not a build step: `faundr task "<step>" --review`. Reviews do not hold the feature. Wrong type afterwards: `faundr task-review "<task>"` (or `--off` to make it a build task again).
3. **Work in stages** (phase 0/1/2, MVP and then the rest, "now X, then Y", something you yourself proposed to split): the current feature is only the current stage. Record **right at the start** all the following stages you know of, in order, each one after the previous, with what goes into it:
   `faundr feature "<stage 2>" --after current --desc "<what goes in>"`, then `faundr feature "<stage 3>" --after "<stage 2>" --desc "…"`. If you already know a future stage's steps, add them with `faundr task "<step>" --feature "<stage>"`. They stay planned (they do not become the current one) and Faundr reminds about them: the stages that follow the current feature at the start of the conversation, at the end of the checklist and in the handoff note, and all planned stages in `/faundr:resume`.
   When a stage is finished, tell the user the next one by name and ask whether to continue; to start it: `faundr focus "<stage>"`. Never treat the feature as finished when it has recorded stages ahead.
4. **An idea or work for later** that is not a next stage of the current work: `faundr feature "<title>" --later --desc "<the idea>"`. It stays out of In progress and does not become the current feature. Never record an idea with a plain `faundr feature`: that puts it in In progress and makes it the current one.

**During the work:**
- When starting a step: `faundr start "<part of the name>"`.
- When finishing a step (code done and verified): `faundr done "<part of the name>"`.
- A new step came up: `faundr task "<step>"`.
- What you just did finishes an open task of **another** feature (something fixed in passing): mark it too, `faundr done <short id>` (the id works from any feature; `faundr board --all` shows them). Faundr points out the likely ones after a commit.
- Every Done when is met but build tasks are still open: mark the ones really done, remove the ones that no longer apply (`faundr task-remove "<task>"`) and tell the user what is left. Closing the whole feature by hand (`faundr feature-done "<name>"`) is the owner's call: only with their OK.

**Decisions:** when the user chooses a technical approach (library, provider, pattern, architecture), record it: `faundr decision "<affirmative decision>" --why "<why>"`.

Do not record trivial things (a one-line tweak, a question). No need to ask permission to record; mention in one line what you recorded.
