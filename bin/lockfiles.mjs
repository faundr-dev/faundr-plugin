// Leitores de lockfile sem dependências, para a checagem de pacotes (security.mjs → OSV.dev).
// Cada leitor devolve pacotes { name, version, dev, via } — via = caminho "a > b > pacote" a partir de
// uma dependência direta — e o gerenciador, para a dica de correção usar o comando certo.
//
// Formatos: npm (package-lock v1/v2/v3), pnpm (v5/v6/v9), yarn (v1 e berry), bun (bun.lock),
// Python (requirements.txt com ==, poetry.lock, uv.lock, Pipfile.lock).
import path from 'node:path'

export const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|requirements[\w.-]*\.txt|poetry\.lock|uv\.lock|Pipfile\.lock)$/

/** Lê um lockfile. `readManifest(dir)` devolve o package.json da pasta (ou {}). */
export function parseLockfile(rel, text, readManifest) {
  const base = path.posix.basename(rel)
  const manifest = () => readManifest(path.posix.dirname(rel))
  if (base === 'package-lock.json' || base === 'npm-shrinkwrap.json') return { ecosystem: 'npm', manager: 'npm', pkgs: npmLock(text, manifest) }
  if (base === 'pnpm-lock.yaml') return { ecosystem: 'npm', manager: 'pnpm', pkgs: pnpmLock(text) }
  if (base === 'yarn.lock') return { ecosystem: 'npm', manager: 'yarn', pkgs: text.includes('__metadata:') ? yarnBerry(text, manifest()) : yarnV1(text, manifest()) }
  if (base === 'bun.lock') return { ecosystem: 'npm', manager: 'bun', pkgs: bunLock(text) }
  if (base === 'Pipfile.lock') return { ecosystem: 'PyPI', manager: 'pipenv', pkgs: pipfileLock(text) }
  if (base === 'poetry.lock' || base === 'uv.lock') return { ecosystem: 'PyPI', manager: base === 'uv.lock' ? 'uv' : 'poetry', pkgs: tomlPackages(text) }
  if (base.startsWith('requirements')) return { ecosystem: 'PyPI', manager: 'pip', pkgs: requirements(text) }
  return null
}

// ---- grafo genérico: nós name@version, raízes de produção e de desenvolvimento ------------------

function resolveGraph(nodes, prodRoots, devRoots) {
  // nodes: Map key → { name, version, deps: [key] }; roots: [key]
  const via = new Map()
  const prod = new Set()
  const walk = (roots, mark) => {
    const queue = []
    for (const k of roots)
      if (nodes.has(k)) {
        if (!via.has(k)) via.set(k, [nodes.get(k).name])
        mark?.add(k)
        queue.push(k)
      }
    while (queue.length) {
      const k = queue.shift()
      for (const d of nodes.get(k)?.deps ?? []) {
        if (!nodes.has(d)) continue
        if (mark && !mark.has(d)) {
          mark.add(d)
          queue.push(d)
        }
        if (!via.has(d)) {
          via.set(d, [...via.get(k), nodes.get(d).name])
          if (!mark) queue.push(d)
        }
      }
    }
  }
  walk(prodRoots, prod)
  walk(devRoots, null)
  return [...nodes.entries()].map(([k, n]) => ({ name: n.name, version: n.version, dev: n.dev ?? !prod.has(k), via: via.get(k) ?? null }))
}

// ---- npm ----------------------------------------------------------------------------------------

