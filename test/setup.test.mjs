import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gitignoreCoversFaundr, guessProject, nodeOk, setupSummary, withFaundrIgnored } from '../bin/setup.mjs'
import { setLang } from '../bin/i18n.mjs'

setLang('pt')

test('.gitignore: reconhece .faundr/ nas formas comuns e não confunde com outro nome', () => {
  for (const t of ['.faundr/', '.faundr', '/.faundr/', 'node_modules\n.faundr/**\n']) assert.ok(gitignoreCoversFaundr(t), t)
  for (const t of ['', '.faundr.json', '# .faundr/', 'faundr/']) assert.ok(!gitignoreCoversFaundr(t), t)
})

test('.gitignore: acrescenta .faundr/ uma vez só, sem colar na última linha', () => {
  assert.equal(withFaundrIgnored('node_modules'), 'node_modules\n\n# Faundr: mapa do código, estado e relatórios locais (não vão para o git)\n.faundr/\n')
  assert.equal(withFaundrIgnored(''), '# Faundr: mapa do código, estado e relatórios locais (não vão para o git)\n.faundr/\n')
  const once = withFaundrIgnored('dist\n')
  assert.equal(withFaundrIgnored(once), once)
})

test('projeto pelo nome: liga só quando um único projeto bate (ignora acento, caixa e separador)', () => {
  const projects = [
    { id: '1', name: 'Loja da Ana' },
    { id: '2', name: 'Faundr' },
    { id: '3', name: 'faundr' },
  ]
  assert.equal(guessProject(projects, ['loja-da-ana'])?.id, '1')
  assert.equal(guessProject(projects, ['LOJA_DÁ_ANA'])?.id, '1')
  assert.equal(guessProject(projects, ['faundr']), null, 'dois projetos com o mesmo nome: pergunta')
  assert.equal(guessProject(projects, ['outro', '']), null)
  assert.equal(guessProject(projects, ['pasta-qualquer', 'Loja da Ana'])?.id, '1', 'o nome do package.json também vale')
})

test('Node: 20 ou mais', () => {
  assert.ok(nodeOk('24.1.0'))
  assert.ok(nodeOk('20.0.0'))
  assert.ok(!nodeOk('18.19.0'))
})

test('resumo: tudo ok diz que está pronto; o que pede OK sai no fim com o comando', () => {
  assert.match(setupSummary([{ title: 'Login', status: 'ok', detail: 'feito' }]), /Tudo pronto/)
  const out = setupSummary([
    { title: 'Login', status: 'ok', detail: 'feito' },
    { title: '.gitignore', status: 'pedir', detail: 'não cobre .faundr/', why: 'para o git não levar o mapa', apply: 'faundr setup --apply gitignore' },
  ])
  assert.doesNotMatch(out, /Tudo pronto/)
  setLang('en')
  assert.match(setupSummary([{ title: 'Login', status: 'ok', detail: 'done' }]), /All set/)
  assert.match(withFaundrIgnored(''), /# Faundr: code map, state and local reports/)
  setLang('pt')
  assert.match(out, /Falta o seu OK[\s\S]*\.gitignore: para o git não levar o mapa\n {4}faundr setup --apply gitignore/)
})
