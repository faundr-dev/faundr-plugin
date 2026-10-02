---
description: Conserta testes falhando ou instáveis registrados no Faundr — explica a falha em português simples, descobre se o erro está no código ou no teste, conserta a causa (nunca apaga, pula ou afrouxa o teste só para passar) e confirma rodando de novo com faundr tests-run. Sem argumento, trabalha nos que estão falhando e instáveis, um de cada vez.
argument-hint: [nome do teste ou arquivo]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm test*) Bash(npm run *) Bash(npx vitest *) Bash(npx jest *) Bash(npx playwright *) Bash(git diff *) Bash(git log *) Read Grep Glob Edit
---

## Contexto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" tests-context --fix`

O alvo: $ARGUMENTS (sem argumento: os testes FALHANDO e INSTÁVEIS do contexto, um de cada vez, os falhando primeiro).

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

## Responda

Poucas linhas, para quem não programa: o que estava errado, de que lado era (código ou teste), o que mudou e como confirmou (quantas rodadas passaram). Se precisou de decisão do dono, diga qual ficou pendente.
