// Partes do projeto: a raiz e as subpastas (até 2 níveis) com o próprio package.json, como frontend/ ou
// apps/web/. Um projeto dividido assim tem dependências, scripts e node_modules em cada parte; quem olha só
// a raiz não acha o Tailwind, o tsc ou o script "dev" que estão em frontend/. Toda checagem que lê
// package.json ou node_modules passa por aqui.

import fs from 'node:fs'
import path from 'node:path'

// Pastas que nunca guardam uma parte do projeto (dependências, saídas, ambientes Python).
const SKIP_DIR = /^(node_modules|dist|build|out|coverage|vendor|venv|env|__pycache__|site-packages)$/

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // Sem o arquivo ou JSON inválido: tratado como vazio.
    return null
  }
}

/** Subpastas (até 2 níveis, sem as ocultas) em que `has(dir)` é verdade. Caminhos com "/", relativos à raiz. */
export function subDirs(root, has) {
  const dirs = []
  const walk = (rel, depth) => {
    let entries
    try {
      entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true })
    } catch {
      // Pasta sem permissão de leitura: fica de fora.
      return
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIP_DIR.test(e.name)) continue
      const sub = rel ? `${rel}/${e.name}` : e.name
      if (has(sub)) dirs.push(sub)
      if (depth < 2) walk(sub, depth + 1)
    }
  }
  walk('', 1)
  return dirs
}

/** As partes com package.json: [{ dir: '' | 'frontend', pkg }]. A raiz vem primeiro, mesmo sem package.json. */
export function projectParts(root) {
  const subs = subDirs(root, (d) => fs.existsSync(path.join(root, d, 'package.json')))
  return [{ dir: '', pkg: readJson(path.join(root, 'package.json')) ?? {} }, ...subs.map((dir) => ({ dir, pkg: readJson(path.join(root, dir, 'package.json')) ?? {} }))]
}

const depsOf = (pkg) => ({ ...pkg.dependencies, ...pkg.devDependencies })

/** Dependências de todas as partes juntas (a da raiz vence quando o mesmo pacote aparece em duas). */
export function allDeps(root, parts = projectParts(root)) {
  return Object.assign({}, ...parts.slice(1).map((p) => depsOf(p.pkg)), depsOf(parts[0].pkg))
}

/** A parte que declara o pacote (a raiz primeiro); null se nenhuma declara. */
export function partWith(root, name, parts = projectParts(root)) {
  return parts.find((p) => depsOf(p.pkg)[name]) ?? null
}

/** Um arquivo dentro de node_modules (ex.: 'tailwindcss/theme.css'): o da raiz ou o de uma parte. */
export function inNodeModules(root, rel, parts = projectParts(root)) {
  for (const { dir } of parts) {
    const file = path.join(root, dir, 'node_modules', rel)
    if (fs.existsSync(file)) return file
  }
  return null
}

/** Pasta que é um plugin do Claude Code (tem .claude-plugin/plugin.json): não é tela nem estilo do app. */
export const isClaudePlugin = (absDir) => fs.existsSync(path.join(absDir, '.claude-plugin', 'plugin.json'))

/** Os scripts de todas as partes: [{ dir, name, cmd }]. */
export function allScripts(root, parts = projectParts(root)) {
  return parts.flatMap(({ dir, pkg }) => Object.entries(pkg.scripts ?? {}).map(([name, cmd]) => ({ dir, name, cmd: String(cmd) })))
}
