---
description: Corrige um problema de segurança registrado no Faundr (S-n, ou todos os de um pacote) e só dá como resolvido quando a checagem não encontra mais o problema. Sem argumento, corrige os críticos e altos abertos, um de cada vez; com --all, corrige todos os abertos, sem parar.
argument-hint: "[S-<n> | nome-do-pacote | --all]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm install *) Bash(npm update *) Bash(npm ls *) Bash(npx tsc *) Bash(npm run *) Bash(git diff *) Read Grep Glob Edit Write
---

## Problema a corrigir

Argumentos: `$ARGUMENTS`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" security-show $ARGUMENTS`

Se aparecer erro, "corrigido" ou "Nenhum problema", avise o usuário e pare. Sem argumento, a lista acima são os problemas abertos: trabalhe só nos **críticos e altos**, um de cada vez, na ordem da lista (rode `faundr security-show S-<n>` para ver cada um). Com `--all`, trabalhe em **todos** os da lista, de qualquer gravidade, seguindo o "Modo --all" no fim.

## Regras

- Corrija só o que está descrito. Não refatore o que não foi apontado.
- Não invente número de versão nem nome de pacote: use exatamente os valores informados.
- Se o problema estiver em arquivo de teste, exemplo ou documentação, diga isso em vez de alterar o arquivo.
- Ao terminar, liste o que foi alterado e o que ficou de fora, com o motivo.

## Como corrigir, por tipo

**Chave ou senha no código**
1. Tire o valor do código: coloque no `.env` (ou `.env.local`), confira que o `.gitignore` cobre `.env*`, e leia com `process.env.NOME` (no servidor). Nunca use prefixo público (`NEXT_PUBLIC_`, `VITE_`…) para segredo.
2. Diga ao usuário, com destaque, que ele **precisa trocar a chave no provedor** (o link está em "Como resolver"): tirar do código não basta, ela pode já ter vazado, inclusive pelo histórico do git. Você não consegue fazer isso por ele.
3. `.env` no git: `git rm --cached <arquivo>` (o arquivo continua no disco) e ajuste o `.gitignore`. Não reescreva o histórico do git sem o usuário pedir.

**Pacote com falha conhecida**
1. Veja quem trouxe o pacote (`faundr` mostra "Vem de"; confirme com `npm ls <pacote>`).
2. Estratégia, nesta ordem: (a) dependência direta: `npm install <pacote>@^<versão corrigida>`; (b) veio de outro pacote: atualize o pacote pai (`npm update <pai>` ou uma versão nova dele); (c) só se (a) e (b) não resolverem: `overrides` no package.json forçando a versão corrigida.
3. Risco de quebra: salto de patch (1.2.3 → 1.2.9) aplique; minor (1.2 → 1.4) aplique e rode o build/testes; major (1.x → 2.x) explique o risco e pergunte ao usuário antes.
4. Pacote malicioso: remova, apague `node_modules`, reinstale, e avise o usuário para trocar as chaves e senhas daquele computador.

**Banco de dados (Supabase)**
1. Nunca edite uma migration antiga que já rodou: crie uma migration nova (ex.: `supabase/migrations/<data>_seguranca.sql`).
2. Tabela sem RLS: `alter table public.<t> enable row level security;` + políticas que confiram o dono, ex.: `using ((select auth.uid()) = user_id)`. Confira no código se o app lê essa tabela e se as políticas novas não bloqueiam o uso normal.
3. Política com `true`: `drop policy` + `create policy` com a condição do dono.
4. Mostre a migration ao usuário antes de aplicar no banco.

**Código e configuração (checagem automática ou revisão com IA)**
1. Siga o "Como resolver" do problema e o tema correspondente do catálogo (`${CLAUDE_PLUGIN_ROOT}/skills/security/catalog/`), com a correção mínima.
2. Acesso a dados (IDOR, rota sem login): confira o usuário logado no servidor e compare com o dono do dado antes de ler, alterar ou apagar; nunca confie num id ou `user_id` vindo do cliente.
3. Limite de pedidos (rate limit): use o que a plataforma do projeto oferece (Cloudflare: binding de Rate Limiting do Workers; Vercel/Node: `@upstash/ratelimit`; Express: `express-rate-limit`), comece pelas rotas sensíveis (login, cadastro, e-mail, IA, escrita) e responda 429. Se precisar de conta ou configuração nova no provedor, explique ao usuário e pergunte antes.
4. Cabeçalhos de segurança: adicione no lugar onde o projeto já monta as respostas (middleware, `headers()` do Next, `_headers`), com a CSP primeiro em modo Report-Only.

## Verificar e fechar

1. O projeto compila (e os testes passam, se existirem).
2. Rode com a ferramenta Bash: `faundr security-resolve S-<n>` para cada problema corrigido. Nos da checagem automática, ele refaz a checagem e só fecha se o problema sumiu; se disser que ainda aparece, revise a correção. Nos da revisão com IA, releia o código corrigido e feche com `faundr security-resolve S-<n> --verified "<o que mudou e como conferiu>"`.
3. Se aparecer um problema que é alarme falso, **não** ignore por conta própria: explique ao usuário e sugira ignorar pelo painel (seção Segurança) ou com `faundr security-ignore S-<n> --reason nao-e-problema --note "<por quê>"`, se ele concordar.

## Modo --all (todos, sem parar)

O usuário pediu para resolver tudo de uma vez: **não pare para perguntar** entre um problema e outro. Comece na hora, pelos críticos e altos, depois o resto.

- **Um por vez, na ordem da lista**, com as regras e o "Verificar e fechar" acima. Problemas do mesmo pacote saem numa atualização só. A cada problema fechado, uma linha só: `S-<n> corrigido (<feitos>/<total>): <o que mudou>`.
- **O que precisaria do usuário não trava o resto**: salto de versão major, aplicar migration no banco (escreva a migration, não aplique), conta ou configuração nova no provedor, alarme falso a ignorar. Não faça; anote em "Esperam você", com o plano em uma linha, e siga para o próximo. Chave no código: tire do código normalmente e anote a troca no provedor em "Esperam você".
- **Quebrou e não sai em 2 tentativas** (compilação, teste, ou `security-resolve` diz que ainda aparece): desfaça só a mudança daquele problema, anote em "Não deu" com o motivo e siga.
- **Não termine a resposta enquanto houver problema aberto** que não esteja em "Esperam você" ou "Não deu". Se a conversa for resumida no meio do caminho, rode `faundr security-show` de novo: os corrigidos já saíram da lista, e ela é o que falta.
- **No fim**, rode `faundr security-show` mais uma vez e corrija o que tiver aparecido de novo. Não faça commit.

Resposta final do modo --all: quantos corrigidos e as listas "Esperam você" (com destaque para chaves a trocar e migrations a aplicar) e "Não deu", com o S-n e uma linha cada.

## Resposta

Responda em poucas linhas: o que estava errado, o que mudou, como foi verificado e o que o usuário ainda precisa fazer (ex.: trocar a chave no provedor).