function npmLock(text, manifest) {
  const lock = JSON.parse(text)
  const pkgs = []
  if (lock.packages) {
    for (const [key, p] of Object.entries(lock.packages)) {
      if (!key || p.link || !p.version) continue
      const name = p.name ?? key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length)
      pkgs.push({ key, name, version: p.version, dev: !!(p.dev || p.devOptional), deps: { ...p.dependencies, ...p.optionalDependencies, ...p.peerDependencies } })
    }
  } else {
    const visit = (deps, prefix) => {
      for (const [name, p] of Object.entries(deps ?? {})) {
        const key = `${prefix}node_modules/${name}`
        if (p.version && !p.version.startsWith('file:')) pkgs.push({ key, name, version: p.version, dev: !!p.dev, deps: p.requires ?? {} })
        visit(p.dependencies, `${key}/`)
      }
    }
    visit(lock.dependencies, '')
  }
  const rootManifest = lock.packages?.['']?.name ? lock.packages[''] : manifest()
  // Resolução do Node: procura em node_modules subindo a partir de quem pede.
  const byKey = new Map(pkgs.map((p) => [p.key, p]))
  const resolve = (fromKey, name) => {
    let base = fromKey
    while (true) {
      const k = `${base ? `${base}/` : ''}node_modules/${name}`
      if (byKey.has(k)) return k
      if (!base) return null
      const i = base.lastIndexOf('/node_modules/')
      base = i === -1 ? '' : base.slice(0, i)
    }
  }
  const direct = Object.keys({ ...rootManifest.dependencies, ...rootManifest.devDependencies, ...rootManifest.optionalDependencies })
  const via = new Map()
  const queue = []
  for (const name of direct) {
    const k = resolve('', name)
    if (k && !via.has(k)) {
      via.set(k, [name])
      queue.push(k)
    }
  }
  while (queue.length) {
    const k = queue.shift()
    for (const dep of Object.keys(byKey.get(k)?.deps ?? {})) {
      const child = resolve(k, dep)
      if (child && !via.has(child)) {
        via.set(child, [...via.get(k), dep])
        queue.push(child)
      }
    }
  }
  return pkgs.map((p) => ({ name: p.name, version: p.version, dev: p.dev, via: via.get(p.key) ?? null }))
}

// ---- pnpm (YAML lido linha a linha: só as chaves que importam) ---------------------------------

