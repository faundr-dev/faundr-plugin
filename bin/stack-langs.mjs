// Stack das linguagens fora de npm e Python: lê Cargo.toml, go.mod, composer.json, pubspec.yaml, pom.xml,
// build.gradle, libs.versions.toml, *.csproj, CMakeLists.txt, vcpkg.json e Dockerfile. Devolve os pacotes
// com a chave do catálogo ("cargo:axum", "go:gin"…) para o mesmo caminho de stack.mjs (tecnologias,
// serviços e camadas), e a versão de cada linguagem.
import fs from 'node:fs'
import path from 'node:path'

const read = (root, rel) => {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8').slice(0, 400_000)
  } catch {
    // Arquivo some entre a listagem e a leitura (ou não é texto): conta como vazio.
    return ''
  }
}

// chave → [nome, categoria]. Nas chaves de Go, Maven e NuGet vale o começo do nome (versões /v2, módulos).
export const LANG_TECH = {
  // Rust
  'cargo:actix-web': ['Actix Web', 'framework'], 'cargo:axum': ['Axum', 'framework'], 'cargo:rocket': ['Rocket', 'framework'],
  'cargo:tauri': ['Tauri', 'framework'], 'cargo:tokio': ['Tokio', 'outro'], 'cargo:serde': ['Serde', 'dados'], 'cargo:diesel': ['Diesel', 'dados'],
  'cargo:sqlx': ['SQLx', 'dados'], 'cargo:sea-orm': ['SeaORM', 'dados'], 'cargo:reqwest': ['Reqwest', 'dados'], 'cargo:clap': ['Clap', 'outro'],
  // Go
  'go:github.com/gin-gonic/gin': ['Gin', 'framework'], 'go:github.com/labstack/echo': ['Echo', 'framework'], 'go:github.com/gofiber/fiber': ['Fiber', 'framework'],
  'go:github.com/go-chi/chi': ['chi', 'framework'], 'go:gorm.io/gorm': ['GORM', 'dados'], 'go:github.com/jackc/pgx': ['pgx', 'dados'],
  'go:github.com/stretchr/testify': ['Testify', 'testes'], 'go:github.com/spf13/cobra': ['Cobra', 'outro'],
  // PHP
  'composer:laravel/framework': ['Laravel', 'framework'], 'composer:symfony/framework-bundle': ['Symfony', 'framework'], 'composer:slim/slim': ['Slim', 'framework'],
  'composer:livewire/livewire': ['Livewire', 'ui'], 'composer:doctrine/orm': ['Doctrine', 'dados'], 'composer:guzzlehttp/guzzle': ['Guzzle', 'dados'],
  'composer:phpunit/phpunit': ['PHPUnit', 'testes'], 'composer:pestphp/pest': ['Pest', 'testes'], 'composer:phpstan/phpstan': ['PHPStan', 'qualidade'],
  'composer:laravel/pint': ['Laravel Pint', 'qualidade'],
  // Dart / Flutter
  'pub:flutter': ['Flutter', 'framework'], 'pub:flutter_riverpod': ['Riverpod', 'dados'], 'pub:provider': ['Provider', 'dados'], 'pub:flutter_bloc': ['BLoC', 'dados'],
  'pub:get': ['GetX', 'dados'], 'pub:dio': ['Dio', 'dados'], 'pub:http': ['http (Dart)', 'dados'], 'pub:go_router': ['GoRouter', 'framework'],
  'pub:sqflite': ['sqflite', 'dados'], 'pub:flutter_test': ['flutter_test', 'testes'], 'pub:flutter_lints': ['flutter_lints', 'qualidade'],
  // Java / Kotlin
  'maven:org.springframework.boot': ['Spring Boot', 'framework'], 'maven:io.quarkus': ['Quarkus', 'framework'], 'maven:io.micronaut': ['Micronaut', 'framework'],
  'maven:io.ktor': ['Ktor', 'framework'], 'maven:org.hibernate': ['Hibernate', 'dados'], 'maven:org.junit': ['JUnit', 'testes'], 'maven:junit:junit': ['JUnit', 'testes'],
  'maven:androidx.compose': ['Jetpack Compose', 'ui'], 'maven:com.squareup.retrofit2': ['Retrofit', 'dados'], 'maven:com.squareup.okhttp3': ['OkHttp', 'dados'],
  'maven:org.jetbrains.kotlinx:kotlinx-coroutines': ['Kotlin Coroutines', 'outro'], 'maven:org.projectlombok': ['Lombok', 'outro'],
  // .NET
  'nuget:Microsoft.AspNetCore': ['ASP.NET Core', 'framework'], 'nuget:Microsoft.EntityFrameworkCore': ['Entity Framework Core', 'dados'],
  'nuget:Microsoft.Maui': ['.NET MAUI', 'framework'], 'nuget:Dapper': ['Dapper', 'dados'], 'nuget:xunit': ['xUnit', 'testes'], 'nuget:NUnit': ['NUnit', 'testes'],
  'nuget:MSTest': ['MSTest', 'testes'], 'nuget:Newtonsoft.Json': ['Json.NET', 'dados'], 'nuget:Serilog': ['Serilog', 'outro'],
  // C / C++
  'cmake:Qt': ['Qt', 'framework'], 'cmake:Boost': ['Boost', 'outro'], 'cmake:GTest': ['GoogleTest', 'testes'], 'cmake:Catch2': ['Catch2', 'testes'],
  'cmake:OpenSSL': ['OpenSSL', 'outro'], 'cmake:SDL2': ['SDL', 'ui'],
}

