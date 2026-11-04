#!/usr/bin/env node
// CLI do Faundr. Sem dependências: roda com o Node do usuário.
//
//   faundr login [--url https://...]           sign in through the browser (--start only asks for the code, --wait waits for approval)
//   faundr login <token> [--url https://...]   saves an existing token (outside the chat)
//   faundr logout                              deletes this computer's token from Faundr and from ~/.faundr
//   faundr link <projectId>                    links the current folder to a project
//   faundr setup [--apply …] [--skip …] [--refresh]  sets Faundr up in one go (does the safe part, lists what needs an OK)
//   faundr status                              shows the configuration and the link
//   faundr map [question]                      with nothing, same as graph; with a question, graph-query; with "a::x" "b::y", graph-path
//   faundr graph                               builds the project's knowledge graph and sends it to the platform
//   faundr graph-query "<question>"            up to 8 relevant code snippets, with their callers (--budget N, --limit N, --subgraph)
//   faundr graph-path "A" "B"                  shortest path between two nodes, without going through outside modules (--undirected)
//   faundr graph-callers "X"                   who calls or imports X (--out: what X uses; --both: both; --depth N)
//   faundr graph-skeleton <file>               the file's signatures, without the bodies
//   faundr graph-grep "<pattern>"              text search grouped by function, most used first (--in folder, -i)
//   faundr feature "<title>" [--desc "..."] [--done-when "a; b"]  creates a feature (with its Done when) and makes it the current one
//     --after <current | name>                 records it as the next stage of another (stays planned; does not become current)
//   faundr criteria ["<criterion>"] [--remove <n>] | criteria-check <n> --met|--not-met [--note]   Done when of the current feature
//   faundr task "<description>" [--feature name]  adds a task to the checklist of the current feature (or of another stage)
//   faundr start|done "<snippet or #>"         marks a task as in progress / done
//   faundr decision "<title>" [--why "..."]    records a technical decision
//   faundr rule "<title>" [--why "..."] [--file <pattern>] [--forbid "<regex>"]  team rule; --forbid: what the code must not contain
//     --file <file or pattern>                 (rule and decision, repeatable) links to files: reaches the agent before it edits them
//     --replaces "<id or snippet>"             (rule and decision) retires the rule or decision this one replaces
//     --global                                 (decision) does not link itself to the files the session edited
//   faundr memory-edit "<id or snippet>" [--rule|--decision] [--file …] [--global] [--obsolete]  changes a rule or decision
//   faundr concern "<title>" [--why "..."]     records a concern to review later
//   faundr resolve [P-<n> | snippet]           marks a concern as resolved (no argument: lists the open ones)
//   faundr focus "<name>"                      switches the current feature
//   faundr board [--all | --memory | --review] shows the checklist (--memory: confirmed rules and decisions; --review: everything open, for the board skill)
//   faundr feature-discard "<id or name>"      discards a feature (leaves the tabs and the context; can be brought back)
//   faundr feature-restore "<id or name>"      brings back a discarded feature
//   faundr overview-context                    context for the agent to write the Project overview
//   faundr overview-save [file]                validates and sends the Project overview (default: .faundr/painel/overview.json)
//   faundr architecture-check [--quiet|--pull] checks which parts of the architecture already exist and the code outside the plan (no AI); --pull saves the architecture for editing
//   faundr diagram-save [file] [--feature "<name>" | --architecture] [--no-wait]  sends the feature diagram (opens the canvas and waits for the owner to approve) or the project architecture (default: .faundr/painel/diagram.json)
//   faundr diagram-wait [--feature "<name>"]   keeps waiting for the owner to approve or ask for changes to the feature drawing
//   faundr stack-scan [--json]                 detects the Project stack without AI (where it runs, languages, services, variables) and sends it
//   faundr env-check [--hosting] [--no-send]   variables per environment: code x example x local .env x hosting (names only)
//   faundr handover [--out file.md]            handover pack: one document for a developer to take over the project (default: .faundr/relatorios/PASSAGEM.md)
//   faundr weekly                              weekly summary in plain language (the same one sent to Slack/Discord)
//   faundr stack-context                       context for the agent to review the Project stack ("stack" skill)
//   faundr stack-save [file]                   validates and sends the reviewed Project stack (default: .faundr/painel/stack.json)
//   faundr handoff "<note>"                    handoff note for the current session
//   faundr resume                              where we left off: previous session and everything still open
//   faundr design-lint [--json] [--quiet]      design check without AI (~45 rules: identity, responsive, accessibility, contrast, motion, content, consistency)
//   faundr design-context [--files a,b]        context for the agent to audit the design ("design" skill)
//   faundr design-finding "<title>" --kind …   records a design finding (D-n)
//   faundr design-show D-<n>                   details of a design finding
//   faundr design-resolve [D-<n>]              marks a design finding as resolved (no argument: lists)
//   faundr design-archive D-<n> --reason … --note "…"  archives a finding that does not apply to the project (with evidence)
//   faundr design-reopen D-<n>                 reopens an archived or resolved finding
//   faundr design-scope [--mobile …] [--disable rule] [--enable rule]  design scope and turned-off rules
//   faundr design-coverage [--theme t --result r --how h --score n --note …] [--finish]  coverage of the full audit
//   faundr design-measure-script               script that measures the screen open in the browser (scroll, touch, contrast…)
//   faundr design-measure-save --screen "<screen>" --file <json>  measurement findings per screen and width
//   faundr showcase-context                    context for the agent to build the Showcase replicas ("design-showcase" skill)
//   faundr showcase-save [file]                validates and sends the replicas (default: .faundr/painel/showcase.json) with the CSS and fonts
//   faundr security-scan [--files a,b]         security check without AI (keys, packages, database); --edited: only what was edited
//   faundr security-show [S-<n>]               open security issues, or the details of one
//   faundr security-resolve S-<n>              reruns the check and only closes it if the issue is gone
//   faundr security-ignore S-<n> --reason …    ignores with a reason (not-an-issue | accepted-risk), for 30 days
//   faundr security-context [--files a,b]      context for the agent to do the AI review ("security" skill)
//   faundr security-finding "<title>" …        records an issue found in the AI review (S-n)
//   faundr security-review-done --areas "…"    records what the review covered
//   faundr skill-report "<skill>" --areas … (--file <json> | --none)  records the result of a connected skill (via /name)
//   faundr security-import <file>              imports Snyk (--json), SARIF from any tool or the Supabase Security Advisor
//   faundr security-supabase [--ref <ref>]     Supabase Security Advisor through the API (token in SUPABASE_ACCESS_TOKEN)
//   faundr db-test [--ref <ref>] [--sql | --result <file>] [--no-send]   tests the database as a visitor and as another person (all undone)
//   faundr launch-check [--url <site>] [--skip-code] [--no-send]  "Ready to launch?": build, tests, security, headers, rate limit, payment webhook, privacy, database tested; ends with CAN LAUNCH: YES/NO
//   faundr privacy [--no-send]                 privacy (LGPD): personal data collected, companies that receive it, policy, terms, cookies and account deletion
//   faundr security-report [--out file.md]     security report in Markdown (default: .faundr/relatorios/relatorio-seguranca.md)
//   faundr quality-scan [--files a,b]          quality check without AI (hidden failure, types, complexity, too much code); --edited: only what was edited
//   faundr quality-show [Q-<n>]                open quality issues, or the details of one
//   faundr quality-resolve Q-<n>               reruns the check and only closes it if the issue is gone
//   faundr quality-ignore Q-<n> --reason …     ignores with a reason (false-alarm | on-purpose | later: comes back in 30 days)
//   faundr quality-reopen Q-<n>                reopens an ignored finding
//   faundr quality-context [--files a,b | --full]  context for the agent to do the AI review ("quality" skill)
//   faundr quality-finding "<title>" …         records a finding from the AI review (Q-n, confidence 80+)
//   faundr quality-review-done --areas "…"     records what the review covered (and the 0-4 score per theme with --scores)
//   faundr quality-rule "<name>" --pattern …   creates a house rule in .faundr-regras/ (pattern + message)
//   faundr quality-ladder on|off               turns the quality reminder at session start on/off
//   faundr tests-scan                          inventory of the tests without running anything (runners, files, result on disk)
//   faundr tests-run [--changed] [--coverage] [--files a,b] [--exclude a,b] [--runner vitest|jest|playwright|node|pytest|flutter|dart|phpunit|pest|go|maven|gradle|dotnet|cargo|ctest|make|karma] [--python <path>] [--confirm-db]  runs the tests (only when asked)
//   faundr tests-show                          last run, failing and flaky tests
//   faundr tests-context [--fix]               context for the agent to write or fix tests ("tests" and "tests-fix" skills)
//   faundr tests-map "<feature>" …             tests × features map (--status, --tests, --critical)
//   faundr tests-mutation [--files a:10-20] [--budget 5]  mutation testing (Stryker) on what the session changed; defects that escape become T-n
//   faundr tests-ignore T-<n> --reason …       ignores a defect with a reason (equivalent | false-alarm | later)
//   faundr errors [--all | --resolved]         open errors in commands (E-n); they close by themselves when the command passes
//   faundr error-show E-<n>                    details of an error (message, output snippet, session and request where it appeared)
//   faundr error-resolve E-<n> --verified "…"  closes it by hand, saying how it was verified (normally the command passing closes it)
//   faundr error-recipe E-<n> --cause "…" --fix "…"  saves why it broke and what fixed it (shown when it, or the same error elsewhere, appears)
//   faundr parallel [open "<a>; <b>" | close <name>|--all]  stages ready to go in parallel; opens/closes a workbench (git worktree) per stage
//     --next-deploy                            error from the published app: the old version may still send it; only comes back if it shows up in a new version
//   faundr error-archive E-<n> [--days N | --count N | --users N | --not-an-error]  archives for a while, up to N more times or N more people; --not-an-error when the capture misread something (archived for good)
//   faundr error-reopen E-<n>                  reopens an archived or resolved error
//   faundr errors-dsn                          address (DSN) for the published app to send errors to Faundr (Sentry SDK)
//   faundr errors-sdk [--dir src/lib]          copies Faundr's server error SDK (Node, Workers) into the project
//   faundr errors-uptime <https://site> | --off  checks the site every 5 min; down becomes E-n
//   faundr errors-import-sentry --org O --project P  brings in the open errors of people who already use Sentry (SENTRY_AUTH_TOKEN)
//   faundr checkpoint ["reason"]               saves a restore point of the files (Faundr already saves one by itself before changes)
//   faundr checkpoints                         lists the restore points and what changed since each one
//   faundr team                                who else is on the project right now, where and in which files
//   faundr claim "<task>" [--force]            becomes the person responsible for the task (warns if it already belongs to someone else)
//   faundr release "<task>"                    frees the task for anyone
//   faundr own ["<feature>"] [--force]         becomes the owner of the feature (no name: the current one; warns if it belongs to someone else)
//   faundr disown ["<feature>"]                leaves the feature without an owner (whoever touches it first becomes the owner)
//   faundr inbox [--done <code> "note"]        dashboard requests, messages and notes waiting for you; --done closes a request
//   faundr msg "<text>" [--to "<name>"]        message to a person on the team (without --to: to the whole team)
//   faundr restore <n> [--yes]                 restores the files to point n (without --yes, only shows what would change)
//   faundr guard claude                        called by the PreToolUse hook: blocks dangerous keys before writing
//   faundr hook <claude|codex>                 called by the hooks (reads the JSON from stdin)
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → exit 0 em silêncio
// (os detalhes vão para ~/.faundr/hook.log).

