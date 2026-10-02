---
description: Marca uma preocupação do Faundr como resolvida pelo identificador (P-1, P-2…). Sem argumento, lista as preocupações abertas.
argument-hint: [P-<n>]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" resolve $ARGUMENTS`

- Se uma preocupação foi resolvida, confirme em uma frase (com o identificador).
- Se veio a lista de preocupações abertas, pergunte ao usuário qual resolver (AskUserQuestion, uma opção por preocupação, com o identificador no rótulo) e rode com a ferramenta Bash: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" resolve P-<n>`.
- Se não houver nenhuma aberta, diga isso.
