import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkBuilt, newOffPlan, offPlan, pathMatcher, readIgnore } from '../bin/architecture.mjs'

const files = ['src/routes/agenda/index.tsx', 'src/routes/agenda/dia.tsx', 'src/lib/horarios.ts', 'supabase/migrations/0001_agenda.sql', 'package.json']

test('caminhos: pasta, curinga e arquivo', () => {
  assert.equal(pathMatcher('src/routes/agenda/**')('src/routes/agenda/index.tsx'), true)
  assert.equal(pathMatcher('src/routes/agenda')('src/routes/agenda/dia.tsx'), true)
  assert.equal(pathMatcher('src/routes/agenda')('src/routes/agendamento.tsx'), false)
  assert.equal(pathMatcher('src/*.ts')('src/lib/horarios.ts'), false)
  assert.equal(pathMatcher('src/**/*.ts')('src/lib/horarios.ts'), true)
  assert.equal(pathMatcher('**/migrations/*.sql')('supabase/migrations/0001_agenda.sql'), true)
  assert.equal(pathMatcher('./src/lib/horarios.ts')('src/lib/horarios.ts'), true)
})

test('cada peça com paths vira existe ou não existe, com a conta de arquivos', () => {
  const spec = {
    nodes: [
      { id: 'agenda', paths: ['src/routes/agenda/**'] },
      { id: 'horarios', paths: ['src/lib/horarios.ts', 'src/server/horarios.ts'] },
      { id: 'link', paths: ['src/routes/marcar/**'] },
      { id: 'cliente' },
    ],
  }
  assert.deepEqual(checkBuilt(spec, files), {
    agenda: { built: true, files: 2 },
    horarios: { built: true, files: 1 },
    link: { built: false, files: 0 },
  })
})

test('fora do plano: só código, sem teste, docs, configuração nem o .faundrignore, agrupado por pasta', () => {
  const spec = { nodes: [{ id: 'agenda', paths: ['src/routes/agenda/**'] }, { id: 'cliente' }] }
  const all = [
    ...files,
    'src/lib/precos.ts',
    'src/lib/fuso/brasil.ts',
    'src/lib/horarios.test.ts',
    'test/agenda.test.mjs',
    'docs/como-usar.md',
    'vite.config.ts',
    'src/brand/logo.svg',
    'src/routeTree.gen.ts',
    'worker/index.ts',
    'vendor-tool/x.js',
  ]
  assert.deepEqual(offPlan(spec, all, readIgnore('# terceiros\nvendor-tool/\n')), {
    folders: [
      { folder: 'src/lib', files: 3 },
      { folder: 'supabase/migrations', files: 1 },
      { folder: 'worker', files: 1 },
    ],
    more: 0,
    total: 5,
    names: ['src/lib', 'supabase/migrations', 'worker'],
  })
})

test('fora do plano: sem peça com paths não dá para julgar; mais de 10 pastas somam o resto', () => {
  assert.equal(offPlan({ nodes: [{ id: 'cliente' }] }, files), null)
  const many = Array.from({ length: 12 }, (_, i) => `mod${String(i).padStart(2, '0')}/a.ts`)
  const r = offPlan({ nodes: [{ id: 'x', paths: ['src/**'] }] }, many)
  assert.equal(r.folders.length, 10)
  assert.equal(r.more, 2)
  assert.equal(r.total, 12)
})

test('pasta nova fora do plano: só o que não estava antes; a primeira conferência não avisa', () => {
  assert.deepEqual(newOffPlan(['src/lib', 'worker'], undefined), [])
  assert.deepEqual(newOffPlan(['src/lib', 'worker'], ['src/lib']), ['worker'])
  assert.deepEqual(newOffPlan(['src/lib'], ['src/lib', 'worker']), [])
})
