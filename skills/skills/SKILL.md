---
description: Conecta ao Faundr as skills que a pessoa já usa neste projeto (as do repositório, as pessoais e as dos plugins ligados) — o Faundr guarda o que cada uma faz e quando usar, mostra no painel e na paleta dos workflows, e avisa o Claude na hora de chamar quando o pedido fala do assunto dela. Use quando o usuário pedir, depois de instalar skills ou plugins novos, ou quando o Faundr avisar que há skills sem "quando usar".
argument-hint: [nome de uma skill, para ajustar só ela]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

O Faundr guarda só o **nome, a descrição, a origem** (projeto, pessoal ou plugin) e se a skill é manual. O conteúdo das skills nunca sai do computador; não copie trechos delas para o Faundr.

1. **Leia as skills:** `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" skills scan`. A resposta diz quantas achou por origem, as novas e as que estão sem "quando usar".
2. **Escreva o "quando usar" e os assuntos** de cada skill sem "quando usar" (ou só da que o usuário citou). Veja a descrição com `faundr skills list` e grave:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" skills when "<nome>" --when "<quando usar>" --topic "<assunto>" --topic "<assunto>"`
   - **Quando usar:** uma frase em português simples, do ponto de vista do pedido ("pedido para escrever ou melhorar texto de página"), até 300 caracteres.
   - **Assuntos:** 2 a 5 palavras ou expressões curtas que, aparecendo no pedido, devem lembrar o Claude desta skill (ex.: `headline`, `texto da home`, `copy`). Prefira palavras que só aparecem nesse tipo de pedido; evite genéricas ("código", "projeto", "arquivo"), que trariam o aviso o tempo todo.
   - Skills internas do Faundr (`faundr:*`) já têm o próprio momento de uso: grave só o "quando usar", sem assuntos.
   - Com muitas skills (mais de 15 sem "quando usar"), faça as do projeto primeiro, depois as pessoais e por último as de plugin, e avise quantas faltam.
3. **Confirme** em poucas linhas: quantas skills foram conectadas por origem, quais ganharam assuntos e que elas já aparecem no painel (Workflows → Skills) e na paleta do canvas. Diga que dá para desligar no painel a que não deve ser lembrada.

Skill marcada como manual (só a pessoa chama) aparece com o aviso para pedir à pessoa que rode `/<nome>`; o Claude não consegue chamá-la sozinho.
