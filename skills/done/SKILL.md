---
description: Marca uma tarefa do checklist do Faundr como concluída (pelo trecho do nome ou número).
argument-hint: <trecho do nome ou nº>
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" done $ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board`

Confirme qual tarefa foi concluída e o que ainda falta, em poucas linhas.