import { t } from './i18n.mjs'
import { log } from './cli-core.mjs'
import { recordFailure } from './failures.mjs'
import { gate } from './hook-stop.mjs'
import { hook, usageSync } from './hook-events.mjs'
import { guard } from './hook-guard.mjs'
import { graph, graphCommand, mapCommand, runBackground, subagentStart } from './cmd-graph.mjs'
import { memoryEdit, refreshStatus, work } from './cmd-features.mjs'
import { skillsCommand, workflowCommand } from './cmd-workflows-skills.mjs'
import { architectureCheck, diagramSave, diagramWait, overviewContext, overviewSave } from './cmd-overview.mjs'
import { envCheck, handoffCommand, handover, resumeCommand, stackContext, stackSave, stackScan, weekly } from './cmd-stack.mjs'
import { errorArchive, errorRecipe, errorReopen, errorResolve, errorsDsn, errorShow, errorsImportSentry, errorsList, errorsSdk, errorsUptime } from './cmd-dev-errors.mjs'
import { parallelCommand } from './cmd-parallel.mjs'
import { securityContext, securityFinding, securityIgnore, securityImport, securityReport, securityResolve, securityReviewDone, securityScan, securityShow, securitySupabase, skillReport } from './cmd-security.mjs'
import { dbTest, launchCheck, privacyCommand } from './cmd-launch-check.mjs'
import { qualityContext, qualityFinding, qualityIgnore, qualityLadder, qualityReopen, qualityResolve, qualityReviewDone, qualityRule, qualityScan, qualityShow } from './cmd-quality.mjs'
import { testsContext, testsIgnore, testsMap, testsMutation, testsRun, testsScan, testsShow } from './cmd-tests.mjs'
import { browseCommand, browseKeyCommand, checkpointCommand, checkpointsList, checkpointsSync, inboxCommand, listenCommand, msgCommand, restoreCommand, teamCommand } from './cmd-checkpoints.mjs'
import { designArchive, designContext, designFinding, designLint, designReopen, showcaseContext, showcaseSave } from './cmd-design.mjs'
import { designCoverage, designMeasureSave, designMeasureScript, designResolve, designScope, designShow } from './cmd-design-audit.mjs'
import { agentsMd, link, login, logout, status, statusline, usageDebug } from './cmd-account.mjs'
import { configCommand, setup, statuslineInstall } from './cmd-setup.mjs'

