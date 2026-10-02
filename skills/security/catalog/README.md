# Catálogo de verificações da revisão de segurança

Um arquivo por tema. Leia só os que se aplicam à stack e ao código do projeto. Cada verificação traz: gravidade típica, onde procurar, como confirmar lendo o código, o que descarta (o controle nomeado), o que não descarta, como corrigir e a CWE.

| Arquivo | Leia quando… |
|---|---|
| `acesso-e-idor.md` | o app tem login e dados por usuário, time ou organização (quase sempre) |
| `autenticacao.md` | há login, sessão, JWT, OAuth, reset de senha ou middleware de proteção |
| `supabase.md` | o projeto usa `@supabase/*` ou tem a pasta `supabase/` |
| `nextjs.md` | o projeto usa `next` (e, em parte, TanStack Start, Remix, SvelteKit) |
| `firebase.md` | o projeto usa `firebase`/`firebase-admin` ou tem arquivos de rules |
| `entrada-e-injecao.md` | o servidor monta SQL, comandos, caminhos ou templates com dados de fora, ou o front renderiza HTML/markdown |
| `api-e-abuso.md` | há rotas de API, formulários públicos, e-mail/SMS, webhooks, upload ou busca de URL |
| `logica-de-negocio.md` | há pagamento, planos, créditos, cupons, estoque ou fluxos em etapas |
| `dados-e-exposicao.md` | sempre, numa passada rápida (respostas, erros, logs, cookies, headers, arquivos públicos) |
| `ia-e-llm.md` | o app chama um LLM, tem chat, agente, ferramentas ou busca vetorial |

Destilado das skills de conhecimento do Strix (usestrix/strix, Apache-2.0) e adaptado para revisão estática de código.
