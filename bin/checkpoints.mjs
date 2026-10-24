// Pontos de volta: uma foto dos arquivos do projeto guardada no próprio git, sem mexer no que o usuário vê.
//
// A foto usa um índice temporário e vira um commit solto
// em refs/faundr/checkpoints/<ms>. Não muda a branch, o índice, o stash nem os arquivos. Entra tudo o que não
// está no .gitignore, inclusive arquivos ainda não commitados; .env e node_modules ficam de fora (estão no
// .gitignore) e a pasta .faundr/ também (é o estado do próprio Faundr).
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

function git(root, args, { env, input } = {}) {
  const r = spawnSync('git', args, { cwd: root, env: env ?? process.env, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`git ${args[0]}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`)
  return r.stdout
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
export function currentTree(root) {
  const modes = new Map()
  for (const entry of git(root, ['ls-files', '-z', '-s']).split('\0')) {
    const m = entry.match(/^(\d+) \S+ \d\t(.+)$/s)
    if (m) modes.set(m[2], m[1])
  }
  const untracked = git(root, ['ls-files', '-z', '-o', '--exclude-standard']).split('\0')
  const files = [...new Set([...modes.keys(), ...untracked])].filter((f) => {
    if (!f || OWN(f) || /[\n\r]/.test(f)) return false
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
      const hashes = git(root, ['hash-object', '-w', '--no-filters', '--stdin-paths'], { input: `${files.join('\n')}\n` }).trim().split('\n')
      const info = files.map((f, i) => `${modes.get(f) === '100755' ? '100755' : '100644'} ${hashes[i]}\t${f}\0`).join('')
      git(root, ['update-index', '-z', '--add', '--index-info'], { env, input: info })
    }
    return git(root, ['write-tree'], { env }).trim()
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
    if (!header.includes(' blob ') || Number.isNaN(size)) throw new Error(t(`${p} not found in the restore point`, `não achei ${p} no ponto de volta`))
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
export function listCheckpoints(root) {
  const out = git(root, ['for-each-ref', '--sort=-refname', '--format=%(refname)%1f%(objectname)%1f%(tree)%1f%(contents)%1e', CHECKPOINT_PREFIX])
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((r, i) => {
      const [ref, commit, tree, contents] = r.split('\x1f')
      const msg = parseMessage(contents.trim())
      return { n: i + 1, ref, commit, tree, at: new Date(Number(ref.slice(CHECKPOINT_PREFIX.length))).toISOString(), reason: msg.reason, session: msg.session ?? null }
    })
}

// Tira uma foto. Se nada mudou desde a última, não cria outra (devolve a última com created: false).
export function createCheckpoint(root, { reason = t('restore point', 'ponto de volta'), session = null, now = Date.now() } = {}) {
  const tree = currentTree(root)
  const all = listCheckpoints(root)
  if (all[0]?.tree === tree) return { ...all[0], created: false }
  let head = null
  try {
    head = git(root, ['rev-parse', '--verify', '-q', 'HEAD']).trim() || null
  } catch {
    // Repositório sem commit ainda: o ponto nasce sem pai.
  }
  const message = [`faundr: ${reason.replace(/\s+/g, ' ').slice(0, 200)}`, '', session && `session: ${session}`].filter((l) => l !== null && l !== undefined && l !== false).join('\n')
  const commit = git(root, ['commit-tree', tree, ...(head ? ['-p', head] : []), '-F', '-'], { env: { ...process.env, ...IDENTITY }, input: message }).trim()
  let stamp = now
  while (all.some((c) => c.ref === `${CHECKPOINT_PREFIX}${stamp}`)) stamp++
  const ref = `${CHECKPOINT_PREFIX}${stamp}`
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

export function findCheckpoint(root, which) {
  const all = listCheckpoints(root)
  const s = String(which ?? '').replace(/^#/, '')
  return all.find((c) => String(c.n) === s || c.ref === s || c.commit.startsWith(s)) ?? null
}

// Volta os arquivos para o ponto de volta. Antes, guarda o estado atual (a volta pode ser desfeita).
export function restoreCheckpoint(root, checkpoint, { session = null } = {}) {
  const saved = createCheckpoint(root, { reason: t(`before restoring the point from ${new Date(checkpoint.at).toLocaleString(locale())}`, `antes de voltar para o ponto de ${new Date(checkpoint.at).toLocaleString(locale())}`), session })
  const changes = treeDiff(root, saved.tree, checkpoint.tree)
  const bring = changes.filter((c) => c.status !== 'apagado').map((c) => c.path)
  const remove = changes.filter((c) => c.status === 'apagado').map((c) => c.path)
  const blobs = bring.length ? readBlobs(root, checkpoint.commit, bring) : []
  bring.forEach((rel, i) => {
    const file = path.join(root, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, blobs[i])
  })
  for (const rel of remove) {
    const file = path.join(root, rel)
    try {
      fs.unlinkSync(file)
    } catch {
      // Já não existia ou está preso: o resto da volta segue.
    }
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
  return { saved, restored: bring, removed: remove }
}

// Uma foto antes da primeira mudança da sessão e, com edições seguidas, de novo a cada 30 min.
// Devolve o ponto de volta criado (ou null quando não era hora, não há git ou nada mudou).
export function ensureSessionCheckpoint(cwd, sessionId, { configDir, reason = t('before the first change of the session', 'antes da primeira mudança da sessão'), now = Date.now(), every = CHECKPOINT_EVERY_MS } = {}) {
  if (!sessionId || !configDir) return null
  const root = gitRoot(cwd)
  if (!root) return null
  const marker = path.join(configDir, `checkpoint-${String(sessionId).replace(/[^\w-]/g, '')}`)
  let last = 0
  try {
    last = Number(fs.readFileSync(marker, 'utf8')) || 0
  } catch {
    // Primeira vez nesta sessão (sem marcador).
  }
  if (last && now - last < every) return null
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(marker, String(now))
  cleanMarkers(configDir, now)
  const c = createCheckpoint(root, { reason: last ? t('before continuing the changes (30 min after the last point)', 'antes de continuar as mudanças (30 min depois do último ponto)') : reason, session: sessionId, now })
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
  const head = t(`Restore the point from ${when} (${checkpoint.reason}).`, `Voltar para o ponto de ${when} (${checkpoint.reason}).`)
  if (!changes.length) return `${head} ${t('The files already match this point: nothing changes.', 'Os arquivos já estão iguais a este ponto: nada muda.')}`
  const list = (items) => `${items.slice(0, max).map((c) => c.path).join(', ')}${items.length > max ? t(` and ${items.length - max} more`, ` e mais ${items.length - max}`) : ''}`
  const of = (s) => changes.filter((c) => c.status === s)
  const lines = [head, t('What happens to the files:', 'O que acontece com os arquivos:')]
  if (of('alterado').length)
    lines.push(
      t(
        `- ${of('alterado').length} go back to how they were; the changes made to them after the point are lost: ${list(of('alterado'))}`,
        `- ${of('alterado').length} voltam como eram; as mudanças feitas neles depois do ponto se perdem: ${list(of('alterado'))}`,
      ),
    )
  if (of('criado').length) lines.push(t(`- ${of('criado').length} created after the point are deleted: ${list(of('criado'))}`, `- ${of('criado').length} criados depois do ponto são apagados: ${list(of('criado'))}`))
  if (of('apagado').length) lines.push(t(`- ${of('apagado').length} deleted after the point come back: ${list(of('apagado'))}`, `- ${of('apagado').length} apagados depois do ponto voltam: ${list(of('apagado'))}`))
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
    t('What does not change: the .env, node_modules, the database and the git commits.', 'O que não muda: o .env, o node_modules, o banco de dados e os commits do git.'),
    t('The current state is saved first, as a new restore point: the restore can be undone.', 'O estado de agora é salvo antes, como um ponto de volta novo: dá para desfazer a volta.'),
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
