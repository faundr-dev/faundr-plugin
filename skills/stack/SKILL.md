---
name: stack
description: Escreve ou atualiza a "Stack do projeto" no Faundr — onde cada parte roda (front, back, banco, arquivos, login, domínio, deploy), linguagens, frameworks, serviços externos, variáveis de ambiente (só os nomes) e como rodar. Parte do que a CLI detecta sozinha e completa com o que os arquivos não dizem. Use quando o usuário pedir, quando o Faundr avisar que a Stack mudou, ou depois de trocar hospedagem, banco ou um serviço importante.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## 1. Leia o contexto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" stack-context`

A parte "Detectado agora" vem de uma leitura automática dos arquivos: é o ponto de partida, mas pode ter ruído (uma variável citada num comentário, uma biblioteca que só aparece em teste). Confira nos arquivos indicados antes de manter algo. Se o usuário já te contou algo nesta conversa (onde o domínio está registrado, que o deploy é automático pelo GitHub), isso vale como fonte.

## 2. Regras

- **Nunca escreva valores** de variáveis, chaves, senhas ou tokens. Só o nome da variável (`SUPABASE_URL`), para que serve e de que serviço é. Não leia `.env` para pegar valores.
- Escreva para quem **não programa**: em `detail`, `role` e `purpose`, diga o que a peça faz pelo projeto ("guarda os dados e faz o login dos usuários"), não como funciona por dentro.
- Não invente. Se não dá para saber pelos arquivos nem pela conversa (região do servidor, plano pago ou grátis), deixe de fora ou registre em `notes` como pergunta.
- Se existe revisão anterior, **atualize**: mantenha o que continua verdadeiro, inclusive o que veio de fora dos arquivos.
- Corte o ruído da detecção: tire variáveis que não são configuração do projeto (exemplos em texto, variáveis de outras ferramentas) e tecnologias que não importam para entender o projeto. Ferramentas de desenvolvimento pequenas (lint, formatação) podem ficar, com categoria certa.
- `hosting` cobre cada camada que existir, mesmo que seja o mesmo provedor: `front` (onde as telas ficam), `back` (servidor/API), `banco`, `arquivos`, `auth` (login), `dominio`, `deploy` (como o código chega ao ar: automático pelo GitHub, manual com um comando…), `agendado` (tarefas automáticas). Ponha a `url` pública quando ela aparecer nos arquivos ou na conversa.
- `environments`: produção, homologação, local — com URL e branch quando souber.
- `scripts`: os comandos que a pessoa realmente usa, com `what` em português simples.
- `notes`: até 12 observações úteis — riscos ("o deploy é manual; ninguém publica sem rodar npm run deploy"), variáveis usadas no código que faltam no arquivo de exemplo, dúvidas reais.

## 3. Formato (JSON) — salve em `.faundr/stack.json`

```json
{
  "version": 1,
  "summary": "1 a 3 frases: a stack em português simples",
  "hosting": [{ "layer": "front | back | banco | arquivos | auth | dominio | deploy | agendado | outro", "provider": "Cloudflare Workers", "detail": "o que roda ali, para a pessoa", "url": "https://...", "evidence": ["wrangler.jsonc"] }],
  "runtime": [{ "name": "Node.js", "version": "22", "evidence": [".nvmrc"] }],
  "tech": [{ "name": "React", "category": "framework | ui | estilo | dados | testes | build | qualidade | outro", "version": "19", "role": "para que serve aqui", "evidence": ["package.json"] }],
  "services": [{ "name": "Stripe", "category": "pagamentos | email | ia | monitoramento | analytics | auth | armazenamento | mensagens | mapas | outro", "purpose": "para que o projeto usa", "env": ["STRIPE_SECRET_KEY"], "evidence": ["src/..."] }],
  "env": [{ "name": "SUPABASE_URL", "scope": "publica | servidor", "service": "Supabase", "documented": true, "files": [".env.example"] }],
  "environments": [{ "name": "Produção", "url": "https://...", "branch": "main", "detail": "publica sozinho a cada push" }],
  "scripts": [{ "name": "npm run dev", "command": "vite dev --port 3000", "what": "roda o projeto no seu computador" }],
  "notes": ["..."]
}
```

`scope: "publica"` = vai para o navegador (qualquer pessoa vê; prefixos como `VITE_`, `NEXT_PUBLIC_`); `"servidor"` = só no servidor. `documented` = aparece num arquivo de exemplo (`.env.example`) ou na configuração versionada. Não escreva `languages`: a CLI conta e preenche.

## 4. Envie

Salve com a ferramenta Write em `.faundr/stack.json` (na raiz do projeto ligado) e rode:

`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" stack-save`

Se a resposta apontar campos faltando, corrija e rode de novo. No fim, diga em uma frase que a Stack foi atualizada e o que mudou.
