# Guide for writing and fixing tests

Distilled from Faundr's studies (`docs/research/testes-*.md` and `qualidade-plugins-anthropic.md`): Matt Pocock's TDD
skill (MIT), the pr-test-analyzer and test-engineer from Anthropic's official plugins (Apache-2.0), and Stryker
(Apache-2.0). Rewritten for Faundr.

## Before writing: what can't break

The owner doesn't code. Don't ask "which functions to test"; ask in product language:
"Of these things, which ones can't break under any circumstances?" and list the context's features
(e.g. "calculate the cart total", "sign in with email and password", "charge the subscription"). Effort goes first
to what they choose. Record the answer with `faundr tests-map "<feature>" --critical`.

## The rules

1. **Test through the front door.** Call the function, route or screen the way someone using the app would. Don't test
   internal details: a test that breaks on a refactor that doesn't change behavior is a bad test.
2. **Expected value written by hand.** A literal number, an example worked out in your head, what the spec says.
   Recomputing it the way the code does is forbidden (`expect(soma(a, b)).toBe(a + b)`): that test never disagrees with the code.
3. **Test doubles only at the boundary.** Mock what's outside and you don't control: payment, email, AI, network, **date and
   time** (`vi.useFakeTimers()` + `vi.setSystemTime(...)`), randomness. Never mock a module of the project itself
   (`vi.mock('./…')`) or what you want to test.
4. **Error, empty and edge cases.** Empty list, missing field (`null`/`undefined`), zero, negative, exactly at the
   limit (`>` × `>=`: "purchase of exactly R$ 100"), text with accents, network failure. That's where bugs live.
5. **See the test fail before trusting it.** New test of code that already exists: break the line on purpose
   (swap `>=` for `>`, delete the line), run and watch it turn red; then undo. A test that was never red
   may be testing nothing.
6. **One behavior per test, a name that says what.** "charges R$ 15 shipping below R$ 100", not "test 3".
7. **Independent and in any order.** No depending on real time, real network, test order or data left
   by another test. Database: use a test database (`.env.test`), never the production one.
8. **Wait for the result, not the clock.** In Playwright, `expect(locator).toBeVisible()` already waits on its own;
   `waitForTimeout(2000)` is the main cause of flaky tests.
9. **Pyramid.** Many small, fast tests (one function), some integration tests (route + test database), few
   end-to-end tests in the browser (2 to 5 critical flows: sign in, buy, sign up).
10. **Use what the project already has.** Same runner (Vitest, Jest, Playwright, node --test, pytest), same folder and same
    style as the neighboring tests. Don't install a new runner without the owner's OK.
11. **Vertical slices.** One test, run, move on to the next. Don't write twenty tests at once without running.
12. **Don't ask for tests for the trivial** (a getter, a constant). Effort where there's a decision: if, loop, math, money,
    permission.

## Mutation testing: proof that the tests catch errors

Faundr can break the code on purpose (`faundr tests-mutation`) and list each damage no test noticed
(T-n). Each one is a missing case: write the test, prove it by running the mutation on that line only
(`--files file:line-line`) and watch it become "agora pego" (now caught). Damage that doesn't change behavior ("equivalent") has
no possible test: explain to the owner and ignore it with a reason.

## Fixing a failing test

- **Find out which side the error is on.** Read the message and the test. Did the code change on purpose (the test got stale)
  or did the code break (the test caught a bug)? When in doubt, ask the owner what the correct behavior is.
- **Never** delete, skip (`.skip`), loosen the `expect` or change the expected value just to pass without saying why.
  If the test was wrong, explain to the owner in one sentence what was wrong with it.
- Playwright test: look at the failure screenshot (the path comes in the message or in `test-results/`).

## Fixing a flaky test (passes and fails without the code changing)

Typical causes, in order: fixed-time waits; real date and time; real network or service; test that depends on another
(leftover data, order); unseeded randomness; race (two things at the same time). Fix the cause.
**Never** "solve" it by increasing the number of attempts (`retries`): that hides the problem.
To confirm: run the same test several times (`faundr tests-run --files <file>` repeated) and see whether it stops
flipping.
