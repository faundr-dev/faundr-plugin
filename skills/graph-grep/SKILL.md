---
description: Procura um texto ou padrão no código e agrupa os resultados pela função onde aparecem, as mais usadas primeiro.
argument-hint: <padrão> [--in pasta] [-i]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-grep $ARGUMENTS`

Mostre ao usuário onde o texto aparece, começando pelas funções mais usadas (uma mudança nelas afeta mais coisas). Se a busca foi cortada, sugira refinar com `--in <pasta>`.