// Serviços externos: chave → [nome, categoria, para quê]
export const LANG_SVC = {
  'composer:stripe/stripe-php': ['Stripe', 'pagamentos', 'cobrança e pagamentos'], 'go:github.com/stripe/stripe-go': ['Stripe', 'pagamentos', 'cobrança e pagamentos'],
  'nuget:Stripe.net': ['Stripe', 'pagamentos', 'cobrança e pagamentos'], 'maven:com.stripe': ['Stripe', 'pagamentos', 'cobrança e pagamentos'],
  'cargo:async-stripe': ['Stripe', 'pagamentos', 'cobrança e pagamentos'], 'pub:flutter_stripe': ['Stripe', 'pagamentos', 'cobrança e pagamentos'],
  'pub:firebase_core': ['Firebase', 'outro', 'backend do app'], 'pub:firebase_auth': ['Firebase Auth', 'auth', 'login dos usuários'],
  'pub:supabase_flutter': ['Supabase', 'outro', 'banco de dados e backend'], 'go:github.com/supabase-community/supabase-go': ['Supabase', 'outro', 'banco de dados e backend'],
  'maven:com.google.firebase': ['Firebase', 'outro', 'backend do app'], 'pub:sentry_flutter': ['Sentry', 'monitoramento', 'erros em produção'],
  'composer:sentry/sentry-laravel': ['Sentry', 'monitoramento', 'erros em produção'], 'nuget:Sentry': ['Sentry', 'monitoramento', 'erros em produção'],
  'maven:io.sentry': ['Sentry', 'monitoramento', 'erros em produção'], 'go:github.com/getsentry/sentry-go': ['Sentry', 'monitoramento', 'erros em produção'],
  'cargo:sentry': ['Sentry', 'monitoramento', 'erros em produção'], 'go:github.com/aws/aws-sdk-go': ['AWS', 'armazenamento', 'serviços da AWS'],
  'composer:aws/aws-sdk-php': ['AWS', 'armazenamento', 'serviços da AWS'], 'nuget:AWSSDK': ['AWS', 'armazenamento', 'serviços da AWS'],
  'maven:software.amazon.awssdk': ['AWS', 'armazenamento', 'serviços da AWS'], 'cargo:aws-sdk-s3': ['AWS S3', 'armazenamento', 'guardar arquivos'],
  'composer:openai-php/client': ['OpenAI', 'ia', 'inteligência artificial'], 'go:github.com/sashabaranov/go-openai': ['OpenAI', 'ia', 'inteligência artificial'],
  'nuget:OpenAI': ['OpenAI', 'ia', 'inteligência artificial'], 'go:github.com/anthropics/anthropic-sdk-go': ['Anthropic (Claude)', 'ia', 'inteligência artificial'],
  'maven:com.anthropic': ['Anthropic (Claude)', 'ia', 'inteligência artificial'], 'nuget:Anthropic': ['Anthropic (Claude)', 'ia', 'inteligência artificial'],
}

// Frameworks de servidor e de tela (para as camadas "back" e "front" de stack.mjs).
export const LANG_BACK = ['cargo:actix-web', 'cargo:axum', 'cargo:rocket', 'go:github.com/gin-gonic/gin', 'go:github.com/labstack/echo', 'go:github.com/gofiber/fiber',
  'go:github.com/go-chi/chi', 'composer:laravel/framework', 'composer:symfony/framework-bundle', 'composer:slim/slim', 'maven:org.springframework.boot', 'maven:io.quarkus',
  'maven:io.micronaut', 'maven:io.ktor', 'nuget:Microsoft.AspNetCore']
export const LANG_FRONT = ['pub:flutter', 'nuget:Microsoft.Maui', 'cargo:tauri', 'maven:androidx.compose']

const KEYS = [...new Set([...Object.keys(LANG_TECH), ...Object.keys(LANG_SVC)])].sort((a, b) => b.length - a.length)

