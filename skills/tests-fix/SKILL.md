---
description: Fixes failing or flaky tests recorded in Faundr — explains the failure in plain language, finds out whether the error is in the code or in the test, fixes the cause (never deletes, skips or loosens the test just to make it pass) and confirms by running again with faundr tests-run. With no argument, works on the failing and flaky ones, one at a time; with --all, fixes all of them without stopping.
argument-hint: '"[test name or file | --all]"'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm test*) Bash(npm run *) Bash(npx vitest *) Bash(npx jest *) Bash(npx playwright *) Bash(git diff *) Bash(git log *) Read Grep Glob Edit
---

## Context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" tests-context --fix`

The target: $ARGUMENTS (no argument or with `--all`: the FALHANDO and INSTÁVEIS tests in the context, one at a time, failing ones first; with `--all`, also follow "--all mode" at the end).

Read the **guide**'s sections on fixing a failing test and fixing a flaky test (path in the context).

## Failing test

1. **Run only that one** to see the current failure: `faundr tests-run --files <file>`.
2. **Explain to the owner in one or two sentences**, in plain language, what the test checks and what went wrong (e.g. "the test expects free shipping above $100, but the app is charging $15 on purchases of exactly $100"). In Playwright, open the failure screenshot if the path appears.
3. **Which side is the error on?** Look at what changed (`git log -p -- <code file>`, `git diff`):
   - the code changed on purpose and the test became stale → update the test and **say why**;
   - the code broke → fix the code (at the cause; look for who else calls the function);
   - you cannot tell which is right → **ask the owner** what the expected behavior is, with the two options.
4. **Never**: delete the test, `.skip`, `.only`, loosen the `expect`, change the expected value without explaining, raise the timeout as a "solution".
5. Run the file again and, at the end, all of them (`faundr tests-run`): the fix cannot break another test. A test that passes again closes its error in the Errors section on its own.

## Flaky test (passes and fails without the code changing)

1. Look for the guide's typical causes, in this order: fixed-time wait; real date and time; real network or service; dependence on another test (leftover data, order); randomness without a seed; race.
2. Fix the cause (fake clock, wait for the result instead of the clock, data created in the test itself, mock the external service).
3. Confirm by running the file about 5 times in a row (`faundr tests-run --files <file>`): it has to pass every time.
4. **Never** "solve" it by raising `retries` or the timeout.

## --all mode (all of them, without stopping)

The user asked to fix everything at once: **do not stop to ask** between one test and the next. Start right away.

- **One at a time**, failing first and flaky after, with the steps above. For each test fixed, a single line: `<test> fixed (<done>/<total>): <side of the error, what changed>`.
- **What would need the owner does not block the rest**: when you cannot tell which behavior is right (step 3), do not choose; note it under "Waiting on you" with the two options in one line and move on to the next.
- **Not fixed in 2 attempts**: undo only that test's change, note it under "Couldn't fix" with the reason, and move on.
- **Do not end the response while there is a failing or flaky test** that is not under "Waiting on you" or "Couldn't fix". If the conversation is summarized midway, run `faundr tests-context --fix` again: it shows what remains.
- **At the end**, run all of them (`faundr tests-run`): whatever broke along the way goes into the queue. Do not commit.

The final response of --all mode also includes how many were fixed and the "Waiting on you" and "Couldn't fix" lists.

## Answer

A few lines, for people who don't code, in the user's language: what was wrong, which side it was on (code or test), what changed and how you confirmed it (how many runs passed). If an owner decision was needed, say which one is pending.
