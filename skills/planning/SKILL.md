---
description: Planeja uma funcionalidade com o dono antes de construir — mede o tamanho do pedido, olha o projeto antes de perguntar, faz poucas perguntas certeiras (com opções e recomendação), fecha um “pronto quando” que dá para conferir, mostra um resumo curto para aprovar e grava tudo no painel do Faundr. Use quando o usuário pedir algo novo para construir (uma tela, uma função, uma integração), quiser pensar ou planejar uma ideia, ou quando o Faundr avisar que o pedido parece trabalho novo. No começo de um projeto novo, escreve a Visão, as etapas e, se o dono quiser, a arquitetura. Também desenha, se o dono quiser, um diagrama de como a funcionalidade vai funcionar (pedidos como “desenhe como isso vai funcionar” ou “desenhe a arquitetura do projeto”).
argument-hint: [o que quer construir]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

O objetivo é construir a coisa certa com o mínimo de perguntas. Quem responde costuma não programar: pergunte sobre **o que a pessoa vê e faz**, nunca sobre tecnologia. **Fatos são seus, decisões são dele**: o que o projeto já responde, você descobre; só pergunte o que muda o resultado e só ele pode decidir.

## 1. Meça o tamanho

Diga em uma linha qual é o tamanho e o que vai fazer. Em funcionalidade e várias etapas, termine a linha com a saída: "Se preferir, eu só começo."

- **Tarefa rápida** (ajuste, texto, correção pontual): não pergunte nem resuma. Se fizer parte da funcionalidade atual, registre (`faundr task "<passo>"`); se não fizer, não registre. Faça e diga em uma linha o que mudou.
- **Já existe** (o passo 2 mostra que o projeto já faz quase tudo): diga onde está e o que falta, e pergunte só sobre o que falta. Muitas vezes vira tarefa rápida ou só ligar algo.
- **Funcionalidade** (uma coisa nova que a pessoa usa): siga os passos 2 a 7.
- **Várias etapas** (MVP e depois, "primeiro X, depois Y", grande demais para uma sessão): siga 2 a 7 só para a **primeira** etapa; as seguintes ficam registradas em uma linha cada (passo 7).
- **Projeto novo** (o dono descreve um produto inteiro, ou a pasta ainda não tem código nem funcionalidades): leia `${CLAUDE_PLUGIN_ROOT}/skills/planning/projeto.md` e siga o roteiro de começo de projeto (Visão, etapas, decisões e, se ele quiser, a arquitetura).
- **Continuação** da funcionalidade atual ou etapa já planejada (`faundr focus`): não replaneje; só confirme o que mudou, se algo mudou.

O usuário pode mudar o tamanho ("é maior do que isso", "só faz"). Se ele disser para não perguntar, vá direto ao passo 6 com o que dá para decidir sozinho.

## 2. Olhe antes de perguntar

Gaste pouco, mas não pergunte o que dá para descobrir:

- `faundr board` — a funcionalidade atual, as etapas planejadas e as **preocupações abertas (P-n)**, que muitas vezes já contam a intenção do dono.
- `faundr graph-query "<assunto do pedido>"` — onde está o código parecido (telas, dados, quem chama). Prefira isso a abrir arquivo.
- As regras e decisões do time chegam sozinhas no seu contexto; respeite-as e não pergunte de novo o que já foi decidido.
- No máximo 6 leituras ou buscas no total, só as que podem mudar uma pergunta.

Anote os **fatos com prova**, para usar no resumo e nas opções ("o login já usa o Supabase", "já existe a tela de pedidos em `src/routes/pedidos.tsx`").

## 3. Ache as poucas decisões que mudam o resultado

Liste para você (não mostre a lista) de 3 a 6 pontos em que respostas diferentes levam a coisas diferentes **neste pedido**. Nada de tópicos genéricos ("para quem é?") quando o pedido já responde.

- Se o assunto for comum (login, pagamento, aviso por e-mail, lista e busca, envio de arquivo, painel de números, permissões, dados pessoais, integração, agendamento, IA), leia `${CLAUDE_PLUGIN_ROOT}/skills/planning/sondas.md` e pegue só as 2 ou 3 sondas que valem aqui. Antes de usar uma sonda, veja se o projeto já responde: se já existe um jeito (ex.: avisos no Slack), a pergunta vira "manter o que já existe?", com isso como recomendado.
- Inclua, quando fizer diferença, as duas perguntas de falha (na rodada 1, se não dependerem de outra resposta):
  - **Se fosse só metade, o que fica?** (vira o "fora desta etapa").
  - **O que faria você dizer que deu errado, mesmo funcionando?** (vira critério de pronto ou limite).
- **Decida sozinho**, sem perguntar, o que é técnico ou não muda o que a pessoa vê (biblioteca, nome de tabela, estrutura do código, detalhe visual que o design.md já define). Guarde cada uma para a lista "Decidi sozinho" do resumo. O que muda o que um cliente ou alguém do time já vê hoje (preço, acesso, dados que somem) **não** é decisão sua: pergunte.

## 4. Pergunte em rodadas curtas

Use a ferramenta de perguntas ao usuário:

