// Leitura de cobertura (istanbul e lcov), faixas de linhas e cobertura do que a sessão mudou.
import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fromIstanbul, fromLcov, ranges, sessionCoverage, summarize } from '../bin/coverage.mjs'

const root = path.resolve('/proj')
const abs = (rel) => path.join(root, rel)

test('istanbul: linha coberta, sem teste e parcial (um lado do if sem teste)', () => {
  const files = fromIstanbul(
    {
      [abs('src/frete.ts')]: {
        path: abs('src/frete.ts'),
        statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 2 } }, 2: { start: { line: 3 } } },
        s: { 0: 4, 1: 4, 2: 0 },
        branchMap: { 0: { loc: { start: { line: 2 } }, locations: [] } },
        b: { 0: [4, 0] },
      },
      [abs('src/frete.test.ts')]: { path: abs('src/frete.test.ts'), statementMap: {}, s: {} },
    },
    root,
  )
  assert.deepEqual([...files.keys()], ['src/frete.ts'])
  assert.deepEqual([...files.get('src/frete.ts')], [[1, 'c'], [2, 'p'], [3, 'u']])
  const s = summarize(files)
  assert.deepEqual(s.total, { lines: 3, covered: 1, pct: 33.3 })
  assert.equal(s.files[0].uncovered, '2-3')
})

test('lcov do node --test', () => {
  const files = fromLcov(`SF:${abs('lib/a.mjs')}\nDA:1,1\nDA:2,0\nBRDA:1,0,0,-\nend_of_record\n`, root)
  assert.deepEqual([...files.get('lib/a.mjs')], [[1, 'p'], [2, 'u']])
})

test('faixas e cobertura do que mudou', () => {
  assert.equal(ranges([5, 1, 2, 3, 9]), '1-3, 5, 9')
  const files = new Map([['src/a.ts', new Map([[1, 'c'], [2, 'u'], [3, 'c']])]])
  const changed = new Map([['src/a.ts', new Set([2, 3, 10])], ['README.md', new Set([1])]])
  assert.deepEqual(sessionCoverage(files, changed), { lines: 2, covered: 1, pct: 50, files: [{ file: 'src/a.ts', changed: 2, covered: 1, pct: 50, uncovered: '2' }] })
})
