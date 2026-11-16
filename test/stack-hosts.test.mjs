import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { detectStack, stackHash } from '../bin/stack.mjs'

// Projeto de exemplo numa pasta temporária, com os arquivos no git (a Stack lê o que está no git).
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-stack-hosts-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['add', '-A'], { cwd: dir })
  return dir
}
const PKG = JSON.stringify({ name: 'app', dependencies: { react: '19.0.0' } })
const service = (stack, name) => stack.services.find((s) => s.name === name)

test('Stripe chamado por fetch, sem o pacote: entra como serviço de pagamentos, com as variáveis e o arquivo', () => {
  const { stack } = detectStack(project({
    'package.json': PKG,
    '.dev.vars.example': 'STRIPE_SECRET_KEY=\nSTRIPE_WEBHOOK_SECRET=\n',
    'src/server/stripe.ts': 'export const call = (key: string) => fetch(`https://api.stripe.com/v1/customers`, { headers: { Authorization: `Bearer ${key}` } })\n',
  }))
  const stripe = service(stack, 'Stripe')
  assert.equal(stripe?.category, 'pagamentos')
  assert.deepEqual(stripe.evidence, ['src/server/stripe.ts'])
  assert.deepEqual(stripe.env, ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'])
})

test('Endereço de API só em teste, exemplo ou texto não vira serviço', () => {
  const { stack } = detectStack(project({
    'package.json': PKG,
    'src/pay.test.ts': 'const url = "https://api.stripe.com/v1/charges"\n',
    'tests/mail.ts': 'const url = "https://api.resend.com/emails"\n',
    'README.md': 'Chama https://api.openai.com/v1/chat\n',
    'src/app.ts': 'export const site = "https://stripe.com/br"\n',
  }))
  assert.deepEqual(stack.services, [])
})

test('Pacote e endereço do mesmo serviço: um serviço só; o serviço novo muda a impressão digital', () => {
  const base = { 'package.json': JSON.stringify({ name: 'app', dependencies: { stripe: '17.0.0' } }), 'src/a.ts': 'export const a = 1\n' }
  const before = detectStack(project(base))
  const after = detectStack(project({ ...base, 'src/a.ts': 'fetch("https://api.stripe.com/v1/x"); fetch("https://api.asaas.com/v3/payments")\n' }))
  assert.equal(after.stack.services.filter((s) => s.name === 'Stripe').length, 1)
  assert.deepEqual(service(after.stack, 'Stripe').evidence, ['package.json', 'src/a.ts'])
  assert.equal(service(after.stack, 'Asaas')?.category, 'pagamentos')
  assert.notEqual(stackHash(before.stack), stackHash(after.stack))
})
