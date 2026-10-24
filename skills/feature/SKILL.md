---
description: Creates a feature in Faundr (with a task checklist and a done-when criterion) and makes it the current one for this folder. First, plans with the owner as in /faundr:planning and saves the choices as decisions.
argument-hint: '<title> [— description or steps]'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

1. **Plan before recording.** Read `${CLAUDE_PLUGIN_ROOT}/skills/planning/SKILL.md` and follow steps 1 to 6 (size, look at the project, a few pointed questions with a recommendation, a checkable done-when and the summary for the owner to approve). Skip it if the user asked not to be asked questions or if it is an already planned stage (faundr focus). After the OK, record as below.
2. Record the feature with the done-when criterion (the "Done when" items, separated by semicolons), in the project's content language (Faundr shows it in the context):
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<short title, up to ~8 words>" --desc "<description>" --done-when "<criterion 1>; <criterion 2>"`
3. Save each choice that changes what will be built as a decision (it stays linked to the feature and comes back to the agent in the next conversations):
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" decision "<the choice, e.g. Payment only via Pix in this stage>" --why "<what the user answered and why>" --global`
   What was left out becomes a decision too ("Out of this stage: …"). Do not record mere details as decisions.
4. If the request lists steps, add each one as a task: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task "<step>"`.
5. If the request is bigger than one stage (phases, "first X, then Y", MVP and then the rest), the feature created is only the first stage: record the following ones, in order, each one after the previous:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<stage 2>" --after current --desc "<what goes in>"`, then `feature "<stage 3>" --after "<stage 2>" …`. They stay planned and do not become the current one.
6. Show the final checklist with `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board` and say it already appears in the dashboard (Features), with the done-when criterion and the next stages. At the end of the stage, Faundr asks to check the criterion before marking it done.
