---
description: Registra no Faundr uma preocupação — algo que precisa ser revisto depois (não é decisão nem tarefa). Fica em destaque no painel até alguém marcar como resolvida.
argument-hint: <o que preocupa> [— detalhes, o que revisar]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

Separe um título curto e direto (o que preocupa) dos detalhes (por que preocupa, o que precisa ser revisto, quando), sem mudar o sentido do que o usuário disse. Rode com a ferramenta Bash, com aspas:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" concern "<título>" --why "<detalhes>"`

Confirme em uma frase. Não trate a preocupação como decisão nem comece a resolvê-la agora.
