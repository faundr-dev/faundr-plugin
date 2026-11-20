// "O que foi feito sempre aparece concluído": os comandos e o fim da resposta que mantêm o quadro em dia com o trabalho.
// Cada teste sobe um painel de mentira e roda o faundr de verdade numa pasta ligada.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')
const SID = 'sessao-1'

function run(args, { input = '', env = {}, cwd } = {}) {
  // Rodando dentro do Claude Code, a sessão de quem roda os testes não pode vazar para o comando.
  const { CLAUDE_CODE_SESSION_ID: _, ...parent } = process.env
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(BIN, 'faundr.mjs'), ...args], { cwd, env: { ...parent, ...env } })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('close', (code) => resolve({ code, out, err }))
    child.stdin.end(input)
  })
}

const task = (title, task_status = 'pending', extra = {}) => ({ id: `id-${title}`, title, task_status, ...extra })
// "Vazia": a sessão criou e não registrou nada. "Presa": critérios todos atendidos e uma tarefa de construir aberta.
const BOARD = [
  { id: 'vazia', title: 'Memória pronta para lançar', finished: false, planned: false, next: [], tasks: [], criteria: [{ text: 'auditada', met: null }] },
  {
    id: 'presa',
    title: 'Stacks de startups',
    finished: false,
    planned: false,
    next: [],
    criteria: [{ text: 'no ar', met: true }, { text: 'testada', met: true }],
    tasks: [task('Vitrine', 'completed'), task('Trocar Apps por Estudos de caso'), task('Conferir no celular', 'pending', { task_review: true })],
  },
  { id: 'ideia', title: 'Construtor de agentes', finished: false, planned: true, next: [], tasks: [], criteria: [] },
]

/** Pasta ligada, estado da pasta e um painel de mentira: `respond(body)` devolve a resposta (ou undefined = padrão). */
async function setup(state = {}, respond = () => undefined) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-done-'))
  fs.writeFileSync(path.join(root, '.faundr.json'), JSON.stringify({ projectId: 'p1' }))
  fs.mkdirSync(path.join(root, '.faundr'), { recursive: true })
  fs.writeFileSync(path.join(root, '.faundr', 'state.json'), JSON.stringify(state))
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  fs.mkdirSync(path.join(home, '.faundr'))
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const b = body ? JSON.parse(body) : {}
      calls.push(b)
      res.setHeader('content-type', 'application/json')
      const custom = respond(b)
      if (custom !== undefined) return res.end(JSON.stringify(custom))
      if (b.action === 'board') return res.end(JSON.stringify({ features: b.featureId ? BOARD.filter((f) => f.id === b.featureId) : BOARD, allFeatures: BOARD }))
      res.end(JSON.stringify({ id: 'nova', criteria: [], title: 'x' }))
    })
  })
  await new Promise((r) => server.listen(0, r))
  const env = { HOME: home, USERPROFILE: home, FAUNDR_TOKEN: 't', FAUNDR_API_URL: `http://127.0.0.1:${server.address().port}`, CLAUDE_CODE_SESSION_ID: SID }
  const readState = () => JSON.parse(fs.readFileSync(path.join(root, '.faundr', 'state.json'), 'utf8'))
  // A sessão mexeu em arquivos: o fim da resposta só confere o quadro nesse caso.
  const edited = () => fs.writeFileSync(path.join(home, '.faundr', `edited-${SID}`), `${path.join(root, 'src', 'a.ts')}\n`)
  const gate = async () => {
    const r = await run(['gate', 'claude'], { cwd: root, env, input: JSON.stringify({ session_id: SID, cwd: root }) })
    return r.out ? JSON.parse(r.out).hookSpecificOutput.additionalContext : ''
  }
  const cli = (...args) => run(args, { cwd: root, env })
  return { root, env, calls, of: (action) => calls.filter((c) => c.action === action), readState, edited, gate, cli, close: () => server.close() }
}

