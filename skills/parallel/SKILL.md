---
description: Builds several planned stages at the same time — takes the stages on the Features board that can start now (the previous one is done, none depends on another), opens a workbench for each (a separate copy of the project), sends one helper (subagent of this same session) to build each stage in its workbench, then merges them into the project one at a time with the tests, explaining what was combined. Only starts and only merges with the owner's OK. Use when the owner asks to do several stages at once, "in parallel", "at the same time", "speed up", or when faundr board shows two or more stages ready.
argument-hint: '[stages to do, separated by ;]'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git *) Bash(npm run *) Bash(npm test*) Bash(npx tsc *) Read Grep Glob Edit Write Agent
---

User request: $ARGUMENTS

Say "workbench" and "main project" to the user (in their language), never "worktree", "branch" or "merge". The helpers are subagents of **this** session: nothing here opens Claude Code by program.

## 1. What can go in parallel

Run `faundr parallel`. It lists the planned stages that can start now: the previous stage of each one is done, so none of them depends on another in the list.

- **Fewer than 2 stages:** say there is nothing to do in parallel and offer to build the one that exists in the normal way (`faundr focus "<stage>"`). Stop.
- **The user named stages** in the request: use only those, if they are on the list. A stage that is not on the list waits for another one: say which one.
- **Choose at most 4.** More than that, the merge gets hard and the plan runs out fast. Leave out a stage that obviously touches the same files as another one on the list (e.g. two changes to the same screen): it goes after.
- A stage with no tasks or with a vague description: before sending a helper, write its tasks with the user (`faundr task "<step>" --feature "<stage>"`) or use `/faundr:planning`. A helper with a vague goal builds the wrong thing.

## 2. Ask for the OK

Show a short plan and **wait for the user's OK** (use the ask-the-user tool):
- the stages, each with its tasks in one line;
- that each one is built in a separate copy of the project and then merged into the main project, one at a time, with the tests;
- that it uses more of the plan at the same time (one helper per stage).

## 3. Open the workbenches

The main project must be committed (the workbenches start from the last commit). If `git status --short` shows changes, ask whether you can commit them first.

`faundr parallel open "<stage 1>; <stage 2>"` — it prints each stage's folder and the branch.

## 4. Send the helpers, all in the same message

Call the Agent tool **once per stage, all in the same response** (so they run at the same time), with `subagent_type: general-purpose`. Prompt for each one (fill in, in the user's language for what is written in Faundr):

```
You are building one stage of a project, in a separate copy of the project.
Stage: <title>
Goal: <description>
Tasks:
- <task 1>
- <task 2>
Your folder (workbench): <full path printed by faundr parallel open>

Rules:
- Work ONLY inside your folder. Always use full paths that start with it; never edit files outside it. Other helpers are building other stages at the same time in other folders.
- Follow the project's CLAUDE.md/AGENTS.md and the existing code style. Read before changing.
- Check what you did: run the type check and the tests that exist, from inside your folder (`git -C <folder> ...`, `npm --prefix <folder> run ...` or `cd <folder> && ...`). If something cannot be run, say so.
- Commit on your branch when it works: `git -C <folder> add -A` and `git -C <folder> commit -m "<what was done>"`. Do not push, do not merge, do not switch branches.
- Do not record anything in Faundr (no faundr feature/task/done): the main session does that.
- Answer at the end, in up to 10 lines: what was done, which files changed, what was checked and how, what was left undone and any doubt.
```

## 5. Merge, one at a time

When all helpers have answered, for each workbench, in the order of the plan:

1. `git log --oneline HEAD..mesa/<name>`: if the helper committed nothing, tell the user and do not merge that one.
2. `git merge --no-ff mesa/<name> -m "<stage>: <what was done>"` in the main project.
3. **Conflict:** open each file and understand both sides. When both can be kept, combine them. When the two stages changed the same thing in different ways and it is not obvious which one is right, **ask the user**, showing the two options in plain language. Afterwards, explain in 1 to 3 lines what was combined.
4. **Tests after each merge** (type check, tests, build — whatever the project has). If something broke because of the merge, fix it before the next one. If you cannot, stop, `git merge --abort` (or undo the merge commit with the user's OK) and tell the user what broke.
5. Mark the stage's tasks that were really done: `faundr done "<task>" --feature "<stage>"`.
6. `faundr parallel close <name>`.

## 6. Answer

In a few lines, in the user's language: which stages went into the main project and what each one does now, what had to be combined, what the tests said and what was left undone (with the reason). Pushing (sending it to GitHub) is a separate step: ask whether you can push, or offer `/faundr:merge`.
