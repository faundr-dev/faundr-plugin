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

test('Go: import do próprio módulo vira ligação com os arquivos do pacote; pkg.Func() e métodos são chamados', async () => {
  const { edges } = await graphOf({
    'go.mod': 'module example.com/loja\n\ngo 1.22\n',
    'internal/db/repo.go': 'package db\n\ntype Repo struct{}\n\nfunc NewRepo() *Repo {\n\treturn &Repo{}\n}\n\nfunc (r *Repo) Save(x int) int {\n\treturn x\n}\n',
    'internal/db/repo_test.go': 'package db\n\nimport "testing"\n\nfunc TestSave(t *testing.T) {\n\tNewRepo()\n}\n',
    'cmd/api/main.go':
      'package main\n\nimport (\n\t"fmt"\n\tstore "example.com/loja/internal/db"\n)\n\nfunc main() {\n\tr := store.NewRepo()\n\tr.Save(1)\n\tajuda()\n\tfmt.Println("ok")\n}\n',
    'cmd/api/util.go': 'package main\n\nfunc ajuda() {}\n',
  })
  const from = 'cmd/api/main.go'
  assert.ok(edges.some((e) => e.fromFile === from && e.toFile === 'internal/db/repo.go' && e.relation === 'imports'), 'import do pacote do módulo')
  assert.ok(!edges.some((e) => e.fromFile === from && e.toFile === 'internal/db/repo_test.go' && e.relation === 'imports'), 'arquivo de teste fica fora do import')
  assert.ok(edges.some((e) => e.from === 'main()' && e.to === 'NewRepo()' && e.relation === 'calls'), 'store.NewRepo() com alias')
  assert.ok(edges.some((e) => e.from === 'main()' && e.to === 'ajuda()' && e.toFile === 'cmd/api/util.go'), 'função do mesmo pacote em outro arquivo')
})

test('Java: import vira ligação com o arquivo da classe; Classe.metodo() e var.metodo() são chamados', async () => {
  const { edges } = await graphOf({
    'pom.xml': '<project></project>\n',
    'src/main/java/com/acme/model/User.java':
      'package com.acme.model;\n\npublic class User {\n    public static User find(int id) { return new User(); }\n    public void save() {}\n}\n',
    'src/main/java/com/acme/web/Helper.java': 'package com.acme.web;\n\nclass Helper {\n    static String format(Object o) { return o.toString(); }\n}\n',
    'src/main/java/com/acme/web/UserController.java':
      'package com.acme.web;\n\nimport com.acme.model.User;\nimport java.util.List;\n\npublic class UserController {\n    public String show(int id) {\n        User u = User.find(id);\n        notify(u);\n        return Helper.format(u);\n    }\n    private void notify(User u) { u.save(); }\n}\n',
  })
  const from = 'src/main/java/com/acme/web/UserController.java'
  assert.ok(edges.some((e) => e.fromFile === from && e.toFile === 'src/main/java/com/acme/model/User.java' && e.relation === 'imports'), 'import com.acme.model.User')
  assert.ok(edges.some((e) => e.from === '.show()' && e.to === '.find()' && e.relation === 'calls'), 'User.find()')
  assert.ok(edges.some((e) => e.from === '.show()' && e.to === '.notify()'), 'notify() da mesma classe')
  assert.ok(edges.some((e) => e.from === '.notify()' && e.to === '.save()'), 'u.save() pelo tipo da variável')
  assert.ok(edges.some((e) => e.from === '.show()' && e.to === '.format()'), 'classe do mesmo pacote sem import')
})

test('Kotlin: import pelo package (pasta não precisa bater) e funções de topo de outro arquivo', async () => {
  const { edges } = await graphOf({
    'build.gradle.kts': 'plugins { kotlin("jvm") }\n',
    'src/main/kotlin/data/Repo.kt': 'package com.acme.data\n\nclass Repo {\n    fun save(x: Int): Int = x\n}\n\nfun criaRepo(): Repo = Repo()\n',
    'src/main/kotlin/App.kt':
      'package com.acme\n\nimport com.acme.data.Repo\nimport com.acme.data.criaRepo\n\nclass App {\n    fun run() {\n        val r: Repo = criaRepo()\n        r.save(1)\n        ajuda()\n    }\n}\n\nfun ajuda() {}\n',
  })
  const from = 'src/main/kotlin/App.kt'
  assert.ok(edges.some((e) => e.fromFile === from && e.toFile === 'src/main/kotlin/data/Repo.kt' && e.relation === 'imports'), 'import com.acme.data.Repo')
  assert.ok(edges.some((e) => e.from === '.run()' && e.to === 'criaRepo()' && e.relation === 'calls'), 'criaRepo() de outro arquivo')
  assert.ok(edges.some((e) => e.from === '.run()' && e.to === 'ajuda()'), 'ajuda() do mesmo arquivo')
  assert.ok(edges.some((e) => e.from === '.run()' && e.to === '.save()'), 'r.save() pelo tipo declarado')
})

test('C#: using liga aos arquivos do namespace; Classe.Metodo(), new e var.Metodo() são chamados', async () => {
  const { edges } = await graphOf({
    'Loja.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>\n',
    'Models/User.cs': 'namespace Loja.Models;\n\npublic class User\n{\n    public static User Find(int id) => new User();\n    public void Save() { }\n}\n',
    'Models/Order.cs': 'namespace Loja.Models\n{\n    public class Order { }\n}\n',
    'Web/UserController.cs':
      'using System;\nusing Loja.Models;\n\nnamespace Loja.Web;\n\npublic class UserController\n{\n    public string Show(int id)\n    {\n        User u = User.Find(id);\n        var o = new Order();\n        Notify(u);\n        return u.ToString();\n    }\n    private void Notify(User u) { u.Save(); }\n}\n',
  })
  const from = 'Web/UserController.cs'
  assert.ok(edges.some((e) => e.fromFile === from && e.toFile === 'Models/User.cs' && e.relation === 'imports'), 'using Loja.Models → User.cs')
  assert.ok(edges.some((e) => e.fromFile === from && e.toFile === 'Models/Order.cs' && e.relation === 'imports'), 'namespace com chaves → Order.cs')
  assert.ok(edges.some((e) => e.from === '.Show()' && e.to === '.Find()' && e.relation === 'calls'), 'User.Find()')
  assert.ok(edges.some((e) => e.from === '.Show()' && e.to === 'Order'), 'new Order()')
  assert.ok(edges.some((e) => e.from === '.Show()' && e.to === '.Notify()'), 'Notify() da mesma classe')
  assert.ok(edges.some((e) => e.from === '.Notify()' && e.to === '.Save()'), 'u.Save() pelo tipo do parâmetro')
})
