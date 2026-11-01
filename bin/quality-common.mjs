// Base comum da checagem de qualidade: limite de tamanho, caminhos de teste e de código gerado
// e a leitura dos arquivos (usados por quality-rules.mjs e seus módulos).
import fs from 'node:fs'
import path from 'node:path'

export const MAX_FILE = 400_000
export const TEST_PATH = /(^|\/)(__tests__|__mocks__|tests?|e2e|spec|integration_test)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$|_test\.dart$|Test\.php$|_test\.go$|Tests?\.(java|kt|cs)$|(^|\/)[^/]+\.Tests?\/|_(unit)?tests?\.(c|cc|cpp|cxx)$|(^|\/)test_[^/]*\.(c|cc|cpp|cxx)$/
// Gerados: também .pb.go, *_gen.go, .Designer.cs/.g.cs, a saída do build do .NET (bin/ e obj/ só com .cs),
// a do Cargo (target/) e a do CMake (cmake-build-*/), e .pb.h/.pb.cc do protobuf.
export const GENERATED = /\.(d\.ts|min\.js)$|\.gen\.[jt]sx?$|(^|\/)(dist|build|out|vendor|generated|\.output)\/|\.pb\.go$|_gen\.go$|\.(Designer|g|g\.i)\.cs$|(^|\/)(bin|obj)\/.*\.cs$|(^|\/)target\/.*\.rs$|(^|\/)cmake-build-[^/]+\/|\.pb\.(h|cc)$/

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
