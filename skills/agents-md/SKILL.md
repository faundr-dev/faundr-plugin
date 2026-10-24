---
description: Writes the team's rules and decisions in a block of AGENTS.md (or CLAUDE.md), for Codex, Cursor and other agents that do not run Faundr. Off by default.
argument-hint: '[--file AGENTS.md | --file CLAUDE.md] [--off]'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

User request: $ARGUMENTS

Run with the Bash tool: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" agents-md $ARGUMENTS`

The default is AGENTS.md (read by Codex, Cursor and others). Claude Code already gets the memory through Faundr's hooks: writing to CLAUDE.md repeats the rules in the context, so only use `--file CLAUDE.md` if the user asks.

Say in one or two sentences what happened: which file, how many rules and decisions, that the block updates itself at the start of each session and that the rules are edited in the dashboard (the block is rewritten). Remind them that the file goes into git if it is not in .gitignore. To turn it off: `/faundr:agents-md --off`.
