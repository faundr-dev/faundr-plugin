---
description: Mostra como duas coisas do projeto se conectam (caminho mais curto no grafo).
argument-hint: "A" "B" [--undirected]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-path $ARGUMENTS`

Explique o caminho acima em português simples, passo a passo, para quem não programa: o que cada peça faz e por que uma precisa da outra. Leia as linhas citadas no código se precisar entender o papel de cada peça.

Cada ligação vem marcada: `[EXTRACTED]` foi lida no código; `[INFERRED]` ou `[AMBIGUOUS]` foi deduzida pelo mapa (por exemplo, pelo nome) e pode ser engano. Numa ligação deduzida, confira no arquivo se ela existe de verdade antes de explicar, e diga claramente se é real ou um engano do mapa (e por quê).

Se não houver caminho direcionado, tente de novo com `--undirected` usando a ferramenta Bash: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-path $ARGUMENTS --undirected`.
