# CI and dependencies (GitHub Actions, install scripts, packages)
When to read: the project has `.github/workflows/`, another CI (`.gitlab-ci.yml`, `.circleci/`) or a package manifest (`package.json`, `requirements.txt`, `pyproject.toml`, `composer.json`, `go.mod`…). Packages with known flaws are already caught by the automatic check; this file covers problems with **how** the code is built and published: who can run code with the project's keys.

Golden rule: CI runs with the deploy, database and publishing keys. Code or text coming from an outside pull request, a branch name, an issue title or a new package is untrusted input, and must not run where those keys are.

## ci-pull-request-target — Privileged workflow runs the code of an outside PR
- Typical severity: critical in a public repository (anyone opens a PR and takes the keys); high in a private one with external collaborators.
- Where to look: `.github/workflows/*.yml` with `on: pull_request_target` or `workflow_run`, followed by `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}` (or `head.ref`) and then `npm install`, `npm test`, `make`, build.
- How to confirm by reading the code: the trigger gives access to the secrets; the checkout brings in the PR's code; a later step executes that code (install scripts count).
- Ruled out if: the workflow uses `pull_request` (no secrets for forks), or doesn't check out the PR's code, or only reads the PR without executing anything from it, or requires manual approval (environment with reviewers) before running.
- Not ruled out by: `if: github.actor != 'dependabot'` or a label check that any collaborator can add.
- How to fix: switch to `pull_request`; if a secret is needed, split into two workflows (the PR one, without secrets, produces an artifact; the privileged one only reads the artifact as data).
- CWE: CWE-829

## ci-expressao-no-run — PR, issue or branch text inside a CI command
- Typical severity: high (command execution in CI with the repository token and the job's secrets).
- Where to look: `run:` containing `${{ github.event.issue.title }}`, `${{ github.event.pull_request.title }}`, `.body`, `github.head_ref`, `github.event.comment.body`, `github.event.head_commit.message`, `inputs.*` from an open `workflow_dispatch`.
- How to confirm by reading the code: the `${{ }}` expression is pasted into the script **before** the shell runs; a title like `"; curl … | sh #` becomes a command.
- Ruled out if: the value goes through `env:` and the script uses `"$TITLE"` in quotes; or the field is not controlled by outsiders.
- Not ruled out by: quotes around `${{ }}` inside the `run` (the text can close the quotes).
- How to fix: `env: TITLE: ${{ github.event.issue.title }}` and `"$TITLE"` in the script.
- CWE: CWE-78

## ci-permissoes-e-segredos — CI token with too much power or a secret exposed in the log
- Typical severity: medium; high combined with either of the two above.
- Where to look: workflows without `permissions:` (the token may have write access to everything, depending on the repository settings), `permissions: write-all`, `echo ${{ secrets.X }}`, a secret passed as a command-line argument, `set -x` in a step with a secret, artifacts that include `.env`.
- How to confirm by reading the code: see what each job needs (only read? publish a package? comment on the PR?) and what it receives.
- Ruled out if: minimal `permissions:` at the top (e.g., `contents: read`) and widened only on the job that needs it; secrets only via `env` and never printed.
- Not ruled out by: "GitHub masks secrets in the log" (it doesn't if the secret is transformed: base64, pieces, JSON).
- How to fix: `permissions: contents: read` at the top; secrets only in the steps that use them; no `.env` in artifacts.
- CWE: CWE-250

## ci-acao-sem-versao-fixa — Third-party action or image by a tag that can change
- Typical severity: medium (if the third-party action is compromised, it runs in your CI with your secrets); low for official actions (`actions/*`).
- Where to look: `uses: someone/action@v1` or `@main` on third-party actions, especially in jobs with secrets or deploy jobs; `curl … | sh`/`bash` in CI; `:latest` Docker images.
- How to confirm by reading the code: the tag can be moved by the action's owner to other code; the full SHA can't.
- Ruled out if: third-party actions pinned by the 40-character SHA (with a version comment), or the job has no secrets and no write permission.
- Not ruled out by: "the action is popular".
- How to fix: `uses: someone/action@<40-character sha> # v1.2.3` and Dependabot to update.
- CWE: CWE-829

## pacote-script-de-instalacao — New or unknown package that runs code on install
- Typical severity: high when the name looks like a typo of a famous package, was published a few days ago or has no repository; low for well-known packages.
- Where to look: dependencies in `package.json` you don't recognize; `postinstall`, `preinstall`, `prepare` in the project's own `package.json` that download and execute something; no committed lockfile (`package-lock.json`, `pnpm-lock.yaml`, `bun.lock`); `"*"`/`"latest"` as the version; dependency by git URL or tarball.
- How to confirm by reading the code: check the name carefully (`reqeusts`, `colors-js`, swapped `@scope`), the lockfile in the repository and whether CI uses a locked install (`npm ci`, `pnpm install --frozen-lockfile`). Don't install anything to test.
- Ruled out if: committed lockfile, locked install in CI and all names checked; the project's own install scripts only run project tools.
- Not ruled out by: "the package has lots of downloads" (look-alike names do too).
- How to fix: remove the suspicious package, commit the lockfile, `npm ci` in CI, `ignore-scripts=true` in `.npmrc` when the project doesn't need install scripts.
- CWE: CWE-1357

## pacote-de-nome-interno — Internal package that can be swapped for a public one with the same name
- Typical severity: high when the project uses unscoped private packages.
- Where to look: dependencies without `@scope/` that don't exist on the public npm (company name, `internal-utils`); `.npmrc` with a private registry without `@scope:registry=`; `--extra-index-url` in Python.
- How to confirm by reading the code: if the manager also looks up the name in the public registry, whoever publishes there with a higher version wins.
- Ruled out if: internal packages with a scope tied to the private registry (`@company:registry=…`), or only `--index-url` (without `extra`).
- Not ruled out by: "the name is unique".
- How to fix: your own scope for internal packages and the scope's registry in `.npmrc`; in Python, a single index.
- CWE: CWE-427
