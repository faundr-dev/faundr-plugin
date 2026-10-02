---
description: Conecta o Claude Code à sua conta Faundr usando o token gerado no painel.
argument-hint: <token> [--url https://...]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Resultado do login no Faundr:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" login $ARGUMENTS`

Informe o resultado ao usuário em uma frase. Se deu certo, sugira `/faundr:link` para ligar esta pasta a um projeto. Não repita o token.
