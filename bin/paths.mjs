// Onde cada arquivo do Faundr fica dentro do projeto. Tudo mora em .faundr/ (fora do git: o time vê pelo painel),
// separado por tipo. Os caminhos ficam só aqui; o LEIA-ME.md da pasta explica o mapa para quem abre a pasta.
// O motor do mapa (engine/src/pipeline.ts e cache.ts) repete os caminhos de mapa/ e cache/.
import fs from 'node:fs'
import path from 'node:path'

export const FAUNDR_DIR = '.faundr'

export const FILES = {
  state: 'state.json',
  overview: 'painel/overview.json',
  stack: 'painel/stack.json',
  showcase: 'painel/showcase.json',
  memory: 'painel/memory.json',
  rules: 'painel/rules.json',
  workflows: 'painel/workflows.json',
  skills: 'painel/skills.json',
  handover: 'relatorios/PASSAGEM.md',
  securityReport: 'relatorios/relatorio-seguranca.md',
  graph: 'mapa/graph.json',
  graphReport: 'mapa/GRAPH_REPORT.md',
  dbTest: 'verificacoes/db-test.json',
  dbTestResult: 'verificacoes/db-test-result.json',
  envHosting: 'verificacoes/env-hosting.json',
  tests: 'verificacoes/testes',
  extractCache: 'cache/extract-cache.json',
  fingerprints: 'cache/fingerprints.json',
  team: 'cache/team.json',
  inbox: 'cache/inbox.json',
  // Prints dos pedidos da extensão do Chrome (faundr fila --print).
  requestShots: 'pedidos',
}

/** Caminho relativo à raiz do projeto, com barras normais (para mensagens, skills e o git). */
export const relPath = (key) => `${FAUNDR_DIR}/${FILES[key]}`

/** Caminho absoluto dentro do projeto. */
export const faundrPath = (root, key) => path.join(root, FAUNDR_DIR, ...FILES[key].split('/'))

/** Cria a subpasta do arquivo, se faltar, e devolve o caminho absoluto. */
export function ensureFaundrPath(root, key) {
  const file = faundrPath(root, key)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  return file
}

// Onde cada arquivo ficava antes das subpastas (plugin até 0.54): tudo solto em .faundr/.
const OLD_NAMES = {
  overview: 'overview.json',
  stack: 'stack.json',
  showcase: 'showcase.json',
  memory: 'memory.json',
  rules: 'rules.json',
  handover: 'PASSAGEM.md',
  securityReport: 'relatorio-seguranca.md',
  graph: 'graph.json',
  graphReport: 'GRAPH_REPORT.md',
  dbTest: 'db-test.json',
  dbTestResult: 'db-test-result.json',
  envHosting: 'env-hosting.json',
  tests: 'tests',
  extractCache: 'extract-cache.json',
  fingerprints: 'fingerprints.json',
}

export const README_VERSION = 1

const README = `<!-- faundr-leia-me v${README_VERSION} -->
# Pasta do Faundr

O Faundr guarda aqui o que precisa neste computador. A pasta fica fora do git: o time acompanha tudo pelo painel.
Não edite à mão; o Faundr refaz o que faltar.

| Pasta | O que tem | Quem usa |
|---|---|---|
| \`painel/\` | Cópias locais do painel: Visão (\`overview.json\`), Stack (\`stack.json\`), Vitrine (\`showcase.json\`), memória (\`memory.json\`) e regras por arquivo (\`rules.json\`) | As skills escrevem a Visão, a Stack e a Vitrine aqui antes de enviar; a memória e as regras vêm do painel no início da sessão |
| \`relatorios/\` | Pacote de passagem (\`PASSAGEM.md\`) e relatório de segurança (\`relatorio-seguranca.md\`) | Para ler ou mandar a alguém |
| \`mapa/\` | Mapa do código (\`graph.json\`) e o resumo da arquitetura (\`GRAPH_REPORT.md\`) | As consultas \`faundr graph-*\`; o resumo só quando elas não bastam |
| \`verificacoes/\` | Resultados de testes do banco, variáveis da hospedagem e testes do projeto (\`testes/\`) | O checklist de lançamento e o painel de qualidade |
| \`cache/\` | Atalhos para refazer o mapa mais rápido | Só o Faundr; pode apagar |
| \`state.json\` | Estado da sessão (barra de status, avisos) | Só o Faundr |

O guia de design (\`DESIGN.md\`) fica na raiz do projeto, junto do código.
`

/**
 * Passa os arquivos soltos de .faundr/ (plugin antigo) para as subpastas e escreve o LEIA-ME.md. Rápido quando já
 * está organizado; nunca sobrescreve um arquivo que já está no lugar novo. Devolve quantos arquivos mudou de lugar.
 */
export function organizeFaundrDir(root) {
  const dir = path.join(root, FAUNDR_DIR)
  if (!fs.existsSync(dir)) return 0
  let moved = 0
  for (const [key, old] of Object.entries(OLD_NAMES)) {
    const from = path.join(dir, old)
    if (!fs.existsSync(from)) continue
    const to = faundrPath(root, key)
    try {
      if (fs.existsSync(to)) {
        fs.rmSync(from, { recursive: true, force: true })
        continue
      }
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.renameSync(from, to)
      moved++
    } catch {}
  }
  const readme = path.join(dir, 'LEIA-ME.md')
  try {
    const cur = fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8') : ''
    if (!cur.startsWith(`<!-- faundr-leia-me v${README_VERSION} -->`)) fs.writeFileSync(readme, README)
  } catch {}
  return moved
}