const unquote = (s) => s.trim().replace(/^['"]|['"]:?$/g, '').replace(/:$/, '').replace(/^['"]|['"]$/g, '')
// "/@scope/name@1.2.3(peer@1)" | "name@1.2.3" | "/name/1.2.3_peer" → { name, version }
function pnpmKey(raw) {
  let k = unquote(raw).replace(/^\//, '').replace(/\(.*$/, '')
  const at = k.lastIndexOf('@')
  if (at > 0) return { name: k.slice(0, at), version: k.slice(at + 1).replace(/_.*$/, '') }
  // formato antigo (v5): /name/1.2.3 ou /@scope/name/1.2.3
  const slash = k.lastIndexOf('/')
  return slash > 0 ? { name: k.slice(0, slash), version: k.slice(slash + 1).replace(/_.*$/, '') } : null
}
const cleanVersion = (v) => unquote(v).replace(/\(.*$/, '').replace(/_.*$/, '')

function pnpmLock(text) {
  const lines = text.split(/\r?\n/)
  const nodes = new Map()
  const prodRoots = []
  const devRoots = []
  let section = null // importers | packages | snapshots | dependencies | devDependencies (v6 top-level)
  let current = null // chave do pacote atual
  let group = null // bloco de dependências dentro de um pacote (packages/snapshots)
  let rootGroup = null // dependencies | devDependencies | optionalDependencies das raízes
  let importerDep = null // nome da dependência sendo lida nas raízes
  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    const t = line.trim()
    if (indent === 0) {
      section = t.replace(/:.*$/, '')
      rootGroup = ['dependencies', 'devDependencies', 'optionalDependencies'].includes(section) ? section : null
      current = null
      continue
    }
    if (section === 'importers' || rootGroup) {
      // importers: "  .:" → "    dependencies:" → "      name:" → "        version: x"
      // v6 sem importers: "dependencies:" → "  name:" → "    version: x"
      const depIndent = section === 'importers' ? 6 : 2
      if (section === 'importers' && indent === 4) rootGroup = t.replace(/:$/, '')
      else if (indent === depIndent && t.endsWith(':')) importerDep = unquote(t)
      else if (indent === depIndent && t.includes(': ')) {
        // formato curto (v5): "  name: 1.2.3"
        const [n, v] = [unquote(t.split(': ')[0]), cleanVersion(t.split(': ').slice(1).join(': '))]
        if (!v.startsWith('link:')) (rootGroup === 'devDependencies' ? devRoots : prodRoots).push(`${n}@${v}`)
      } else if (indent === depIndent + 2 && t.startsWith('version:') && importerDep) {
        const v = cleanVersion(t.slice('version:'.length))
        if (!v.startsWith('link:') && !v.startsWith('file:')) (rootGroup === 'devDependencies' ? devRoots : prodRoots).push(`${importerDep}@${v}`)
      }
      continue
    }
    if (section === 'packages' || section === 'snapshots') {
      if (indent === 2 && t.endsWith(':')) {
        const p = pnpmKey(t.slice(0, -1))
        current = p ? `${p.name}@${p.version}` : null
        if (p && !nodes.has(current)) nodes.set(current, { name: p.name, version: p.version, deps: [] })
        group = null
      } else if (current && indent === 4) {
        if (/^(dependencies|optionalDependencies):$/.test(t)) group = 'deps'
        else {
          group = null
          if (t === 'dev: true') nodes.get(current).dev = true
          if (t === 'dev: false') nodes.get(current).dev = false
        }
      } else if (current && indent === 6 && group === 'deps' && t.includes(': ')) {
        const [n, ...rest] = t.split(': ')
        const v = cleanVersion(rest.join(': '))
        // v6: "name: 1.2.3(peer)"; v5: "name: 1.2.3_peer"; alias "name: /other@1.0.0"
        const target = v.startsWith('/') ? pnpmKey(v) : { name: unquote(n), version: v }
        if (target) nodes.get(current).deps.push(`${target.name}@${target.version}`)
      }
    }
  }
  // Pacotes de pnpm v9 sem "dev:" viram dev = não alcançável pelas dependências de produção.
  const hasDevFlag = [...nodes.values()].some((n) => n.dev !== undefined)
  if (!hasDevFlag) for (const n of nodes.values()) delete n.dev
  return resolveGraph(nodes, prodRoots, devRoots)
}

// ---- yarn ----------------------------------------------------------------------------------------

// Cabeçalho "a@^1.0.0, a@^1.2.0:" → specs ["a@^1.0.0", "a@^1.2.0"]
const specs = (header) => header.replace(/:$/, '').split(/,\s*/).map((s) => s.trim().replace(/^"|"$/g, ''))
const specName = (spec) => spec.slice(0, spec.indexOf('@', 1))

function yarnV1(text, manifest) {
  const nodes = new Map()
  const bySpec = new Map()
  const pending = []
  let current = null
  let inDeps = false
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    if (!line.startsWith(' ')) {
      const list = specs(line)
      const name = specName(list[0])
      current = { name, version: null, deps: [], rawDeps: [] }
      for (const s of list) bySpec.set(s, current)
      pending.push(current)
      inDeps = false
    } else if (current && /^ {2}version "?([^"]+)"?/.test(line)) current.version = line.match(/^ {2}version "?([^"]+)"?/)[1]
    else if (current && /^ {2}(dependencies|optionalDependencies):/.test(line)) inDeps = true
    else if (current && /^ {2}\S/.test(line)) inDeps = false
    else if (current && inDeps && /^ {4}\S/.test(line)) {
      const m = line.trim().match(/^"?([^"\s]+)"?\s+"?([^"]+)"?$/)
      if (m) current.rawDeps.push(`${m[1]}@${m[2]}`)
    }
  }
  for (const n of pending) if (n.version) nodes.set(`${n.name}@${n.version}`, n)
  for (const n of nodes.values()) n.deps = n.rawDeps.map((s) => bySpec.get(s)).filter((x) => x?.version).map((x) => `${x.name}@${x.version}`)
  const roots = (deps) => Object.entries(deps ?? {}).map(([n, r]) => bySpec.get(`${n}@${r}`)).filter((x) => x?.version).map((x) => `${x.name}@${x.version}`)
  return resolveGraph(nodes, [...roots(manifest.dependencies), ...roots(manifest.optionalDependencies)], roots(manifest.devDependencies))
}

function yarnBerry(text, manifest) {
  const nodes = new Map()
  const bySpec = new Map()
  const all = []
  let current = null
  let inDeps = false
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    if (!line.startsWith(' ')) {
      if (line.startsWith('__metadata')) {
        current = null
        continue
      }
      const list = specs(line)
      current = { name: specName(list[0]), version: null, workspace: list.some((s) => s.includes('@workspace:')), deps: [], rawDeps: [] }
      for (const s of list) bySpec.set(s, current)
      all.push(current)
      inDeps = false
    } else if (current && /^ {2}version: /.test(line)) current.version = line.trim().slice('version: '.length).replace(/^"|"$/g, '')
    else if (current && /^ {2}(dependencies|optionalDependencies):/.test(line)) inDeps = true
    else if (current && /^ {2}\S/.test(line)) inDeps = false
    else if (current && inDeps && /^ {4}\S/.test(line)) {
      const [n, ...r] = line.trim().split(': ')
      const range = r.join(': ').replace(/^"|"$/g, '')
      const name = n.replace(/^"|"$/g, '')
      current.rawDeps.push(range.includes(':') ? `${name}@${range}` : `${name}@npm:${range}`)
    }
  }
  for (const n of all) if (n.version && !n.workspace) nodes.set(`${n.name}@${n.version}`, n)
  const key = (spec) => {
    const x = bySpec.get(spec)
    return x?.version && !x.workspace ? `${x.name}@${x.version}` : null
  }
  for (const n of nodes.values()) n.deps = n.rawDeps.map(key).filter(Boolean)
  const roots = (deps) => Object.entries(deps ?? {}).map(([n, r]) => key(r.includes(':') ? `${n}@${r}` : `${n}@npm:${r}`)).filter(Boolean)
  // Dependências do próprio workspace (raiz) também são raízes de produção.
  const wsDeps = all.filter((n) => n.workspace).flatMap((n) => n.rawDeps.map(key)).filter(Boolean)
  return resolveGraph(nodes, [...roots(manifest.dependencies), ...roots(manifest.optionalDependencies), ...wsDeps.filter((k) => !roots(manifest.devDependencies).includes(k))], roots(manifest.devDependencies))
}

// ---- bun (bun.lock é JSON com vírgulas finais) ------------------------------------------------------

function bunLock(text) {
  const lock = JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'))
  const nodes = new Map()
  const byPath = new Map()
  for (const [p, entry] of Object.entries(lock.packages ?? {})) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue
    const id = entry[0]
    const at = id.lastIndexOf('@')
    if (at <= 0) continue
    const name = id.slice(0, at)
    const version = id.slice(at + 1)
    if (/^(workspace|link|file):/.test(version)) continue
    const meta = entry.find((x) => x && typeof x === 'object' && !Array.isArray(x)) ?? {}
    const k = `${name}@${version}`
    nodes.set(k, { name, version, deps: [], rawDeps: Object.keys({ ...meta.dependencies, ...meta.optionalDependencies }), path: p })
    byPath.set(p, k)
  }
  // Resolução por caminho: "a/b" (b dentro de a) antes de "b".
  for (const n of nodes.values())
    n.deps = n.rawDeps.map((d) => byPath.get(`${n.path}/${d}`) ?? byPath.get(d)).filter(Boolean)
  const ws = lock.workspaces?.[''] ?? {}
  const roots = (deps) => Object.keys(deps ?? {}).map((d) => byPath.get(d)).filter(Boolean)
  return resolveGraph(nodes, [...roots(ws.dependencies), ...roots(ws.optionalDependencies)], roots(ws.devDependencies))
}

// ---- Python -------------------------------------------------------------------------------------

const pyName = (n) => n.toLowerCase().replace(/[-_.]+/g, '-')

function requirements(text) {
  const out = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const m = line.match(/^([A-Za-z0-9][\w.-]*)(\[[^\]]*\])?\s*==\s*([\w.!+-]+)/)
    if (m) out.push({ name: pyName(m[1]), version: m[3], dev: false, via: [pyName(m[1])] })
  }
  return out
}

function tomlPackages(text) {
  const out = []
  for (const block of text.split(/^\[\[package\]\]\s*$/m).slice(1)) {
    const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
    const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
    if (!name || !version || /^source\s*=\s*\{\s*(editable|virtual)/m.test(block)) continue
    out.push({ name: pyName(name), version, dev: /^category\s*=\s*"dev"/m.test(block), via: null })
  }
  return out
}

function pipfileLock(text) {
  const lock = JSON.parse(text)
  const out = []
  for (const [section, dev] of [['default', false], ['develop', true]])
    for (const [name, p] of Object.entries(lock[section] ?? {}))
      if (typeof p.version === 'string' && p.version.startsWith('=='))
        out.push({ name: pyName(name), version: p.version.slice(2), dev, via: [pyName(name)] })
  return out
}
