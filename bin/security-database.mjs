// Banco de dados: migração destrutiva e regras do SQL (RLS, policies, buckets, security definer)
// (parte de security.mjs).
import { t } from './i18n.mjs'
import { readText, lineOf } from './security-base.mjs'

// Migração que apaga ou transforma dado sem volta: o aviso entra antes de gravar, quando ainda dá para fazer backup
// e escrever o caminho de volta. As antigas já rodaram, então não viram achado no painel.
const MIGRATION_FILE = /(^|\/)supabase\/migrations\/.+\.sql$|(^|\/)(migrations?|db\/migrate|drizzle|prisma\/migrations)\/.+\.sql$/i
const DESTRUCTIVE_SQL = [
  [/\bdrop\s+table\b/i, 'deletes a whole table'],
  [/\bdrop\s+schema\b/i, 'deletes a whole schema'],
  [/\balter\s+table\b[^;]*\bdrop\s+(column\b|(?!constraint\b|policy\b|default\b|not\b)\w)/i, 'deletes a column'],
  [/\btruncate\b/i, 'empties a table'],
  [/\bdelete\s+from\s+[\w."]+\s*(;|$)/i, 'deletes every row (delete without where)'],
  [/\bupdate\s+[\w."]+\s+set\b(?![^;]*\bwhere\b)[^;]*(;|$)/i, 'changes every row (update without where)'],
  [/\balter\s+column\b[^;]*\btype\b/i, 'changes a column type (may lose or truncate data)'],
  [/\brename\s+(column\s+)?[\w."]+\s+to\b/i, 'renames a table or column (the live app still uses the old name)'],
]

/** O que a migração faz que não tem volta (lista vazia se não é migração ou não apaga nada). */
export function destructiveMigration(content, rel) {
  if (!content || !MIGRATION_FILE.test(rel)) return []
  const sql = strip(content)
  return DESTRUCTIVE_SQL.filter(([re]) => re.test(sql)).map(([, what]) => what)
}

// ---- banco (migrations do Supabase) --------------------------------------------------------

// Divide o SQL em comandos, respeitando strings, comentários e corpos $tag$…$tag$.
export function splitSql(sql) {
  const out = []
  let start = 0
  let i = 0
  const push = (end) => {
    const text = sql.slice(start, end)
    if (text.trim()) out.push({ text, line: lineOf(sql, start + (text.length - text.trimStart().length)) })
    start = end + 1
  }
  while (i < sql.length) {
    const c = sql[i]
    if (c === '-' && sql[i + 1] === '-') i = sql.indexOf('\n', i) === -1 ? sql.length : sql.indexOf('\n', i)
    else if (c === '/' && sql[i + 1] === '*') i = sql.indexOf('*/', i + 2) === -1 ? sql.length : sql.indexOf('*/', i + 2) + 2
    else if (c === "'") {
      i++
      while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1
      i++
    } else if (c === '$') {
      const tag = sql.slice(i).match(/^\$[A-Za-z_]*\$/)?.[0]
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length)
        i = end === -1 ? sql.length : end + tag.length
      } else i++
    } else if (c === ';') {
      push(i)
      i++
    } else i++
  }
  push(sql.length)
  return out
}

const strip = (sql) => sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
function tableName(raw) {
  const parts = raw.replace(/"/g, '').toLowerCase().split('.')
  return parts.length === 1 ? { schema: 'public', name: parts[0] } : { schema: parts[0], name: parts[1] }
}

// Política com condição "true" (não confere quem pede), exceto leitura, service_role e storage.
function policyFinding(m, rel, stmt) {
  const policy = m[1].replace(/"/g, '')
  const tbl = tableName(m[2])
  const rest = m[3]
  const cmd = (rest.match(/ for (all|select|insert|update|delete)\b/i)?.[1] ?? 'all').toLowerCase()
  const roles = rest.match(/ to ([\w", ]+?)(?: using| with check|$)/i)?.[1]?.toLowerCase() ?? 'public'
  const alwaysTrue = /(using|with check) \(\s*\(?\s*(true|1\s*=\s*1)\s*\)?\s*\)/i.test(rest)
  if (!alwaysTrue || cmd === 'select' || /service_role/.test(roles) || tbl.schema === 'storage') return null
  const anyone = /anon|public/.test(roles)
  const who = anyone ? t('anyone', 'qualquer pessoa') : t('any logged-in user', 'qualquer usuário logado')
  const Who = anyone ? t('Anyone', 'Qualquer pessoa') : t('Any logged-in user', 'Qualquer usuário logado')
  const withCheck = cmd === 'insert' || cmd === 'update' || cmd === 'all' ? ' with check ((select auth.uid()) = user_id)' : ''
  return {
    source: 'database',
    rule_id: 'rls-policy-always-true',
    severity: anyone ? 'critical' : 'high',
    confidence: 'high',
    title: t(`Policy "${policy}" allows ${cmd === 'all' ? 'everything' : cmd} on ${tbl.name} for ${who}`, `Política "${policy}" libera ${cmd === 'all' ? 'tudo' : cmd} em ${tbl.name} para ${who}`),
    detail: t(
      `The policy "${policy}" on the table ${tbl.name} has the condition "true": it does not check who is asking.`,
      `A política "${policy}" da tabela ${tbl.name} tem a condição "true": ela não confere quem está pedindo.`,
    ),
    impact:
      cmd === 'insert'
        ? t(
            `${Who} can create rows in ${tbl.name} with any content, including in someone else's name.`,
            `${Who} pode criar linhas em ${tbl.name} com qualquer conteúdo, inclusive em nome de outra pessoa.`,
          )
        : t(
            `${Who} can ${cmd === 'delete' ? 'delete' : 'change'} other people's rows in ${tbl.name}.`,
            `${Who} pode ${cmd === 'delete' ? 'apagar' : 'alterar'} linhas de outras pessoas em ${tbl.name}.`,
          ),
    fix: t(
      `Replace "true" with a condition that checks the owner, for example: using ((select auth.uid()) = user_id)${withCheck}. Do it in a new migration (drop policy + create policy).`,
      `Troque "true" por uma condição que confira o dono, por exemplo: using ((select auth.uid()) = user_id)${withCheck}. Faça isso numa nova migration (drop policy + create policy).`,
    ),
    file: rel,
    line: stmt.line,
    snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
    fingerprint: `database|rls-policy-always-true|${tbl.name}|${policy}`,
  }
}

// Bucket do Storage criado como público.
function bucketFinding(s, rel, stmt) {
  const cols = s.match(/buckets ?\(([^)]*)\)/i)?.[1]?.split(',').map((c) => c.trim().toLowerCase()) ?? []
  const values = s.match(/values ?\((.*)\)/i)?.[1]?.split(',').map((v) => v.trim()) ?? []
  const pub = cols.indexOf('public')
  if (pub === -1 || !/^true$/i.test(values[pub] ?? '')) return null
  const bucket = (values[cols.indexOf('id')] ?? values[cols.indexOf('name')] ?? '').replace(/'/g, '')
  return {
    source: 'database',
    rule_id: 'storage-public-bucket',
    severity: 'medium',
    confidence: 'high',
    title: t(`Public file bucket: ${bucket}`, `Bucket de arquivos público: ${bucket}`),
    detail: t(
      `The bucket ${bucket} was created as public: anyone with the link opens the files, without logging in.`,
      `O bucket ${bucket} foi criado como público: qualquer pessoa com o link abre os arquivos, sem login.`,
    ),
    impact: t(
      "If it stores documents, personal photos or customers' files, they are reachable by anyone who finds the link.",
      'Se guardar documentos, fotos pessoais ou arquivos de clientes, eles ficam acessíveis para quem descobrir o link.',
    ),
    fix: t(
      'If the files are not meant for the public, make the bucket private (public = false) and serve the files with temporary links (createSignedUrl).',
      'Se os arquivos não são para o público, deixe o bucket privado (public = false) e entregue os arquivos com links temporários (createSignedUrl).',
    ),
    file: rel,
    line: stmt.line,
    snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
    fingerprint: `database|storage-public-bucket|${bucket}`,
  }
}

// Função "security definer" sem search_path fixo.
function definerFinding(m, rel, stmt) {
  const fn = m[1].replace(/"/g, '')
  return {
    source: 'database',
    rule_id: 'security-definer-search-path',
    severity: 'medium',
    confidence: 'medium',
    title: t(`Function ${fn} runs with full power and no fixed search_path`, `Função ${fn} roda com poder total sem search_path fixo`),
    detail: t(
      `The function ${fn} is "security definer" (it runs with the permissions of whoever created it, bypassing the access rules) and does not pin the search_path.`,
      `A função ${fn} é "security definer" (roda com as permissões de quem a criou, ignorando as regras de acesso) e não fixa o search_path.`,
    ),
    impact: t(
      'Someone allowed to create objects in the database can trick the function into running their code with full power.',
      'Alguém com permissão para criar objetos no banco pode enganar a função e fazer ela executar código dele com poder total.',
    ),
    fix: t(
      `Add "set search_path = ''" to the function definition (and use full names, like public.table). Also check whether it really needs to be security definer.`,
      `Adicione "set search_path = ''" na definição da função (e use nomes completos, como public.tabela). Confira também se ela precisa mesmo ser security definer.`,
    ),
    file: rel,
    line: stmt.line,
    snippet: stmt.text.trim().split('\n')[0].slice(0, 240),
    fingerprint: `database|security-definer-search-path|${fn.toLowerCase()}`,
  }
}

function rlsDisabledFinding(name, tbl) {
  return {
    source: 'database',
    rule_id: 'rls-disabled',
    severity: 'critical',
    confidence: 'high',
    title: t(`Table ${name} has no access protection (RLS)`, `Tabela ${name} sem proteção de acesso (RLS)`),
    detail: t(
      `The table public.${name} was created without "enable row level security". Without it, Supabase's access rules do not apply to it.`,
      `A tabela public.${name} foi criada sem "enable row level security". Sem isso, as regras de acesso do Supabase não valem para ela.`,
    ),
    impact: t(
      `Anyone with the app's public key (which sits in the browser) can read, change and delete everything in ${name}.`,
      `Qualquer pessoa com a chave pública do app (que fica no navegador) pode ler, alterar e apagar tudo em ${name}.`,
    ),
    fix: t(
      `In a new migration: alter table public.${name} enable row level security; and create policies that let each user see and change only their own data.`,
      `Numa nova migration: alter table public.${name} enable row level security; e crie políticas que só deixam cada usuário ver e mudar os próprios dados.`,
    ),
    file: tbl.file,
    line: tbl.line,
    snippet: `create table public.${name} (…)`,
    fingerprint: `database|rls-disabled|${name}`,
  }
}

// ---- função security definer que confere papel sem pensar no NULL ---------------------------

const fnKey = (raw) => raw.replace(/"/g, '').toLowerCase().replace(/^public\./, '')
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const UID_EXPR = /^\(?\s*(select\s+)?auth\.uid\(\)\s*\)?$/i

// Variáveis do "declare" que podem ficar NULL: as que vêm de função, consulta ou nada (não as de valor fixo,
// coalesce, "not null" nem registros). Devolve { nome: 'uid' | 'value' } ('uid' = vem só de auth.uid()).
function nullableVars(body) {
  const decl = body.match(/^\s*declare\b([\s\S]*?)\bbegin\b/i)?.[1] ?? ''
  const vars = new Map()
  for (const piece of decl.split(';')) {
    const m = piece.match(/^\s*(\w+)\s+(?:constant\s+)?([\w.%[\]]+(?:\s*\([^)]*\))?)((?:\s+not\s+null)?)(?:\s*(?::=|=|default)\s*([\s\S]+))?$/i)
    if (!m || m[3] || /%rowtype$|^record$|\./i.test(m[2])) continue
    const init = m[4]?.trim()
    if (init && /^('[^']*'|-?\d[\d.]*|true|false|now\(\)|coalesce\s*\(|array\[)/i.test(init)) continue
    vars.set(m[1].toLowerCase(), init && UID_EXPR.test(init) ? 'uid' : 'value')
  }
  return vars
}

/**
 * Condições "if … then raise" que comparam uma variável que pode ser NULL com <>, != ou "not in": com NULL o
 * resultado é NULL, o "if" não dispara e a trava não vale (ex.: org_role() de quem não é membro).
 * Devolve [{ name, kind, index }] — kind 'uid' quando o NULL é "sem login".
 */
export function nullGuards(statement) {
  const s = strip(statement).replace(/\s+/g, ' ')
  if (!/\blanguage\s+plpgsql\b/i.test(s)) return []
  const tag = s.match(/\bas\s+(\$\w*\$)/i)?.[1]
  const start = tag ? s.indexOf(tag) + tag.length : -1
  const end = tag ? s.indexOf(tag, start) : -1
  if (start < 0 || end < 0) return []
  const body = s.slice(start, end)
  const vars = nullableVars(body)
  const out = []
  const seen = new Set()
  const add = (name, kind, index) => {
    if (seen.has(name)) return
    seen.add(name)
    out.push({ name, kind, index })
  }
  for (const g of body.matchAll(/\b(?:if|elsif)\s+((?:(?!\bthen\b).){1,600}?)\s+then\s+(raise\b)?/gi)) {
    const cond = g[1]
    const raises = Boolean(g[2])
    for (const [v, kind] of vars) {
      if (!raises) continue
      const name = escapeRe(v)
      const neg = new RegExp(`(?<![\\w.])${name}\\s*(?:<>|!=)|(?:<>|!=)\\s*${name}(?![\\w.(])|(?<![\\w.])${name}\\s+not\\s+in\\s*\\(`, 'i')
      if (!neg.test(cond)) continue
      // A mesma condição (ou uma trava antes) já trata o NULL.
      const nullSafe = new RegExp(`(?<![\\w.])${name}\\s+is\\s+(?:not\\s+)?null\\b|coalesce\\s*\\(\\s*${name}\\b`, 'i')
      if (nullSafe.test(cond)) continue
      const before = body.slice(0, g.index)
      if (new RegExp(`\\bif\\s+(?:(?!\\bthen\\b).)*?(?<![\\w.])${name}\\s+is\\s+null\\b(?:(?!\\bthen\\b).)*?\\bthen\\s+raise\\b`, 'i').test(before)) continue
      if (new RegExp(`\\binto\\s+strict\\s+${name}\\b|\\binto\\s+${name}\\b[^;]*;\\s*if\\s+not\\s+found\\s+then\\s+raise\\b`, 'i').test(before)) continue
      // count(*), exists(…) e row_count nunca dão NULL.
      if (new RegExp(`\\bselect\\s+(?:count|exists)\\s*\\([^;]*?\\binto\\s+${name}\\b|(?<![\\w.])${name}\\s*:=\\s*\\(?\\s*(?:select\\s+)?(?:count|exists|coalesce)\\s*\\(|\\bget\\s+diagnostics\\s+${name}\\b`, 'i').test(before)) continue
      add(v, kind, g.index)
    }
    // auth.uid() direto numa comparação negativa: sem login ele é NULL.
    if (/(?:<>|!=)\s*\(?\s*(?:select\s+)?auth\.uid\(\)|auth\.uid\(\)\s*\)?\s*(?:<>|!=)/i.test(cond) && !/auth\.uid\(\)\s*\)?\s+is\s+(not\s+)?null/i.test(body.slice(0, g.index + g[0].length)))
      add('auth.uid()', 'uid', g.index)
  }
  return out
}

function nullGuardFinding(fn) {
  const names = fn.guards.map((g) => g.name).join(', ')
  const uidOnly = fn.guards.every((g) => g.kind === 'uid')
  return {
    source: 'database',
    rule_id: 'definer-null-role-check',
    severity: 'high',
    confidence: 'medium',
    title: t(
      `Function ${fn.name} lets the check pass when ${names} is empty (NULL)`,
      `Função ${fn.name} deixa a trava passar quando ${names} vem vazio (NULL)`,
    ),
    detail: t(
      `The function ${fn.name} runs with full power (security definer) and stops the caller with "if ${names} <> … / not in (…) then raise". When ${names} is NULL (${uidOnly ? 'nobody logged in' : 'for example, the role of someone who is not a member, or a query that found nothing'}), that comparison gives NULL, the "if" does not fire and the function goes on.`,
      `A função ${fn.name} roda com poder total (security definer) e barra quem chama com "if ${names} <> … / not in (…) then raise". Quando ${names} é NULL (${uidOnly ? 'ninguém logado' : 'por exemplo, o papel de quem não é membro, ou uma consulta que não achou nada'}), essa comparação dá NULL, o "if" não dispara e a função segue.`,
    ),
    impact: t(
      uidOnly
        ? 'Someone without logging in (with only the public key of the app) calls the function and skips the check.'
        : 'Exactly who should be stopped (someone outside the team, a removed member, a second account) gets through: they can change roles, remove people or touch data of others.',
      uidOnly
        ? 'Alguém sem login (só com a chave pública do app) chama a função e pula a trava.'
        : 'Justamente quem devia ser barrado (alguém de fora do time, um ex-membro, uma segunda conta) passa: consegue mudar papéis, remover pessoas ou mexer em dados dos outros.',
    ),
    fix: t(
      `In a new migration (create or replace function): check the NULL first — "if ${fn.guards[0].name} is null or ${fn.guards[0].name} not in (…) then raise" — or use "is distinct from" instead of <>. ${uidOnly ? '' : 'Start the function with "if (select auth.uid()) is null then raise exception …".'}`.trim(),
      `Numa nova migration (create or replace function): confira o NULL antes — "if ${fn.guards[0].name} is null or ${fn.guards[0].name} not in (…) then raise" — ou use "is distinct from" no lugar de <>. ${uidOnly ? '' : 'Comece a função com "if (select auth.uid()) is null then raise exception …".'}`.trim(),
    ),
    file: fn.file,
    line: fn.line,
    snippet: fn.snippet,
    fingerprint: `database|definer-null-role-check|${fn.name}`,
  }
}

// Nomes de função de um "grant/revoke execute on function a(…), b(…)".
function functionNames(list) {
  const out = []
  let depth = 0
  let cur = ''
  for (const c of list) {
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    if (depth === 0 && c !== ')') cur += c
  }
  out.push(cur)
  return out.map((n) => fnKey(n.trim())).filter(Boolean)
}

// ---- tabela do time que some junto com a conta de quem criou -----------------------------------

const OWNER_COL = /^(owner_id|owner|created_by|creator_id|author_id)$/
const TEAM_COL = /^(org_id|organization_id|team_id|workspace_id|tenant_id|company_id|account_id)$/
const USER_TABLE = /^(auth\.users|public\.users|public\.profiles|users|profiles)$/i

// Divide "a, b (c, d), e" nas vírgulas de fora dos parênteses.
function splitTop(text) {
  const out = []
  let depth = 0
  let cur = ''
  for (const c of text) {
    if (c === '(') depth++
    else if (c === ')') depth--
    if (c === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// Chave estrangeira de uma coluna: conta quem é referenciado e guarda "dono … on delete cascade".
function foreignKey(tbl, self, col, def, rel, line, tables) {
  const ref = def.match(/\breferences ([\w."]+)/i)?.[1]
  if (!ref) return
  const target = tableName(ref)
  if (target.schema === 'public' && target.name !== self && tables.has(target.name)) tables.get(target.name).referenced = true
  if (OWNER_COL.test(col) && USER_TABLE.test(ref.replace(/"/g, '')) && /\bon delete cascade\b/i.test(def)) tbl.cascade.set(col, { file: rel, line })
  else tbl.cascade.delete(col)
}

function columnDef(def, tbl, self, rel, line, tables) {
  const fk = def.match(/^(?:constraint \S+ )?foreign key \(\s*"?(\w+)"?\s*\)/i)
  if (fk) return foreignKey(tbl, self, fk[1].toLowerCase(), def, rel, line, tables)
  if (/^(constraint|primary|unique|check|exclude|like)\b/i.test(def)) return
  const col = def.match(/^"?(\w+)"?/)?.[1]?.toLowerCase()
  if (!col) return
  tbl.cols.add(col)
  // Coluna de pessoa: id (uuid) ou chave para a tabela de usuários; "created_by text" é só um nome escrito.
  if (/^"?\w+"?\s+uuid\b|\breferences\b/i.test(def)) (tbl.idCols ??= new Set()).add(col)
  foreignKey(tbl, self, col, def, rel, line, tables)
}

function alterTable(actions, tbl, self, rel, line, tables) {
  for (const a of splitTop(actions)) {
    let m
    if ((m = a.match(/^add (?:column )?(?:if not exists )?(.*)$/i))) columnDef(m[1], tbl, self, rel, line, tables)
    else if ((m = a.match(/^drop constraint (?:if exists )?"?(\w+)"?/i))) {
      for (const col of [...tbl.cascade.keys()]) if (m[1].toLowerCase() === `${self}_${col}_fkey`) tbl.cascade.delete(col)
    } else if ((m = a.match(/^drop column (?:if exists )?"?(\w+)"?/i))) {
      tbl.cols.delete(m[1].toLowerCase())
      tbl.cascade.delete(m[1].toLowerCase())
    }
  }
}

// Tabela do time (tem org_id ou parecida, e outras tabelas penduradas nela) cujo dono apaga tudo em cascata.
function cascadeOwnerFindings(tables) {
  const out = []
  for (const [name, tbl] of tables) {
    if (!tbl.referenced || ![...tbl.cols].some((c) => TEAM_COL.test(c))) continue
    for (const [col, at] of tbl.cascade)
      out.push({
        source: 'database',
        rule_id: 'team-row-cascades-with-owner',
        severity: 'medium',
        confidence: 'medium',
        title: t(`Deleting the account of whoever created it deletes the team's ${name}`, `Apagar a conta de quem criou apaga ${name} do time`),
        detail: t(
          `The table ${name} belongs to a team (it has a team column and other tables hang from it), but ${col} points to the user's account with "on delete cascade".`,
          `A tabela ${name} é de um time (tem coluna do time e outras tabelas penduradas nela), mas ${col} aponta para a conta do usuário com "on delete cascade".`,
        ),
        impact: t(
          `When that person deletes their account (or is deleted), the database deletes their rows in ${name} and, in cascade, everything that depends on them, even if the rest of the team still uses it.`,
          `Quando essa pessoa apaga a conta (ou é apagada), o banco apaga as linhas dela em ${name} e, em cascata, tudo o que depende delas, mesmo que o resto do time ainda use.`,
        ),
        fix: t(
          `In a new migration: make ${col} nullable and recreate the foreign key with "on delete set null" (alter table … drop constraint …; add constraint … foreign key (${col}) references auth.users (id) on delete set null).`,
          `Numa nova migration: deixe ${col} anulável e recrie a chave estrangeira com "on delete set null" (alter table … drop constraint …; add constraint … foreign key (${col}) references auth.users (id) on delete set null).`,
        ),
        file: at.file,
        line: at.line,
        snippet: `${name}.${col} references auth.users on delete cascade`,
        fingerprint: `database|team-row-cascades-with-owner|${name}|${col}`,
      })
  }
  return out
}

// ---- linha criada em nome de outra pessoa -----------------------------------------------------

const AUTHOR_COL = /^(owner_id|created_by|creator_id|author_id|user_id)$/

// Política de INSERT (ou "for all") para quem usa o app que não amarra a coluna de autor a quem pede, numa tabela
// em que o navegador pode gravar essa coluna (sem "grant insert (colunas)" que a deixe de fora).
function authorInsertFindings(tables) {
  const out = []
  for (const [name, tbl] of tables) {
    if (!tbl.rls) continue
    const authors = [...tbl.cols].filter((c) => AUTHOR_COL.test(c) && tbl.idCols?.has(c) && (!tbl.insertCols || tbl.insertCols.has(c)))
    if (!authors.length) continue
    for (const [policy, p] of tbl.policies) {
      const cmd = (p.rest.match(/ for (all|select|insert|update|delete)\b/i)?.[1] ?? 'all').toLowerCase()
      const roles = p.rest.match(/ to ([\w", ]+?)(?: using| with check|$)/i)?.[1]?.toLowerCase() ?? 'public'
      if ((cmd !== 'insert' && cmd !== 'all') || /service_role|postgres|supabase_admin/.test(roles)) continue
      const check = p.rest.match(/ with check ([\s\S]*)$/i)?.[1] ?? (cmd === 'all' ? p.rest.match(/ using ([\s\S]*)$/i)?.[1] : null)
      if (!check || /^\(\s*\(?\s*(true|1\s*=\s*1)\s*\)?\s*\)$/i.test(check.trim())) continue
      for (const col of authors) {
        if (new RegExp(`(?<![\\w.])(?:\\w+\\.)?${col}(?![\\w])`, 'i').test(check)) continue
        out.push({
          source: 'database',
          rule_id: 'insert-author-not-checked',
          // Dono (owner_id/user_id) costuma dar poder sobre a linha; "quem criou" é mais registro.
          severity: /^(owner_id|user_id)$/.test(col) ? 'medium' : 'low',
          confidence: 'medium',
          title: t(`Rows of ${name} can be created in someone else's name (${col})`, `Linhas de ${name} podem ser criadas em nome de outra pessoa (${col})`),
          detail: t(
            `The policy "${policy}" lets users insert into ${name}, but its check does not compare ${col} with the logged-in user, and the browser can write that column.`,
            `A política "${policy}" deixa inserir em ${name}, mas a conferência dela não compara ${col} com quem está logado, e o navegador pode gravar essa coluna.`,
          ),
          impact: t(
            `Someone sends ${col} with a colleague's id: the row looks like it was created by that person (and whatever trusts ${col} — permissions, cascade deletes, notifications — follows the fake author).`,
            `Alguém manda ${col} com o id de um colega: a linha parece criada por essa pessoa (e o que confia em ${col} — permissões, apagar em cascata, avisos — segue o autor falso).`,
          ),
          fix: t(
            `Add "and ${col} = (select auth.uid())" to the policy's with check, or lock the columns: revoke insert on public.${name} from authenticated; grant insert (only the columns the screen sends) on public.${name} to authenticated; and let ${col} come from its default.`,
            `Acrescente "and ${col} = (select auth.uid())" no with check da política, ou trave as colunas: revoke insert on public.${name} from authenticated; grant insert (só as colunas que a tela manda) on public.${name} to authenticated; e deixe ${col} vir do padrão.`,
          ),
          file: p.file,
          line: p.line,
          snippet: `create policy "${policy}" on public.${name}${p.rest}`.slice(0, 240),
          fingerprint: `database|insert-author-not-checked|${name}|${col}`,
        })
      }
    }
  }
  return out
}

// ---- o estado final depois de todas as migrações -------------------------------------------------
//
// Política só com "está logado", leitura liberada em tabela com dado pessoal, view sem security_invoker,
// permissão de escrita para o visitante e função security definer aberta sem conferir quem chama: nada disso se
// decide num comando só, porque uma migração posterior pode desfazer (drop policy, revoke, alter view, drop).

const newState = () => ({
  immediate: new Map(), // achados de um comando só (por impressão digital), até uma migração desfazer
  views: new Map(), // public.nome → { file, line, invoker, body }
  access: new Map(), // tabela ou view → permissões escritas nas migrações, por papel
  schema: { anon: new Set(), authenticated: new Set(), service_role: new Set(), at: null }, // "on all tables in schema public"
  defaults: { anon: true, authenticated: true }, // quem pode chamar uma função recém-criada
})

const invokerOn = (options) => /security_invoker(?! ?= ?(?:false|off|0)\b)/i.test(options)

const ROLES = ['anon', 'authenticated', 'service_role']
const WRITE = ['insert', 'update', 'delete', 'truncate']

function accessOf(state, name) {
  if (!state.access.has(name))
    state.access.set(name, { anon: new Set(), authenticated: new Set(), service_role: new Set(), selectCols: { anon: null, authenticated: null }, at: null })
  return state.access.get(name)
}

// grant/revoke em tabelas e views: guarda o que cada papel recebeu por escrito (o Supabase já dá tudo por padrão;
// aqui interessa o que a migração escreveu) e as colunas de leitura quando a permissão é por coluna.
function trackGrants(s, state, where) {
  const m = s.match(/^(grant|revoke) (?:grant option for )?(.+?) on (?:table )?(.+?) (?:to|from) ([\w", ]+?)(?: with grant option| cascade| restrict| granted by \w+)*$/i)
  if (!m || /^(?:all )?(?:function|functions|routine|procedure|schema|sequence|sequences|type|domain|database|language|foreign|large|parameter|tablespace)\b/i.test(m[3])) return
  const grant = m[1].toLowerCase() === 'grant'
  const roles = m[4].toLowerCase().replace(/"/g, '').split(',').map((r) => r.trim())
  // "select (a, b), update" → [{ priv: 'select', cols: ['a', 'b'] }, { priv: 'update' }]
  const privs = splitTop(m[2]).map((x) => {
    const p = x.match(/^(\w+)(?: privileges)?(?: ?\(([^)]*)\))?$/i)
    return p ? { priv: p[1].toLowerCase(), cols: p[2]?.split(',').map((c) => c.trim().replace(/"/g, '').toLowerCase()) ?? null } : null
  })
  if (privs.some((x) => !x)) return
  const all = m[3].match(/^all tables in schema ([\w", ]+)$/i)
  if (all && !/\bpublic\b/i.test(all[1])) return
  const targets = all ? [state.schema] : m[3].split(',').map((raw) => tableName(raw.trim())).filter((t) => t.schema === 'public').map((t) => accessOf(state, t.name))
  for (const acc of targets)
    for (const role of ROLES) {
      if (!roles.includes(role)) continue
      for (const { priv, cols } of privs) {
        if (grant) {
          acc[role].add(priv)
          if (role === 'anon' && (priv === 'all' || WRITE.includes(priv))) acc.at = where
        } else if (priv === 'all') acc[role].clear()
        else {
          acc[role].delete(priv)
          // Tirar uma permissão de quem tinha "all" deixa as outras.
          if (acc[role].delete('all')) for (const other of ['select', ...WRITE]) if (other !== priv) acc[role].add(other)
        }
        if (acc.selectCols && role !== 'service_role' && (priv === 'select' || priv === 'all')) {
          if (!grant) acc.selectCols[role] = new Set()
          else if (cols && acc.selectCols[role]) for (const c of cols) acc.selectCols[role].add(c)
          else if (!cols) acc.selectCols[role] = null
        }
      }
    }
}

// O corpo da função (entre $tag$ … $tag$), ou o que vem depois do "as" quando não há.
function functionBody(s) {
  const tag = s.match(/\bas (\$\w*\$)/i)?.[1]
  if (!tag) return s.replace(/^.*?\b(?:as|return|begin atomic)\b/i, '')
  const start = s.indexOf(tag) + tag.length
  const end = s.indexOf(tag, start)
  return s.slice(start, end === -1 ? undefined : end)
}

// O corpo confere quem está chamando: auth.uid()/auth.role()/auth.jwt(), o usuário da sessão, ou uma função de
// permissão ou de "quem sou eu" do próprio projeto (is_admin(…), has_role(…), org_role(…), my_email(…)).
const CALLER_CHECK =
  /\bauth ?\. ?(?:uid|role|jwt|email) ?\(|current_setting ?\( ?'(?:request\.|role)|\b(?:current_user|session_user|current_role)\b|(?<![\w.])(?<!\b(?:into|from|join|update|table|only) )(?:\w+\.)?(?:(?:is|has|can|check|assert|require|ensure|verify|my|current|caller|auth|jwt)_\w+|\w*(?:role|member|admin|owner|permission|allowed|authoriz)\w*) ?\(/i

function openDefinerFinding(fn) {
  const who = fn.anon ? t('anyone, even without logging in', 'qualquer pessoa, mesmo sem login') : t('any logged-in user', 'qualquer usuário logado')
  return {
    source: 'database',
    rule_id: 'definer-open-without-caller-check',
    severity: fn.anon ? 'high' : 'medium',
    confidence: 'medium',
    title: t(`Function ${fn.name} runs with full power and ${who} can call it`, `Função ${fn.name} roda com poder total e ${who} pode chamá-la`),
    detail: t(
      `The function ${fn.name} is "security definer" (it bypasses the access rules of the tables), it is in the public schema (callable from the browser with supabase.rpc) and its body never checks who is calling (no auth.uid(), no role check). No migration takes the permission away (revoke execute … from public, anon, authenticated).`,
      `A função ${fn.name} é "security definer" (ignora as regras de acesso das tabelas), fica no schema public (dá para chamar do navegador com supabase.rpc) e o corpo dela não confere quem está chamando (sem auth.uid(), sem conferência de papel). Nenhuma migração tira a permissão (revoke execute … from public, anon, authenticated).`,
    ),
    impact: t(
      `${fn.anon ? 'Anyone with the public key of the app' : 'Any logged-in account'} calls the function directly, with the arguments they want, and does what it does on any row: the RLS of the tables does not apply inside it.`,
      `${fn.anon ? 'Qualquer pessoa com a chave pública do app' : 'Qualquer conta logada'} chama a função direto, com os argumentos que quiser, e faz o que ela faz em qualquer linha: a RLS das tabelas não vale dentro dela.`,
    ),
    fix: t(
      `In a new migration: if only the server (service_role, triggers, cron) uses it, "revoke execute on function public.${fn.name} from public, anon, authenticated"; if the app calls it, start the body by checking the caller (if (select auth.uid()) is null then raise exception …, and compare with the owner of the row).`,
      `Numa nova migration: se só o servidor (service_role, gatilhos, cron) usa, "revoke execute on function public.${fn.name} from public, anon, authenticated"; se o app chama, comece o corpo conferindo quem chama (if (select auth.uid()) is null then raise exception …, e compare com o dono da linha).`,
    ),
    file: fn.file,
    line: fn.line,
    snippet: fn.snippet,
    fingerprint: `database|definer-open-without-caller-check|${fn.name}`,
  }
}

// Coluna com dado pessoal ou segredo (o que não pode ficar legível para todo mundo).
const PERSONAL_COL =
  /^(?:e_?mail|\w+_e?mail|e?mail_\w+|phone\w*|\w+_phone|telefone|celular|whatsapp|cpf|cnpj|ssn|tax_id|document_number|(?:\w+_)?address(?:_\w+)?|endereco|cep|zip_?code|postal_code|birth\w*|date_of_birth|dob|nascimento|(?:\w+_)?token(?:_hash)?|\w*password\w*|senha\w*|(?:\w+_)?secret(?:_\w+)?|\w*api_key\w*|stripe_\w+|ip|ip_address|\w+_ip|card_\w+|iban)$/

// A condição da política: 'true' (sempre), 'logged' (só confere que há alguém logado) ou null (confere algo mais).
function weakCondition(expr) {
  const e = expr.toLowerCase().replace(/::\w+/g, '').replace(/[\s()]/g, '')
  if (e === 'true' || e === '1=1') return 'true'
  if (/^(?:select)?auth\.uid(?:isnotnull|<>null|!=null)$/.test(e)) return 'logged'
  if (/^(?:select)?auth\.role='authenticated'$|^'authenticated'=(?:select)?auth\.role$|^(?:select)?auth\.jwt->>'role'='authenticated'$/.test(e)) return 'logged'
  return null
}

function policyParts(rest) {
  return {
    cmd: (rest.match(/ for (all|select|insert|update|delete)\b/i)?.[1] ?? 'all').toLowerCase(),
    roles: rest.match(/ to ([\w", ]+?)(?: using| with check|$)/i)?.[1]?.toLowerCase() ?? 'public',
    using: rest.match(/ using (\(.*?\))(?= with check |$)/i)?.[1] ?? null,
    check: rest.match(/ with check (\(.*\))$/i)?.[1] ?? null,
    restrictive: / as restrictive\b/i.test(rest),
  }
}

// As colunas pessoais que o papel consegue ler (todas, se a permissão de leitura não é por coluna).
function readablePersonal(tbl, acc, roles) {
  const personal = [...tbl.cols].filter((c) => PERSONAL_COL.test(c))
  const who = [/anon|public/.test(roles) ? 'anon' : null, /authenticated|public/.test(roles) ? 'authenticated' : null].filter(Boolean)
  return personal.filter((c) => who.some((role) => !acc?.selectCols[role] || acc.selectCols[role].has(c)))
}

function policyStateFindings(tables, state) {
  const out = []
  for (const [name, tbl] of tables) {
    // Sem RLS as políticas nem valem (o achado é rls-disabled).
    if (!tbl.rls) continue
    for (const [policy, p] of tbl.policies) {
      const { cmd, roles, using, check, restrictive } = policyParts(p.rest)
      if (restrictive || /service_role|postgres|supabase_admin/.test(roles)) continue
      const anyone = /anon|public/.test(roles)
      const base = { source: 'database', file: p.file, line: p.line, snippet: `create policy "${policy}" on public.${name}${p.rest}`.slice(0, 240) }

      // Leitura liberada para todos numa tabela com dado pessoal.
      if (cmd === 'select' && using && weakCondition(using)) {
        const open = anyone && weakCondition(using) === 'true'
        const cols = readablePersonal(tbl, state.access.get(name), open ? roles : 'authenticated')
        if (cols.length)
          out.push({
            ...base,
            rule_id: 'rls-select-all-personal-data',
            severity: open ? 'high' : 'medium',
            confidence: 'medium',
            title: t(
              `${open ? 'Anyone' : 'Any logged-in user'} can read every row of ${name} (${cols.slice(0, 3).join(', ')})`,
              `${open ? 'Qualquer pessoa' : 'Qualquer usuário logado'} lê todas as linhas de ${name} (${cols.slice(0, 3).join(', ')})`,
            ),
            detail: t(
              `The policy "${policy}" lets ${open ? 'everyone, even without logging in,' : 'every logged-in account'} read all rows of ${name}, and the table has personal or secret columns: ${cols.join(', ')}.`,
              `A política "${policy}" deixa ${open ? 'todo mundo, mesmo sem login,' : 'toda conta logada'} ler todas as linhas de ${name}, e a tabela tem colunas pessoais ou secretas: ${cols.join(', ')}.`,
            ),
            impact: t(
              `${open ? 'Anyone with the public key of the app' : 'Anyone who creates an account'} downloads the whole table: the data of every user, not only their own.`,
              `${open ? 'Qualquer pessoa com a chave pública do app' : 'Qualquer pessoa que criar uma conta'} baixa a tabela inteira: os dados de todos os usuários, não só os dela.`,
            ),
            fix: t(
              `In a new migration (drop policy + create policy): let each one read only their own rows, for example using ((select auth.uid()) = user_id). If part of the table is public on purpose, put the public columns in a view or give select only on those columns (revoke select … ; grant select (col1, col2) …).`,
              `Numa nova migration (drop policy + create policy): deixe cada um ler só as próprias linhas, por exemplo using ((select auth.uid()) = user_id). Se parte da tabela é pública de propósito, ponha as colunas públicas numa view ou dê select só nessas colunas (revoke select … ; grant select (col1, col2) …).`,
            ),
            fingerprint: `database|rls-select-all-personal-data|${name}|${policy}`,
          })
        continue
      }

      // Escrita só com "está logado": qualquer conta mexe nas linhas de todo mundo.
      const conditions = { update: [using, check ?? using], delete: [using], all: [using, check ?? using], insert: [check] }[cmd] ?? []
      if (!conditions.length || conditions.some((c) => !c || weakCondition(c) !== 'logged')) continue
      if (cmd === 'insert') {
        // Em tabela sem coluna de dono nem de time, "quem está logado insere" costuma ser de propósito (feedback,
        // eventos); com coluna de autor, o achado insert-author-not-checked já cobre.
        const cols = [...tbl.cols]
        if (cols.some((c) => AUTHOR_COL.test(c) && tbl.idCols?.has(c)) || !cols.some((c) => TEAM_COL.test(c))) continue
      }
      const verb = { update: t('change', 'alterar'), delete: t('delete', 'apagar'), all: t('read, change and delete', 'ler, alterar e apagar'), insert: t('create', 'criar') }[cmd]
      out.push({
        ...base,
        rule_id: 'rls-policy-logged-in-only',
        severity: cmd === 'insert' ? 'medium' : 'high',
        confidence: 'high',
        title: t(`Policy "${policy}" lets any logged-in user ${verb} rows of ${name}`, `Política "${policy}" deixa qualquer usuário logado ${verb} linhas de ${name}`),
        detail: t(
          `The policy "${policy}" on ${name} only checks that someone is logged in (auth.uid() is not null / auth.role() = 'authenticated'). It does not check that the row belongs to that person or to their team.`,
          `A política "${policy}" de ${name} só confere que há alguém logado (auth.uid() is not null / auth.role() = 'authenticated'). Ela não confere se a linha é dessa pessoa ou do time dela.`,
        ),
        impact:
          cmd === 'insert'
            ? t(`Anyone who creates an account can create rows in ${name} inside any team.`, `Qualquer pessoa que criar uma conta consegue criar linhas em ${name} dentro de qualquer time.`)
            : t(`Anyone who creates an account can ${verb} the rows of every other user in ${name}.`, `Qualquer pessoa que criar uma conta consegue ${verb} as linhas de todos os outros usuários em ${name}.`),
        fix: t(
          `In a new migration (drop policy + create policy), compare the row with who is asking: using ((select auth.uid()) = user_id)${cmd === 'delete' ? '' : ' with check ((select auth.uid()) = user_id)'}, or the team membership check your project already uses.`,
          `Numa nova migration (drop policy + create policy), compare a linha com quem pede: using ((select auth.uid()) = user_id)${cmd === 'delete' ? '' : ' with check ((select auth.uid()) = user_id)'}, ou a conferência de time que o projeto já usa.`,
        ),
        fingerprint: `database|rls-policy-logged-in-only|${name}|${policy}`,
      })
    }
  }
  return out
}

// View no schema public sem security_invoker lendo tabela com RLS: a view roda com o poder de quem a criou e
// devolve as linhas de todo mundo.
function viewFindings(tables, state) {
  const out = []
  for (const [name, v] of state.views) {
    if (v.invoker) continue
    const acc = state.access.get(name)
    // Fechada para quem usa o app (revoke … from anon, authenticated): só o servidor lê.
    if (acc && ['anon', 'authenticated'].every((role) => acc.selectCols[role] && acc.selectCols[role].size === 0)) continue
    const read = [...new Set([...v.body.matchAll(/\b(?:from|join) (?:only )?([\w."]+)/gi)].map((m) => tableName(m[1])).filter((x) => x.schema === 'public' && tables.get(x.name)?.rls).map((x) => x.name))]
    if (!read.length) continue
    out.push({
      source: 'database',
      rule_id: 'view-without-security-invoker',
      severity: 'high',
      confidence: 'medium',
      title: t(`View ${name} bypasses the access rules of ${read.slice(0, 2).join(', ')}`, `View ${name} ignora as regras de acesso de ${read.slice(0, 2).join(', ')}`),
      detail: t(
        `The view public.${name} reads ${read.join(', ')} (protected by RLS) and was created without "security_invoker = true": it runs with the permissions of whoever created it, so the RLS of those tables does not apply to whoever queries the view.`,
        `A view public.${name} lê ${read.join(', ')} (com RLS) e foi criada sem "security_invoker = true": ela roda com as permissões de quem a criou, então a RLS dessas tabelas não vale para quem consulta a view.`,
      ),
      impact: t(
        `Whoever uses the app (with the public key) queries the view and gets the rows of every user, even though the table itself would refuse.`,
        `Quem usa o app (com a chave pública) consulta a view e recebe as linhas de todos os usuários, mesmo que a tabela em si recusasse.`,
      ),
      fix: t(
        `In a new migration: alter view public.${name} set (security_invoker = true); or, if only the server uses it, revoke all on public.${name} from anon, authenticated.`,
        `Numa nova migration: alter view public.${name} set (security_invoker = true); ou, se só o servidor usa, revoke all on public.${name} from anon, authenticated.`,
      ),
      file: v.file,
      line: v.line,
      snippet: `create view public.${name} as ${v.body}`.slice(0, 240),
      fingerprint: `database|view-without-security-invoker|${name}`,
    })
  }
  return out
}

// Permissão de escrita escrita à mão para o visitante sem login (anon). O trio "grant all … to anon, authenticated,
// service_role" é o padrão do Supabase (aparece em todo dump) e não conta.
function anonGrantFindings(tables, state) {
  const out = []
  const written = (acc) => {
    const privs = [...acc.anon].filter((p) => p === 'all' || WRITE.includes(p))
    const trio = acc.anon.has('all') && acc.authenticated.has('all') && acc.service_role.has('all')
    return trio ? [] : privs
  }
  const add = (name, privs, where) => {
    const tbl = tables.get(name)
    const view = state.views.get(name)
    // Tabela sem RLS já é o achado rls-disabled; view sem security_invoker, o view-without-security-invoker.
    if (name && ((tbl && !tbl.rls) || (view && !view.invoker))) return
    const target = name ? `public.${name}` : t('every table of the public schema', 'todas as tabelas do schema public')
    out.push({
      source: 'database',
      rule_id: 'grant-write-to-anon',
      severity: tbl || view ? 'low' : 'medium',
      confidence: 'medium',
      title: t(`Visitors without login were given write permission on ${name ?? 'the public schema'}`, `Visitante sem login recebeu permissão de escrita em ${name ?? 'todo o schema public'}`),
      detail: t(
        `A migration gives ${privs.join(', ')} on ${target} to the role anon (whoever opens the app without logging in). After that, only the RLS policies stand between a visitor and the data.`,
        `Uma migração dá ${privs.join(', ')} em ${target} para o papel anon (quem abre o app sem login). Depois disso, só as políticas de RLS ficam entre o visitante e os dados.`,
      ),
      impact: t(
        'One policy that is too open (or a table created later without RLS) and anyone with the public key writes, changes or deletes the data.',
        'Basta uma política aberta demais (ou uma tabela criada depois sem RLS) para qualquer pessoa com a chave pública gravar, alterar ou apagar os dados.',
      ),
      fix: t(
        `If visitors are not supposed to write there, in a new migration: revoke ${privs.includes('all') ? 'insert, update, delete, truncate' : privs.join(', ')} on ${name ? `public.${name}` : 'all tables in schema public'} from anon. If they are (a contact form), grant only insert and keep a policy that limits what goes in.`,
        `Se o visitante não deve gravar ali, numa nova migration: revoke ${privs.includes('all') ? 'insert, update, delete, truncate' : privs.join(', ')} on ${name ? `public.${name}` : 'all tables in schema public'} from anon. Se deve (um formulário de contato), dê só insert e mantenha uma política que limite o que entra.`,
      ),
      file: where?.file ?? null,
      line: where?.line ?? null,
      snippet: `grant ${privs.join(', ')} on ${name ? `public.${name}` : 'all tables in schema public'} to anon`,
      fingerprint: `database|grant-write-to-anon|${name ?? '*'}`,
    })
  }
  for (const [name, acc] of state.access) {
    const privs = written(acc)
    if (privs.length) add(name, privs, acc.at)
  }
  const all = written(state.schema)
  if (all.length) add(null, all, state.schema.at)
  return out
}

// Um comando SQL: atualiza o estado (tabelas, políticas, views, permissões, funções) ou devolve um achado (null se
// nenhum). \`state\` guarda o que só se sabe no fim, depois de todas as migrações.
function databaseStatement(stmt, rel, tables, fns, state = newState()) {
  const s = strip(stmt.text).replace(/\s+/g, ' ').trim()
  let m
  trackGrants(s, state, { file: rel, line: stmt.line })
  if ((m = s.match(/^create (?:unlogged )?table (?:if not exists )?([\w."]+)/i)) && !/ partition of /i.test(s)) {
    const t = tableName(m[1])
    if (t.schema === 'public') {
      const tbl = { file: rel, line: stmt.line, rls: false, cols: new Set(), cascade: new Map(), policies: new Map(), insertCols: null }
      tables.set(t.name, tbl)
      const open = s.indexOf('(', m[0].length)
      if (open !== -1) for (const def of splitTop(s.slice(open + 1, s.lastIndexOf(')')))) columnDef(def, tbl, t.name, rel, stmt.line, tables)
    }
  } else if ((m = s.match(/^alter table (?:if exists )?(?:only )?([\w."]+) (?!(?:enable|disable|force) row level security)(.*)$/i))) {
    const t = tableName(m[1])
    if (t.schema === 'public' && tables.has(t.name)) alterTable(m[2], tables.get(t.name), t.name, rel, stmt.line, tables)
  } else if ((m = s.match(/^alter table (?:if exists )?(?:only )?([\w."]+) (enable|disable|force) row level security/i))) {
    const t = tableName(m[1])
    if (t.schema === 'public' && tables.has(t.name)) tables.get(t.name).rls = m[2].toLowerCase() !== 'disable'
  } else if ((m = s.match(/^drop table (?:if exists )?([\w.", ]+)/i))) {
    for (const raw of m[1].split(',')) {
      const name = tableName(raw.trim().split(' ')[0]).name
      tables.delete(name)
      state.access.delete(name)
      for (const key of [...state.immediate.keys()]) if (key.startsWith(`database|rls-policy-always-true|${name}|`)) state.immediate.delete(key)
    }
  } else if ((m = s.match(/^create policy ("[^"]+"|\S+) on ([\w."]+)(.*)$/i))) {
    const t = tableName(m[2])
    if (t.schema === 'public') tables.get(t.name)?.policies.set(m[1].replace(/"/g, ''), { rest: m[3], file: rel, line: stmt.line })
    return policyFinding(m, rel, stmt)
  } else if ((m = s.match(/^drop policy (?:if exists )?("[^"]+"|\S+) on ([\w."]+)/i))) {
    const t = tableName(m[2])
    if (t.schema === 'public') tables.get(t.name)?.policies.delete(m[1].replace(/"/g, ''))
    // A política "true" que uma migração posterior apagou não é mais um problema.
    state.immediate.delete(`database|rls-policy-always-true|${t.name}|${m[1].replace(/"/g, '')}`)
  } else if ((m = s.match(/^alter policy ("[^"]+"|\S+) on ([\w."]+)/i))) {
    // Política alterada: a condição nova não é lida aqui, então ela fica desconhecida (sem achado).
    const t = tableName(m[2])
    if (t.schema === 'public') tables.get(t.name)?.policies.delete(m[1].replace(/"/g, ''))
    state.immediate.delete(`database|rls-policy-always-true|${t.name}|${m[1].replace(/"/g, '')}`)
  } else if ((m = s.match(/^create (?:or replace )?(?:temp(?:orary)? )?(?:recursive )?view ([\w."]+) ?(?:\([^)]*\) ?)?(?:with ?\(([^)]*)\) ?)?as (.*)$/i))) {
    // "create or replace view" sem "with (security_invoker…)" volta a view para o padrão (poder do dono).
    const v = tableName(m[1])
    if (v.schema === 'public') state.views.set(v.name, { file: rel, line: stmt.line, invoker: invokerOn(m[2] ?? ''), body: m[3] })
  } else if ((m = s.match(/^alter view (?:if exists )?([\w."]+) (set|reset) ?\(([^)]*)\)/i))) {
    const v = state.views.get(tableName(m[1]).name)
    if (v && /security_invoker/i.test(m[3])) v.invoker = m[2].toLowerCase() === 'set' && invokerOn(m[3])
  } else if ((m = s.match(/^drop view (?:if exists )?([\w.", ]+?)(?: cascade| restrict)?$/i))) {
    for (const raw of m[1].split(',')) state.views.delete(tableName(raw.trim()).name)
  } else if ((m = s.match(/^alter default privileges (?:for (?:role|user) [\w", ]+ )?(?:in schema ([\w", ]+) )?(grant|revoke) (?:execute|all(?: privileges)?) on (?:functions|routines) (?:to|from) ([\w", ]+)$/i))) {
    // Padrão do banco para as funções criadas daqui em diante (a regra do time: nascer fechada).
    if (!m[1] || /\bpublic\b/i.test(m[1])) {
      const grant = m[2].toLowerCase() === 'grant'
      if (/\banon\b/i.test(m[3])) state.defaults.anon = grant
      if (/\bauthenticated\b/i.test(m[3])) state.defaults.authenticated = grant
    }
  } else if ((m = s.match(/^(grant|revoke) (?:execute|all(?: privileges)?) on all (?:functions|routines) in schema ([\w", ]+) (?:to|from) ([\w", ]+)$/i))) {
    if (/\bpublic\b/i.test(m[2])) {
      const grant = m[1].toLowerCase() === 'grant'
      for (const fn of fns.values()) {
        if (!fn.exposed) continue
        if (/\banon\b/i.test(m[3])) fn.anon = grant
        if (/\bauthenticated\b/i.test(m[3])) fn.authenticated = grant
      }
    }
  } else if ((m = s.match(/^(grant|revoke) ((?:insert|all)(?: privileges)?)(?: \(([^)]*)\))?(?:, ?[\w ,()]+?)? on (?:table )?([\w."]+) (?:to|from) ([\w", ]+)$/i))) {
    // Insert por coluna: "revoke insert … ; grant insert (a, b) …" deixa o navegador gravar só essas colunas.
    const t = tableName(m[4])
    const tbl = t.schema === 'public' ? tables.get(t.name) : null
    if (tbl && /\b(authenticated|anon|public)\b/i.test(m[5])) {
      if (m[1].toLowerCase() === 'revoke') tbl.insertCols = new Set()
      else if (m[3]) tbl.insertCols = new Set([...(tbl.insertCols ?? []), ...m[3].split(',').map((c) => c.trim().replace(/"/g, '').toLowerCase())])
      else tbl.insertCols = null
    }
  } else if (/^do\b/i.test(s) && /\b(create|drop) policy\b/i.test(s)) {
    // Políticas montadas com format() num bloco "do": as das tabelas citadas aqui ficam desconhecidas.
    for (const [name, tbl] of tables) if (s.includes(`'${name}'`)) tbl.policies.clear()
  } else if (/^insert into storage\.buckets/i.test(s) && /\btrue\b/i.test(s)) return bucketFinding(s, rel, stmt)
  else if ((m = s.match(/^create (?:or replace )?function ([\w."]+)/i))) {
    // A última definição vale (uma migração nova com "create or replace" corrige a antiga).
    const name = fnKey(m[1])
    const definer = /security definer/i.test(s)
    // "create or replace" mantém as permissões que a função já tinha; função nova nasce com o padrão do banco.
    const prev = /^create or replace /i.test(s) ? fns.get(name) : null
    fns.set(name, {
      name,
      file: rel,
      line: stmt.line,
      snippet: s.slice(0, 240),
      trigger: /\breturns\s+(?:event_)?trigger\b/i.test(s),
      guards: definer ? nullGuards(stmt.text) : [],
      definer,
      // Só o schema public é servido pela API (funções de outros schemas não são chamadas pelo navegador).
      exposed: !name.includes('.'),
      checksCaller: CALLER_CHECK.test(functionBody(s)),
      anon: prev?.anon ?? state.defaults.anon,
      authenticated: prev?.authenticated ?? state.defaults.authenticated,
    })
    const pathKey = `database|security-definer-search-path|${name}`
    if (definer && !/set search_path/i.test(s)) return definerFinding(m, rel, stmt)
    // A definição nova (com search_path, ou sem security definer) corrige a antiga.
    state.immediate.delete(pathKey)
  } else if ((m = s.match(/^drop function (?:if exists )?([\s\S]+?)(?: cascade| restrict)?$/i))) {
    for (const n of functionNames(m[1])) {
      fns.delete(n)
      state.immediate.delete(`database|security-definer-search-path|${n}`)
    }
  } else if ((m = s.match(/^(grant|revoke) (?:execute|all(?: privileges)?) on (?:function|routine|procedure) ([\s\S]+?) (?:to|from) ([\w", ]+?)(?: cascade| restrict)?$/i))) {
    const roles = m[3].toLowerCase()
    const grant = m[1].toLowerCase() === 'grant'
    for (const n of functionNames(m[2])) {
      const fn = fns.get(n)
      if (!fn) continue
      if (/\banon\b/.test(roles)) fn.anon = grant
      if (/\bauthenticated\b/.test(roles)) fn.authenticated = grant
    }
  }
  return null
}

// Achados das funções na última definição: a comparação com papel NULL vale para quem pode chamar (logado ou
// gatilho); a de "sem login" só quando a função ficou aberta para anon.
function functionFindings(fns) {
  const out = []
  for (const fn of fns.values()) {
    const callable = fn.trigger || fn.anon || fn.authenticated
    const guards = fn.guards.filter((g) => (g.kind === 'uid' ? !fn.trigger && fn.anon : callable))
    if (guards.length) out.push(nullGuardFinding({ ...fn, guards }))
    // Regra do time: função com poder total aberta para quem usa o app confere quem chama, ou fica só para o servidor.
    if (fn.definer && fn.exposed && !fn.trigger && !fn.checksCaller && (fn.anon || fn.authenticated)) out.push(openDefinerFinding(fn))
  }
  return out
}

export function scanDatabase(root, files) {
  const sqlFiles = files.filter((f) => /(^|\/)supabase\/.*\.sql$/i.test(f)).sort()
  const tables = new Map() // public.nome → { file, line, rls }
  const fns = new Map() // nome da função → última definição
  const state = newState()
  for (const rel of sqlFiles) {
    const text = readText(root, rel)
    if (!text) continue
    for (const stmt of splitSql(text)) {
      const f = databaseStatement(stmt, rel, tables, fns, state)
      // Achado de um comando: fica até uma migração posterior desfazer (drop policy, create or replace function…).
      if (f) state.immediate.set(f.fingerprint, f)
    }
  }
  const findings = [...state.immediate.values()]
  for (const [name, t] of tables) if (!t.rls) findings.push(rlsDisabledFinding(name, t))
  findings.push(...functionFindings(fns), ...cascadeOwnerFindings(tables), ...authorInsertFindings(tables))
  findings.push(...policyStateFindings(tables, state), ...viewFindings(tables, state), ...anonGrantFindings(tables, state))
  return { findings, tables: tables.size, files: sqlFiles.length }
}
