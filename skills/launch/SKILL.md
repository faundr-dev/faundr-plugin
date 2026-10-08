---
description: "Pronto para lançar?" — testa o banco como visitante (lê, grava, altera e apaga com a chave pública e como outra pessoa logada, desfazendo tudo) e confere o que falta antes de abrir o app ao público (cabeçalhos do site, limite de pedidos, webhook de pagamento, política de privacidade, backup). Use quando o usuário perguntar se pode lançar, publicar, divulgar ou abrir para usuários, ou se o banco/app está seguro.
argument-hint: [--url https://site-no-ar]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

1. **Banco como visitante.** Rode com a ferramenta Bash:
   `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" db-test`
   - Se a saída disser que gravar/alterar/apagar não foram testados e você tiver o MCP do Supabase (ferramenta `execute_sql`), ofereça o teste completo. Diga em uma frase que ele roda no banco de verdade, mas cada tentativa é desfeita na hora (nada fica gravado nem apagado), e **peça o OK do usuário**. Com o OK:
     1. pegue o SQL com `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" db-test --sql`;
     2. rode-o **sem mudar nada** com `execute_sql` no projeto do Supabase cujo ref aparece em "Banco testado" (confira com `list_projects`);
     3. salve a resposta inteira, como veio, em `.faundr/db-test-result.json` (ferramenta Write);
     4. rode `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" db-test --result .faundr/db-test-result.json`.
   - Sem MCP: diga que o teste completo precisa do token pessoal do Supabase em SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens) e siga com a leitura.
   - Se o projeto não usa Supabase, pule este passo e diga isso.
2. **Resto do checklist.** Rode `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" launch-check` (com `--url <site>` se o usuário passou um endereço ou se a saída disser que não sabe a URL do site no ar).
3. **Responda em português simples**, nesta ordem:
   - **Impede o lançamento:** cada porta aberta no banco (qual tabela, o que um visitante consegue fazer) e webhook de pagamento sem assinatura. Se não houver nenhum, diga.
   - **Antes de usuários reais:** cabeçalhos, limite de pedidos, política de privacidade e backup. Para o backup: o Faundr não testa sozinho; explique que é restaurar um backup num projeto de teste e abrir o app (no plano grátis do Supabase não há backup automático: `supabase db dump`), e que depois é só marcar no painel.
   - Uma linha dizendo que o checklist completo (com segurança, erros, testes e Stack) está no painel em **Lançamento → Pronto para lançar?**.
4. **Ofereça corrigir**, começando pelo que impede o lançamento: portas do banco com `/faundr:security-fix S-<n>` (os problemas estão em Segurança), cabeçalhos e limite de pedidos no código do servidor, e uma página de política de privacidade (o que o app coleta, para quê, com quem compartilha e como pedir para apagar, conforme a LGPD). Não mude nada sem o OK do usuário. Depois de corrigir, rode o passo 1 ou 2 de novo para conferir.
