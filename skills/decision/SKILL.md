---
description: Registra uma decisão técnica do time no Faundr (entra no contexto de todos os agentes).
argument-hint: <decisão> [porque ...]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

Separe a decisão (curta, afirmativa, ex.: "Auth fica no Supabase") do porquê, e rode com a ferramenta Bash, com aspas:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" decision "<decisão>" --why "<porquê>"`

Se a decisão vale só para uma parte do código (arquivos, pastas ou padrões como `src/server/**`), acrescente um `--file "<caminho>"` por caminho: ela deixa de entrar no início de toda sessão e chega ao agente antes de ele editar esses arquivos.

Confirme em uma frase e lembre que, a partir da próxima sessão, todo agente deste projeto recebe essa decisão.
