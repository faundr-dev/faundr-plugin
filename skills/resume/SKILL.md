---
description: Onde paramos — busca no Faundr o que aconteceu na sessão anterior (pedidos, commits, tarefas, bilhete de passagem) e tudo o que está em aberto no projeto (tarefas, preocupações, achados de design, problemas de segurança, erros nos comandos, Visão desatualizada). Use quando o usuário perguntar "onde paramos?", "o que falta?" ou quiser retomar o trabalho.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" resume`

Responda em português simples, a partir só do que está acima (não invente nada):

1. **Onde paramos**: em 2 a 4 frases, o que foi feito na sessão anterior, citando o último commit e o bilhete de passagem, se houver.
2. **O que ficou pendente**: lista curta e numerada, começando pelo bilhete e pelas tarefas em aberto, depois as próximas etapas planejadas (diga qual é a próxima de cada funcionalidade em etapas, pelo nome), depois erros nos comandos (E-n, primeiro os que voltaram), problemas de segurança, achados de design e a Visão desatualizada.
3. **Cuidados**: preocupações abertas que afetam o próximo passo, em uma linha cada.

Termine perguntando por qual pendência o usuário quer começar, sugerindo uma (se uma etapa acabou de terminar, a sugestão natural é a próxima etapa dela). Não comece a trabalhar sem ele escolher.
