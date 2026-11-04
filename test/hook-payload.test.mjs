import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commitDone, createdTaskId, hookPayload } from '../bin/hook-payload.mjs'
import { graphForUpload } from '../bin/cmd-graph.mjs'
import { withoutSnippets } from '../bin/cmd-security.mjs'

const base = { session_id: 's1', cwd: '/proj', transcript_path: '/home/x/.claude/s1.jsonl' }
const CODE = 'export const segredoDoCodigo = () => 42'
const key = 'sk-ant-api03-' + 'q7Wm2Zx9Lr4Tn8Vb1Hc6Jp3Ks5Df0Gy'.repeat(3).slice(0, 93) + 'AA'

test('Write, Edit, MultiEdit e NotebookEdit: sai o caminho, nunca o conteúdo', () => {
  const tools = [
    ['Write', { file_path: '/proj/a.ts', content: CODE }],
    ['Edit', { file_path: '/proj/a.ts', old_string: CODE, new_string: `${CODE}1` }],
    ['MultiEdit', { file_path: '/proj/a.ts', edits: [{ old_string: CODE, new_string: CODE }] }],
    ['NotebookEdit', { notebook_path: '/proj/n.ipynb', new_source: CODE }],
  ]
  for (const [tool_name, tool_input] of tools) {
    const out = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name, tool_input, tool_response: { content: CODE } })
    assert.ok(!JSON.stringify(out).includes('segredoDoCodigo'), tool_name)
    assert.ok(out.tool_input.file_path || out.tool_input.notebook_path)
  }
})

test('saída do Read, do Bash, do Grep e do WebFetch não sai', () => {
  const tools = [
    ['Read', { file_path: '/proj/.env' }, { file: { content: `ANTHROPIC_API_KEY=${key}` } }],
    ['Bash', { command: 'cat .env', description: 'Ler o env' }, { stdout: `ANTHROPIC_API_KEY=${key}\n${CODE}` }],
    ['Grep', { pattern: 'segredo', path: '/proj' }, { content: CODE }],
    ['WebFetch', { url: 'https://example.com', prompt: 'resuma' }, { result: CODE }],
  ]
  for (const [tool_name, tool_input, tool_response] of tools) {
    const out = JSON.stringify(hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name, tool_input, tool_response }))
    assert.ok(!out.includes('segredoDoCodigo') && !out.includes(key) && !out.includes('tool_response'), tool_name)
  }
  const bash = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'cat .env', description: 'Ler o env' } })
  assert.deepEqual(bash.tool_input, { command: 'cat .env', description: 'Ler o env' })
  assert.equal(bash.transcript_path, undefined)
})

test('comando: chave mascarada e no máximo 300 caracteres', () => {
  const out = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: `curl -H "x-api-key: ${key}" ${'a'.repeat(500)}` } })
  assert.ok(!out.tool_input.command.includes(key))
  assert.ok(out.tool_input.command.length <= 301)
})

test('patch do Codex: só o primeiro arquivo', () => {
  const patch = `*** Begin Patch\n*** Update File: src/a.ts\n@@\n-old\n+${CODE}\n*** End Patch`
  const out = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name: 'apply_patch', tool_input: { command: patch } })
  assert.deepEqual(out.tool_input, { file_path: 'src/a.ts' })
})

