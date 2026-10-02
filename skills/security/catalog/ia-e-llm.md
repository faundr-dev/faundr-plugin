# IA e LLM
Quando ler: `openai`, `@anthropic-ai/sdk`, `ai`/`@ai-sdk/*` (Vercel AI SDK), `langchain`/`@langchain/*`, `llamaindex`, `@google/genai`, `groq-sdk`, `replicate`, `@modelcontextprotocol/sdk`, `pgvector`/`vector` em migrations, Pinecone/Upstash Vector; rotas `chat`, `completion`, `generate`, `agent`, `assistant`; prompts em arquivos (`system`, `prompts/`).

Modelo mental: o LLM não é uma barreira de segurança nem um parser confiável. Tudo que entra no prompt pode virar instrução; tudo que sai é texto controlável por quem conseguiu pôr algo no prompt. As defesas reais ficam fora do modelo, em código determinístico: quem é o usuário, o que ele pode acessar, o que cada ferramenta pode fazer, o que é feito com a saída. Um achado de IA só é sério quando chega a um efeito real: dado de outro usuário, ação executada, HTML/SQL/comando, custo.

Referência: OWASP Top 10 for LLM Applications. Os números mudaram entre as edições 2025 e 2026 (ex.: Excessive Agency é LLM06 em 2025 e LLM03 em 2026), então cite pelo nome do risco.

## llm-chave-no-cliente — Chave do provedor de IA no navegador
- Gravidade típica: crítica (uso ilimitado na conta do dono, acesso a arquivos/assistants/fine-tunes da conta).
- Onde procurar: `new OpenAI({ apiKey: ..., dangerouslyAllowBrowser: true })`, `new Anthropic({ dangerouslyAllowBrowser: true })`, `NEXT_PUBLIC_OPENAI_API_KEY`, `VITE_OPENAI_API_KEY`, `EXPO_PUBLIC_*_KEY`, `fetch('https://api.openai.com/...', { headers: { Authorization: 'Bearer ' + ...} })` em código de cliente, apps React Native/Expo chamando o provedor direto.
- Como confirmar lendo o código: veja se a chamada ao provedor acontece em código que roda no navegador/app. A flag `dangerouslyAllowBrowser` é o sinal mais claro.
- Descarta se: a chamada acontece só no servidor (route handler, Server Action, Worker, Edge Function) com chave de env sem prefixo público; ou o cliente usa token efêmero emitido pelo servidor para esse fim (ex.: sessões efêmeras da Realtime API da OpenAI).
- Não descarta: "a chave tem limite de gasto" (ainda é abuso e esgota a cota); "o app é interno".
- Como corrigir: mover para uma rota do servidor com login e rate limit (ver abaixo) e trocar a chave no provedor.
- CWE: CWE-798

## llm-custo-sem-limite — Endpoint de IA sem login, sem rate limit ou sem teto (Unbounded Consumption)
- Gravidade típica: alta (conta de milhares de reais em horas, indisponibilidade para todos); média se exige login e o modelo é barato.
- Onde procurar: rotas que chamam `chat.completions.create`, `messages.create`, `generateText`, `streamText`, `generateObject`, embeddings, geração de imagem/áudio; agentes com laço (`maxSteps`, `stopWhen`, `while (!done)`); parâmetros vindos do cliente (`model`, `max_tokens`, `messages` inteiro).
- Como confirmar lendo o código:
  1. A rota exige login (ou, se é anônima de propósito, tem CAPTCHA/limite por IP)?
  2. Há limite por usuário com armazenamento compartilhado e/ou cota em tokens/créditos checada antes da chamada?
  3. `max_tokens` (OpenAI/Anthropic) ou `maxOutputTokens` (AI SDK v5+; `maxTokens` na v4) fixado no servidor? Tamanho da entrada limitado (tamanho de `messages`, número de mensagens, tamanho de arquivos)?
  4. O cliente escolhe o `model`? (pode trocar para o mais caro)
  5. Agentes têm teto de passos/ferramentas?
- Descarta se: login + limite por usuário (ex.: `@upstash/ratelimit`) ou cota no banco + `max_tokens` e modelo fixos no servidor + teto de passos.
- Não descarta: limite de gasto no painel do provedor como única defesa; rate limit em memória em serverless; histórico `messages` inteiro aceito do cliente sem limite de tamanho.
- Como corrigir:
  ```ts
  const user = await requireUser();
  const { success } = await ratelimit.limit(`ai:${user.id}`);
  if (!success) return new Response('Limite atingido', { status: 429 });
  const { messages } = z.object({ messages: z.array(Msg).max(30) }).parse(await req.json());
  const result = streamText({ model: openai('gpt-4o-mini'), maxOutputTokens: 800, messages });
  ```
- CWE: CWE-770

