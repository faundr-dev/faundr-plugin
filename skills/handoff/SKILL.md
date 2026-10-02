---
description: Escreve o bilhete de passagem de bastão da sessão no Faundr — o que ficou pela metade, o que falta e cuidados para quem continuar. Aparece em Atividade → Onde parei e no início da próxima sessão.
argument-hint: [o que você quer que fique registrado]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

Escreva um bilhete de 1 a 3 frases, em português simples, com o que ficou pela metade nesta sessão, o que falta fazer e qualquer cuidado para quem continuar. Use o que o usuário disse acima (se disse algo) e o que aconteceu nesta conversa. Não liste arquivos: o Faundr já registra isso sozinho. Rode com a ferramenta Bash, com aspas:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" handoff "<bilhete>"`

Mostre o bilhete ao usuário em uma linha.
