import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const json = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))

test('plugin do Codex: mesma versão dos manifestos do Claude Code e do npm', () => {
  const version = json('.claude-plugin/plugin.json').version
  assert.equal(json('.codex-plugin/plugin.json').version, version)
  assert.equal(json('package.json').version, version)
})

test('plugin do Codex: hooks próprios, que avisam ao Faundr que vêm do Codex', () => {
  const manifest = json('.codex-plugin/plugin.json')
  assert.equal(manifest.hooks, './hooks/codex.json')
  assert.equal(manifest.skills, './skills/')
  const { hooks } = json('hooks/codex.json')
  // Eventos que o Codex não tem (ou que só existem no Claude Code) ficam de fora.
  for (const ev of ['Notification', 'PostToolUseFailure']) assert.ok(!hooks[ev], ev)
  const commands = Object.values(hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.command)))
  for (const c of commands) {
    assert.ok(c.includes('${PLUGIN_ROOT}'), c)
    // Todo hook do Codex avisa ao Faundr de onde vem (agente, texto com $faundr:, medição).
    assert.match(c, / codex$/, c)
  }
  const edit = hooks.PreToolUse.find((g) => g.hooks[0].command.includes('guard codex'))
  assert.match('apply_patch', new RegExp(`^(${edit.matcher})$`))
})

test('plugin do Codex: catálogo de instalação aponta para a própria pasta', () => {
  const market = json('.agents/plugins/marketplace.json')
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source.path]), [['faundr', './']])
})
