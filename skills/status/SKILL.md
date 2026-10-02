---
description: Mostra a conexão do Faundr nesta pasta (token, projeto ligado, branch).
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" status`

Resuma o status acima para o usuário em poucas linhas, dizendo o que falta configurar, se faltar algo.
