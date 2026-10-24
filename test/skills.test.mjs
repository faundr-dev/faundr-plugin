import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { activePlugins, parseFrontmatter, scanSkills, skillNote, skillsForPrompt, skillsOnce, writeSkillIndex } from '../bin/skills.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-skills-'))
const skill = (dir, name, head) => {
  fs.mkdirSync(path.join(dir, name), { recursive: true })
  fs.writeFileSync(path.join(dir, name, 'SKILL.md'), `---\n${head}\n---\n\n# Corpo privado que não sai daqui\n`)
}
const json = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data))
}

test('cabeçalho: aspas, bloco dobrado e chaves aninhadas', () => {
  const fm = parseFrontmatter('---\nname: tdd\ndescription: "Faz \\"teste\\" antes"\ndisable-model-invocation: true\nmetadata:\n  version: 2\n---\ncorpo')
  assert.equal(fm.name, 'tdd')
  assert.equal(fm.description, 'Faz "teste" antes')
  assert.equal(fm['disable-model-invocation'], 'true')
  assert.equal(fm.version, undefined)
  assert.equal(parseFrontmatter('---\ndescription: >\n  linha um\n  linha dois\nname: x\n---').description, 'linha um linha dois')
  assert.deepEqual(parseFrontmatter('sem cabeçalho'), {})
})

test('acha skills do projeto, pessoais e dos plugins ligados para esta pasta', () => {
  const root = tmp()
  const home = tmp()
  skill(path.join(root, '.claude', 'skills'), 'tdd', 'name: tdd\ndescription: Testes primeiro')
  skill(path.join(home, '.claude', 'skills'), 'tdd', 'name: tdd\ndescription: versão pessoal (perde para a do projeto)')
  skill(path.join(home, '.claude', 'skills'), 'copy', 'name: copy\ndescription: Textos\ndisable-model-invocation: true')
  const user = path.join(home, 'cache', 'faundr')
  const here = path.join(home, 'cache', 'supabase')
  const other = path.join(home, 'cache', 'outro')
  const off = path.join(home, 'cache', 'desligado')
  skill(path.join(user, 'skills'), 'design', 'name: design\ndescription: Design')
  skill(path.join(here, 'skills'), 'supabase', 'name: supabase\ndescription: Banco')
  skill(path.join(other, 'skills'), 'x', 'name: x\ndescription: de outro projeto')
  skill(path.join(off, 'skills'), 'y', 'name: y\ndescription: desligado')
  json(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'faundr@faundr': [{ scope: 'user', installPath: user }],
      'supabase@oficial': [{ scope: 'local', projectPath: root, installPath: here }],
      'outro@m': [{ scope: 'local', projectPath: path.join(root, '..', 'outro'), installPath: other }],
      'desligado@m': [{ scope: 'user', installPath: off }],
    },
  })
  json(path.join(root, '.claude', 'settings.local.json'), { enabledPlugins: { 'desligado@m': false } })
  assert.deepEqual(activePlugins(root, home).map((p) => p.key).sort(), ['faundr@faundr', 'supabase@oficial'])
  const found = scanSkills(root, home)
  assert.deepEqual(
    found.map((s) => `${s.source}:${s.name}`).sort(),
    ['pessoal:copy', 'plugin:faundr:design', 'plugin:supabase:supabase', 'projeto:tdd'],
  )
  assert.equal(found.find((s) => s.name === 'copy').manual, true)
  assert.equal(found.find((s) => s.name === 'tdd').description, 'Testes primeiro')
  assert.ok(!JSON.stringify(found).includes('Corpo privado'))
})

const INDEX = [
  { name: 'copywriting', description: 'Textos de marketing', topics: ['copy', 'texto da home', 'headline'], when: 'texto de página' },
  { name: 'faundr:design', description: 'Design', topics: ['design', 'tela'], manual: false },
  { name: 'tdd', description: 'Testes primeiro', topics: [] },
  { name: 'ask-matt', description: 'Roteador', topics: ['qual skill'], manual: true },
]

test('aviso pelo assunto: tópicos, nome quando não há tópicos e nada quando a skill já foi chamada', () => {
  assert.deepEqual(skillsForPrompt(INDEX, 'melhora a headline da home').map((s) => s.name), ['copywriting'])
  assert.deepEqual(skillsForPrompt(INDEX, 'vamos fazer em tdd essa parte').map((s) => s.name), ['tdd'])
  assert.deepEqual(skillsForPrompt(INDEX, '/faundr:design arruma a tela'), [])
  assert.deepEqual(skillsForPrompt(INDEX, 'mexe no design da tela', ['faundr:design']), [])
  const note = skillNote(skillsForPrompt(INDEX, 'qual skill eu uso aqui?'))
  assert.match(note, /\/ask-matt \(only the person calls it/)
})

test('cada skill avisa uma vez por sessão', () => {
  const root = tmp()
  writeSkillIndex(root, INDEX)
  assert.match(skillsOnce(root, 's1', 'ajusta o design da tela'), /skill faundr:design/)
  assert.equal(skillsOnce(root, 's1', 'outro ajuste de design'), null)
  assert.match(skillsOnce(root, 's2', 'design de novo'), /faundr:design/)
})
