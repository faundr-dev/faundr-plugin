---
description: Corrige problemas de design registrados no Faundr (D-n) seguindo o design.md e o piso de qualidade e, depois de verificar, marca como resolvidos. Com um número, corrige aquele; sem número, corrige os abertos em ordem (o que quebra o uso primeiro, polimento por último), parando ao fim de cada etapa; com --all, corrige todos de uma vez, sem parar.
argument-hint: "[D-<n> … | --all]  (sem argumento: todos os abertos, etapa por etapa; --all: todos, sem parar)"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npx tsc *) Bash(npm run *) Bash(git diff *) Read Grep Glob Edit Write
---

## Problema a corrigir

Argumentos: `$ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-show $ARGUMENTS`

Se aparecer "JÁ RESOLVIDO", "ARQUIVADO" ou um erro, avise o usuário e pare (arquivado = o dono decidiu que não vale para o projeto; para reabrir: `faundr design-reopen D-<n>`).

Se aparecer "SEM NÚMERO", a lista acima já está na ordem de correção. Corrija **um de cada vez**, nessa ordem, repetindo os passos de "Como corrigir" para cada D-n (veja os detalhes de cada um com `faundr design-show D-<n>`).
- **Sem `--all`**: mostre ao usuário as etapas e quantos achados há em cada uma e confirme por onde começar (sugira a etapa 1). Pare ao fim de cada etapa e diga o que foi feito antes de seguir.
- **Com `--all`**: siga o "Modo --all" abaixo.

## Como corrigir

1. Leia o design.md do projeto, o piso de qualidade do Faundr (`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-context` mostra o caminho) e o arquivo apontado. O design.md é a regra: a correção usa as cores, fontes e componentes dele, e reutiliza componentes existentes em vez de recriar estilos.
2. Faça a correção mínima que resolve o problema descrito. Se o problema for grande (ex.: uma tela inteira fora do padrão), diga em 2–3 linhas o plano e confirme com o usuário antes de começar. Nunca mude, sem pedir: URLs, rótulos da navegação, nomes e ordem de campos de formulário, logo, textos legais.
3. Verifique: o projeto compila e, se o servidor de desenvolvimento estiver no ar e o problema for visual ou de celular, abra a tela no navegador (Claude in Chrome), na largura certa, e confira que o problema sumiu.
4. Só depois de verificar, marque como resolvido com a ferramenta Bash: `faundr design-resolve D-<n>`
   Se, ao olhar o código, o problema não existir de verdade (falso alarme) ou contrariar uma decisão registrada no escopo/design.md, não "corrija": arquive com a evidência (`faundr design-archive D-<n> --reason falso-alarme|decisao-de-design --note "<por quê>"`) e conte ao usuário.
5. Se a correção revelar outro problema de design, registre com `faundr design-finding "<título>" --kind ... --rule <tema/nome> --file ... --detail "..."`.

## Modo --all (todos, sem parar)

O usuário pediu para resolver tudo de uma vez: **não pare para perguntar nem ao fim das etapas**. Comece na hora, sem confirmar por onde começar.

- **Um por vez, na ordem da lista**, com os passos de "Como corrigir". A cada achado fechado, uma linha só: `D-<n> resolvido (<feitos>/<total>): <o que mudou>`.
- **O que precisaria do OK do usuário não trava o resto**: problema grande (o passo 2 pediria confirmação), mudança em URL, navegação, formulário, logo ou texto legal, ou dúvida sobre o que o design.md quer. Não faça; anote em "Esperam você", com o plano em uma linha, e siga para o próximo.
- **Achados no mesmo arquivo**: pode corrigir em sequência e compilar uma vez para o grupo, mas só marque cada um como resolvido depois que a compilação passar.
- **Compilação quebrou e não sai em 2 tentativas**: desfaça só a mudança daquele achado, anote em "Não deu" com o erro e siga.
- **Navegador**: confira na tela os achados de celular e visuais quando o servidor estiver no ar; se não estiver, confira pelo código e diga isso no resumo, sem subir o servidor sozinho.
- **Não termine a resposta enquanto houver achado aberto** que não esteja em "Esperam você" ou "Não deu". Se a conversa for resumida no meio do caminho, rode `faundr design-show` de novo: os resolvidos já saíram da lista, e ela é o que falta.
- **No fim**, rode `faundr design-show` mais uma vez: se as correções abriram achados novos, corrija-os também. Não faça commit.

Resposta final do modo --all: quantos resolvidos, quantos arquivados (e por quê), e as listas "Esperam você" e "Não deu", com o D-n e uma linha cada.

## Resposta

Em poucas linhas: o que estava errado, o que mudou e como foi verificado (por D-n).