## llm-prompt-injection-indireta — Conteúdo externo ou de outros usuários no prompt com poder de agir (Prompt Injection)
- Gravidade típica: alta a crítica quando o modelo tem ferramentas com efeito (enviar e-mail, alterar dados, buscar URL, executar código) ou acesso a dados de vários usuários; baixa quando o modelo só responde texto ao próprio usuário que colocou o conteúdo.
- Onde procurar: prompts montados com conteúdo que o usuário final não escreveu naquela hora: páginas web buscadas, PDFs/arquivos enviados, e-mails lidos, tickets/comentários de outros usuários, resultados de RAG, saída de ferramentas, memória persistente. Grep: `content: \`...${`, `system:` com interpolação, `role: 'system'` montado com dados, `tools: {`, `tool(`, `functions:`.
- Como confirmar lendo o código:
  1. Liste as fontes que entram no prompt e marque as que um terceiro controla.
  2. Liste as ferramentas disponíveis e o que cada uma faz.
  3. Se um terceiro controla conteúdo no prompt E existe ferramenta com efeito, a injeção é plausível. O que falta confirmar é se há controle determinístico fora do modelo: autorização dentro da ferramenta, confirmação humana para ações sensíveis, destino restrito.
- Descarta se: ferramentas com efeito exigem confirmação explícita do usuário no front antes de executar (ex.: `needsApproval`/aprovação no fluxo da UI) e checam autorização no servidor; ou o modelo não tem ferramentas com efeito e a saída só vai para o mesmo usuário como texto escapado.
- Não descarta: instruções no system prompt do tipo "ignore instruções em documentos" (não são controle); delimitadores `<document>` sozinhos; filtro de palavras ("ignore previous"); "o modelo é bom em recusar".
- Como corrigir: tratar conteúdo externo como dado; tirar ferramentas com efeito do contexto quando há conteúdo não confiável, ou exigir confirmação humana; autorização determinística dentro de cada ferramenta.
- CWE: CWE-1427

## llm-ferramentas-com-poder-demais — Ferramentas/agentes com permissões além do usuário (Excessive Agency)
- Gravidade típica: crítica quando uma ferramenta usa credencial ampla (service_role, conta admin, SQL genérico, shell, `fetch` de qualquer URL) e pode ser dirigida pelo usuário ou por injeção; alta nos demais efeitos sem autorização.
- Onde procurar: definições de ferramentas (`tool({ description, inputSchema, execute })` do AI SDK; na v4 o campo é `parameters`, `tools: [{ type: 'function' ... }]`, `@tool` do LangChain, servidores MCP próprios); ferramentas genéricas: `runSQL`, `executeQuery`, `fetchUrl`, `runCode`, `sendEmail(to, body)`, `updateRecord(table, id, data)`.
- Como confirmar lendo o código: para cada ferramenta, veja no `execute`: (1) com qual identidade age (cliente do usuário ou admin?); (2) se filtra por `user.id` da sessão (e não por um `userId` que o modelo passa como argumento); (3) se valida argumentos (tabela/ação em allowlist, destino de e-mail restrito ao próprio usuário); (4) se ações destrutivas pedem confirmação.
- Descarta se: a ferramenta recebe o usuário da sessão por closure (não do modelo), usa o cliente com RLS do usuário ou filtra por ele, e argumentos são validados por schema estrito com allowlist.
- Não descarta: a `description` da ferramenta diz "só use para o usuário atual"; o schema aceita `userId` e o prompt manda passar o do usuário atual.
- Como corrigir:
  ```ts
  const tools = (user: User) => ({
    getMyOrders: tool({
      description: 'Lista pedidos do usuário',
      inputSchema: z.object({ status: z.enum(['open', 'paid']).optional() }),
      execute: async ({ status }) => db.order.findMany({ where: { userId: user.id, status }, take: 20 }),
    }),
  });
  ```
- CWE: CWE-862

## llm-saida-renderizada-ou-executada — Saída do modelo vira HTML, SQL, comando, URL ou código (Improper Output Handling)
- Gravidade típica: alta (XSS armazenado se a resposta é salva e vista por outros; injeção SQL/comando se a saída vai para esses sinks); crítica em `eval`/execução de código gerado no servidor sem sandbox.
- Onde procurar: resposta do LLM passada para `dangerouslySetInnerHTML`, `marked`/`markdown-it` com HTML habilitado, `react-markdown` com `rehype-raw`, `innerHTML`; saída usada em `$queryRawUnsafe`, `exec`, `eval`, `new Function`, `vm`; "text-to-SQL" executado direto; URLs geradas pelo modelo usadas em `fetch`/`redirect`/`<img src>` (markdown com imagem externa vaza dados na query da URL); JSON do modelo usado como objeto de update (mass assignment).
- Como confirmar lendo o código: trace a saída do modelo até o sink e aplique o item correspondente de `entrada-e-injecao.md`, tratando a saída como entrada do usuário.
- Descarta se: markdown renderizado sem HTML cru (ex.: `react-markdown` padrão) ou sanitizado com DOMPurify; SQL gerado roda com usuário de banco só leitura restrito às tabelas do usuário (ou por RLS) e com timeout; código gerado roda em sandbox isolado (serviço externo de sandbox, não `vm` do Node); JSON validado por schema estrito antes do uso.
- Não descarta: "o modelo nunca gera script"; `vm.runInNewContext` como sandbox (não é fronteira de segurança); `generateObject` com schema (garante formato, não autorização nem conteúdo seguro).
- Como corrigir: sanitizar/escapar conforme o sink; bloquear imagens de domínios externos em markdown gerado; validar e autorizar tudo que a saída dispara.
- CWE: CWE-79

