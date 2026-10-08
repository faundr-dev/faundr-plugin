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
  { re: /\bdrop\s+(table|database|schema|view|materialized\s+view)\b/i, what: 'apaga uma tabela, banco ou estrutura do banco (DROP)' },
  { re: /\btruncate\s+(table\s+)?["\w.]+/i, what: 'apaga todas as linhas de uma tabela (TRUNCATE)' },
  { re: /\bdelete\s+from\s+["\w.]+(?![^;]*\bwhere\b)/i, what: 'apaga todas as linhas de uma tabela (DELETE sem WHERE)' },
  { re: /\balter\s+table\b[^;]*\bdrop\s+(column|constraint)\b/i, what: 'apaga uma coluna ou regra de uma tabela (ALTER TABLE … DROP)' },
  { re: /\bupdate\s+["\w.]+\s+set\b(?![^;]*\bwhere\b)/i, what: 'muda todas as linhas de uma tabela (UPDATE sem WHERE)' },
]

const DB_COMMANDS = [
  { re: /\bsupabase\s+db\s+reset\b.*--linked\b/i, level: 'deny', what: 'apaga e recria o banco do Supabase ligado ao projeto (normalmente o de produção)' },
  { re: /\bsupabase\s+db\s+reset\b/i, what: 'apaga e recria o banco local do Supabase (os dados locais somem)' },
  { re: /\bsupabase\s+db\s+push\b/i, what: 'aplica as migrações no banco remoto do Supabase (normalmente o de produção)' },
  { re: /\bsupabase\s+migration\s+(up|repair)\b.*--linked\b/i, what: 'mexe nas migrações do banco remoto do Supabase (normalmente o de produção)' },
  { re: /\bprisma\s+migrate\s+reset\b/i, what: 'apaga e recria o banco (prisma migrate reset)' },
  { re: /\bprisma\s+db\s+push\b.*--(force-reset|accept-data-loss)\b/i, what: 'muda o banco aceitando perder dados (prisma db push)' },
  { re: /\bprisma\s+migrate\s+deploy\b/i, what: 'aplica as migrações no banco do DATABASE_URL (pode ser o de produção)' },
  { re: /\bdrizzle-kit\s+(push|drop)\b/i, what: 'muda o banco direto pelo drizzle-kit (pode apagar colunas e dados)' },
  { re: /\b(rails|rake)\s+db:(drop|reset|schema:load)\b/i, what: 'apaga ou recria o banco' },
  { re: /\bdropdb\b/i, what: 'apaga um banco inteiro (dropdb)' },
  { re: /\bredis-cli\b.*\bflush(all|db)\b/i, what: 'apaga todos os dados do Redis' },
  { re: /\bfirebase\s+(firestore:delete|database:remove)\b/i, what: 'apaga dados do Firebase' },
  { re: /\bheroku\s+pg:reset\b/i, what: 'apaga o banco do Heroku' },
  { re: /\bwrangler\s+d1\s+execute\b.*--remote\b/i, sqlOnly: true },
]

const GIT_RULES = [
  { re: /\bpush\b.*(\s--force(-with-lease)?\b|\s-f\b|\s-[a-z]*f[a-z]*\b|\s\+[\w/.-]+)/i, what: 'sobrescreve o histórico no GitHub (git push --force); commits de outras pessoas podem sumir' },
  { re: /\breset\s+.*--hard\b|\breset\s+--hard\b/i, what: 'descarta as mudanças que ainda não foram commitadas (git reset --hard)', files: true },
  { re: /\bclean\s+-[a-z]*f/i, what: 'apaga os arquivos novos que ainda não estão no git (git clean)', files: true },
  { re: /\b(checkout|restore)\s+(--\s+)?\.(\s|$)/i, unless: /\brestore\b(?=.*--staged)(?!.*--worktree)/i, what: 'descarta as mudanças que ainda não foram commitadas', files: true },
  { re: /\bcheckout\s+(-f|--force)\b/i, what: 'troca de branch descartando as mudanças não commitadas', files: true },
  { re: /\bstash\s+(drop|clear)\b/i, what: 'apaga mudanças guardadas no stash' },
  { re: /\bbranch\s+(-D\b|--delete\s+--force\b|-d\s+-f\b)/, what: 'apaga uma branch mesmo com commits que não estão em outra' },
  { re: /\b(filter-branch|filter-repo)\b/i, what: 'reescreve todo o histórico do git' },
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

function removal(seg, cwd) {
  const { program, words } = seg
  let recursive = false
  let targets = []
  if (program === 'rm' || program === 'rmdir' || program === 'rd' || program === 'remove-item' || program === 'ri' || program === 'del' || program === 'erase') {
    const windowsStyle = program === 'rd' || program === 'rmdir' || program === 'del' || program === 'erase'
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
  } else return null
  if (!recursive) return null
  const risks = targets.map((t) => [t, removalRisk(t, cwd)]).filter(([, r]) => r)
  const worst = risks.find(([, r]) => r === 'catastrophe') ?? risks[0]
  if (!worst) return null
  return worst[1] === 'catastrophe'
    ? { level: 'deny', what: `apaga ${worst[0]} inteiro, com tudo dentro`, files: true }
    : { level: 'ask', what: `apaga a pasta ${worst[0]}, que fica fora do projeto`, files: false }
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
  if (DISK.test(command)) return { level: 'deny', what: 'formata ou sobrescreve um disco inteiro', files: false }
  // O corpo de um heredoc (cat > a.sql <<EOF … EOF) é texto do comando dele, não outros comandos.
  const segs = segments(command.replace(HEREDOC, '$1'))
  let found = null
  const keep = (r) => {
    if (!r) return
    if (!found || (r.level === 'deny' && found.level !== 'deny')) found = r
  }
  for (const seg of segs) {
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
  const saved = checkpoint ? ` Antes, o Faundr salvou um ponto de volta dos arquivos (para desfazer: /faundr:undo).` : ''
  const where = note ? ` ${note}` : ''
  const db = verdict.database ? ' O ponto de volta do Faundr guarda só os arquivos, não os dados do banco: confira se há backup.' : ''
  if (verdict.level === 'deny')
    return `[Faundr] Barrado: este comando ${verdict.what}${shown ? ` (${shown})` : ''}. Isso não tem volta. Não tente outro jeito de fazer o mesmo: explique ao usuário o que queria fazer e, se ele quiser mesmo, ele mesmo roda no terminal.${where}${db}`
  return `[Faundr] Atenção: este comando ${verdict.what}.${where} Aprove só se for isso mesmo.${saved}${db}`
}
