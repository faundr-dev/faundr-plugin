import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { agentsBlock, END, removeBlock, START, upsertBlock } from '../bin/agents-md.mjs'

const items = [
  { kind: 'rule', title: 'Auth fica no Supabase', body: '' },
  { kind: 'rule', title: 'Rotas conferem o acesso', body: 'use\nassertProjectAccess', paths: ['src/routes/api/**'] },
  { kind: 'decision', title: 'Deploy na Cloudflare', body: 'Workers' },
]

test('bloco: regras com onde valem e decisões', () => {
  const b = agentsBlock(items, 'Lojinha')
  assert.match(b, /^## Memória do time \(Lojinha\), pelo Faundr/)
  assert.match(b, /- Rotas conferem o acesso — use assertProjectAccess \(vale para: src\/routes\/api\/\*\*\)/)
  assert.match(b, /Decisões técnicas já tomadas[^\n]*\n- Deploy na Cloudflare — Workers/)
  assert.match(agentsBlock([], null), /Nenhuma regra ou decisão/)
})

test('cria, mantém o resto do arquivo, troca no lugar, não regrava se igual, e remove', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-a-'))
  const file = path.join(dir, 'AGENTS.md')
  assert.equal(upsertBlock(file, 'um'), 'criado')
  assert.equal(fs.readFileSync(file, 'utf8'), `${START}\num\n${END}\n`)
  assert.equal(removeBlock(file), 'apagado')
  // Arquivo do usuário com CRLF: o bloco entra no fim, e a troca acontece no mesmo lugar.
  fs.writeFileSync(file, '# Meu projeto\r\n\r\nTexto meu.\r\n')
  assert.equal(upsertBlock(file, 'um'), 'acrescentado')
  fs.appendFileSync(file, '\r\nDepois do bloco.\r\n')
  assert.equal(upsertBlock(file, 'um'), 'igual')
  assert.equal(upsertBlock(file, 'dois\nlinhas'), 'atualizado')
  const text = fs.readFileSync(file, 'utf8')
  assert.equal(text, `# Meu projeto\r\n\r\nTexto meu.\r\n\r\n${START}\r\ndois\r\nlinhas\r\n${END}\r\n\r\nDepois do bloco.\r\n`)
  assert.equal(removeBlock(file), 'removido')
  assert.equal(fs.readFileSync(file, 'utf8'), '# Meu projeto\r\n\r\nTexto meu.\r\n\r\nDepois do bloco.\r\n')
  assert.equal(removeBlock(file), 'sem-bloco')
  fs.rmSync(dir, { recursive: true, force: true })
})
