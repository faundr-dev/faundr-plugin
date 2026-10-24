---
description: Connects to Faundr the skills the person already uses in this project (the repository's, the personal ones and those from enabled plugins) — Faundr stores what each one does and when to use it, shows them in the dashboard and in the workflows palette, and reminds Claude to call one when the request is about its topic. It also marks the ones that find security, test, quality or error problems: what they find and fix starts showing up in the Faundr dashboard. Use when the user asks, after installing new skills or plugins, or when Faundr warns that there are skills without a "when to use".
argument-hint: [name of a skill, to adjust only that one]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

Faundr stores only the **name, the description, the origin** (project, personal or plugin) and whether the skill is manual. The skills' content never leaves the computer; do not copy excerpts of them into Faundr.

1. **Read the skills:** `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" skills scan`. The response says how many it found per origin, the new ones and the ones without a "when to use".
2. **Write the "when to use" and the topics** for each skill without a "when to use" (or only for the one the user mentioned). See the description with `faundr skills list` and save:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" skills when "<name>" --when "<when to use>" --topic "<topic>" --topic "<topic>"`
   - **When to use:** one sentence in plain language, in the user's language, from the request's point of view ("request to write or improve page copy"), up to 300 characters.
   - **Topics:** 2 to 5 short words or phrases that, appearing in the request, should remind Claude of this skill (e.g. `headline`, `home page copy`, `copy`). Prefer words that only appear in that kind of request; avoid generic ones ("code", "project", "file"), which would bring the reminder all the time.
   - Faundr's internal skills (`faundr:*`) already have their own moment of use: save only the "when to use", without topics.
   - With many skills (more than 15 without a "when to use"), do the project ones first, then the personal ones and last the plugin ones, and say how many are left.
3. **Mark the type** of each skill in the "Sem tipo" list (Faundr's own do not count: they already report on their own). Ask, from the description: is its job to **find problems** in one of these areas?
   - `seguranca`: vulnerabilities, security audit or review, pentest, secrets, permissions;
   - `testes`: writing, running or evaluating tests, coverage, TDD;
   - `qualidade`: code review, repeated or complicated code, patterns, problem-driven refactoring;
   - `erros`: investigating a bug, error, failure, slowness, app logs;
   - `nenhum`: writes content, creates things, configures, plans (even if it talks about code).
   Save: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" skills when "<name>" --kind <type>` (it can be combined with `--when` and `--topic` in the same command). When in doubt between two, choose the area of what it most **finds**; if it does not find problems, it is `nenhum`.
   From then on, every time a connected skill runs, Faundr asks at the end of the response to record what it found and fixed (`faundr skill-report`): the problems go into Security, Quality, Tests or Errors with "via /name".
4. **Confirm** in a few lines: how many skills were connected per origin, which ones got topics, **which ones became connected skills and in which section their results will appear**, and that they already show up in the dashboard (Workflows → Skills, where the type can be changed) and in the canvas palette. Say that the one that should not be suggested can be turned off in the dashboard.

A skill marked as manual (only the person calls it) shows up with the reminder to ask the person to run `/<name>`; Claude cannot call it on its own.
