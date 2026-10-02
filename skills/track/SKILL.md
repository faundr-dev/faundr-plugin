---
name: track
description: Registra no Faundr o que está sendo construído. Use SEMPRE que, num projeto ligado ao Faundr (existe .faundr.json), você começar uma funcionalidade ou tarefa de vários passos, concluir um passo, ou o usuário tomar uma decisão técnica — assim o time acompanha o progresso no painel e ninguém se perde entre sessões.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Use a CLI do Faundr pela ferramenta Bash (`faundr ...`; se não estiver no PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`). Sempre com aspas.

**Ao começar um trabalho de vários passos** (nova tela, integração, refatoração):
1. Se não houver funcionalidade atual adequada (`faundr board`), crie: `faundr feature "<título curto>" --desc "<objetivo>"`.
   Se já existir uma com esse objetivo, troque para ela: `faundr focus "<nome>"`.
2. Registre o plano como checklist: um `faundr task "<passo>"` por passo (3 a 8 passos, verbos no infinitivo).
3. **Trabalho em etapas** (fase 0/1/2, MVP e depois o resto, "agora X, depois Y", algo que você mesmo propôs dividir): a funcionalidade atual é só a etapa de agora. Registre **já no começo** todas as etapas seguintes que você conhece, em ordem, cada uma depois da anterior, com o que entra nela:
   `faundr feature "<etapa 2>" --after atual --desc "<o que entra>"`, depois `faundr feature "<etapa 3>" --after "<etapa 2>" --desc "…"`. Se já souber os passos de uma etapa futura, adicione com `faundr task "<passo>" --feature "<etapa>"`. Elas ficam planejadas (não viram a atual) e o Faundr lembra delas no início da conversa, no fim do checklist, no bilhete e no `/faundr:resume`.
   Ao terminar uma etapa, diga ao usuário qual é a próxima pelo nome e pergunte se segue; para começá-la: `faundr focus "<etapa>"`. Nunca dê a funcionalidade como encerrada quando ela tem etapas registradas pela frente.

**Durante o trabalho:**
- Ao iniciar um passo: `faundr start "<trecho do nome>"`.
- Ao concluir um passo (código feito e verificado): `faundr done "<trecho do nome>"`.
- Surgiu um passo novo: `faundr task "<passo>"`.

**Decisões:** quando o usuário escolher uma abordagem técnica (biblioteca, provedor, padrão, arquitetura), registre: `faundr decision "<decisão afirmativa>" --why "<porquê>"`.

Não registre trivialidades (um ajuste de uma linha, uma pergunta). Não precisa pedir permissão para registrar; mencione em uma linha o que registrou.
