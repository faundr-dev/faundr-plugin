---
description: AI tests in the project linked to Faundr — asks the owner what can't break, links each feature to the tests that protect it (tests × features map on the dashboard) and writes the missing tests following Faundr's guide (front door, hand-written expected value, empty/error/edge cases, see the test fail first), running them with faundr tests-run. Use when the user asks for tests, asks whether the app is protected, or when coverage of what changed falls below the rest of the project.
argument-hint: '[feature or file]  (no argument: starts with what can''t break)'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm test*) Bash(npm run *) Bash(npx vitest *) Bash(npx jest *) Bash(npx playwright *) Read Grep Glob Edit Write
---

## Context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" tests-context`

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it's not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

## 1. Prepare

1. Read the whole **guide** (path in the context). It outweighs your usual way of doing things.
2. Read 2 or 3 tests that already exist in the project: same runner, same folder, same style. No tests and no runner: propose **Vitest** (or whatever matches the stack) and **ask for the owner's OK before installing** (`npm install -D vitest`). Faundr never installs on its own.
3. If the context warns about a **production database**, don't run anything that touches the database: propose creating a `.env.test` with a test database and wait for the OK.

## 2. What can't break

If the argument already states the target, go straight to it. Otherwise, ask the owner **in product language**, using the context's feature list (the ask-the-user tool, up to 4 options per question, multiple choice): "Of these, which ones can't break under any circumstances?". Record each one chosen:

`faundr tests-map "<feature>" --critical`

## 3. Tests × features map

For each critical feature (and the others, if there's time), find out with Grep and by reading the tests which test files protect it, and record:

`faundr tests-map "<feature>" --status coberta|parcial|sem-testes --tests "<file1>,<file2>" --note "<what is and isn't tested, one sentence>"`

`coberta` (covered) = the main paths and at least one error case have tests; `parcial` (partial) = something is tested, but an important path is missing; `sem-testes` (no tests) = nothing.

Write the note in the project's content language (Faundr shows it in the context).

## 4. Write the missing tests

Start with the critical feature that is `sem-testes` or `parcial`, then the context's "changed and untested" lines.

- Vertical slices: **one test, run, next**. Run only the file: `faundr tests-run --files <test file>` (or `--changed`).
- Always through `faundr tests-run`, never directly through `npx vitest` or `pytest`: only that way does the run show up on the dashboard. It finds the runners in subfolders (e.g. `frontend/`) and runs pytest, flutter test, dart test, PHPUnit, Pest, go test, Maven and Gradle (JUnit), dotnet test, cargo test, CTest (which configures and builds the CMake project in the build/ folder before running), make test/check for C/C++ projects with only a Makefile, and Angular's ng test (Karma), without installing anything in the project. If it can't find Python, pass `--python <path to the venv's python>` once (it's remembered). A test that writes to the real database: leave it out with `--exclude <file>`.
- For each new test of code that already exists, **see it fail once**: break the line on purpose, run, check the red and **undo the break**. Tell the owner you did this.
- Follow the guide's 12 rules. No recomputing the expected value the way the code computes it; no mocking the project's own modules.
- If you find a real bug while testing (the correct test fails), **don't change the test to make it pass**: stop, explain to the owner what you found and ask whether to fix it.

At the end, run everything once with coverage (if the tool exists): `faundr tests-run --coverage`. Update the map (`--status coberta` where it became covered).

## Escaped defect (T-n, mutation testing)

If the argument is a T-n (or the owner asks to kill the defects in the Mutation tab):
1. Read the defect: `faundr tests-show T-<n>` (the code, the damage and the file:line).
2. Write **one test** that would fail with that damage: through the front door, with the expected value written by hand. E.g. damage `valor > 100` instead of `valor >= 100` → test "free shipping at exactly R$ 100".
3. Run the test file (`faundr tests-run --files <test file>`) and then **prove it** on that line only: `faundr tests-mutation --files <file>:<line>-<line>`. The T-n has to show up as "agora pego" (now caught).
4. If no test can catch it (the damage doesn't change what the app does, e.g. `a <= b` in a `max`), explain to the owner in one sentence and suggest `faundr tests-ignore T-<n> --reason equivalent --note "<why>"`. Don't ignore without their OK.

## 5. Answer

In plain language, in the user's language, a few lines:
1. What can't break (what the owner chose) and how each one ended up: covered / partial / no tests.
2. How many tests were written, in which files, and whether they all pass.
3. Bugs found along the way (if any), without having fixed them without asking.
4. Coverage before and after, if you measured it.

The results show up in Tests on the Faundr dashboard.
