import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setLang } from '../bin/i18n.mjs'
import { detectStack } from '../bin/stack.mjs'

// Projeto de exemplo numa pasta temporária, com os arquivos no git (a Stack lê o que está no git).
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-stack-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['add', '-A'], { cwd: dir })
  return dir
}
const names = (list) => list.map((x) => x.name)

test('Go: framework, banco, versão, Docker e variáveis', () => {
  const { stack } = detectStack(project({
    'go.mod': 'module x\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgorm.io/gorm v1.25.0\n)\n',
    'main.go': 'package main\nimport "os"\nfunc main() { _ = os.Getenv("DATABASE_URL") }\n',
    Dockerfile: 'FROM golang:1.22-alpine\n',
  }))
  assert.deepEqual(names(stack.languages).sort(), ['Docker', 'Go'])
  for (const t of ['Gin', 'GORM', 'Docker']) assert.ok(names(stack.tech).includes(t), t)
  assert.ok(stack.runtime.some((r) => r.name === 'Go' && r.version === '1.22'))
  assert.deepEqual(names(stack.env), ['DATABASE_URL'])
})

test('Flutter: framework, Supabase como banco e variáveis', () => {
  const { stack } = detectStack(project({
    'pubspec.yaml': 'name: app\nenvironment:\n  sdk: ">=3.3.0 <4.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n  supabase_flutter: ^2.3.0\n',
    'lib/main.dart': 'void main() { const url = String.fromEnvironment("SUPABASE_URL"); }\n',
  }))
  assert.ok(names(stack.tech).includes('Flutter'))
  assert.ok(stack.hosting.some((h) => h.layer === 'banco' && h.provider === 'Supabase'))
  assert.deepEqual(names(stack.env), ['SUPABASE_URL'])
})

test('Laravel, Spring, ASP.NET, Rust e C++: framework e versão da linguagem', () => {
  const cases = [
    [{ 'composer.json': '{"require":{"php":"^8.2","laravel/framework":"^11.0","stripe/stripe-php":"^13"}}' }, 'Laravel', 'PHP'],
    [{ 'pom.xml': '<project><parent><artifactId>spring-boot-starter-parent</artifactId><version>3.2.0</version></parent><properties><java.version>21</java.version></properties></project>' }, 'Spring Boot', 'Java'],
    [{ 'app.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>' }, 'ASP.NET Core', '.NET'],
    [{ 'Cargo.toml': '[package]\nname = "app"\nrust-version = "1.75"\n\n[dependencies]\naxum = "0.7"\n' }, 'Axum', 'Rust'],
    [{ 'CMakeLists.txt': 'set(CMAKE_CXX_STANDARD 20)\nfind_package(Qt6 REQUIRED)\n' }, 'Qt', 'C++'],
  ]
  for (const [files, tech, runtime] of cases) {
    const { stack } = detectStack(project(files))
    assert.ok(names(stack.tech).includes(tech), tech)
    assert.ok(names(stack.runtime).includes(runtime), runtime)
  }
})

test('textos da Stack na língua da pessoa; a impressão digital não muda com a língua', () => {
  const dir = project({
    'package.json': JSON.stringify({ packageManager: 'pnpm@9.0.0', dependencies: { stripe: '^14.0.0' }, scripts: { dev: 'vite' } }),
    Dockerfile: 'FROM node:20-alpine\n',
  })
  setLang('en')
  const en = detectStack(dir)
  assert.ok(names(en.stack.runtime).includes('Package manager'))
  assert.ok(names(en.stack.runtime).includes('Base image (Docker)'))
  assert.equal(en.stack.services.find((x) => x.name === 'Stripe').purpose, 'billing and payments')
  assert.equal(en.stack.scripts.find((x) => x.name === 'pnpm dev').what, 'runs the project on your computer')
  setLang('pt')
  const pt = detectStack(dir)
  assert.ok(names(pt.stack.runtime).includes('Gerenciador de pacotes'))
  assert.equal(pt.stack.services.find((x) => x.name === 'Stripe').purpose, 'cobrança e pagamentos')
  assert.equal(en.hash, pt.hash)
})
