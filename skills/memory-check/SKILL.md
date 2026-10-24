---
description: Checks whether the code still follows the rules and decisions recorded in Faundr (memory without contradiction) and tidies the memory (repeated or superseded decisions, decisions with no linked file, or ones that should be rules). Use when the user asks whether the project is following what was agreed, asks to tidy or review the memory, before launching, or after big changes.
argument-hint: [rule, decision or area to check]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

1. Read the confirmed rules and decisions: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --memory`. If the request mentions a rule or area, check only that one.
2. For each rule or decision that says something verifiable in the code (a library, a place, a way of doing things, something forbidden), look for whether the code contradicts it: use `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-query "<what the rule says>"` and `graph-grep "<pattern>"` before opening files. Rules about process (e.g. "always ask for an OK before publishing") cannot be checked in the code: skip them.
3. For each real contradiction (with file and line), record a concern: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" concern "Contradiction: <rule or decision> x <what the code does>" --why "<where (file:line) and what to do: adjust the code or change the rule>"` (write it in the user's language).
4. If a rule forbids something that can be found by text (e.g. importing axios, console.log on screen, Stripe key in the front end), offer to link it to a pattern, so Faundr warns on its own from then on: `faundr rule "<title>" --forbid "<regular expression>" [--file "<folder or pattern>"]`. Only with the user's OK.
5. **Tidy the memory** (the list from step 1 has each item's id in brackets). Put together a short proposal, in groups:
   - **Repeated or superseded**: two that say the same thing, or one that a newer one changed. Propose retiring the old one: `faundr memory-edit <id> --obsolete`.
   - **Link to files**: a decision without `[arquivos: …]` that only matters for one part of the code (a screen, the database, a command). Find the files with `graph-query` and propose: `faundr memory-edit <id> --file "<folder or pattern>"` (one `--file` per path; prefer folders and patterns to files everybody touches).
   - **Turn into a rule**: a decision that is an order that always applies, in any work (e.g. "auth stays in Supabase"). Propose: `faundr memory-edit <id> --rule`. Be sparing: a rule goes into every session.
   - **Example or empty rule** (e.g. "Memória inicial do projeto"): propose rewriting or retiring it.
   Show the proposal to the user in a list and ask in a single round (use the question tool, with "Apply all (Recommended)" as the first option). Only run the commands with the OK.
6. Answer in plain language: how many rules and decisions you checked, the contradictions (most serious first), the ones that cannot be checked in the code, what changed in the memory and what you suggest doing. Do not change code unless the user asks.
