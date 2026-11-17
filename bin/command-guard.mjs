// Guarda de comandos perigosos: antes de o agente rodar um comando (terminal ou SQL), diz se ele pode apagar
// trabalho ou dados. Sem rede e sem abrir processos: roda em todo comando.
//
//   deny: catástrofe sem volta (apagar a pasta pessoal, o disco).
//   ask:  apaga ou sobrescreve algo, mas há casos legítimos.
// O hook (guard-cmd.mjs) não pergunta nem barra nada (decisão de 04/11/2026): o nível só ordena os achados.
//
// `files: true` quando o risco é nos arquivos: antes do comando, o Faundr tira um checkpoint.
// `label`: nome curto e fixo do tipo de comando (ex.: "git reset --hard"), sem o texto do comando (que pode ter
// segredo): é o que vai no motivo do checkpoint, visto pelo time no painel.

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

// Regra presa ao subcomando do git (depois de -C <pasta> / -c <opção>): "checkout -f" numa mensagem de commit não conta.
function gitSub(sub, rest) {
  return new RegExp(String.raw`^\s(?:-[cC]\s+\S+\s+)*${sub}\b${rest}`, 'i')
}

const GIT_RULES = [
  { re: /\bpush\b.*(\s--force(-with-lease)?\b|\s-f\b|\s-[a-z]*f[a-z]*\b|\s\+[\w/.-]+)/i, what: 'overwrites the history on GitHub (git push --force); other people\'s commits may be lost', label: 'git push --force' },
  { re: gitSub('reset', String.raw`.*\s--hard\b`), what: 'discards the changes not committed yet (git reset --hard)', label: 'git reset --hard', files: true },
  // -f em qualquer posição (git clean -d -f, --force); -n/--dry-run só lista. -x/-X apagam também os ignorados (.env).
  {
    re: gitSub('clean', String.raw`(?=.*\s(-[a-z]*f[a-z]*|--force)(\s|$))(?!.*\s(-[a-z]*n[a-z]*|--dry-run)(\s|$))`),
    what: 'deletes the new files not in git yet (git clean)',
    label: 'git clean',
    files: true,
    ignored: /\s-[a-zA-Z]*[xX]/,
  },
  { re: /\b(checkout|restore)\s+(--\s+)?\.(\s|$)/i, unless: /\brestore\b(?=.*--staged)(?!.*--worktree)/i, what: 'discards the changes not committed yet', label: 'git checkout .', files: true },
  { re: /\bstash\s+(drop|clear)\b/i, what: 'deletes changes saved in the stash', label: 'git stash drop' },
  { re: /\bbranch\s+(-D\b|--delete\s+--force\b|-d\s+-f\b)/, what: 'deletes a branch even with commits that are not in another one', label: 'git branch -D' },
  { re: /\b(filter-branch|filter-repo)\b/i, what: 'rewrites the whole git history', label: 'git filter-branch' },
  // Os que descartam mudanças de alguns arquivos ou trocam de branch à força: só o checkpoint antes.
  { re: gitSub('checkout', String.raw`.*\s--\s+\S`), what: 'overwrites these files, discarding their uncommitted changes (git checkout -- <file>)', label: 'git checkout -- <file>', files: true },
  // git checkout HEAD . / git checkout main ./ : a pasta inteira volta à versão do ref.
  { re: gitSub('checkout', String.raw`(\s+\S+)*\s+\.\/?(\s|$)`), what: 'overwrites the files of the folder with another version, discarding their uncommitted changes (git checkout <ref> .)', label: 'git checkout <ref> .', files: true },
  { re: gitSub('restore', String.raw`\s+\S`), unless: /\brestore\b(?=.*(--staged|\s-S\b))(?!.*(--worktree|\s-W\b))/, what: 'discards the uncommitted changes of these files (git restore)', label: 'git restore', files: true },
  { re: gitSub('checkout', String.raw`.*\s(-f|--force)\b`), what: 'switches branch discarding the uncommitted changes', label: 'git checkout -f', files: true },
  { re: gitSub('switch', String.raw`.*\s(-f|--force|--discard-changes)\b`), what: 'switches branch discarding the uncommitted changes', label: 'git switch -f', files: true },
  { re: gitSub('reset', String.raw`.*\s--merge\b`), what: 'goes back discarding changes of the files in the merge (git reset --merge)', label: 'git reset --merge', files: true },
  { re: gitSub('stash', String.raw`.*\s(-u|--include-untracked|-a|--all)\b`), what: 'moves the uncommitted changes and the new files out of the folder (git stash -u)', label: 'git stash -u', files: true },
]

