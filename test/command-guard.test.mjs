import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { classifyCommand, guardMessage, isReadOnly } from '../bin/command-guard.mjs'

const cwd = path.join(os.homedir(), 'projetos', 'loja')
const level = (cmd, opts = {}) => classifyCommand(cmd, { cwd, ...opts })?.level ?? null

test('catástrofes são barradas', () => {
  for (const cmd of [
    'rm -rf /',
    'rm -rf ~',
    'rm -rf ~/',
    'rm -rf $HOME',
    'sudo rm -rf --no-preserve-root /',
    'rm -rf *',
    'rm -rf .',
    `rm -rf ${cwd}`,
    `rm -fr ${os.homedir()}`,
    'Remove-Item -Recurse -Force C:\\',
    `Remove-Item -Recurse -Force ${os.homedir()}`,
    'rd /s /q C:\\',
    'mkfs.ext4 /dev/sda1',
    'dd if=/dev/zero of=/dev/sda bs=1M',
    'supabase db reset --linked',
  ])
    assert.equal(level(cmd), 'deny', cmd)
})

test('arriscados pedem confirmação ao usuário', () => {
  for (const cmd of [
    'git push --force origin main',
    'git push -f',
    'git push origin +main',
    'git reset --hard HEAD~3',
    'git clean -fd',
    'git checkout -- .',
    'git restore .',
    'git stash clear',
    'git branch -D feature/x',
    'cd app && git reset --hard',
    'supabase db reset',
    'npx supabase db push',
    'npx prisma migrate reset',
    'npx prisma db push --accept-data-loss',
    'psql "$DATABASE_URL" -c "DROP TABLE users"',
    'psql -c "delete from orders"',
    'psql -c "update users set plan = \'free\'"',
    'echo "TRUNCATE orders;" | psql',
    'node -e "db.query(\'drop table pedidos\')"',
    'redis-cli FLUSHALL',
    'rm -rf /etc/nginx',
    'rm -rf ../outro-projeto',
  ])
    assert.equal(level(cmd), 'ask', cmd)
})

test('comandos do dia a dia passam', () => {
  for (const cmd of [
    'rm -rf node_modules dist',
    'rm -rf ./build',
    `rm -rf ${cwd}/dist`,
    `rm -rf ${path.join(os.tmpdir(), 'x')}`,
    'rm arquivo.txt',
    'git push origin main',
    'git push -u origin feature-flags',
    'git restore --staged .',
    'git reset HEAD~1',
    'git commit -m "remove drop table velho"',
    'grep -rn "DROP TABLE" supabase/',
    'rg "delete from users"',
    'cat > supabase/migrations/0042.sql <<EOF\ndrop table if exists tmp;\nEOF',
    'psql -c "delete from orders where id = 1"',
    'psql -c "update users set plan = \'pro\' where id = 2"',
    'npm run build',
    'npx supabase db diff',
    'supabase migration new pedidos',
    'truncate -s 0 log.txt',
  ])
    assert.equal(level(cmd), null, cmd)
})

test('SQL das ferramentas de banco (MCP)', () => {
  assert.equal(level('drop table pedidos;', { sql: true }), 'ask')
  assert.equal(level('alter table users drop column email;', { sql: true }), 'ask')
  assert.equal(level('delete from users where id = 1', { sql: true }), null)
  assert.equal(level('create table x (id int); drop policy "a" on x;', { sql: true }), null)
  assert.equal(level('select * from users', { sql: true }), null)
})

test('só leitura não precisa de ponto de volta', () => {
  for (const cmd of ['ls -la', 'git status', 'git log --oneline -5 && git diff', 'cat a.txt | grep x', 'sed -n 1,20p a.ts', 'find . -name "*.ts"', 'node --version'])
    assert.equal(isReadOnly(cmd), true, cmd)
  for (const cmd of ['npm install', 'sed -i s/a/b/ a.ts', 'echo x > a.txt', 'git commit -m x', 'find . -name "*.log" -delete', 'python script.py'])
    assert.equal(isReadOnly(cmd), false, cmd)
})

test('mensagens em português simples', () => {
  const ask = classifyCommand('git reset --hard', { cwd })
  assert.match(guardMessage(ask, { checkpoint: { n: 1 } }), /ponto de volta.*\/faundr:undo/)
  const db = classifyCommand('supabase db push', { cwd })
  assert.match(guardMessage(db, {}), /não os dados do banco/)
  const deny = classifyCommand('rm -rf ~', { cwd })
  assert.match(guardMessage(deny, { command: 'rm -rf ~' }), /Barrado.*ele mesmo roda/)
})
