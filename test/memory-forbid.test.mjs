import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { memoryRules } from '../bin/quality-rules.mjs'
import { forbiddenIn, forbiddenNote, writeRules } from '../bin/rules.mjs'

const rules = [
  { id: 'r1aaaaaaaa', kind: 'rule', title: 'Usar fetch, não axios', body: '', paths: ['**'], forbid: "from ['\"]axios['\"]" },
  { id: 'r2bbbbbbbb', kind: 'rule', title: 'Sem console.log nas telas', body: '', paths: ['src/components/**'], forbid: 'console\\.log\\(' },
  { id: 'r3cccccccc', kind: 'rule', title: 'Só regra de arquivo', body: '', paths: ['src/**'] },
]

test('padrão proibido: só nos arquivos da regra e só quando o texto tem o padrão', () => {
  const code = "import axios from 'axios'\nconsole.log('oi')\n"
  assert.deepEqual(
    forbiddenIn(rules, 'src/components/A.tsx', code).map((h) => h.rule.id),
    ['r1aaaaaaaa', 'r2bbbbbbbb'],
  )
  assert.deepEqual(
    forbiddenIn(rules, 'src/server/api.ts', code).map((h) => h.rule.id),
    ['r1aaaaaaaa'],
    'console.log fora das telas pode',
  )
  assert.deepEqual(forbiddenIn(rules, 'src/components/A.tsx', 'const x = 1'), [])
  const note = forbiddenNote('src/components/A.tsx', forbiddenIn(rules, 'src/components/A.tsx', code))
  assert.match(note, /contraria 2 regras do time/)
  assert.match(note, /Usar fetch, não axios/)
  assert.match(note, /Trecho: import axios/)
  assert.equal(forbiddenNote('a.ts', []), null)
})

test('padrão inválido não quebra a guarda', () => {
  assert.deepEqual(forbiddenIn([{ id: 'x', title: 'x', paths: ['**'], forbid: '(' }], 'a.ts', '('), [])
})

test('checagem de qualidade: regra da memória contrariada aponta as linhas', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-forbid-'))
  writeRules(d, rules)
  const list = memoryRules(d)
  assert.deepEqual(list.map((r) => r.rule), ['memoria/r1aaaaaa', 'memoria/r2bbbbbb'])
  const r2 = list[1]
  assert.equal(r2.files.test('src/components/B.tsx'), true)
  assert.equal(r2.files.test('src/server/b.ts'), false)
  assert.deepEqual(r2.lines("a\nconsole.log(1)\nb\nconsole.log(2)"), [2, 4])
  assert.equal(r2.ctx.memory, true)
})
