---
description: Draws a project workflow in Faundr — how the team wants Claude to work on a type of request ("whenever it is about design, do this and that"). Saves it as a draft for the owner to approve and edit on the dashboard canvas. Use when the user asks, or when you notice a way of working that repeats in the project (the same sequence of steps on similar requests) or that the user described as "I always do it this way".
argument-hint: [what the flow does or when to use it]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

A workflow is the script Claude follows when a request matches a topic. You only **create a draft**: approving, editing, turning off and deleting are up to the owner, in the dashboard (Workflows). Never say the workflow is already in effect.

1. **Check whether it already exists.** Run `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" workflow list`. If one of them already covers the topic, show which (W-n) and stop; changing a workflow is done in the dashboard.
2. **Ask only if it is vague.** If you cannot tell when it applies or what the steps are, ask a short question (with options). If you are proposing it because you noticed a pattern, show the steps in a list and ask whether you can save the draft.
3. **Build the steps** in the order you would follow them. Each step is a `--step`, with the type in front when it is not a plain instruction (write the step text in the project's content language, shown in the Faundr context; keep the type prefixes exactly as shown):
   - instruction: `"Search GitHub for similar repositories — 3 to 5, with an open license"`
   - Faundr skill: `"skill: /faundr:design — audit the screens touched"`
   - parallel agents: `"agentes 2: read the code — one per area, each returns what is worth copying"`
   - exact command: `"comando: git clone --depth 1 <url> ../referencias/<nome>"`
   - ask the owner before continuing: `"perguntar: which of the repositories to clone?"`
   - wait for something to happen: `"esperar: the tests to pass"`
   - steps that run at the same time: `"paralelo: skill: faundr:design | skill: faundr:browse | comando: npm test"`
   The detail goes after ` — `. For skills, use the name as it appears in `faundr skills list` (e.g. `faundr:design`, `tdd`): they become the skill block with the right origin on the canvas. The draft is born with a trigger and an end; decisions (yes/no) the owner draws on the canvas. Short, verifiable steps; 3 to 8 is usually enough.
4. **When to use and topics.** `--when` is a sentence Claude reads at the start of every session. Each `--topic` is a word or phrase that, appearing in the request, brings in the steps (e.g. `design`, `screen`, `copy feature`). Use `--file` with a folder or pattern (e.g. `src/components/**`) when the workflow applies to whoever edits that part.
5. Save:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" workflow draft "<short name>" --when "<when to use>" --topic "<topic>" --topic "<topic>" --step "<step>" --step "<step>"`

Confirm in one sentence: draft W-n was saved and takes effect when the owner approves it in the dashboard, under Workflows, where they can also change the steps and the connections on the canvas.

## Following a workflow

When an active workflow arrives in your context ("Este pedido bate com um workflow"), read the steps with `faundr workflow show <W-n>` and follow them in order. The team watches on the dashboard canvas, live, so mark the progress:

- When starting: `faundr workflow run <W-n> --why "<the request in one line>"` (step 1 goes in progress).
- When entering each step: `faundr workflow step <W-n> <number>` (the previous ones are marked done).
- "Ask the owner" step: `faundr workflow step <W-n> <number> --wait --note "<the question>"`, ask the question and wait. The canvas shows it is the owner's turn.
- Step that does not apply to the request: `faundr workflow step <W-n> <number> --skip --note "<why>"`. Never skip silently.
- At the end: `faundr workflow done <W-n> --note "<the result in one line>"`. If the owner says to stop: `faundr workflow stop <W-n>`.

Skill, command and agent steps mark themselves when you call the skill, the command finishes successfully or you open the agents; even so, mark the others (task, ask, wait, decision). One command per step is enough; do not mark steps you did not do.
