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
