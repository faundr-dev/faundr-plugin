import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { measureFindings } from '../bin/measure-findings.mjs'

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const extension = path.join(here, '..', '..', 'extension')

test('medição vira um achado por regra, com a tela e a largura no título', () => {
  const findings = measureFindings(
    {
      url: '/app',
      largura: 375,
      rolagem: { pagina: 420, tela: 375, culpados: [{ el: 'div.grid', passa: 45 }] },
      toque: [{ el: 'button', text: 'Sair', w: 30, h: 30 }],
      cortado: [],
      contraste: [{ el: 'p', cor: '#777', fundo: '#151515', razao: 2.8, minimo: 4.5 }],
      miudo: [],
      lento: [],
      borda: [],
    },
    'Projetos',
    'pt',
  )
  assert.deepEqual(
    findings.map((f) => [f.rule, f.severity]),
    [
      ['responsivo/rolagem-horizontal', 'high'],
      ['responsivo/alvo-de-toque-pequeno', 'medium'],
      ['acessibilidade/contraste-na-tela', 'high'],
    ],
  )
  assert.match(findings[0].title, /Projetos em 375 px/)
})

// A extensão do Chrome leva cópias (não tem como importar do plugin): têm de ser iguais aos originais.
test('cópias da extensão iguais ao plugin', { skip: !fs.existsSync(extension) && 'sem a pasta extension/' }, () => {
  const read = (...p) => fs.readFileSync(path.join(...p), 'utf8').replace(/\r\n/g, '\n')
  assert.equal(read(extension, 'measure-findings.js'), read(here, '..', 'bin', 'measure-findings.mjs'), 'rode: cp plugin/bin/measure-findings.mjs extension/measure-findings.js')
  assert.equal(read(extension, 'medir.js'), read(here, '..', 'skills', 'design', 'medir.js'), 'rode: cp plugin/skills/design/medir.js extension/medir.js')
})
