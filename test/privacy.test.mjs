import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { privacyScan } from '../bin/privacy.mjs'

function project(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-lgpd-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true })
    fs.writeFileSync(path.join(d, rel), text)
  }
  return [d, Object.keys(files)]
}
const check = (r, key) => r.checks.find((c) => c.key === key)

test('dados pessoais: telas, banco e login; "name" só em tabela de pessoas', () => {
  const [d, files] = project({
    'src/Cadastro.tsx': '<input name="cpf" /><input type="tel" /><input autoComplete="street-address" /><input {...register("nascimento")} />',
    'supabase/migrations/1.sql': 'create table public.pacientes (\n  id uuid primary key,\n  name text,\n  diagnostico text,\n  fingerprint text\n);\ncreate table public.produtos (\n  id uuid primary key,\n  name text\n);\n',
    'src/auth.ts': 'await supabase.auth.signUp({ email, password })',
    'package.json': '{"dependencies":{"@supabase/supabase-js":"2"}}',
  })
  const r = privacyScan(d, files)
  const cats = Object.fromEntries(r.data.map((x) => [x.category, x]))
  for (const c of ['CPF ou documento', 'Telefone', 'Endereço', 'Data de nascimento ou idade', 'E-mail', 'Nome', 'Saúde']) assert.ok(cats[c], c)
  assert.deepEqual(cats.Nome.where, ['banco pacientes.name'], 'produtos.name não é pessoa')
  assert.equal(cats['Saúde'].sensitive, true)
  assert.equal(cats['Biometria ou dado genético'], undefined, 'fingerprint de achado não é biometria')
  assert.equal(r.data[0].sensitive, true, 'sensíveis primeiro')
  assert.equal(check(r, 'lgpd-sensiveis').status, 'aviso')
  assert.equal(check(r, 'lgpd-exclusao').status, 'falta')
  assert.equal(check(r, 'lgpd-privacidade').status, 'falta')
})

test('rastreador com cookies sem consentimento = falta; com banner = ok; sem rastreador = não se aplica', () => {
  let [d, files] = project({ 'index.html': '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>', 'package.json': '{"dependencies":{"openai":"4"}}' })
  let r = privacyScan(d, files)
  assert.equal(check(r, 'lgpd-cookies').status, 'falta')
  assert.deepEqual(r.thirdParties.map((t) => t.name).sort(), ['Google Analytics / Tag Manager', 'OpenAI (IA)'])
  assert.equal(check(r, 'lgpd-terceiros').status, 'aviso', 'empresa fora do Brasil sem política')
  ;[d, files] = project({ 'index.html': '<script src="https://www.googletagmanager.com/gtag/js"></script>', 'package.json': '{"dependencies":{"vanilla-cookieconsent":"3"}}' })
  assert.equal(check(privacyScan(d, files), 'lgpd-cookies').status, 'ok')
  ;[d, files] = project({ 'package.json': '{"dependencies":{"@vercel/analytics":"1"}}' })
  assert.equal(check(privacyScan(d, files), 'lgpd-cookies').status, 'na', 'analytics sem cookies')
})

test('termos, política e exclusão de conta encontrados', () => {
  const [d, files] = project({
    'src/routes/termos.tsx': 'export default () => null',
    'src/routes/privacidade.tsx': 'export default () => null',
    'src/auth.ts': 'supabase.auth.signInWithPassword({ email, password })',
    'src/Conta.tsx': '<button>Excluir minha conta</button>',
  })
  const r = privacyScan(d, files)
  assert.equal(check(r, 'lgpd-termos').status, 'ok')
  assert.equal(check(r, 'lgpd-privacidade').status, 'ok')
  assert.equal(check(r, 'lgpd-exclusao').status, 'ok')
})