test('commit e número da tarefa: calculados aqui, sai só o resultado', () => {
  const commit = { ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' }, tool_response: { stdout: '[main abc1234] x\n 1 file changed' } }
  assert.equal(commitDone(commit), true)
  assert.deepEqual(hookPayload(commit).derived, { commit: true })
  assert.equal(commitDone({ ...commit, tool_response: { stdout: 'nothing to commit' } }), false)
  assert.equal(commitDone({ ...commit, tool_input: { command: 'git commit -q -m x' }, tool_response: { stdout: '' } }), true)
  assert.equal(hookPayload({ ...commit, tool_response: { stdout: 'nothing to commit' } }).derived, undefined)
  const task = { ...base, hook_event_name: 'PostToolUse', tool_name: 'TaskCreate', tool_input: { subject: 'Fazer X', description: 'detalhe' }, tool_response: { task: { id: '7', subject: 'Fazer X' } } }
  assert.equal(createdTaskId(task), '7')
  const out = hookPayload(task)
  assert.deepEqual(out.derived, { taskId: '7' })
  assert.deepEqual(out.tool_input, { description: 'detalhe', subject: 'Fazer X' })
})

test('plano, lista de tarefas e skill: os campos que viram memória e estado', () => {
  const plan = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name: 'ExitPlanMode', tool_input: { plan: '# Carrinho\n- [ ] botão' } })
  assert.equal(plan.tool_input.plan, '# Carrinho\n- [ ] botão')
  const todo = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name: 'TodoWrite', tool_input: { todos: [{ content: 'a', status: 'completed', activeForm: 'x', extra: CODE }] } })
  assert.deepEqual(todo.tool_input.todos, [{ content: 'a', status: 'completed' }])
  const update = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name: 'TaskUpdate', tool_input: { taskId: 3, status: 'completed' } })
  assert.deepEqual(update.tool_input, { taskId: '3', status: 'completed' })
  const skill = hookPayload({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'faundr:design', args: CODE } })
  assert.deepEqual(skill.tool_input, { skill: 'faundr:design' })
})

test('pedido e resposta: sem os blocos de código, com chave mascarada e curtos', () => {
  const prompt = hookPayload({ ...base, hook_event_name: 'UserPromptSubmit', prompt: `/faundr:design arrume isto\n\`\`\`ts\n${CODE}\n\`\`\`\nchave ${key}` })
  assert.match(prompt.prompt, /^\/faundr:design arrume isto/)
  assert.ok(!prompt.prompt.includes('segredoDoCodigo') && !prompt.prompt.includes(key))
  const stop = hookPayload({ ...base, hook_event_name: 'Stop', last_assistant_message: `Pronto.\n\`\`\`\n${CODE}\n\`\`\`\n${'x'.repeat(3000)}` })
  assert.ok(!stop.last_assistant_message.includes('segredoDoCodigo'))
  assert.ok(stop.last_assistant_message.length <= 1001)
  const start = hookPayload({ ...base, hook_event_name: 'SessionStart', source: 'startup', model: 'x' })
  assert.deepEqual(start, { session_id: 's1', hook_event_name: 'SessionStart', cwd: '/proj', source: 'startup' })
})

test('subagente: o id e o tipo vão junto da ferramenta', () => {
  const out = hookPayload({ ...base, hook_event_name: 'PostToolUse', agent_id: 'a1', agent_type: 'Explore', tool_name: 'Read', tool_input: { file_path: '/proj/a.ts' } })
  assert.equal(out.agent_id, 'a1')
  assert.equal(out.agent_type, 'Explore')
})

test('mapa do código: sem cabeçalho das funções nem comentários', () => {
  const graph = {
    nodes: [
      { id: 'a', label: 'soma()', file_type: 'code', source_file: 'a.ts', signature: 'export function soma(a: number, b: number)' },
      { id: 'r', label: 'NOTE: a senha fica no cofre', file_type: 'rationale', source_file: 'a.ts' },
    ],
    links: [{ source: 'r', target: 'a' }],
  }
  const { graph: g, report } = graphForUpload(graph, 'Nós (2): soma(), NOTE: a senha fica no cofre')
  assert.deepEqual(g.nodes, [{ id: 'a', label: 'soma()', file_type: 'code', source_file: 'a.ts' }])
  assert.deepEqual(g.links, [])
  assert.equal(report, 'Nós (2): soma(), [comment]')
})

test('segurança: o trecho do código do achado não sai', () => {
  assert.deepEqual(withoutSnippets([{ title: 'x', file: 'a.ts', line: 3, snippet: CODE }]), [{ title: 'x', file: 'a.ts', line: 3 }])
})
