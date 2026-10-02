---
description: Adiciona uma tarefa ao checklist da funcionalidade atual no Faundr.
argument-hint: <descrição da tarefa>
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task $ARGUMENTS`

Confirme em uma frase. Se não havia funcionalidade atual, sugira criar uma com /faundr:feature.
