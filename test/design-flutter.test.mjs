import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { runRules } from '../bin/design-rules.mjs'
import { isUiFile, uiFiles } from '../bin/design.mjs'

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-df-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

const SCREEN = `import 'package:flutter/material.dart';

class App extends StatelessWidget {
  Widget build(BuildContext context) => MaterialApp(title: 'Flutter Demo', home: const Tela());
}

class Tela extends StatelessWidget {
  Widget build(BuildContext context) {
    return Column(children: [
      Text('Olá', style: TextStyle(color: Color(0xFFE91E63), fontSize: 13)),
      SizedBox(width: 420, child: Image.asset('assets/logo.png')),
      IconButton(icon: const Icon(Icons.delete), onPressed: () {}),
      IconButton(icon: const Icon(Icons.share), tooltip: 'Compartilhar', onPressed: compartilhar),
      Image.network(url, semanticLabel: 'Foto do produto'),
      AnimatedOpacity(opacity: 1, duration: Duration(milliseconds: 900), curve: Curves.easeIn, child: Text('Lorem ipsum')),
      Container(color: Theme.of(context).colorScheme.surface),
    ]);
  }
}
`

test('Flutter: cor e fonte fixas, botão sem tooltip e sem ação, imagem sem descrição, largura fixa, animação e título do modelo', () => {
  const dir = project({
    'pubspec.yaml': 'name: app\n',
    'lib/main.dart': SCREEN,
    // O arquivo do tema é o lugar das cores fixas.
    'lib/theme/app_colors.dart': "import 'package:flutter/material.dart';\nconst rosa = Color(0xFFE91E63);\n",
    'lib/main.g.dart': "const x = Color(0xFF000000);\n",
    'test/widget_test.dart': "void main() { IconButton(onPressed: () {}); }\n",
  })
  const { findings } = runRules(dir, { uiExt: /\.(tsx|jsx|vue|svelte|astro)$/, designMdPath: null, designMd: '', tokens: null })
  const rules = (file) => findings.filter((f) => f.file === file).map((f) => f.rule).sort()
  assert.deepEqual(rules('lib/main.dart'), [
    'acessibilidade/botao-sem-tooltip',
    'acessibilidade/imagem-sem-descricao',
    'conteudo/dado-de-enchimento',
    'design/cor-fixa-flutter',
    'design/fonte-fixa-flutter',
    'identidade/titulo-do-modelo',
    'movimento/duracao-longa-flutter',
    'movimento/ease-in-flutter',
    'pratica/botao-sem-acao',
    'responsivo/largura-fixa-flutter',
  ])
  assert.deepEqual(rules('lib/theme/app_colors.dart'), [])
  assert.deepEqual(rules('lib/main.g.dart'), [])
  assert.deepEqual(rules('test/widget_test.dart'), [])
  // Um botão sem tooltip e uma imagem sem descrição (as outras duas têm).
  assert.equal(findings.find((f) => f.rule === 'acessibilidade/botao-sem-tooltip').title, 'Botão só com ícone, sem nome para leitor de tela')
  assert.ok(uiFiles(dir).includes('lib/main.dart'))
  assert.ok(isUiFile('lib/telas/home.dart') && !isUiFile('lib/main.g.dart') && !isUiFile('bin/cli.dart'))
})

test('Vitrine: as cores do tema do Flutter entram na paleta', async () => {
  const { extractTokens } = await import('../bin/design-tokens.mjs')
  const dir = project({
    'pubspec.yaml': 'name: app\n',
    'lib/theme/app_colors.dart': "class AppColors {\n  static const primaria = Color(0xFF6200EE);\n  static const fundo = Color(0x80FFFFFF);\n}\n",
  })
  const colors = extractTokens(dir, null).colors.map((c) => [c.name, c.value])
  assert.deepEqual(colors, [['primaria', '#6200ee'], ['fundo', 'rgba(255, 255, 255, 0.5)']])
})

test('Laravel: os templates Blade passam pelas regras da web', () => {
  const dir = project({
    'composer.json': '{}',
    'resources/views/layouts/app.blade.php': '<html><head><title>Laravel</title></head><body>@yield("content")</body></html>\n',
    'resources/views/pedidos.blade.php': '<div class="grid grid-cols-3"><img src="{{ $foto }}"><button class="p-2"><svg></svg></button></div>\n',
  })
  const { findings } = runRules(dir, { uiExt: /\.(tsx|jsx|vue|svelte|astro)$|\.blade\.php$/, designMdPath: null, designMd: '', tokens: null })
  const rules = findings.filter((f) => f.file === 'resources/views/pedidos.blade.php').map((f) => f.rule).sort()
  assert.deepEqual(rules, ['acessibilidade/botao-sem-nome', 'acessibilidade/imagem-sem-alt', 'responsivo/grid-sem-celular'])
  assert.ok(uiFiles(dir).includes('resources/views/pedidos.blade.php'))
})

