import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destructiveMigration } from '../bin/security.mjs'

const MIG = 'supabase/migrations/0090_x.sql'

test('migração que apaga, esvazia ou troca tipo é avisada, com o que cada uma faz', () => {
  assert.deepEqual(destructiveMigration('drop table public.notas;', MIG), ['deletes a whole table'])
  assert.deepEqual(destructiveMigration('alter table public.perfis drop column cpf;', MIG), ['deletes a column'])
  assert.deepEqual(destructiveMigration('truncate public.logs;', MIG), ['empties a table'])
  assert.deepEqual(destructiveMigration('delete from public.pedidos;', MIG), ['deletes every row (delete without where)'])
  assert.deepEqual(destructiveMigration("update public.pedidos set status = 'pago';", MIG), ['changes every row (update without where)'])
  assert.deepEqual(destructiveMigration('alter table public.p alter column preco type integer;', MIG), ['changes a column type (may lose or truncate data)'])
  assert.deepEqual(destructiveMigration('alter table public.p rename column nome to titulo;', MIG), ['renames a table or column (the live app still uses the old name)'])
})

test('migração que só cria, filtra com where ou tira regra não é avisada', () => {
  const safe = [
    'create table public.notas (id uuid primary key);',
    'alter table public.notas add column texto text;',
    "delete from public.pedidos where status = 'teste';",
    "update public.pedidos set status = 'pago' where id = 1;",
    'alter table public.notas drop constraint notas_texto_check;',
    'alter table public.notas alter column texto drop not null;',
    'drop policy "own rows" on public.notas;',
    '-- drop table public.notas; (só comentário)',
  ].join('\n')
  assert.deepEqual(destructiveMigration(safe, MIG), [])
})

test('fora de pasta de migração, SQL destrutivo não é avisado', () => {
  assert.deepEqual(destructiveMigration('drop table public.notas;', 'scripts/limpar.sql'), [])
  assert.deepEqual(destructiveMigration('drop table x;', 'prisma/migrations/20260101_x/migration.sql'), ['deletes a whole table'])
})
