// Teste do banco como visitante (Supabase). O Security Advisor lê as regras; aqui o Faundr tenta de verdade:
// 1. com a chave pública do .env (a mesma que vai para o navegador), lê cada tabela pela API, como um visitante;
// 2. pelo SQL (API de gestão do Supabase ou o MCP), entra como visitante (anon) e como uma pessoa logada nova
//    (authenticated, sem nenhum dado) e tenta ler, gravar, alterar e apagar. Cada tentativa roda num bloco que
//    termina com erro de propósito: o Postgres desfaz tudo, então nada fica gravado nem apagado.
//
// A chave pública é lida do .env só para o teste; nunca é impressa nem enviada ao Faundr.

import fs from 'node:fs'
import path from 'node:path'

const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local', '.dev.vars']
const URL_VAR = /^(?:export\s+)?(?:[A-Z0-9]+_)*SUPABASE_URL\s*=\s*(.*)$/
const KEY_VAR = /^(?:export\s+)?(?:[A-Z0-9]+_)*SUPABASE_(?:ANON|PUBLISHABLE)(?:_DEFAULT)?_KEY\s*=\s*(.*)$/
const unquote = (v) => v.trim().replace(/^["']|["']$/g, '')

/** URL e chave pública do Supabase nos .env do projeto: { url, ref, key, file } ou null. */
export function supabaseTarget(root) {
  let url = null
  let key = null
  let file = null
  for (const f of ENV_FILES) {
    let text
    try {
      text = fs.readFileSync(path.join(root, f), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      const u = line.match(URL_VAR)
      if (u && !url && /^https?:\/\//.test(unquote(u[1]))) [url, file] = [unquote(u[1]).replace(/\/+$/, ''), f]
      const k = line.match(KEY_VAR)
      if (k && !key && unquote(k[1]).length > 20) key = unquote(k[1])
    }
    if (url && key) break
  }
  if (!url) return null
  return { url, ref: url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1] ?? null, key, file }
}

// ---- 1. Leitura com a chave pública, pela API (o caminho de um visitante de verdade) --------------------------

const headers = (key) => (key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: `Bearer ${key}` })

/** Tabelas que a API mostra para a chave pública (lista oficial do PostgREST); [] se ela não mostra. */
export async function exposedTables(target, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`${target.url}/rest/v1/`, { headers: headers(target.key), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const doc = await res.json()
    return Object.keys(doc?.paths ?? {})
      .map((p) => p.replace(/^\//, ''))
      .filter((p) => p && !p.startsWith('rpc/'))
  } catch {
    return []
  }
}

/** Tabelas criadas nas migrações (quando a API não lista). */
export function migrationTables(root) {
  const out = new Set()
  for (const dir of ['supabase/migrations', 'migrations', 'db/migrations']) {
    let files
    try {
      files = fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.sql'))
    } catch {
      continue
    }
    for (const f of files) {
      const sql = fs.readFileSync(path.join(root, dir, f), 'utf8')
      for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)) out.add(m[1].toLowerCase())
      for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi)) out.delete(m[1].toLowerCase())
    }
  }
  return [...out]
}

const SENSITIVE = /(e_?mail|phone|telefone|celular|cpf|cnpj|rg\b|password|senha|token|secret|segredo|address|endereco|endereço|birth|nascimento|salary|salario|card|cartao|cartão|iban|ssn|api_?key)/i

