---
description: Cria uma funcionalidade no Faundr (com checklist de tarefas e critério de pronto) e a torna a atual desta pasta. Antes, planeja com o dono como em /faundr:planning e guarda as escolhas como decisões.
argument-hint: '<título> [— descrição ou passos]'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

1. **Planeje antes de registrar.** Leia `${CLAUDE_PLUGIN_ROOT}/skills/planning/SKILL.md` e siga os passos 1 a 6 (tamanho, olhar o projeto, poucas perguntas certeiras com recomendação, pronto quando conferível e o resumo para o dono aprovar). Pule se o usuário pediu para não perguntar ou se é uma etapa já planejada (faundr focus). Depois do OK, registre como abaixo.
2. Registre a funcionalidade com o critério de pronto (os itens de "Pronto quando", separados por ponto e vírgula):
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<título curto, até ~8 palavras>" --desc "<descrição>" --done-when "<critério 1>; <critério 2>"`
3. Guarde cada escolha que muda o que vai ser feito como decisão (fica ligada à funcionalidade e volta para o agente nas próximas conversas):
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" decision "<a escolha, ex.: Pagamento só com Pix nesta etapa>" --why "<o que o usuário respondeu e por quê>" --global`
   O que ficou de fora vira decisão também ("Fora desta etapa: …"). Não registre como decisão o que é só detalhe.
4. Se o pedido listar passos, adicione cada um como tarefa: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task "<passo>"`.
5. Se o pedido for maior do que uma etapa (fases, "primeiro X, depois Y", MVP e depois o resto), a funcionalidade criada é só a primeira etapa: registre as seguintes, em ordem, cada uma depois da anterior:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<etapa 2>" --after atual --desc "<o que entra>"`, depois `feature "<etapa 3>" --after "<etapa 2>" …`. Elas ficam planejadas e não viram a atual.
6. Mostre o checklist final com `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board` e diga que ele já aparece no painel (Funcionalidades), com o critério de pronto e as próximas etapas. No fim da etapa, o Faundr pede para conferir o critério antes de dar como pronta.
