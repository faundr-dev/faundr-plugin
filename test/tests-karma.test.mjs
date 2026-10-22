import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fromKarmaJson, karmaConfigText, karmaRunner } from '../bin/tests-karma.mjs'
import { detectRunners } from '../bin/tests.mjs'

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-tk-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

test('acha o ng test (Karma) num projeto Angular; com Jest ou Vitest no lugar, não', () => {
  const dir = project({
    'loja/angular.json': '{"projects":{}}',
    'loja/package.json': JSON.stringify({ devDependencies: { karma: '~6.4.0', 'karma-jasmine': '~5.1.0', '@angular-devkit/build-angular': '^18.0.0' } }),
    'outra/angular.json': '{"projects":{}}',
    'outra/package.json': JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
  })
  assert.deepEqual(karmaRunner(dir, 'loja')?.runner, 'karma')
  assert.equal(karmaRunner(dir, 'outra'), null)
  const { runners } = detectRunners(dir, { files: [] })
  assert.ok(runners.some((r) => r.runner === 'karma' && r.dir === 'loja'), 'aparece na lista de executores')
})

test('a configuração do Faundr carrega a do projeto e grava cada teste em JSON pelo reporter próprio', () => {
  const dir = project({
    'karma.conf.js': "module.exports = function (config) {\n  config.set({ frameworks: ['jasmine'], plugins: [], browsers: ['Chrome'], reporters: ['progress'] })\n}\n",
  })
  const out = path.join(dir, 'saida', 'karma.json')
  const cfgFile = path.join(dir, 'faundr-karma.cjs')
  fs.writeFileSync(cfgFile, karmaConfigText({ cwd: dir, out, projectConfig: path.join(dir, 'karma.conf.js'), devkit: false }))
  const settings = {}
  const config = { set: (o) => Object.assign(settings, o) }
  createRequire(import.meta.url)(cfgFile)(config)
  assert.deepEqual(settings.reporters, ['faundr'])
  assert.deepEqual(settings.browsers, ['ChromeHeadless'])
  assert.equal(settings.singleRun, true)
  assert.deepEqual(settings.frameworks, ['jasmine'], 'mantém o que o projeto configurou')
  // O reporter, como o Karma chamaria.
  const plugin = settings.plugins.find((p) => p['reporter:faundr'])
  const Reporter = plugin['reporter:faundr'][1]
  const r = new Reporter(function baseReporterDecorator() {})
  r.onSpecComplete({}, { suite: ['AppComponent'], description: 'should create', success: true, skipped: false, log: [], time: 12 })
  r.onSpecComplete({}, { suite: ['CarrinhoService', 'total'], description: 'soma os itens', success: false, skipped: false, log: ['Expected 3 to be 2.\n    at <Jasmine>'], time: 5 })
  r.onRunComplete()
  const saved = JSON.parse(fs.readFileSync(out, 'utf8'))
  assert.equal(saved.length, 2)
  assert.equal(saved[1].suite[1], 'total')
})

test('lê o JSON do Karma: arquivo pelo describe do .spec.ts, pulado e o motivo da falha', () => {
  const root = project({
    'loja/src/app/app.component.spec.ts': "describe('AppComponent', () => {\n  it('should create', () => {})\n})\n",
    'loja/src/app/carrinho.service.spec.ts': "describe(`CarrinhoService`, () => {\n  describe('total', () => {\n    it('soma os itens', () => {})\n  })\n})\n",
  })
  const json = JSON.stringify([
    { suite: ['AppComponent'], description: 'should create', success: true, skipped: false, log: [], time: 12 },
    { suite: ['CarrinhoService', 'total'], description: 'soma os itens', success: false, skipped: false, log: ['Expected 3 to be 2.\n    at <Jasmine>'], time: 5 },
    { suite: ['AppComponent'], description: 'velho', success: true, skipped: true, log: [], time: 0 },
  ])
  const cases = fromKarmaJson(json, root, 'loja')
  assert.deepEqual(
    cases.map((c) => [c.file, c.name, c.status]),
    [
      ['loja/src/app/app.component.spec.ts', 'AppComponent › should create', 'passed'],
      ['loja/src/app/carrinho.service.spec.ts', 'CarrinhoService › total › soma os itens', 'failed'],
      ['loja/src/app/app.component.spec.ts', 'AppComponent › velho', 'skipped'],
    ],
  )
  assert.match(cases[1].message, /Expected 3 to be 2/)
})
