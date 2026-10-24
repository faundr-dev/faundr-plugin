---
description: Records a team technical decision in Faundr (it reaches the agents when the work touches its topic).
argument-hint: '<decision> [because ...]'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

Separate the decision (short, affirmative, e.g. "Auth stays in Supabase") from the why, in the user's language, and run with the Bash tool, with quotes:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" decision "<decision>" --why "<why>"`

If the decision applies only to one part of the code (files, folders or patterns like `src/server/**`), add one `--file "<path>"` per path: it stops going in at the start of every session and reaches the agent before it edits those files.

Confirm in one sentence: the decision reaches this project's agents when it matters (at the start of the session while it is recent, when a request talks about the topic and before editing the files linked to it).

If the decision changes an earlier one (the user says "instead of", "now it is", "changed"), add `--replaces "<part of the old one's title>"`: the old one becomes obsolete. If the command warns that it "parece com" another one, tell the user which and ask whether the old one should be retired (`faundr memory-edit <id> --obsolete`).

Without `--file`, the decision links itself to the files this session edited (when they are few). If it applies to the whole project, add `--global`.
