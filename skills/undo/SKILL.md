---
description: Volta os arquivos do projeto para um ponto de volta do Faundr — "voltar para quando funcionava". O Faundr salva um sozinho antes da primeira mudança de cada sessão, a cada 30 min de edições e antes de comandos perigosos. Use quando o usuário pedir para desfazer, voltar atrás, "deixar como estava" ou quando o agente quebrou algo que funcionava.
argument-hint: [quando ou o que desfazer]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

Se o pedido trouxer o código de um ponto (letras e números copiados do painel, em Proteção → Pontos de volta), pule para o passo 3 com esse código no lugar de <n>.

1. Liste os pontos de volta com a ferramenta Bash:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" checkpoints`
2. Mostre ao usuário, em português simples, os 3 a 5 mais recentes: quando foi salvo, por quê e o que mudou desde então. Se o pedido já disser qual (ex.: "antes de mexer no login"), sugira o ponto que combina e diga por quê.
3. Veja o que a volta desfaz, sem mudar nada ainda:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" restore <n>`
   Explique ao usuário, em português simples e sem esconder nada: quais arquivos voltam como eram (e que as mudanças feitas neles depois do ponto se perdem), quais são apagados por terem sido criados depois e quais voltam por terem sido apagados. Diga também o que não muda (.env, node_modules, banco de dados, commits) e que o estado de agora fica salvo. Então **pergunte se pode voltar** e espere a resposta. Não volte sem o OK dele, mesmo que o pedido pareça claro.
4. Com o OK: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" restore <n> --yes`. O Claude Code mostra de novo o que muda e pede a confirmação no terminal; isso é esperado.
5. Diga em uma ou duas frases o que voltou, e que o estado de antes ficou salvo (para desfazer a volta: `restore 1 --yes`). Lembre que .env, node_modules e o banco de dados não mudam com a volta.

Se não houver git na pasta, explique que o ponto de volta precisa de git e ofereça rodar `git init` (com o OK do usuário).
