// Angular com Karma (ng test): o Karma não grava relatório que dê para ler sem instalar plugin. O Faundr escreve uma
// configuração própria que carrega a do projeto (karma.conf.js) — ou a padrão do Angular, quando o projeto não tem —
// e acrescenta um reporter que grava cada teste num JSON. Nada é instalado nem mudado no projeto.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { t } from './i18n.mjs'

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // Arquivo que não existe ou JSON quebrado: tratado como ausente.
    return null
  }
}

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    // Arquivo que não existe: tratado como vazio.
    return ''
  }
}

const NG = 'node_modules/@angular/cli/bin/ng.js'

/** ng test com Karma: pasta com angular.json e o karma no package.json. */
export function karmaRunner(root, dir) {
  if (!fs.existsSync(path.join(root, dir, 'angular.json'))) return null
  const pkg = readJson(path.join(root, dir, 'package.json')) ?? {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (!deps.karma) return null
  return { runner: 'karma', dir, config: 'angular.json', script: null, installed: fs.existsSync(path.join(root, dir, NG)), coverage: false }
}

/** Texto da configuração do Karma do Faundr (CommonJS). `devkit`: o projeto usa o @angular-devkit/build-angular. */
export function karmaConfigText({ cwd, out, projectConfig, devkit }) {
  const base = projectConfig
    ? `require(${JSON.stringify(projectConfig)})(config)`
    : `config.set({
    frameworks: ${JSON.stringify(devkit ? ['jasmine', '@angular-devkit/build-angular'] : ['jasmine'])},
    plugins: [req('karma-jasmine'), req('karma-chrome-launcher')${devkit ? ", req('@angular-devkit/build-angular/plugins/karma')" : ''}],
  })`
  return `// Gerado pelo Faundr para ler o resultado do ng test. Pode apagar.
const fs = require('fs')
const path = require('path')
const req = (m) => require(require.resolve(m, { paths: [${JSON.stringify(cwd)}] }))
const OUT = ${JSON.stringify(out)}

function FaundrReporter(baseReporterDecorator) {
  baseReporterDecorator(this)
  const specs = []
  this.onSpecComplete = (browser, r) => specs.push({ suite: r.suite, description: r.description, success: r.success, skipped: r.skipped, log: r.log, time: r.time })
  this.onRunComplete = () => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(specs))
  }
}
FaundrReporter.$inject = ['baseReporterDecorator']

module.exports = function (config) {
  ${base}
  config.set({
    plugins: [...(config.plugins || []), { 'reporter:faundr': ['type', FaundrReporter] }],
    reporters: ['faundr'],
    browsers: ['ChromeHeadless'],
    singleRun: true,
    autoWatch: false,
  })
}
`
}

/** Roda o ng test com a configuração do Faundr. Devolve { runner, durationMs, cases, error } como os outros executores. */
export function runKarma(root, dir, { out, timeout }) {
  const cwd = path.join(root, dir)
  const started = Date.now()
  const json = out.replace(/\.\w+$/, '-karma.json')
  const cfgFile = out.replace(/\.\w+$/, '-karma.conf.cjs')
  fs.rmSync(json, { force: true })
  const projectConfig = ['karma.conf.js', 'karma.conf.cjs', 'src/karma.conf.js'].map((f) => path.join(cwd, f)).find((f) => fs.existsSync(f)) ?? null
  const pkg = readJson(path.join(cwd, 'package.json')) ?? {}
  const devkit = !!{ ...pkg.dependencies, ...pkg.devDependencies }['@angular-devkit/build-angular']
  fs.writeFileSync(cfgFile, karmaConfigText({ cwd, out: json, projectConfig, devkit }))
  const r = spawnSync(process.execPath, [path.join(cwd, NG), 'test', '--watch=false', '--no-progress', '--browsers=ChromeHeadless', `--karma-config=${cfgFile}`], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1', NO_COLOR: '1', NG_CLI_ANALYTICS: 'false' },
  })
  const durationMs = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') return { runner: 'karma', durationMs, error: t(`went over the time limit (${Math.round(timeout / 60000)} min)`, `passou do tempo limite (${Math.round(timeout / 60000)} min)`) }
  const text = read(json)
  if (!text) {
    const last = `${r.stderr}\n${r.stdout}`.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) ?? ''
    return { runner: 'karma', durationMs, error: last.slice(0, 300) || t(`ng test finished without results (code ${r.status})`, `o ng test terminou sem resultados (código ${r.status})`) }
  }
  return { runner: 'karma', durationMs, cases: fromKarmaJson(text, root, dir), error: null }
}

/** O JSON do reporter do Faundr: um teste por spec, com o arquivo achado pelo describe de fora no .spec.ts. */
export function fromKarmaJson(text, root, dir = '') {
  let specs
  try {
    specs = JSON.parse(text)
  } catch {
    // Arquivo cortado no meio (o ng test parou antes do fim): sem resultados.
    return []
  }
  const specFiles = listSpecs(root, dir)
  const fileOf = new Map()
  return specs.map((s) => {
    const top = s.suite?.[0] ?? ''
    if (!fileOf.has(top)) {
      const esc = top.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const decl = new RegExp(`\\bdescribe\\s*\\(\\s*['"\`]${esc}['"\`]`)
      fileOf.set(top, specFiles.find((f) => decl.test(f.text))?.rel ?? null)
    }
    const status = s.skipped ? 'skipped' : s.success ? 'passed' : 'failed'
    const message = status === 'failed' ? (s.log ?? []).join('\n').split('\n').filter((l) => !/^\s*at <Jasmine>/.test(l)).join('\n').trim().slice(0, 2000) || t('failed', 'falhou') : null
    return { file: fileOf.get(top), name: [...(s.suite ?? []), s.description].join(' › '), status, durationMs: Math.round(s.time ?? 0), message }
  })
}

// Os .spec.ts da pasta (sem node_modules e dist), lidos uma vez.
function listSpecs(root, dir) {
  const out = []
  const walk = (rel, depth) => {
    let entries = []
    try {
      entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true })
    } catch {
      // Pasta sem permissão: fica de fora.
      return
    }
    for (const e of entries) {
      const sub = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory() && depth < 8 && !/^(node_modules|dist|\..*)$/.test(e.name)) walk(sub, depth + 1)
      else if (e.isFile() && e.name.endsWith('.spec.ts')) out.push({ rel: sub, text: read(path.join(root, sub)) })
    }
  }
  walk(dir, 0)
  return out
}