/** Lê cada tabela como visitante: [{ table, status, visible, columns, sensitive }]. Só leitura (GET). */
export async function anonReads(target, tables, { fetchImpl = fetch } = {}) {
  const out = []
  for (const table of tables) {
    try {
      const res = await fetchImpl(`${target.url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, {
        headers: { ...headers(target.key), prefer: 'count=exact', range: '0-0' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        out.push({ table, status: res.status, visible: 0, columns: [], sensitive: [] })
        continue
      }
      const rows = await res.json().catch(() => [])
      const total = Number(res.headers.get('content-range')?.split('/')[1])
      const columns = Array.isArray(rows) && rows[0] ? Object.keys(rows[0]) : []
      out.push({
        table,
        status: res.status,
        visible: Number.isFinite(total) ? total : Array.isArray(rows) ? rows.length : 0,
        columns,
        sensitive: columns.filter((c) => SENSITIVE.test(c)),
      })
    } catch {
      out.push({ table, status: 0, visible: 0, columns: [], sensitive: [] })
    }
  }
  return out
}

// ---- 2. Gravar, alterar e apagar pelo SQL, sempre desfeito --------------------------------------------------

// Cada tentativa fica num bloco BEGIN … EXCEPTION que termina com 'faundr-volta': o Postgres desfaz o bloco
// inteiro (inclusive o SET LOCAL ROLE e o usuário de mentira). Gravação, alteração e apagamento mexem em no
// máximo 1 linha, com tempo limite de 5 s. O resultado é JSON numa coluna "result".
export const PROBE_SQL = `
create or replace function pg_temp.faundr_as(r text, uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('statement_timeout', '5000', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', r)::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', r, true);
  execute format('set local role %I', r);
end $f$;

create or replace function pg_temp.faundr_probe(t regclass, kind "char", col text, r text, uid uuid) returns jsonb language plpgsql as $f$
declare res jsonb := '{}'; n bigint;
begin
  begin
    perform pg_temp.faundr_as(r, uid);
    execute format('select count(*) from (select 1 from %s limit 1000) x', t) into n;
    res := res || jsonb_build_object('select', n);
    raise exception 'faundr-volta';
  exception when others then
    if sqlerrm <> 'faundr-volta' then res := res || jsonb_build_object('select', sqlstate); end if;
  end;
  if kind not in ('r', 'p') then return res; end if;
  if r = 'anon' then
    begin
      perform pg_temp.faundr_as(r, uid);
      execute format('insert into %s default values', t);
      res := res || jsonb_build_object('insert', 'ok');
      raise exception 'faundr-volta';
    exception when others then
      if sqlerrm <> 'faundr-volta' then res := res || jsonb_build_object('insert', sqlstate); end if;
    end;
  end if;
  if col is not null then
    begin
      perform pg_temp.faundr_as(r, uid);
      execute format('update %s set %I = %I where ctid = any(array(select ctid from %s limit 1))', t, col, col, t);
      get diagnostics n = row_count;
      res := res || jsonb_build_object('update', n);
      raise exception 'faundr-volta';
    exception when others then
      if sqlerrm <> 'faundr-volta' then res := res || jsonb_build_object('update', sqlstate); end if;
    end;
  end if;
  begin
    perform pg_temp.faundr_as(r, uid);
    execute format('delete from %s where ctid = any(array(select ctid from %s limit 1))', t, t);
    get diagnostics n = row_count;
    res := res || jsonb_build_object('delete', n);
    raise exception 'faundr-volta';
  exception when others then
    if sqlerrm <> 'faundr-volta' then res := res || jsonb_build_object('delete', sqlstate); end if;
  end;
  return res;
end $f$;

create or replace function pg_temp.faundr_rows(t regclass) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute format('select count(*) from (select 1 from %s limit 1000) x', t) into n;
  return n;
exception when others then return null;
end $f$;

select coalesce(jsonb_agg(x order by x->>'table'), '[]'::jsonb) as result from (
  select jsonb_build_object(
    'table', c.relname,
    'kind', c.relkind,
    'rls', c.relrowsecurity,
    'rows', pg_temp.faundr_rows(c.oid),
    'policies', (select coalesce(jsonb_agg(jsonb_build_object('name', p.polname, 'cmd', p.polcmd,
                   'roles', (select coalesce(jsonb_agg(case when ro = 0 then 'public' else ro::regrole::text end), '[]') from unnest(p.polroles) ro),
                   'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid))), '[]')
                 from pg_policy p where p.polrelid = c.oid),
    'anon', pg_temp.faundr_probe(c.oid, c.relkind, a.attname, 'anon', null),
    'user', pg_temp.faundr_probe(c.oid, c.relkind, a.attname, 'authenticated', gen_random_uuid())
  ) as x
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join lateral (
    select att.attname::text as attname from pg_attribute att
    where att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped and att.attgenerated = '' and att.attidentity <> 'a'
    order by att.attnum limit 1
  ) a on true
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
) s;
`.trim()

/** Roda o teste pela API de gestão do Supabase (token pessoal do usuário). Devolve a lista de tabelas. */
export async function probeWithToken(ref, token, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: PROBE_SQL }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Supabase respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return parseProbe(await res.json())
}

/** Aceita o que a API de gestão ou o MCP (execute_sql) devolvem: [{ result: [...] }], { result }, a lista pura ou texto. */
export function parseProbe(data) {
  if (typeof data === 'string') {
    try {
      return parseProbe(JSON.parse(data))
    } catch {}
    // Texto do MCP: o JSON vem no meio de um aviso.
    const m = data.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (!m) throw new Error('Não achei o resultado do teste (JSON com "result").')
    return parseProbe(JSON.parse(m[0]))
  }
  let v = data
  if (Array.isArray(v) && v.length === 1 && v[0] && 'result' in v[0]) v = v[0].result
  else if (v && !Array.isArray(v) && 'result' in v) v = v.result
  if (typeof v === 'string') return parseProbe(v)
  if (!Array.isArray(v) || v.some((t) => typeof t?.table !== 'string')) throw new Error('Resultado do teste num formato que não reconheço.')
  return v
}

// ---- 3. O que o teste mostrou, em achados para a seção Segurança -------------------------------------------

const allowed = (v) => typeof v === 'number' && v > 0
const passedRls = (v) => v === 'ok' || (typeof v === 'string' && /^(23|22)/.test(v)) // passou da regra; parou em dado faltando
const ALWAYS_TRUE = /^\(?\s*true\s*\)?$/i

function finding({ table, kind, severity, title, detail, impact, fix }) {
  return {
    source: 'database',
    rule_id: `db-test:${kind}`,
    severity,
    confidence: 'high',
    title: title.slice(0, 280),
    detail,
    impact,
    fix,
    file: null,
    line: null,
    fingerprint: `${table}|${kind}`,
  }
}

const POLICY_FIX = (table) =>
  `Ative a proteção por linha e crie regras que liberem só o dono: alter table public.${table} enable row level security; e, por exemplo, create policy "dono lê" on public.${table} for select to authenticated using (auth.uid() = user_id). Se a tabela é pública de propósito (produtos, posts), libere só a leitura e marque este aviso como "não é problema".`

/**
 * Junta a leitura pela API (reads) e o teste pelo SQL (tables) em achados.
 * reads: [{ table, status, visible, columns, sensitive }] · tables: saída do PROBE_SQL (ou null se não rodou).
 */
export function dbFindings({ reads = [], tables = null }) {
  const out = []
  const readOf = new Map(reads.map((r) => [r.table, r]))
  const sqlOf = new Map((tables ?? []).map((t) => [t.table, t]))
  const names = [...new Set([...readOf.keys(), ...sqlOf.keys()])].sort()
  for (const name of names) {
    const r = readOf.get(name)
    const t = sqlOf.get(name)
    const view = t && (t.kind === 'v' || t.kind === 'm')
    const anonVisible = r && r.status === 200 && r.visible > 0 ? r.visible : allowed(t?.anon?.select) ? t.anon.select : 0
    if (anonVisible) {
      const sensitive = r?.sensitive ?? []
      out.push(
        finding({
          table: name,
          kind: 'anon-le',
          severity: sensitive.length ? 'critical' : 'high',
          title: `Qualquer visitante lê a ${view ? 'visão' : 'tabela'} ${name} (${anonVisible >= 1000 ? '1000+' : anonVisible} linha${anonVisible > 1 ? 's' : ''})`,
          detail: `O Faundr leu ${name} com a chave pública (a que vai para o navegador), sem login${r?.status === 200 ? ', pela API do site' : ''}.${sensitive.length ? ` Tem colunas que parecem dados pessoais ou segredos: ${sensitive.join(', ')}.` : ''}${view ? ' Visões ignoram a proteção por linha das tabelas, a não ser que sejam criadas com security_invoker.' : ''}`,
          impact: 'Qualquer pessoa que abrir o site pode copiar esses dados com a chave que está no código do navegador.',
          fix: view ? `Recrie a visão com (security_invoker = true) ou tire o acesso: revoke select on public.${name} from anon;` : POLICY_FIX(name),
        }),
      )
    }
    if (!t) continue
    const a = t.anon ?? {}
    const u = t.user ?? {}
    if (passedRls(a.insert))
      out.push(
        finding({
          table: name,
          kind: 'anon-grava',
          severity: 'critical',
          title: `Qualquer visitante grava na tabela ${name}`,
          detail: `Sem login, o Faundr conseguiu ${a.insert === 'ok' ? 'gravar uma linha' : 'passar pela proteção ao gravar (só parou por faltar dado)'} em ${name}. A gravação foi desfeita na hora.`,
          impact: 'Qualquer pessoa pode encher a tabela de lixo ou dados falsos usando a chave pública.',
          fix: POLICY_FIX(name),
        }),
      )
    for (const [who, res, sev] of [
      ['anon', a, 'critical'],
      ['user', u, 'critical'],
    ]) {
      const label = who === 'anon' ? 'Qualquer visitante' : 'Qualquer pessoa logada'
      if (allowed(res.update))
        out.push(
          finding({
            table: name,
            kind: `${who}-altera`,
            severity: sev,
            title: `${label} altera dados dos outros na tabela ${name}`,
            detail: `${who === 'anon' ? 'Sem login' : 'Logado como uma pessoa nova, sem nenhum dado'}, o Faundr conseguiu alterar uma linha que não era dele em ${name}. A mudança foi desfeita na hora.`,
            impact: 'Alguém mal-intencionado pode mudar preços, permissões ou dados de outras pessoas.',
            fix: `Na regra de update, use using (auth.uid() = user_id) with check (auth.uid() = user_id) em vez de true. ${POLICY_FIX(name)}`,
          }),
        )
      if (allowed(res.delete))
        out.push(
          finding({
            table: name,
            kind: `${who}-apaga`,
            severity: sev,
            title: `${label} apaga dados dos outros na tabela ${name}`,
            detail: `${who === 'anon' ? 'Sem login' : 'Logado como uma pessoa nova, sem nenhum dado'}, o Faundr conseguiu apagar uma linha que não era dele em ${name}. O apagamento foi desfeito na hora.`,
            impact: 'Alguém mal-intencionado pode apagar os dados de todo mundo.',
            fix: `Na regra de delete, use using (auth.uid() = user_id) em vez de true. ${POLICY_FIX(name)}`,
          }),
        )
    }
    if (allowed(u.select) && !anonVisible && t.rows > 0)
      out.push(
        finding({
          table: name,
          kind: 'user-le',
          severity: 'medium',
          title: `Qualquer pessoa logada lê a tabela ${name} inteira`,
          detail: `Logado como uma pessoa nova, sem nenhum dado, o Faundr viu ${u.select >= 1000 ? '1000+' : u.select} linha(s) de ${name}. Se são dados de cada usuário, todo mundo vê os de todo mundo.`,
          impact: 'Basta criar uma conta para ver os dados das outras pessoas.',
          fix: `Se cada linha é de um usuário, troque a regra de select por using (auth.uid() = user_id). Se é para todos verem (perfis públicos, catálogo), marque este aviso como "não é problema".`,
        }),
      )
    // Tabela vazia: o teste não prova nada; a regra escrita "true" ou sem proteção fica como aviso.
    if (t.rows === 0 && (t.kind === 'r' || t.kind === 'p')) {
      const open = !t.rls
        ? 'está sem proteção por linha (RLS desligado)'
        : (t.policies ?? []).some((p) => (p.roles ?? []).some((x) => x === 'public' || x === 'anon') && (ALWAYS_TRUE.test(p.using ?? '') || ALWAYS_TRUE.test(p.check ?? '')))
          ? 'tem regra liberando tudo (true) para visitantes'
          : null
      if (open)
        out.push(
          finding({
            table: name,
            kind: 'vazia-aberta',
            severity: 'high',
            title: `Tabela ${name} vazia e aberta: ${open}`,
            detail: `A tabela ainda não tem dados, então o teste não conseguiu ler nada, mas ela ${open}. Quando os dados chegarem, visitantes vão ver.`,
            impact: 'Os primeiros dados reais ficam expostos assim que o app for usado.',
            fix: POLICY_FIX(name),
          }),
        )
    }
  }
  return out
}

/** Resumo em português simples para o terminal. */
export function dbSummary({ target, reads, tables, findings }) {
  const lines = []
  lines.push(`Banco testado: ${target?.ref ? `${target.ref}.supabase.co` : (target?.url ?? 'pelo SQL')}`)
  const n = new Set([...reads.map((r) => r.table), ...(tables ?? []).map((t) => t.table)]).size
  lines.push(
    `Tabelas testadas: ${n} · ${reads.length ? 'leitura pela chave pública: sim' : 'leitura pela chave pública: não (falta a chave no .env)'} · ${tables ? 'gravar/alterar/apagar como visitante e como outra pessoa: sim (tudo desfeito)' : 'gravar/alterar/apagar: não testado (falta o acesso ao SQL)'}`,
  )
  if (!findings.length) lines.push('Nenhuma porta aberta encontrada.')
  else {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    const pt = { critical: 'crítico', high: 'alto', medium: 'médio', low: 'baixo' }
    for (const f of [...findings].sort((a, b) => order[a.severity] - order[b.severity])) lines.push(`  [${pt[f.severity]}] ${f.title}`)
  }
  return lines.join('\n')
}
