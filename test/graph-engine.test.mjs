import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildProjectGraph, callers, refreshGraph, shortestPath } from '../dist/graph.mjs'

// Projeto de exemplo numa pasta temporária.
function project(files, name = 'faundr-ge-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), name))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

const fileEdges = (graph) => {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  return graph.links.map((l) => ({ from: byId.get(l.source)?.source_file, to: byId.get(l.target)?.source_file, relation: l.relation }))
}

// Primeiro do arquivo: as gramáticas ainda não foram carregadas neste processo.
test('arquivo que falha na leitura não fica preso no cache, e a gravação não deixa temporário', async () => {
  const dir = project({ 'src/a.ts': 'export function a() {\n  return 1\n}\n' })
  // Pasta de gramáticas sem a do TypeScript: a leitura falha e o arquivo não pode ficar marcado como lido.
  const saved = process.env.FAUNDR_GRAMMARS_DIR
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-ge-gram-'))
  fs.copyFileSync(new URL('../grammars/tree-sitter.wasm', import.meta.url), path.join(broken, 'tree-sitter.wasm'))
  process.env.FAUNDR_GRAMMARS_DIR = broken
  const origWrite = process.stderr.write
  process.stderr.write = () => true
  try {
    // O único arquivo de código falhou: o mapa não sai (não troca o anterior por um sem código).
    await assert.rejects(buildProjectGraph(dir), /Não consegui ler 1 de 1 arquivos de código \(o primeiro, src\/a\.ts/)
  } finally {
    process.stderr.write = origWrite
    if (saved === undefined) delete process.env.FAUNDR_GRAMMARS_DIR
    else process.env.FAUNDR_GRAMMARS_DIR = saved
  }
  const cache = JSON.parse(fs.readFileSync(path.join(dir, '.faundr/cache/extract-cache.json'), 'utf8'))
  assert.equal(cache.files['src/a.ts'], undefined)
  const { graph } = await buildProjectGraph(dir)
  assert.ok(graph.nodes.some((n) => n.label === 'a()'), 'lido de novo com as gramáticas de volta')
  // Gravação atômica: sem arquivo temporário sobrando.
  fs.mkdirSync(path.join(dir, '.faundr/mapa'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.faundr/mapa/graph.json'), JSON.stringify(graph))
  fs.appendFileSync(path.join(dir, 'src/a.ts'), 'export const b = 2\n')
  assert.deepEqual(await refreshGraph(dir), { changed: ['src/a.ts'] })
  for (const sub of ['.faundr/mapa', '.faundr/cache']) assert.deepEqual(fs.readdirSync(path.join(dir, sub)).filter((f) => f.endsWith('.tmp')), [])
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(broken, { recursive: true, force: true })
})

test('leitura do código quebrada (Sistema 5S): sem mapa só de documentos; poucas falhas entram no relatório', async () => {
  const files = { 'README.md': '# Projeto\n\nVeja [m0](src/m0.rb).\n' }
  // Ruby: nenhum outro teste deste arquivo carrega essa gramática antes (a gramática lida fica guardada no processo).
  for (let i = 0; i < 12; i++) files[`src/m${i}.rb`] = `def f${i}\n  ${i}\nend\n`
  const dir = project(files)
  const saved = process.env.FAUNDR_GRAMMARS_DIR
  // Leitor sem as gramáticas das linguagens: os documentos são lidos, nenhum arquivo de código.
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-ge-gram-'))
  fs.copyFileSync(new URL('../grammars/tree-sitter.wasm', import.meta.url), path.join(broken, 'tree-sitter.wasm'))
  const origWrite = process.stderr.write
  process.stderr.write = () => true
  try {
    process.env.FAUNDR_GRAMMARS_DIR = broken
    await assert.rejects(buildProjectGraph(dir), /Não consegui ler 12 de 12 arquivos de código/)
    // Uma falha em 13 arquivos de código: o mapa sai e o relatório conta o que ficou de fora.
    fs.writeFileSync(path.join(dir, 'src/zz.lua'), 'return 1\n')
    const luaFree = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-ge-gram-'))
    for (const f of fs.readdirSync(new URL('../grammars', import.meta.url))) {
      if (f !== 'tree-sitter-lua.wasm') fs.copyFileSync(new URL(`../grammars/${f}`, import.meta.url), path.join(luaFree, f))
    }
    process.env.FAUNDR_GRAMMARS_DIR = luaFree
    const { graph, report, stats } = await buildProjectGraph(dir)
    assert.equal(stats.failed, 1)
    assert.ok(graph.nodes.some((n) => n.source_file === 'src/m0.rb' && /^f0/.test(n.label)), 'o código lido entra no mapa')
    assert.match(report, /1 arquivo não pôde ser lido e ficou fora do mapa/)
    fs.rmSync(luaFree, { recursive: true, force: true })
  } finally {
    process.stderr.write = origWrite
    if (saved === undefined) delete process.env.FAUNDR_GRAMMARS_DIR
    else process.env.FAUNDR_GRAMMARS_DIR = saved
  }
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(broken, { recursive: true, force: true })
})

test('plugin instalado em pasta com espaço e acento acha as gramáticas', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr ação '))
  fs.mkdirSync(path.join(home, 'dist'))
  fs.copyFileSync(new URL('../dist/graph.mjs', import.meta.url), path.join(home, 'dist/graph.mjs'))
  fs.cpSync(fileURLToPath(new URL('../grammars', import.meta.url)), path.join(home, 'grammars'), { recursive: true })
  const dir = project({ 'src/a.ts': 'export function a() {\n  return 1\n}\n' })
  const script = `const m = await import(${JSON.stringify(pathToFileURL(path.join(home, 'dist/graph.mjs')).href)})
const { graph } = await m.buildProjectGraph(${JSON.stringify(dir)})
console.log(graph.nodes.some((n) => n.label === 'a()'))`
  const env = { ...process.env }
  delete env.FAUNDR_GRAMMARS_DIR
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env })
  assert.equal(out.trim(), 'true')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

test('import nos dois sentidos: as duas ligações ficam, o ciclo aparece e graph-callers vê quem importa de volta', async () => {
  const dir = project({
    'src/a.ts': "import { b } from './b'\nexport function a() {\n  return b()\n}\n",
    'src/b.ts': "import { a } from './a'\nexport function b() {\n  return 1\n}\nexport function c() {\n  return a()\n}\n",
  })
  const { graph, report } = await buildProjectGraph(dir)
  const edges = fileEdges(graph)
  assert.ok(edges.some((e) => e.from === 'src/a.ts' && e.to === 'src/b.ts' && e.relation === 'imports_from'), 'a importa b')
  assert.ok(edges.some((e) => e.from === 'src/b.ts' && e.to === 'src/a.ts' && e.relation === 'imports_from'), 'b importa a')
  assert.match(report, /ciclo de 2 arquivos: `src\/a\.ts -> src\/b\.ts -> src\/a\.ts`/)
  assert.match(callers(graph, 'src/a.ts'), /src\/b\.ts/)
  assert.match(callers(graph, 'src/b.ts'), /src\/a\.ts/)
  // Caminho na direção de uso existe nos dois sentidos.
  assert.match(shortestPath(graph, 'src/b.ts', 'src/a.ts'), /^Caminho mais curto \(1 saltos\):\n {2}.*--imports_from/)
  assert.match(shortestPath(graph, 'src/a.ts', 'src/b.ts'), /^Caminho mais curto \(1 saltos\):\n {2}.*--imports_from/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('ids: auth.service.ts e auth/service.ts são nós diferentes e cada import vai para o arquivo certo', async () => {
  const dir = project({
    'src/auth.service.ts': 'export function login() {\n  return 1\n}\n',
    'src/auth/service.ts': 'export function logout() {\n  return 2\n}\n',
    'src/app.ts': "import { login } from './auth.service'\nexport const run = () => login()\n",
    'src/other.ts': "import { logout } from './auth/service'\nexport const stop = () => logout()\n",
  })
  const { graph } = await buildProjectGraph(dir)
  const files = graph.nodes.filter((n) => n.display_label !== undefined).map((n) => n.source_file)
  assert.ok(files.includes('src/auth.service.ts') && files.includes('src/auth/service.ts'), 'os dois são nós de arquivo')
  const ids = graph.nodes.filter((n) => n.source_file === 'src/auth.service.ts' || n.source_file === 'src/auth/service.ts').map((n) => n.id)
  assert.equal(new Set(ids).size, ids.length)
  const edges = fileEdges(graph)
  assert.ok(edges.some((e) => e.from === 'src/app.ts' && e.to === 'src/auth.service.ts' && e.relation === 'imports_from'))
  assert.ok(edges.some((e) => e.from === 'src/other.ts' && e.to === 'src/auth/service.ts' && e.relation === 'imports_from'))
  assert.ok(!edges.some((e) => e.from === 'src/other.ts' && e.to === 'src/auth.service.ts'), 'import não vai para o arquivo errado')
  // Sem colisão, o id continua o de sempre (mapas salvos no painel não mudam).
  assert.ok(graph.nodes.some((n) => n.id === 'src_app' && n.source_file === 'src/app.ts'))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('monorepo: alias do tsconfig da subpasta resolve os imports daquela pasta', async () => {
  const dir = project({
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@root/*': ['./shared/*'] } } }),
    'shared/util.ts': 'export function shared() {\n  return 1\n}\n',
    'apps/web/tsconfig.json': '{\n  // comentário\n  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } },\n}\n',
    'apps/web/src/lib/format.ts': 'export function format() {\n  return 1\n}\n',
    'apps/web/src/page.ts': "import { format } from '@/lib/format'\nexport const page = () => format()\n",
    'apps/api/src/main.ts': "import { shared } from '@root/util'\nexport const main = () => shared()\n",
  })
  const { graph } = await buildProjectGraph(dir)
  const edges = fileEdges(graph)
  assert.ok(edges.some((e) => e.from === 'apps/web/src/page.ts' && e.to === 'apps/web/src/lib/format.ts' && e.relation === 'imports_from'), 'alias da subpasta')
  assert.ok(edges.some((e) => e.from === 'apps/api/src/main.ts' && e.to === 'shared/util.ts' && e.relation === 'imports_from'), 'sem tsconfig próprio, vale o da raiz')
  fs.rmSync(dir, { recursive: true, force: true })
})
