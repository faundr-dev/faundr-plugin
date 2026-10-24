import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setLang } from '../bin/i18n.mjs'
import { checkBackups, checkRecoveryPlan } from '../bin/launch.mjs'

setLang('pt')

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-rp-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return { dir, files: Object.keys(files) }
}

test('sem plano de recuperação: falta', () => {
  const { dir, files } = project({ 'README.md': '# App' })
  assert.equal(checkRecoveryPlan(dir, files).status, 'falta')
})

test('plano que não fala de LGPD nem de site fora do ar: aviso dizendo o que falta', () => {
  const { dir, files } = project({ 'docs/plano-de-recuperacao.md': '# Plano\n## Chave vazada\n## Backup do banco\n## Conta invadida\n' })
  const r = checkRecoveryPlan(dir, files)
  assert.equal(r.status, 'aviso')
  assert.match(r.detail, /site fora do ar, aviso pela LGPD/)
  setLang('en')
  assert.match(checkRecoveryPlan(dir, files).detail, /does not cover: site down, breach notice under privacy law/)
  setLang('pt')
})

test('plano escrito em inglês também conta', () => {
  const plan = '## Leaked secret\n## Database backup\n## Hacked account\n## Outage: rollback the deploy\n## GDPR breach notice\n'
  const { dir, files } = project({ 'docs/recovery-plan.md': plan })
  assert.equal(checkRecoveryPlan(dir, files).status, 'ok')
})

test('plano completo: ok', () => {
  const plan = '## Chave vazada\n## Banco: restaurar backup\n## Conta invadida\n## Site fora do ar: voltar o deploy\n## LGPD: avisar a ANPD\n'
  const { dir, files } = project({ 'docs/plano-de-recuperacao.md': plan })
  assert.equal(checkRecoveryPlan(dir, files).status, 'ok')
})

const NOW = Date.parse('2026-10-23T12:00:00Z')
const reply = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 401, json: async () => body })

test('backup: sem Supabase não se aplica; sem token não verificado', async () => {
  assert.equal((await checkBackups(null, 'x')).status, 'na')
  assert.equal((await checkBackups('ref', null)).status, 'nao-verificado')
})

test('backup: plano grátis sem backups falta; backup contínuo ok; último de ontem ok; de 5 dias aviso', async () => {
  assert.equal((await checkBackups('ref', 't', { fetchImpl: reply({ pitr_enabled: false, backups: [] }), now: NOW })).status, 'falta')
  assert.equal((await checkBackups('ref', 't', { fetchImpl: reply({ pitr_enabled: true, backups: [] }), now: NOW })).status, 'ok')
  const yesterday = { pitr_enabled: false, backups: [{ status: 'COMPLETED', inserted_at: '2026-10-22T03:00:00Z' }] }
  assert.equal((await checkBackups('ref', 't', { fetchImpl: reply(yesterday), now: NOW })).status, 'ok')
  const old = { pitr_enabled: false, backups: [{ status: 'COMPLETED', inserted_at: '2026-10-18T03:00:00Z' }] }
  const r = await checkBackups('ref', 't', { fetchImpl: reply(old), now: NOW })
  assert.equal(r.status, 'aviso')
  assert.match(r.detail, /há 5 dias/)
})

test('backup: token recusado não vira "falta"', async () => {
  assert.equal((await checkBackups('ref', 't', { fetchImpl: reply({}, false), now: NOW })).status, 'nao-verificado')
})
