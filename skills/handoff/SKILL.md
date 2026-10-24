---
description: Writes the session's handoff note in Faundr — what was left half-done, what is missing and things to watch out for whoever continues. It appears under Activity → Where I left off and at the start of the next session.
argument-hint: [what you want recorded]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

Write a note of 1 to 3 sentences, in plain language, in the user's language, with what was left half-done in this session, what is left to do and anything to watch out for whoever continues. Use what the user said above (if they said anything) and what happened in this conversation. Do not list files: Faundr already records that on its own. Run with the Bash tool, with quotes:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" handoff "<note>"`

Show the note to the user in one line.
