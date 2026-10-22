---
description: Arruma o quadro de Funcionalidades no Faundr — confere cada funcionalidade em andamento e cada próxima etapa com os commits e o código, e propõe ao dono marcar como feitas as tarefas que já foram feitas (com a prova), descartar o que não vai mais ser feito e manter o resto. Só muda o que o dono aprovar. Use quando o usuário disser que o quadro está velho ou bagunçado, quando o Faundr avisar de funcionalidades paradas, ou antes de atualizar a Visão.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git log *) Bash(git show *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --review`

O quadro acima tem tudo o que está aberto: **Em andamento** e **Próximas etapas**, com o id curto entre colchetes, quando foi criada e quando foi mexida pela última vez. "parada" = sem mexida há mais de 14 dias.

## 1. Confira cada item com prova

Para cada funcionalidade (comece pelas paradas e pelas mais antigas), descubra se o trabalho já foi feito:

- `git log --oneline --since=<data de criação> -i --grep "<palavra do título>"`, e `git log --oneline -30` para os commits recentes. A mensagem dos commits do projeto costuma dizer o que entrou.
- `faundr graph-query "<assunto>"` para ver se a tela, o comando ou a tabela existe no código. Prefira isso a abrir arquivos.
- Funcionalidades com o mesmo assunto (ex.: uma etapa planejada que outra funcionalidade já entregou) contam como prova.

Classifique cada uma:
- **Feita**: há commit ou código que entrega o que ela pede. Diga qual (hash curto ou arquivo).
- **Descartar**: foi substituída por outro caminho (ex.: uma decisão trocou o plano), ficou velha (versão já passada) ou é duplicada de outra.
- **Manter**: ainda falta de verdade. Diga em poucas palavras o que falta.
- **Não sei**: sem prova para nenhum lado. Não chute: pergunte ao dono.

Não marque nada ainda. Gaste no máximo 3 buscas por funcionalidade.

## 2. Mostre a proposta e espere o OK

Em português simples, uma tabela curta por grupo (Feitas, Descartar, Manter, Não sei), com: nome, o que fazer, e a prova em poucas palavras. Lembre que uma funcionalidade só vai para Concluídas com **todas** as tarefas feitas: em "Feita", diga quais tarefas abertas vão ser marcadas. Se uma tarefa sobrou e não vai ser feita (ex.: um teste que ninguém vai rodar), proponha descartar a funcionalidade ou manter só essa tarefa, e deixe o dono escolher.

Pergunte: **"Posso aplicar? Se quiser mudar algum, diga qual."** Não aplique nada antes da resposta.

## 3. Aplique só o aprovado

- Tarefa feita: `faundr done "<id curto da tarefa>" --already-committed` (o id curto acha a tarefa em qualquer funcionalidade; a opção evita marcar como "sem commit" um trabalho que já está no git)
- Descartar: `faundr feature-discard "<id curto>"` (dá para desfazer com `faundr feature-restore "<id curto>"`, ou pelo botão Restaurar no painel)
- Manter: nada.

No fim, rode `faundr board --review` de novo e diga em uma frase quantas foram concluídas, descartadas e mantidas. Se a Visão do projeto existir, lembre que o "Onde estamos" dela já reflete o quadro na hora.