// Opções globais do git antes do subcomando (git --no-pager checkout -f, git -C app reset --hard): saem, para as
// regras verem o subcomando no começo. As da lista levam um valor na palavra seguinte (sem "=").
const GIT_GLOBAL_WITH_VALUE = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--config-env', '--exec-path', '--super-prefix', '--list-cmds'])
export function gitArgs(words) {
  let i = 0
  while (i < words.length && words[i].startsWith('-')) i += GIT_GLOBAL_WITH_VALUE.has(words[i]) ? 2 : 1
  return words.slice(i)
}

// Baixar e rodar na hora (curl … | sh, iex (iwr …), powershell -enc): o que roda não passa pela leitura de ninguém.
// Pergunta (não barra): instaladores oficiais usam esse formato. Só vale quando o programa do trecho é mesmo o que
// baixa ou o que roda, para não pegar o mesmo texto dentro de uma mensagem de commit ou de um echo.
const DOWNLOADERS = new Set(['curl', 'wget', 'iwr', 'irm', 'invoke-webrequest', 'invoke-restmethod'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'python', 'python3', 'node', 'perl', 'ruby', 'iex', 'invoke-expression', 'pwsh', 'powershell'])
const DOWNLOAD_EXEC = [
  { re: /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n|;&]*\|\s*(sudo\s+)?(sh|bash|zsh|dash|ksh|fish|python3?|node|perl|ruby|iex|invoke-expression|pwsh|powershell)\b/i, programs: DOWNLOADERS },
  { re: /\b(sh|bash|zsh|dash|ksh)\b[^\n|;&]*(<\(|\$\()\s*(curl|wget)\b/i, programs: SHELLS },
  { re: /\b(iex|invoke-expression)\b\s*[(\s]\s*\(?\s*(iwr|irm|invoke-webrequest|invoke-restmethod|new-object\s+(system\.)?net\.webclient)\b/i, programs: SHELLS },
  { re: /\b(powershell|pwsh)(\.exe)?\b[^\n]*\s-(e|ec|en|enc|encodedcommand)\s+["']?[a-z0-9+/=]{16,}/i, programs: SHELLS },
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
// A pasta atual escrita como variável ou comando: rm -rf "$PWD", $(pwd), ${PWD}, (Get-Location).
const CWD_TARGETS = /^(\$pwd|\$\{pwd\}|\$\(pwd\)|`pwd`|\(get-location\)|\$\(get-location\)|\$\(\$pwd\))(\/\.?)?$/i

// Alvo com a pasta atual escrita como variável vira "."; o resto, normalizado.
function target(raw) {
  const t = norm(strip(raw))
  return CWD_TARGETS.test(t) ? '.' : t
}

// Alvo de uma remoção recursiva: 'catastrophe' (raiz, disco, pasta pessoal, tudo), 'outside' (fora do projeto) ou null.
function removalRisk(raw, cwd) {
  const t = target(raw)
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

// Pastas que o build ou o instalador refazem: apagar não perde trabalho.
const GENERATED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo', '.vercel', '.output', '.cache', '.parcel-cache', 'coverage', 'target', '__pycache__', '.pytest_cache', '.venv', 'venv', '.expo', 'tmp', 'temp'])

// Caminho dentro da pasta do projeto (relativo sem subir, ou absoluto debaixo dela).
function insideProject(raw, cwd) {
  const t = target(raw)
  if (!t || t.startsWith('..') || /^[~$%]/.test(t)) return false
  if (!/^(\/|[A-Z]:\/)/i.test(t)) return true
  if (!cwd) return false
  const base = norm(path.resolve(cwd)).toLowerCase()
  return t.toLowerCase().startsWith(`${base}/`)
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
    // PowerShell aceita o parâmetro abreviado: Remove-Item -r, -rec, -Recurs.
    else if (/^-r(e(c(u(r(se?)?)?)?)?)?$/i.test(w)) recursive = true
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
  const label = program === 'rm' ? 'rm -rf' : program === 'remove-item' || program === 'ri' ? 'Remove-Item -Recurse' : `${program} /s`
  // Caminhos absolutos apagados (para saber se o .git vai junto); "pasta/*" fica com o /* no fim.
  const removes = targets.map((t) => {
    const p = target(t)
    if (HOME_TARGETS.test(p)) return norm(os.homedir()) + (p.endsWith('*') ? '/*' : '')
    return norm(path.resolve(cwd ?? '.', p.replace(/^~(?=\/|$)/, os.homedir())))
  })
  const risks = targets.map((t) => [t, removalRisk(t, cwd)]).filter(([, r]) => r)
  const worst = risks.find(([, r]) => r === 'catastrophe') ?? risks[0]
  if (!worst) {
    // Pasta do próprio projeto (rm -rf src): sem perguntar, só o checkpoint antes. Pasta gerada não precisa.
    const mine = targets.filter((t) => insideProject(t, cwd) && !GENERATED_DIRS.has(path.posix.basename(target(t)).toLowerCase()))
    return mine.length ? { level: 'ask', what: `deletes ${mine.join(', ')} inside the project`, label, files: true, removes } : null
  }
  return worst[1] === 'catastrophe'
    ? { level: 'deny', what: `deletes the whole ${worst[0]}, with everything in it`, label, files: true, removes }
    : { level: 'ask', what: `deletes the folder ${worst[0]}, which is outside the project`, label, files: false }
}

// O comando apaga o .git do projeto (rm -rf da pasta inteira, de uma pasta acima ou do próprio .git)? Aí os
// checkpoints, que moram no .git, vão junto.
export function wipesRepo(verdict, root) {
  if (!verdict?.removes?.length || !root) return false
  const r = norm(path.resolve(root)).toLowerCase()
  return verdict.removes.some((raw) => {
    const p = raw.toLowerCase()
    // "pasta/*" não pega o .git (o * do shell pula os ocultos), só pastas de dentro; "pasta/.*" pega.
    if (p.endsWith('/*')) return r.startsWith(`${p.slice(0, -2)}/`)
    const base = p.endsWith('/.*') ? p.slice(0, -3) : p
    return r === base || r.startsWith(`${base}/`) || p === `${r}/.git`
  })
}

// find que apaga (find . -delete, find . -name x -exec rm {} +) dentro do projeto.
const EXEC_REMOVE = /^(rm|del|unlink|shred|rmdir|remove-item)$/i
function findRemoval(seg, cwd) {
  if (seg.program !== 'find') return null
  const w = seg.words
  const deletes = w.includes('-delete') || w.some((x, i) => /^-(exec|execdir|ok|okdir)$/.test(x) && EXEC_REMOVE.test(path.basename(w[i + 1] ?? '')))
  if (!deletes) return null
  // Pastas de partida: as palavras antes da primeira expressão (-name, '(', '!'); sem nenhuma, a pasta atual.
  const firstExpr = w.findIndex((x) => /^[-(!]|^\\\(/.test(x))
  const given = firstExpr === -1 ? w : w.slice(0, firstExpr)
  const starts = given.length ? given : ['.']
  const mine = starts.some((s) => insideProject(s, cwd) || removalRisk(s, cwd) === 'catastrophe')
  return mine ? { level: 'ask', what: 'deletes the files that find matches', label: 'find -delete', files: true } : null
}

// Comando dentro de outro shell (bash -c "…", sh -c '…', powershell -Command "…", pwsh -c …, cmd /c …): o de
// dentro é o que roda.
const WRAPPERS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'pwsh', 'powershell', 'cmd'])
const WRAPPED = [
  /\b(?:ba|z|da|k)?sh(?:\.exe)?\s[^\n"']*?-[a-z]*c\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\n]+))/gi,
  /\b(?:pwsh|powershell)(?:\.exe)?\s[^\n"']*?-(?:c|command)\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\n]+))/gi,
  /\bcmd(?:\.exe)?\s+\/[ck]\s+(?:"([^"]*)"|([^\n]+))/gi,
]
function wrappedCommands(command) {
  const inner = []
  for (const re of WRAPPED) for (const m of command.matchAll(re)) inner.push((m[1] ?? m[2] ?? m[3] ?? '').replace(/\\(["\\$`])/g, '$1'))
  return inner.filter((s) => s.trim())
}

const DISK = /\bmkfs(\.\w+)?\b|\bdd\b.*\bof=\/dev\/(sd|nvme|disk|hd)|\bformat\s+[a-z]:|\bdiskpart\b|\bclear-disk\b|\bformat-volume\b/i

/**
 * Classifica um comando do terminal (Bash/PowerShell) ou um SQL (`sql: true`, de ferramentas MCP de banco).
 * Devolve null (seguro) ou { level: 'deny'|'ask', what, files }.
 */
export function classifyCommand(command, { cwd, sql = false, depth = 0 } = {}) {
  if (!command || typeof command !== 'string') return null
  if (sql) {
    const hit = SQL_RULES.find((r) => r.re.test(command))
    return hit ? { level: 'ask', what: hit.what, files: false, database: true } : null
  }
  if (DISK.test(command)) return { level: 'deny', what: 'formats or overwrites a whole disk', files: false }
  // O corpo de um heredoc (cat > a.sql <<EOF … EOF) é texto do comando dele, não outros comandos.
  const segs = segments(command.replace(HEREDOC, '$1'))
  let found = null
  // Fica o achado de nível mais alto; o que é dos arquivos (files, ignored, removes, label) soma de todos os trechos:
  // em "git stash drop; git reset --hard" o checkpoint ainda sai.
  const keep = (r) => {
    if (!r) return
    if (!found) {
      found = { ...r }
      return
    }
    const merged = r.level === 'deny' && found.level !== 'deny' ? { ...r } : found
    const filesFrom = found.files ? found : r.files ? r : null
    merged.files = !!filesFrom
    if (filesFrom) merged.label = filesFrom.label
    merged.ignored = !!(found.ignored || r.ignored)
    const removes = [...(found.removes ?? []), ...(r.removes ?? [])]
    if (removes.length) merged.removes = [...new Set(removes)]
    found = merged
  }
  // Comando dentro de outro shell: classifica o de dentro também.
  if (depth < 3 && segs.some((s) => WRAPPERS.has(s.program))) for (const inner of wrappedCommands(command)) keep(classifyCommand(inner, { cwd, depth: depth + 1 }))
  for (const seg of segs) {
    // Voltar para um checkpoint troca arquivos (quem confirma é o agente, com o OK do usuário; o hook não pergunta).
    const restore = !TEXT_PROGRAMS.has(seg.program) && seg.text.match(/\bfaundr(?:\.mjs)?["']?\s+restore\s+["']?([\w#.-]+).*\s--yes\b/i)
    if (restore) keep({ level: 'ask', what: 'restores the files to a checkpoint', label: 'faundr restore', files: false, restore: restore[1] })
    keep(removal(seg, cwd))
    keep(findRemoval(seg, cwd))
    if (seg.program === 'git') {
      const rest = gitArgs(seg.words).join(' ')
      const hit = GIT_RULES.find((r) => r.re.test(` ${rest}`) && !(r.unless && r.unless.test(seg.text)))
      if (hit) keep({ level: 'ask', what: hit.what, label: hit.label, files: !!hit.files, ignored: !!hit.ignored?.test(` ${rest}`) })
    }
  }
  const fetched = DOWNLOAD_EXEC.find((r) => r.re.test(command) && segs.some((s) => r.programs.has(s.program.split('(')[0])))
  if (fetched)
    keep({ level: 'ask', what: 'downloads code from the internet and runs it right away, without anyone reading it first (it can do anything on this computer)', files: false })
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

// Comandos que com certeza só leem: não precisam de checkpoint antes.
const READ_ONLY = new Set(['ls', 'dir', 'cat', 'type', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'rg', 'ag', 'findstr', 'pwd', 'echo', 'printf', 'wc', 'which', 'where', 'whoami', 'date', 'env', 'printenv', 'tree', 'stat', 'file', 'du', 'df', 'get-childitem', 'gci', 'get-content', 'gc', 'select-string', 'sls', 'get-location', 'test-path', 'get-item', 'get-command', 'write-output', 'write-host', 'jq', 'diff', 'cmp', 'sort', 'uniq', 'cut', 'basename', 'dirname', 'realpath', 'readlink', 'true', 'false', 'test', '[', 'sleep', 'cd', 'ps', 'tasklist'])
const READ_ONLY_GIT = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'ls-files', 'blame', 'remote', 'config', 'describe', 'shortlog', 'grep', 'ls-tree', 'cat-file', 'for-each-ref', 'reflog', 'fetch', 'version'])

export function isReadOnly(command) {
  const segs = segments(command ?? '')
  if (!segs.length) return true
  if (/(^|[^>])>{1,2}(?!&)\s*[^\s&]/.test(command.replace(/2>&1|>\s*\/dev\/null|>\s*nul\b|\$null/gi, ''))) return false
  return segs.every((s) => {
    if (s.program === 'git') {
      const sub = gitArgs(s.words)[0]
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
  const saved = checkpoint ? ` Faundr saved a checkpoint of the files first (to undo: /faundr:undo).` : ''
  const where = note ? ` ${note}` : ''
  const db = verdict.database ? ' Faundr checkpoints keep only the files, not the database data: check that there is a backup.' : ''
  if (verdict.level === 'deny')
    return `[Faundr] Blocked: this command ${verdict.what}${shown ? ` (${shown})` : ''}. This cannot be undone. Do not try another way to do the same thing: explain to the user what you wanted to do and, if they really want it, they run it themselves in the terminal.${where}${db}`
  return `[Faundr] Warning: this command ${verdict.what}.${where} Approve only if this is really what you want.${saved}${db}`
}
