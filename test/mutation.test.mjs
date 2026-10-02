// Teste de mutação: leitura do relatório do Stryker, frases para leigo e alvos (arquivo:linhas).
import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { mutateTargets, mutationFindings, readReport } from '../bin/mutation.mjs'

const root = path.resolve('/proj')

test('relatório: contas, as duas notas e os defeitos que escaparam', () => {
  const report = {
    files: {
      'src/frete.ts': {
        source: 'export const frete = (v) => (v >= 100 ? 0 : 15)',
        mutants: [
          { id: '1', mutatorName: 'EqualityOperator', replacement: 'v > 100', status: 'Survived', location: { start: { line: 1, column: 31 } } },
          { id: '2', mutatorName: 'ConditionalExpression', replacement: 'true', status: 'Killed', location: { start: { line: 1, column: 31 } } },
          { id: '3', mutatorName: 'BlockStatement', replacement: '{}', status: 'NoCoverage', location: { start: { line: 1, column: 1 } } },
          { id: '4', mutatorName: 'StringLiteral', replacement: '""', status: 'Ignored', location: { start: { line: 1, column: 1 } } },
        ],
      },
    },
  }
  const r = readReport(report, root)
  assert.deepEqual(r.counts, { killed: 1, timeout: 0, survived: 1, noCoverage: 1, ignored: 1, errors: 0 })
  assert.equal(r.score, 33.3)
  assert.equal(r.coveredScore, 50)
  const [survived, uncovered] = mutationFindings(r.escaped)
  assert.match(survived.detail, /exatamente no limite.*v > 100/)
  assert.equal(survived.original, 'export const frete = (v) => (v >= 100 ? 0 : 15)')
  assert.equal(uncovered.kind, 'no_coverage')
  assert.match(uncovered.detail, /Nenhum teste executa esta linha/)
  assert.notEqual(survived.fingerprint, uncovered.fingerprint)
})

test('alvos: só arquivos de lógica que mudaram, com a faixa de linhas', () => {
  const changed = new Map([
    ['src/frete.ts', new Set([12, 3, 7])],
    ['src/frete.test.ts', new Set([1])],
    ['src/routes/index.tsx', new Set([1])],
    ['README.md', new Set([1])],
  ])
  assert.deepEqual(mutateTargets(changed), ['src/frete.ts:3-12'])
  assert.deepEqual(mutateTargets(changed, ['src/x.ts:1-2']), ['src/x.ts:1-2'])
})
