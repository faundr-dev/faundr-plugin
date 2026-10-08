import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { matchesPath, missingPaths, readRules, rulesFor, rulesNote, writeRules } from '../bin/rules.mjs'

test('matchesPath: arquivo, pasta, * e **', () => {
  const cases = [
    ['src/server/**', 'src/server/a.ts', true],
    ['src/server/**', 'src/server/x/b.ts', true],
    ['src/server/**', 'src/client.ts', false],
    ['src/server', 'src/server/a.ts', true],
    ['src/server/', 'src/serverless.ts', false],
    ['./plugin/bin/faundr.mjs', 'plugin/bin/faundr.mjs', true],
    ['*.sql', 'supabase/migrations/0001.sql', true],
    ['src/**/*.tsx', 'src/a.tsx', true],
    ['src/**/*.tsx', 'src/c/d/a.tsx', true],
    ['src/**/*.tsx', 'src/a.ts', false],
    ['src/*.ts', 'src/x/a.ts', false],
    ['src\\lib\\a?.ts', 'src/lib/ab.ts', true],
  ]
  for (const [p, rel, want] of cases) assert.equal(matchesPath(p, rel), want, `${p} x ${rel}`)
})

test('regras do arquivo: só as que casam, cada uma uma vez, com aviso de caminho que sumiu', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-r-'))
  fs.mkdirSync(path.join(root, 'src/server'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src/server/a.ts'), '')
  const rules = [
    { id: '1', kind: 'rule', title: 'Toda rota confere o acesso', body: 'use assertProjectAccess', paths: ['src/server/**'] },
    { id: '2', kind: 'decision', title: 'Datas em UTC', body: '', paths: ['src/server/a.ts', 'src/server/velho.ts'] },
    { id: '3', kind: 'rule', title: 'Migrações só somam', body: '', paths: ['*.sql'] },
  ]
  writeRules(root, rules)
  assert.deepEqual(readRules(root), rules)
  const hits = rulesFor(readRules(root), 'src/server/a.ts')
  assert.deepEqual(hits.map((r) => r.id), ['1', '2'])
  assert.deepEqual(rulesFor(rules, 'src/server/a.ts', ['1']).map((r) => r.id), ['2'])
  assert.deepEqual(missingPaths(root, rules[1]), ['src/server/velho.ts'])
  const note = rulesNote(root, 'src/server/a.ts', hits)
  assert.match(note, /^\[Faundr\] Regras do time para src\/server\/a\.ts/)
  assert.match(note, /- Regra: Toda rota confere o acesso — use assertProjectAccess\n/)
  assert.match(note, /- Decisão: Datas em UTC \(pode estar desatualizada: src\/server\/velho\.ts não existe mais/)
  assert.equal(rulesNote(root, 'x.ts', []), null)
  assert.deepEqual(readRules(path.join(root, 'nada')), [])
  fs.rmSync(root, { recursive: true, force: true })
})
