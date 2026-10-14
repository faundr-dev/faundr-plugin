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
    return false
  }
}

// ---- Passos desligados de dentro das skills do Faundr ----------------------------------------------------------
// A skill é um texto que o Claude segue: quando ela entra (ferramenta Skill ou /faundr:x digitado), o Faundr avisa
// quais passos o projeto desligou. Só passos opcionais; nunca segurança, prova ou pergunta ao dono.

/** Chave do passo → [skill, o que pular]. As chaves batem com os desenhos (src/lib/faundr-skill-flows.ts). */
export const SKILL_STEPS = {
  'skill.planning.review': ['planning', 'a revisão escondida por subagente em pedido grande'],
  'skill.planning.diagram': ['planning', 'oferecer e desenhar o diagrama de como a funcionalidade vai funcionar'],
  'skill.design.browser': ['design', 'medir as telas no navegador (375, 768, 1024 e 1440 px), abrir menus e testar o teclado'],
  'skill.design.coverage': ['design', 'registrar as notas por tema (faundr design-coverage)'],
  'skill.design-fix.browser': ['design-fix', 'conferir a correção no navegador'],
  'skill.security.supabase': ['security', 'buscar os avisos do Supabase (get_advisors e security-import)'],
  'skill.tests.coverage': ['tests', 'medir a cobertura (faundr tests-run --coverage)'],
  'skill.launch.db': ['launch', 'oferecer o teste completo do banco'],
}

/** Aviso dos passos que o projeto desligou nesta skill do Faundr; null quando não há nenhum. */
export function skillStepsNote(root, name) {
  const short = String(name ?? '')
    .replace(/^\//, '')
    .replace(/^faundr:/, '')
  const off = Object.entries(SKILL_STEPS).filter(([key, [skill]]) => skill === short && stepOff(root, key))
  if (!off.length) return null
  return `[Faundr] Neste projeto, o time desligou estes passos de /faundr:${short}: ${off.map(([, [, what]]) => what).join('; ')}. Pule-os; o resto da skill segue igual.`
}
