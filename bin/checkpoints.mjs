// Pontos de volta: uma foto dos arquivos do projeto guardada no próprio git, sem mexer no que o usuário vê.
//
// A foto usa um índice temporário e vira um commit solto
// em refs/faundr/checkpoints/<ms> (numa worktree ligada, refs/faundr/wt/<nome>/checkpoints/<ms>: cada worktree tem a
// sua lista). Não muda a branch, o índice, o stash nem os arquivos. Entra tudo o que não está no .gitignore,
// inclusive arquivos ainda não commitados; .env*, node_modules/ e .faundr/ ficam sempre de fora, mesmo sem
// .gitignore (segredos, pastas enormes e o estado do próprio Faundr).
//
// Voltar salva antes uma foto do estado atual: dá para desfazer a volta.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { locale, t } from './i18n.mjs'

export const CHECKPOINT_PREFIX = 'refs/faundr/checkpoints/'
const KEEP = 50
// Com edições seguidas, uma foto nova a cada 30 min ("antes de mudanças grandes").
export const CHECKPOINT_EVERY_MS = 30 * 60_000
const IDENTITY = { GIT_AUTHOR_NAME: 'Faundr', GIT_AUTHOR_EMAIL: 'faundr@localhost', GIT_COMMITTER_NAME: 'Faundr', GIT_COMMITTER_EMAIL: 'faundr@localhost' }
const OWN = (p) => p === '.faundr' || p.startsWith('.faundr/')
// Nunca entram num checkpoint nem são mexidos por uma volta: segredos e pacotes instalados.
const NEVER = (p) => /(^|\/)node_modules(\/|$)/.test(p) || /(^|\/)\.env(\.[^/]*)?$/.test(p)
const NEVER_PATTERNS = ['node_modules', '.env', '.env.*']

// Checkpoint tirado pelo hook dos comandos (o Claude Code derruba o hook aos 15 s): o git todo tem esse prazo, e
// passar dele só deixa o comando seguir sem checkpoint.
export const HOOK_CHECKPOINT_MS = 10_000
// Hook das edições: o Claude Code derruba aos 10 s, então o git tem menos (sobra tempo para o node e o marcador).
export const EDIT_HOOK_CHECKPOINT_MS = 6_000