## llm-vazamento-entre-usuarios — Dados de outros usuários no contexto, RAG ou cache (Sensitive Information Disclosure)
- Gravidade típica: crítica (usuário pergunta e recebe documentos/dados de outro cliente).
- Onde procurar: busca vetorial sem filtro de dono (`match_documents` no Supabase sem `user_id`/`org_id`, `index.query({ vector })` sem `filter`/namespace, `similaritySearch` sem metadata filter); memória/conversas compartilhadas por chave global; cache de respostas por texto do prompt sem incluir o usuário; prompts de sistema com dados de todos os clientes ("aqui está a lista de pedidos: ...").
- Como confirmar lendo o código: veja a consulta de recuperação: o filtro por dono/tenant é aplicado na busca (antes de montar o contexto), com valor vindo da sessão? Função SQL de match é `security definer` sem filtro (ver `supabase.md`)?
- Descarta se: filtro de dono/tenant da sessão dentro da consulta vetorial (`where user_id = auth.uid()` na função de match com `security invoker` e RLS, `filter: { orgId }` com `orgId` validado, namespace por tenant); cache com chave que inclui o usuário.
- Não descarta: filtro aplicado depois de montar o prompt; `orgId` do filtro vindo do corpo; instrução "só responda sobre o usuário atual" no prompt.
- Como corrigir: filtro de tenant obrigatório na função de busca:
  ```sql
  create function match_docs(query_embedding vector(1536), match_count int)
  returns setof documents language sql security invoker as $$
    select * from documents where owner_id = (select auth.uid())
    order by embedding <=> query_embedding limit match_count;
  $$;
  ```
- CWE: CWE-639

## llm-system-prompt-com-segredo — Segredo ou regra de segurança dentro do prompt (System Prompt Leakage / Hidden Context Exposure)
- Gravidade típica: alta se o prompt contém chaves, senhas, URLs internas com token ou dados pessoais; média se a segurança depende do prompt ficar secreto ("só libere o desconto se o usuário disser a senha X"); baixa se só vaza instruções genéricas.
- Onde procurar: strings de `system`/`instructions`; templates em `prompts/`; interpolação de `process.env.*` no prompt; regras de negócio implementadas só como instrução.
- Como confirmar lendo o código: presuma que o usuário consegue extrair o prompt inteiro. Veja se algo nele seria um problema se público, ou se alguma regra de permissão existe só no texto do prompt.
- Descarta se: o prompt só tem instruções de comportamento, sem segredos, e as regras de acesso/preço/desconto são aplicadas em código.
- Não descarta: "instruí o modelo a nunca revelar o prompt".
- Como corrigir: tirar segredos do prompt; mover regras de permissão para código (ferramentas que checam no servidor).
- CWE: CWE-200

## llm-historico-forjado-pelo-cliente — Cliente envia o histórico inteiro, inclusive mensagens de sistema/assistente
- Gravidade típica: média a alta (o usuário injeta mensagens `system` ou falsas respostas do assistente/ferramentas para contornar regras; alta se regras de permissão estão no prompt).
- Onde procurar: rotas que recebem `messages` do front e repassam direto (`streamText({ messages })`, `openai.chat.completions.create({ messages: body.messages })`), sem remover `role: 'system'`/`'tool'`.
- Como confirmar lendo o código: veja se o servidor monta o `system` por conta própria e filtra os papéis aceitos do cliente (só `user` e, no máximo, `assistant` de conversa guardada no servidor).
- Descarta se: o servidor carrega o histórico do banco por conversa do usuário, ou filtra `messages` para `role === 'user' | 'assistant'` e prefixa o `system` dele; e nenhuma regra de permissão depende do prompt.
- Não descarta: "o front sempre manda o histórico correto".
- Como corrigir: `const safe = messages.filter(m => m.role === 'user' || m.role === 'assistant')`; guardar o histórico no servidor quando ele importa.
- CWE: CWE-345