// Nomes em português de antes da 0.99: continuam funcionando, com aviso, até saírem numa próxima versão.
const RENAMED = { fila: 'inbox', recado: 'msg', escutar: 'listen', mapa: 'map', lgpd: 'privacy', pegar: 'claim', soltar: 'release', dono: 'own', 'soltar-dono': 'disown' }
const RENAMED_FLAGS = { '--feito': '--done', '--para': '--to' }
// Checagens que rodam em segundo plano (--quiet): o erro vai para o log, não para a tela.
const QUIET_CHECKS = ['skills', 'graph', 'design-lint', 'security-scan', 'quality-scan', 'tests-scan', 'stack-scan', 'env-check', 'usage-sync', 'checkpoints-sync', 'architecture-check']
// Acima disto o hook já atrasa o agente (o do início da sessão tem 10 s no total).
const SLOW_HOOK_MS = 5000
const [typed, ...typedArgs] = process.argv.slice(2)
const command = RENAMED[typed] ?? typed
const args = typedArgs.map((a) => RENAMED_FLAGS[a] ?? a)
if (RENAMED[typed])
  console.error(t(`(faundr ${typed} is now faundr ${command}; the old name will stop working in a future version.)`, `(faundr ${typed} agora é faundr ${command}; o nome antigo vai deixar de funcionar numa próxima versão.)`))

