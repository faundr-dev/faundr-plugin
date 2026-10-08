import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { changesDatabase, remoteDatabaseFindings, remoteDatabases, remoteNote } from '../bin/env-target.mjs'

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-env-'))
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, name), text)
  return root
}

test('banco local não preocupa; banco na nuvem sim, e sem mostrar senha', () => {
  assert.deepEqual(remoteDatabases(project({ '.env': 'DATABASE_URL=postgresql://postgres:segredo@127.0.0.1:54322/postgres\nSUPABASE_URL=http://localhost:54321\n' })), [])
  assert.deepEqual(remoteDatabases(project({ '.env': 'DATABASE_URL="file:./dev.db"\nREDIS_URL=redis://redis:6379\n' })), [])
  const dbs = remoteDatabases(project({ '.env.local': 'NEXT_PUBLIC_SUPABASE_URL=https://abcd.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=eyJsegredo\n' }))
  assert.deepEqual(dbs, [{ file: '.env.local', name: 'NEXT_PUBLIC_SUPABASE_URL', host: 'abcd.supabase.co', sameAsProduction: false }])
  assert.doesNotMatch(JSON.stringify(dbs), /segredo/)
})

test('mesmo servidor do .env de produção ou da configuração do deploy = banco de produção', () => {
  const root = project({
    '.env': 'DATABASE_URL=postgres://u:senha@db.prod.neon.tech/app\n',
    '.env.production': 'DATABASE_URL=postgres://u:outra@db.prod.neon.tech/app\n',
  })
  const [d] = remoteDatabases(root)
  assert.equal(d.sameAsProduction, true)
  assert.match(remoteNote([d]), /o mesmo banco do app no ar/)
  const [f] = remoteDatabaseFindings(root)
  assert.equal(f.severity, 'high')
  assert.equal(f.rule_id, 'local-env-remote-db')
  assert.doesNotMatch(JSON.stringify(f), /senha|outra/)
  const viaConfig = project({ '.dev.vars': 'SUPABASE_URL=https://xyz.supabase.co\n', 'wrangler.jsonc': '{ "vars": { "SUPABASE_URL": "https://xyz.supabase.co" } }' })
  assert.equal(remoteDatabases(viaConfig)[0].sameAsProduction, true)
})

test('comandos que mudam o banco', () => {
  for (const cmd of ['npx prisma migrate dev', 'npx prisma db seed', 'npx drizzle-kit migrate', 'npm run db:reset', 'pnpm migrate', 'yarn seed', 'python manage.py migrate', 'alembic upgrade head', 'node scripts/seed.js', 'npx tsx db/migrate.ts'])
    assert.equal(changesDatabase(cmd), true, cmd)
  for (const cmd of ['npm run build', 'npx prisma generate', 'npx prisma studio', 'npm test', 'supabase migration new pedidos'])
    assert.equal(changesDatabase(cmd), false, cmd)
})
