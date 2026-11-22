// O git da checagem de qualidade: a branch do relatório, a autoria das linhas (TODOs e atalhos) e o cache das
// ferramentas do projeto (tsc, ESLint). Todo comando tem prazo: o git parado não trava a checagem.
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { readJson } from './cli-core.mjs'
import { writeJsonAtomic } from './json-file.mjs'
import { faundrPath } from './paths.mjs'

const GIT_TIMEOUT = 10_000
const BLAME_TIMEOUT = 20_000
const STATUS_TIMEOUT = 20_000

const git = (root, args, timeout = GIT_TIMEOUT) =>
  spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024 })

/** A pasta é um repositório git que responde? */
export const insideGit = (root) => git(root, ['rev-parse', '--is-inside-work-tree']).status === 0

/**
 * A branch em que a checagem roda e se ela é a principal do repositório (a que o remoto aponta em origin/HEAD;
 * sem isso, main ou master). HEAD solto ou pasta sem git: sem branch. O servidor usa os dois para uma branch de
 * trabalho não fechar os achados que só existem na principal.
 */
export function branchInfo(root) {
  const head = git(root, ['symbolic-ref', '--short', '-q', 'HEAD'])
  const branch = head.status === 0 ? head.stdout.trim() : ''
  if (!branch) return { branch: null, defaultBranch: false }
  const origin = git(root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD'])
  const main = origin.status === 0 ? origin.stdout.trim().replace(/^origin\//, '') : ''
  return { branch, defaultBranch: main ? branch === main : branch === 'main' || branch === 'master' }
}

/**
 * Autor e data (em segundos) das linhas pedidas de um arquivo, num `git blame` só. Devolve Map linha → { author,
 * time }. Mapa vazio: o arquivo ainda não tem commit (as linhas são de agora). null: o git falhou ou passou do
 * prazo, e quem chamou não sabe a idade das linhas.
 */
export function blameLines(root, file, lines) {
  const wanted = [...new Set(lines)].filter((n) => Number.isInteger(n) && n > 0)
  if (!wanted.length) return new Map()
  const r = git(root, ['blame', '--porcelain', ...wanted.flatMap((n) => ['-L', `${n},${n}`]), '--', file], BLAME_TIMEOUT)
  if (r.status !== 0) {
    // Arquivo novo (no índice ou solto, sem commit): o blame recusa, e não é falha.
    const committed = !r.error && git(root, ['cat-file', '-e', `HEAD:${file}`]).status === 0
    return r.error || committed ? null : new Map()
  }
  // Formato: "<commit> <linha original> <linha final> [n]"; os dados do commit vêm só na primeira vez que ele
  // aparece; o texto da linha começa com tab.
  const commits = new Map()
  const out = new Map()
  let current = null
  for (const row of r.stdout.split('\n')) {
    if (row.startsWith('\t')) continue
    const head = row.match(/^([0-9a-f]{40,64}) \d+ (\d+)(?: \d+)?\s*$/)
    if (head) {
      current = commits.get(head[1]) ?? { author: null, time: 0 }
      commits.set(head[1], current)
      out.set(Number(head[2]), current)
    } else if (current && row.startsWith('author ')) current.author = row.slice(7).trim()
    else if (current && row.startsWith('author-time ')) current.time = Number(row.slice(12)) || 0
  }
  return out
}

// ---------- cache das ferramentas do projeto ----------

/**
 * Impressão digital do código: o commit atual, o que está alterado ou novo fora dele (com data e tamanho de cada
 * arquivo) e a versão do plugin. Igual à da última vez = nada mudou, e o tsc e o ESLint dariam o mesmo resultado.
 * null sem git: aí não há cache.
 */
export function codeStateKey(root, version) {
  const head = git(root, ['rev-parse', 'HEAD'])
  if (head.status !== 0) return null
  const status = git(root, ['status', '--porcelain', '-z', '--untracked-files=all'], STATUS_TIMEOUT)
  if (status.status !== 0) return null
  const hash = crypto.createHash('sha256').update(`${version ?? ''}\n${head.stdout.trim()}\n`)
  for (const entry of status.stdout.split('\0').filter(Boolean).sort()) {
    // "XY caminho"; no renomeado, o nome antigo vem sozinho no item seguinte.
    const file = /^.. /.test(entry) ? entry.slice(3) : entry
    // A pasta do Faundr (onde este cache mora) não é código do projeto.
    if (file.startsWith('.faundr/')) continue
    let stat = 'gone'
    try {
      const s = fs.statSync(path.join(root, file))
      stat = `${s.mtimeMs}:${s.size}`
    } catch {
      // Apagado: entra na chave como apagado.
    }
    hash.update(`${entry}\n${stat}\n`)
  }
  return hash.digest('hex')
}

/** O que cada ferramenta achou da última vez, por parte do projeto ("ts|frontend"), se o código não mudou desde então. */
export function readToolsCache(root, key) {
  if (!key) return {}
  const saved = readJson(faundrPath(root, 'qualityTools'))
  return saved?.key === key && saved.tools && typeof saved.tools === 'object' ? saved.tools : {}
}

/** Guarda o resultado das ferramentas para este estado do código (arquivo temporário + troca de nome). */
export function writeToolsCache(root, key, tools) {
  if (!key) return
  try {
    writeJsonAtomic(faundrPath(root, 'qualityTools'), { key, at: new Date().toISOString(), tools })
  } catch {
    // Sem permissão de escrita ou disco cheio: a próxima checagem só roda as ferramentas de novo.
  }
}
