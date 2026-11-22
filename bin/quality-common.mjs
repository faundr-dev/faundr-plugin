// Base comum da checagem de qualidade: limite de tamanho, caminhos de teste e de código gerado
// e a leitura dos arquivos (usados por quality-rules.mjs e seus módulos).
import fs from 'node:fs'
import path from 'node:path'

export const MAX_FILE = 400_000
export const TEST_PATH = /(^|\/)(__tests__|__mocks__|tests?|e2e|spec|integration_test)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$|_test\.dart$|Test\.php$|_test\.go$|Tests?\.(java|kt|cs)$|(^|\/)[^/]+\.Tests?\/|_(unit)?tests?\.(c|cc|cpp|cxx)$|(^|\/)test_[^/]*\.(c|cc|cpp|cxx)$/
// Gerados: também .pb.go, *_gen.go, .Designer.cs/.g.cs, a saída do build do .NET (bin/ e obj/ só com .cs),
// a do Cargo (target/) e a do CMake (cmake-build-*/), e .pb.h/.pb.cc do protobuf.
export const GENERATED = /\.(d\.ts|min\.js)$|\.gen\.[jt]sx?$|(^|\/)(dist|build|out|vendor|generated|\.output)\/|\.pb\.go$|_gen\.go$|\.(Designer|g|g\.i)\.cs$|(^|\/)(bin|obj)\/.*\.cs$|(^|\/)target\/.*\.rs$|(^|\/)cmake-build-[^/]+\/|\.pb\.(h|cc)$/

// Histórias do Storybook e arquivos de preparação dos testes: importar mock neles é o esperado (contam como teste
// para falha/mock-em-producao).
export const TEST_SUPPORT = /\.stories\.[cm]?[jt]sx?$|(^|\/)\.storybook\/|(^|\/)(vitest|jest|playwright|karma|cypress)\.setup\.[cm]?[jt]sx?$|(^|\/)(setup-?tests?|test-?setup)\.[cm]?[jt]sx?$/i

// Que checagem olha cada regra: as ferramentas do projeto (tsc, ESLint), a do projeto inteiro (só a checagem
// completa) ou a por arquivo. Espelho de src/lib/quality-scope.ts, que é quem decide no servidor o que fecha (o
// plugin é publicado à parte e não importa do site); plugin/test/quality-audit.test.mjs compara os dois.
const PROJECT_RULES = /^(demais\/dependencia-|demais\/duplicado|morto\/|instrucoes\/|limpeza\/todo-antigo|desempenho\/(consulta-|fk-)|docker\/|css\/)/
const TOOL_RULES = /^(ts|eslint)\//

export function ruleScope(ruleId) {
  if (TOOL_RULES.test(ruleId)) return 'tool'
  if (PROJECT_RULES.test(ruleId)) return 'project'
  return 'code'
}

/** O arquivo existe? (apagado ou renomeado: os achados dele fecham; grande demais ou binário: só não foi olhado) */
export const exists = (root, rel) => fs.existsSync(path.join(root, rel))

export const read = (root, rel) => {
  try {
    const abs = path.join(root, rel)
    if (fs.statSync(abs).size > MAX_FILE) return null
    const text = fs.readFileSync(abs, 'utf8')
    return text.includes('\0') ? null : text
  } catch {
    // Arquivo apagado ou ilegível no meio da checagem: só não entra.
    return null
  }
}
