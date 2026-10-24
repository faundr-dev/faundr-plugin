---
description: Code map. With nothing, generates or rebuilds the map and sends it to the dashboard. With a question ("how does login work?", "what breaks if I change AuthGate?", "how does the home page reach the database?"), answers from the map, citing file and line.
argument-hint: [question]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" map $ARGUMENTS`

- **No question (the map was generated):** say in one sentence how many nodes, links and communities it has and that it already shows up under "Code map" in the dashboard. From now on it updates on its own when files are edited.
- **With a question:** answer in plain language, for people who don't code, citing file and line (e.g. `src/cart.mjs:L7`). The code already came along above: open a file only if you need something outside the excerpt. Depending on the question, complement it with one more query, using the Bash tool:
  - "what breaks if I change X?": `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-callers "X" --depth 2`
  - "how does A reach B?" or "how does A connect to B?": `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-path "A" "B"`
  - everything connected to a piece: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-callers "X" --both`
  - where an exact text appears: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-grep "text"`
- **Path between two pieces** ("Caminho mais curto" came back): explain step by step what each piece does and why one needs the other. An `[EXTRACTED]` link was read in the code; `[INFERRED]` or `[AMBIGUOUS]` was deduced and may be wrong: check in the file before explaining and say whether it is real.
- **If there was an error**, show the message and suggest /faundr:status.
