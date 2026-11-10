// Regras novas tiradas das falhas reais da varredura de 10/11/2026 (docs/research/reports/varredura-codigo-2026-11-10.md):
// cada uma casa com o trecho de antes da correção (commit ebe1cf4) e não casa com o corrigido.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { scanProject } from '../bin/security.mjs'

// Projeto de exemplo no git; devolve "regra@arquivo" das regras pedidas.
async function scan(files, rules) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-rf-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['add', '-A'], { cwd: dir })
  const { findings } = await scanProject(dir, { deps: false })
  fs.rmSync(dir, { recursive: true, force: true })
  return findings.filter((f) => rules.includes(f.rule_id)).map((f) => `${f.rule_id}@${f.file}`).sort()
}

// ---- banco --------------------------------------------------------------------------------------

const ORGS = `
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null);
alter table public.organizations enable row level security;
create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null
);
alter table public.organization_members enable row level security;
`

// 0025_organizations.sql em ebe1cf4: org_role() devolve NULL para quem não é membro.
const MEMBER_FUNCTIONS_OLD = `
create function public.set_member_role(org uuid, member uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me text := public.org_role(org);
  current text;
begin
  select role into current from public.organization_members where org_id = org and user_id = member;
  if current is null then raise exception 'Membro não encontrado'; end if;
  if me not in ('owner', 'admin') then raise exception 'Só dono ou admin muda papéis'; end if;
  if (current = 'owner' or new_role = 'owner') and me <> 'owner' then raise exception 'Só o dono mexe no papel de dono'; end if;
  update public.organization_members set role = new_role where org_id = org and user_id = member;
end $$;

create function public.remove_member(org uuid, member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me text := public.org_role(org);
  current text;
begin
  select role into current from public.organization_members where org_id = org and user_id = member;
  if current is null then raise exception 'Membro não encontrado'; end if;
  if member <> (select auth.uid()) then
    if me not in ('owner', 'admin') then raise exception 'Só dono ou admin remove membros'; end if;
    if current = 'owner' and me <> 'owner' then raise exception 'Só o dono remove outro dono'; end if;
  end if;
  delete from public.organization_members where org_id = org and user_id = member;
end $$;

revoke execute on function public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid) from public, anon;
`

// 0122 (HEAD): confere o NULL antes.
const MEMBER_FUNCTIONS_FIXED = `
create or replace function public.set_member_role(org uuid, member uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me text;
  current text;
begin
  if (select auth.uid()) is null then raise exception 'Faça login'; end if;
  me := public.org_role(org);
  if me is null or me not in ('owner', 'admin') then raise exception 'Só dono ou admin muda papéis'; end if;
  select role into current from public.organization_members where org_id = org and user_id = member;
  if current is null then raise exception 'Membro não encontrado'; end if;
  if (current = 'owner' or new_role = 'owner') and me is distinct from 'owner' then
    raise exception 'Só o dono mexe no papel de dono';
  end if;
  update public.organization_members set role = new_role where org_id = org and user_id = member;
end $$;

create or replace function public.remove_member(org uuid, member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  me text;
  current text;
begin
  if uid is null then raise exception 'Faça login'; end if;
  me := public.org_role(org);
  if member is distinct from uid then
    if me is null or me not in ('owner', 'admin') then raise exception 'Só dono ou admin remove membros'; end if;
  end if;
  select role into current from public.organization_members where org_id = org and user_id = member;
  if current is null then raise exception 'Membro não encontrado'; end if;
  if member is distinct from uid and current = 'owner' and me is distinct from 'owner' then
    raise exception 'Só o dono remove outro dono';
  end if;
  delete from public.organization_members where org_id = org and user_id = member;
end $$;
`

test('banco: função security definer que confere papel com "not in"/"<>" sem tratar o NULL (0025 de ebe1cf4)', async () => {
  const rules = ['definer-null-role-check']
  assert.deepEqual(await scan({ 'supabase/migrations/0001.sql': ORGS + MEMBER_FUNCTIONS_OLD }, rules), [
    'definer-null-role-check@supabase/migrations/0001.sql',
    'definer-null-role-check@supabase/migrations/0001.sql',
  ])
  // A migração nova (0122) redefine as duas: vale a última definição.
  assert.deepEqual(
    await scan({ 'supabase/migrations/0001.sql': ORGS + MEMBER_FUNCTIONS_OLD, 'supabase/migrations/0002.sql': MEMBER_FUNCTIONS_FIXED }, rules),
    [],
  )
})

