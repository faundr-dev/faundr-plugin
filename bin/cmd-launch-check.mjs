// Antes de publicar: faundr db-test (banco testado como visitante e como outra pessoa), privacy (LGPD) e launch-check
// ("Pronto para publicar?").

import fs from 'node:fs'
import path from 'node:path'
import { ensureFaundrPath } from './paths.mjs'
import { projectFiles } from './security.mjs'
import { checkBuild, launchChecks, launchVerdict, securityItems } from './launch.mjs'
import { privacyScan } from './privacy.mjs'
import { anonReads, dbFindings, dbSummary, exposedTables, migrationTables, parseProbe, PROBE_SQL, probeWithToken, supabaseTarget } from './db-test.mjs'
import { t } from './i18n.mjs'
import { flag, linkedProject } from './cli-core.mjs'
import { securityApi, securityScan, sendImport } from './cmd-security.mjs'
import { testsRun } from './cmd-tests.mjs'

// Teste do banco como visitante: lê com a chave pública e tenta gravar/alterar/apagar pelo SQL (sempre desfeito).
// O SQL vai pela API de gestão (SUPABASE_ACCESS_TOKEN) ou pelo MCP do Supabase: --sql imprime, --result importa.
export async function dbTest(args) {
  if (args.includes('--sql')) return console.log(PROBE_SQL)
  const { root } = linkedProject()
  const target = supabaseTarget(root)
  const ref = flag(args, '--ref') ?? target?.ref
  if (!target && !ref && !flag(args, '--result')) throw new Error("Could not find this project's Supabase (*_SUPABASE_URL variable in the .env files). Pass it with --ref <ref>.")

  let tables = null
  let how = null
  const resultFile = flag(args, '--result')
  if (resultFile) {
    tables = parseProbe(fs.readFileSync(path.resolve(resultFile), 'utf8'))
    how = 'imported SQL result'
  } else if (process.env.SUPABASE_ACCESS_TOKEN && ref) {
    tables = await probeWithToken(ref, process.env.SUPABASE_ACCESS_TOKEN)
    how = 'Supabase management API'
  }

  let reads = []
  if (target?.key) {
    const names = tables?.map((t) => t.table) ?? (await exposedTables(target))
    reads = await anonReads(target, names.length ? names : migrationTables(root))
  }
  if (!tables && !reads.length)
    throw new Error(
      'Nothing to test: the public key (*_SUPABASE_ANON_KEY or *_SUPABASE_PUBLISHABLE_KEY) is missing from .env and there is no SQL access. For the full test, set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens) or run the SQL from "faundr db-test --sql" through the Supabase MCP and import it with --result <file>.',
    )

  const findings = dbFindings({ reads, tables })
  console.log(dbSummary({ target: target ?? { ref }, reads, tables, findings }))
  if (!tables)
    console.log(
      '\nWriting, changing and deleting were not tested. For that: set SUPABASE_ACCESS_TOKEN, or run the SQL from "faundr db-test --sql" through the Supabase MCP (execute_sql), save the answer to a file and run "faundr db-test --result <file>".',
    )
  fs.writeFileSync(
    ensureFaundrPath(root, 'dbTest'),
    JSON.stringify({ at: new Date().toISOString(), ref: ref ?? null, how, tables: new Set([...reads.map((r) => r.table), ...(tables ?? []).map((t) => t.table)]).size, full: !!tables, open: findings.length }, null, 1),
  )
  if (args.includes('--no-send')) return
  // O teste completo substitui o só de leitura; o só de leitura não fecha o que o completo achou.
  if (tables) {
    await sendImport('faundr-banco', findings)
    await securityApi({ action: 'report', tool: 'faundr-banco-api', scopes: [], findings: [] }).catch(() => {
      // Limpar o resultado antigo só de leitura é extra: o teste completo já foi enviado logo acima.
    })
  } else await sendImport('faundr-banco-api', findings)
}

// "Pronto para lançar?": o que só o computador confere. O painel junta com segurança, erros, testes e Stack.
const LAUNCH_TEXT = { ok: 'ok', falta: 'missing', aviso: 'warning', na: 'not applicable', 'nao-verificado': 'not checked' }
const LAUNCH_NAME = {
  compila: 'The code builds',
  testes: 'Tests passing',
  segredos: 'No exposed keys or passwords',
  'seguranca-critica': 'No critical security problems',
  'seguranca-alta': 'No high security problems',
  'banco-testado': 'Database tested as a visitor',
  'webhook-pagamento': 'Payment webhook checks the signature',
  cabecalhos: 'Site security headers',
  'limite-pedidos': 'Rate limit on the routes',
  privacidade: 'Privacy policy',
  'plano-recuperacao': 'Recovery plan',
  'backup-automatico': 'Automatic database backup',
}

// LGPD: que dados pessoais o app coleta, para quais empresas vão e o que falta (política, termos, cookies, exclusão).
const LGPD_NAME = {
  'lgpd-privacidade': 'Privacy policy',
  'lgpd-termos': 'Terms of use',
  'lgpd-cookies': 'Cookie consent',
  'lgpd-exclusao': 'Delete the account and the data',
  'lgpd-sensiveis': 'Sensitive data',
  'lgpd-terceiros': 'Companies that receive the data',
}

