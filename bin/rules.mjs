// Regras e decisões ligadas a arquivos (ideia do Graft, brain/attach.ts). O início da sessão traz a lista do servidor
// e o plugin guarda em .faundr/rules.json; o guard (antes de cada edição, sem rede) entrega as que valem para o arquivo.
import fs from 'node:fs'
import path from 'node:path'

const rulesFile = (root) => path.join(root, '.faundr', 'rules.json')

export function readRules(root) {
  try {
    const rules = JSON.parse(fs.readFileSync(rulesFile(root), 'utf8'))
    return Array.isArray(rules) ? rules : []
  } catch {
    return []
  }
}

export function writeRules(root, rules) {
  fs.mkdirSync(path.dirname(rulesFile(root)), { recursive: true })
  fs.writeFileSync(rulesFile(root), JSON.stringify(rules ?? [], null, 2))
}

const isGlob = (p) => /[*?]/.test(p)

/** `src/server/**`, `*.sql`, `plugin/bin/faundr.mjs` ou uma pasta (`src/server` vale para tudo dentro dela). */
export function matchesPath(pattern, rel) {
  const p = pattern.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
  if (!isGlob(p)) return rel === p || rel.startsWith(`${p}/`)
  const re = p
    .split(/(\*\*\/?|\*|\?)/)
    .map((part) => (part === '**/' || part === '**' ? '(?:.*/)?' + (part === '**' ? '.*' : '') : part === '*' ? '[^/]*' : part === '?' ? '[^/]' : part.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
    .join('')
  // Sem barra no padrão (`*.sql`), vale em qualquer pasta.
  return new RegExp(`^${p.includes('/') ? '' : '(?:.*/)?'}${re}$`).test(rel)
}

/** Caminhos exatos da regra que não existem mais no projeto (a regra pode ter ficado para trás). */
export function missingPaths(root, rule) {
  return rule.paths.filter((p) => !isGlob(p) && !fs.existsSync(path.join(root, p)))
}

/** As regras que valem para o arquivo e ainda não foram mostradas nesta sessão (até `max`). */
export function rulesFor(rules, rel, shownIds = [], max = 6) {
  return rules.filter((r) => !shownIds.includes(r.id) && r.paths?.some((p) => matchesPath(p, rel))).slice(0, max)
}

export function rulesNote(root, rel, rules) {
  if (!rules.length) return null
  const lines = rules.map((r) => {
    const body = r.body?.trim() ? ` — ${r.body.trim().replace(/\s+/g, ' ')}` : ''
    const gone = missingPaths(root, r)
    const stale = gone.length ? ` (pode estar desatualizada: ${gone.join(', ')} não existe mais; confira com o usuário)` : ''
    return `- ${r.kind === 'decision' ? 'Decisão' : 'Regra'}: ${r.title}${body}${stale}`
  })
  return `[Faundr] Regras do time para ${rel} (valem para este arquivo; siga):\n${lines.join('\n')}`
}

/** Regras com padrão proibido (forbid) que o texto contraria neste arquivo: [{ rule, line }] (linha de exemplo). */
export function forbiddenIn(rules, rel, text) {
  const out = []
  for (const r of rules) {
    if (!r.forbid || !r.paths?.some((p) => matchesPath(p, rel))) continue
    let re
    try {
      re = new RegExp(r.forbid)
    } catch {
      continue
    }
    const line = text.split('\n').find((l) => re.test(l))
    if (line !== undefined) out.push({ rule: r, line: line.trim().slice(0, 160) })
  }
  return out
}

/** Aviso antes da edição: a mudança traz algo que uma regra do time proíbe. */
export function forbiddenNote(rel, hits) {
  if (!hits.length) return null
  return [
    `[Faundr] Esta mudança em ${rel} contraria ${hits.length === 1 ? 'uma regra' : `${hits.length} regras`} do time:`,
    ...hits.map((h) => `- "${h.rule.title}" (o código não pode ter: ${h.rule.forbid}). Trecho: ${h.line}`),
    'Ajuste antes de gravar. Se a regra não vale mais, pergunte ao usuário antes de seguir (ela pode ser mudada no painel, em Memória).',
  ].join('\n')
}
