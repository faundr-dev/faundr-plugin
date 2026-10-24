---
description: Sets up Faundr in a project in one go — checks Node, git and login, links the folder to the dashboard project, generates for free (no AI) the code map, the Stack and the first checks, turns on the status line and the skills, shows how much of the plan each AI-powered item costs (Overview, reviews, design.md…) so the person chooses what to generate, offers economy mode for the end-of-response check, and asks before anything that touches project files or needs something from the owner (.gitignore, AGENTS.md, replacing the status line, Supabase token, errors from the published app). Use right after installing Faundr, when the user asks to set it up, or when something in Faundr is not working and nobody knows what.
argument-hint: '[--refresh]  (redoes the map and the checks)'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## Current state

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" setup --no-ask $ARGUMENTS`

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it is not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

The setup above already did on its own what is safe (marked "✓ … feito agora" or "enviado ao painel"). Now handle what is left, under "Needs your OK or an action from you:" ("Falta o seu OK ou uma ação sua" in Portuguese):

1. **Login** missing: run `/faundr:login` (opens the browser) and then run setup again. Stop here until login works.
2. **Project** not linked: ask which of the listed projects this one is (question tool, with the names as options) and run `faundr link "<name>"`; if none is, tell them to create it in the dashboard and run `/faundr:setup` again. Then run `faundr setup --no-ask` to do the rest.
3. **Items with `?`** (need an OK: git, .gitignore, replacing the status line, AGENTS.md): ask all of them in a single round, with the question tool (multiSelect), each with the why in one line and the recommendation:
   - **Git** and **.gitignore**: recommend applying.
   - **Replacing the status line**: recommend only if the current one is not something the person set up on purpose; ask.
   - **AGENTS.md**: recommend only if the team uses another agent (Codex, Cursor); otherwise, leave it out.
   Run `faundr setup --no-ask --apply <approved, comma-separated>` and, for the ones the person declined, `faundr setup --no-ask --skip <declined>` (so it does not ask again). Never apply what was not approved.
4. **Items with `!`** that need something from the owner:
   - **Skills without a type**: run the `faundr:skills` skill now (it classifies them and links to the dashboard the ones that find problems).
   - **Supabase token**: explain in two lines what it is for (backups and Security Advisor) and how to create it and set `SUPABASE_ACCESS_TOKEN` in the computer's variables. **Never ask for the token in the chat.** If the person does not want it, `faundr setup --no-ask --skip supabase-token`.
   - **Errors from the published app**: offer to run `/faundr:errors-setup`; if they do not want it now, `faundr setup --no-ask --skip errors`.
   - Old **Node**: tell them to install Node 20 or newer (https://nodejs.org) and open the terminal again.
5. **With AI (uses the person's plan).** The "Com IA" part lists what Claude writes (Overview, explained Stack, design.md, inventory, Showcase, full security and quality reviews, classifying skills), each with the estimated cost and where the estimate came from. **None of this runs without the person choosing.** Ask in a single round (question tool), with each option's cost copied from the context:
   - **Just the essentials** (Recommended: Overview and classifying the skills, the cheapest and most helpful at the start);
   - **Everything missing**;
   - **Choose one by one** (then a second question, multiSelect, with each item and its cost);
   - **Nothing for now** (can be generated later).
   Say in one line that the estimate improves on its own: Faundr measures what each skill actually spent. Then run the chosen skills, **one at a time and in this order**: `faundr:skills`, `faundr:overview`, `faundr:stack`, `faundr:inventory`, `faundr:design`, `faundr:design-showcase`, `faundr:security`, `faundr:quality --full`. Between one and the next, say in one line what finished. If the person says the plan is running out, stop and say what was left for later.
6. **Everyday spending.** Show the end-of-response line (how much it cost in the last 30 days) and ask whether they want **economy mode**: quick design audit, updating the Overview and updating the Stack only when asked. Proof, handoff note and security always stay on. With the OK: `faundr setup --no-ask --economy all` (or just some: `--economy stop.design,stop.overview`). To undo: `faundr setup --no-ask --no-economy`. The same switches are in the dashboard, under Workflows → Do Faundr → Fim da resposta.
7. **Items with `✗`** (failed): show the error line and, if it is obvious (no internet, wrong folder), say what to do; otherwise suggest running the command on its own to see the detail (e.g. `faundr graph`).

At the end, run `faundr setup --no-ask` one last time and answer in a few lines, in plain language: what is ready, what the person chose to leave out and what still depends on them. Say that `/faundr:setup` can be run again at any time (it does not change anything that is already right) and `/faundr:setup --refresh` to redo the map and the checks.
