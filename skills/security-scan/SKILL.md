---
description: Roda agora a checagem de segurança do Faundr (sem IA, no computador do usuário) — chaves e senhas no código, pacotes com falha conhecida e regras de acesso do banco (Supabase) — e resume o resultado.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-scan`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-show`

Resuma para o usuário em português simples, em poucas linhas:
1. O que foi checado e se está tudo limpo.
2. Os problemas graves (críticos e altos), cada um com o número S-n e uma frase do que pode acontecer.
3. Quantos foram deixados de lado como ruído (arquivo de teste, pacote só de desenvolvimento…), sem listar um por um.

Termine sugerindo o próximo passo: `/faundr:security-fix S-<n>` para o mais grave (ou `/faundr:security-fix` para corrigir todos os graves). Não comece a corrigir sem o usuário pedir.
