import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ruleIntent, ruleNudge } from '../bin/intent.mjs'
import { globalRules, relevantMemory, stemsOf } from '../bin/rules.mjs'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')

// Um pedaço da memória real do próprio Faundr.
const INDEX = [
  { id: 'r1', kind: 'rule', title: 'Auth fica no Supabase. Deploy na Cloudflare.', body: '', paths: [] },
  { id: 'd1', kind: 'decision', title: 'Identidade visual só em preto (#151515) e branco, GT Walsheim Medium nos títulos', body: 'Definição de marca do Faundr', paths: [] },
  { id: 'd2', kind: 'decision', title: 'Inter como fonte de texto (títulos continuam em GT Walsheim)', body: 'O dono não gostou da fonte do sistema; Inter hospedada no próprio app', paths: [] },
  { id: 'd3', kind: 'decision', title: 'Menu lateral abre por cima do conteúdo no hover e pode ser fixado; logo fica no header', body: 'Pedido do dono, no estilo do Supabase', paths: [] },
  { id: 'd4', kind: 'decision', title: 'O Faundr nunca instala ferramenta de teste sozinho: mostra o comando e o Claude instala com o OK do dono', body: 'Instalar muda o package.json do projeto', paths: [] },
  { id: 'd5', kind: 'decision', title: 'Medir tokens lendo a conversa do Claude Code (transcript), sem estimar', body: 'O arquivo já traz o uso real de cada resposta', paths: [] },
  { id: 'd6', kind: 'decision', title: 'Pontos de volta guardados no próprio git (refs/faundr/checkpoints)', body: 'Funciona offline', paths: ['plugin/bin/checkpoints.mjs'] },
  { id: 'd7', kind: 'decision', title: 'Chave sendo gravada: avisar sempre e barrar as mais perigosas', body: 'Barra Stripe live e service_role', paths: [] },
  { id: 'r2', kind: 'rule', title: 'Toda rota do servidor confere o acesso ao projeto', body: '', paths: ['src/routes/api/**'] },
]

test('stemsOf: sem acento, sem plural, sem palavra vazia', () => {
  assert.deepEqual([...stemsOf('As Decisões técnicas para o projeto')], ['decisoe', 'tecnica', 'projeto'])
})

test('memória pelo assunto: traz a decisão do assunto do pedido', () => {
  assert.deepEqual(relevantMemory(INDEX, 'não estou gostando da fonte do sistema... substitua por inter').map((m) => m.id), ['d2'])
  assert.ok(relevantMemory(INDEX, 'a logo deve ficar no header e o menu lateral por cima').some((m) => m.id === 'd3'))
  // Ligada a arquivo também vale pelo assunto.
  assert.deepEqual(relevantMemory(INDEX, 'os pontos de volta do git estão lentos no checkpoints').map((m) => m.id), ['d6'])
})

test('memória pelo assunto: termo solto, pedido curto, já mostrada e texto colado não trazem nada', () => {
  assert.deepEqual(relevantMemory(INDEX, 'vou abrir o navegador, feito'), [])
  assert.deepEqual(relevantMemory(INDEX, 'pode'), [])
  assert.deepEqual(relevantMemory(INDEX, 'substitua a fonte do sistema por inter', ['d2']), [])
  assert.deepEqual(relevantMemory(INDEX, 'olha isso <pasted_content id="1">fonte do sistema inter</pasted_content>'), [])
})

test('regras sem arquivo: as que vão para os subagentes', () => {
  assert.deepEqual(globalRules(INDEX).map((m) => m.id), ['r1'])
})

test('regra dita no chat: avisa nas frases de regra, não nas outras', () => {
  for (const p of [
    'cuidado, que tem tokens de outra conta, não apague',
    'a partir de agora use sempre o pnpm',
    'nunca publique sem me perguntar antes',
    'não pode usar axios no front',
    'cuidado pra não colocar um branco 100%',
  ])
    assert.equal(ruleIntent(p), 'rule', p)
  for (const p of ['pode', 'nunca tinha visto isso, que legal', 'qual o comando para instalar o plugin?', '/faundr:rule nunca use axios', 'o painel sempre mostra 3 erros?'])
    assert.equal(ruleIntent(p), null, p)
  assert.match(ruleNudge(), /faundr rule/)
})

