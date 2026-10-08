---
description: Liga a barra de status do Faundr no Claude Code (projeto, funcionalidade e passo atuais, grafo em dia, preocupações abertas).
argument-hint: [--force]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" statusline-install $ARGUMENTS`

Conte ao usuário, em uma ou duas frases, o resultado acima. Se já existia outra barra de status, explique que ela não foi trocada e que `/faundr:statusline --force` troca pela do Faundr (a anterior fica no texto acima, se ele quiser voltar). A barra só lê arquivos do computador: não gasta tokens nem usa a rede.
