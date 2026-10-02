# Acesso a dados de outros usuários (IDOR, BFLA, multi-tenant, mass assignment)
Quando ler: sempre que o app tem login e guarda dados por usuário, time, organização ou workspace. Sinais: rotas com `[id]`, `:id`, `params.id`, `searchParams.get('id')`; tabelas com `user_id`, `owner_id`, `org_id`, `team_id`, `tenant_id`; painel admin; papéis (`role`, `isAdmin`, `plan`). Se o acesso a dados passa só por RLS do Supabase ou rules do Firebase, leia também `supabase.md` ou `firebase.md` (lá está a checagem no banco; aqui está a checagem no código do servidor).

Regra de ouro: todo ID que chega do cliente (path, query, body, header, cookie não assinado) é não confiável até o código provar que o objeto pertence a quem chamou. O dono vem da sessão verificada no servidor, nunca do payload.

## idor-leitura-por-id — Buscar objeto pelo ID sem conferir o dono
- Gravidade típica: alta. Sobe para crítica se o objeto tem PII, dados financeiros, documentos ou segredos, ou se os IDs são sequenciais/listáveis. Desce para média se o dado é pouco sensível e o ID é UUID que não vaza em lugar nenhum (UUID não é controle, só reduz a chance).
- Onde procurar: `app/api/**/[id]/route.ts`, `pages/api/**/[id].ts`, rotas Express/Hono com `:id`, Server Actions que recebem `id`, loaders do TanStack Start/Remix. Grep: `findUnique\(\{ where: \{ id`, `findById(`, `.eq('id',`, `where(eq(.*\.id,`, `WHERE id = `, `params.id`, `req.params.id`, `c.req.param('id')`.
- Como confirmar lendo o código:
  1. Ache o handler e o ponto onde o objeto é carregado.
  2. Procure, ANTES de devolver ou alterar, uma de duas coisas: (a) o filtro de dono na própria consulta (`where: { id, userId: session.user.id }`), ou (b) uma comparação explícita depois de carregar (`if (doc.ownerId !== session.user.id) return 403`).
  3. Confirme que `session.user.id` vem da sessão verificada no servidor (ver `autenticacao.md`), não de `body.userId`.
  4. Se usa Supabase com a chave anon + JWT do usuário, a proteção pode estar na RLS: vá para `supabase.md` e confirme a política da tabela.
- Descarta se: a consulta filtra por dono/tenant derivado da sessão (`where: { id, ownerId: user.id }`, `.eq('user_id', user.id)` com `user` vindo de `supabase.auth.getUser()`), ou existe a comparação explícita antes da resposta, ou a leitura usa o cliente Supabase do usuário e a tabela tem RLS de SELECT com `auth.uid()`; ou o recurso é público por desenho (post publicado, perfil público) e só campos públicos saem.
- Não descarta: checagem só na página (o front esconde o botão); checagem numa rota irmã (a de listagem filtra, a de detalhe não); middleware que só confere "está logado"; UUID "impossível de adivinhar" (vaza em URLs, e-mails, listagens, logs); cliente Supabase com `service_role` no servidor (ignora RLS, então o filtro precisa estar no código); checagem feita depois de já ter devolvido o objeto.
- Como corrigir: colocar o dono na consulta, derivado da sessão.
  ```ts
  const user = await requireUser();            // lança 401 se não logado
  const doc = await db.document.findFirst({ where: { id: params.id, ownerId: user.id } });
  if (!doc) return new Response('Not found', { status: 404 });
  ```
- CWE: CWE-639

