---
description: Confere se o código ainda segue as regras e decisões registradas no Faundr (memória sem contradição). Use quando o usuário perguntar se o projeto está seguindo o combinado, antes de lançar, ou depois de mudanças grandes.
argument-hint: [regra, decisão ou área para conferir]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

1. Leia as regras e decisões confirmadas: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --memory`. Se o pedido citar uma regra ou área, confira só ela.
2. Para cada regra ou decisão que diz algo verificável no código (uma biblioteca, um lugar, um jeito de fazer, algo proibido), procure se o código contraria: use `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-query "<o que a regra diz>"` e `graph-grep "<padrão>"` antes de abrir arquivos. Regras sobre processo (ex.: "sempre pedir OK antes de publicar") não se conferem no código: pule.
3. Para cada contradição real (com arquivo e linha), registre uma preocupação: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" concern "Contradição: <regra ou decisão> x <o que o código faz>" --why "<onde (arquivo:linha) e o que fazer: ajustar o código ou mudar a regra>"`.
4. Se uma regra proíbe algo que dá para achar por texto (ex.: importar axios, console.log em tela, chave do Stripe no front), ofereça ligá-la a um padrão, para o Faundr avisar sozinho dali em diante: `faundr rule "<título>" --forbid "<expressão regular>" [--file "<pasta ou padrão>"]`. Só com o OK do usuário.
5. Responda em português simples: quantas regras e decisões conferiu, as contradições (as mais graves primeiro), as que não dá para conferir no código e o que sugere fazer. Não mude código sem o usuário pedir.
