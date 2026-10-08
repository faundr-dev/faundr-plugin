// Desempenho: o que deixa o app lento quando os dados crescem. Com 10 linhas no banco tudo é rápido; com 100 mil,
// a lista sem limite trava a tela, a consulta dentro de um laço vira 100 idas ao banco e a chave estrangeira
// sem índice faz o banco ler a tabela inteira a cada busca.

// Consulta do Supabase que traz uma lista inteira (sem .limit/.range/.single e sem filtro por id).
const SUPA_FROM = /\.from\(\s*['"`]([\w.]+)['"`]\s*\)/g
const BOUNDED = /\.(limit|range|single|maybeSingle|csv|explain)\s*\(|head\s*:\s*true|\.eq\(\s*['"`](id|uuid|slug|user_id|project_id)['"`]|\.(insert|update|upsert|delete)\s*\(|\.in\(\s*['"`]id['"`]/
// Prisma: findMany sem take.
const PRISMA_MANY = /\.findMany\(\s*(\{[\s\S]{0,400}?\})?\s*\)/g

const lineAt = (text, index) => text.slice(0, index).split('\n').length

/** Fim aproximado do comando: o primeiro ";" ou linha em branco depois do índice (no máximo 600 caracteres). */
function statementAt(text, index) {
  const rest = text.slice(index, index + 600)
  const end = rest.search(/;|\n\s*\n/)
  return end === -1 ? rest : rest.slice(0, end)
}

export function unboundedQueries(rel, text) {
  const out = []
  for (const m of text.matchAll(SUPA_FROM)) {
    const stmt = statementAt(text, m.index)
    if (!/\.select\s*\(/.test(stmt) || BOUNDED.test(stmt)) continue
    out.push({ line: lineAt(text, m.index), table: m[1] })
  }
  for (const m of text.matchAll(PRISMA_MANY)) {
    if (/\btake\s*:/.test(m[1] ?? '')) continue
    out.push({ line: lineAt(text, m.index), table: text.slice(Math.max(0, m.index - 40), m.index).match(/(\w+)\s*$/)?.[1] ?? 'tabela' })
  }
  return out
}

// Consulta dentro de laço: for/forEach/map com await de banco ou fetch dentro (o famoso N+1).
const LOOP = /\bfor\s*\(|\bfor\s+\w+\s+in\b|\.forEach\(\s*async|\.map\(\s*async/g
const DB_CALL = /await\s+[\w.]*\.(from\(|rpc\(|findUnique\(|findFirst\(|findMany\(|query\(|execute\()|await\s+fetch\(/

export function queriesInLoops(rel, text) {
  const out = []
  for (const m of text.matchAll(LOOP)) {
    // Corpo do laço: até fechar a chave que abre depois do cabeçalho (no máximo 1500 caracteres).
    const open = text.indexOf('{', m.index)
    if (open === -1 || open - m.index > 200) continue
    // Laço em lotes (i += 300) é a correção do N+1, não o problema.
    if (/\+=\s*(\d{2,}|[A-Z_]{3,})/.test(text.slice(m.index, open))) continue
    let depth = 0
    let end = open
    for (; end < Math.min(text.length, open + 1500); end++) {
      if (text[end] === '{') depth++
      else if (text[end] === '}' && --depth === 0) break
    }
    const body = text.slice(open, end)
    const hit = body.match(DB_CALL)
    if (!hit) continue
    // Promise.all em volta do map é paralelo de propósito (continua sendo N chamadas, mas não em fila).
    if (/Promise\.all(Settled)?\(\s*[\w.]*$/.test(text.slice(Math.max(0, m.index - 60), m.index).trimEnd().replace(/\.map$/, '')) && m[0].startsWith('.map')) continue
    out.push({ line: lineAt(text, open + body.indexOf(hit[0])) })
  }
  return out
}

// ---- Chave estrangeira sem índice (migrações SQL) -----------------------------------------------------------

const strip = (sql) => sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const ident = (s) => s.replace(/"/g, '').replace(/^public\./, '').toLowerCase()

/**
 * Colunas com references sem um índice que comece por elas (nem primary key/unique que comece por elas).
 * migrations: [{ file, sql }] em ordem. Devolve [{ file, line, table, column }].
 */
export function foreignKeysWithoutIndex(migrations) {
  const fks = new Map() // "tabela.coluna" -> { file, line, table, column }
  const indexed = new Set()
  for (const { file, sql: raw } of migrations) {
    const sql = strip(raw)
    // create table x ( ... ): colunas com references e chaves compostas.
    for (const t of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(([\s\S]*?)\n\)\s*;/gi)) {
      const table = ident(t[1])
      const body = t[2]
      for (const c of body.matchAll(/^\s*"?(\w+)"?\s+[\w\s()]*?\breferences\b/gim)) {
        const column = c[1].toLowerCase()
        if (['constraint', 'foreign', 'primary', 'unique', 'check'].includes(column)) continue
        fks.set(`${table}.${column}`, { file, line: lineOfIn(raw, t.index + t[0].indexOf(c[0])), table, column })
        if (new RegExp(`^\\s*"?${column}"?\\s+[^,]*\\b(primary\\s+key|unique)\\b`, 'im').test(c[0] + body.slice(c.index, body.indexOf('\n', c.index + 1)))) indexed.add(`${table}.${column}`)
      }
      for (const k of body.matchAll(/foreign\s+key\s*\(\s*"?(\w+)"?/gi)) fks.set(`${table}.${k[1].toLowerCase()}`, { file, line: lineOfIn(raw, t.index), table, column: k[1].toLowerCase() })
      for (const k of body.matchAll(/(?:primary\s+key|unique)\s*\(\s*"?(\w+)"?/gi)) indexed.add(`${table}.${k[1].toLowerCase()}`)
    }
    // alter table x add column y ... references
    for (const a of sql.matchAll(/alter\s+table\s+(?:only\s+)?([\w."]+)([\s\S]*?);/gi)) {
      const table = ident(a[1])
      for (const c of a[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?\s+[^,]*?\breferences\b/gi))
        fks.set(`${table}.${c[1].toLowerCase()}`, { file, line: lineOfIn(raw, a.index), table, column: c[1].toLowerCase() })
      for (const k of a[2].matchAll(/foreign\s+key\s*\(\s*"?(\w+)"?/gi)) fks.set(`${table}.${k[1].toLowerCase()}`, { file, line: lineOfIn(raw, a.index), table, column: k[1].toLowerCase() })
      for (const k of a[2].matchAll(/(?:primary\s+key|unique)\s*\(\s*"?(\w+)"?/gi)) indexed.add(`${table}.${k[1].toLowerCase()}`)
    }
    // create [unique] index ... on x [using btree] (y, ...)
    for (const i of sql.matchAll(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?[\w"]*\s*on\s+(?:only\s+)?([\w."]+)\s*(?:using\s+\w+\s*)?\(\s*"?(\w+)"?/gi))
      indexed.add(`${ident(i[1])}.${i[2].toLowerCase()}`)
    for (const d of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([\w."]+)/gi)) {
      const table = ident(d[1])
      for (const k of [...fks.keys()]) if (k.startsWith(`${table}.`)) fks.delete(k)
    }
  }
  return [...fks.entries()].filter(([k]) => !indexed.has(k)).map(([, v]) => v)
}

function lineOfIn(text, index) {
  return text.slice(0, Math.max(0, index)).split('\n').length
}