## idor-escrita-e-exclusao — Alterar ou apagar objeto de outro usuário
- Gravidade típica: alta a crítica (integridade e perda de dados). Crítica quando permite apagar em massa ou alterar pagamento, e-mail de login ou permissões.
- Onde procurar: handlers `PUT`/`PATCH`/`DELETE`, Server Actions `update*`/`delete*`/`remove*`, rotas `/api/*/[id]` com método de escrita. Grep: `update({ where: { id`, `delete({ where: { id`, `.update(`...`).eq('id'`, `.delete().eq('id'`, `findByIdAndUpdate(`, `findByIdAndDelete(`, `UPDATE .* WHERE id`.
- Como confirmar lendo o código: igual à leitura, mas é comum o time proteger GET e esquecer escrita. Leia cada verbo separadamente. Veja se o `where` do update/delete inclui o dono ou se há leitura prévia com checagem de dono na mesma função.
- Descarta se: `where: { id, ownerId: user.id }` no próprio update/delete (e o código trata "0 linhas afetadas" como 404), ou `updateMany`/`deleteMany` com filtro de dono, ou RLS de UPDATE/DELETE com `auth.uid()` no Supabase com o cliente do usuário.
- Não descarta: ler com dono e depois atualizar só por `id` em outra chamada que pode receber outro ID; checagem só no GET da mesma rota; o botão de excluir só aparece para o dono.
- Como corrigir: filtro de dono no próprio comando de escrita; para Prisma, `update` exige campo único, então use `updateMany({ where: { id, ownerId } })` e confira `count`, ou busque com dono e atualize na mesma transação.
- CWE: CWE-639

## idor-listagem-e-export — Listagem, busca ou export sem filtro de dono
- Gravidade típica: crítica quando devolve dados de todos os usuários de uma vez (vazamento em massa); alta nos demais casos.
- Onde procurar: rotas `list`, `search`, `export`, `report`, `csv`, `download`, endpoints de admin reaproveitados pelo app, `findMany()` sem `where`, `select('*')` sem `.eq`, filtros vindos do cliente (`?userId=`, `?orgId=`, `?filter=`), paginação por cursor.
- Como confirmar lendo o código: verifique se o `where` de toda listagem inclui o dono/tenant da sessão e se o cliente consegue sobrescrever esse filtro (ex.: `where: { ...req.query }` ou `{ userId: req.query.userId ?? user.id }`).
- Descarta se: o filtro de dono/tenant é aplicado pelo servidor e o valor do cliente é ignorado ou validado contra a sessão; ou a leitura passa pelo cliente Supabase do usuário com RLS correta.
- Não descarta: filtro que usa o valor do cliente quando presente (`req.query.userId ?? user.id`); busca textual que filtra dono só na primeira página; `include`/`expand`/`select` vindos do cliente que puxam relações de outros donos.
- Como corrigir: montar o `where` no servidor e nunca espalhar a query do cliente dentro dele; aceitar do cliente só filtros de uma allowlist.
- CWE: CWE-639

## bfla-acao-admin — Ação de administrador acessível a usuário comum
- Gravidade típica: crítica quando permite virar admin, ver todos os usuários, mudar planos, reembolsar ou impersonar. Alta nas demais ações privilegiadas.
- Onde procurar: pastas `admin/`, `dashboard/admin`, `api/admin/*`, Server Actions em arquivos de admin, funções com nomes `approve`, `ban`, `impersonate`, `setRole`, `grant`, `refund`, `invite`, `deleteUser`, `sendBroadcast`. Grep: `isAdmin`, `role ===`, `role:`, `hasRole`, `can(`, `permissions`.
- Como confirmar lendo o código:
  1. Liste as ações privilegiadas.
  2. Para cada uma, ache a checagem de papel DENTRO do handler/action (ou num helper chamado por ele), feita no servidor, com o papel lido do banco ou de claim assinada.
  3. Confirme que o papel não vem do cliente (`body.role`, cookie `role=admin` não assinado, `localStorage`) nem de `user_metadata` do Supabase (o usuário edita isso com `supabase.auth.updateUser`).
- Descarta se: há `requireAdmin()`/`assertRole('admin')` no início de cada ação, lendo papel do banco ou de `app_metadata`/custom claim assinada; ou o endpoint roda atrás de RLS/regra que exige o papel.
- Não descarta: só o layout/página `admin` checa o papel (a Server Action ou a rota de API chamada por ela é outro endpoint); o menu admin só aparece para admin; a checagem está no middleware com matcher que não cobre `/api/admin`; papel lido de `user.user_metadata.role`; feature flag só no front.
- Como corrigir: helper único chamado no topo de toda ação privilegiada.
  ```ts
  export async function requireAdmin() {
    const user = await requireUser();
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (data?.role !== 'admin') throw new Error('forbidden');
    return user;
  }
  ```
