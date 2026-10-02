---
description: Liga a pasta atual a um projeto do Faundr (pelo id ou nome; sem argumento, lista os projetos).
argument-hint: [id ou nome do projeto]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Resultado:

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" link $ARGUMENTS`

- Se a pasta foi ligada, confirme ao usuário em uma frase e diga que os eventos desta sessão já passam a aparecer no painel.
- Se veio uma lista de projetos, pergunte ao usuário qual usar (AskUserQuestion, uma opção por projeto) e então rode com a ferramenta Bash: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" link <id escolhido>`.
- Se houve erro (sem token, token inválido), explique e sugira `/faundr:login <token>`.
