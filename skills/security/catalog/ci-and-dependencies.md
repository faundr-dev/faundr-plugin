# CI and dependencies (GitHub Actions, install scripts, packages)
When to read: the project has `.github/workflows/`, another CI (`.gitlab-ci.yml`, `.circleci/`), a release or publish script, or a package manifest (`package.json`, `requirements.txt`, `pyproject.toml`, `composer.json`, `go.mod`…). Packages with known flaws are already caught by the automatic check; this file covers problems with **how** the code is built and published: who can run code with the project's keys.

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
- Where to look: dependencies in `package.json` you don't recognize; `postinstall`, `preinstall`, `prepare` in the project's own `package.json` that download and execute something; no committed lockfile (`package-lock.json`, `pnpm-lock.yaml`, `bun.lock`); dependency by git URL or tarball (floating versions like `"latest"`: see `dependencia-flutuante-ou-nao-declarada`).
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

## dependencia-flutuante-ou-nao-declarada — Dependency at `latest`/`*`, or used without being declared
- Typical severity: medium (the next lockfile refresh pulls a new major or a hijacked release with nobody reviewing it; an undeclared package disappears or changes when a sibling dependency updates); high when it is a build or publishing tool, which runs with the release keys.
- Where to look: `package.json` versions `"latest"`, `"*"`, `"x"`, `">=1"`, git branches (`github:org/repo#main`); `requirements.txt` without `==`; imports and build scripts (`build.mjs`, `scripts/*`, config files) that use a package missing from the manifest of that folder (it only works because another dependency pulled it in: a phantom dependency); workspaces where a sub-package relies on the root's `node_modules`.
- How to confirm by reading the code: list the floating versions; for each `import`/`require` in scripts and configs, check that the package is declared in the nearest `package.json`. A committed lockfile with `npm ci` freezes the current resolution, but `latest` still moves silently the next time anyone runs `npm install`/`npm update` or Dependabot regenerates the lock, and an undeclared package can vanish from the tree at any update.
- Ruled out if: every dependency has a range (`^1.2.3`) or exact version, the lockfile is committed, CI installs with `npm ci`/`--frozen-lockfile`, and every imported package is declared where it is used.
- Not ruled out by: "the lockfile pins it" (until the next regeneration); "it works on my machine" (the phantom package is there by chance).
- How to fix:
  ```jsonc
  // bad
  "@tanstack/react-router": "latest"
  // good: an explicit range, updated on purpose (Dependabot/Renovate opens the PR)
  "@tanstack/react-router": "^1.120.3"
  ```
  And declare what scripts import: `npm i -D esbuild` in the folder whose script uses it.
- CWE: CWE-1357

## ci-nao-roda-o-build — CI checks types and tests, but not the build that goes to production
- Typical severity: medium when deploy happens automatically on push (a build that only breaks in the production bundler or runtime takes the site down for everyone); low with a manual deploy that builds first.
- Where to look: `.github/workflows/*.yml` steps (`npm test`, `tsc --noEmit`, `lint`) compared with the deploy command (`npm run build`, `next build`, `vite build`, `wrangler deploy`, the host's build settings); `on: push` to the main branch connected to the host's automatic deploy.
- How to confirm by reading the code: is the same build command the host runs executed in CI before merge/push to the deployed branch? Errors that only the build catches: imports that only fail in the server bundle, environment-specific code, SSR evaluation of a module, size limits of the runtime.
- Ruled out if: CI runs the production build (and, ideally, a smoke test of the built output) as a required check on the deployed branch; or the deploy pipeline itself builds and stops before publishing when the build fails.
- Not ruled out by: "the typecheck is clean"; "tests pass" (they import the source, not the bundle).
- How to fix: add `- run: npm run build` to the CI job, mark it as required for the deployed branch, and keep the host from publishing a failed build.
- CWE: CWE-1127

## publicacao-sem-conferir-estado — Release script publishes from a dirty tree, an unpushed HEAD or a stale build
- Typical severity: medium (a package goes out with code nobody reviewed or committed: local experiments, debug flags, a secret in a scratch file, or an old `dist/` that does not match the source); high when the package is installed by many users or runs with their credentials (CLI, plugin, SDK, extension).
- Where to look: `scripts/publish*.{js,mjs,sh}`, `release` scripts in `package.json`, `npm publish`, `vsce publish`, `web-ext sign`, `cargo publish`, `twine upload`, `gh release create` run from a laptop; `prepublishOnly`; `files`/`.npmignore` in the published package.
- How to confirm by reading the code: before publishing, does the script (1) refuse a dirty working tree (`git status --porcelain` empty), (2) check that HEAD is on the release branch and already pushed (`git rev-parse HEAD` equals `@{u}`), (3) rebuild the artifact from that commit instead of shipping whatever is in `dist/`, (4) run the full test suite and the build, (5) publish only an allowlist of files? Publishing from CI on a tag, with provenance (`npm publish --provenance`), covers most of this.
- Ruled out if: publishing happens only in CI from a tagged commit, or the local script checks the five points and aborts on any failure.
- Not ruled out by: "only the owner publishes"; tests that run but whose failure does not stop the publish.
- How to fix:
  ```js
  // good: abort unless the tree is clean and HEAD is pushed, then rebuild and publish
  const sh = (c) => execSync(c, { encoding: 'utf8' }).trim()
  if (sh('git status --porcelain')) throw new Error('uncommitted changes')
  sh('git fetch -q'); if (sh('git rev-parse HEAD') !== sh('git rev-parse @{u}')) throw new Error('HEAD not pushed')
  sh('npm test'); sh('npm run build'); sh('npm publish --provenance')
  ```
- CWE: CWE-693