if (command === 'statusline') {
  // A barra nunca mostra erro: sem projeto ligado ou com algo quebrado, fica em branco.
  try {
    await statusline()
  } catch (err) {
    log(`statusline: ${err?.message ?? err}`)
  }
} else if (command === 'hook' || command === 'gate' || command === 'guard' || command === 'subagent-start') {
  const startedAt = Date.now()
  try {
    if (command === 'gate') await gate()
    else if (command === 'guard') await guard()
    else if (command === 'subagent-start') await subagentStart()
    else await hook(args[0] === 'codex' ? 'codex' : 'claude')
  } catch (err) {
    log(`error (${command}): ${err?.stack ?? err}`)
    if (!isNetworkError(err)) recordFailure(command, 'crash', err)
  }
  const ms = Date.now() - startedAt
  if (ms > SLOW_HOOK_MS) recordFailure(command, 'slow', null, ms)
  // Sair sozinho, sem process.exit: no Node 24 do Windows, process.exit depois de duas requisições
  // derruba o processo ("Assertion failed … UV_HANDLE_CLOSING", código 127). A trava abaixo não segura o processo.
  process.exitCode = 0
  setTimeout(() => {
    recordFailure(command, 'stuck', null, Date.now() - startedAt)
    process.exit(0)
  }, 3000).unref()
} else await cli()

