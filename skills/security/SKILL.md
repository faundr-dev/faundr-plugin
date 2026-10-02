---
description: Revisão de segurança com IA do projeto ligado ao Faundr — lê o código (rotas, login, acesso a dados, regras do banco, entrada do usuário, limites) atrás do que a checagem automática não enxerga (acesso a dados de outro usuário, rota sem login, RLS mal escrita, lógica de pagamento, rate limit, IA) e registra cada problema real como S-n no painel. Use quando o usuário pedir uma revisão de segurança, antes de publicar o app, ou quando o Faundr sugerir.
argument-hint: [--files a.ts,b.ts]  (sem argumento: revisão completa)
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Read Grep Glob
---

## Contexto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-context $ARGUMENTS`

Use a CLI com a ferramenta Bash, sempre com aspas: `faundr ...` (se não estiver no PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

Você está revisando o **código do próprio usuário**, lendo arquivos. Não rode ataques, não chame a API do app, não instale nada. Um achado seu é uma **hipótese lida no código**: seja honesto sobre a confiança.

## 1. Prepare

1. Leia os temas do catálogo listados no contexto (ferramenta Read). Eles dizem o que procurar, onde, como confirmar e o que descarta cada problema.
2. Modo **rápido** (`--files`): revise só esses arquivos e o que eles chamam diretamente. Modo **completo**: todo o projeto, começando pelas portas de entrada.
3. **Supabase**: se o projeto usa Supabase, confira o banco de verdade (inclusive o que foi mudado direto no painel e não está nas migrations). Se o MCP do Supabase estiver ligado, chame `get_advisors` com `type: "security"`, salve a resposta JSON num arquivo temporário e rode `faundr security-import <arquivo>`; senão, se o usuário tiver `SUPABASE_ACCESS_TOKEN` definido, rode `faundr security-supabase`. Não peça o token no chat.
4. Se o grafo do Faundr existir (`.faundr/`), use `faundr graph-query "<pergunta>"` para seguir o caminho do dado (ex.: "quem chama a função que apaga projeto?") em vez de ler tudo.

## 2. Mapeie as portas de entrada

Para cada rota, função de servidor, server action, edge function e política do banco listada no contexto, responda lendo o código:
- **Quem pode chamar?** Exige login? Onde isso é conferido (no próprio handler, num middleware que cobre esta rota)?
- **É dono do dado?** O id que chega (URL, corpo, query) é conferido contra o usuário logado antes de ler, alterar ou apagar?
- **O que entra?** Algum campo do cliente vai direto para o banco, para SQL, para um comando, para HTML, para um fetch de URL, para um prompt de IA? Há campos que o cliente não deveria poder mudar (role, owner_id, plan, preço)?
- **Limites:** tamanho do corpo, paginação, quantidade de pedidos por minuto (login, cadastro, e-mail, IA, escrita).
- **O que sai?** A resposta devolve mais dados do que a tela precisa (hash de senha, e-mails de outros, tokens)? Erros vazam detalhes?

Registre também o que está **limpo**: cobertura é informação.

## 3. Para cada suspeita, feche em um de três estados

- **Confirmado**: você leu o caminho completo e o controle que deveria existir não existe. Registre.
- **Descartado**: você achou o controle específico que impede o problema. **Nomeie o controle** (ex.: "a política RLS `own rows` confere `auth.uid() = user_id`", "o handler chama `findToken` e compara `owner_id`"). Sem nomear o controle, não descarte.
- **Sem prova suficiente**: falta ver uma parte (código de outra pasta, configuração do painel do Supabase). Registre só se o risco for alto, com `--confidence low` e dizendo no detalhe o que falta conferir. **Informação faltando nunca é prova de segurança.**

**Contraevidência antes de registrar**: argumente contra o próprio achado. Procure o controle que o derrubaria (middleware global, RLS fazendo o trabalho, validação num helper, a rota não está exposta). Não descartam um problema:
- "a biblioteca deve cuidar disso" sem ver onde;
- o controle existir em outra rota parecida, mas não nesta;
- a checagem só no front (esconder botão não é autorização);
- o controle que falha aberto (erro → deixa passar);
- a variável "parecer" interna quando ela vem de um parâmetro.

**Calibre a gravidade** pelo que um atacante consegue de fato:
- **crítica**: ler/alterar/apagar dados de qualquer usuário sem login, tomar conta de outra conta, executar código no servidor, pagamento sem pagar;
- **alta**: o mesmo, mas exigindo estar logado; ou abuso que gera custo alto (rota de IA sem limite);
- **média**: exposição limitada, falta de defesa em profundidade com impacto real (sem rate limit no login, CORS aberto sem credenciais);
- **baixa**: detalhe sem caminho de exploração claro.

Não infle: cabeçalho faltando sozinho, self-XSS e open redirect isolado não são críticos.

## 4. Registre cada problema real

Um comando por problema (não repita o que já está na lista de abertos do contexto; se um automático for alarme falso, diga ao usuário e sugira ignorar pelo painel):

`faundr security-finding "<título curto: o problema>" --severity critical|high|medium|low --category <id da verificação no catálogo> --file <caminho> --line <n> --confidence high|medium|low --cwe CWE-xxx --detail "<o que é, em português simples, e o caminho no código>" --impact "<o que alguém consegue fazer, concreto>" --fix "<a correção mínima>"`

Escreva `--detail`, `--impact` e `--fix` para quem **não programa** ler no painel. Nunca cole uma chave inteira: mascare.

## 5. Registre a cobertura

No fim, com a ferramenta Bash:

`faundr security-review-done --areas "<o que você revisou; separado por ;>" --clean "<o que conferiu e está ok, com o controle nomeado; separado por ;>" --summary "<2 frases>"` (acrescente `--quick` no modo rápido)

## 6. Responda

Em português simples, poucas linhas:
1. O que foi revisado e quantos problemas por gravidade.
2. Os mais graves (S-n e uma frase do que pode acontecer).
3. O que ficou limpo e o que **não** foi possível conferir só pelo código (ex.: configuração feita direto no painel do Supabase).

Ofereça corrigir com `/faundr:security-fix S-<n>`. **Não saia corrigindo sem o usuário pedir.**