test('banco: NULL que não importa não vira achado; auth.uid() só conta quando a função ficou aberta para anon', async () => {
  const rules = ['definer-null-role-check']
  const sql = `
create function public.bump(pid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  r text;
  owner uuid;
begin
  select count(*) into n from public.organizations;
  if n <> 1 then raise exception 'x'; end if;
  select role into r from public.organization_members where user_id = auth.uid();
  if not found then raise exception 'sem papel'; end if;
  if r <> 'owner' then raise exception 'só dono'; end if;
  select created_by into strict owner from public.organizations where id = pid;
  if owner <> auth.uid() then raise exception 'não é seu'; end if;
end $$;
revoke execute on function public.bump(uuid) from public, anon;
`
  assert.deepEqual(await scan({ 'supabase/migrations/0001.sql': ORGS + sql }, rules), [])
  // Aberta para anon (o Supabase dá execute para anon por padrão): sem login, auth.uid() é NULL e a trava não vale.
  const open = sql.replace('revoke execute on function public.bump(uuid) from public, anon;', '')
  assert.deepEqual(await scan({ 'supabase/migrations/0001.sql': ORGS + open }, rules), ['definer-null-role-check@supabase/migrations/0001.sql'])
})

// 0001_mvp.sql + 0025: projects.owner_id … on delete cascade numa tabela que passou a ser da organização.
const PROJECTS_OLD = `
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade
);
alter table public.projects enable row level security;
alter table public.sessions enable row level security;
alter table public.projects add column org_id uuid references public.organizations (id) on delete cascade;
create policy "members create projects" on public.projects
  for insert to authenticated with check ((select public.org_role(org_id)) in ('owner', 'admin', 'member'));
`

// 0123 (HEAD): owner_id vira "set null" e o INSERT do navegador só grava nome, organização e língua.
const PROJECTS_FIXED = `
alter table public.projects add column content_lang text;
revoke insert on public.projects from authenticated;
grant insert (name, org_id, content_lang) on public.projects to authenticated;
alter table public.projects alter column owner_id drop not null;
alter table public.projects drop constraint projects_owner_id_fkey;
alter table public.projects add constraint projects_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;
`

test('banco: projeto do time apagado junto com a conta de quem criou, e linha criada em nome de outro (0001/0025 de ebe1cf4)', async () => {
  const rules = ['team-row-cascades-with-owner', 'insert-author-not-checked']
  assert.deepEqual(await scan({ 'supabase/migrations/0001.sql': ORGS + PROJECTS_OLD }, rules), [
    'insert-author-not-checked@supabase/migrations/0001.sql',
    'team-row-cascades-with-owner@supabase/migrations/0001.sql',
  ])
  assert.deepEqual(await scan({ 'supabase/migrations/0001.sql': ORGS + PROJECTS_OLD, 'supabase/migrations/0002.sql': PROJECTS_FIXED }, rules), [])
  // Tabela de membros (user_id em cascata) é o esperado: não é tabela-mãe do time.
  assert.deepEqual(await scan({ 'supabase/migrations/0001.sql': ORGS }, rules), [])
  // with check que amarra o autor a quem pede está certo.
  const own = PROJECTS_OLD.replace("in ('owner', 'admin', 'member'));", "in ('owner', 'admin', 'member') and owner_id = (select auth.uid()));")
  assert.deepEqual(await scan({ 'supabase/migrations/0001.sql': ORGS + own }, ['insert-author-not-checked']), [])
})

// ---- código -------------------------------------------------------------------------------------

// src/server/inbox.ts em ebe1cf4: assina qualquer caminho guardado no banco e devolve o erro do Storage.
const INBOX_OLD = `import type { SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './hook-events'

export async function ackInbox(db: SupabaseClient, projectId: string, sessionId: string, reqIds: string[], noteIds: string[]) {
  const now = new Date().toISOString()
  const [{ error: reqError }, { error: noteError }] = await Promise.all([
    db.from('project_requests').update({ status: 'delivered', delivered_at: now }).eq('project_id', projectId).in('id', reqIds),
    db.from('project_notes').update({ delivered_at: now }).eq('project_id', projectId).in('id', noteIds),
  ])
  if (reqError || noteError) throw new HttpError(500, (reqError ?? noteError)!.message)
}

export async function requestShot(db: SupabaseClient, projectId: string, ref: string) {
  const r = await findRequest(db, projectId, ref)
  if (!r.image_path) throw new HttpError(404, 'This request has no screenshot')
  const { data, error } = await db.storage.from(SHOTS).createSignedUrl(r.image_path as string, 300)
  if (error || !data) throw new HttpError(500, error?.message ?? 'Could not create the screenshot link')
  return { id: r.id as string, url: data.signedUrl }
}
`

// HEAD: confere a pasta do projeto e manda o erro só para o log.
const INBOX_FIXED = `import type { SupabaseClient } from '@supabase/supabase-js'
import { dbError, HttpError } from './hook-events'

export async function ackInbox(db: SupabaseClient, projectId: string, sessionId: string, reqIds: string[], noteIds: string[]) {
  const now = new Date().toISOString()
  const [{ error: reqError }, { error: noteError }] = await Promise.all([
    db.from('project_requests').update({ status: 'delivered', delivered_at: now }).eq('project_id', projectId).in('id', reqIds),
    db.from('project_notes').update({ delivered_at: now }).eq('project_id', projectId).in('id', noteIds),
  ])
  if (reqError || noteError) throw dbError((reqError ?? noteError)!)
}

export async function requestShot(db: SupabaseClient, projectId: string, ref: string) {
  const r = await findRequest(db, projectId, ref)
  if (!r.image_path) throw new HttpError(404, 'This request has no screenshot')
  const path = String(r.image_path)
  if (!path.startsWith(\`\${projectId}/\`) || path.includes('..')) throw new HttpError(404, 'This request has no screenshot')
  const { data, error } = await db.storage.from(SHOTS).createSignedUrl(r.image_path as string, 300)
  if (error || !data) {
    if (error) console.error('request-shots signed url:', error.message)
    throw new HttpError(500, 'Could not create the screenshot link')
  }
  return { id: r.id as string, url: data.signedUrl }
}
`

