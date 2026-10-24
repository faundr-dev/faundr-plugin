// Guarda de comandos perigosos: antes de o agente rodar um comando (terminal ou SQL), diz se ele pode apagar
// trabalho ou dados. Sem rede e sem abrir processos: roda em todo comando.
//
//   deny: catástrofe sem volta (apagar a pasta pessoal, o disco). O agente não roda; quem quiser roda na mão.
//   ask:  apaga ou sobrescreve algo, mas há casos legítimos. O Claude Code pergunta ao usuário antes.
//
// `files: true` quando o risco é nos arquivos: antes de perguntar, o Faundr tira um ponto de volta.

import os from 'node:os'
import path from 'node:path'

// Programas que só leem ou escrevem texto: "drop table" dentro deles é busca, mensagem de commit ou arquivo novo.
const TEXT_PROGRAMS = new Set(['grep', 'egrep', 'rg', 'ag', 'ack', 'findstr', 'select-string', 'sls', 'git', 'echo', 'printf', 'cat', 'type', 'sed', 'awk', 'head', 'tail', 'less', 'more', 'get-content', 'gc', 'write-output', 'write-host', 'tee', 'out-file', 'set-content', 'gh'])

const SQL_RULES = [
  { re: /\bdrop\s+(table|database|schema|view|materialized\s+view)\b/i, what: 'deletes a table, database or database structure (DROP)' },
  { re: /\btruncate\s+(table\s+)?["\w.]+/i, what: 'deletes every row of a table (TRUNCATE)' },
  { re: /\bdelete\s+from\s+["\w.]+(?![^;]*\bwhere\b)/i, what: 'deletes every row of a table (DELETE without WHERE)' },
  { re: /\balter\s+table\b[^;]*\bdrop\s+(column|constraint)\b/i, what: 'deletes a column or constraint of a table (ALTER TABLE … DROP)' },
  { re: /\bupdate\s+["\w.]+\s+set\b(?![^;]*\bwhere\b)/i, what: 'changes every row of a table (UPDATE without WHERE)' },
]

const DB_COMMANDS = [
  { re: /\bsupabase\s+db\s+reset\b.*--linked\b/i, level: 'deny', what: 'deletes and recreates the Supabase database linked to the project (usually production)' },
  { re: /\bsupabase\s+db\s+reset\b/i, what: 'deletes and recreates the local Supabase database (local data is lost)' },
  { re: /\bsupabase\s+db\s+push\b/i, what: 'applies the migrations to the remote Supabase database (usually production)' },
  { re: /\bsupabase\s+migration\s+(up|repair)\b.*--linked\b/i, what: 'changes the migrations of the remote Supabase database (usually production)' },
  { re: /\bprisma\s+migrate\s+reset\b/i, what: 'deletes and recreates the database (prisma migrate reset)' },
  { re: /\bprisma\s+db\s+push\b.*--(force-reset|accept-data-loss)\b/i, what: 'changes the database accepting data loss (prisma db push)' },
  { re: /\bprisma\s+migrate\s+deploy\b/i, what: 'applies the migrations to the DATABASE_URL database (may be production)' },
  { re: /\bdrizzle-kit\s+(push|drop)\b/i, what: 'changes the database directly through drizzle-kit (may delete columns and data)' },
  { re: /\b(rails|rake)\s+db:(drop|reset|schema:load)\b/i, what: 'deletes or recreates the database' },
  { re: /\bdropdb\b/i, what: 'deletes a whole database (dropdb)' },
  { re: /\bredis-cli\b.*\bflush(all|db)\b/i, what: 'deletes all Redis data' },
  { re: /\bfirebase\s+(firestore:delete|database:remove)\b/i, what: 'deletes Firebase data' },
  { re: /\bheroku\s+pg:reset\b/i, what: 'deletes the Heroku database' },
  { re: /\bwrangler\s+d1\s+execute\b.*--remote\b/i, sqlOnly: true },
]

const GIT_RULES = [
  { re: /\bpush\b.*(\s--force(-with-lease)?\b|\s-f\b|\s-[a-z]*f[a-z]*\b|\s\+[\w/.-]+)/i, what: 'overwrites the history on GitHub (git push --force); other people\'s commits may be lost' },
  { re: /\breset\s+.*--hard\b|\breset\s+--hard\b/i, what: 'discards the changes not committed yet (git reset --hard)', files: true },
  { re: /\bclean\s+-[a-z]*f/i, what: 'deletes the new files not in git yet (git clean)', files: true },
  { re: /\b(checkout|restore)\s+(--\s+)?\.(\s|$)/i, unless: /\brestore\b(?=.*--staged)(?!.*--worktree)/i, what: 'discards the changes not committed yet', files: true },
  { re: /\bcheckout\s+(-f|--force)\b/i, what: 'switches branch discarding the uncommitted changes', files: true },
  { re: /\bstash\s+(drop|clear)\b/i, what: 'deletes changes saved in the stash' },
  { re: /\bbranch\s+(-D\b|--delete\s+--force\b|-d\s+-f\b)/, what: 'deletes a branch even with commits that are not in another one' },
  { re: /\b(filter-branch|filter-repo)\b/i, what: 'rewrites the whole git history' },
]

const HEREDOC = /(<<-?\s*(['"]?)(\w+)\2[^\n]*)\n[\s\S]*?\n\s*\3[ \t]*(?=\n|$)/g

const strip = (t) => t.replace(/^["']|["']$/g, '')

// Divide em comandos simples (;, &&, ||, |, quebra de linha) e devolve [programa, palavras].
export function segments(command) {
  return command
    .split(/\|\||&&|[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const words = s.match(/"[^"]*"|'[^']*'|\S+/g)?.map(strip) ?? []
      while (words.length && (/^\w+=/.test(words[0]) || ['sudo', 'env', 'command', 'exec', 'time', 'nohup', '&', '.'].includes(words[0]))) words.shift()
      const program = path.basename(words[0] ?? '').toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '')
      return { text: s, program, words: words.slice(1) }
    })
}

// /c/Users → C:/Users; barras para a frente; sem barra no fim.
function norm(p) {
  let s = p.replace(/\\/g, '/')
  const m = s.match(/^\/([a-z])(\/|$)/i)
  if (m && process.platform === 'win32') s = `${m[1].toUpperCase()}:/${s.slice(3)}`
  if (/^[a-z]:/.test(s)) s = s[0].toUpperCase() + s.slice(1)
  return s.length > 1 ? s.replace(/\/+$/, '') : s
}

const HOME_TARGETS = /^(~|~\/\*?|\$home|\$\{home\}|\$env:userprofile|%userprofile%)$/i

// Alvo de uma remoção recursiva: 'catastrophe' (raiz, disco, pasta pessoal, tudo), 'outside' (fora do projeto) ou null.
function removalRisk(target, cwd) {
  const t = norm(strip(target))
  if (!t) return null
  if (['/', '/*', '*', '.', './*', '..', '../*', '.*'].includes(t) || HOME_TARGETS.test(t) || /^[A-Z]:\/?\*?$/i.test(t)) return 'catastrophe'
  const home = norm(os.homedir())
  if (t.toLowerCase() === home.toLowerCase() || t.toLowerCase() === `${home}/*`.toLowerCase()) return 'catastrophe'
  if (/^(\/|[A-Z]:\/)(users|home|windows|program files|etc|usr|var|bin|system32)\/?$/i.test(t)) return 'catastrophe'
  const absolute = /^(\/|[A-Z]:\/|~)/i.test(t)
  if (!absolute && !t.startsWith('..')) return null
  const tmp = [norm(os.tmpdir()), '/tmp', '/var/tmp'].map((d) => d.toLowerCase())
  const full = absolute ? t.replace(/^~/, home) : norm(path.resolve(cwd ?? '.', t))
  const lower = full.toLowerCase()
  if (tmp.some((d) => lower.startsWith(`${d}/`)) || /\/(appdata\/local\/)?temp\//i.test(lower)) return null
  const base = cwd ? norm(path.resolve(cwd)).toLowerCase() : null
  if (base && (lower === base || lower.startsWith(`${base}/`))) return lower === base ? 'catastrophe' : null
  return 'outside'
}

const REMOVE_PROGRAMS = new Set(['rm', 'rmdir', 'rd', 'remove-item', 'ri', 'del', 'erase'])
const WINDOWS_REMOVE = new Set(['rd', 'rmdir', 'del', 'erase'])

// Opções de um comando de apagar: se é recursivo e quais caminhos ele recebe.
function removalArgs(program, words) {
  const windowsStyle = WINDOWS_REMOVE.has(program)
  let recursive = false
  const targets = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (windowsStyle && /^\/[a-z]$/i.test(w)) {
      if (/^\/s$/i.test(w)) recursive = true
      continue
    }
    if (/^--?recurse$|^-recurse$|^--recursive$/i.test(w)) recursive = true
    else if (/^-[a-zA-Z]+$/.test(w) && program === 'rm') recursive ||= /r/i.test(w)
    else if (/^-(path|literalpath)$/i.test(w)) targets.push(words[++i] ?? '')
    else if (!w.startsWith('-')) targets.push(w)
  }
  return { recursive, targets }
}

function removal(seg, cwd) {
  const { program, words } = seg
  if (!REMOVE_PROGRAMS.has(program)) return null
  const { recursive, targets } = removalArgs(program, words)
  if (!recursive) return null
  const risks = targets.map((t) => [t, removalRisk(t, cwd)]).filter(([, r]) => r)
  const worst = risks.find(([, r]) => r === 'catastrophe') ?? risks[0]
  if (!worst) return null
  return worst[1] === 'catastrophe'
    ? { level: 'deny', what: `deletes the whole ${worst[0]}, with everything in it`, files: true }
    : { level: 'ask', what: `deletes the folder ${worst[0]}, which is outside the project`, files: false }
}

const DISK = /\bmkfs(\.\w+)?\b|\bdd\b.*\bof=\/dev\/(sd|nvme|disk|hd)|\bformat\s+[a-z]:|\bdiskpart\b|\bclear-disk\b|\bformat-volume\b/i

/**
 * Classifica um comando do terminal (Bash/PowerShell) ou um SQL (`sql: true`, de ferramentas MCP de banco).
 * Devolve null (seguro) ou { level: 'deny'|'ask', what, files }.
 */
export function classifyCommand(command, { cwd, sql = false } = {}) {
  if (!command || typeof command !== 'string') return null
  if (sql) {
    const hit = SQL_RULES.find((r) => r.re.test(command))
    return hit ? { level: 'ask', what: hit.what, files: false, database: true } : null
  }
  if (DISK.test(command)) return { level: 'deny', what: 'formats or overwrites a whole disk', files: false }
  // O corpo de um heredoc (cat > a.sql <<EOF … EOF) é texto do comando dele, não outros comandos.
  const segs = segments(command.replace(HEREDOC, '$1'))
  let found = null
  const keep = (r) => {
    if (!r) return
    if (!found || (r.level === 'deny' && found.level !== 'deny')) found = r
  }
  for (const seg of segs) {
    // Voltar para um ponto de volta troca arquivos: o usuário confirma no terminal, vendo o que muda.
    const restore = !TEXT_PROGRAMS.has(seg.program) && seg.text.match(/\bfaundr(?:\.mjs)?["']?\s+restore\s+["']?([\w#.-]+).*\s--yes\b/i)
    if (restore) keep({ level: 'ask', what: 'restores the files to a restore point', files: false, restore: restore[1] })
    keep(removal(seg, cwd))
    if (seg.program === 'git') {
      const rest = seg.words.join(' ')
      const hit = GIT_RULES.find((r) => r.re.test(` ${rest}`) && !(r.unless && r.unless.test(seg.text)))
      if (hit) keep({ level: 'ask', what: hit.what, files: !!hit.files })
    }
  }
  // Banco: comandos de CLI e SQL dentro do comando (psql -c, heredoc, node -e …), a menos que o comando só mexa
  // com texto (busca, echo, mensagem de commit, arquivo novo).
  const onlyText = segs.every((s) => TEXT_PROGRAMS.has(s.program))
  if (!onlyText) {
    for (const r of DB_COMMANDS) {
      if (r.sqlOnly || !r.re.test(command)) continue
      keep({ level: r.level ?? 'ask', what: r.what, files: false, database: true })
    }
    const hit = SQL_RULES.find((r) => r.re.test(command))
    if (hit) keep({ level: 'ask', what: hit.what, files: false, database: true })
  }
  return found
}

// Comandos que com certeza só leem: não precisam de ponto de volta antes.
const READ_ONLY = new Set(['ls', 'dir', 'cat', 'type', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'rg', 'ag', 'findstr', 'pwd', 'echo', 'printf', 'wc', 'which', 'where', 'whoami', 'date', 'env', 'printenv', 'tree', 'stat', 'file', 'du', 'df', 'get-childitem', 'gci', 'get-content', 'gc', 'select-string', 'sls', 'get-location', 'test-path', 'get-item', 'get-command', 'write-output', 'write-host', 'jq', 'diff', 'cmp', 'sort', 'uniq', 'cut', 'basename', 'dirname', 'realpath', 'readlink', 'true', 'false', 'test', '[', 'sleep', 'cd', 'ps', 'tasklist'])
const READ_ONLY_GIT = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'ls-files', 'blame', 'remote', 'config', 'describe', 'shortlog', 'grep', 'ls-tree', 'cat-file', 'for-each-ref', 'reflog', 'fetch', 'version'])

export function isReadOnly(command) {
  const segs = segments(command ?? '')
  if (!segs.length) return true
  if (/(^|[^>])>{1,2}(?!&)\s*[^\s&]/.test(command.replace(/2>&1|>\s*\/dev\/null|>\s*nul\b|\$null/gi, ''))) return false
  return segs.every((s) => {
    if (s.program === 'git') {
      const sub = s.words.find((w) => !w.startsWith('-') && !/^-C$/i.test(w))
      return READ_ONLY_GIT.has(sub) || (sub === 'branch' && s.words.length <= 1) || (sub === 'stash' && s.words.includes('list'))
    }
    if (s.program === 'sed') return !s.words.some((w) => /^-[a-z]*i/.test(w) || w === '--in-place')
    if (s.program === 'find') return !s.words.some((w) => /^-(delete|exec|execdir|ok)$/.test(w))
    if (['node', 'npm', 'npx', 'python', 'python3', 'pnpm', 'yarn', 'bun'].includes(s.program)) return s.words.length === 1 && /^(-v|--version|ls|list|view)$/.test(s.words[0])
    return READ_ONLY.has(s.program)
  })
}

// Texto que o Claude Code mostra ao usuário (ask) ou ao agente (deny).
export function guardMessage(verdict, { command, checkpoint, note } = {}) {
  const shown = command && command.length > 160 ? `${command.slice(0, 157)}…` : command
  const saved = checkpoint ? ` Faundr saved a restore point of the files first (to undo: /faundr:undo).` : ''
  const where = note ? ` ${note}` : ''
  const db = verdict.database ? ' Faundr restore points keep only the files, not the database data: check that there is a backup.' : ''
  if (verdict.level === 'deny')
    return `[Faundr] Blocked: this command ${verdict.what}${shown ? ` (${shown})` : ''}. This cannot be undone. Do not try another way to do the same thing: explain to the user what you wanted to do and, if they really want it, they run it themselves in the terminal.${where}${db}`
  return `[Faundr] Warning: this command ${verdict.what}.${where} Approve only if this is really what you want.${saved}${db}`
}