const chosen = (id, how = 'created') => ({ currentFeatureId: id, featureBySession: { [SID]: { id, at: Date.now(), how } } })

// ---- faundr feature ------------------------------------------------------------------------------------------

test('faundr feature: a sessão vai junto, a funcionalidade vira a atual "criada" e a saída pede as tarefas', async () => {
  const s = await setup()
  try {
    const a = await s.cli('feature', 'Convites', '--done-when', 'o e-mail chega')
    assert.match(a.out, /Feature created and set as current: Convites/, a.err)
    assert.match(a.out, /Next: one faundr task "<step>" per step/)
    const add = s.of('add')[0]
    assert.equal(add.agentSessionId, SID)
    assert.equal(add.later, undefined)
    assert.deepEqual(s.readState().featureBySession[SID].how, 'created')
  } finally {
    s.close()
  }
})

test('faundr feature no meio de um workflow: os passos viram o checklist e a saída diz para não repetir com faundr task', async () => {
  const s = await setup({}, (b) => (b.action === 'add' ? { id: 'nova', workflows: [{ ref: 'W-2', tasks: 11 }] } : undefined))
  try {
    const a = await s.cli('feature', 'Skills pronta para lançar')
    assert.match(a.out, /Its checklist is the 11 step\(s\) of W-2, with what is already done/, a.err)
    assert.match(a.out, /no faundr task for them/)
    assert.doesNotMatch(a.out, /Next: one faundr task/)
  } finally {
    s.close()
  }
})

