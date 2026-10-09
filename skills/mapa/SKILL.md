---
description: Mapa do código. Sem nada, gera ou refaz o mapa e envia ao painel. Com uma pergunta ("como o login funciona?", "o que quebra se eu mudar o AuthGate?", "como a página inicial chega no banco?"), responde a partir do mapa, citando arquivo e linha.
argument-hint: [pergunta]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" mapa $ARGUMENTS`

- **Sem pergunta (o mapa foi gerado):** diga em uma frase quantos nós, ligações e comunidades ele tem e que ele já aparece em "Mapa do código" no painel. Daqui em diante ele se atualiza sozinho quando arquivos são editados.
- **Com pergunta:** responda em português simples, para quem não programa, citando arquivo e linha (ex.: `src/cart.mjs:L7`). O código já veio junto acima: abra um arquivo só se precisar de algo fora do trecho. Conforme a pergunta, complete com uma consulta a mais, usando a ferramenta Bash:
  - "o que quebra se eu mudar X?": `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-callers "X" --depth 2`
  - "como A chega em B?" ou "como A se liga a B?": `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-path "A" "B"`
  - tudo o que se liga a uma peça: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-callers "X" --both`
  - onde um texto exato aparece: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-grep "texto"`
- **Caminho entre duas peças** (veio "Caminho mais curto"): explique passo a passo o que cada peça faz e por que uma precisa da outra. Ligação `[EXTRACTED]` foi lida no código; `[INFERRED]` ou `[AMBIGUOUS]` foi deduzida e pode ser engano: confira no arquivo antes de explicar e diga se é real.
- **Se deu erro**, mostre a mensagem e sugira /faundr:status.
