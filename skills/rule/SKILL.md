---
description: 'Records a team rule in Faundr. With files or patterns (e.g. src/server/**), the rule reaches the agent when it edits those files, instead of at the start of every session.'
argument-hint: '<rule> [because ...] [in <files or folders>]'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

Separate the rule (short and affirmative, e.g. "Every server route checks access to the project"), the why and, if the user mentioned files, folders or file types, the paths. Write the rule and the why in the user's language. Use paths from the project root: a file (`src/server/hook-events.ts`), a folder (`src/server`) or a pattern (`src/routes/**/*.ts`, `*.sql`). Run with the Bash tool, with quotes, one `--file` per path:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" rule "<rule>" --why "<why>" --file "<path>"`

Without paths, the rule applies to everything and goes in at the start of every session. If the rule clearly talks about a part of the code but the user did not say where, suggest the paths (use `faundr graph-query` if there is a graph) and ask in one sentence before recording.

Confirm in one sentence: with paths, say it reaches the agent before it edits those files (already in this session); without paths, that every agent gets the rule from the next session on.

If the rule forbids something that can be found by the code's text (a library, a function, a way of writing: "do not use axios", "no console.log in screens", "no Stripe key in the front end"), add `--forbid "<regular expression>"` (e.g. `--forbid "from ['\"]axios['\"]"`). That way Faundr warns before an edit that brings it in and the quality check points out where it already exists. Tell the user the pattern you used.

If the rule changes an earlier one, add `--replaces "<part of the old one's title>"`: the old one becomes obsolete. If the command warns that it "parece com" another one, tell the user which and ask whether the old one should be retired (`faundr memory-edit <id> --obsolete`).
