---
description: Explica um nó do grafo do projeto (função, arquivo, conceito) e tudo que se conecta a ele.
argument-hint: <nome> ou <caminho::símbolo>
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-explain $ARGUMENTS`

Explique o que é esse nó e o papel dele no projeto a partir das conexões acima (quem usa, o que ele usa, em quais arquivos). Se veio "Ambíguo", pergunte ao usuário qual dos arquivos listados ele quer.
