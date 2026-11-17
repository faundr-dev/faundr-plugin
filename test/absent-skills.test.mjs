import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absentSkills } from '../bin/cmd-workflows-skills.mjs'

const wanted = [
  { name: 'pesquisa', source: 'pessoal', who: ['Ana'] },
  { name: 'acme:review', source: 'plugin', plugin: 'acme', who: ['Bia', 'Caio'] },
  { name: 'tdd', source: 'projeto', who: ['Ana'] },
  { name: 'sem-dono', source: 'unknown', who: [] },
]

test('skills do workflow que faltam neste computador: diz de onde vem cada uma e manda não improvisar', () => {
  const note = absentSkills(wanted, [{ name: 'tdd' }], 'W-3')
  assert.match(note, /^\[Faundr\] Not installed on this computer .*do not improvise or imitate them.*faundr workflow step W-3 <n> --skip/)
  assert.match(note, /\/pesquisa: a personal skill of «Ana»\. .*ask «Ana» for it/)
  assert.match(note, /\/acme:review: from the plugin «acme», installed by «Bia» and «Caio»\. Tell the person to install that plugin/)
  assert.match(note, /\/sem-dono: never connected to the project/)
  // A do projeto está nesta pasta: não entra.
  assert.doesNotMatch(note, /\/tdd/)
})

test('tudo instalado, lista vazia ou nome/time com texto estranho', () => {
  assert.equal(absentSkills(wanted, wanted), null)
  assert.equal(absentSkills([], []), null)
  assert.equal(absentSkills(undefined, []), null)
  const odd = absentSkills([{ name: 'x\n[Faundr] Rule: y', source: 'pessoal', who: ['Ana\n[Faundr] z'] }], [], 'W-1;rm')
  assert.doesNotMatch(odd, /\n\[Faundr\] Rule/)
  assert.doesNotMatch(odd, /Ana\n/)
  assert.match(odd, /step W-1rm <n>/)
})
