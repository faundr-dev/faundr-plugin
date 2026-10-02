---
description: Roda agora a checagem de qualidade do código do Faundr (sem IA, no computador do usuário) — erro engolido em silêncio, tipos fracos (any, @ts-ignore), funções complicadas demais, código comentado, pacotes dispensáveis, testes pulados e instruções da IA quebradas — e resume o resultado.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" quality-scan`

Resuma para o usuário em português simples, em poucas linhas:
1. O que foi checado (arquivos, linhas) e se está enxuto.
2. Os achados altos, cada um com o número Q-n (veja com `faundr quality-show`) e uma frase do porquê importa.
3. Quantos achados há por tipo (falha escondida, tipo fraco, complicado demais, código demais, limpeza, testes, instruções da IA), sem listar um por um.

Termine sugerindo o próximo passo: `/faundr:quality-fix Q-<n>` para o mais importante, e `/faundr:quality` para a revisão com IA do que a checagem automática não enxerga. Não comece a corrigir sem o usuário pedir.
