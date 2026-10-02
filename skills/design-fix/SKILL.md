---
description: Corrige problemas de design registrados no Faundr (D-n) seguindo o design.md e o piso de qualidade e, depois de verificar, marca como resolvidos. Com um número, corrige aquele; sem número, corrige os abertos em ordem (o que quebra o uso primeiro, polimento por último).
argument-hint: "[D-<n> …]  (sem argumento: todos os abertos, em ordem)"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## Problema a corrigir

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-show $ARGUMENTS`

Se aparecer "JÁ RESOLVIDO", "ARQUIVADO" ou um erro, avise o usuário e pare (arquivado = o dono decidiu que não vale para o projeto; para reabrir: `faundr design-reopen D-<n>`).

Se aparecer "SEM NÚMERO", a lista acima já está na ordem de correção. Mostre ao usuário as etapas e quantos achados há em cada uma e confirme por onde começar (sugira a etapa 1). Depois corrija **um de cada vez**, nessa ordem, repetindo os passos abaixo para cada D-n (veja os detalhes de cada um com `faundr design-show D-<n>`). Pare ao fim de cada etapa e diga o que foi feito antes de seguir.

## Como corrigir

1. Leia o design.md do projeto, o piso de qualidade do Faundr (`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-context` mostra o caminho) e o arquivo apontado. O design.md é a regra: a correção usa as cores, fontes e componentes dele, e reutiliza componentes existentes em vez de recriar estilos.
2. Faça a correção mínima que resolve o problema descrito. Se o problema for grande (ex.: uma tela inteira fora do padrão), diga em 2–3 linhas o plano e confirme com o usuário antes de começar. Nunca mude, sem pedir: URLs, rótulos da navegação, nomes e ordem de campos de formulário, logo, textos legais.
3. Verifique: o projeto compila e, se o servidor de desenvolvimento estiver no ar e o problema for visual ou de celular, abra a tela no navegador (Claude in Chrome), na largura certa, e confira que o problema sumiu.
4. Só depois de verificar, marque como resolvido com a ferramenta Bash: `faundr design-resolve D-<n>`
   Se, ao olhar o código, o problema não existir de verdade (falso alarme) ou contrariar uma decisão registrada no escopo/design.md, não "corrija": arquive com a evidência (`faundr design-archive D-<n> --reason falso-alarme|decisao-de-design --note "<por quê>"`) e conte ao usuário.
5. Se a correção revelar outro problema de design, registre com `faundr design-finding "<título>" --kind ... --rule <tema/nome> --file ... --detail "..."`.

Responda em poucas linhas: o que estava errado, o que mudou e como foi verificado (por D-n).
