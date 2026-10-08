---
description: Cria uma funcionalidade no Faundr (com checklist de tarefas e critério de pronto) e a torna a atual desta pasta. Antes, faz de 3 a 5 perguntas de escopo e guarda as respostas como decisões.
argument-hint: <título> [— descrição ou passos]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

1. **Perguntas de escopo (antes de registrar).** Com a ferramenta de perguntas ao usuário, faça de 3 a 5 perguntas curtas, numa rodada só, cada uma com 2 a 4 opções concretas tiradas do pedido e do projeto (a mais provável primeiro, marcada "(Recomendado)"). Cubra:
   - **Para quem e para quê:** quem usa e que problema resolve (se o pedido já disse, pule).
   - **Fora desta etapa:** o que fica de fora agora (para não crescer sem fim).
   - **Pronto quando:** como saber que ficou pronto, de um jeito que dá para conferir (ex.: "a pessoa paga com Pix e recebe o e-mail", "a lista abre em menos de 1 s com 1000 itens").
   - **O que toca:** telas, dados, serviços pagos ou integrações afetados (o que pode quebrar).
   - **Limites:** prazo, custo, segurança ou algo que não pode mudar (só se fizer diferença).
   Pule as perguntas se o usuário pediu para não perguntar, se o pedido já responde a tudo ou se é uma etapa já planejada (faundr focus). Se ele responder "Outro", use o que ele escreveu.
2. Registre a funcionalidade com o critério de pronto (os itens de "Pronto quando", separados por ponto e vírgula):
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<título curto, até ~8 palavras>" --desc "<descrição>" --done-when "<critério 1>; <critério 2>"`
3. Guarde cada escolha que muda o que vai ser feito como decisão (fica ligada à funcionalidade e volta para o agente nas próximas conversas):
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" decision "<a escolha, ex.: Pagamento só com Pix nesta etapa>" --why "<o que o usuário respondeu e por quê>"`
   O que ficou de fora vira decisão também ("Fora desta etapa: …"). Não registre como decisão o que é só detalhe.
4. Se o pedido listar passos, adicione cada um como tarefa: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" task "<passo>"`.
5. Se o pedido for maior do que uma etapa (fases, "primeiro X, depois Y", MVP e depois o resto), a funcionalidade criada é só a primeira etapa: registre as seguintes, em ordem, cada uma depois da anterior:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "<etapa 2>" --after atual --desc "<o que entra>"`, depois `feature "<etapa 3>" --after "<etapa 2>" …`. Elas ficam planejadas e não viram a atual.
6. Mostre o checklist final com `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board` e diga que ele já aparece no painel (Funcionalidades), com o critério de pronto e as próximas etapas. No fim da etapa, o Faundr pede para conferir o critério antes de dar como pronta.
