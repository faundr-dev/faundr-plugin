// Para onde o banco do ambiente local aponta. O caso do Replit (o agente apagou o banco de produção) começa
// quando o .env do computador aponta para o banco de verdade: migração, seed e script de teste mexem nos dados reais.
//
// Lê só os .env locais e, deles, só o servidor (host) das variáveis de banco; os valores nunca saem daqui.

import fs from 'node:fs'
import path from 'node:path'

// .env usados no computador (o .env.production é o do app no ar).
const LOCAL_ENV = ['.env', '.env.local', '.env.development', '.env.development.local', '.dev.vars']
const PROD_ENV = ['.env.production', '.env.production.local', '.env.prod']
const PROD_CONFIG = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml', 'vercel.json', 'netlify.toml', 'fly.toml', 'render.yaml', 'railway.json', 'app.yaml']
const DB_VAR = /^(?:export\s+)?((?:[A-Z0-9]+_)*(?:DATABASE|DB|POSTGRES|PG|MYSQL|MONGO(?:DB)?|REDIS|TURSO|SUPABASE|NEON|PLANETSCALE)(?:_[A-Z0-9]+)*_(?:URL|URI|HOST|DSN|CONNECTION_STRING)|PGHOST)\s*=\s*(.*)$/

function hostOf(value) {
  const v = value.trim().replace(/^["']|["']$/g, '')
  if (!v || /^(file:|\.|\/|[a-z]:\\)/i.test(v) || /\.(db|sqlite3?)$/i.test(v)) return { host: null, local: true }
  const m = v.match(/^[a-z][\w+.-]*:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/?#,]+)/i)
  const host = (m ? m[1] : v.split(/[:/]/)[0]).toLowerCase()
  if (!host || host.includes('${') || host.includes('<')) return null
  const local = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|::1|host\.docker\.internal)$/.test(host) || host.endsWith('.local') || !host.includes('.')
  return { host, local }
}

function readVars(root, files) {
  const out = []
  for (const file of files) {
    let text
    try {
      text = fs.readFileSync(path.join(root, file), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(DB_VAR)
      if (!m) continue
      const h = hostOf(m[2])
      if (h?.host || h?.local) out.push({ file, name: m[1], ...h })
    }
  }
  return out
}

/**
 * Bancos do ambiente local que ficam na nuvem: [{ file, name, host, sameAsProduction }].
 * sameAsProduction: o mesmo servidor aparece no .env de produção ou na configuração do deploy.
 */
export function remoteDatabases(root) {
  const remote = readVars(root, LOCAL_ENV).filter((v) => !v.local)
  if (!remote.length) return []
  const prod = new Set(readVars(root, PROD_ENV).map((v) => v.host))
  let config = ''
  for (const f of PROD_CONFIG) {
    try {
      config += fs.readFileSync(path.join(root, f), 'utf8').toLowerCase()
    } catch {}
  }
  const seen = new Set()
  return remote
    .filter((v) => !seen.has(v.host) && seen.add(v.host))
    .map((v) => ({ file: v.file, name: v.name, host: v.host, sameAsProduction: prod.has(v.host) || config.includes(v.host) }))
}

// Comandos que mudam o banco (migração, seed, reset) e que são normais contra um banco local.
const DB_CHANGE = [
  /\bprisma\s+(migrate\s+(dev|deploy|resolve)|db\s+(push|seed|execute))\b/i,
  /\bdrizzle-kit\s+(migrate|push)\b/i,
  /\bsupabase\s+(migration\s+up|db\s+push|seed)\b/i,
  /\b(knex|sequelize(-cli)?)\s+(migrate|seed|db:migrate|db:seed)/i,
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(db:[\w:-]+|migrat[\w:-]*|seed[\w:-]*)\b/i,
  /\balembic\s+(upgrade|downgrade)\b/i,
  /\bmanage\.py\s+(migrate|flush|loaddata)\b/i,
  /\b(rails|rake)\s+db:(migrate|seed|rollback)\b/i,
  /\b(node|tsx|ts-node|bun|deno|python3?)\s+\S*(seed|migrat)\w*/i,
]

export const changesDatabase = (command) => DB_CHANGE.some((re) => re.test(command ?? ''))

/** Frase sobre o banco da nuvem para juntar aos avisos (ou null se o ambiente local usa banco local). */
export function remoteNote(dbs) {
  if (!dbs.length) return null
  const d = dbs.find((x) => x.sameAsProduction) ?? dbs[0]
  return d.sameAsProduction
    ? `O ${d.file} deste computador aponta para ${d.host}, o mesmo banco do app no ar: isso mexe nos dados reais dos usuários.`
    : `O ${d.file} deste computador aponta para um banco na nuvem (${d.host}); se for o banco do app no ar, isso mexe nos dados reais dos usuários.`
}

/** Achado de segurança (painel): o ambiente local usa um banco na nuvem. */
export function remoteDatabaseFindings(root) {
  return remoteDatabases(root).map((d) => ({
    source: 'config',
    rule_id: 'local-env-remote-db',
    severity: d.sameAsProduction ? 'high' : 'medium',
    confidence: d.sameAsProduction ? 'high' : 'medium',
    title: d.sameAsProduction ? `O ambiente local usa o banco de produção (${d.host})` : `O ambiente local usa um banco na nuvem (${d.host})`,
    detail: `A variável ${d.name}, no ${d.file}, aponta para ${d.host}${d.sameAsProduction ? ', o mesmo banco do app no ar' : ''}. Tudo o que o agente roda no seu computador (migrações, seed, testes, scripts) vai para esse banco.`,
    impact: 'Um erro do agente (apagar uma tabela, rodar uma migração errada, um teste que limpa dados) atinge os dados reais dos usuários, e o ponto de volta do Faundr não guarda o banco.',
    fix: 'Use um banco só para desenvolvimento: no Supabase, "supabase start" sobe um banco local (ou crie um segundo projeto para testes) e ponha o endereço dele no .env; deixe o endereço de produção só na hospedagem. Até lá, confira se há backup automático do banco de produção.',
    file: d.file,
    line: null,
    snippet: null,
    fingerprint: `config|local-env-remote-db|${d.host}`,
  }))
}
