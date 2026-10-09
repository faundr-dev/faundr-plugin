---
description: Corrige um problema de qualidade registrado no Faundr (Q-n) sem mudar o comportamento do app, e só dá como resolvido quando a checagem não encontra mais o problema (ou, nos da revisão com IA, depois de reler e conferir). Sem argumento, corrige os altos abertos, um de cada vez; com --all, corrige todos os abertos, sem parar.
argument-hint: "[Q-<n> | --all]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm run *) Bash(npx tsc *) Bash(npm uninstall *) Bash(git diff *) Read Grep Glob Edit Write
---

## Problema a corrigir

Argumentos: `$ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" quality-show $ARGUMENTS`

Se aparecer erro, "corrigido" ou "Nenhum problema", avise o usuário e pare. Sem argumento, a lista acima são os abertos: trabalhe só nos **altos**, um de cada vez (rode `faundr quality-show Q-<n>` para ver cada um). Com `--all`, trabalhe em **todos** os da lista, na ordem dela (altos primeiro), seguindo o "Modo --all" no fim.

## Regras (comportamento idêntico)

- **O app tem que fazer exatamente o mesmo depois.** Mesmas entradas, mesmas saídas, mesmos erros, mesma tela. Simplificar não é mudar o que acontece.
- Corrija **na causa**: antes de editar uma função compartilhada, procure todos os que a chamam (Grep). Uma correção no lugar compartilhado é menor que uma em cada chamador e conserta os "irmãos".
- Só o que o problema descreve. Não refatore o que não foi apontado nem "aproveite para arrumar" o resto do arquivo.
- **Nunca corte**: validação de dados de fora, tratamento de erro que evita perda de dados, segurança, acessibilidade, o único teste de uma lógica. "Menos linhas" não é meta: código esperto que ninguém entende não é melhor.
- Siga o padrão do projeto (CLAUDE.md, design.md, código vizinho): nomes, formato, componentes que já existem.
- **Peça o OK antes** quando a correção mexer em mais de 2 arquivos, apagar um arquivo, remover um pacote ou mudar algo que outra pessoa usa (função exportada, rota, tabela). Mostre o plano em 3-5 linhas e espere.
- Se o problema estiver em código gerado, de terceiros ou num teste, diga isso em vez de alterar.
- Simplificou de propósito e há um limite conhecido? Deixe o atalho marcado: `// faundr: <o limite>, <quando melhorar>`. Ele aparece em Qualidade → Atalhos, com dono e idade.

## Como corrigir, por tipo

- **Erro engolido / que só loga / trocado por vazio**: trate de verdade (mostre um aviso, devolva o erro para quem chama, registre com contexto). Se ignorar for de propósito (ex.: apagar um arquivo temporário que pode não existir), deixe um comentário dentro do bloco dizendo por quê: isso é a correção.
- **any / as any / @ts-ignore**: descreva o formato com um tipo; dado de fora vira `unknown` conferido antes de usar; use os tipos que a biblioteca exporta. `@ts-expect-error` só com o motivo na linha.
- **Função complicada / longa / aninhada**: separe em funções com nomes que digam o que fazem; troque escadas de if por retorno antecipado ou uma tabela; mantenha a ordem dos efeitos (o que é salvo, chamado e mostrado).
- **Ternário aninhado**: if/else, switch ou um objeto que mapeia o caso ao valor.
- **Código comentado / código sem uso / export sem uso**: apague (o git guarda). Antes, confira com Grep que nada usa por nome ou por string.
- **Trecho repetido**: junte numa função ou componente só, no lugar que os dois já importam, e use nos dois.
- **Pacote dispensável**: troque pelo recurso nativo citado em todos os lugares que usam o pacote e só então `npm uninstall <pacote>` (com o OK do usuário).
- **Revisão com IA**: siga o "Como resolver" (o substituto concreto) e o tema em `${CLAUDE_PLUGIN_ROOT}/skills/quality/catalog.md`.

## Verificar e fechar

1. Confira que nada mudou no comportamento: o projeto compila (`npx tsc --noEmit` se for TypeScript) e os testes passam, se existirem. Releia o diff (`git diff`) procurando mudança de comportamento sem querer.
2. Feche:
   - Achado da checagem automática: `faundr quality-resolve Q-<n>`. Ele refaz a checagem e só fecha se o problema sumiu; se disser que ainda aparece, revise.
   - Achado da revisão com IA: releia o código corrigido e feche com `faundr quality-resolve Q-<n> --verified "<o que mudou e como conferiu que o comportamento é o mesmo>"`.
3. Alarme falso: **não** ignore por conta própria. Explique ao usuário e sugira ignorar pelo painel (seção Qualidade) ou `faundr quality-ignore Q-<n> --reason falso-alarme|de-proposito --note "<por quê>"`, se ele concordar.

## Modo --all (todos, sem parar)

O usuário pediu para resolver tudo de uma vez: **não pare para perguntar** entre um problema e outro. Comece na hora.

- **Um por vez, na ordem da lista**, com as regras e o "Verificar e fechar" acima. A cada problema fechado, uma linha só: `Q-<n> corrigido (<feitos>/<total>): <o que mudou>`.
- **O que pediria o OK antes não trava o resto** (mais de 2 arquivos, apagar arquivo, remover pacote, mudar algo que outra pessoa usa, alarme falso a ignorar): não faça; anote em "Esperam você", com o plano em uma linha, e siga para o próximo.
- **Problemas no mesmo arquivo**: pode corrigir em sequência e compilar e testar uma vez para o grupo, mas só feche cada um depois que a compilação e os testes passarem.
- **Quebrou e não sai em 2 tentativas** (compilação, teste, ou `quality-resolve` diz que ainda aparece): desfaça só a mudança daquele problema, anote em "Não deu" com o motivo e siga.
- **Não termine a resposta enquanto houver problema aberto** que não esteja em "Esperam você" ou "Não deu". Se a conversa for resumida no meio do caminho, rode `faundr quality-show --all` de novo: os corrigidos já saíram da lista, e ela é o que falta.
- **No fim**, rode `faundr quality-show --all` mais uma vez e corrija o que tiver aparecido de novo. Rode os testes inteiros uma última vez. Não faça commit.

Resposta final do modo --all: quantos corrigidos, as listas "Esperam você" e "Não deu" (Q-n e uma linha cada) e como conferiu que o comportamento continua o mesmo.

## Resposta

Responda em poucas linhas: o que estava errado, o que mudou (arquivos), como conferiu que o comportamento continua o mesmo e o que ficou de fora.
