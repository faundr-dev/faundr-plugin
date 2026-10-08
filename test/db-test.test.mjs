import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { anonReads, dbFindings, migrationTables, parseProbe, PROBE_SQL, supabaseTarget } from '../bin/db-test.mjs'

const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-dbtest-'))
const KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.assinatura-de-mentira'

test('acha a URL e a chave pública nos .env', () => {
  const d = dir()
  fs.writeFileSync(path.join(d, '.env.local'), `# comentário\nVITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co/"\nVITE_SUPABASE_ANON_KEY=${KEY}\n`)
  const t = supabaseTarget(d)
  assert.equal(t.url, 'https://abcdefghijklmnopqrst.supabase.co')
  assert.equal(t.ref, 'abcdefghijklmnopqrst')
  assert.equal(t.key, KEY)
  assert.equal(supabaseTarget(dir()), null)
})

test('tabelas das migrações (criadas menos apagadas)', () => {
  const d = dir()
  fs.mkdirSync(path.join(d, 'supabase/migrations'), { recursive: true })
  fs.writeFileSync(path.join(d, 'supabase/migrations/1.sql'), 'create table public.posts (id int);\ncreate table if not exists "perfis" (id int);\ncreate table velha (id int);')
  fs.writeFileSync(path.join(d, 'supabase/migrations/2.sql'), 'drop table if exists velha;')
  assert.deepEqual(migrationTables(d).sort(), ['perfis', 'posts'])
})

test('leitura como visitante: conta o que a chave pública vê e aponta colunas pessoais', async () => {
  const seen = []
  const fetchImpl = async (url, opts) => {
    seen.push(opts.headers)
    if (url.includes('/clientes?'))
      return new Response(JSON.stringify([{ id: 1, nome: 'a', email: 'x' }]), { status: 200, headers: { 'content-range': '0-0/42' } })
    if (url.includes('/pedidos?')) return new Response('[]', { status: 200, headers: { 'content-range': '*/0' } })
    return new Response('{"code":"42501"}', { status: 401 })
  }
  const reads = await anonReads({ url: 'https://x.supabase.co', key: KEY }, ['clientes', 'pedidos', 'segredos'], { fetchImpl })
  assert.deepEqual(
    reads.map((r) => [r.table, r.status, r.visible]),
    [
      ['clientes', 200, 42],
      ['pedidos', 200, 0],
      ['segredos', 401, 0],
    ],
  )
  assert.deepEqual(reads[0].sensitive, ['email'])
  assert.equal(seen[0].authorization, `Bearer ${KEY}`)
  await anonReads({ url: 'https://x.supabase.co', key: 'sb_publishable_123456789012345678901' }, ['a'], { fetchImpl })
  assert.equal(seen.at(-1).authorization, undefined, 'chave nova vai só no apikey')
})

test('achados: porta aberta vira problema; tabela protegida não', () => {
  const findings = dbFindings({
    reads: [{ table: 'clientes', status: 200, visible: 42, columns: ['id', 'email'], sensitive: ['email'] }],
    tables: [
      { table: 'clientes', kind: 'r', rls: false, rows: 42, policies: [], anon: { select: 42, insert: 'ok', update: 1, delete: 1 }, user: { select: 42, update: 1, delete: 1 } },
      { table: 'tarefas', kind: 'r', rls: true, rows: 5, policies: [], anon: { select: 0, insert: '42501', update: 0, delete: 0 }, user: { select: 5, update: 0, delete: 0 } },
      { table: 'cofre', kind: 'r', rls: true, rows: 3, policies: [], anon: { select: 0, insert: '42501', update: 0, delete: 0 }, user: { select: 0, update: 0, delete: 0 } },
      { table: 'novos', kind: 'r', rls: true, rows: 0, policies: [{ roles: ['anon'], cmd: 'a', using: null, check: 'true' }], anon: { select: 0, insert: '23502', update: 0, delete: 0 }, user: { select: 0, update: 0, delete: 0 } },
      { table: 'resumo', kind: 'v', rls: false, rows: 3, policies: [], anon: { select: 3 }, user: { select: 3 } },
    ],
  })
  const kinds = findings.map((f) => f.fingerprint).sort()
  assert.deepEqual(kinds, [
    'clientes|anon-altera',
    'clientes|anon-apaga',
    'clientes|anon-grava',
    'clientes|anon-le',
    'clientes|user-altera',
    'clientes|user-apaga',
    'novos|anon-grava',
    'novos|vazia-aberta',
    'resumo|anon-le',
    'tarefas|user-le',
  ])
  const le = findings.find((f) => f.fingerprint === 'clientes|anon-le')
  assert.equal(le.severity, 'critical', 'coluna pessoal exposta')
  assert.match(le.title, /42 linhas/)
  assert.match(findings.find((f) => f.fingerprint === 'resumo|anon-le').fix, /security_invoker/)
  assert.ok(findings.every((f) => f.source === 'database'))
})

test('lê o resultado do SQL pela API de gestão ou pelo texto do MCP', () => {
  const rows = [{ table: 'a', kind: 'r', anon: {}, user: {} }]
  assert.deepEqual(parseProbe([{ result: rows }]), rows)
  assert.deepEqual(parseProbe([{ result: JSON.stringify(rows) }]), rows)
  assert.deepEqual(parseProbe(`Below is the result...\n<untrusted-data-1>\n${JSON.stringify([{ result: rows }])}\n</untrusted-data-1>\nUse this data`), rows)
  assert.throws(() => parseProbe({ nada: 1 }))
})

test('o SQL sempre desfaz: cada tentativa termina com faundr-volta', () => {
  const tries = PROBE_SQL.match(/perform pg_temp\.faundr_as/g).length
  const rollbacks = PROBE_SQL.match(/raise exception 'faundr-volta'/g).length
  assert.equal(tries, rollbacks)
  assert.doesNotMatch(PROBE_SQL, /\bcommit\b/i)
  assert.match(PROBE_SQL, /limit 1\)\)/, 'altera e apaga no máximo 1 linha')
})
