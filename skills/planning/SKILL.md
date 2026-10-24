---
description: Plans a feature with the owner before building — sizes the request, looks at the project before asking, asks a few sharp questions (with options and a recommendation), settles a checkable "done when", shows a short summary for approval and saves everything to the Faundr dashboard. Use when the user asks for something new to build (a screen, a function, an integration), wants to think through or plan an idea, or when Faundr warns that the request looks like new work. At the start of a new project, writes the Project overview, the stages and, if the owner wants, the architecture. Also draws, if the owner wants, a diagram of how the feature will work (requests like "draw how this will work" or "draw the project architecture").
argument-hint: [what you want to build]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

The goal is to build the right thing with as few questions as possible. The person answering usually doesn't code: ask about **what the person sees and does**, never about technology. **Facts are yours, decisions are theirs**: whatever the project already answers, you find out; only ask what changes the result and only they can decide.

## 1. Size it

Say in one line what size it is and what you'll do. For a feature or several stages, end the line with the way out: "If you prefer, I'll just start."

- **Quick task** (tweak, text, one-off fix): don't ask or summarize. If it's part of the current feature, record it (`faundr task "<step>"`); if not, don't. Do it and say in one line what changed.
- **Already exists** (step 2 shows the project already does almost all of it): say where it is and what's missing, and ask only about what's missing. It often becomes a quick task or just wiring something up.
- **Feature** (something new the person uses): follow steps 2 to 7.
- **Several stages** (MVP and later, "first X, then Y", too big for one session): follow 2 to 7 only for the **first** stage; the following ones are recorded in one line each (step 7).
- **New project** (the owner describes a whole product, or the folder has no code and no features yet): read `${CLAUDE_PLUGIN_ROOT}/skills/planning/new-project.md` and follow the project-start script (Project overview, stages, decisions and, if they want, the architecture).
- **Continuation** of the current feature or an already planned stage (`faundr focus`): don't replan; only confirm what changed, if anything changed.

The user can change the size ("it's bigger than that", "just do it"). If they say not to ask, go straight to step 6 with what you can decide on your own.

## 2. Look before asking

Spend little, but don't ask what you can find out:

- `faundr board` — the current feature, the planned stages and the **open concerns (P-n)**, which often already tell you the owner's intent.
- `faundr graph-query "<subject of the request>"` — where similar code lives (screens, data, callers). Prefer this to opening files.
- The team's rules and decisions arrive in your context on their own; respect them and don't ask again what was already decided.
- At most 6 reads or searches in total, only those that can change a question.

Note the **facts with proof**, to use in the summary and in the options ("login already uses Supabase", "the orders screen already exists in `src/routes/pedidos.tsx`").

## 3. Find the few decisions that change the result

