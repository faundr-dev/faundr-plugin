// Planejado x construído: quais peças da arquitetura já existem no código. Sem IA e sem rede: cada peça diz onde
// mora (paths, ex.: "src/routes/agenda/**"); aqui os caminhos são comparados com os arquivos do projeto.

// "src/routes/agenda/**" → tudo dentro da pasta; "src/*.ts" → arquivos .ts direto em src; "src/lib/cupom.ts" → o
// arquivo; "src/routes/agenda" (sem curinga) → o arquivo ou qualquer coisa dentro da pasta.
export function pathMatcher(pattern) {
  const p = pattern.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
  if (!/[*?]/.test(p)) return (file) => file === p || file.startsWith(`${p}/`)
  let re = ''
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '*' && p[i + 1] === '*') {
      // "**/" casa zero ou mais pastas; "**" no fim casa tudo.
      if (p[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 2
      } else {
        re += '.*'
        i += 1
      }
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  const rx = new RegExp(`^${re}$`)
  return (file) => rx.test(file)
}

/** { "<id da peça>": { built, files } } só para as peças que têm paths; as outras ficam como foram desenhadas. */
export function checkBuilt(spec, files) {
  const out = {}
  for (const node of spec?.nodes ?? []) {
    if (!Array.isArray(node.paths) || !node.paths.length) continue
    const matchers = node.paths.filter((p) => typeof p === 'string' && p.trim()).map(pathMatcher)
    const count = files.filter((f) => matchers.some((m) => m(f))).length
    out[node.id] = { built: count > 0, files: count }
  }
  return out
}

// Código fora do plano: arquivos de código que nenhuma peça da arquitetura cobre, agrupados por pasta. Só conta
// código (testes, docs, configuração, imagens, fontes e arquivos gerados ficam de fora) para a lista não virar ruído.
const CODE = /\.(m?[jt]sx?|cjs|cts|py|go|rs|rb|php|java|kt|swift|vue|svelte|astro|sql|cs|dart|ex|exs|scala|c|cc|cpp|h|hpp|lua|sh)$/i
const NOISE = /(^|\/)(tests?|__tests__|__mocks__|specs?|e2e|bench|benchmarks?|fixtures?|examples?|docs?|\.github|\.vscode|\.husky)(\/|$)|\.(test|spec|stories|story|gen|generated|config|d)\.[^/]+$|(^|\/)(vite|vitest|jest|eslint|prettier|tailwind|postcss|playwright|tsup|rollup|webpack|babel|next|nuxt|astro|svelte|wrangler)\.[^/]*$/i
export const OFF_PLAN_MAX = 10

/** Lê as linhas do .faundrignore (mesmo formato simples do .gitignore: pasta ou arquivo por linha). */
export function readIgnore(text) {
  return (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\\/g, '/').replace(/^\.?\//, ''))
    .filter((l) => l && !l.startsWith('#'))
}

/**
 * { folders: [{ folder, files }] (as maiores primeiro, até OFF_PLAN_MAX), more, total, names } ou null sem peça com
 * paths. `names` tem todas as pastas (para achar as novas); não vai para o painel.
 */
export function offPlan(spec, files, ignore = []) {
  const matchers = (spec?.nodes ?? []).flatMap((n) => (Array.isArray(n.paths) ? n.paths : [])).filter((p) => typeof p === 'string' && p.trim()).map(pathMatcher)
  if (!matchers.length) return null
  const ignored = ignore.map(pathMatcher)
  const count = new Map()
  for (const f of files) {
    if (!f.includes('/') || !CODE.test(f) || NOISE.test(f) || ignored.some((m) => m(f)) || matchers.some((m) => m(f))) continue
    const folder = f.split('/').slice(0, -1).slice(0, 2).join('/')
    count.set(folder, (count.get(folder) ?? 0) + 1)
  }
  const all = [...count].map(([folder, n]) => ({ folder, files: n })).sort((a, b) => b.files - a.files || a.folder.localeCompare(b.folder))
  const shown = all.slice(0, OFF_PLAN_MAX)
  return { folders: shown, more: all.length - shown.length, total: all.reduce((s, f) => s + f.files, 0), names: all.map((f) => f.folder) }
}

/** Pastas fora do plano que não estavam na conferência anterior. Na primeira conferência nada é novo (o painel mostra). */
export function newOffPlan(names, seen) {
  if (!Array.isArray(seen)) return []
  const before = new Set(seen)
  return names.filter((n) => !before.has(n))
}
