// Regras da casa (.faundr-regras), padrões proibidos da memória e atalhos sem prazo no código
// (parte de quality-rules.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { matchesPath, readRules } from './rules.mjs'
import { read } from './quality-common.mjs'

// ---------- regras da casa (.faundr-regras/*.md) ----------

const HOUSE_DIR = '.faundr-regras'
const SEVERITY_PT_IN = { alta: 'high', media: 'medium', média: 'medium', baixa: 'low', high: 'high', medium: 'medium', low: 'low' }

// "src/**/*.tsx" → expressão regular; vários padrões separados por vírgula.
function globToRegex(glob) {
  const one = (g) =>
    g
      .trim()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0000')
      .replace(/\*\*/g, '\u0001')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\u0000/g, '(.*/)?')
      .replace(/\u0001/g, '.*')
  return new RegExp(`^(${glob.split(',').map(one).join('|')})$`)
}

/** Regras escritas pelo time: uma por arquivo .md com frontmatter (nome, padrao, arquivos, gravidade) e a mensagem no corpo. */
// Regras e decisões da memória com padrão proibido (faundr rule "..." --forbid "<padrão>"), da cópia local que
// o guard usa. Mesmo caminho das regras da casa, com outro texto.
export function memoryRules(root) {
  const out = []
  for (const r of readRules(root)) {
    if (!r.forbid) continue
    let re
    try {
      re = new RegExp(r.forbid)
    } catch {
      continue
    }
    out.push({
      rule: `memoria/${String(r.id).slice(0, 8)}`,
      files: { test: (rel) => (r.paths ?? []).some((p) => matchesPath(p, rel)) },
      ctx: { memory: true, name: r.title, message: r.body ?? '', pattern: r.forbid, severity: 'medium' },
      lines: (text) => text.split('\n').flatMap((l, i) => (re.test(l) ? [i + 1] : [])),
    })
  }
  return out
}

export function houseRules(root) {
  let names = []
  try {
    names = fs.readdirSync(path.join(root, HOUSE_DIR)).filter((f) => f.endsWith('.md'))
  } catch {
    // Sem a pasta: o projeto não tem regras da casa.
    return []
  }
  const out = []
  for (const name of names) {
    const text = read(root, `${HOUSE_DIR}/${name}`) ?? ''
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!m) continue
    const meta = Object.fromEntries(
      m[1].split(/\r?\n/).map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, '')]),
    )
    // Chaves em português (como o faundr quality-rule grava) ou em inglês.
    const pattern = meta.padrao ?? meta.pattern
    const active = meta.ativo ?? meta.active
    if (!pattern || active === 'nao' || active === 'no' || active === 'false') continue
    let re
    try {
      re = new RegExp(pattern.replace(/\\\\/g, '\\'))
    } catch {
      // Padrão inválido: a regra fica de fora (o comando quality-rule avisa ao criar).
      continue
    }
    const id = name.replace(/\.md$/, '')
    out.push({
      rule: `casa/${id}`,
      files: globToRegex(meta.arquivos || meta.files || '**/*'),
      ctx: { name: meta.nome || meta.name || id, message: m[2].trim().slice(0, 1500), severity: SEVERITY_PT_IN[(meta.gravidade ?? meta.severity)?.toLowerCase()] ?? 'medium', file: `${HOUSE_DIR}/${name}` },
      lines: (text2) => text2.split('\n').flatMap((l, i) => (re.test(l) ? [i + 1] : [])),
    })
  }
  return out
}

// ---------- livro de atalhos (// faundr: <limite>, <quando melhorar>) ----------

// O comentário começa a linha ou vem depois do código (não conta texto dentro de aspas).
const SHORTCUT = /(?:^\s*|[;{}),]\s*)(?:\/\/|\/\*|#|\*)\s*faundr:\s*(.+?)\s*(?:\*\/)?$/
const TRIGGER = /,\s*\S.*|\b(quando|se|depois|até|assim que|when|if|once|after|until|as soon as)\b/i

/** Comentários que registram uma simplificação consciente. Sem gatilho ("quando…"), viram achado. */
export function shortcutsIn(text) {
  const out = []
  text.split('\n').forEach((l, i) => {
    const m = l.match(SHORTCUT)
    if (!m) return
    const body = m[1].trim()
    const [limit, ...rest] = body.split(/,\s*/)
    out.push({ line: i + 1, text: body, limit, trigger: rest.join(', ') || (TRIGGER.test(body) ? body : '') })
  })
  return out
}
