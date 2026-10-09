import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { buildProjectGraph, callers, grep, rankNodes, refreshGraph, search, shortestPath, skeleton, wordsOf } from '../dist/graph.mjs'
import { dependentsNote, dependentsOf } from '../bin/dependents.mjs'

// Lojinha pequena: carrinho que usa cupons, um teste e um documento que falam de cupom.
async function shop() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-g-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  write('src/coupons.mjs', "export const COUPONS = { PROMO10: { type: 'percent', value: 10 } }\n\nexport function findCoupon(code) {\n  return COUPONS[code]\n}\n")
  write(
    'src/cart.mjs',
    "import { findCoupon } from './coupons.mjs'\n\nexport function applyCoupon(total, code) {\n  const coupon = findCoupon(code)\n  if (!coupon) return total\n  return total - Math.round((total * coupon.value) / 100)\n}\n\nexport const checkout = (items, code) => {\n  const total = items.reduce((s, i) => s + i.price, 0)\n  return applyCoupon(total, code)\n}\n",
  )
  write('test/cart.test.mjs', "import { applyCoupon } from '../src/cart.mjs'\n\ntest('cupom aplica desconto', () => applyCoupon(100, 'PROMO10'))\n")
  write('docs/cupons.md', '# Cupons\n\nComo o cupom de desconto funciona no carrinho.\n')
  const { graph } = await buildProjectGraph(dir)
  return { dir, graph }
}

test('wordsOf separa camelCase, snake_case e tira acento e plural', () => {
  assert.deepEqual(wordsOf('applyCouponCode'), ['apply', 'coupon', 'code'])
  assert.deepEqual(wordsOf('user_id HTTPServer'), ['user', 'id', 'http', 'server'])
  assert.deepEqual(wordsOf('Sessões coupons'), ['sessoe', 'coupon'])
})

test('grafo guarda o fim do trecho e a assinatura de funções e consts', async () => {
  const { graph } = await shop()
  const apply = graph.nodes.find((n) => n.label === 'applyCoupon()')
  assert.equal(apply.source_location, 'L3')
  assert.equal(apply.end_location, 'L7')
  assert.equal(apply.signature, 'function applyCoupon(total, code)')
  const checkout = graph.nodes.find((n) => n.label === 'checkout()')
  assert.equal(checkout.end_location, 'L12')
  assert.equal(checkout.signature, 'checkout = (items, code)')
})

