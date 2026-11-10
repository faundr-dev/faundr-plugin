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

// Um comando SQL: atualiza o mapa de tabelas (criada, RLS ligado, apagada) ou devolve um achado (null se nenhum).
function databaseStatement(stmt, rel, tables, fns) {
  const s = strip(stmt.text).replace(/\s+/g, ' ').trim()
  let m
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
    for (const raw of m[1].split(',')) tables.delete(tableName(raw.trim().split(' ')[0]).name)
  } else if ((m = s.match(/^create policy ("[^"]+"|\S+) on ([\w."]+)(.*)$/i))) {
    const t = tableName(m[2])
    if (t.schema === 'public') tables.get(t.name)?.policies.set(m[1].replace(/"/g, ''), { rest: m[3], file: rel, line: stmt.line })
    return policyFinding(m, rel, stmt)
  } else if ((m = s.match(/^drop policy (?:if exists )?("[^"]+"|\S+) on ([\w."]+)/i))) {
    const t = tableName(m[2])
    if (t.schema === 'public') tables.get(t.name)?.policies.delete(m[1].replace(/"/g, ''))
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
    fns.set(name, {
      name,
      file: rel,
      line: stmt.line,
      snippet: s.slice(0, 240),
      trigger: /\breturns\s+trigger\b/i.test(s),
      guards: definer ? nullGuards(stmt.text) : [],
      anon: true,
      authenticated: true,
    })
    if (definer && !/set search_path/i.test(s)) return definerFinding(m, rel, stmt)
  } else if ((m = s.match(/^drop function (?:if exists )?([\s\S]+?)(?: cascade| restrict)?$/i))) {
    for (const n of functionNames(m[1])) fns.delete(n)
  } else if ((m = s.match(/^(grant|revoke) execute on function ([\s\S]+?) (?:to|from) ([\w", ]+)$/i))) {
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
  }
  return out
}

export function scanDatabase(root, files) {
  const sqlFiles = files.filter((f) => /(^|\/)supabase\/.*\.sql$/i.test(f)).sort()
  const tables = new Map() // public.nome → { file, line, rls }
  const fns = new Map() // nome da função → última definição
  const findings = []
  for (const rel of sqlFiles) {
    const text = readText(root, rel)
    if (!text) continue
    for (const stmt of splitSql(text)) {
      const f = databaseStatement(stmt, rel, tables, fns)
      if (f) findings.push(f)
    }
  }
  for (const [name, t] of tables) if (!t.rls) findings.push(rlsDisabledFinding(name, t))
  findings.push(...functionFindings(fns), ...cascadeOwnerFindings(tables), ...authorInsertFindings(tables))
  return { findings, tables: tables.size, files: sqlFiles.length }
}
