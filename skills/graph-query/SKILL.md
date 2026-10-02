---
description: Pergunta ao grafo do projeto e recebe só o subgrafo relevante (nós, arquivos, linhas e ligações).
argument-hint: <pergunta>
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Subgrafo do projeto para: $ARGUMENTS

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-query $ARGUMENTS`

Use o subgrafo acima para responder à pergunta do usuário, citando arquivo e linha (`src`/`loc`). Leia arquivos só se precisar de detalhes que o grafo não mostra. Se veio "TRUNCADO", rode de novo com `--budget 6000` ou uma pergunta mais específica.