- CWE: CWE-285

## bfla-verbo-e-rota-alternativa — Rota irmã ou verbo alternativo sem a mesma checagem
- Gravidade típica: alta (herda a gravidade da ação exposta).
- Onde procurar: a mesma operação exposta por dois caminhos (rota de API + Server Action; `pages/api` + `app/api`; REST + GraphQL/tRPC; rota v1 esquecida), handlers que aceitam GET e fazem escrita, jobs/filas/webhooks que executam ações do usuário.
- Como confirmar lendo o código: ao achar a checagem num caminho, procure (grep pelo nome da função de serviço ou da tabela) todos os outros chamadores e verifique cada um. Uma instância segura não prova nada sobre a irmã.
- Descarta se: a checagem está na camada de serviço compartilhada (a função que efetivamente escreve), então todos os caminhos passam por ela.
- Não descarta: "a outra rota já checa"; rota antiga que o front não usa mais mas continua exportada.
- Como corrigir: mover a autorização para a função de serviço usada por todos os caminhos; apagar rotas antigas.
- CWE: CWE-285

## tenant-isolamento — Dados de uma organização visíveis a outra
- Gravidade típica: crítica em SaaS B2B (vazamento entre clientes).
- Onde procurar: modelos com `org_id`/`team_id`/`workspace_id`/`tenant_id`; seletor de organização no front; header `x-org-id`, subdomínio, `params.orgId`, `?workspace=`.
- Como confirmar lendo o código:
  1. Descubra de onde vem o tenant atual: se vem do cliente (header, path, cookie), confirme que o servidor checa que o usuário é membro (`memberships where user_id = user.id and org_id = X`) antes de usar.
  2. Confirme que toda consulta de dados do tenant filtra por esse tenant validado.
  3. No Supabase, a política precisa checar a associação (`exists (select 1 from members m where m.org_id = t.org_id and m.user_id = (select auth.uid()))`).
- Descarta se: há checagem de associação no servidor ou na RLS, e todas as consultas usam o tenant validado.
- Não descarta: checa associação ao trocar de org, mas as rotas de dados confiam no header depois; filtro por tenant em listagens mas não em detalhe/escrita; convites que aceitam `orgId` do corpo sem checar quem convidou.
- Como corrigir: resolver o tenant uma vez por request com checagem de associação e passar o `orgId` validado para as consultas; no Supabase, políticas com `exists` na tabela de membros.
- CWE: CWE-639

## mass-assignment-campos-privilegiados — Cliente consegue gravar role, isAdmin, owner_id, plan, credits
- Gravidade típica: crítica quando grava `role`/`isAdmin`/`plan`/`credits`/`balance`/`verified`/`owner_id`/`org_id`. Média se só grava campos cosméticos que não deveria.
- Onde procurar: create/update que espalha o corpo inteiro. Grep: `data: body`, `data: req.body`, `data: { ...body`, `.update(body)`, `.insert(body)`, `.upsert(`, `Object.assign(user, req.body)`, `new Model(req.body)`, `findByIdAndUpdate(id, req.body)`, `formData` convertido com `Object.fromEntries(formData)`, schemas Zod com `.passthrough()` ou sem `.strict()` + spread. Formulários de perfil, cadastro e configurações.
- Como confirmar lendo o código:
  1. Ache o schema de entrada (Zod/Valibot/Yup) ou a falta dele.
  2. Veja se o objeto gravado é montado campo a campo a partir de uma allowlist, ou se o corpo é espalhado.
  3. Compare com as colunas do modelo/tabela: existe alguma coluna sensível que passaria?
  4. No Supabase com escrita direta do cliente (`supabase.from('profiles').update(...)` no navegador), a RLS de UPDATE deixa o usuário mudar qualquer coluna da própria linha, inclusive `role`, a menos que haja restrição por coluna ou trigger.
