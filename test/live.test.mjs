import assert from 'node:assert/strict'
import { test } from 'node:test'
import { livePayload, machineName } from '../bin/live.mjs'

test('estado ao vivo: não manda conteúdo de arquivo nem o comando inteiro', () => {
  const sent = livePayload({
    session_id: 's1',
    hook_event_name: 'PreToolUse',
    cwd: '/proj',
    tool_name: 'Bash',
    tool_input: { command: 'curl -H "Authorization: Bearer segredo" https://x', description: 'Chamar a API', content: 'x' },
  })
  assert.equal(sent.tool_input.command, 'curl')
  assert.equal(sent.tool_input.description, 'Chamar a API')
  assert.ok(!JSON.stringify(sent).includes('segredo'))
  const write = livePayload({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: '/proj/a.ts', content: 'SEGREDO=1' } })
  assert.equal(write.tool_input.file_path, '/proj/a.ts')
  assert.ok(!JSON.stringify(write).includes('SEGREDO'))
  const skill = livePayload({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'faundr:design', args: '--files segredo.ts' } })
  assert.equal(skill.tool_input.skill, 'faundr:design')
  assert.ok(!JSON.stringify(skill).includes('segredo'))
})

test('nome do computador: o da configuração vale mais que o do sistema', () => {
  assert.equal(machineName({ machine: 'Notebook da Ana' }), 'Notebook da Ana')
  assert.ok(machineName({}))
})
