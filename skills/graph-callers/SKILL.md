---
description: Mostra quem chama ou importa uma função ou arquivo (ou, com --out, o que ela usa), com profundidade, para saber o que quebra antes de mudar.
argument-hint: <nome ou arquivo> [--out] [--depth N]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-callers $ARGUMENTS`

Explique ao usuário, em português simples, quem depende disso (ou o que isso usa) e o que pode ser afetado por uma mudança, citando arquivo e linha. Se veio "Há N com esse nome", diga qual foi usado e como escolher outro (`arquivo::nome`).