- **De 2 a 4 perguntas por rodada, no máximo 3 rodadas.** Primeiro as que não dependem de outra resposta; as que dependem esperam a rodada seguinte.
- Cada pergunta com **2 a 4 opções concretas tiradas do projeto**, a recomendada primeiro com "(Recomendado)" e o motivo em uma linha na descrição. Fale do resultado: "Mostrar os dados salvos na hora ou esperar os novos?", e não "estratégia de cache".
- Quando der, ofereça uma opção "Você decide" para o que ele não faz questão.
- **Resposta vaga não passa:** "rápido", "simples", "bonito" ou "Outro" com texto genérico ganham uma pergunta de volta na rodada seguinte, com opções que dão número ou exemplo ("rápido: abre em menos de 1 s? aguenta 1000 itens?"). Se ele quiser explicar com as palavras dele, pergunte em texto, sem opções.
- **Pare** quando o "pronto quando" der para conferir e não sobrar decisão que mude o resultado. Não use as 3 rodadas só porque pode.

## 5. Feche o "pronto quando" e revise como quem vai construir

- **Pronto quando**: de 2 a 4 critérios que passam ou falham, cada um dizendo o que a pessoa faz e o que ela vê ("a pessoa paga com Pix e recebe o e-mail de confirmação"; "a lista de 1000 pedidos abre em menos de 1 s"). Nada de "funciona bem" ou "fica bonito".
- **Revisão escondida**: releia o plano como alguém que vai construir sem poder perguntar nada. Para cada dúvida que aparecer:
  - já está respondida → entra no plano;
  - é detalhe → decida e ponha em "Decidi sozinho";
  - só o dono sabe → vira uma última pergunta (conta como rodada).
  Em pedido grande (3 ou mais etapas ou muitas partes do sistema), faça essa revisão com um subagente que recebe só o resumo do passo 6, para ele não herdar o que você já sabe.

## 6. Mostre o resumo e espere o OK

No máximo 15 linhas, neste formato:

```
**<Nome da funcionalidade>**
Para: <quem usa> · Resolve: <o problema, em uma frase>
Já existe: <o que o projeto já faz e vai ser aproveitado, se houver>
Entra: <o que vai ser feito, 2 a 4 itens>
Fora desta etapa: <o que fica para depois>
Pronto quando: <critério 1>; <critério 2>; …
Decidi sozinho: <escolha 1>; <escolha 2>  (diga se quiser mudar algo)
Depois: <próximas etapas, se houver>
```

Pergunte: **"Algo errado ou faltando? Posso registrar e começar?"** Não comece a construir antes do OK.

Quando a funcionalidade tem um fluxo com 3 ou mais partes (tela, servidor, banco, serviço de fora) ou um caminho de erro que importa, acrescente uma linha: "Se quiser, também desenho como vai funcionar, para ver no painel (gasta mais tokens que o normal)." Não ofereça em tarefa pequena. Se ele corrigir algo, ajuste o resumo e confirme só o que mudou.

## 7. Grave no Faundr (sem criar arquivos)

Nada de arquivos .md de plano: tudo vai para o painel, que o agente relê nas próximas sessões.

1. A funcionalidade e o critério:
   `faundr feature "<título curto, até ~8 palavras>" --desc "<para quem e o problema, em uma frase>" --done-when "<critério 1>; <critério 2>"`
2. Cada escolha do dono que muda o que vai ser feito, como decisão:
   `faundr decision "<a escolha>" --why "<o que ele respondeu e por quê>" --global`
   O que ficou de fora vira `"Fora desta etapa: …"`. Das escolhas que você fez sozinho, registre só as que alguém estranharia depois (`--why "Decidi sozinho: <motivo>"`). Use `--file <caminho>` no lugar de `--global` só quando a decisão vale para um arquivo ou pasta específico.
3. Os passos, em ordem: `faundr task "<passo>"` (de 3 a 8, cada um verificável).
4. As etapas seguintes, cada uma depois da anterior:
   `faundr feature "<etapa 2>" --after atual --desc "<o que entra>"`, depois `faundr feature "<etapa 3>" --after "<etapa 2>" --desc "…"`.
5. Mostre o checklist com `faundr board` e diga que ele já está no painel (Funcionalidades), com o critério de pronto.
6. Se o dono pediu o diagrama, leia `${CLAUDE_PLUGIN_ROOT}/skills/planning/diagrama.md` e siga (escreve o JSON de uma vez, `faundr diagram-save`, no máximo 2 correções). Faça isso antes de construir: o desenho é do plano.
7. Então comece pelo primeiro passo.

## Só o diagrama

Se o pedido for só desenhar como uma funcionalidade já registrada vai funcionar, avise que gasta mais tokens, leia o código e as decisões dela (no máximo 6 leituras), siga `diagrama.md` com `--feature "<nome>"` e não refaça o planejamento.

Se for desenhar a arquitetura de um projeto que já existe, avise do custo, use o mapa do código (`faundr graph-query`) e a Visão em vez de abrir muitos arquivos, e siga `diagrama.md` com as camadas e o `--architecture` descritos em `projeto.md` (passo 4.5). As partes que já existem entram com o nome e os `paths` reais delas.
