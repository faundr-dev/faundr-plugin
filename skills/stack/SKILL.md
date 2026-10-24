---
name: stack
description: Writes or updates the "Project stack" in Faundr — where each part runs (front end, back end, database, files, login, domain, deploy), languages, frameworks, external services, environment variables (names only) and how to run it. Starts from what the CLI detects on its own and fills in what the files do not say. Use when the user asks, when Faundr warns that the Stack changed, or after changing hosting, database or an important service.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## 1. Read the context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" stack-context`

The "Detectado agora" part comes from an automatic reading of the files: it is the starting point, but it may have noise (a variable mentioned in a comment, a library that only appears in tests). Check the indicated files before keeping something. If the user already told you something in this conversation (where the domain is registered, that deploy is automatic from GitHub), that counts as a source.

## 2. Rules

- **Never write values** of variables, keys, passwords or tokens. Only the variable name (`SUPABASE_URL`), what it is for and which service it belongs to. Do not read `.env` to get values.
- Write for **people who don't code**, in the project's content language (Faundr shows it in the context): in `detail`, `role` and `purpose`, say what the piece does for the project ("stores the data and logs users in"), not how it works inside.
- Do not make things up. If it cannot be known from the files or from the conversation (server region, paid or free plan), leave it out or record it in `notes` as a question.
- If there is a previous revision, **update** it: keep what is still true, including what came from outside the files.
- Cut the detection noise: remove variables that are not project configuration (examples in text, variables from other tools) and technologies that do not matter for understanding the project. Small development tools (lint, formatting) can stay, with the right category.
- `hosting` covers each layer that exists, even if it is the same provider: `front` (where the screens live), `back` (server/API), `banco` (database), `arquivos` (files), `auth` (login), `dominio` (domain), `deploy` (how the code goes live: automatic from GitHub, manual with a command…), `agendado` (scheduled jobs). Add the public `url` when it appears in the files or in the conversation.
- `environments`: production, staging, local — with URL and branch when known.
- `scripts`: the commands the person actually uses, with `what` in plain language.
- `notes`: up to 12 useful observations — risks ("deploy is manual; nobody publishes without running npm run deploy"), variables used in the code that are missing from the example file, real doubts.

## 3. Format (JSON) — save to `.faundr/painel/stack.json`

```json
{
  "version": 1,
  "summary": "1 to 3 sentences: the stack in plain language",
  "hosting": [{ "layer": "front | back | banco | arquivos | auth | dominio | deploy | agendado | outro", "provider": "Cloudflare Workers", "detail": "what runs there, for the person", "url": "https://...", "evidence": ["wrangler.jsonc"] }],
  "runtime": [{ "name": "Node.js", "version": "22", "evidence": [".nvmrc"] }],
  "tech": [{ "name": "React", "category": "framework | ui | estilo | dados | testes | build | qualidade | outro", "version": "19", "role": "what it is for here", "evidence": ["package.json"] }],
  "services": [{ "name": "Stripe", "category": "pagamentos | email | ia | monitoramento | analytics | auth | armazenamento | mensagens | mapas | outro", "purpose": "what the project uses it for", "env": ["STRIPE_SECRET_KEY"], "evidence": ["src/..."] }],
  "env": [{ "name": "SUPABASE_URL", "scope": "publica | servidor", "service": "Supabase", "documented": true, "files": [".env.example"] }],
  "environments": [{ "name": "Production", "url": "https://...", "branch": "main", "detail": "publishes on its own on every push" }],
  "scripts": [{ "name": "npm run dev", "command": "vite dev --port 3000", "what": "runs the project on your computer" }],
  "notes": ["..."]
}
```

`scope: "publica"` = goes to the browser (anyone can see it; prefixes like `VITE_`, `NEXT_PUBLIC_`); `"servidor"` = server only. `documented` = appears in an example file (`.env.example`) or in versioned configuration. Do not write `languages`: the CLI counts and fills it in.

## 4. Send

Save with the Write tool to `.faundr/painel/stack.json` (at the root of the linked project) and run:

`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" stack-save`

If the response points out missing fields, fix them and run it again. At the end, say in one sentence that the Stack was updated and what changed.
