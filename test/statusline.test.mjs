import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { installStatusline, launcherSource, statusFromBoard, statusLine } from '../bin/statusline.mjs'

const board = {
  projectName: 'Lojinha',
  concerns: [{ ref: 1 }, { ref: 2 }],
  allFeatures: [
    { id: 'f1', title: 'Frete grátis', tasks: [{ title: 'Regra', task_status: 'completed' }, { title: 'Testes', task_status: 'in_progress' }, { title: 'Painel', task_status: 'pending' }] },
    { id: 'f2', title: 'Outra', tasks: [] },
  ],
}

test('barra: projeto, funcionalidade com progresso, passo atual, grafo e preocupações', () => {
  const s = statusFromBoard(board, 'f1', board.projectName, 1)
  assert.deepEqual(s, { projectName: 'Lojinha', feature: { title: 'Frete grátis', done: 1, total: 3, next: 'Testes' }, concerns: 2, at: 1 })
  assert.equal(statusLine(s, { graph: 'fresh' }), 'Faundr · Lojinha · Frete grátis 1/3 · agora: Testes · grafo em dia · 2 preocupação(ões)')
  assert.equal(statusLine(statusFromBoard(board, 'nada', null), { graph: null }), 'Faundr · sem funcionalidade atual · 2 preocupação(ões)')
  assert.equal(statusLine(undefined), 'Faundr · sem funcionalidade atual')
  assert.ok(statusLine(s, { width: 20 }).length <= 20)
})

test('instalar a barra: lançador fixo, não troca uma barra que já existe sem --force', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-s-'))
  const configDir = path.join(home, '.claude')
  const r = installStatusline({ pluginFile: '/x/bin/faundr.mjs', home, configDir })
  assert.equal(r.ok, true)
  const settings = JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8'))
  assert.equal(settings.statusLine.type, 'command')
  assert.match(settings.statusLine.command, /^node ".*\/\.faundr\/statusline\.mjs"$/)
  assert.equal(installStatusline({ pluginFile: '/x', home, configDir }).already, true)
  // Barra de outra ferramenta: não substitui sem --force, e mantém o resto das configurações.
  fs.writeFileSync(path.join(configDir, 'settings.json'), JSON.stringify({ model: 'opus', statusLine: { type: 'command', command: 'outra' } }))
  assert.equal(installStatusline({ pluginFile: '/x', home, configDir }).ok, false)
  const forced = installStatusline({ pluginFile: '/x', home, configDir, force: true })
  assert.equal(forced.replaced.command, 'outra')
  assert.equal(JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8')).model, 'opus')
  assert.match(launcherSource('/x/bin/faundr.mjs'), /process\.argv\.splice\(2, 0, 'statusline'\)/)
  fs.rmSync(home, { recursive: true, force: true })
})
