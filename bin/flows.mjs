// Workflows padrão do Faundr: o que o plugin faz sozinho em cada momento (início, cada pedido, durante o trabalho, fim
// da resposta), desenhado na aba Workflows do painel. Ali o time desliga passos; a lista das chaves desligadas
// ('stop.design', 'prompt.team'…) chega no início, a cada pedido e no fim da resposta, e fica em
// .faundr/painel/flows.json para os hooks lerem sem rede. As chaves são as de src/lib/faundr-flows.ts.
import fs from 'node:fs'
import path from 'node:path'
import { faundrPath } from './paths.mjs'

const file = (root) => faundrPath(root, 'flows')

export function writeFlows(root, off) {
  fs.mkdirSync(path.dirname(file(root)), { recursive: true })
  fs.writeFileSync(file(root), JSON.stringify(Array.isArray(off) ? off : []))
}

/** O projeto desligou este passo? Sem cópia local (ou com erro), tudo ligado. */
export function stepOff(root, key) {
  try {
    const off = JSON.parse(fs.readFileSync(file(root), 'utf8'))
    return Array.isArray(off) && off.includes(key)
  } catch {
    // Sem cópia local (ou ilegível): tudo ligado.
    return false
  }
}

// ---- Passos desligados de dentro das skills do Faundr ----------------------------------------------------------
// A skill é um texto que o Claude segue: quando ela entra (ferramenta Skill ou /faundr:x digitado), o Faundr avisa
// quais passos o projeto desligou. Só passos opcionais; nunca segurança, prova ou pergunta ao dono.

/** Chave do passo → [skill, o que pular]. As chaves batem com os desenhos (src/lib/faundr-skill-flows.ts). */
export const SKILL_STEPS = {
  'skill.planning.review': ['planning', 'the hidden subagent review on a large request'],
  'skill.planning.diagram': ['planning', 'offering and drawing the diagram of how the feature will work'],
  'skill.design.browser': ['design', 'measuring the screens in the browser (375, 768, 1024 and 1440 px), opening menus and testing the keyboard'],
  'skill.design.coverage': ['design', 'recording the scores per theme (faundr design-coverage)'],
  'skill.design-fix.browser': ['design-fix', 'checking the fix in the browser'],
  'skill.security.supabase': ['security', 'fetching the Supabase advisors (get_advisors and security-import)'],
  'skill.tests.coverage': ['tests', 'measuring coverage (faundr tests-run --coverage)'],
  'skill.launch.db': ['launch', 'offering the full database test'],
}

/** Aviso dos passos que o projeto desligou nesta skill do Faundr; null quando não há nenhum. */
export function skillStepsNote(root, name) {
  const short = String(name ?? '')
    .replace(/^\//, '')
    .replace(/^faundr:/, '')
  const off = Object.entries(SKILL_STEPS).filter(([key, [skill]]) => skill === short && stepOff(root, key))
  if (!off.length) return null
  return `[Faundr] In this project, the team turned off these steps of /faundr:${short}: ${off.map(([, [, what]]) => what).join('; ')}. Skip them; the rest of the skill stays the same.`
}
