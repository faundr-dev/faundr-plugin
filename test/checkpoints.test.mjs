import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { changesSince, createCheckpoint, ensureSessionCheckpoint, findCheckpoint, listCheckpoints, restoreCheckpoint } from '../bin/checkpoints.mjs'

const git = (root, ...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cp-'))
  git(root, 'init', '-q')
  git(root, 'config', 'user.email', 't@t')
  git(root, 'config', 'user.name', 't')
  fs.writeFileSync(path.join(root, '.gitignore'), '.env\n')
  fs.writeFileSync(path.join(root, 'a.txt'), 'um\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'inicio')
  return root
}

const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8')

test('ponto de volta guarda os arquivos sem mexer no git do usuário', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'a.txt'), 'dois\n')
  fs.writeFileSync(path.join(root, 'novo.txt'), 'novo\n')
  const status = git(root, 'status', '--porcelain').stdout
  const c = createCheckpoint(root, { reason: 'teste', session: 's1' })
  assert.equal(c.created, true)
  assert.equal(git(root, 'status', '--porcelain').stdout, status, 'índice e arquivos intactos')
  assert.equal(git(root, 'stash', 'list').stdout, '')
  const [only] = listCheckpoints(root)
  assert.equal(only.reason, 'teste')
  assert.equal(only.session, 's1')
  // Sem mudança: não cria outro.
  assert.equal(createCheckpoint(root, { reason: 'de novo' }).created, false)
  assert.equal(listCheckpoints(root).length, 1)
})

test('voltar desfaz edições, apaga o que foi criado depois, traz o apagado e pode ser desfeito', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'b.txt'), 'b original\n')
  fs.writeFileSync(path.join(root, '.env'), 'SEGREDO=1\n')
  const c = createCheckpoint(root, { reason: 'antes' })
  fs.writeFileSync(path.join(root, 'a.txt'), 'quebrado\n')
  fs.rmSync(path.join(root, 'b.txt'))
  fs.mkdirSync(path.join(root, 'pasta'))
  fs.writeFileSync(path.join(root, 'pasta', 'c.txt'), 'criado depois\n')
  fs.writeFileSync(path.join(root, '.env'), 'SEGREDO=2\n')

  const changes = changesSince(root, c)
  assert.deepEqual(changes.map((x) => `${x.status}:${x.path}`).sort(), ['alterado:a.txt', 'apagado:b.txt', 'criado:pasta/c.txt'])

  const r = restoreCheckpoint(root, c)
  assert.equal(read(root, 'a.txt'), 'um\n')
  assert.equal(read(root, 'b.txt'), 'b original\n')
  assert.equal(fs.existsSync(path.join(root, 'pasta')), false, 'pasta vazia some')
  assert.equal(read(root, '.env'), 'SEGREDO=2\n', '.env (ignorado) não muda')
  assert.deepEqual(changesSince(root, c), [])

  // Desfazer a volta: o estado salvo antes é o mais novo.
  assert.equal(findCheckpoint(root, '1').ref, r.saved.ref)
  restoreCheckpoint(root, findCheckpoint(root, '1'))
  assert.equal(read(root, 'a.txt'), 'quebrado\n')
  assert.equal(read(root, 'pasta/c.txt'), 'criado depois\n')
  assert.equal(fs.existsSync(path.join(root, 'b.txt')), false)
})

test('um por sessão, de novo depois de 30 min, só com git', () => {
  const root = repo()
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cfg-'))
  const t0 = Date.now()
  fs.writeFileSync(path.join(root, 'a.txt'), 'x\n')
  assert.ok(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 }))
  fs.writeFileSync(path.join(root, 'a.txt'), 'y\n')
  assert.equal(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 + 60_000 }), null)
  assert.ok(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 + 31 * 60_000 }))
  assert.equal(listCheckpoints(root).length, 2)
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-nogit-'))
  assert.equal(ensureSessionCheckpoint(plain, 's2', { configDir }), null)
})

test('repositório sem nenhum commit também funciona', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cp0-'))
  git(root, 'init', '-q')
  fs.writeFileSync(path.join(root, 'a.txt'), '1\n')
  const c = createCheckpoint(root, { reason: 'zero' })
  fs.writeFileSync(path.join(root, 'a.txt'), '2\n')
  restoreCheckpoint(root, c)
  assert.equal(read(root, 'a.txt'), '1\n')
})
