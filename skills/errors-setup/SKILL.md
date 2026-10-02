---
description: Liga o app publicado ao Faundr para os erros que acontecem com os usuários aparecerem na seção Erros (E-n). Instala o SDK oficial do Sentry (gratuito, MIT) apontando para o Faundr, sem conta no Sentry, sem enviar desempenho nem gravação de tela, e confere com um erro de teste. Use quando o usuário pedir para acompanhar os erros do app publicado ou quando a seção Erros sugerir.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(npm install *) Bash(pnpm add *) Bash(yarn add *) Bash(bun add *) Read Grep Glob Edit Write
---

## Endereço de recebimento deste projeto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" errors-dsn`

Se aparecer erro, avise o usuário e pare. O endereço acima (DSN) é público por natureza (vai no JavaScript do site): pode ficar no código ou numa variável pública.

## Regras

- **Não use o assistente do Sentry** (`npx @sentry/wizard`) nem crie conta no Sentry: ele cria projeto lá e pede token. Aqui o SDK só manda os erros para o Faundr.
- **Só erros.** Nada de desempenho, gravação de tela ou perfis: `tracesSampleRate: 0` (ou sem a opção), sem `replayIntegration`, sem `browserTracingIntegration`, sem `profilesSampleRate`.
- **Privacidade:** `sendDefaultPii: false`. Não mande e-mail, nome ou IP do usuário. Se o app tiver login, pode mandar só o id: `Sentry.setUser({ id })`. O Faundr ainda limpa senhas, tokens, cartões, e-mails e IPs antes de gravar.
- **Só em produção:** `enabled` ligado apenas no build de produção, para os erros do desenvolvimento não se misturarem (esses o Faundr já pega pelos comandos).
- **Versão = commit:** `release` com o hash do commit do build, para o Faundr ligar o erro à sessão que fez a mudança. Use o que a plataforma já oferece (Vercel: `VERCEL_GIT_COMMIT_SHA`; Cloudflare: `CF_PAGES_COMMIT_SHA` ou `WORKERS_CI_COMMIT_SHA`; Netlify: `COMMIT_REF`) ou injete no build (`git rev-parse --short HEAD`).
- **Sem upload de source maps** e sem `authToken`/`SENTRY_AUTH_TOKEN`: o Faundr resolve a pilha no computador do usuário na hora de corrigir.
- Mudança mínima: não reorganize arquivos do projeto.

## 1. Descubra o que o app usa

Leia o `package.json` (e os arquivos de configuração) e escolha **um** pacote:

| O app é | Pacote | Onde iniciar |
|---|---|---|
| Next.js | `@sentry/nextjs` | `instrumentation-client.ts` (navegador) e `instrumentation.ts` com `register()` (servidor/edge) |
| React com Vite, SPA comum | `@sentry/react` | no começo do `main.tsx`/`main.jsx`, antes de renderizar |
| TanStack Start, Remix, React Router | `@sentry/react` no navegador (entrada do cliente) + `@sentry/cloudflare` ou `@sentry/node` no servidor, conforme onde roda |
| SvelteKit | `@sentry/sveltekit` | `hooks.client.ts` e `hooks.server.ts` |
| Vue / Nuxt | `@sentry/vue` / `@sentry/nuxt` | entrada do app / `sentry.client.config.ts` |
| Worker da Cloudflare | `@sentry/cloudflare` | `withSentry(() => ({ dsn, ... }), handler)` no `export default` |
| Node (Express, Fastify, scripts) | `@sentry/node` | um `instrument.mjs` importado antes de tudo |
| Expo / React Native | `@sentry/react-native` | `App.tsx` |

Se o app tem navegador e servidor, ligue os dois (é o mesmo DSN).

## 2. Instale e configure

Instale com o gerenciador que o projeto já usa (veja o lockfile). Configuração mínima, adaptando ao pacote:

```ts
import * as Sentry from '@sentry/react' // o pacote escolhido
Sentry.init({
  dsn: '<DSN acima>',
  enabled: import.meta.env.PROD, // Next.js: process.env.NODE_ENV === 'production'
  environment: 'production',
  release: import.meta.env.VITE_COMMIT_SHA, // o hash do commit do build
  sendDefaultPii: false,
  tracesSampleRate: 0,
})
```

No React, se o app tiver um error boundary, envolva com `Sentry.ErrorBoundary` ou chame `Sentry.captureException(error)` dentro dele; senão, erros de renderização não chegam.

## 3. Confira com um erro de teste

1. Publique (ou rode o build de produção localmente com `enabled: true` só para o teste) e dispare um erro de propósito: um botão temporário que faz `throw new Error('Teste do Faundr')`, ou `Sentry.captureException(new Error('Teste do Faundr'))`. **Não teste pelo console do navegador**: erros digitados lá não são capturados.
2. Rode `faundr errors` e veja se apareceu um E-n "[app publicado]". Pode levar alguns segundos.
3. Tire o botão de teste e arquive o E-n do teste: `faundr error-archive E-<n>`.

## 4. Extras (pergunte ao usuário antes)

- **Site no ar:** `faundr errors-uptime https://<endereço do site>` — o Faundr abre o site a cada 5 minutos; se cair, vira E-n e avisa.
- **Avisos no Slack ou Discord:** o usuário cola o webhook na seção Erros → App publicado do painel (você não precisa do endereço).
- **CSP:** se o site já tem Content-Security-Policy, acrescente o `report-uri` que aparece na mesma aba do painel.
- **Já usa o Sentry?** `faundr errors-import-sentry --org <org> --project <projeto>` com `SENTRY_AUTH_TOKEN` definido pelo usuário no terminal (não peça o token no chat).

Responda em poucas linhas: o que foi instalado e onde, como confirmou que chegou, e o que o usuário precisa fazer (publicar de novo, se ainda não publicou).
