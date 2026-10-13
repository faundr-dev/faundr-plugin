---
description: Desenha um workflow do projeto no Faundr — como o time quer que o Claude trabalhe num tipo de pedido ("sempre que for de design, faça isto e aquilo"). Salva como rascunho para o dono aprovar e editar no canvas do painel. Use quando o usuário pedir, ou quando você perceber um jeito de trabalhar que se repete no projeto (o mesmo roteiro de passos em pedidos parecidos) ou que o usuário descreveu como "sempre faço assim".
argument-hint: [o que o fluxo faz ou quando usar]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

Workflow é o roteiro que o Claude segue quando um pedido bate com um assunto. Você só **cria rascunho**: aprovar, editar, desligar e apagar ficam com o dono, no painel (Workflows). Nunca diga que o workflow já vale.

1. **Confira se já existe.** Rode `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" workflow list`. Se um deles já cobre o assunto, mostre qual (W-n) e pare; mudar um workflow é no painel.
2. **Pergunte só se estiver vago.** Se não der para saber quando ele vale ou quais são os passos, faça uma pergunta curta (com opções). Se você está propondo por ter percebido um padrão, mostre os passos em uma lista e pergunte se pode salvar o rascunho.
3. **Monte os passos** na ordem em que você seguiria. Cada passo é um `--step`, com o tipo na frente quando não for uma instrução comum:
   - instrução: `"Buscar repositórios parecidos no GitHub — 3 a 5, com licença aberta"`
   - skill do Faundr: `"skill: /faundr:design — auditar as telas mexidas"`
   - agentes em paralelo: `"agentes 2: ler o código — um por área, cada um devolve o que vale copiar"`
   - comando exato: `"comando: git clone --depth 1 <url> ../referencias/<nome>"`
   - perguntar ao dono antes de seguir: `"perguntar: qual dos repositórios clonar?"`
   - esperar algo acontecer: `"esperar: os testes passarem"`
   - passos que rodam ao mesmo tempo: `"paralelo: skill: faundr:design | skill: faundr:browse | comando: npm test"`
   O detalhe vai depois de ` — `. Para skills, use o nome como aparece em `faundr skills list` (ex.: `faundr:design`, `tdd`): elas viram a peça de skill com a origem certa no canvas. O rascunho já nasce com gatilho e fim; decisões (sim/não) o dono desenha no canvas. Passos curtos e verificáveis; de 3 a 8 costuma bastar.
4. **Quando usar e assuntos.** `--when` é uma frase que o Claude lê no início de toda sessão. Cada `--topic` é uma palavra ou expressão que, aparecendo no pedido, traz os passos (ex.: `design`, `tela`, `copiar funcionalidade`). Use `--file` com uma pasta ou padrão (ex.: `src/components/**`) quando o workflow vale para quem edita aquela parte.
5. Salve:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" workflow draft "<nome curto>" --when "<quando usar>" --topic "<assunto>" --topic "<assunto>" --step "<passo>" --step "<passo>"`

Confirme em uma frase: o rascunho W-n foi salvo e passa a valer quando o dono aprovar no painel, em Workflows, onde ele também pode mudar os passos e as ligações no canvas.

## Seguindo um workflow

Quando um workflow ativo chegar no seu contexto ("Este pedido bate com um workflow"), leia os passos com `faundr workflow show <W-n>` e siga na ordem. O time acompanha no canvas do painel, ao vivo, então marque o progresso:

- Ao começar: `faundr workflow run <W-n> --why "<o pedido em uma linha>"` (o passo 1 fica em andamento).
- Ao entrar em cada passo: `faundr workflow step <W-n> <número>` (os anteriores ficam como feitos).
- Passo "perguntar ao dono": `faundr workflow step <W-n> <número> --wait --note "<a pergunta>"`, faça a pergunta e espere. O canvas mostra que é a vez do dono.
- Passo que não se aplica ao pedido: `faundr workflow step <W-n> <número> --skip --note "<por quê>"`. Nunca pule calado.
- No fim: `faundr workflow done <W-n> --note "<o resultado em uma linha>"`. Se o dono mandar parar: `faundr workflow stop <W-n>`.

Um comando por passo basta; não marque passos que não fez.
