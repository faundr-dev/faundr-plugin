import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkBuilt, checkKey, ignoreMatcher, newOffPlan, offPlan, offPlanViews, pathMatcher, readIgnore } from '../bin/architecture.mjs'

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

test('fora do plano: pasta marcada no painel some pelo nome do grupo, sem esconder as de dentro', () => {
  const spec = { nodes: [{ id: 'x', paths: ['app/**'] }] }
  const all = ['src/a.ts', 'src/lib/b.ts', 'scripts/c.mjs']
  const r = offPlan(spec, all, [], ['src', 'scripts'])
  assert.deepEqual(r.folders, [{ folder: 'src/lib', files: 1 }])
  assert.deepEqual(r.names, ['src/lib'])
})

test('caminhos: "**" repetido não trava a comparação e continua casando', () => {
  const deep = `a/${'**/'.repeat(40)}zz`
  const start = Date.now()
  const m = pathMatcher(deep)
  assert.equal(m(`a/${'b/'.repeat(60)}c`), false)
  assert.equal(m('a/b/c/zz'), true)
  assert.equal(pathMatcher('src/****/x.ts')('src/a/b/x.ts'), true)
  assert.equal(pathMatcher('src/**/**/x.ts')('src/x.ts'), true)
  assert.ok(Date.now() - start < 500, 'a comparação demorou demais')
})

test('caminhos: "?", pasta com colchetes e rota com "$" valem ao pé da letra', () => {
  assert.equal(pathMatcher('src/a?.ts')('src/ab.ts'), true)
  assert.equal(pathMatcher('src/a?.ts')('src/a/b.ts'), false)
  assert.equal(pathMatcher('app/api/auth/[...nextauth]/**')('app/api/auth/[...nextauth]/route.ts'), true)
  assert.equal(pathMatcher('app/[id]/*.tsx')('app/x/page.tsx'), false)
  assert.equal(pathMatcher('src/routes/$projectId.tsx')('src/routes/$projectId.tsx'), true)
})

test('.faundrignore: nome sem barra vale em qualquer pasta; com barra, a partir da raiz', () => {
  assert.equal(ignoreMatcher('legacy')('apps/web/legacy/old.ts'), true)
  assert.equal(ignoreMatcher('legacy')('legacy/old.ts'), true)
  assert.equal(ignoreMatcher('legacy')('src/legacy.ts'), false)
  assert.equal(ignoreMatcher('*.gen2.ts')('src/lib/tipos.gen2.ts'), true)
  assert.equal(ignoreMatcher('apps/web/legacy')('apps/web/legacy/a/b.ts'), true)
  assert.equal(ignoreMatcher('apps/web/legacy')('outro/apps/web/legacy/a.ts'), false)
  assert.equal(ignoreMatcher('refs/*')('refs/repo/src/a.ts'), true)
  assert.equal(ignoreMatcher('vendor/')('vendor/x.go'), true)
  const spec = { nodes: [{ id: 'a', paths: ['src/app/**'] }] }
  assert.deepEqual(offPlan(spec, ['src/lib/a.ts', 'apps/web/legacy/b.ts'], readIgnore('legacy\n')).names, ['src/lib'])
})

test('fora do plano: com as 10 maiores marcadas, o painel ainda recebe as seguintes e o terminal mostra as não marcadas', () => {
  const spec = { nodes: [{ id: 'a', paths: ['src/app/**'] }] }
  // 15 pastas: p00 com 15 arquivos … p14 com 1.
  const files = Array.from({ length: 15 }, (_, i) => Array.from({ length: 15 - i }, (_, k) => `p${String(i).padStart(2, '0')}/f${k}.ts`)).flat()
  const marked = Array.from({ length: 10 }, (_, i) => `p${String(i).padStart(2, '0')}`)
  const v = offPlanViews(spec, files, [], marked)
  assert.equal(v.panel.folders.length, 15)
  assert.equal(v.panel.more, 0)
  assert.equal(v.panel.total, 120)
  assert.deepEqual(v.shown.folders.map((f) => f.folder), ['p10', 'p11', 'p12', 'p13', 'p14'])
  assert.equal(v.shown.total, 15)
  assert.equal(v.all.length, 15)
  assert.deepEqual(v.names, ['p10', 'p11', 'p12', 'p13', 'p14'])
  // Sem marcadas, o painel recebe só as 10 maiores, como antes.
  const plain = offPlanViews(spec, files)
  assert.equal(plain.panel.folders.length, 10)
  assert.equal(plain.panel.more, 5)
  assert.deepEqual(plain.panel, plain.shown)
  assert.equal(offPlanViews({ nodes: [{ id: 'a' }] }, files), null)
})

test('conferência: a chave não depende da ordem das peças e muda quando o resultado muda', () => {
  const off = { folders: [{ folder: 'src/lib', files: 3 }], more: 0, total: 3 }
  const a = checkKey({ x: { built: true, files: 2 }, y: { built: false, files: 0 } }, off)
  assert.equal(checkKey({ y: { files: 0, built: false }, x: { files: 2, built: true } }, { total: 3, more: 0, folders: [{ files: 3, folder: 'src/lib' }] }), a)
  assert.notEqual(checkKey({ x: { built: true, files: 3 }, y: { built: false, files: 0 } }, off), a)
  assert.notEqual(checkKey({ x: { built: true, files: 2 }, y: { built: false, files: 0 } }, null), a)
  assert.equal(checkKey(null, null), checkKey({}, undefined))
})
