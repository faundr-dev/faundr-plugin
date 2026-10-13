import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkBuilt, pathMatcher } from '../bin/architecture.mjs'

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