async function cli() {
  // Codex: na área protegida os comandos do agente rodam sem rede. O erro diz o que fazer em vez de só "fetch failed".
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1') {
    const original = globalThis.fetch
    globalThis.fetch = async (...a) => {
      try {
        return await original(...a)
      } catch (err) {
        throw new Error(
          `${err.message} — ${t(
            "Codex ran this command without network (sandbox): run the same command again with network access (outside the sandbox, with the user's OK). So it stops asking: faundr setup --no-ask --apply codex-rules",
            'o Codex rodou este comando sem rede (área protegida): rode o mesmo comando de novo com acesso à rede (fora da área protegida, com o OK da pessoa). Para não pedir mais: faundr setup --no-ask --apply codex-rules',
          )}`,
          { cause: err },
        )
      }
    }
  }
  try {
    const commands = cliCommands()
    if (Object.hasOwn(commands, command)) await commands[command](args)
    else printCommands()
  } catch (err) {
    const quiet = QUIET_CHECKS.includes(command) && args.includes('--quiet')
    if (quiet) log(`${command}: ${err.message}`)
    else console.log(err.message)
    // Checagem em segundo plano que quebrou, ou um bug (TypeError…) em qualquer comando. Os erros de uso
    // ("faltou o --verified") são `Error` comum e não contam; sem rede também não.
    if (!isNetworkError(err) && (quiet || err?.constructor !== Error || err?.code)) recordFailure(command, 'crash', err)
    process.exit(1)
  }
}

function isNetworkError(err) {
  const code = err?.cause?.code ?? err?.code
  return err?.name === 'TimeoutError' || err?.name === 'AbortError' || err?.message === 'fetch failed' || ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code)
}

function printCommands() {
  console.log(
    'commands: setup | login | logout | link | status | config | browse | browse-key | checkpoint | checkpoints | restore | team | inbox | msg | map | graph | graph-query | graph-path | graph-callers | graph-skeleton | graph-grep | statusline-install | agents-md | usage --debug | feature | task | decision | rule | memory-edit | workflow | skills | concern | resolve | start | done | focus | board | feature-discard | feature-restore | criteria | criteria-check | handoff | handover | weekly | resume | diagram-save | architecture-check | stack-scan | env-check | stack-context | stack-save | design-lint | design-context | design-finding | design-show | design-resolve | security-scan | security-show | security-resolve | security-ignore | security-context | security-finding | security-review-done | skill-report | security-import | security-supabase | db-test | launch-check | privacy | security-report | quality-scan | quality-show | quality-resolve | quality-ignore | quality-reopen | quality-context | quality-finding | quality-review-done | quality-rule | quality-ladder | tests-scan | tests-run | tests-show | tests-context | tests-map | tests-mutation | tests-ignore | errors | error-show | error-resolve | error-recipe | error-archive | parallel | error-reopen | errors-dsn | errors-sdk | errors-uptime | errors-import-sentry | hook',
  )
}

