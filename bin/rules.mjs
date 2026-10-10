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

// ---- memória pelo assunto do pedido ----------------------------------------------------------
// O início da sessão traz as regras e poucas decisões; as outras ficam numa cópia local (.faundr/memory.json) e o
// hook do pedido (prompt-check.mjs, sem rede) entrega as que falam do mesmo assunto, cada uma uma vez por sessão.

const memoryFile = (root) => path.join(root, '.faundr', 'memory.json')

export function readMemoryIndex(root) {
  try {
    const items = JSON.parse(fs.readFileSync(memoryFile(root), 'utf8'))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

export function writeMemoryIndex(root, items) {
  fs.mkdirSync(path.dirname(memoryFile(root)), { recursive: true })
  fs.writeFileSync(memoryFile(root), JSON.stringify(items ?? []))
}

const STOP = new Set(
  'para pela pelo pelos pelas como mais menos quando onde porque porquê sobre entre depois antes ainda isso isto esse essa este esta esses essas estes estas aquele aquela tudo todo toda todos todas cada mesmo mesma muito muita outro outra outros outras qual quais quem fazer feito faça faz pode podem deve devem precisa preciso quero queria seria sera será ser estar está estao estão fica ficam ficar tambem também agora aqui dele dela deles delas nosso nossa seus suas meu minha voce você vocês voces então entao assim coisa coisas algo alguma algum nada nunca sempre sem com uma umas uns dos das nas nos num numa vez vezes certo veja olha acho tipo sim não nao bem bom boa claude faundr'
    .split(' '),
)

/** Radicais das palavras com 4+ letras, sem acento e sem o plural: "Decisões técnicas" → ["decisoe", "tecnica"]. */
export function stemsOf(text) {
  const out = new Set()
  for (const raw of String(text ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 4 || STOP.has(raw) || /^\d+$/.test(raw)) continue
    out.add(raw.replace(/s$/, '').slice(0, 7))
  }
  return out
}

/**
 * Regras e decisões do assunto do pedido: cada palavra em comum vale mais quanto mais rara ela é na memória (e mais
 * no título). Exige 2+ palavras raras em comum (uma delas no título), para um termo solto não trazer decisão sem relação.
 */
export function relevantMemory(index, prompt, shownIds = [], { max = 3, minScore = 6 } = {}) {
  // Texto colado não é o pedido: só o que a pessoa escreveu.
  const asked = stemsOf(String(prompt ?? '').replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' '))
  if (asked.size < 2 || !index.length) return []
  const docs = index.map((m) => ({ m, title: stemsOf(m.title), body: stemsOf(m.body) }))
  const df = new Map()
  for (const d of docs) for (const s of new Set([...d.title, ...d.body])) df.set(s, (df.get(s) ?? 0) + 1)
  const idf = (s) => Math.log((docs.length + 1) / (df.get(s) ?? docs.length))
  // Palavra que aparece em muitas regras e decisões ("comando", "projeto") não diz o assunto.
  const rare = (s) => (df.get(s) ?? 0) <= Math.max(3, Math.ceil(docs.length * 0.1))
  return docs
    .filter((d) => !shownIds.includes(d.m.id))
    .map((d) => {
      const hits = [...asked].filter((s) => d.title.has(s) || d.body.has(s))
      const score = hits.reduce((n, s) => n + idf(s) * (d.title.has(s) ? 1.5 : 1), 0)
      return { m: d.m, hits, score, strong: hits.filter(rare), inTitle: hits.some((s) => d.title.has(s) && rare(s)) }
    })
    .filter((r) => r.strong.length >= 2 && r.inTitle && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((r) => r.m)
}

export function memoryNote(items) {
  if (!items.length) return null
  return [
    '[Faundr] Regras e decisões do time sobre o assunto deste pedido (siga; não proponha alternativas sem o usuário pedir):',
    ...items.map((m) => `- ${m.kind === 'rule' ? 'Regra' : 'Decisão'}: ${m.title}${m.body ? ` — ${m.body}` : ''}`),
  ].join('\n')
}

/** Regras do time sem arquivo ligado: valem sempre (vão também para os subagentes). */
export const globalRules = (index) => index.filter((m) => m.kind === 'rule' && !m.paths?.length)
