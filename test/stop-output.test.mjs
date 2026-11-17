import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stopOutput } from '../bin/hook-events.mjs'

test('fim da resposta: no Claude Code vai como lembrete (additionalContext), não como erro', () => {
  const out = stopOutput(['passo um', 'passo dois'], 'claude')
  assert.equal(out.decision, undefined)
  assert.equal(out.hookSpecificOutput.hookEventName, 'Stop')
  assert.match(out.hookSpecificOutput.additionalContext, /^\[Faundr\] Before finishing: \(1\) passo um; \(2\) passo dois\./)
  assert.match(out.hookSpecificOutput.additionalContext, /complete final response/)
})

test('fim da resposta: no Codex continua o decision block', () => {
  const out = stopOutput(['um passo'], 'codex')
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /^\[Faundr\] Before finishing: um passo\./)
  assert.match(out.reason, /reply in a few lines/)
})
