import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { codexRulesFile, codexRulesText, removeCodexRules, syncCodexRules } from '../bin/codex-rules.mjs'

test('regra do Codex: libera só o node com o faundr.mjs do plugin, com / e com barra invertida', () => {
  const text = codexRulesText(path.join('C:', 'p', 'faundr', '1.0.0'))
  assert.match(text, /pattern = \["node", \[/)
  assert.match(text, /decision = "allow"/)
  // No arquivo de regras a barra invertida vem dobrada (texto entre aspas).
  if (path.sep === '\\') assert.ok(text.includes('"C:/p/faundr/1.0.0/bin/faundr.mjs"') && text.includes('"C:\\\\p\\\\faundr\\\\1.0.0\\\\bin\\\\faundr.mjs"'))
})

test('regra do Codex: o início da sessão só atualiza a que o setup criou', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-codex-'))
  try {
    assert.equal(syncCodexRules('/plugin/1', { home }), false)
    assert.ok(!fs.existsSync(codexRulesFile(home)))
    assert.equal(syncCodexRules('/plugin/1', { home, create: true }), true)
    assert.equal(syncCodexRules('/plugin/1', { home }), false)
    assert.equal(syncCodexRules('/plugin/2', { home }), true)
    assert.ok(fs.readFileSync(codexRulesFile(home), 'utf8').includes('plugin/2'))
    removeCodexRules(home)
    assert.ok(!fs.existsSync(codexRulesFile(home)))
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
