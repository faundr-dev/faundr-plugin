---
description: Escreve as regras e decisões do time num bloco do AGENTS.md (ou CLAUDE.md), para Codex, Cursor e outros agentes que não rodam o Faundr. Desligado por padrão.
argument-hint: [--file AGENTS.md | --file CLAUDE.md] [--off]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Pedido do usuário: $ARGUMENTS

Rode com a ferramenta Bash: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" agents-md $ARGUMENTS`

O padrão é o AGENTS.md (lido por Codex, Cursor e outros). O Claude Code já recebe a memória pelos hooks do Faundr: escrever no CLAUDE.md repete as regras no contexto, então só use `--file CLAUDE.md` se o usuário pedir.

Conte em uma ou duas frases o que aconteceu: qual arquivo, quantas regras e decisões, que o bloco se atualiza sozinho no começo de cada sessão e que as regras se editam no painel (o bloco é regravado). Lembre que o arquivo vai para o git se não estiver no .gitignore. Para desligar: `/faundr:agents-md --off`.
