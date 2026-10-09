---
description: Conserta testes falhando ou instáveis registrados no Faundr — explica a falha em português simples, descobre se o erro está no código ou no teste, conserta a causa (nunca apaga, pula ou afrouxa o teste só para passar) e confirma rodando de novo com faundr tests-run. Sem argumento, trabalha nos que estão falhando e instáveis, um de cada vez; com --all, conserta todos, sem parar.
argument-hint: "[nome do teste ou arquivo | --all]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm test*) Bash(npm run *) Bash(npx vitest *) Bash(npx jest *) Bash(npx playwright *) Bash(git diff *) Bash(git log *) Read Grep Glob Edit
---

## Contexto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" tests-context --fix`

O alvo: $ARGUMENTS (sem argumento ou com `--all`: os testes FALHANDO e INSTÁVEIS do contexto, um de cada vez, os falhando primeiro; com `--all`, siga também o "Modo --all" no fim).

Leia as seções "Consertar teste falhando" e "Consertar teste instável" do **guia** (caminho no contexto).

## Teste falhando

1. **Rode só ele** para ver a falha atual: `faundr tests-run --files <arquivo>`.
2. **Explique ao dono em uma ou duas frases**, em português simples, o que o teste confere e o que deu errado (ex.: "o teste espera frete grátis acima de R$ 100, mas o app está cobrando R$ 15 em compras de exatamente R$ 100"). No Playwright, abra a captura de tela da falha se o caminho aparecer.
3. **De que lado está o erro?** Veja o que mudou (`git log -p -- <arquivo do código>`, `git diff`):
   - o código mudou de propósito e o teste ficou velho → atualize o teste e **diga por quê**;
   - o código quebrou → conserte o código (na causa; procure quem mais chama a função);
   - não dá para saber qual é o certo → **pergunte ao dono** qual é o comportamento esperado, com as duas opções.
4. **Nunca**: apagar o teste, `.skip`, `.only`, afrouxar o `expect`, mudar o valor esperado sem explicar, aumentar o tempo limite como "solução".
5. Rode de novo o arquivo e, no fim, todos (`faundr tests-run`): o conserto não pode quebrar outro teste. Um teste que voltou a passar fecha sozinho o erro dele na seção Erros.

## Teste instável (passa e falha sem o código mudar)

1. Procure as causas típicas do guia, nesta ordem: espera com tempo fixo; data e hora reais; rede ou serviço real; dependência de outro teste (dado que sobrou, ordem); sorteio sem semente; corrida.
2. Conserte a causa (relógio falso, esperar o resultado em vez do relógio, dado criado no próprio teste, simular o serviço de fora).
3. Confirme rodando o arquivo umas 5 vezes seguidas (`faundr tests-run --files <arquivo>`): tem que passar todas.
4. **Nunca** "resolva" aumentando `retries` ou o tempo limite.

## Modo --all (todos, sem parar)

O usuário pediu para consertar tudo de uma vez: **não pare para perguntar** entre um teste e outro. Comece na hora.

- **Um por vez**, falhando primeiro e instáveis depois, com os passos acima. A cada teste consertado, uma linha só: `<teste> consertado (<feitos>/<total>): <lado do erro, o que mudou>`.
- **O que precisaria do dono não trava o resto**: quando não dá para saber qual comportamento é o certo (passo 3), não escolha; anote em "Esperam você" com as duas opções em uma linha e siga para o próximo.
- **Não sai em 2 tentativas**: desfaça só a mudança daquele teste, anote em "Não deu" com o motivo e siga.
- **Não termine a resposta enquanto houver teste falhando ou instável** que não esteja em "Esperam você" ou "Não deu". Se a conversa for resumida no meio do caminho, rode `faundr tests-context --fix` de novo: ele mostra o que falta.
- **No fim**, rode todos (`faundr tests-run`): o que tiver quebrado no caminho entra na fila. Não faça commit.

A resposta final do modo --all traz também quantos foram consertados e as listas "Esperam você" e "Não deu".

## Responda

Poucas linhas, para quem não programa: o que estava errado, de que lado era (código ou teste), o que mudou e como confirmou (quantas rodadas passaram). Se precisou de decisão do dono, diga qual ficou pendente.