test('busca põe o código antes do teste e do documento, e entende português', async () => {
  const { dir, graph } = await shop()
  const ranked = rankNodes(graph, 'onde aplica o cupom', null).map((h) => h.node.source_file)
  assert.equal(ranked[0], 'src/cart.mjs')
  const testAt = ranked.indexOf('test/cart.test.mjs')
  assert.ok(testAt === -1 || testAt > ranked.indexOf('src/cart.mjs'))
  // "cupom" sem nada em português no código: a tradução (coupon) acha applyCoupon.
  const top = rankNodes(graph, 'cupom', null)[0].node
  assert.match(top.label, /oupon/i)
  // Com a pergunta sobre testes, o teste sobe.
  assert.equal(rankNodes(graph, 'teste do cupom', null)[0].node.source_file, 'test/cart.test.mjs')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('graph-query devolve assinatura, quem chama, o que chama e o código numerado', async () => {
  const { dir, graph } = await shop()
  const out = search(graph, 'applyCoupon', { root: dir })
  assert.match(out, /^Busca no grafo: "applyCoupon"/)
  assert.match(out, /1\. applyCoupon\(\)  src\/cart\.mjs:L3-L7  \[função\]/)
  assert.match(out, /Chamado por: checkout\(\) \(src\/cart\.mjs:L11\)/)
  assert.match(out, /Chama: findCoupon\(\)/)
  assert.match(out, /```js\n3  export function applyCoupon\(total, code\) \{/)
  // Orçamento pequeno: o trecho é cortado e diz onde ler o resto.
  const small = search(graph, 'applyCoupon', { root: dir, codeLines: 2 })
  assert.match(small, /… mais 3 linhas \(src\/cart\.mjs:L5-L7\)/)
  assert.match(search(graph, 'xyzzy', { root: dir }), /^Nada no grafo/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('graph-callers: quem chama, o que usa, profundidade e arquivo', async () => {
  const { dir, graph } = await shop()
  const inn = callers(graph, 'findCoupon')
  assert.match(inn, /^Quem depende de findCoupon\(\) \(src\/coupons\.mjs:L3-L5\): /)
  assert.match(inn, /applyCoupon\(\)  src\/cart\.mjs:L4  \[chama\]/)
  assert.doesNotMatch(inn, /checkout/)
  // Dois saltos: checkout chama applyCoupon, que chama findCoupon.
  assert.match(callers(graph, 'findCoupon', { depth: 2 }), /A 2 saltos:\n  checkout\(\) .*\[chama, via applyCoupon\(\)\]/)
  assert.match(callers(graph, 'applyCoupon', { direction: 'out' }), /findCoupon\(\)/)
  // Arquivo: conta quem usa as funções dele, não só quem importa o arquivo.
  assert.match(callers(graph, 'src/coupons.mjs'), /applyCoupon\(\)/)
  assert.match(callers(graph, 'nadaDisso'), /^Nada no grafo/)
  // --both (o antigo graph-explain): quem usa e o que usa, na mesma resposta.
  const both = callers(graph, 'applyCoupon', { direction: 'both' })
  assert.match(both, /^Quem depende de applyCoupon\(\)[^]*checkout\(\)[^]*\n\nO que usa applyCoupon\(\)[^]*findCoupon\(\)/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('graph-path: na direção de uso, sem direção com uma troca só, e nunca por módulo de fora', async () => {
  const { dir, graph } = await shop()
  assert.match(shortestPath(graph, 'checkout', 'findCoupon'), /^Caminho mais curto \(2 saltos\):\n  checkout\(\) --calls/)
  // Ao contrário não há caminho de uso: tenta sem direção na mesma chamada e avisa.
  assert.match(shortestPath(graph, 'findCoupon', 'checkout'), /^Sem caminho na direção de uso[^]*2 saltos/)
  fs.rmSync(dir, { recursive: true, force: true })

  // Dois arquivos que só têm em comum importar node:fs não estão ligados.
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-g-'))
  fs.writeFileSync(path.join(other, 'a.mjs'), "import fs from 'node:fs'\nexport function lerA() {\n  return fs.readFileSync('a')\n}\n")
  fs.writeFileSync(path.join(other, 'b.mjs'), "import fs from 'node:fs'\nexport function lerB() {\n  return fs.readFileSync('b')\n}\n")
  const { graph: g2 } = await buildProjectGraph(other)
  assert.match(shortestPath(g2, 'lerA', 'lerB'), /^Nenhum caminho/)
  fs.rmSync(other, { recursive: true, force: true })
})

test('graph-skeleton: assinaturas em ordem, linhas e quantas vezes cada uma é usada', async () => {
  const { dir, graph } = await shop()
  const out = skeleton(graph, 'cart.mjs')
  assert.match(out, /^Esqueleto de src\/cart\.mjs: 2 definição\(ões\); importado por 1 arquivo\(s\)/)
  assert.match(out, /Importa: src\/coupons\.mjs/)
  assert.ok(out.indexOf('function applyCoupon(total, code)') < out.indexOf('checkout = (items, code)'))
  assert.match(out, /L3-L7 +function applyCoupon\(total, code\)  · usado \d+x/)
  assert.match(skeleton(graph, 'nao/existe.mjs'), /não está no grafo/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('graph-grep: agrupa pela função onde aparece e põe a mais usada primeiro', async () => {
  const { dir, graph } = await shop()
  const out = grep(graph, 'coupon', { root: dir, ignoreCase: true })
  assert.match(out, /^Busca \/coupon\/: \d+ ocorrência\(s\)/)
  const first = out.split('\n')[1]
  assert.match(first, /findCoupon\(\)|applyCoupon\(\)/)
  assert.match(out, /applyCoupon\(\)  src\/cart\.mjs:L3-L7[^\n]*\n    L3: [^\n]*\n    L4: const coupon = findCoupon\(code\)/)
  assert.match(grep(graph, 'coupon', { root: dir, in: 'docs' }), /^Nada encontrado/)
  // Padrão inválido vira texto literal.
  assert.match(grep(graph, 'findCoupon(', { root: dir }), /findCoupon\(code\)/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('grafo: cache por arquivo e atualização antes da consulta só com o que mudou', async () => {
  const { dir, graph } = await shop()
  fs.mkdirSync(path.join(dir, '.faundr'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.faundr', 'graph.json'), JSON.stringify(graph))
  assert.deepEqual(await refreshGraph(dir), { changed: [] })
  // Uma função nova no carrinho: só esse arquivo é lido de novo, e a busca já a encontra.
  fs.appendFileSync(path.join(dir, 'src/cart.mjs'), '\nexport function freeShipping(total) {\n  return total >= 20000\n}\n')
  assert.deepEqual(await refreshGraph(dir), { changed: ['src/cart.mjs'] })
  const fresh = JSON.parse(fs.readFileSync(path.join(dir, '.faundr', 'graph.json'), 'utf8'))
  assert.ok(fresh.nodes.some((n) => n.label === 'freeShipping()'))
  // As comunidades antigas continuam (o painel recebe o grafo completo no fim da resposta).
  assert.equal(fresh.nodes.find((n) => n.label === 'applyCoupon()').community, graph.nodes.find((n) => n.label === 'applyCoupon()').community)
  // Arquivo novo: muda a lista de arquivos.
  fs.writeFileSync(path.join(dir, 'src/orders.mjs'), "import { checkout } from './cart.mjs'\nexport const placeOrder = (items) => checkout(items)\n")
  assert.deepEqual(await refreshGraph(dir), { changed: ['src/orders.mjs'] })
  // Sem graph.json, não há o que atualizar.
  fs.rmSync(path.join(dir, '.faundr', 'graph.json'))
  assert.equal(await refreshGraph(dir), null)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('antes de editar: quem depende do arquivo, sem contar o próprio arquivo', async () => {
  const { dir, graph } = await shop()
  const deps = dependentsOf(graph, 'src/coupons.mjs')
  assert.ok(deps.some((d) => d.label === 'applyCoupon()' && d.file === 'src/cart.mjs'))
  assert.ok(deps.every((d) => d.file !== 'src/coupons.mjs'))
  const note = dependentsNote(graph, 'src/coupons.mjs')
  assert.match(note, /^\[Faundr\] src\/coupons\.mjs é usado por \d+ parte\(s\) em \d+ arquivo\(s\): /)
  assert.match(note, /faundr graph-callers src\/coupons\.mjs/)
  assert.equal(dependentsNote(graph, 'docs/cupons.md'), null)
  assert.match(dependentsNote(graph, 'src/coupons.mjs', 1), /… e mais \d+/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('mapa: pula cópias em .claude/worktrees, arquivo compactado e código gerado de linha gigante', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-g-'))
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  write('src/app.mjs', 'export function iniciar() {\n  return 1\n}\n')
  write('.claude/worktrees/agent-1/src/app.mjs', 'export function iniciar() {\n  return 1\n}\n')
  write('public/pdf.worker.min.mjs', 'export function a(){return 1}')
  // Sem ".min" no nome, mas com cara de pacote gerado: uma linha só com mais de 64 KB.
  write('public/vendor.js', `${Array.from({ length: 4000 }, (_, i) => `function f${i}(){return ${i}}`).join(';')}\n`)
  const { graph, stats } = await buildProjectGraph(dir)
  const files = new Set(graph.nodes.map((n) => n.source_file).filter(Boolean))
  assert.deepEqual([...files], ['src/app.mjs'])
  assert.equal(stats.dropped, 0)
  fs.rmSync(dir, { recursive: true, force: true })
})