test('faundr feature --later: ideia guardada não começa, não vira a atual e não leva o workflow da sessão', async () => {
  const s = await setup(chosen('presa'))
  try {
    const a = await s.cli('feature', 'Construtor de workflows por voz', '--later', '--desc', 'Ideia para o futuro')
    assert.match(a.out, /Recorded for later \(not started/, a.err)
    const add = s.of('add')[0]
    assert.equal(add.later, true)
    assert.equal(add.agentSessionId, undefined)
    assert.equal(s.readState().currentFeatureId, 'presa')
    assert.equal(s.readState().featureBySession[SID].id, 'presa')
  } finally {
    s.close()
  }
})

test('faundr focus numa funcionalidade que não começou: ela começa (sai de Próximas etapas) e fica como escolhida', async () => {
  const s = await setup()
  try {
    const a = await s.cli('focus', 'Construtor de agentes')
    assert.match(a.out, /Current feature:/, a.err)
    assert.equal(s.of('feature-start')[0].featureId, 'ideia')
    assert.equal(s.readState().featureBySession[SID].how, 'focused')
    // Já em andamento: não há o que começar.
    await s.cli('focus', 'Stacks de startups')
    assert.equal(s.of('feature-start').length, 1)
  } finally {
    s.close()
  }
})

// ---- critérios, fechar à mão e tipo da tarefa ----------------------------------------------------------------

test('faundr criteria-check: com todos atendidos, diz como ficou no quadro e quais tarefas de construir ainda seguram', async () => {
  const held = { title: 'Stacks de startups', criteria: [{ text: 'a', met: true }], state: { finished: false, doneBy: null, tasks: 3, openBuild: [{ n: 2, title: 'Trocar Apps por Estudos de caso' }] } }
  const s = await setup(chosen('presa'), (b) => (b.action === 'criteria-check' ? held : undefined))
  try {
    const a = await s.cli('criteria-check', '1', '--met', '--note', 'conferido no ar')
    assert.match(a.out, /All met\./, a.err)
    assert.match(a.out, /Not done on the board yet: 1 build task\(s\) still open: 2\. «Trocar Apps por Estudos de caso»/)
    assert.match(a.out, /faundr done <#>.*faundr task-remove <#>/)
  } finally {
    s.close()
  }
  const byCriteria = { title: 'Memória', criteria: [{ text: 'a', met: true }], state: { finished: true, doneBy: 'criteria', tasks: 0, openBuild: [] } }
  const s2 = await setup(chosen('vazia'), (b) => (b.action === 'criteria-check' ? byCriteria : undefined))
  try {
    const a = await s2.cli('criteria-check', '1', '--met')
    assert.match(a.out, /It has no tasks, so it now counts as done on the board/, a.err)
  } finally {
    s2.close()
  }
  // Critério ainda faltando, ou painel antigo (sem `state`): só a linha de sempre.
  const s3 = await setup(chosen('vazia'), (b) => (b.action === 'criteria-check' ? { title: 'Memória', criteria: [{ text: 'a', met: true }, { text: 'b', met: null }] } : undefined))
  try {
    const a = await s3.cli('criteria-check', '1', '--met')
    assert.match(a.out, /1 not met yet\./, a.err)
    assert.doesNotMatch(a.out, /board/)
  } finally {
    s3.close()
  }
})

test('faundr feature-done fecha à mão e avisa das tarefas que ficaram abertas; --reopen desfaz', async () => {
  const s = await setup({}, (b) => {
    if (b.action !== 'feature-done') return undefined
    return b.reopen ? { id: 'presa-0000', title: 'Stacks de startups', reopened: true } : { id: 'presa-0000', title: 'Stacks de startups', closed: true, open: ['Trocar Apps por Estudos de caso'] }
  })
  try {
    const a = await s.cli('feature-done', 'Stacks de startups')
    assert.match(a.out, /Closed as done: Stacks de startups/, a.err)
    assert.match(a.out, /1 task\(s\) stay open in it \(«Trocar Apps por Estudos de caso»\): it counts as done anyway/)
    assert.equal(s.of('feature-done')[0].reopen, false)
    const b = await s.cli('feature-done', 'Stacks de startups', '--reopen')
    assert.match(b.out, /Reopened: Stacks de startups/, b.err)
    assert.equal(s.of('feature-done')[1].reopen, true)
  } finally {
    s.close()
  }
})

test('faundr task-review acerta o tipo da tarefa (revisão ou, com --off, construir) na funcionalidade atual', async () => {
  const s = await setup(chosen('presa'), (b) => (b.action === 'task-review' ? { id: 't', title: 'Compra real de cada plano', review: b.review } : undefined))
  try {
    const a = await s.cli('task-review', 'Compra real')
    assert.match(a.out, /Review task: Compra real de cada plano \(it no longer holds the feature/, a.err)
    assert.deepEqual([s.of('task-review')[0].review, s.of('task-review')[0].featureId, s.of('task-review')[0].query], [true, 'presa', 'Compra real'])
    const b = await s.cli('task-review', 'Compra real', '--off')
    assert.match(b.out, /Build task: Compra real de cada plano/, b.err)
    assert.equal(s.of('task-review')[1].review, false)
  } finally {
    s.close()
  }
})

test('faundr task: a saída diz quando a tarefa entrou como revisão, para a IA acertar na hora', async () => {
  const s = await setup(chosen('presa'), (b) => (b.action === 'add' ? { id: 't', review: /^Compra real/.test(b.title) } : undefined))
  try {
    const a = await s.cli('task', 'Compra real de cada plano')
    assert.match(a.out, /Task added: Compra real de cada plano \(review: it does not hold the feature/, a.err)
    const b = await s.cli('task', 'Tela de planos')
    assert.doesNotMatch(b.out, /review/)
  } finally {
    s.close()
  }
})

// ---- workflow ↔ quadro -----------------------------------------------------------------------------------------

const RUN = { ref: 'W-2', runId: 'r1', status: 'running', progress: '0/13 steps settled', notes: [], outline: [] }

test('faundr workflow run: manda a funcionalidade da sessão e diz o que aconteceu no quadro', async () => {
  const s = await setup(chosen('presa', 'focused'), (b) => (b.action === 'run' ? { ...RUN, board: { feature: null, linkedNow: false, tasks: 0 } } : undefined))
  try {
    const a = await s.cli('workflow', 'run', 'W-2', '--why', 'auditar a aba Memória')
    const sent = s.of('run')[0]
    assert.deepEqual([sent.feature.id, sent.feature.how, typeof sent.feature.at], ['presa', 'focused', 'number'])
    assert.match(a.out, /Board: this run is not on the Features board yet/, a.err)
    assert.match(a.out, /faundr workflow link W-2 --feature "<name>"/)
  } finally {
    s.close()
  }
  const linked = { ...RUN, board: { feature: { id: 'vazia', title: 'Memória pronta para lançar' }, linkedNow: true, tasks: 11 } }
  const s2 = await setup(chosen('vazia'), (b) => (b.action === 'run' || b.action === 'step' ? linked : undefined))
  try {
    const a = await s2.cli('workflow', 'run', 'W-2', '--why', 'auditar')
    assert.match(a.out, /Board: the 11 step\(s\) of W-2 are now the checklist of «Memória pronta para lançar»/, a.err)
  } finally {
    s2.close()
  }
  // Painel antigo (sem `board` na resposta): nada a mais na saída.
  const s3 = await setup(chosen('vazia'), (b) => (b.action === 'run' ? RUN : undefined))
  try {
    assert.doesNotMatch((await s3.cli('workflow', 'run', 'W-2', '--why', 'x')).out, /Board:/)
  } finally {
    s3.close()
  }
})

test('faundr workflow link: põe a execução na funcionalidade pedida (ou na atual) e some o lembrete do fim da resposta', async () => {
  const linked = { ...RUN, status: 'done', progress: '13/13 steps settled', board: { feature: { id: 'vazia', title: 'Memória pronta para lançar' }, linkedNow: true, tasks: 11 } }
  const s = await setup({ ...chosen('presa'), workflowOffBoard: { session: SID, refs: ['W-2'] } }, (b) => (b.action === 'link' ? linked : undefined))
  try {
    const a = await s.cli('workflow', 'link', 'W-2', '--feature', 'Memória pronta', '--run', 'c48125e4')
    assert.match(a.out, /W-2: 13\/13 steps settled\./, a.err)
    assert.match(a.out, /Board: the 11 step\(s\) of W-2 are now the checklist of «Memória pronta para lançar», with what is already done/)
    const sent = s.of('link')[0]
    assert.deepEqual([sent.query, sent.to, sent.run, sent.feature.id], ['W-2', 'Memória pronta', 'c48125e4', 'presa'])
    assert.deepEqual(s.readState().workflowOffBoard.refs, [])
  } finally {
    s.close()
  }
})

test('workflow concluído fora do quadro: o fim da resposta lembra uma vez de registrar o trabalho', async () => {
  const s = await setup({}, (b) => (b.action === 'done' ? { ...RUN, status: 'done', board: { feature: null, linkedNow: false, tasks: 0 } } : undefined))
  try {
    const a = await s.cli('workflow', 'done', 'W-2')
    assert.match(a.out, /Board: this run is not on the Features board\./, a.err)
    assert.deepEqual(s.readState().workflowOffBoard, { session: SID, refs: ['W-2'] })
    // Sem arquivo mexido, era só uma conferência: nada.
    assert.equal(await s.gate(), '')
    s.edited()
    const text = await s.gate()
    assert.match(text, /this session finished workflow W-2 and it is not on the Features board/)
    assert.match(text, /faundr workflow link W-2/)
    assert.equal(await s.gate(), '')
  } finally {
    s.close()
  }
})

// ---- fim da resposta: o quadro em dia -------------------------------------------------------------------------

test('fim da resposta: funcionalidade que a sessão escolheu e segue sem tarefas é cobrada uma vez', async () => {
  const s = await setup(chosen('vazia'))
  try {
    s.edited()
    const text = await s.gate()
    assert.match(text, /the feature you are working on, «Memória pronta para lançar», has no tasks on the board/)
    assert.match(text, /faundr task "<step>", then faundr done "<step>"/)
    assert.match(text, /faundr workflow link <W-n>/)
    assert.equal(await s.gate(), '')
  } finally {
    s.close()
  }
})

test('fim da resposta: funcionalidade herdada da pasta (a sessão não escolheu) não é cobrada', async () => {
  const s = await setup(chosen('vazia', 'pinned'))
  try {
    s.edited()
    assert.equal(await s.gate(), '')
  } finally {
    s.close()
  }
  // Estado de um plugin antigo (sem o "como chegou"): vale como herdada.
  const old = await setup({ currentFeatureId: 'vazia', featureBySession: { [SID]: { id: 'vazia', at: 1 } } })
  try {
    old.edited()
    assert.equal(await old.gate(), '')
  } finally {
    old.close()
  }
})

test('fim da resposta: critérios todos atendidos e tarefa de construir aberta: lista o que segura, sem cobrar a revisão', async () => {
  const s = await setup(chosen('presa', 'focused'))
  try {
    s.edited()
    const text = await s.gate()
    assert.match(text, /every Done when of «Stacks de startups» is met, but it stays in progress on the board because of open build tasks: 2\. «Trocar Apps por Estudos de caso»/)
    assert.doesNotMatch(text, /Conferir no celular/)
    assert.equal(await s.gate(), '')
  } finally {
    s.close()
  }
})

test('fim da resposta: passo desligado no painel não cobra', async () => {
  const s = await setup(chosen('vazia'))
  try {
    fs.mkdirSync(path.join(s.root, '.faundr', 'painel'), { recursive: true })
    fs.writeFileSync(path.join(s.root, '.faundr', 'painel', 'flows.json'), JSON.stringify(['stop.board', 'stop.open_tasks', 'stop.other_tasks']))
    s.edited()
    assert.equal(await s.gate(), '')
  } finally {
    s.close()
  }
})

test('fim da resposta depois do commit: aponta a tarefa aberta de OUTRA funcionalidade que o commit terminou (o caso do FAQ)', async () => {
  const faq = { id: 'd1ee4036-0000-0000-0000-000000000000', title: "Trocar o 'Nada durante o beta' do FAQ da home (Quanto custa?) quando a cobrança abrir para todos", feature: 'Cobrança em produção', featureId: 'cob' }
  const other = { id: 'a1000000-0000-0000-0000-000000000000', title: 'Alertas por e-mail (escolher o serviço de envio)', feature: 'Erros fase 3', featureId: 'err' }
  const state = {
    ...chosen('presa'),
    committedTasks: SID,
    sessionCommits: { session: SID, list: ['Home: o FAQ "Quanto custa?" deixa de dizer "Nada durante o beta", agora que a cobrança está aberta'] },
  }
  const s = await setup(state, (b) => (b.action === 'open-tasks' ? { tasks: [faq, other] } : undefined))
  try {
    const text = await s.gate()
    assert.match(text, /open tasks of other features look like what this session did: \[d1ee4036\] «Trocar o 'Nada durante o beta' do FAQ da home/)
    assert.match(text, /\(feature «Cobrança em produção»\)/)
    assert.match(text, /faundr done <id>/)
    assert.doesNotMatch(text, /Alertas por e-mail/)
    // A tarefa da funcionalidade atual continua sendo cobrada do jeito de sempre.
    assert.match(text, /«Stacks de startups» still has open tasks: 2\. «Trocar Apps por Estudos de caso»/)
    // Uma vez por sessão: o mesmo texto não é conferido de novo.
    assert.equal(s.of('open-tasks').length, 1)
    assert.equal(await s.gate(), '')
    assert.equal(s.of('open-tasks').length, 1)
  } finally {
    s.close()
  }
})
