import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { buildProjectGraph } from '../dist/graph.mjs'

// Projeto de exemplo numa pasta temporária; devolve o grafo e um atalho para achar ligações.
async function graphOf(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-gl-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  const { graph } = await buildProjectGraph(dir)
  const label = new Map(graph.nodes.map((n) => [n.id, n]))
  const links = graph.links ?? graph.edges
  const edges = links.map((e) => ({ from: label.get(e.source)?.label, fromFile: label.get(e.source)?.source_file, to: label.get(e.target)?.label, toFile: label.get(e.target)?.source_file, relation: e.relation }))
  return { graph, edges }
}

test('Dart: imports do próprio app viram ligação entre arquivos, e as chamadas aparecem', async () => {
  const { graph, edges } = await graphOf({
    'pubspec.yaml': 'name: loja\n',
    'lib/services/api.dart': "class Api {\n  int fetch(int x) => x * 2;\n}\n\nint dobro(int x) => x * 2;\n",
    'lib/main.dart':
      "import 'package:loja/services/api.dart';\nimport 'package:flutter/material.dart';\n\nclass Contador {\n  int soma(int x) {\n    return ajuda(x) + Api().fetch(x);\n  }\n}\n\nint ajuda(int y) {\n  return dobro(y);\n}\n",
  })
  assert.ok(graph.nodes.some((n) => n.label === '.soma()'), 'método soma')
  assert.ok(graph.nodes.some((n) => n.label === 'ajuda()'), 'função ajuda')
  assert.ok(edges.some((e) => e.fromFile === 'lib/main.dart' && e.toFile === 'lib/services/api.dart' && /import/.test(e.relation)), 'import do app')
  assert.ok(edges.some((e) => e.from === '.soma()' && e.to === 'ajuda()' && e.relation === 'calls'), 'soma chama ajuda')
  assert.ok(edges.some((e) => e.from === 'ajuda()' && e.to === 'dobro()' && e.relation === 'calls'), 'ajuda chama dobro, em outro arquivo')
})

test('PHP: use pelo PSR-4 e require viram ligação entre arquivos; métodos e funções são chamados', async () => {
  const { edges } = await graphOf({
    'composer.json': JSON.stringify({ autoload: { 'psr-4': { 'App\\': 'app/' } } }),
    'app/Models/User.php': "<?php\nnamespace App\\Models;\n\nclass User {\n    public static function find($id) { return new User(); }\n    public function save() { return true; }\n}\n",
    'app/helpers.php': "<?php\nfunction formata_nome($u) { return strtoupper($u); }\n",
    'app/Http/UserController.php':
      "<?php\nnamespace App\\Http;\n\nuse App\\Models\\User;\nrequire_once __DIR__ . '/../helpers.php';\n\nclass UserController {\n    public function show($id) {\n        $u = User::find($id);\n        $this->notify($u);\n        return formata_nome($u);\n    }\n    private function notify($u) { $u->save(); }\n}\n",
  })
  const from = 'app/Http/UserController.php'
  assert.ok(edges.some((e) => e.fromFile === from && e.toFile === 'app/Models/User.php' && e.relation === 'imports'), 'use App\\Models\\User')
  assert.ok(edges.some((e) => e.fromFile === from && e.toFile === 'app/helpers.php' && e.relation === 'imports'), 'require_once')
  assert.ok(edges.some((e) => e.from === '.show()' && e.to === '.notify()' && e.relation === 'calls'), '$this->notify()')
  assert.ok(edges.some((e) => e.from === '.show()' && e.to === 'formata_nome()'), 'função de outro arquivo')
  assert.ok(edges.some((e) => e.from === '.show()' && e.to === '.find()'), 'User::find()')
})
