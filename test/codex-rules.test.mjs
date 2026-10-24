import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { codexLauncher, codexRulesFile, codexRulesText, launcherText, syncCodexRules } from '../bin/codex-rules.mjs'

test('regra do Codex: libera só o node com o atalho de caminho fixo, com / e com barra invertida', () => {
  const home = path.join('C:', 'Users', 'ana')
  const text = codexRulesText(home)
  assert.match(text, /pattern = \["node", \[/)
  assert.match(text, /decision = "allow"/)
  // No arquivo de regras a barra invertida vem dobrada (texto entre aspas).
  if (path.sep === '\\') assert.ok(text.includes('"C:/Users/ana/.faundr/codex/faundr.mjs"') && text.includes('"C:\\\\Users\\\\ana\\\\.faundr\\\\codex\\\\faundr.mjs"'))
})

test('atalho do Codex: chama o faundr.mjs da versão instalada', () => {
  const text = launcherText(path.join(os.tmpdir(), 'plugin', '1.2.3'))
  assert.match(text, /await import\("file:\/\/.*\/plugin\/1\.2\.3\/bin\/faundr\.mjs"\)/)
})

test('regra do Codex: o início da sessão só atualiza o atalho; a regra nasce no setup', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-codex-'))
  try {
    assert.equal(syncCodexRules('/plugin/1', { home }), false)
    assert.ok(fs.existsSync(codexLauncher(home)))
    assert.ok(!fs.existsSync(codexRulesFile(home)))
    assert.equal(syncCodexRules('/plugin/1', { home, create: true }), true)
    const rule = fs.readFileSync(codexRulesFile(home), 'utf8')
    // Versão nova do plugin: o atalho muda, a regra continua igual.
    assert.equal(syncCodexRules('/plugin/2', { home }), true)
    assert.ok(fs.readFileSync(codexLauncher(home), 'utf8').includes('plugin/2'))
    assert.equal(fs.readFileSync(codexRulesFile(home), 'utf8'), rule)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
