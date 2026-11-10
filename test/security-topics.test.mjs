// Temas da revisão de segurança com IA: plugin de agente e extensão de navegador entram mesmo sem telas nem SDK de LLM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectMap } from '../bin/security.mjs'

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-topics-'))
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  return root
}

test('plugin de agente (hooks) lê o tema de IA mesmo sem SDK de LLM', () => {
  const root = project({ 'hooks/hooks.json': '{"hooks":{}}', 'bin/hook.mjs': 'console.log(1)\n' })
  try {
    assert.ok(projectMap(root).topics.includes('ai-and-llm'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('extensão de navegador (manifest.json) lê o tema de navegador mesmo sem telas', () => {
  const root = project({ 'extension/manifest.json': '{"manifest_version":3}', 'extension/background.js': 'chrome.runtime\n' })
  try {
    assert.ok(projectMap(root).topics.includes('browser'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('projeto só com servidor não ganha os temas de navegador nem de IA', () => {
  const root = project({ 'server.js': 'require("http")\n' })
  try {
    const { topics } = projectMap(root)
    assert.ok(!topics.includes('browser'))
    assert.ok(!topics.includes('ai-and-llm'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
