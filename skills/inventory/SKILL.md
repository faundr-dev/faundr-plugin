---
description: Inventory of the features of a project that already existed before Faundr. Reads the code map, proposes the list of what the app already does and, with the owner's OK, records each one as done on the Features board. Use when the user asks, or when Faundr warns at the start of the session that the project has code and no recorded features and the user accepts.
argument-hint: [folder or part of the project]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

## 1. What is already recorded

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --all`

Do not repeat what is already above.

## 2. Find out what the app does (without reading the whole project)

- If `.faundr/mapa/graph.json` does not exist, generate the map: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" map`.
- Read the "Comunidades (navegação)" section of `.faundr/mapa/GRAPH_REPORT.md`: each community is a group of code that works together.
- Look at the screens and routes (folders like `routes`, `pages`, `app`, `screens`, `views`) and the API entry points. Use `faundr graph-skeleton <file>` to see a file without reading all of it and `faundr graph-query "<topic>"` to confirm what a part does.
- Project documents (README, CONTEXT.md, docs/) help name things, but only count what the code shows exists.

## 3. Propose the list to the user

- From 5 to 15 features, at the level the owner understands: what the person can do in the app ("Email login", "Driver sign-up", "Monthly report"), not technical names ("AuthProvider", "utils"). Write them in the project's content language (Faundr shows it in the context).
- For each one: short title, one sentence on what it does, 1 to 4 parts (what it has) and the files that prove it.
- Mark what looks half-done (screen not connected to the database, TODO, route without a screen) as "in progress", not as done.
- Show the list and ask with the question tool: record all, record with adjustments (they say which) or do not record.

## 4. Record what they approved

- Done: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<title>" --existing --desc "<what it does>" --parts "<part 1>; <part 2>"`
- In progress: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<title>" --desc "<what it already has and what is missing>"` and one `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task "<what is missing>"` per pending item. This makes it the current feature: at the end, if there was another current one before, switch back to it with `faundr focus "<name>"`.

At the end, say in one line how many were recorded and that they show up under Features in the dashboard.