// `deadline`: hora (ms) em que o git é parado; sem ela, sem prazo (comandos da pessoa, como faundr restore).
function git(root, args, { env, input, deadline } = {}) {
  const timeout = deadline ? Math.max(1, Math.floor(deadline - Date.now())) : undefined
  const r = spawnSync('git', args, { cwd: root, env: env ?? process.env, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`git ${args[0]}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`)
  return r.stdout
}

// Pasta pessoal ou raiz do disco como raiz do git (um "git init" esquecido em ~ ou em C:\): a foto pegaria a
// máquina inteira. Nesses casos não há checkpoint.
export function unsafeCheckpointRoot(root, home = os.homedir()) {
  const r = path.resolve(root)
  const same = (a, b) => (process.platform === 'win32' || process.platform === 'darwin' ? a.toLowerCase() === b.toLowerCase() : a === b)
  return same(r, path.resolve(home)) || same(r, path.parse(r).root)
}

// Namespace dos refs: o projeto principal usa refs/faundr/checkpoints/ (como sempre); uma worktree ligada (ajudante
// do /faundr:parallel) usa o seu, senão os checkpoints dela apareceriam como #1 no projeto principal.
const prefixes = new Map()
export function checkpointPrefix(root) {
  const key = path.resolve(root)
  if (prefixes.has(key)) return prefixes.get(key)
  let prefix = CHECKPOINT_PREFIX
  let dotGit = null
  try {
    dotGit = fs.statSync(path.join(key, '.git'))
  } catch {
    // Sem .git na raiz: pergunta ao git abaixo.
  }
  // .git em pasta é sempre o repositório principal; arquivo .git é worktree ligada ou submódulo.
  if (!dotGit?.isDirectory()) {
    try {
      const [gitDir, commonDir] = git(key, ['rev-parse', '--git-dir', '--git-common-dir']).trim().split('\n').map((p) => path.resolve(key, p.trim()))
      if (gitDir.toLowerCase() !== commonDir.toLowerCase()) prefix = `refs/faundr/wt/${path.basename(gitDir).replace(/[^\w.-]/g, '-').replace(/^\.+/, '') || 'wt'}/checkpoints/`
    } catch {
      // Git que não responde: fica o namespace principal.
    }
  }
  prefixes.set(key, prefix)
  return prefix
}

// Raiz do repositório (a pasta que tem o .git), sem abrir o git.
export function gitRoot(dir) {
  let current = path.resolve(dir)
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

// Árvore (tree) com os arquivos atuais, byte a byte: sem os filtros do git (fim de linha, LFS), para a volta
// devolver exatamente o que estava no disco. Entra o que o git já acompanha mais os arquivos novos que não estão
// no .gitignore. Montada num índice temporário: o índice do usuário não muda.
export function currentTree(root, deadline) {
  const modes = new Map()
  for (const entry of git(root, ['ls-files', '-z', '-s'], { deadline }).split('\0')) {
    const m = entry.match(/^(\d+) \S+ \d\t(.+)$/s)
    if (m) modes.set(m[2], m[1])
  }
  // node_modules e .env* ficam de fora mesmo sem .gitignore (sem isso, um repositório sem .gitignore hasheia o
  // node_modules inteiro e estoura o prazo do hook).
  const untracked = git(root, ['ls-files', '-z', '-o', '--exclude-standard', ...NEVER_PATTERNS.map((p) => `--exclude=${p}`)], { deadline }).split('\0')
  const files = [...new Set([...modes.keys(), ...untracked])].filter((f) => {
    if (!f || OWN(f) || NEVER(f) || /[\n\r]/.test(f)) return false
    try {
      return fs.lstatSync(path.join(root, f)).isFile()
    } catch {
      // Sumiu entre a listagem e agora (ou não dá para ler): fica fora do ponto.
      return false
    }
  })
  const tmp = path.join(os.tmpdir(), `faundr-idx-${process.pid}-${Date.now()}`)
  try {
    const env = { ...process.env, GIT_INDEX_FILE: tmp }
    if (files.length) {
      const hashes = git(root, ['hash-object', '-w', '--no-filters', '--stdin-paths'], { input: `${files.join('\n')}\n`, deadline }).trim().split('\n')
      const info = files.map((f, i) => `${modes.get(f) === '100755' ? '100755' : '100644'} ${hashes[i]}\t${f}\0`).join('')
      git(root, ['update-index', '-z', '--add', '--index-info'], { env, input: info, deadline })
    }
    return git(root, ['write-tree'], { env, deadline }).trim()
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      // Índice temporário já apagado ou preso: é só um arquivo em tmp, não afeta o ponto.
    }
  }
}

// Conteúdo de vários arquivos de um commit numa chamada só (git cat-file --batch), como Buffers.
function readBlobs(root, commit, paths) {
  const r = spawnSync('git', ['cat-file', '--batch'], { cwd: root, input: paths.map((p) => `${commit}:${p}`).join('\n') + '\n', maxBuffer: 1024 * 1024 * 1024, windowsHide: true })
  if (r.error) throw r.error
  const out = r.stdout
  let at = 0
  return paths.map((p) => {
    const nl = out.indexOf(10, at)
    const header = out.subarray(at, nl).toString()
    const size = Number(header.split(' ')[2])
    if (!header.includes(' blob ') || Number.isNaN(size)) throw new Error(t(`${p} not found in the checkpoint`, `não achei ${p} no checkpoint`))
    at = nl + 1 + size + 1
    return out.subarray(nl + 1, nl + 1 + size)
  })
}

function parseMessage(body) {
  const lines = body.split('\n')
  const meta = {}
  for (const l of lines.slice(1)) {
    const m = l.match(/^(\w+): (.*)$/)
    if (m) meta[m[1]] = m[2]
  }
  return { reason: lines[0].replace(/^faundr: /, ''), ...meta }
}

// Pontos de volta, do mais novo para o mais antigo (n = 1 é o mais novo).
export function listCheckpoints(root, deadline) {
  const prefix = checkpointPrefix(root)
  const out = git(root, ['for-each-ref', '--sort=-refname', '--format=%(refname)%1f%(objectname)%1f%(tree)%1f%(contents)%1e', prefix], { deadline })
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((r, i) => {
      const [ref, commit, tree, contents] = r.split('\x1f')
      const msg = parseMessage(contents.trim())
      return { n: i + 1, ref, commit, tree, at: new Date(Number(ref.slice(prefix.length))).toISOString(), reason: msg.reason, session: msg.session ?? null }
    })
}

// Tira uma foto. Se nada mudou desde a última, não cria outra (devolve a última com created: false).
// `timeoutMs`: prazo de todo o git da foto (nos hooks, HOOK_CHECKPOINT_MS); passou dele, dá erro sem criar o ponto.
export function createCheckpoint(root, { reason = t('checkpoint', 'checkpoint'), session = null, now = Date.now(), timeoutMs } = {}) {
  if (unsafeCheckpointRoot(root))
    throw new Error(
      t(
        `The git repository starts at ${root} (home folder or disk root): Faundr does not save checkpoints there. Run git init in the project folder.`,
        `O repositório git começa em ${root} (pasta pessoal ou raiz do disco): o Faundr não salva checkpoints aí. Rode git init na pasta do projeto.`,
      ),
    )
  const deadline = timeoutMs ? Date.now() + timeoutMs : undefined
  const prefix = checkpointPrefix(root)
  const tree = currentTree(root, deadline)
  const all = listCheckpoints(root, deadline)
  if (all[0]?.tree === tree) return { ...all[0], created: false }
  let head = null
  try {
    head = git(root, ['rev-parse', '--verify', '-q', 'HEAD'], { deadline }).trim() || null
  } catch {
    // Repositório sem commit ainda: o ponto nasce sem pai.
  }
  const message = [`faundr: ${reason.replace(/\s+/g, ' ').slice(0, 200)}`, '', session && `session: ${session}`].filter((l) => l !== null && l !== undefined && l !== false).join('\n')
  const commit = git(root, ['commit-tree', tree, ...(head ? ['-p', head] : []), '-F', '-'], { env: { ...process.env, ...IDENTITY }, input: message, deadline }).trim()
  let stamp = now
  while (all.some((c) => c.ref === `${prefix}${stamp}`)) stamp++
  const ref = `${prefix}${stamp}`
  git(root, ['update-ref', ref, commit])
  for (const old of all.slice(KEEP - 1)) git(root, ['update-ref', '-d', old.ref])
  return { n: 1, ref, commit, tree, at: new Date(stamp).toISOString(), reason, session, created: true }
}

const STATUS = { A: 'criado', M: 'alterado', D: 'apagado' }

// O que mudou de `fromTree` para `toTree`: [{ status: 'criado'|'alterado'|'apagado', path }].
function treeDiff(root, fromTree, toTree) {
  if (fromTree === toTree) return []
  return git(root, ['diff-tree', '-r', '--no-renames', '--name-status', '-z', fromTree, toTree])
    .split('\0')
    .reduce((acc, part, i, arr) => {
      if (i % 2 === 0 && part && arr[i + 1] !== undefined) acc.push({ status: STATUS[part[0]] ?? 'alterado', path: arr[i + 1] })
      return acc
    }, [])
    .filter((c) => !OWN(c.path))
}

// O que mudou nos arquivos desde o ponto de volta.
export function changesSince(root, checkpoint, tree = currentTree(root)) {
  return treeDiff(root, checkpoint.tree, tree)
}

// Número da lista (muda quando sai um checkpoint novo), código do commit (7+ letras hex, o que vale para confirmar)
// ou o ref inteiro. Número exato primeiro: "8" nunca vira o commit que começa com 8.
export function findCheckpoint(root, which) {
  const all = listCheckpoints(root)
  const s = String(which ?? '').trim().replace(/^#/, '')
  if (!s) return null
  const byNumber = all.find((c) => String(c.n) === s)
  if (byNumber) return byNumber
  const byRef = all.find((c) => c.ref === s)
  if (byRef) return byRef
  if (/^[0-9a-f]{7,40}$/i.test(s)) return all.find((c) => c.commit.startsWith(s.toLowerCase())) ?? null
  return null
}

// Tira da volta o que ela nunca mexe: .env*, node_modules/ e o que o .gitignore ignora agora (o checkpoint pode ser
// de antes de o arquivo entrar no .gitignore).
export function restorableChanges(root, changes) {
  const kept = changes.filter((c) => !NEVER(c.path))
  if (!kept.length) return kept
  const r = spawnSync('git', ['check-ignore', '--stdin', '-z'], { cwd: root, input: `${kept.map((c) => c.path).join('\0')}\0`, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
  if (r.error) throw r.error
  // 0: algum ignorado; 1: nenhum; outro: erro do git.
  if (r.status !== 0 && r.status !== 1) throw new Error(`git check-ignore: ${(r.stderr || '').trim().split('\n').pop()}`)
  const ignored = new Set(r.stdout.split('\0').filter(Boolean))
  return kept.filter((c) => !ignored.has(c.path))
}

// Volta os arquivos para o checkpoint. Antes, guarda o estado atual (a volta pode ser desfeita).
// Primeiro apaga, depois escreve: numa troca só de maiúsculas (A.txt → a.txt) em disco que não diferencia, apagar
// depois apagaria o arquivo recém-escrito. Arquivo preso (OneDrive, antivírus, servidor de dev) não para a volta:
// o resto segue e ele sai em `failed`.
export function restoreCheckpoint(root, checkpoint, { session = null } = {}) {
  const at = new Date(checkpoint.at).toLocaleString(locale())
  const saved = createCheckpoint(root, { reason: t(`before restoring the checkpoint from ${at}`, `antes de voltar para o checkpoint de ${at}`), session })
  const changes = restorableChanges(root, treeDiff(root, saved.tree, checkpoint.tree))
  const bring = changes.filter((c) => c.status !== 'apagado').map((c) => c.path)
  // Comparação sem caixa: o mesmo caminho (A.txt/a.txt) que sai e volta não perde a pasta no meio.
  const brought = new Set(bring.map((p) => p.toLowerCase()))
  const remove = changes.filter((c) => c.status === 'apagado').map((c) => c.path)
  const blobs = bring.length ? readBlobs(root, checkpoint.commit, bring) : []
  const failed = []
  const removed = []
  for (const rel of remove) {
    const file = path.join(root, rel)
    try {
      fs.unlinkSync(file)
      removed.push(rel)
    } catch (err) {
      if (err.code === 'ENOENT') removed.push(rel)
      else failed.push({ path: rel, error: err.code ?? err.message })
    }
    if (brought.has(rel.toLowerCase())) continue
    // Pastas que ficaram vazias saem também.
    let dir = path.dirname(file)
    while (dir.startsWith(root) && dir !== root) {
      try {
        fs.rmdirSync(dir)
      } catch {
        break
      }
      dir = path.dirname(dir)
    }
  }
  const restored = []
  bring.forEach((rel, i) => {
    const file = path.join(root, rel)
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, blobs[i])
      restored.push(rel)
    } catch (err) {
      failed.push({ path: rel, error: err.code ?? err.message })
    }
  })
  return { saved, restored, removed, failed }
}

// Cópia de resgate do checkpoint fora do .git, para comando que apaga a pasta inteira ou o .git (os checkpoints vão
// junto). Um commit sem pai com a árvore do checkpoint, num bundle em `dir` que `git clone` abre. Feito num
// repositório temporário com alternates: não cria branch nem ref no projeto. Guarda só os 5 mais novos.
export function rescueBundle(root, checkpoint, { dir, deadline, now = Date.now() } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  const commit = git(root, ['commit-tree', checkpoint.tree, '-m', `faundr: ${checkpoint.reason}`], { env: { ...process.env, ...IDENTITY }, deadline }).trim()
  const objects = path.resolve(root, git(root, ['rev-parse', '--git-common-dir'], { deadline }).trim(), 'objects')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-rescue-'))
  const name = `${path.basename(root).replace(/[^\w.-]/g, '-') || 'project'}-${new Date(now).toISOString().replace(/[:.]/g, '-')}.bundle`
  const file = path.join(dir, name)
  try {
    git(tmp, ['init', '-q', '--bare', '.'], { deadline })
    fs.writeFileSync(path.join(tmp, 'objects', 'info', 'alternates'), `${objects.split(path.sep).join('/')}\n`)
    fs.mkdirSync(path.join(tmp, 'refs', 'heads'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'refs', 'heads', 'checkpoint'), `${commit}\n`)
    fs.writeFileSync(path.join(tmp, 'HEAD'), 'ref: refs/heads/checkpoint\n')
    git(tmp, ['bundle', 'create', '-q', file, 'HEAD', 'checkpoint'], { deadline })
  } catch (err) {
    fs.rmSync(file, { force: true })
    throw err
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  try {
    const all = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.bundle'))
      .map((f) => ({ f, at: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.at - a.at)
    for (const { f } of all.slice(5)) fs.rmSync(path.join(dir, f), { force: true })
  } catch {
    // Faxina dos bundles antigos: falhar não tira o bundle novo.
  }
  return file
}

// Ponto que não saiu (git lento, prazo do hook): tenta de novo depois deste tempo, e não em todo comando.
const RETRY_AFTER_FAIL_MS = 5 * 60_000

// Uma foto antes da primeira mudança da sessão e, com edições seguidas, de novo a cada 30 min.
// Devolve o ponto de volta criado (ou null quando não era hora, não há git ou nada mudou).
export function ensureSessionCheckpoint(cwd, sessionId, { configDir, reason = t('before the first change of the session', 'antes da primeira mudança da sessão'), now = Date.now(), every = CHECKPOINT_EVERY_MS, timeoutMs = HOOK_CHECKPOINT_MS } = {}) {
  if (!sessionId || !configDir) return null
  const root = gitRoot(cwd)
  if (!root) return null
  if (unsafeCheckpointRoot(root)) {
    try {
      fs.mkdirSync(configDir, { recursive: true })
      fs.appendFileSync(path.join(configDir, 'hook.log'), `${new Date(now).toISOString()} checkpoint: o git começa em ${root} (pasta pessoal ou raiz do disco), sem checkpoint\n`)
    } catch {
      // Sem onde registrar: segue sem checkpoint, em silêncio.
    }
    return null
  }
  const marker = path.join(configDir, `checkpoint-${String(sessionId).replace(/[^\w-]/g, '')}`)
  let last = 0
  try {
    last = Number(fs.readFileSync(marker, 'utf8')) || 0
  } catch {
    // Primeira vez nesta sessão (sem marcador).
  }
  if (last && now - last < every) return null
  fs.mkdirSync(configDir, { recursive: true })
  cleanMarkers(configDir, now)
  // Marcador de "tentar de novo em 5 min" ANTES da foto: se o Claude Code derrubar o hook no meio, a próxima edição
  // não espera o prazo inteiro de novo. Deu certo, vira a hora do checkpoint (o próximo, em 30 min).
  fs.writeFileSync(marker, String(now - every + RETRY_AFTER_FAIL_MS))
  const c = createCheckpoint(root, { reason: last ? t('before continuing the changes (30 min after the last checkpoint)', 'antes de continuar as mudanças (30 min depois do último checkpoint)') : reason, session: sessionId, now, timeoutMs })
  fs.writeFileSync(marker, String(now))
  return c.created ? c : null
}

function cleanMarkers(configDir, now) {
  try {
    for (const f of fs.readdirSync(configDir)) {
      if (!f.startsWith('checkpoint-')) continue
      const file = path.join(configDir, f)
      if (now - fs.statSync(file).mtimeMs > 2 * 24 * 3600_000) fs.unlinkSync(file)
    }
  } catch {
    // Limpeza dos marcadores antigos é só faxina: falhar não muda o ponto criado.
  }
}

// O que voltar para o ponto faz com os arquivos, em português simples, para o usuário decidir.
// `changes` = changesSince(ponto): o que mudou depois dele (alterado, criado, apagado).
export function restoreSummary(checkpoint, changes, { max = 8 } = {}) {
  const when = new Date(checkpoint.at).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const head = t(`Restore the checkpoint from ${when} (${checkpoint.reason}).`, `Voltar para o checkpoint de ${when} (${checkpoint.reason}).`)
  if (!changes.length) return `${head} ${t('The files already match this checkpoint: nothing changes.', 'Os arquivos já estão iguais a este checkpoint: nada muda.')}`
  const list = (items) => `${items.slice(0, max).map((c) => c.path).join(', ')}${items.length > max ? t(` and ${items.length - max} more`, ` e mais ${items.length - max}`) : ''}`
  const of = (s) => changes.filter((c) => c.status === s)
  const lines = [head, t('What happens to the files:', 'O que acontece com os arquivos:')]
  if (of('alterado').length)
    lines.push(
      t(
        `- ${of('alterado').length} go back to how they were; the changes made to them after the checkpoint are lost: ${list(of('alterado'))}`,
        `- ${of('alterado').length} voltam como eram; as mudanças feitas neles depois do checkpoint se perdem: ${list(of('alterado'))}`,
      ),
    )
  if (of('criado').length) lines.push(t(`- ${of('criado').length} created after the checkpoint are deleted: ${list(of('criado'))}`, `- ${of('criado').length} criados depois do checkpoint são apagados: ${list(of('criado'))}`))
  if (of('apagado').length) lines.push(t(`- ${of('apagado').length} deleted after the checkpoint come back: ${list(of('apagado'))}`, `- ${of('apagado').length} apagados depois do checkpoint voltam: ${list(of('apagado'))}`))
  // O que fica fora da foto e pode não bater com os arquivos de volta.
  if (changes.some((c) => /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|pyproject\.toml)$/.test(c.path)))
    lines.push(
      t(
        'Warning: the package list changes. After restoring, run the install (e.g. npm install) so the packages match the code.',
        'Atenção: a lista de pacotes muda. Depois da volta, rode a instalação (ex.: npm install) para os pacotes baterem com o código.',
      ),
    )
  if (changes.some((c) => /(^|\/)(migrations?|prisma)\//i.test(c.path)))
    lines.push(
      t(
        'Warning: database migration files change, but the database does not go back. If a migration was already applied, the old code may not match the database.',
        'Atenção: arquivos de migração do banco mudam, mas o banco não volta. Se alguma migração já foi aplicada, o código antigo pode não bater com o banco.',
      ),
    )
  lines.push(
    t('What does not change: the .env, node_modules, the files ignored by git, the database and the git commits.', 'O que não muda: o .env, o node_modules, os arquivos ignorados pelo git, o banco de dados e os commits do git.'),
    t('The current state is saved first, as a new checkpoint: the restore can be undone.', 'O estado de agora é salvo antes, como um checkpoint novo: dá para desfazer a volta.'),
  )
  return lines.join('\n')
}

// Resumo em português simples de uma lista de mudanças: "3 alterados, 1 criado (a.ts, b.ts, …)".
export function describeChanges(changes, max = 4) {
  if (!changes.length) return t('nothing changed since then', 'nada mudou desde então')
  const count = (s) => changes.filter((c) => c.status === s).length
  const label = (s, en, pt) => count(s) && `${count(s)} ${t(en, `${pt}${count(s) > 1 ? 's' : ''}`)}`
  const parts = [label('alterado', 'changed', 'alterado'), label('criado', 'created', 'criado'), label('apagado', 'deleted', 'apagado')].filter(Boolean)
  const names = changes.slice(0, max).map((c) => c.path.split('/').pop())
  return `${parts.join(', ')} (${names.join(', ')}${changes.length > max ? ', …' : ''})`
}
