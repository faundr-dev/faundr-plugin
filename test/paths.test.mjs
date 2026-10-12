import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { faundrPath, organizeFaundrDir, relPath } from '../bin/paths.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-paths-'))

test('caminhos: cada tipo na sua subpasta, relativo com barras normais', () => {
  assert.equal(relPath('overview'), '.faundr/painel/overview.json')
  assert.equal(relPath('graph'), '.faundr/mapa/graph.json')
  assert.equal(relPath('handover'), '.faundr/relatorios/PASSAGEM.md')
  assert.equal(faundrPath('/p', 'state'), path.join('/p', '.faundr', 'state.json'))
  assert.equal(faundrPath('/p', 'extractCache'), path.join('/p', '.faundr', 'cache', 'extract-cache.json'))
})

test('organizar: passa os arquivos soltos do plugin antigo para as subpastas e escreve o LEIA-ME', () => {
  const root = tmp()
  const dir = path.join(root, '.faundr')
  fs.mkdirSync(path.join(dir, 'tests', 'coverage'), { recursive: true })
  for (const f of ['graph.json', 'GRAPH_REPORT.md', 'overview.json', 'memory.json', 'PASSAGEM.md', 'db-test.json', 'extract-cache.json', 'state.json'])
    fs.writeFileSync(path.join(dir, f), f)
  fs.writeFileSync(path.join(dir, 'tests', 'coverage', 'lcov.info'), 'x')

  assert.equal(organizeFaundrDir(root), 8)
  assert.equal(fs.readFileSync(faundrPath(root, 'graph'), 'utf8'), 'graph.json')
  assert.equal(fs.readFileSync(faundrPath(root, 'memory'), 'utf8'), 'memory.json')
  assert.equal(fs.readFileSync(faundrPath(root, 'handover'), 'utf8'), 'PASSAGEM.md')
  assert.equal(fs.readFileSync(faundrPath(root, 'extractCache'), 'utf8'), 'extract-cache.json')
  assert.ok(fs.existsSync(path.join(faundrPath(root, 'tests'), 'coverage', 'lcov.info')))
  // O estado continua na raiz da pasta; nada solto sobra além dele e do LEIA-ME.
  assert.deepEqual(fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort(), ['LEIA-ME.md', 'state.json'])
  assert.match(fs.readFileSync(path.join(dir, 'LEIA-ME.md'), 'utf8'), /painel\//)

  // Já organizado: não mexe em nada.
  assert.equal(organizeFaundrDir(root), 0)
})

test('organizar: o arquivo novo ganha do antigo solto, e sem .faundr/ não cria nada', () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, '.faundr', 'painel'), { recursive: true })
  fs.writeFileSync(path.join(root, '.faundr', 'stack.json'), 'velho')
  fs.writeFileSync(faundrPath(root, 'stack'), 'novo')
  assert.equal(organizeFaundrDir(root), 0)
  assert.equal(fs.readFileSync(faundrPath(root, 'stack'), 'utf8'), 'novo')
  assert.ok(!fs.existsSync(path.join(root, '.faundr', 'stack.json')))

  const empty = tmp()
  assert.equal(organizeFaundrDir(empty), 0)
  assert.ok(!fs.existsSync(path.join(empty, '.faundr')))
})
