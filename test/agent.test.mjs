import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agentSessionId, codexDecision, currentAgent, patchEdits, skillFromCommand, toolEdits } from '../bin/agent.mjs'

test('agente: Codex pelo CODEX_SESSION_ID, mesmo aberto de dentro do Claude Code', () => {
  assert.equal(currentAgent({ CLAUDE_CODE_SESSION_ID: 'c1' }), 'claude')
  assert.equal(currentAgent({ CLAUDE_CODE_SESSION_ID: 'c1', CODEX_SESSION_ID: 'x1' }), 'codex')
  assert.equal(agentSessionId({ CLAUDE_CODE_SESSION_ID: 'c1', CODEX_SESSION_ID: 'x1' }), 'x1')
  assert.equal(agentSessionId({}), null)
})

test('agente: FAUNDR_AGENT dos hooks vale mais que o ambiente', () => {
  assert.equal(currentAgent({ FAUNDR_AGENT: 'codex' }), 'codex')
  assert.equal(currentAgent({ FAUNDR_AGENT: 'claude', CODEX_SESSION_ID: 'x1' }), 'claude')
})

const PATCH = [
  '*** Begin Patch',
  '*** Add File: src/novo.ts',
  '+export const a = 1',
  '+export const b = 2',
  '*** Update File: src/velho.ts',
  '*** Move to: src/renomeado.ts',
  '@@ function x',
  ' const keep = 1',
  '-const old = 2',
  '+const key = "sk_live_abc"',
  '*** Delete File: src/fora.ts',
  '*** End Patch',
].join('\r\n')

test('apply_patch: um item por arquivo, com só as linhas que entram', () => {
  assert.deepEqual(patchEdits(PATCH), [
    { kind: 'add', file: 'src/novo.ts', content: 'export const a = 1\nexport const b = 2' },
    { kind: 'update', file: 'src/renomeado.ts', content: 'const key = "sk_live_abc"' },
    { kind: 'delete', file: 'src/fora.ts', content: '' },
  ])
  assert.deepEqual(patchEdits(undefined), [])
})

test('edições: Codex e Claude no mesmo formato; arquivo apagado não conta', () => {
  assert.deepEqual(toolEdits('apply_patch', { command: PATCH }), [
    { file: 'src/novo.ts', content: 'export const a = 1\nexport const b = 2', isNew: true },
    { file: 'src/renomeado.ts', content: 'const key = "sk_live_abc"', isNew: false },
  ])
  assert.deepEqual(toolEdits('Edit', { file_path: 'a.ts', new_string: 'x' }), [{ file: 'a.ts', content: 'x', isNew: false }])
  assert.deepEqual(toolEdits('MultiEdit', { file_path: 'a.ts', edits: [{ new_string: 'x' }, { new_string: 'y' }] }), [
    { file: 'a.ts', content: 'x\ny', isNew: false },
  ])
  assert.deepEqual(toolEdits('Bash', { command: 'ls' }), [])
})

test('Codex: "perguntar" vira barrar até o usuário dizer sim e o mesmo comando voltar', () => {
  const ask = { permissionDecision: 'ask', permissionDecisionReason: '[Faundr] Warning.' }
  const first = codexDecision(ask, 'git reset --hard', null, 1000)
  assert.equal(first.output.permissionDecision, 'deny')
  assert.match(first.output.permissionDecisionReason, /^\[Faundr\] Warning\. Ask the user/)
  assert.deepEqual(first.pending, { command: 'git reset --hard', at: 1000 })
  // Outro comando não aproveita a confirmação; o mesmo, dentro de 10 min, passa uma vez.
  assert.equal(codexDecision(ask, 'git clean -fd', first.pending, 2000).output.permissionDecision, 'deny')
  assert.deepEqual(codexDecision(ask, 'git reset --hard', first.pending, 2000), { output: null, pending: null })
  assert.equal(codexDecision(ask, 'git reset --hard', first.pending, 1000 + 11 * 60_000).output.permissionDecision, 'deny')
  // Barrar de vez continua barrando.
  const deny = { permissionDecision: 'deny', permissionDecisionReason: 'x' }
  assert.deepEqual(codexDecision(deny, 'rm -rf /', null).output, deny)
})

test('Codex: a skill começa quando o agente abre o SKILL.md pelo terminal', () => {
  assert.equal(
    skillFromCommand(String.raw`Get-Content -LiteralPath 'C:\Users\ana\.codex\plugins\cache\faundr\faundr\0.101.1\skills\overview\SKILL.md'`),
    'faundr:overview',
  )
  assert.equal(skillFromCommand('cat /home/ana/.codex/plugins/cache/x/meu-plugin/1.0/skills/deploy/SKILL.md'), 'meu-plugin:deploy')
  assert.equal(skillFromCommand('cat .agents/skills/release/SKILL.md'), 'release')
  assert.equal(skillFromCommand('git status'), null)
})
