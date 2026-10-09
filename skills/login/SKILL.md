---
description: Conecta o Claude Code à sua conta Faundr pelo navegador (o token é criado no computador e não passa pelo chat).
argument-hint: [--url https://...]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Início do login no Faundr:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" login --start $ARGUMENTS`

Se deu erro acima, explique em uma frase e pare. Se o usuário colou um token nos argumentos, avise que não precisa mais (o login agora é pelo navegador) e que é melhor apagar esse token em Token do plugin no painel.

Se deu certo:
1. Mostre ao usuário o código e o link acima e peça para conferir se o código no navegador é o mesmo e clicar em Autorizar.
2. Na mesma resposta, rode `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" login --wait` com timeout de 330000 ms (ele espera até 5 minutos pela aprovação).
3. Informe o resultado em uma frase. Se deu certo, sugira `/faundr:link` para ligar esta pasta a um projeto. Nunca leia nem mostre o conteúdo de `~/.faundr/`.
