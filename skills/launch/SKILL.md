---
description: '"Ready to launch?" — builds the code, runs the tests and the security check, tests the database as a visitor (reads, writes, updates and deletes with the public key and as another logged-in person, undoing everything) and checks what is missing before opening the app to the public (site headers, request rate limit, payment webhook, privacy policy, backup, recovery plan), ending with a single "Can launch: YES/NO". Use when the user asks whether they can launch, publish, promote or open to users, or whether the database/app is secure.'
argument-hint: [--url https://live-site]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

User request: $ARGUMENTS

1. **Database as a visitor.** Run with the Bash tool:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" db-test`
   - If the output says writing/updating/deleting were not tested and you have the Supabase MCP (`execute_sql` tool), offer the full test. Say in one sentence that it runs on the real database, but each attempt is undone right away (nothing stays written or deleted), and **ask for the user's OK**. With the OK:
     1. get the SQL with `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" db-test --sql`;
     2. run it **without changing anything** with `execute_sql` on the Supabase project whose ref appears in "Database tested" (check with `list_projects`);
     3. save the whole response, as it came, to `.faundr/verificacoes/db-test-result.json` (Write tool);
     4. run `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" db-test --result .faundr/verificacoes/db-test-result.json`.
   - Without MCP: say the full test needs the personal Supabase token in SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens) and continue with the read test.
   - If the project does not use Supabase, skip this step and say so.
2. **Code and the rest of the checklist.** Run `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" launch-check` (with `--url <site>` if the user gave an address or if the output says it does not know the live site's URL). It builds the code (type check and build), runs the tests and the security check, then the launch items, and ends with **CAN LAUNCH: YES/NO**. It can take a few minutes; do not cut the output. If the tests did not run because they seem to use the production database, ask the user before running `faundr tests-run --confirm-db`, then run `launch-check` again.
3. **Answer in plain language**, in this order:
   - **First line: the verdict**, exactly as the command gave it, in the user's language ("Can launch: NO — 2 items block it" / "Can launch: YES"). Never say YES when the command said NO.
   - **Blocks the launch:** code that does not build (the error line), keys or passwords in the code, critical security problems, each open door in the database (which table, what a visitor can do) and payment webhook without a signature. If there are none, say so.
   - **Before real users:** failing tests, high security problems, headers, request rate limit, privacy policy, backup and recovery plan. Backup is two things: **existing** (the "Automatic database backup" item reads the Supabase backup list with `SUPABASE_ACCESS_TOKEN`; without the token, say where to look: Database → Backups) and **working** (Faundr does not test restoring on its own: it means restoring into a test project and opening the app; on the Supabase free plan there is no automatic backup, so `supabase db dump`; then just mark "Backup testado" in the dashboard).
   - **Recovery plan:** if the item says it is missing (or that the plan does not cover some topic), offer to write the draft (step 5).
   - One line saying the full checklist (with security, errors, tests and Stack) is in the dashboard under **Launch → Ready to launch?**.
4. **Offer to fix**, starting with what blocks the launch — **do not fix on your own, ask first**: build errors in the code, failing tests with `/faundr:tests-fix`, keys with `/faundr:security-fix S-<n>` (rotate the key in the service too), database doors with `/faundr:security-fix S-<n>` (the problems are in Security), headers and request rate limit in the server code, and a privacy policy page (what the app collects, for what, who it shares with and how to ask for deletion, as required by the LGPD). Do not change anything without the user's OK. After fixing, run step 1 or 2 again to check.
5. **Recovery plan draft** (only with the user's OK). Write `docs/plano-de-recuperacao.md` in plain language, in the user's language, with what the project really has (read `.env.example` or the variable names, the Faundr Stack and where the app is published). **Never write key or password values**, only the names and where to rotate them. Sections:
   - **Who to call and where the accesses are:** who has access to each service (Supabase, hosting, domain, payment, email) and where the passwords are kept (e.g. password manager), without the passwords.
   - **Leaked key:** for each secret variable, the service and the link where it is rotated; rotate first, then update it in the hosting and publish; look at the service's usage over the last few days.
   - **Database lost or broken:** where the backups are, how to restore (provider's step by step), when the last restore test was and how much data is lost in the worst case.
   - **Account taken over:** how to kill the person's sessions (Supabase: Authentication → Users → sign out of all sessions), change the password, check what was done (action log, if any) and notify them.
   - **Site down or broken deploy:** how to go back to the previous version in the hosting and how to see the errors (Faundr's Errors section).
   - **After the incident (LGPD):** if personal data leaked with risk to people, notify the ANPD and the data subjects within 3 business days (Resolução CD/ANPD nº 15/2024), keep the record of what happened for 5 years, and write what changes so it does not happen again.
   Show the draft, ask the user to fill in what only they know (names, password manager) and run `launch-check` again.