- Descarta se: o schema é uma allowlist sem os campos sensíveis e o Zod descarta chaves extras (comportamento padrão de `z.object().parse` é remover chaves desconhecidas; confira que não há `.passthrough()`), e o valor gravado é o resultado do parse, não o corpo original; ou colunas sensíveis têm `revoke update (role, plan) on profiles from authenticated` / trigger que bloqueia; ou o servidor recalcula o campo e ignora o que veio.
- Não descarta: validação que confere tipos mas grava `body` em vez de `parsed`; schema de criação seguro mas o de edição espalha; campos aninhados (`{ profile: { role } }`) em ORM com escrita aninhada; o formulário do front não mostra o campo (o atacante manda mesmo assim).
- Como corrigir:
  ```ts
  const Input = z.object({ name: z.string().max(80), bio: z.string().max(500) });
  const { name, bio } = Input.parse(await req.json());
  await db.user.update({ where: { id: user.id }, data: { name, bio } });
  ```
  No Supabase: `revoke update on public.profiles from authenticated; grant update (name, bio) on public.profiles to authenticated;`
- CWE: CWE-915

## owner-vindo-do-cliente — Dono do registro definido pelo payload
- Gravidade típica: alta. Permite criar registros em nome de outro usuário ou dentro da organização de outro.
- Onde procurar: inserts com `user_id: body.userId`, `ownerId: input.ownerId`, `orgId: body.orgId`, `author_id` vindo do formulário; campos hidden em formulários.
- Como confirmar lendo o código: veja de onde vem o valor do dono no insert. Deve ser a sessão (`user.id`) ou um tenant validado.
- Descarta se: o servidor sobrescreve com `user.id` depois do parse; ou no Supabase a política de INSERT tem `with check (user_id = (select auth.uid()))`; ou a coluna tem `default auth.uid()` e não é gravável pelo cliente.
- Não descarta: "o front sempre manda o id certo".
- Como corrigir: `data: { ...parsed, ownerId: user.id }` com `ownerId` fora do schema de entrada.
- CWE: CWE-639

## acesso-em-lote — Operação em lote checa só o primeiro item
- Gravidade típica: alta.
- Onde procurar: endpoints com `ids: string[]`, `bulkDelete`, `moveMany`, `markAsRead`, `in('id', ids)`, `where: { id: { in: ids } }`.
- Como confirmar lendo o código: veja se a checagem de dono cobre cada ID (filtro de dono na mesma consulta) ou só o `ids[0]`/um objeto pai.
- Descarta se: a operação é `where: { id: { in: ids }, ownerId: user.id }` ou RLS equivalente.
- Não descarta: laço que checa o pai e depois opera em filhos informados pelo cliente sem conferir que pertencem ao pai.
- Como corrigir: filtro de dono na consulta em lote.
- CWE: CWE-639

## arquivo-e-url-assinada — Download de arquivo por chave/URL sem checagem
- Gravidade típica: alta (documentos pessoais, notas fiscais, exames).
- Onde procurar: rotas `download`, `file`, `attachment`, geração de URL assinada (`createSignedUrl`, `getSignedUrl` do S3, `getDownloadURL` do Firebase) a partir de um `path` ou `key` vindo do cliente.
- Como confirmar lendo o código: antes de assinar/servir, o código confere que o arquivo pertence ao usuário (registro no banco com dono, ou prefixo do caminho igual ao `user.id` validado)?
- Descarta se: o caminho é montado pelo servidor a partir do registro do usuário, ou há checagem de dono do registro associado, ou a política do bucket restringe por `auth.uid()` (ver `supabase.md`).
- Não descarta: URL assinada com validade longa enviada em lugares públicos; caminho `${userId}/${file}` com `userId` vindo do cliente.
- Como corrigir: buscar o registro do arquivo com filtro de dono e só então gerar URL assinada curta (minutos).
- CWE: CWE-639
