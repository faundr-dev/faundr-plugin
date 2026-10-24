import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { codexExitCode, codexExitCodeWait, codexMeters, isCodexRollout } from '../bin/codex-transcript.mjs'
import { transcriptMark, transcriptUsage, usageSince } from '../bin/usage.mjs'

// Rollout do Codex enxuto, com o formato real (0.164): rodada, aviso do Faundr no contexto, pedido, chamada de
// ferramenta no modo de código, resposta com tokens, aviso do fim (HookPrompt) e a resposta que ele custou.
const usage = (input, cached, output) => ({ input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: 0, output_tokens: output })
const LINES = [
  { type: 'session_meta', payload: { id: 's1' } },
  { type: 'turn_context', payload: { model: 'gpt-6.1-sol' } },
  { type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '[Faundr] Team rules: x' }] } },
  { type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'You are Codex' }] } },
  { type: 'event_msg', payload: { type: 'item_completed', item: { type: 'UserMessage', content: [{ type: 'text', text: 'faça a soma' }] } } },
  {
    type: 'response_item',
    payload: {
      type: 'custom_tool_call',
      name: 'exec',
      call_id: 'c1',
      input: 'text(await tools.exec_command({cmd:"Get-Content -LiteralPath \'index.js\'"}));\ntext(await tools.apply_patch("*** Begin Patch"));',
    },
  },
  { type: 'token_usage_record', payload: { response_id: 'r1', usage: usage(1000, 600, 50) } },
  { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'c1', output: [{ type: 'input_text', text: 'console.log(1)' }] } },
  { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'c2', arguments: '{"cmd":"node faundr.mjs graph-query \\"soma\\""}' } },
  { type: 'response_item', payload: { type: 'function_call_output', call_id: 'c2', output: '[Faundr] Graph: answer ~30 tokens; files cited: 1, ~5 tokens if read in full.' } },
  { type: 'event_msg', payload: { type: 'item_completed', item: { type: 'HookPrompt', fragments: [{ text: '[Faundr] Before finishing: x' }] } } },
  { type: 'token_usage_record', payload: { response_id: 'r2', usage: usage(200, 100, 20) } },
  { type: 'event_msg', payload: { type: 'token_count', info: { model_context_window: 400000, last_token_usage: { input_tokens: 100000 } }, rate_limits: { plan_type: 'plus', primary: { used_percent: 4, resets_at: 1792882500 }, secondary: { used_percent: 1, resets_at: 1793469300 } } } },
]

function rollout(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-rollout-'))
  const file = path.join(dir, 'rollout.jsonl')
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  return { file, done: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

test('conversa do Codex: tokens, ferramentas, avisos do Faundr e o aviso do fim na mesma medida do Claude Code', () => {
  const { file, done } = rollout(LINES)
  try {
    const u = transcriptUsage(file)
    // A entrada do Codex inclui o cache: aqui ela sai separada, como no Claude Code.
    assert.deepEqual(u.models, { 'gpt-6.1-sol': { input: 500, output: 70, cache_creation: 0, cache_read: 700, calls: 2 } })
    assert.equal(u.user_prompts, 1)
    assert.deepEqual(u.tools, { Bash: 2, apply_patch: 1 })
    assert.equal(u.explore_chars, 'console.log(1)'.length)
    assert.equal(u.injected_count, 1)
    assert.equal(u.injected_chars, '[Faundr] Team rules: x'.length)
    assert.equal(u.gate_blocks, 1)
    assert.deepEqual(u.gate_tokens, { input: 100, output: 20, cache_creation: 0, cache_read: 100, calls: 1 })
    assert.equal(u.graph_queries, 1)
    assert.equal(u.graph_answer_tokens, 30)
  } finally {
    done()
  }
})

test('conversa do Codex: custo depois da marca leva o modelo da rodada anterior', () => {
  const { file, done } = rollout(LINES.slice(0, 7))
  try {
    const mark = transcriptMark(file)
    fs.appendFileSync(file, JSON.stringify(LINES[11]) + '\n')
    assert.deepEqual(usageSince(file, mark), { input: 100, output: 20, cache_creation: 0, cache_read: 100, calls: 1, models: { 'gpt-6.1-sol': 1 } })
  } finally {
    done()
  }
})

test('conversa do Codex: contexto e % do plano no formato dos medidores da barra', () => {
  assert.deepEqual(codexMeters(LINES, { sessionId: 's1', now: 5 }), {
    session_id: 's1',
    context_pct: 25,
    context_size: 400000,
    five_hour: { pct: 4, resets_at: 1792882500 },
    seven_day: { pct: 1, resets_at: 1793469300 },
    model: 'gpt-6.1-sol',
    at: 5,
  })
  assert.equal(codexMeters(LINES.slice(0, 3)), null)
})

test('conversa do Codex: código de saída do comando pelo id que o hook recebe', () => {
  const item = (id, code) => ({ type: 'event_msg', payload: { type: 'item_completed', item: { type: 'CommandExecution', id, status: code ? 'failed' : 'completed', exit_code: code } } })
  const { file, done } = rollout([...LINES, item('exec-1', 0), item('exec-2', 1)])
  try {
    assert.equal(codexExitCode(file, 'exec-1'), 0)
    assert.equal(codexExitCode(file, 'exec-2'), 1)
    assert.equal(codexExitCode(file, 'exec-3'), null)
    assert.equal(codexExitCode(null, 'exec-1'), null)
  } finally {
    done()
  }
})

test('conversa do Codex: espera o item do comando chegar, se o hook rodou antes', async () => {
  const { file, done } = rollout(LINES)
  try {
    const item = { type: 'event_msg', payload: { type: 'item_completed', item: { type: 'CommandExecution', id: 'exec-9', exit_code: 1 } } }
    setTimeout(() => fs.appendFileSync(file, JSON.stringify(item) + '\n'), 200)
    assert.equal(await codexExitCodeWait(file, 'exec-9', { timeoutMs: 2000, everyMs: 50 }), 1)
    assert.equal(await codexExitCodeWait(file, 'exec-nunca', { timeoutMs: 120, everyMs: 50 }), null)
  } finally {
    done()
  }
})

test('conversa do Codex: reconhece o arquivo pelo nome, com barra normal ou invertida', () => {
  assert.equal(isCodexRollout(String.raw`C:\Users\ana\.codex\sessions\2026\10\24\rollout-2026-10-24T15-37-38-01a1.jsonl`), true)
  assert.equal(isCodexRollout('/home/ana/.codex/sessions/2026/10/24/rollout-x.jsonl'), true)
  assert.equal(isCodexRollout(String.raw`C:\Users\ana\.claude\projects\x\6b955178.jsonl`), false)
  assert.equal(isCodexRollout(undefined), false)
})
