import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import os from 'node:os'
import { emptyUsage, transcriptUsage } from '../bin/usage.mjs'

// Contrato do Impacto (ideia do Graft, test/telemetry-contract.test.ts): docs/impacto-contrato.md, usage.mjs e o
// servidor têm de concordar sobre os campos.
const root = path.resolve(import.meta.dirname, '..', '..')
const doc = fs.readFileSync(path.join(root, 'docs/impacto-contrato.md'), 'utf8')
const documented = [...doc.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]).sort()

test('os campos documentados são os que o plugin monta', () => {
  assert.deepEqual(documented, Object.keys(emptyUsage()).sort())
})

test('todo contador que o servidor guarda está no contrato', () => {
  const server = fs.readFileSync(path.join(root, 'src/server/impact.ts'), 'utf8')
  const counters = [...server.match(/const COUNTERS = \[([\s\S]*?)\]/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.ok(counters.length > 5)
  for (const c of counters) assert.ok(documented.includes(c), `${c} está no servidor e falta no contrato`)
})

test('só números saem da conversa, nunca texto', () => {
  const entries = [
    { type: 'user', message: { content: 'minha senha é hunter2' } },
    {
      type: 'assistant',
      requestId: 'r1',
      message: { id: 'm1', model: 'claude-sonnet-5-5', usage: { input_tokens: 3, output_tokens: 5 }, content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'faundr graph-callers applyCoupon' } }] },
    },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'saída\n\n[Faundr] Grafo: resposta ~10 tokens; arquivos citados: 1, ~200 tokens se lidos inteiros.' }] } },
  ]
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-u-')), 's.jsonl')
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n'))
  const usage = transcriptUsage(file)
  assert.equal(usage.input_tokens, 3)
  assert.equal(usage.graph_queries, 1)
  assert.equal(usage.graph_answer_tokens, 10)
  const walk = (v, where) => {
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`)
    else assert.equal(typeof v, 'number', `${where} não é número`)
  }
  walk(usage, 'usage')
  assert.doesNotMatch(JSON.stringify(usage), /hunter2|applyCoupon/)
})
