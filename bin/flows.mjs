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
