import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { closeMesa, listMesas, mesaSlug, openMesa, readyStages } from '../bin/parallel.mjs'

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim()
}

function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-mesa-'))
  git(d, 'init', '-q', '-b', 'main')
  git(d, 'config', 'user.email', 't@t')
  git(d, 'config', 'user.name', 't')
  fs.writeFileSync(path.join(d, 'package.json'), '{}')
  fs.writeFileSync(path.join(d, '.gitignore'), 'node_modules/\n.faundr/\n')
  fs.mkdirSync(path.join(d, 'node_modules', 'pacote'), { recursive: true })
  fs.writeFileSync(path.join(d, 'node_modules', 'pacote', 'index.js'), 'ok')
  git(d, 'add', '.')
  git(d, 'commit', '-q', '-m', 'início')
  return d
}

test('nome da mesa: sem acento, minúsculo, com hífen e curto', () => {
  assert.equal(mesaSlug('Login com Google e cobrança'), 'login-com-google-e-cobranca')
  assert.equal(mesaSlug('!!!'), 'etapa')
  assert.ok(mesaSlug('a'.repeat(80)).length <= 40)
})

test('etapas prontas: planejadas e com a anterior terminada; a que espera outra etapa aberta fica de fora', () => {
  const f = (id, o) => ({ id, title: id, after: null, finished: false, planned: false, tasks: [], ...o })
  const ready = readyStages([
    f('mvp', { finished: true }),
    f('outra', { finished: true }),
    f('login', { after: 'mvp', planned: true, tasks: [{ title: 'tela de login' }] }),
    f('cobranca', { after: 'outra', planned: true }),
    f('relatorios', { after: 'login', planned: true }),
    f('feito', { after: 'mvp', planned: true, finished: true }),
    f('comecada', { after: 'mvp', planned: false }),
    f('solta', { planned: false }),
  ])
  assert.deepEqual(
    ready.map((s) => [s.title, s.after]),
    [
      ['login', 'mvp'],
      ['cobranca', 'outra'],
    ],
    'relatórios espera o login; feita, começada e solta ficam de fora',
  )
  assert.deepEqual(ready[0].tasks, ['tela de login'])
})

test('mesa: abre na branch mesa/<nome> com os pacotes emprestados; fecha sem apagar os pacotes de verdade', () => {
  const d = repo()
  const m = openMesa(d, 'Login com Google')
  assert.equal(m.branch, 'mesa/login-com-google')
  assert.ok(fs.existsSync(path.join(m.dir, 'package.json')))
  assert.equal(fs.readFileSync(path.join(m.dir, 'node_modules', 'pacote', 'index.js'), 'utf8'), 'ok')
  assert.deepEqual(listMesas(d).map((x) => x.slug), ['login-com-google'])
  assert.equal(openMesa(d, 'Login com Google').existed, true, 'abrir de novo usa a mesma')

  fs.writeFileSync(path.join(m.dir, 'login.js'), 'feito')
  git(m.dir, 'add', 'login.js')
  git(m.dir, 'commit', '-q', '-m', 'login')
  assert.deepEqual(closeMesa(d, 'login-com-google').branchKept, 'mesa/login-com-google', 'não juntada: a branch fica')
  assert.ok(fs.existsSync(path.join(d, 'node_modules', 'pacote', 'index.js')), 'os pacotes da pasta principal continuam lá')
  assert.deepEqual(listMesas(d), [])

  git(d, 'merge', '-q', '--no-ff', 'mesa/login-com-google', '-m', 'junta')
  const again = openMesa(d, 'Outra')
  assert.equal(closeMesa(d, 'outra').branchKept, null, 'sem nada novo: a branch some')
  assert.ok(!fs.existsSync(again.dir))
})

test('mesa: não abre com mudança sem commit no projeto', () => {
  const d = repo()
  fs.writeFileSync(path.join(d, 'package.json'), '{"x":1}')
  assert.throws(() => openMesa(d, 'X'), /uncommitted/)
})
