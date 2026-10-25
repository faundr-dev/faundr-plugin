import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { lintProject } from '../bin/design.mjs'
import { setLang } from '../bin/i18n.mjs'
import { projectParts } from '../bin/parts.mjs'

setLang('pt')

const proj = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-ignore-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

// Como no Liah App: app Expo e repositórios de referência clonados em refs/, listados no .faundrignore.
const screen = "import { Text } from 'react-native'\nexport const Tela = () => <Text style={{ color: '#EEEEF0', fontSize: 15 }}>oi</Text>\n"
const expo = '{"dependencies":{"expo":"~58.0.0","react-native":"0.88.0"}}'
const liah = (extra = {}) =>
  proj({
    'app/package.json': expo,
    'app/src/Tela.tsx': screen,
    'refs/outro/package.json': expo,
    'refs/outro/src/Tela.tsx': screen,
    ...extra,
  })

test('design: pasta do .faundrignore não vira achado', () => {
  const dir = liah({ '.faundrignore': '# referências clonadas\nrefs/\n' })
  const files = lintProject(dir).findings.map((f) => f.file).filter(Boolean)
  assert.deepEqual(files.filter((f) => f.startsWith('refs/')), [])
  assert.ok(files.includes('app/src/Tela.tsx'), `achados: ${JSON.stringify(files)}`)
})

test('design: sem .faundrignore, a tela em refs/ vira achado como qualquer outra', () => {
  const files = lintProject(liah()).findings.map((f) => f.file)
  assert.ok(files.includes('refs/outro/src/Tela.tsx'), `achados: ${JSON.stringify(files)}`)
})

test('partes: pasta do .faundrignore não é parte do projeto', () => {
  const dir = liah({ '.faundrignore': 'refs\n' })
  assert.deepEqual(projectParts(dir).map((p) => p.dir), ['', 'app'])
})