// src/server/org-invite.ts em ebe1cf4 (a mensagem do Postgres ia para o navegador) e a correção.
const INVITE_OLD = `export async function invite(db, body, userId) {
    const { data: invite, error } = await db
      .from('organization_invites')
      .insert({ org_id: body.orgId, email: body.email, invited_by: userId })
      .select('id, email')
      .single()
    if (error)
      throw new HttpError(
        error.code === '23505' ? 409 : 500,
        error.code === '23505' ? t('This email already has a pending invite', 'Esse e-mail já tem um convite pendente') : error.message,
      )
    return invite
}
`
const INVITE_FIXED = `export async function invite(db, body, userId) {
    const { data: invite, error } = await db
      .from('organization_invites')
      .insert({ org_id: body.orgId, email: body.email, invited_by: userId })
      .select('id, email')
      .single()
    if (error?.code === '23505') throw new HttpError(409, t('This email already has a pending invite', 'Esse e-mail já tem um convite pendente'))
    if (error) {
      console.error('organization_invites:', error.message)
      throw new HttpError(500, t('Could not create the invite. Try again.', 'Não deu para criar o convite. Tente de novo.'))
    }
    return invite
}
`

test('código: link assinado do Storage sem conferir a pasta e erro do banco devolvido ao navegador (inbox.ts e org-invite.ts de ebe1cf4)', async () => {
  const rules = ['storage-path-from-data', 'db-error-message-to-client']
  assert.deepEqual(await scan({ 'src/server/inbox.ts': INBOX_OLD, 'src/server/org-invite.ts': INVITE_OLD }, rules), [
    'db-error-message-to-client@src/server/inbox.ts',
    'db-error-message-to-client@src/server/inbox.ts',
    'db-error-message-to-client@src/server/org-invite.ts',
    'storage-path-from-data@src/server/inbox.ts',
  ])
  assert.deepEqual(await scan({ 'src/server/inbox.ts': INBOX_FIXED, 'src/server/org-invite.ts': INVITE_FIXED }, rules), [])
})

test('código: erro de login (auth) e erro tratado não contam; caminho com prefixo fixo não conta', async () => {
  const rules = ['storage-path-from-data', 'db-error-message-to-client']
  const route = `export async function POST(req) {
  const { email, password } = await req.json()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  try {
    await work()
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status })
  }
  const { data } = await admin.storage.from('avatars').createSignedUrl(\`\${user.id}/avatar.png\`, 60)
  return NextResponse.json({ url: data.signedUrl })
}
`
  assert.deepEqual(await scan({ 'app/api/login/route.ts': route }, rules), [])
  const leak = `export async function GET(req) {
  const { data, error } = await supabase.from('orders').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
`
  assert.deepEqual(await scan({ 'app/api/orders/route.ts': leak }, rules), ['db-error-message-to-client@app/api/orders/route.ts'])
})

// plugin/bin/security-secrets.mjs em ebe1cf4: o \b antes de "password" não casa depois de "_" (DB_PASSWORD=).
const MASK_OLD = `const COMMON_SECRETS = [
  [/\\beyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}/g, 'eyJ***'],
  [/\\b((?:password|passwd|senha|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret)["']?\\s*[:=]\\s*["']?)[^\\s"',;&]{6,}/gi, '$1***'],
]
const PUBLIC_ENV = /\\b((?:NEXT_PUBLIC|VITE)_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)[A-Z0-9_]*)\\b/g
`
const MASK_FIXED = MASK_OLD.replace(
  ']\nconst PUBLIC_ENV',
  `  [/(?<![A-Za-z0-9_])([A-Za-z0-9_]*(?:password|passwd|secret|token|_key|key_|_pwd|pwd_)[A-Za-z0-9_]*\\s*=\\s*["']?)[^\\s"',;&]{4,}/gi, '$1***'],
]
const PUBLIC_ENV`,
)

test('código: máscara de segredo com \\b antes de password/secret/token (security-secrets.mjs de ebe1cf4)', async () => {
  const rules = ['secret-mask-word-boundary']
  assert.deepEqual(await scan({ 'bin/mask.mjs': MASK_OLD }, rules), ['secret-mask-word-boundary@bin/mask.mjs'])
  assert.deepEqual(await scan({ 'bin/mask.mjs': MASK_FIXED }, rules), [])
  // Regex com \b que não esconde nada (só procura o campo) não conta.
  assert.deepEqual(await scan({ 'src/form.ts': "const isPassword = /\\bpassword\\b/i.test(name)\n" }, rules), [])
})
