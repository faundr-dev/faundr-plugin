---
description: Pergunta ao grafo do projeto e recebe as funções e arquivos mais relevantes, com o código, quem chama e o que chamam.
argument-hint: <pergunta>
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Resultados do grafo para: $ARGUMENTS

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-query $ARGUMENTS`

Use os resultados acima para responder, citando arquivo e linha (ex.: `src/cart.mjs:L7`). O código já vem junto: abra o arquivo só se precisar de algo fora do trecho (o fim de um trecho cortado diz onde ler o resto). Se nada servir, tente com o nome de uma função ou tela, ou rode de novo com `--subgraph` para ver as ligações ao redor.
