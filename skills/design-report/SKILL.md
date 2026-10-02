---
description: Registra no Faundr um problema de design que o usuário viu (ex.: "o menu da lista abre escondido"). Vira um achado D-n na seção Design do painel.
argument-hint: <o que você viu e onde>
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Problema relatado pelo usuário: $ARGUMENTS

1. Descubra onde está no código: procure a tela/componente citado (use `faundr graph-query "<tela>"` se o projeto tiver grafo, ou busque pelo texto que aparece na tela). Se não der para saber qual tela é, pergunte ao usuário em uma frase.
2. Classifique:
   - `visual`: algo quebrado na tela (cortado, escondido, sobreposto, fora do centro, estourando).
   - `responsive`: quebra no celular ou em telas menores (passa da borda, não cabe, toque difícil).
   - `a11y`: acessibilidade (contraste baixo, foco invisível, botão sem nome para leitor de tela).
   - `off_spec`: diferente do design.md (cor, fonte, forma, tela fora do padrão).
   - `duplicate`: o mesmo elemento recriado em vez de reutilizar um componente.
   - `motion`: animação lenta, estranha ou demais.
   - `content`: texto da tela, estados vazio/carregando/erro faltando ou ruins.
   - `identity`: ícone da aba (favicon), título da página, descrição, imagem de compartilhamento.
   - `practice`: falta algo que deveria existir (componente base, controle que não faz nada).
   Gravidade: `high` se impede o uso, falha acessibilidade básica ou quebra no celular; `medium` se é erro visível com contorno; `low` se é detalhe.
   Regra: o tema do tipo + nome curto (ex.: `responsivo/largura-fixa`, `identidade/sem-favicon`).
3. Registre com a ferramenta Bash, sem mudar o sentido do que o usuário disse; no `--detail`, o que ele viu + a causa provável que você achou no código:
   `faundr design-finding "<título curto>" --kind <tipo> --rule <tema/nome> --severity <gravidade> --file <caminho> --line <n> --detail "<detalhes>" --manual`

Confirme em uma frase com o número D-n e diga que dá para corrigir com `/faundr:design-fix D-<n>`. Não comece a corrigir agora.