// Nome do pacote → chave do catálogo (exata ou pelo começo do nome), ou o próprio nome com o prefixo.
function catalogKey(prefix, name) {
  const full = `${prefix}:${name}`
  return KEYS.find((k) => full === k || full.startsWith(`${k}/`) || full.startsWith(`${k}.`) || full.startsWith(`${k}:`) || (k.startsWith('nuget:') && full.startsWith(k))) ?? full
}

const tomlSection = (text, name) => text.match(new RegExp(String.raw`^\[${name.replace(/[.[\]]/g, '\\$&')}\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))`, 'm'))?.[1] ?? ''
const tomlKeys = (body) => [...body.matchAll(/^\s*([\w-]+)\s*=\s*(?:"([^"]*)"|\{[^}]*?version\s*=\s*"([^"]*)")?/gm)].map((m) => [m[1], m[2] ?? m[3] ?? ''])

// Cada leitor devolve [[nome, versão]] de um manifesto.
const READERS = [
  [/(^|\/)Cargo\.toml$/, 'cargo', (t) => [...tomlKeys(tomlSection(t, 'dependencies')), ...tomlKeys(tomlSection(t, 'dev-dependencies'))]],
  [/(^|\/)go\.mod$/, 'go', (t) => [...t.matchAll(/^\s*(?:require\s+)?([\w.~-]+\.[\w.~/-]+)\s+v([\w.+-]+)/gm)].map((m) => [m[1], m[2]])],
  [/(^|\/)composer\.json$/, 'composer', (t) => {
    const j = safeJson(t)
    return Object.entries({ ...j['require-dev'], ...j.require }).map(([n, v]) => [n, String(v).replace(/^[\^~>=<\s]+/, '')])
  }],
  [/(^|\/)pubspec\.yaml$/, 'pub', (t) => {
    const out = []
    for (const sec of ['dependencies', 'dev_dependencies']) {
      const body = t.split(new RegExp(`^${sec}:\\s*$`, 'm'))[1]?.split(/^\S/m)[0] ?? ''
      for (const m of body.matchAll(/^ {2}([\w-]+):\s*(\^?[\d.]+[\w.+-]*)?/gm)) out.push([m[1], (m[2] ?? '').replace(/^\^/, '')])
    }
    return out
  }],
  [/(^|\/)pom\.xml$/, 'maven', (t) => [...t.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)].map((m) => {
    const tag = (n) => m[1].match(new RegExp(`<${n}>([^<]+)</${n}>`))?.[1]?.trim() ?? ''
    return [`${tag('groupId')}:${tag('artifactId')}`, /\$\{/.test(tag('version')) ? '' : tag('version')]
  }).concat(/<parent>[\s\S]*?spring-boot/.test(t) ? [['org.springframework.boot:spring-boot', t.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>/)?.[1] ?? '']] : [])],
  [/(^|\/)build\.gradle(\.kts)?$/, 'maven', (t) => [
    ...[...t.matchAll(/["']([\w.-]+):([\w.-]+)(?::([\w.+-]+))?["']/g)].map((m) => [`${m[1]}:${m[2]}`, m[3] ?? '']),
    ...[...t.matchAll(/id\s*\(?\s*["'](org\.springframework\.boot|io\.ktor\.plugin|io\.quarkus)["']\s*\)?\s*(?:version\s*["']([^"']+))?/g)].map((m) => [`${m[1]}:plugin`, m[2] ?? '']),
  ]],
  [/(^|\/)libs\.versions\.toml$/, 'maven', (t) => [...t.matchAll(/module\s*=\s*"([\w.-]+:[\w.-]+)"|group\s*=\s*"([\w.-]+)"\s*,\s*name\s*=\s*"([\w.-]+)"/g)].map((m) => [m[1] ?? `${m[2]}:${m[3]}`, ''])],
  [/(^|\/)[\w.-]+\.csproj$/, 'nuget', (t) => [
    ...[...t.matchAll(/<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?/g)].map((m) => [m[1], m[2] ?? '']),
    ...(/Sdk="Microsoft\.NET\.Sdk\.Web"/.test(t) ? [['Microsoft.AspNetCore', '']] : []),
  ]],
  [/(^|\/)CMakeLists\.txt$/, 'cmake', (t) => [...t.matchAll(/find_package\s*\(\s*(\w+)/gi)].map((m) => [m[1].replace(/^Qt\d$/, 'Qt'), ''])],
  [/(^|\/)vcpkg\.json$/, 'vcpkg', (t) => (safeJson(t).dependencies ?? []).map((d) => [typeof d === 'string' ? d : d.name, ''])],
]

function safeJson(text) {
  try {
    return JSON.parse(text) ?? {}
  } catch {
    // Manifesto com erro de sintaxe: segue sem os pacotes dele.
    return {}
  }
}

/** Pacotes de todos os manifestos: chave do catálogo → { version, file }. */
export function langDeps(root, files) {
  const deps = new Map()
  for (const [re, prefix, parse] of READERS)
    for (const f of files.filter((x) => re.test(x)).slice(0, 15))
      for (const [name, version] of parse(read(root, f))) {
        const key = catalogKey(prefix, name)
        if (name && !deps.has(key)) deps.set(key, { version: version ?? '', file: f })
      }
  return deps
}

/** Versão de cada linguagem, pelos manifestos. */
export function langRuntime(root, files) {
  const out = []
  const first = (re) => files.find((f) => re.test(f))
  const add = (name, version, file) => version && out.push({ name, version: String(version).trim(), evidence: [file] })
  const cargo = first(/(^|\/)Cargo\.toml$/)
  if (cargo) {
    const t = read(root, cargo)
    add('Rust', t.match(/^rust-version\s*=\s*"([^"]+)"/m)?.[1] ?? (t.match(/^edition\s*=\s*"(\d+)"/m) ? `edição ${t.match(/^edition\s*=\s*"(\d+)"/m)[1]}` : ''), cargo)
  }
  const composer = first(/(^|\/)composer\.json$/)
  if (composer) add('PHP', safeJson(read(root, composer)).require?.php, composer)
  const pubspec = first(/(^|\/)pubspec\.yaml$/)
  if (pubspec) {
    const t = read(root, pubspec)
    add('Dart', t.match(/^\s+sdk:\s*["']?([^"'\n]+)/m)?.[1], pubspec)
    add('Flutter', t.match(/^\s+flutter:\s*["']([^"'\n]+)/m)?.[1], pubspec)
  }
  const pom = first(/(^|\/)pom\.xml$/)
  if (pom) {
    const t = read(root, pom)
    add('Java', t.match(/<(?:java\.version|maven\.compiler\.(?:release|source))>([^<]+)</)?.[1], pom)
  }
  const gradle = first(/(^|\/)build\.gradle(\.kts)?$/)
  if (gradle) {
    const t = read(root, gradle)
    add('Java', t.match(/jvmToolchain\s*\(\s*(\d+)/)?.[1] ?? t.match(/JavaVersion\.VERSION_(\d+(?:_\d+)?)/)?.[1]?.replace('_', '.'), gradle)
  }
  const csproj = first(/(^|\/)[\w.-]+\.csproj$/)
  if (csproj) add('.NET', read(root, csproj).match(/<TargetFrameworks?>([^<;]+)/)?.[1], csproj)
  const cmake = first(/(^|\/)CMakeLists\.txt$/)
  if (cmake) add('C++', read(root, cmake).match(/CMAKE_CXX_STANDARD\s+(\d+)/)?.[1], cmake)
  const docker = first(/(^|\/)Dockerfile$/)
  if (docker) add('Imagem base (Docker)', read(root, docker).match(/^FROM\s+(?:--\S+\s+)?(\S+)/im)?.[1], docker)
  return out
}

/** Ferramentas de build e contêiner que aparecem só pelos arquivos (sem pacote). */
export function langBuildTech(files) {
  const out = []
  const has = (re) => files.find((f) => re.test(f))
  const add = (re, name, category) => {
    const f = has(re)
    if (f) out.push({ name, category, evidence: [f] })
  }
  add(/(^|\/)Dockerfile(\.[\w-]+)?$/, 'Docker', 'build')
  add(/(^|\/)(docker-)?compose\.ya?ml$/, 'Docker Compose', 'build')
  add(/(^|\/)CMakeLists\.txt$/, 'CMake', 'build')
  add(/(^|\/)pom\.xml$/, 'Maven', 'build')
  add(/(^|\/)build\.gradle(\.kts)?$/, 'Gradle', 'build')
  add(/(^|\/)Cargo\.toml$/, 'Cargo', 'build')
  add(/(^|\/)composer\.json$/, 'Composer', 'build')
  add(/(^|\/)[\w.-]+\.sln$/, '.NET (solução)', 'build')
  add(/(^|\/)angular\.json$/, 'Angular CLI', 'build')
  return out
}

// Variáveis de ambiente lidas pelo código, em cada linguagem.
export const LANG_ENV_USE =
  /(?:os\.(?:Getenv|LookupEnv)\(\s*"|env::var\(\s*"|std::env::var\(\s*"|getenv\(\s*['"]|\$_ENV\[\s*['"]|\$_SERVER\[\s*['"]|\benv\(\s*['"]|System\.getenv\(\s*"|Environment\.GetEnvironmentVariable\(\s*"|Platform\.environment\[\s*['"]|dotenv\.env\[\s*['"]|String\.fromEnvironment\(\s*['"]|\$\{)([A-Z][A-Z0-9_]{2,})/g
export const LANG_CODE_FILE = /\.(go|rs|php|java|kt|cs|dart|c|cc|cpp|h|hpp)$|(^|\/)(Dockerfile|application\.(properties|ya?ml)|appsettings\.json)$/
