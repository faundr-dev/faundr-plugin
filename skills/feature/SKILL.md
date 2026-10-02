---
description: Cria uma funcionalidade no Faundr (com checklist de tarefas) e a torna a atual desta pasta.
argument-hint: <título> [— descrição ou passos]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

1. Extraia um título curto (até ~8 palavras) e, se houver, uma descrição. Rode com a ferramenta Bash, com aspas:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<título>" --desc "<descrição>"`
2. Se o pedido listar passos, adicione cada um como tarefa: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task "<passo>"`.
3. Se o pedido for maior do que uma etapa (fases, "primeiro X, depois Y", MVP e depois o resto), a funcionalidade criada é só a primeira etapa: registre as seguintes, em ordem, cada uma depois da anterior:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<etapa 2>" --after atual --desc "<o que entra>"`, depois `feature "<etapa 3>" --after "<etapa 2>" …`. Elas ficam planejadas e não viram a atual.
4. Mostre o checklist final com `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board` e diga que ele já aparece no painel (Funcionalidades), com as próximas etapas.
