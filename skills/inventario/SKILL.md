---
description: Inventário das funcionalidades de um projeto que já existia antes do Faundr. Lê o mapa do código, propõe a lista do que o app já faz e, com o OK do dono, registra cada uma como pronta no quadro de Funcionalidades. Use quando o usuário pedir, ou quando o Faundr avisar no início da sessão que o projeto tem código e nenhuma funcionalidade registrada e o usuário aceitar.
argument-hint: [pasta ou parte do projeto]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

## 1. O que já está registrado

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --all`

Não repita o que já está acima.

## 2. Descubra o que o app faz (sem ler o projeto inteiro)

- Se não existir `.faundr/graph.json`, gere o mapa: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" mapa`.
- Leia a seção "Comunidades (navegação)" de `.faundr/GRAPH_REPORT.md`: cada comunidade é um grupo de código que trabalha junto.
- Veja as telas e rotas (pastas como `routes`, `pages`, `app`, `screens`, `views`) e os pontos de entrada da API. Use `faundr graph-skeleton <arquivo>` para ver um arquivo sem lê-lo inteiro e `faundr graph-query "<tema>"` para confirmar o que uma parte faz.
- Documentos do projeto (README, CONTEXT.md, docs/) ajudam a dar nome às coisas, mas só conte o que o código mostra que existe.

## 3. Proponha a lista ao usuário

- De 5 a 15 funcionalidades, no nível que o dono entende: o que a pessoa consegue fazer no app ("Login com e-mail", "Cadastro de motoristas", "Relatório mensal"), não nomes técnicos ("AuthProvider", "utils").
- Para cada uma: título curto, uma frase do que faz, de 1 a 4 partes (o que ela tem) e os arquivos que provam.
- Marque o que parece pela metade (tela sem ligação com o banco, TODO, rota sem tela) como "em andamento", e não como pronto.
- Mostre a lista e pergunte com a ferramenta de perguntas: registrar todas, registrar com ajustes (ele diz quais) ou não registrar.

## 4. Registre o que ele aprovou

- Pronto: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<título>" --existing --desc "<o que faz>" --parts "<parte 1>; <parte 2>"`
- Em andamento: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<título>" --desc "<o que já tem e o que falta>"` e um `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task "<o que falta>"` por pendência. Isso a torna a funcionalidade atual: no fim, se havia outra atual antes, volte para ela com `faundr focus "<nome>"`.

No fim, diga em uma linha quantas foram registradas e que elas aparecem em Funcionalidades no painel.
