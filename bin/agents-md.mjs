// Regras e decisões do time num bloco cercado do CLAUDE.md ou AGENTS.md (ideia do Graft, hosts/sections.ts), para
// Codex, Cursor e outros agentes que não rodam os hooks do Faundr verem a memória. Desligado por padrão.
import fs from 'node:fs'
import path from 'node:path'

export const START = '<!-- faundr:inicio (gerado pelo Faundr; edite as regras no painel, não aqui) -->'
export const END = '<!-- faundr:fim -->'

const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n')
const oneLine = (s) => String(s ?? '').trim().replace(/\s+/g, ' ')

/** O texto do bloco: regras (as ligadas a arquivos dizem onde valem) e decisões. */
export function agentsBlock(items, projectName) {
  const line = (n) => {
    const body = oneLine(n.body)
    const where = n.paths?.length ? ` (vale para: ${n.paths.join(', ')})` : ''
    return `- ${oneLine(n.title)}${body ? ` — ${body}` : ''}${where}`
  }
  const rules = items.filter((n) => n.kind === 'rule')
  const decisions = items.filter((n) => n.kind === 'decision')
  return [
    `## Memória do time${projectName ? ` (${projectName})` : ''}, pelo Faundr`,
    '',
    ...(rules.length ? ['Regras (siga sempre):', ...rules.map(line), ''] : []),
    ...(decisions.length ? ['Decisões técnicas já tomadas (não proponha alternativas sem o usuário pedir):', ...decisions.map(line), ''] : []),
    ...(!rules.length && !decisions.length ? ['Nenhuma regra ou decisão registrada ainda.', ''] : []),
  ].join('\n')
}

const findMarkers = (lines) => {
  const s = lines.findIndex((l) => l.trim().startsWith('<!-- faundr:inicio'))
  const e = s === -1 ? -1 : lines.findIndex((l, i) => i > s && l.trim() === END)
  return { s, e }
}

/** Cria, troca ou acrescenta o bloco; o resto do arquivo fica igual. */
export function upsertBlock(file, body) {
  const fenced = (eol) => [START, ...body.split('\n'), END].join(eol)
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${fenced('\n')}\n`)
    return 'criado'
  }
  const text = fs.readFileSync(file, 'utf8')
  const eol = eolOf(text)
  const lines = text.split(/\r\n|\n/)
  const { s, e } = findMarkers(lines)
  if (s !== -1 && e !== -1) {
    if (lines.slice(s, e + 1).join('\n') === fenced('\n')) return 'igual'
    fs.writeFileSync(file, [...lines.slice(0, s), ...fenced(eol).split(eol), ...lines.slice(e + 1)].join(eol))
    return 'atualizado'
  }
  const sep = text.endsWith(eol + eol) ? '' : text.endsWith(eol) ? eol : eol + eol
  fs.writeFileSync(file, `${text}${sep}${fenced(eol)}${eol}`)
  return 'acrescentado'
}

/** Tira o bloco (e apaga o arquivo se ele só tinha o bloco). */
export function removeBlock(file) {
  if (!fs.existsSync(file)) return 'sem-arquivo'
  const text = fs.readFileSync(file, 'utf8')
  const eol = eolOf(text)
  const lines = text.split(/\r\n|\n/)
  const { s, e } = findMarkers(lines)
  if (s === -1 || e === -1) return 'sem-bloco'
  const rest = [...lines.slice(0, s), ...lines.slice(e + 1)].join(eol).replace(/(\r?\n){3,}/g, eol + eol)
  if (!rest.trim()) {
    fs.unlinkSync(file)
    return 'apagado'
  }
  fs.writeFileSync(file, rest.endsWith(eol) ? rest : rest + eol)
  return 'removido'
}