function run(script, args, { input = '', env = {}, cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(BIN, script), ...args], { cwd, env: { ...process.env, ...env } })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('close', (code) => resolve({ code, out, err }))
    child.stdin.end(input)
  })
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-mem-'))
  fs.writeFileSync(path.join(root, '.faundr.json'), JSON.stringify({ projectId: 'p1' }))
  fs.mkdirSync(path.join(root, '.faundr'))
  fs.writeFileSync(path.join(root, '.faundr', 'memory.json'), JSON.stringify(INDEX))
  return root
}

test('hook do pedido: entrega a decisão do assunto uma vez por sessão e o aviso de regra', async () => {
  const root = project()
  const ask = (prompt, session_id = 's1') => run('prompt-check.mjs', [], { input: JSON.stringify({ cwd: root, session_id, prompt }) })
  const first = JSON.parse((await ask('troque a fonte do sistema por inter')).out).hookSpecificOutput.additionalContext
  assert.match(first, /Inter como fonte de texto/)
  assert.equal((await ask('de novo: a fonte do sistema inter')).out, '')
  assert.match((await ask('de novo: a fonte do sistema inter', 's2')).out, /Inter como fonte/)
  const rule = JSON.parse((await ask('cuidado, que tem tokens de outra conta, não apague')).out).hookSpecificOutput.additionalContext
  assert.match(rule, /faundr rule/)
})

test('subagente: recebe as regras do time sem arquivo', async () => {
  const root = project()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  const { out } = await run('faundr.mjs', ['subagent-start'], { input: JSON.stringify({ cwd: root }), env: { HOME: home, USERPROFILE: home } })
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext
  assert.match(ctx, /Regras do time[^]*Auth fica no Supabase/)
  assert.doesNotMatch(ctx, /Toda rota do servidor/)
})

test('decision: liga sozinha aos arquivos editados, avisa a parecida e --replaces aposenta a antiga', async () => {
  const root = project()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  fs.mkdirSync(path.join(home, '.faundr'))
  fs.writeFileSync(path.join(root, '.faundr', 'state.json'), JSON.stringify({ sessionStart: { session: 'abc', at: 1 } }))
  fs.writeFileSync(path.join(home, '.faundr', 'edited-abc'), `${path.join(root, 'src', 'theme.css')}\n${path.join(root, 'src', 'fonts.ts')}\n`)
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const b = JSON.parse(body)
      calls.push(b)
      res.setHeader('content-type', 'application/json')
      if (b.replaces) return res.end(JSON.stringify({ id: 'new2', replaced: { id: 'd2', title: 'Inter como fonte de texto' } }))
      res.end(JSON.stringify({ id: 'new1abcdef', similar: [{ id: 'd2xxxxxx', kind: 'decision', title: 'Inter como fonte de texto' }] }))
    })
  })
  await new Promise((r) => server.listen(0, r))
  const env = { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: `http://127.0.0.1:${server.address().port}` }
  try {
    const a = await run('faundr.mjs', ['decision', 'Fonte Geist no lugar da Inter', '--why', 'mais legível'], { cwd: root, env })
    assert.deepEqual(calls[0].paths, ['src/theme.css', 'src/fonts.ts'], a.err)
    assert.match(a.out, /ligada aos arquivos que esta sessão editou/)
    assert.match(a.out, /Parece com: d2xxxx "Inter como fonte de texto"/)
    const g = await run('faundr.mjs', ['decision', 'Fonte vale para tudo', '--global'], { cwd: root, env })
    assert.deepEqual(calls[1].paths, [], g.err)
    const r = await run('faundr.mjs', ['decision', 'Fonte Geist', '--replaces', 'Inter como fonte'], { cwd: root, env })
    assert.equal(calls[2].replaces, 'Inter como fonte', r.err)
    assert.match(r.out, /Substitui "Inter como fonte de texto"/)
    const index = JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'memory.json'), 'utf8'))
    assert.ok(!index.some((m) => m.id === 'd2') && index.some((m) => m.id === 'new2'))
  } finally {
    server.close()
  }
})