List for yourself (don't show the list) 3 to 6 points where different answers lead to different things **in this request**. No generic topics ("who is it for?") when the request already answers them.

- If the subject is common (login, payment, email notification, list and search, file upload, metrics dashboard, permissions, personal data, integration, scheduling, AI), read `${CLAUDE_PLUGIN_ROOT}/skills/planning/probes.md` and take only the 2 or 3 probes that matter here. Before using a probe, check whether the project already answers it: if there's already a way (e.g. notifications on Slack), the question becomes "keep what already exists?", with that as the recommended option.
- Include, when it makes a difference, the two failure questions (in round 1, if they don't depend on another answer):
  - **If it were only half, what stays?** (becomes the "out of this stage").
  - **What would make you say it went wrong, even if it works?** (becomes a done criterion or a limit).
- **Decide on your own**, without asking, whatever is technical or doesn't change what the person sees (library, table name, code structure, visual detail the design.md already defines). Keep each one for the "Decided on my own" list in the summary. Whatever changes what a customer or someone on the team already sees today (price, access, data that disappears) is **not** your decision: ask.

## 4. Ask in short rounds

Use the ask-the-user tool:

- **2 to 4 questions per round, at most 3 rounds.** First the ones that don't depend on another answer; those that do wait for the next round.
- Each question with **2 to 4 concrete options taken from the project**, the recommended one first with "(Recommended)" and the reason in one line in the description. Talk about the result: "Show the saved data right away or wait for the new data?", not "caching strategy".
- When possible, offer a "You decide" option for what they don't care about.
- **Vague answers don't pass:** "fast", "simple", "pretty" or "Other" with generic text get a follow-up question in the next round, with options that give a number or an example ("fast: opens in under 1 s? handles 1000 items?"). If they want to explain in their own words, ask in text, without options.
- **Stop** when the "done when" is checkable and no decision that changes the result is left. Don't use all 3 rounds just because you can.

## 5. Settle the "done when" and review as the builder would

- **Done when**: 2 to 4 pass/fail criteria, each saying what the person does and what they see ("the person pays with Pix and receives the confirmation email"; "the list of 1000 orders opens in under 1 s"). No "works well" or "looks nice".
- **Hidden review**: reread the plan as someone who will build it without being able to ask anything. For each doubt that comes up:
  - already answered → goes into the plan;
  - it's a detail → decide and put it under "Decided on my own";
  - only the owner knows → becomes one last question (counts as a round).
  On a big request (3 or more stages or many parts of the system), do this review with a subagent that receives only the step 6 summary, so it doesn't inherit what you already know.

## 6. Show the summary and wait for the OK

At most 15 lines, in this format (write it in the user's language):

```
**<Feature name>**
For: <who uses it> · Solves: <the problem, in one sentence>
Already exists: <what the project already does and will be reused, if any>
In: <what will be done, 2 to 4 items>
Out of this stage: <what is left for later>
Done when: <criterion 1>; <criterion 2>; …
Decided on my own: <choice 1>; <choice 2>  (say if you want to change anything)
Later: <next stages, if any>
```

Ask: **"Anything wrong or missing? Can I record it and start?"** Don't start building before the OK.

When the feature has a flow with 3 or more parts (screen, server, database, outside service) or an error path that matters, add one line: "If you want, I can also draw how it will work: it opens on a canvas in the browser for you to approve or ask for changes (uses more tokens than usual)." Don't offer it on a small task. If they correct something, adjust the summary and confirm only what changed.

## 7. Save to Faundr (without creating files)

No plan .md files: everything goes to the dashboard, which the agent rereads in the next sessions. Write it in the user's language.

1. The feature and the criterion:
   `faundr feature "<short title, up to ~8 words>" --desc "<who it's for and the problem, in one sentence>" --done-when "<criterion 1>; <criterion 2>"`
2. Each owner choice that changes what will be done, as a decision:
   `faundr decision "<the choice>" --why "<what they answered and why>" --global`
   What was left out becomes `"Out of this stage: …"`. Of the choices you made on your own, record only those someone would find odd later (`--why "Decided on my own: <reason>"`). Use `--file <path>` instead of `--global` only when the decision applies to a specific file or folder.
3. The steps, in order: `faundr task "<step>"` (3 to 8, each checkable).
4. The following stages, each after the previous one:
   `faundr feature "<stage 2>" --after current --desc "<what goes in>"`, then `faundr feature "<stage 3>" --after "<stage 2>" --desc "…"`.
5. Show the checklist with `faundr board` and say it's already on the dashboard (Features), with the done criterion.
6. If the owner asked for the diagram, read `${CLAUDE_PLUGIN_ROOT}/skills/planning/diagram.md` and follow it (write the JSON in one go, `faundr diagram-save`, at most 2 corrections). Do this before building: the drawing is part of the plan. The command opens the canvas and waits: **approved on the canvas = OK to build**; changes requested = adjust and save again.
7. Then start with the first step.

## Diagram only

If the request is only to draw how an already registered feature will work, warn that it uses more tokens, read its code and decisions (at most 6 reads), follow `diagram.md` with `--feature "<name>"` and don't redo the planning.

If it's to draw the architecture of a project that already exists, warn about the cost, use the code map (`faundr graph-query`) and the Project overview instead of opening many files, and follow `diagram.md` with the layers and the `--architecture` described in `new-project.md` (step 4.5). Parts that already exist go in with their real name and `paths`.
