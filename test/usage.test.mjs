// Impacto: o uso da sessão lido da conversa do Claude Code (tokens sem contar duas vezes, subagentes, o que o
// Faundr pôs no contexto, o aviso do fim da resposta e o rodapé do grafo).
// Rodar: node --test plugin/test
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { graphFooter, rememberTranscript, transcriptUsage, transcriptsToSync } from '../bin/usage.mjs'

const usage = (input, output, cacheRead = 0) => ({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: cacheRead })
const assistant = (id, u, content = [], model = 'claude-opus-5-5') => ({ type: 'assistant', message: { id, model, usage: u, content } })
const prompt = (text) => ({ type: 'user', message: { role: 'user', content: text } })
const toolResult = (id, content) => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] } })

function writeTranscript(entries, subagents = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-u-'))
  const file = path.join(dir, 'sess.jsonl')
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n')
  if (subagents.length) {
    fs.mkdirSync(path.join(dir, 'sess', 'subagents'), { recursive: true })
    subagents.forEach((s, i) => fs.writeFileSync(path.join(dir, 'sess', 'subagents', `agent-${i}.jsonl`), s.map((e) => JSON.stringify(e)).join('\n')))
  }
  return file
}

test('soma cada resposta uma vez só, junta os subagentes e conta pedidos e ferramentas', () => {
  const file = writeTranscript(
    [
      prompt('faça X'),
      // A mesma resposta aparece em várias linhas (uma por bloco).
      assistant('m1', usage(2, 100, 1000), [{ type: 'thinking' }]),
      assistant('m1', usage(2, 100, 1000), [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.ts' } }]),
      toolResult('t1', 'x'.repeat(400)),
      assistant('m2', usage(1, 50, 2000), [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'grep -rn foo src' } }]),
      toolResult('t2', 'y'.repeat(100)),
      assistant('m3', usage(1, 10), [], '<synthetic>'),
      { type: 'user', isMeta: true, message: { content: 'interno' } },
      prompt('<local-command-stdout>ok</local-command-stdout>'),
    ],
    [[assistant('s1', usage(5, 30), [], 'claude-haiku-4-5-20251001')]],
  )
  const u = transcriptUsage(file)
  assert.equal(u.api_calls, 3)
  assert.equal(u.output_tokens, 180)
  assert.equal(u.cache_read_tokens, 3000)
  assert.equal(u.models['claude-opus-5-5'].output, 150)
  assert.equal(u.models['claude-haiku-4-5-20251001'].calls, 1)
  assert.equal(u.subagents, 1)
  assert.equal(u.user_prompts, 1)
  assert.deepEqual(u.tools, { Read: 1, Bash: 1 })
  assert.equal(u.explore_chars, 500)
})

test('mede o contexto do Faundr (enviado x o que entrou) e o custo do aviso do fim da resposta', () => {
  const sent = '[Faundr] Onde parou ' + 'z'.repeat(12_000)
  const file = writeTranscript([
    { type: 'attachment', attachment: { type: 'hook_success', hookEvent: 'SessionStart', stdout: JSON.stringify({ hookSpecificOutput: { additionalContext: sent } }) } },
    { type: 'attachment', attachment: { type: 'hook_success', hookEvent: 'SessionStart', stdout: '', content: 'outro plugin' } },
    { type: 'attachment', attachment: { type: 'hook_additional_context', hookEvent: 'SessionStart', content: ['<persisted-output>\nPreview: [Faundr] Onde parou ...'] } },
    prompt('oi'),
    assistant('a1', usage(1, 20)),
    { type: 'attachment', attachment: { type: 'hook_blocking_error', hookEvent: 'Stop', blockingError: { blockingError: '[Faundr] Antes de encerrar: bilhete' } } },
    assistant('a2', usage(1, 70, 500)),
    assistant('a3', usage(1, 30, 500)),
    prompt('próximo'),
    assistant('a4', usage(1, 999)),
  ])
  const u = transcriptUsage(file)
  assert.equal(u.injected_sent_chars, sent.length)
  assert.equal(u.injected_count, 1)
  assert.ok(u.injected_chars < 100)
  assert.equal(u.gate_blocks, 1)
  assert.deepEqual(u.gate_tokens, { input: 2, output: 100, cache_creation: 0, cache_read: 1000, calls: 2 })
})

test('consultas ao grafo: conta e lê o rodapé', () => {
  const footer = '[Faundr] Grafo: resposta ~300 tokens; arquivos citados: 2, ~9000 tokens se lidos inteiros.'
  const file = writeTranscript([
    assistant('g1', usage(1, 5), [{ type: 'tool_use', id: 'q', name: 'Bash', input: { command: 'faundr graph-query "como funciona o login"' } }]),
    toolResult('q', [{ type: 'text', text: `NODE x [src=a.ts]\n\n${footer}` }]),
  ])
  const u = transcriptUsage(file)
  assert.equal(u.graph_queries, 1)
  assert.equal(u.graph_answer_tokens, 300)
  assert.equal(u.graph_files_tokens, 9000)
  assert.equal(u.explore_chars, 0)
})

test('rodapé do grafo: soma os arquivos citados que existem (até 2000 linhas cada)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-g-'))
  fs.mkdirSync(path.join(dir, 'src'))
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'a'.repeat(400))
  fs.writeFileSync(path.join(dir, 'src', 'big.ts'), 'linha\n'.repeat(5000))
  const out = 'NODE f() [src=src/a.ts loc=L1]\n  --> g() [calls] src/big.ts:L10\nNODE h [src=sumiu.ts]'
  assert.match(graphFooter(out, dir), /arquivos citados: 2, ~3100 tokens/)
  assert.equal(graphFooter('nada citado', dir), '')
})

test('reenvio do uso: lembra as conversas e devolve as de sessões anteriores', () => {
  let pending = rememberTranscript(undefined, 'a', '/t/a.jsonl', 1)
  pending = rememberTranscript(pending, 'b', '/t/b.jsonl', 2)
  pending = rememberTranscript(pending, 'a', '/t/a.jsonl', 3)
  assert.deepEqual(Object.keys(pending), ['a', 'b'])
  assert.deepEqual(transcriptsToSync(pending, 'a'), [{ sid: 'b', path: '/t/b.jsonl' }])
  assert.deepEqual(transcriptsToSync(pending, null).map((s) => s.sid), ['a', 'b'])
  assert.deepEqual(rememberTranscript(pending, null, '/t/x.jsonl', 4), pending)
  for (let i = 0; i < 30; i++) pending = rememberTranscript(pending, `s${i}`, `/t/${i}.jsonl`, 10 + i)
  assert.equal(Object.keys(pending).length, 20)
  assert.ok(pending.s29 && !pending.a)
})
