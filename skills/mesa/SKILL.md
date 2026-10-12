---
description: Junta o trabalho da mesa de trabalho (branch mesa/…) ao projeto principal, com o OK do usuário — pega a versão mais nova, junta, roda os testes, resolve conflitos explicando em português simples e envia. Use quando a tarefa feita numa mesa de trabalho terminar e o usuário disser que pode juntar, ou quando ele pedir para "juntar", "mandar para o projeto principal" ou "levar para todo mundo".
argument-hint: [o que foi feito na mesa]
allowed-tools: Bash(git *) Bash(faundr *) Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

Pedido do usuário: $ARGUMENTS

A "mesa de trabalho" é uma branch `mesa/…` em que a pessoa trabalha separada de quem mais está no projeto. Fale sempre "mesa de trabalho" e "projeto principal"; não use "branch", "merge" ou "rebase" com o usuário.

**Só junte com o OK do usuário.** Se ele ainda não disse que pode, pergunte: "Terminei. Posso juntar o seu trabalho ao projeto principal? Assim ele chega para todo mundo do time." e pare.

Com o OK, use a ferramenta Bash:

1. **Tudo salvo na mesa.** `git status --short`. Se houver mudanças, faça um commit com uma mensagem clara do que foi feito.
2. **Quem mais está no projeto.** `faundr team`. Se alguém estiver mexendo nos mesmos arquivos, conte ao usuário antes de seguir.
3. **Versão mais nova do projeto principal.** `git fetch origin`, depois `git merge origin/main` (ou `origin/master`) dentro da mesa. Assim qualquer conflito aparece na mesa, e não no projeto principal.
4. **Conflitos.** Se o git disser que há conflito:
   - abra cada arquivo em conflito e entenda as duas versões (a sua e a que veio do projeto principal);
   - quando der para manter as duas mudanças, junte as duas;
   - quando as duas mudaram a mesma coisa de jeitos diferentes e não for óbvio qual vale, **pergunte ao usuário**, mostrando em português simples as duas opções (o que cada uma faz, sem jargão);
   - depois, explique em 1 a 3 linhas o que foi juntado e como.
5. **Testes.** Rode o que o projeto tiver (testes, checagem de tipos, build). Se algo quebrar por causa da junção, conserte antes de seguir; se não conseguir, pare e diga ao usuário o que quebrou. Nunca envie quebrado.
6. **Enviar.** `git switch main` (ou `master`), `git pull --ff-only`, `git merge --no-ff mesa/<nome> -m "<o que foi feito>"`, `git push`. Se o push for recusado porque chegou coisa nova, volte ao passo 3.
7. **Arrumar.** Pergunte se a mesa pode ser apagada (`git branch -d mesa/<nome>`; se ela estiver no GitHub, também `git push origin --delete mesa/<nome>`). Se a pessoa vai continuar trabalhando com outras pessoas no projeto, ofereça abrir uma mesa nova para a próxima tarefa.
8. **Conte ao usuário** em 2 a 3 linhas: o trabalho chegou ao projeto principal, os testes passaram, e o que foi preciso juntar com o trabalho dos outros (se houve).

Se o projeto não tiver remoto (`git remote -v` vazio), explique que, para juntar o trabalho de duas pessoas, o projeto precisa estar no GitHub, e ofereça ajudar a configurar (criar o repositório e enviar).