export async function privacyCommand(args) {
  const { root, projectId, config } = linkedProject()
  const { files } = projectFiles(root)
  const r = privacyScan(root, files)
  if (!args.includes('--quiet')) {
    console.log(r.data.length ? 'Personal data the app collects:' : 'Found no collection of personal data (forms, database or login).')
    for (const d of r.data) console.log(`  - ${d.category}${d.sensitive ? ' (SENSITIVE)' : ''}: ${d.where.join('; ')}`)
    if (r.thirdParties.length) {
      console.log('Companies that receive data:')
      for (const tp of r.thirdParties) console.log(`  - ${tp.name}${tp.kind === 'rastreador' ? ' [tracker]' : ''}: ${tp.what}${tp.cookies ? '; uses cookies' : ''}`)
    }
    console.log('')
    for (const c of r.checks) console.log(`[${LAUNCH_TEXT[c.status]}] ${LGPD_NAME[c.key]}: ${c.detail}`)
  }
  if (args.includes('--no-send')) return
  const inventory = t(`${r.data.length} kind(s) of personal data, ${r.thirdParties.length} company(ies)`, `${r.data.length} tipo(s) de dado pessoal, ${r.thirdParties.length} empresa(s)`)
  const checks = [...r.checks, { key: 'lgpd-inventario', status: 'ok', detail: inventory, data: { data: r.data, thirdParties: r.thirdParties, auth: r.auth } }]
  const res = await fetch(`${config.apiUrl}/api/cli/launch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ projectId, action: 'report', checks }),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  if (!args.includes('--quiet')) console.log('\nOn the dashboard: Launch → LGPD. For drafts of the policy, terms and cookie notice: /faundr:privacy')
}

export async function launchCheck(args) {
  const { root, projectId, config } = linkedProject()
  const { files } = projectFiles(root)
  // Backups pela API de gestão do Supabase, com o token pessoal (que fica só neste computador).
  const supabase = { ref: flag(args, '--ref') ?? supabaseTarget(root)?.ref ?? null, token: process.env.SUPABASE_ACCESS_TOKEN ?? null }
  const send = !args.includes('--no-send')
  // O código: compila, testes e segurança rodam agora, para o veredito não depender de uma rodada antiga.
  const code = args.includes('--skip-code') ? [] : await launchCodeChecks(root, send)
  const checks = await launchChecks(root, files, { ...(flag(args, '--url') ? { url: flag(args, '--url') } : {}), supabase })
  const items = [...code, ...checks]
  for (const c of items) console.log(`[${LAUNCH_TEXT[c.status]}] ${LAUNCH_NAME[c.key]}: ${c.detail}`)
  if (send) {
    const res = await fetch(`${config.apiUrl}/api/cli/launch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ projectId, action: 'report', checks: items.filter((c) => !PANEL_OWNED.has(c.key)) }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? `API error (${res.status})`)
  }
  printLaunchVerdict(launchVerdict(items), code.length > 0)
  if (send) console.log('\nThe full checklist (with errors, Project stack and backup) is on the dashboard: Launch → Ready to launch?')
}

// Itens que o painel já monta com os próprios dados (segurança e testes): não vão no relatório.
const PANEL_OWNED = new Set(['testes', 'segredos', 'seguranca-critica', 'seguranca-alta'])

async function launchCodeChecks(root, send) {
  console.log('Checking the code (build, tests and security)…')
  const build = checkBuild(root)
  // tests-run e security-scan sempre gravam no painel: com --no-send, os testes ficam de fora e a segurança
  // vem da última checagem (a lista do painel já tira o que o dono ignorou).
  let tests = { key: 'testes', status: 'nao-verificado', detail: 'Not run with --no-send.' }
  if (send) {
    try {
      tests = testsVerdict(await testsRun([]))
    } catch (e) {
      tests = { key: 'testes', status: 'aviso', detail: `Tests did not run: ${e.message}` }
    }
    await securityScan(['--quiet'])
  }
  const security = securityItems((await securityApi({ action: 'list' })).findings)
  console.log('')
  return [build, tests, ...security]
}

// Testes no veredito: falha = falta; nenhuma rodada (sem executor, banco de produção, não terminou) = aviso.
function testsVerdict(runs) {
  const key = 'testes'
  if (!runs?.length) return { key, status: 'aviso', detail: 'No tests ran: nothing guarantees that what worked still works.' }
  const failed = runs.reduce((n, r) => n + (r.failed ?? 0), 0)
  const passed = runs.reduce((n, r) => n + (r.passed ?? 0), 0)
  const stuck = runs.find((r) => r.error)
  if (failed) return { key, status: 'falta', detail: `${failed} test(s) failing.` }
  if (stuck) return { key, status: 'aviso', detail: `${stuck.runner} did not finish: ${stuck.error}` }
  return { key, status: 'ok', detail: `${passed} test(s) passed.` }
}

function printLaunchVerdict({ canLaunch, blockers, before }, codeChecked) {
  const line = (i) => `  - ${LAUNCH_NAME[i.key]}: ${i.detail}`
  console.log('')
  if (!canLaunch) console.log(`CAN LAUNCH: NO. ${blockers.length} item(s) block the launch:\n${blockers.map(line).join('\n')}`)
  else console.log(`CAN LAUNCH: YES.${before.length ? '' : ' Ready for real users.'}`)
  if (before.length) console.log(`${canLaunch ? 'Nothing blocks the launch; before' : 'Before'} real users, ${before.length} item(s) left:\n${before.map(line).join('\n')}`)
  if (!codeChecked) console.log('(Build, tests and security were not run: --skip-code.)')
}
