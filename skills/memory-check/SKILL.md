---
description: Confere se o código ainda segue as regras e decisões registradas no Faundr (memória sem contradição) e arruma a memória (decisões repetidas, substituídas, sem arquivo ligado, ou que deviam ser regra). Use quando o usuário perguntar se o projeto está seguindo o combinado, pedir para arrumar ou revisar a memória, antes de lançar, ou depois de mudanças grandes.
argument-hint: [regra, decisão ou área para conferir]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

1. Leia as regras e decisões confirmadas: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" board --memory`. Se o pedido citar uma regra ou área, confira só ela.
2. Para cada regra ou decisão que diz algo verificável no código (uma biblioteca, um lugar, um jeito de fazer, algo proibido), procure se o código contraria: use `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-query "<o que a regra diz>"` e `graph-grep "<padrão>"` antes de abrir arquivos. Regras sobre processo (ex.: "sempre pedir OK antes de publicar") não se conferem no código: pule.
3. Para cada contradição real (com arquivo e linha), registre uma preocupação: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" concern "Contradição: <regra ou decisão> x <o que o código faz>" --why "<onde (arquivo:linha) e o que fazer: ajustar o código ou mudar a regra>"`.
4. Se uma regra proíbe algo que dá para achar por texto (ex.: importar axios, console.log em tela, chave do Stripe no front), ofereça ligá-la a um padrão, para o Faundr avisar sozinho dali em diante: `faundr rule "<título>" --forbid "<expressão regular>" [--file "<pasta ou padrão>"]`. Só com o OK do usuário.
5. **Arrume a memória** (a lista do passo 1 traz o id de cada item entre colchetes). Monte uma proposta curta, em grupos:
   - **Repetidas ou substituídas**: duas que dizem o mesmo, ou uma que uma mais nova mudou. Proponha aposentar a antiga: `faundr memory-edit <id> --obsolete`.
   - **Ligar a arquivos**: decisão sem `[arquivos: …]` que só importa para uma parte do código (uma tela, o banco, um comando). Ache os arquivos com `graph-query` e proponha: `faundr memory-edit <id> --file "<pasta ou padrão>"` (um `--file` por caminho; prefira pastas e padrões a arquivos que todo mundo mexe).
   - **Virar regra**: decisão que é uma ordem que vale sempre, em qualquer trabalho (ex.: "auth fica no Supabase"). Proponha: `faundr memory-edit <id> --rule`. Seja econômico: regra vai em toda sessão.
   - **Regra de exemplo ou vazia** (ex.: "Memória inicial do projeto"): proponha reescrever ou aposentar.
   Mostre a proposta ao usuário numa lista e pergunte numa rodada só (use a ferramenta de perguntas, com "Aplicar tudo (Recomendado)" como primeira opção). Só rode os comandos com o OK.
6. Responda em português simples: quantas regras e decisões conferiu, as contradições (as mais graves primeiro), as que não dá para conferir no código, o que mudou na memória e o que sugere fazer. Não mude código sem o usuário pedir.
