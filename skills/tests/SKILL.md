---
description: Testes com IA no projeto ligado ao Faundr — pergunta ao dono o que não pode quebrar, liga cada funcionalidade aos testes que a protegem (mapa testes × funcionalidades no painel) e escreve os testes que faltam pelo guia do Faundr (porta da frente, valor esperado escrito à mão, casos vazio/erro/limite, ver o teste falhar antes), rodando com faundr tests-run. Use quando o usuário pedir testes, perguntar se o app está protegido, ou quando a cobertura do que mudou ficar abaixo do resto do projeto.
argument-hint: [funcionalidade ou arquivo]  (sem argumento: começa pelo que não pode quebrar)
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm test*) Bash(npm run *) Bash(npx vitest *) Bash(npx jest *) Bash(npx playwright *) Read Grep Glob Edit Write
---

## Contexto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" tests-context`

Use a CLI com a ferramenta Bash, sempre com aspas: `faundr ...` (se não estiver no PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

## 1. Prepare

1. Leia o **guia** (caminho no contexto) inteiro. Ele vale mais que o seu jeito de sempre.
2. Leia 2 ou 3 testes que já existem no projeto: mesmo executor, mesma pasta, mesmo estilo. Sem nenhum teste e sem executor: proponha **Vitest** (ou o que combinar com a stack) e **peça o OK do dono antes de instalar** (`npm install -D vitest`). O Faundr nunca instala sozinho.
3. Se o contexto avisar **banco de produção**, não rode nada que toque o banco: proponha criar um `.env.test` com um banco de teste e espere o OK.

## 2. O que não pode quebrar

Se o argumento já diz o alvo, vá direto. Senão, pergunte ao dono **em linguagem de produto**, usando a lista de funcionalidades do contexto (a ferramenta de perguntas, até 4 opções por pergunta, várias escolhas): "Destas, quais não podem quebrar de jeito nenhum?". Registre cada escolhida:

`faundr tests-map "<funcionalidade>" --critical`

## 3. Mapa testes × funcionalidades

Para cada funcionalidade crítica (e as outras, se der tempo), descubra com Grep e lendo os testes quais arquivos de teste a protegem, e registre:

`faundr tests-map "<funcionalidade>" --status coberta|parcial|sem-testes --tests "<arquivo1>,<arquivo2>" --note "<o que está e o que não está testado, uma frase>"`

`coberta` = os caminhos principais e pelo menos um caso de erro têm teste; `parcial` = algo testado, mas falta caminho importante; `sem-testes` = nada.

## 4. Escreva os testes que faltam

Comece pela funcionalidade crítica `sem-testes` ou `parcial`, depois as linhas "mudou e sem teste" do contexto.

- Fatias verticais: **um teste, rode, próximo**. Rode só o arquivo: `faundr tests-run --files <arquivo de teste>` (ou `--changed`).
- Sempre pelo `faundr tests-run`, nunca direto pelo `npx vitest` ou `pytest`: só assim a rodada aparece no painel. Ele acha os executores das subpastas (ex.: `frontend/`) e roda o pytest. Se não achar o Python, passe `--python <caminho do python do venv>` uma vez (fica guardado). Teste que grava no banco de verdade: deixe de fora com `--exclude <arquivo>`.
- Para cada teste novo de código que já existe, **veja ele falhar uma vez**: quebre a linha de propósito, rode, confira o vermelho e **desfaça a quebra**. Diga ao dono que fez isso.
- Siga as 12 regras do guia. Nada de recalcular o esperado como o código calcula; nada de simular módulo do próprio projeto.
- Se achar um bug de verdade enquanto testa (o teste certo falha), **não mude o teste para passar**: pare, explique ao dono o que encontrou e pergunte se corrige.

No fim, rode tudo uma vez com cobertura (se a ferramenta existir): `faundr tests-run --coverage`. Atualize o mapa (`--status coberta` onde ficou coberta).

## Defeito que escapou (T-n, teste de mutação)

Se o argumento for um T-n (ou o dono pedir para matar os defeitos da aba Mutação):
1. Leia o defeito: `faundr tests-show T-<n>` (o código, o estrago e o arquivo:linha).
2. Escreva **um teste** que falharia com esse estrago: pela porta da frente, com o valor esperado escrito à mão. Ex.: estrago `valor > 100` no lugar de `valor >= 100` → teste "frete grátis com exatamente R$ 100".
3. Rode o arquivo de teste (`faundr tests-run --files <arquivo de teste>`) e depois **prove** só naquela linha: `faundr tests-mutation --files <arquivo>:<linha>-<linha>`. O T-n tem que aparecer como "agora pego".
4. Se não existe teste que pegue (o estrago não muda o que o app faz, ex.: `a <= b` num `max`), explique ao dono em uma frase e sugira `faundr tests-ignore T-<n> --reason equivalente --note "<por quê>"`. Não ignore sem o OK dele.

## 5. Responda

Em português simples, poucas linhas:
1. O que não pode quebrar (o que o dono escolheu) e como ficou cada um: coberta / parcial / sem testes.
2. Quantos testes foram escritos, em quais arquivos, e se todos passam.
3. Bugs encontrados no caminho (se houver), sem ter corrigido sem pedir.
4. A cobertura antes e depois, se mediu.

Os resultados aparecem em Testes no painel do Faundr.
