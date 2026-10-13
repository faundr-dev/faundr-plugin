import assert from 'node:assert/strict'
import { test } from 'node:test'
import { maskPayload } from '../bin/security.mjs'

test('evento do diário sai sem a chave que o Claude leu', () => {
  const key = 'sk-ant-api03-' + 'q7Wm2Zx9Lr4Tn8Vb1Hc6Jp3Ks5Df0Gy'.repeat(3).slice(0, 93) + 'AA'
  const aws = 'AKIA' + 'Q3RZ7WMX2LTN8VB5'
  const payload = {
    hook_event_name: 'PostToolUse',
    tool_name: 'Read',
    tool_input: { file_path: '.env' },
    tool_response: { file: { content: `ANTHROPIC_API_KEY=${key}\nPORT=3000` } },
    list: [`echo ${key}`, `aws_access_key_id=${aws}`, 'DATABASE_URL=postgres://app:Zx9Lr4Tn8Vb1@db.host:5432/app'],
    n: 3,
  }
  const out = maskPayload(payload)
  for (const secret of [key, aws, 'Zx9Lr4Tn8Vb1']) assert.ok(!JSON.stringify(out).includes(secret), secret)
  assert.equal(out.tool_input.file_path, '.env')
  assert.equal(out.n, 3)
  assert.match(out.tool_response.file.content, /PORT=3000/)
})

test('texto sem segredo passa igual', () => {
  const payload = { prompt: 'arrume o botão de comprar no celular', tool_input: { command: 'npm test' } }
  assert.deepEqual(maskPayload(payload), payload)
})