// Cada comando da CLI e o que ele roda (recebe os argumentos depois do nome do comando).
function cliCommands() {
  const toWork = (name) => (a) => work(name, a)
  const workCommands = ['feature', 'task', 'decision', 'rule', 'concern', 'resolve', 'done', 'start', 'claim', 'release', 'own', 'disown', 'focus', 'board', 'criteria', 'criteria-check', 'feature-discard', 'feature-restore']
  return {
    login: (a) => login(a),
    logout: () => logout(),
    link: (a) => link(a.join(' ').trim()),
    status: () => status(),
    'status-refresh': () => refreshStatus(),
    'statusline-install': (a) => statuslineInstall(a),
    setup: (a) => setup(a),
    config: (a) => configCommand(a),
    'agents-md': (a) => agentsMd(a),
    usage: (a) => (a.includes('--debug') ? usageDebug(a) : printCommands()),
    checkpoint: (a) => checkpointCommand(a),
    checkpoints: (a) => checkpointsList(a),
    team: () => teamCommand(),
    inbox: (a) => inboxCommand(a),
    msg: (a) => msgCommand(a),
    listen: () => listenCommand(),
    browse: (a) => browseCommand(a),
    'browse-key': (a) => browseKeyCommand(a),
    restore: (a) => restoreCommand(a),
    'checkpoints-sync': (a) => checkpointsSync(a),
    graph: (a) => graph(a),
    'graph-query': (a) => graphCommand('query', a),
    map: (a) => mapCommand(a),
    'graph-path': (a) => graphCommand('path', a),
    // graph-explain virou graph-callers --both; o nome antigo continua funcionando.
    'graph-explain': (a) => graphCommand('callers', [...a, '--both']),
    'graph-callers': (a) => graphCommand('callers', a),
    'graph-skeleton': (a) => graphCommand('skeleton', a),
    'graph-grep': (a) => graphCommand('grep', a),
    ...Object.fromEntries(workCommands.map((name) => [name, toWork(name)])),
    'overview-context': () => overviewContext(),
    'overview-save': (a) => overviewSave(a),
    'diagram-save': (a) => diagramSave(a),
    'architecture-check': (a) => architectureCheck(a),
    'diagram-wait': (a) => diagramWait(a),
    handoff: (a) => handoffCommand(a),
    'stack-scan': (a) => stackScan(a),
    'env-check': (a) => envCheck(a),
    handover: (a) => handover(a),
    weekly: (a) => weekly(a),
    'usage-sync': (a) => usageSync(a),
    background: (a) => runBackground(a),
    'stack-context': () => stackContext(),
    'stack-save': (a) => stackSave(a),
    resume: () => resumeCommand(),
    'design-lint': (a) => designLint(a),
    'design-context': (a) => designContext(a),
    'design-finding': (a) => designFinding(a),
    'design-resolve': (a) => designResolve(a),
    'design-show': (a) => designShow(a),
    'design-archive': (a) => designArchive(a),
    'design-reopen': (a) => designReopen(a),
    'design-scope': (a) => designScope(a),
    'design-coverage': (a) => designCoverage(a),
    'design-measure-script': (a) => designMeasureScript(a),
    'design-measure-save': (a) => designMeasureSave(a),
    'showcase-context': () => showcaseContext(),
    'showcase-save': (a) => showcaseSave(a),
    'security-scan': (a) => securityScan(a),
    'security-show': (a) => securityShow(a),
    'security-resolve': (a) => securityResolve(a),
    'security-ignore': (a) => securityIgnore(a),
    'security-context': (a) => securityContext(a),
    'security-finding': (a) => securityFinding(a),
    'skill-report': (a) => skillReport(a),
    'security-review-done': (a) => securityReviewDone(a),
    'security-import': (a) => securityImport(a),
    'security-report': (a) => securityReport(a),
    'security-supabase': (a) => securitySupabase(a),
    'db-test': (a) => dbTest(a),
    'launch-check': (a) => launchCheck(a),
    privacy: (a) => privacyCommand(a),
    'quality-scan': (a) => qualityScan(a),
    'quality-show': (a) => qualityShow(a),
    'quality-resolve': (a) => qualityResolve(a),
    'quality-ignore': (a) => qualityIgnore(a),
    'quality-reopen': (a) => qualityReopen(a),
    'quality-context': (a) => qualityContext(a),
    'quality-finding': (a) => qualityFinding(a),
    'quality-review-done': (a) => qualityReviewDone(a),
    'quality-rule': (a) => qualityRule(a),
    'memory-edit': (a) => memoryEdit(a),
    workflow: (a) => workflowCommand(a),
    skills: (a) => skillsCommand(a),
    'quality-ladder': (a) => qualityLadder(a),
    'tests-scan': (a) => testsScan(a),
    'tests-run': (a) => testsRun(a),
    'tests-show': (a) => testsShow(a),
    'tests-context': (a) => testsContext(a),
    'tests-map': (a) => testsMap(a),
    'tests-mutation': (a) => testsMutation(a),
    'tests-ignore': (a) => testsIgnore(a),
    errors: (a) => errorsList(a),
    'error-show': (a) => errorShow(a),
    'error-resolve': (a) => errorResolve(a),
    'error-recipe': (a) => errorRecipe(a),
    parallel: (a) => parallelCommand(a),
    'error-archive': (a) => errorArchive(a),
    'error-reopen': (a) => errorReopen(a),
    'errors-dsn': () => errorsDsn(),
    'errors-sdk': () => errorsSdk(args),
    'errors-import-sentry': (a) => errorsImportSentry(a),
    'errors-uptime': (a) => errorsUptime(a),
  }
}
