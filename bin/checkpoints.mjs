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
    } catch {}
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
    if (!header.includes(' blob ') || Number.isNaN(size)) throw new Error(`não achei ${p} no ponto de volta`)
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
export function createCheckpoint(root, { reason = 'ponto de volta', session = null, now = Date.now() } = {}) {
  const tree = currentTree(root)
  const all = listCheckpoints(root)
  if (all[0]?.tree === tree) return { ...all[0], created: false }
  let head = null
  try {
    head = git(root, ['rev-parse', '--verify', '-q', 'HEAD']).trim() || null
  } catch {}
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
  const saved = createCheckpoint(root, { reason: `antes de voltar para o ponto de ${new Date(checkpoint.at).toLocaleString('pt-BR')}`, session })
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
    } catch {}
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
export function ensureSessionCheckpoint(cwd, sessionId, { configDir, reason = 'antes da primeira mudança da sessão', now = Date.now(), every = CHECKPOINT_EVERY_MS } = {}) {
  if (!sessionId || !configDir) return null
  const root = gitRoot(cwd)
  if (!root) return null
  const marker = path.join(configDir, `checkpoint-${String(sessionId).replace(/[^\w-]/g, '')}`)
  let last = 0
  try {
    last = Number(fs.readFileSync(marker, 'utf8')) || 0
  } catch {}
  if (last && now - last < every) return null
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(marker, String(now))
  cleanMarkers(configDir, now)
  const c = createCheckpoint(root, { reason: last ? 'antes de continuar as mudanças (30 min depois do último ponto)' : reason, session: sessionId, now })
  return c.created ? c : null
}

function cleanMarkers(configDir, now) {
  try {
    for (const f of fs.readdirSync(configDir)) {
      if (!f.startsWith('checkpoint-')) continue
      const file = path.join(configDir, f)
      if (now - fs.statSync(file).mtimeMs > 2 * 24 * 3600_000) fs.unlinkSync(file)
    }
  } catch {}
}

// Resumo em português simples de uma lista de mudanças: "3 alterados, 1 criado (a.ts, b.ts, …)".
export function describeChanges(changes, max = 4) {
  if (!changes.length) return 'nada mudou desde então'
  const count = (s) => changes.filter((c) => c.status === s).length
  const parts = [
    count('alterado') && `${count('alterado')} alterado${count('alterado') > 1 ? 's' : ''}`,
    count('criado') && `${count('criado')} criado${count('criado') > 1 ? 's' : ''}`,
    count('apagado') && `${count('apagado')} apagado${count('apagado') > 1 ? 's' : ''}`,
  ].filter(Boolean)
  const names = changes.slice(0, max).map((c) => c.path.split('/').pop())
  return `${parts.join(', ')} (${names.join(', ')}${changes.length > max ? ', …' : ''})`
}
