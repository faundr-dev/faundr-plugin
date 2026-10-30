// Etapas em paralelo: as etapas planejadas que não dependem umas das outras vão, cada uma, para uma mesa (uma
// cópia de trabalho do git em .faundr/mesas/<nome>, na branch mesa/<nome>), onde um ajudante (subagente) da
// mesma sessão constrói a etapa. Depois a sessão junta as mesas no projeto, uma de cada vez, com os testes.
// Nada aqui abre o Claude Code por programa: os ajudantes são subagentes que a própria sessão chama.
//
// A mesa fica dentro de .faundr/ (fora do git do projeto) para o .faundr.json da raiz continuar valendo lá
// dentro: os hooks do Faundr acham o projeto subindo as pastas. Os node_modules de cada parte entram como
// atalho (junction no Windows) para os ajudantes rodarem tipos e testes sem instalar de novo.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { projectParts } from './parts.mjs'

export const MESA_DIR = '.faundr/mesas'
export const MESA_BRANCH = 'mesa/'

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`git ${args[0]}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`)
  return r.stdout.trim()
}

/** Nome curto da etapa para a pasta e a branch: sem acento, minúsculo, com hífen. */
export function mesaSlug(title) {
  return title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '') || 'etapa'
}

/**
 * Etapas que dá para começar agora: planejadas, não terminadas e com a anterior já terminada. Nenhuma depende
 * de outra da lista (a anterior de cada uma já acabou), então todas podem ir em paralelo.
 * @param {{ id, title, body, after, finished, planned, tasks }[]} features  allFeatures do quadro
 */
export function readyStages(features) {
  const byId = new Map(features.map((f) => [f.id, f]))
  return features
    .filter((f) => f.planned && !f.finished && byId.get(f.after)?.finished)
    .map((f) => ({ id: f.id, title: f.title, body: f.body ?? null, after: byId.get(f.after).title, tasks: (f.tasks ?? []).map((t) => t.title), slug: mesaSlug(f.title) }))
}

/** Abre a mesa da etapa a partir do commit atual. Devolve { slug, dir, branch }. Erro se o projeto tem mudança sem commit. */
export function openMesa(root, title) {
  if (git(root, ['status', '--porcelain', '--untracked-files=no'])) throw new Error('There are uncommitted changes: commit them first, so every workbench starts from the same code.')
  const slug = mesaSlug(title)
  const dir = path.join(root, MESA_DIR, slug)
  const branch = `${MESA_BRANCH}${slug}`
  if (fs.existsSync(dir)) return { slug, dir, branch, existed: true }
  fs.mkdirSync(path.dirname(dir), { recursive: true })
  git(root, ['worktree', 'add', '-b', branch, dir, 'HEAD'])
  for (const { dir: part } of projectParts(root)) {
    const modules = path.join(root, part, 'node_modules')
    const target = path.join(dir, part, 'node_modules')
    if (fs.existsSync(modules) && !fs.existsSync(target)) fs.symlinkSync(modules, target, 'junction')
  }
  return { slug, dir, branch, existed: false }
}

/** As mesas abertas: [{ slug, dir, branch }], pela lista de worktrees do git. */
export function listMesas(root) {
  const out = git(root, ['worktree', 'list', '--porcelain'])
  const mesas = []
  let dir = null
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) dir = line.slice(9)
    const branch = line.startsWith('branch refs/heads/') ? line.slice(18) : null
    if (branch?.startsWith(MESA_BRANCH)) mesas.push({ slug: branch.slice(MESA_BRANCH.length), dir: path.normalize(dir), branch })
  }
  return mesas
}

/**
 * Fecha a mesa: tira os atalhos de node_modules (para o git não apagar os pacotes de verdade), remove a cópia
 * e apaga a branch só se ela já foi juntada. Devolve { removed, branchKept }.
 */
export function closeMesa(root, slug) {
  const mesa = listMesas(root).find((m) => m.slug === slug)
  if (!mesa) throw new Error(`No open workbench named ${slug}.`)
  for (const { dir: part } of projectParts(root)) {
    const link = path.join(mesa.dir, part, 'node_modules')
    if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link)
  }
  git(root, ['worktree', 'remove', mesa.dir])
  const merged = spawnSync('git', ['branch', '-d', mesa.branch], { cwd: root, encoding: 'utf8', windowsHide: true }).status === 0
  return { removed: mesa.dir, branchKept: merged ? null : mesa.branch }
}
