# AI and LLM
When to read: `openai`, `@anthropic-ai/sdk`, `ai`/`@ai-sdk/*` (Vercel AI SDK), `langchain`/`@langchain/*`, `llamaindex`, `@google/genai`, `groq-sdk`, `replicate`, `@modelcontextprotocol/sdk`, `pgvector`/`vector` in migrations, Pinecone/Upstash Vector; routes `chat`, `completion`, `generate`, `agent`, `assistant`; prompts in files (`system`, `prompts/`).

Mental model: the LLM is neither a security barrier nor a reliable parser. Everything that goes into the prompt can become an instruction; everything that comes out is text controllable by whoever managed to put something into the prompt. The real defenses sit outside the model, in deterministic code: who the user is, what they can access, what each tool can do, what is done with the output. An AI finding is only serious when it reaches a real effect: another user's data, an executed action, HTML/SQL/command, cost.

Reference: OWASP Top 10 for LLM Applications. The numbers changed between the 2025 and 2026 editions (e.g.: Excessive Agency is LLM06 in 2025 and LLM03 in 2026), so cite it by the risk's name.

## llm-chave-no-cliente — AI provider key in the browser
- Typical severity: critical (unlimited use on the owner's account, access to the account's files/assistants/fine-tunes).
- Where to look: `new OpenAI({ apiKey: ..., dangerouslyAllowBrowser: true })`, `new Anthropic({ dangerouslyAllowBrowser: true })`, `NEXT_PUBLIC_OPENAI_API_KEY`, `VITE_OPENAI_API_KEY`, `EXPO_PUBLIC_*_KEY`, `fetch('https://api.openai.com/...', { headers: { Authorization: 'Bearer ' + ...} })` in client code, React Native/Expo apps calling the provider directly.
- How to confirm by reading the code: see whether the provider call happens in code that runs in the browser/app. The `dangerouslyAllowBrowser` flag is the clearest sign.
- Ruled out if: the call happens only on the server (route handler, Server Action, Worker, Edge Function) with a key from env without a public prefix; or the client uses an ephemeral token issued by the server for that purpose (e.g.: ephemeral sessions of OpenAI's Realtime API).
- Does not rule out: "the key has a spending limit" (it is still abuse and exhausts the quota); "the app is internal".
- How to fix: move it to a server route with login and rate limit (see below) and rotate the key at the provider.
- CWE: CWE-798

## llm-custo-sem-limite — AI endpoint without login, without rate limit or without a cap (Unbounded Consumption)
- Typical severity: high (a bill of thousands in hours, unavailability for everyone); medium if it requires login and the model is cheap.
- Where to look: routes that call `chat.completions.create`, `messages.create`, `generateText`, `streamText`, `generateObject`, embeddings, image/audio generation; agents with a loop (`maxSteps`, `stopWhen`, `while (!done)`); parameters coming from the client (`model`, `max_tokens`, the whole `messages`).
- How to confirm by reading the code:
  1. Does the route require login (or, if it is anonymous on purpose, does it have CAPTCHA/a per-IP limit)?
  2. Is there a per-user limit with shared storage and/or a token/credit quota checked before the call?
  3. Is `max_tokens` (OpenAI/Anthropic) or `maxOutputTokens` (AI SDK v5+; `maxTokens` in v4) fixed on the server? Is the input size limited (size of `messages`, number of messages, file size)?
  4. Does the client choose the `model`? (it can switch to the most expensive one)
  5. Do agents have a step/tool cap?
- Ruled out if: login + per-user limit (e.g.: `@upstash/ratelimit`) or a quota in the database + `max_tokens` and model fixed on the server + a step cap.
- Does not rule out: a spending limit in the provider's dashboard as the only defense; in-memory rate limit in serverless; the whole `messages` history accepted from the client without a size limit.
- How to fix:
  ```ts
  const user = await requireUser();
  const { success } = await ratelimit.limit(`ai:${user.id}`);
  if (!success) return new Response('Limite atingido', { status: 429 });
  const { messages } = z.object({ messages: z.array(Msg).max(30) }).parse(await req.json());
  const result = streamText({ model: openai('gpt-4o-mini'), maxOutputTokens: 800, messages });
  ```
- CWE: CWE-770

## llm-prompt-injection-indireta — External or other users' content in the prompt with the power to act (Prompt Injection)
- Typical severity: high to critical when the model has tools with effects (send email, change data, fetch a URL, run code) or access to several users' data; low when the model only answers text to the same user who put the content in.
- Where to look: prompts built with content the end user did not write at that moment: fetched web pages, uploaded PDFs/files, read emails, other users' tickets/comments, RAG results, tool output, persistent memory. Grep: `content: \`...${`, `system:` with interpolation, `role: 'system'` built with data, `tools: {`, `tool(`, `functions:`.
- How to confirm by reading the code:
  1. List the sources that go into the prompt and mark those a third party controls.
  2. List the available tools and what each one does.
  3. If a third party controls content in the prompt AND there is a tool with effects, injection is plausible. What remains to confirm is whether there is a deterministic control outside the model: authorization inside the tool, human confirmation for sensitive actions, restricted destination.
- Ruled out if: tools with effects require explicit user confirmation in the front end before running (e.g.: `needsApproval`/approval in the UI flow) and check authorization on the server; or the model has no tools with effects and the output only goes to the same user as escaped text.
- Does not rule out: instructions in the system prompt like "ignore instructions in documents" (they are not a control); `<document>` delimiters alone; word filters ("ignore previous"); "the model is good at refusing".
- How to fix: treat external content as data; remove tools with effects from the context when there is untrusted content, or require human confirmation; deterministic authorization inside each tool.
- CWE: CWE-1427

## llm-ferramentas-com-poder-demais — Tools/agents with permissions beyond the user's (Excessive Agency)
- Typical severity: critical when a tool uses a broad credential (service_role, admin account, generic SQL, shell, `fetch` of any URL) and can be steered by the user or by injection; high for other effects without authorization.
- Where to look: tool definitions (`tool({ description, inputSchema, execute })` from the AI SDK; in v4 the field is `parameters`, `tools: [{ type: 'function' ... }]`, LangChain's `@tool`, custom MCP servers); generic tools: `runSQL`, `executeQuery`, `fetchUrl`, `runCode`, `sendEmail(to, body)`, `updateRecord(table, id, data)`.
- How to confirm by reading the code: for each tool, look in `execute`: (1) with which identity it acts (the user's client or admin?); (2) whether it filters by the session's `user.id` (and not by a `userId` the model passes as an argument); (3) whether it validates arguments (table/action in an allowlist, email destination restricted to the user themselves); (4) whether destructive actions ask for confirmation.
- Ruled out if: the tool receives the session user through a closure (not from the model), uses the client with the user's RLS or filters by them, and arguments are validated by a strict schema with an allowlist.
- Does not rule out: the tool's `description` says "only use for the current user"; the schema accepts `userId` and the prompt says to pass the current user's.
- How to fix:
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

## llm-saida-renderizada-ou-executada — Model output becomes HTML, SQL, a command, a URL or code (Improper Output Handling)
- Typical severity: high (stored XSS if the response is saved and seen by others; SQL/command injection if the output goes to those sinks); critical with `eval`/execution of generated code on the server without a sandbox.
- Where to look: LLM response passed to `dangerouslySetInnerHTML`, `marked`/`markdown-it` with HTML enabled, `react-markdown` with `rehype-raw`, `innerHTML`; output used in `$queryRawUnsafe`, `exec`, `eval`, `new Function`, `vm`; "text-to-SQL" executed directly; URLs generated by the model used in `fetch`/`redirect`/`<img src>` (markdown with an external image leaks data in the URL's query); model JSON used as an update object (mass assignment).
- How to confirm by reading the code: trace the model output to the sink and apply the corresponding item from `input-and-injection.md`, treating the output as user input.
- Ruled out if: markdown rendered without raw HTML (e.g.: default `react-markdown`) or sanitized with DOMPurify; generated SQL runs with a read-only database user restricted to the user's tables (or by RLS) and with a timeout; generated code runs in an isolated sandbox (an external sandbox service, not Node's `vm`); JSON validated by a strict schema before use.
- Does not rule out: "the model never generates script"; `vm.runInNewContext` as a sandbox (it is not a security boundary); `generateObject` with a schema (guarantees format, not authorization nor safe content).
- How to fix: sanitize/escape according to the sink; block images from external domains in generated markdown; validate and authorize everything the output triggers.
- CWE: CWE-79

## llm-vazamento-entre-usuarios — Other users' data in the context, RAG or cache (Sensitive Information Disclosure)
- Typical severity: critical (a user asks and receives another customer's documents/data).
- Where to look: vector search without an owner filter (`match_documents` in Supabase without `user_id`/`org_id`, `index.query({ vector })` without `filter`/namespace, `similaritySearch` without a metadata filter); memory/conversations shared by a global key; response cache keyed by prompt text without including the user; system prompts with all customers' data ("here is the list of orders: ...").
- How to confirm by reading the code: look at the retrieval query: is the owner/tenant filter applied in the search (before building the context), with a value coming from the session? Is the SQL match function `security definer` without a filter (see `supabase.md`)?
- Ruled out if: session owner/tenant filter inside the vector query (`where user_id = auth.uid()` in the match function with `security invoker` and RLS, `filter: { orgId }` with a validated `orgId`, namespace per tenant); cache with a key that includes the user.
- Does not rule out: filter applied after building the prompt; filter `orgId` coming from the body; an instruction "only answer about the current user" in the prompt.
- How to fix: mandatory tenant filter in the search function:
  ```sql
  create function match_docs(query_embedding vector(1536), match_count int)
  returns setof documents language sql security invoker as $$
    select * from documents where owner_id = (select auth.uid())
    order by embedding <=> query_embedding limit match_count;
  $$;
  ```
- CWE: CWE-639

## llm-system-prompt-com-segredo — Secret or security rule inside the prompt (System Prompt Leakage / Hidden Context Exposure)
- Typical severity: high if the prompt contains keys, passwords, internal URLs with a token or personal data; medium if security depends on the prompt staying secret ("only grant the discount if the user says password X"); low if it only leaks generic instructions.
- Where to look: `system`/`instructions` strings; templates in `prompts/`; interpolation of `process.env.*` in the prompt; business rules implemented only as instructions.
- How to confirm by reading the code: assume the user can extract the whole prompt. See whether anything in it would be a problem if public, or whether any permission rule exists only in the prompt text.
- Ruled out if: the prompt only has behavior instructions, without secrets, and access/price/discount rules are enforced in code.
- Does not rule out: "I instructed the model to never reveal the prompt".
- How to fix: take secrets out of the prompt; move permission rules into code (tools that check on the server).
- CWE: CWE-200

## llm-historico-forjado-pelo-cliente — Client sends the whole history, including system/assistant messages
- Typical severity: medium to high (the user injects `system` messages or fake assistant/tool responses to bypass rules; high if permission rules are in the prompt).
- Where to look: routes that receive `messages` from the front end and pass them straight through (`streamText({ messages })`, `openai.chat.completions.create({ messages: body.messages })`), without removing `role: 'system'`/`'tool'`.
- How to confirm by reading the code: see whether the server builds the `system` on its own and filters the roles accepted from the client (only `user` and, at most, `assistant` from a conversation stored on the server).
- Ruled out if: the server loads the history from the database by the user's conversation, or filters `messages` to `role === 'user' | 'assistant'` and prefixes its own `system`; and no permission rule depends on the prompt.
- Does not rule out: "the front end always sends the correct history".
- How to fix: `const safe = messages.filter(m => m.role === 'user' || m.role === 'assistant')`; store the history on the server when it matters.
- CWE: CWE-345