test('Angular e HTML: os templates .html e as páginas entram no design, com o clique de cada framework', () => {
  const dir = project({
    'angular.json': '{}',
    'src/index.html': '<!doctype html>\n<html lang="pt-BR">\n<head><title>Loja</title></head>\n<body><app-root></app-root></body>\n</html>\n',
    'src/app/carrinho/carrinho.component.html':
      '<div class="w-[720px]" (click)="abrir()">Abrir</div>\n<button class="outline-none"><mat-icon>delete</mat-icon></button>\n<img src="logo.png">\n',
    'site/contato.html': '<!doctype html>\n<html><body>\n<span onclick="enviar()">Enviar</span>\n<img src="mapa.png">\n</body></html>\n',
    'src/app/ok.vue': '<template><div @click="abrir">Abrir</div></template>\n',
  })
  const uiExt = /\.(tsx|jsx|vue|svelte|astro|html?)$|\.blade\.php$/
  const { findings } = runRules(dir, { uiExt, designMdPath: null, designMd: '', tokens: null })
  const rules = (file) => [...new Set(findings.filter((f) => f.file === file).map((f) => f.rule))].sort()
  assert.deepEqual(rules('src/app/carrinho/carrinho.component.html'), [
    'acessibilidade/botao-sem-nome',
    'acessibilidade/elemento-clicavel-sem-teclado',
    'acessibilidade/foco-removido',
    'acessibilidade/imagem-sem-alt',
    'responsivo/largura-fixa',
  ])
  assert.deepEqual(rules('site/contato.html'), ['acessibilidade/elemento-clicavel-sem-teclado', 'acessibilidade/imagem-sem-alt'])
  assert.deepEqual(rules('src/app/ok.vue'), ['acessibilidade/elemento-clicavel-sem-teclado'])
  assert.ok(uiFiles(dir).includes('src/app/carrinho/carrinho.component.html'), 'o template do Angular é tela')
  assert.ok(isUiFile('site/contato.html'))
})

test('React Native: cor e fonte fixas no StyleSheet, largura fixa, botão só com ícone, imagem sem descrição, onPress vazio e animação longa', () => {
  const dir = project({
    'package.json': JSON.stringify({ dependencies: { 'react-native': '0.74.0', expo: '^51.0.0' } }),
    'src/screens/Carrinho.tsx': [
      "import { StyleSheet, View, Text, Image, Pressable, Animated } from 'react-native'",
      "import { Ionicons } from '@expo/vector-icons'",
      'export function Carrinho() {',
      '  Animated.timing(valor, { toValue: 1, duration: 900, useNativeDriver: true }).start()',
      '  return (',
      '    <View style={styles.caixa}>',
      "      <Image source={require('./logo.png')} />",
      '      <Pressable onPress={() => {}}><Ionicons name="trash" size={20} /></Pressable>',
      '      <Pressable onPress={apagar} accessibilityLabel="Apagar"><Ionicons name="trash" size={20} /></Pressable>',
      '      <Text style={styles.titulo}>Carrinho</Text>',
      '    </View>',
      '  )',
      '}',
      'const styles = StyleSheet.create({',
      "  caixa: { width: 420, backgroundColor: '#E91E63' },",
      '  titulo: { fontSize: 13, color: theme.colors.text },',
      '})',
    ].join('\n'),
    'src/theme/colors.ts': "export const colors = { rosa: '#E91E63', texto: '#111111' }\n",
  })
  const { findings } = runRules(dir, { uiExt: /\.(tsx|jsx|vue|svelte|astro|html?)$|\.blade\.php$/, designMdPath: null, designMd: '', tokens: null })
  const rules = (file) => [...new Set(findings.filter((f) => f.file === file).map((f) => f.rule))].sort()
  assert.deepEqual(rules('src/screens/Carrinho.tsx'), [
    'acessibilidade/botao-sem-nome-native',
    'acessibilidade/imagem-sem-descricao-native',
    'design/cor-fixa-native',
    'design/fonte-fixa-native',
    'movimento/duracao-longa-native',
    'pratica/botao-sem-acao',
    'responsivo/largura-fixa-native',
  ])
  assert.deepEqual(rules('src/theme/colors.ts'), [], 'o arquivo do tema é o lugar das cores')
  assert.equal(findings.filter((f) => f.rule === 'acessibilidade/botao-sem-nome-native').length, 1, 'o botão com accessibilityLabel passa')
})
