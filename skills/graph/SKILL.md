---
description: Gera o grafo de conhecimento do projeto (código + docs) e envia para o Faundr.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph`

- Se o grafo foi enviado, diga em uma frase quantos nós/ligações/comunidades ele tem e que ele já aparece em "Mapa do código" no painel. Daqui em diante ele se atualiza sozinho quando arquivos são editados, e você pode consultá-lo com /faundr:graph-query, /faundr:graph-path e /faundr:graph-explain.
- Se deu erro, mostre a mensagem e sugira /faundr:status.
