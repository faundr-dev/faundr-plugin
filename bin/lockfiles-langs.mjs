// Leitores das listas de bibliotecas fora de npm e Python, para a mesma checagem no OSV.dev.
// Cada leitor devolve pacotes { name, version, dev, via } no ecossistema que o OSV usa:
// crates.io (Cargo.lock), Go (go.mod), Packagist (composer.lock), Pub (pubspec.lock), RubyGems
// (Gemfile.lock), NuGet (packages.lock.json ou .csproj), Maven (pom.xml, gradle.lockfile, build.gradle,
// libs.versions.toml) e ConanCenter (conan.lock).
import path from 'node:path'

export const LANG_LOCKFILE =
  /(^|\/)(Cargo\.lock|go\.mod|composer\.lock|pubspec\.lock|Gemfile\.lock|packages\.lock\.json|[\w.-]+\.csproj|pom\.xml|gradle\.lockfile|build\.gradle(\.kts)?|libs\.versions\.toml|conan\.lock)$/

// Manifesto sem versão travada: só vale quando a pasta não tem o lockfile, que é mais completo.
const LOCK_FOR = [
  [/(^|\/)[\w.-]+\.csproj$/, 'packages.lock.json'],
  [/(^|\/)build\.gradle(\.kts)?$/, 'gradle.lockfile'],
  [/(^|\/)gradle\/libs\.versions\.toml$/, '../gradle.lockfile'],
]

/** Tira da lista os manifestos cuja pasta já tem o lockfile. */
export function preferLocks(files) {
  const set = new Set(files)
  return files.filter((f) => {
    const rule = LOCK_FOR.find(([re]) => re.test(f))
    return !rule || !set.has(path.posix.normalize(path.posix.join(path.posix.dirname(f), rule[1])))
  })
}

export function parseLangLockfile(rel, text) {
  const base = path.posix.basename(rel)
  if (base === 'Cargo.lock') return { ecosystem: 'crates.io', manager: 'cargo', pkgs: cargoLock(text) }
  if (base === 'go.mod') return { ecosystem: 'Go', manager: 'go', pkgs: goMod(text) }
  if (base === 'composer.lock') return { ecosystem: 'Packagist', manager: 'composer', pkgs: composerLock(text) }
  if (base === 'pubspec.lock') return { ecosystem: 'Pub', manager: 'pub', pkgs: pubspecLock(text) }
  if (base === 'Gemfile.lock') return { ecosystem: 'RubyGems', manager: 'bundler', pkgs: gemfileLock(text) }
  if (base === 'packages.lock.json') return { ecosystem: 'NuGet', manager: 'dotnet', pkgs: nugetLock(text) }
  if (base.endsWith('.csproj')) return { ecosystem: 'NuGet', manager: 'dotnet', pkgs: csproj(text) }
  if (base === 'pom.xml') return { ecosystem: 'Maven', manager: 'maven', pkgs: pomXml(text) }
  if (base === 'gradle.lockfile') return { ecosystem: 'Maven', manager: 'gradle', pkgs: gradleLock(text) }
  if (base === 'build.gradle' || base === 'build.gradle.kts') return { ecosystem: 'Maven', manager: 'gradle', pkgs: buildGradle(text) }
  if (base === 'libs.versions.toml') return { ecosystem: 'Maven', manager: 'gradle', pkgs: versionCatalog(text) }
  if (base === 'conan.lock') return { ecosystem: 'ConanCenter', manager: 'conan', pkgs: conanLock(text) }
  return null
}

const pkg = (name, version, dev = false) => ({ name, version: String(version).trim(), dev, via: null })
const plainVersion = (v) => /^\d[\w.+-]*$/.test(v ?? '')

// [[package]] name = "x" / version = "1.0.0" / source = "registry+..." (sem source = crate do próprio projeto)
function cargoLock(text) {
  return text
    .split(/^\[\[package\]\]\s*$/m)
    .slice(1)
    .map((block) => ({
      name: block.match(/^name\s*=\s*"([^"]+)"/m)?.[1],
      version: block.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
      registry: /^source\s*=\s*"registry\+/m.test(block),
    }))
    .filter((p) => p.name && p.version && p.registry)
    .map((p) => pkg(p.name, p.version))
}

// require ( modulo v1.2.3 // indirect ) e require modulo v1.2.3. O OSV usa a versão sem o "v".
function goMod(text) {
  const out = []
  const add = (line) => {
    const m = line.match(/^\s*([\w.~/-]+\.[\w.~/-]+)\s+v([\w.+-]+)/)
    if (m) out.push(pkg(m[1], m[2].replace(/\+incompatible$/, '')))
  }
  for (const block of text.matchAll(/^require\s*\(([\s\S]*?)^\)/gm)) block[1].split('\n').forEach(add)
  for (const m of text.matchAll(/^require\s+([^\s(].*)$/gm)) add(m[1])
  return out
}

function composerLock(text) {
  const lock = JSON.parse(text)
  const strip = (v) => String(v).replace(/^v/, '')
  return [
    ...(lock.packages ?? []).filter((p) => plainVersion(strip(p.version))).map((p) => pkg(p.name, strip(p.version))),
    ...(lock['packages-dev'] ?? []).filter((p) => plainVersion(strip(p.version))).map((p) => pkg(p.name, strip(p.version), true)),
  ]
}

// packages:\n  nome:\n    dependency: "direct dev"\n    source: hosted\n    version: "1.2.3"
function pubspecLock(text) {
  const out = []
  const section = text.split(/^packages:\s*$/m)[1]?.split(/^\S/m)[0] ?? ''
  for (const block of section.split(/^ {2}(?=[\w-]+:\s*$)/m)) {
    const name = block.match(/^([\w-]+):/)?.[1]
    const version = block.match(/^\s{4}version:\s*"?([^"\s]+)"?/m)?.[1]
    const source = block.match(/^\s{4}source:\s*(\w+)/m)?.[1]
    if (name && version && source === 'hosted') out.push(pkg(name, version, /dependency:\s*"direct dev"/.test(block)))
  }
  return out
}

// GEM / specs: "    nome (1.2.3)" (4 espaços; 6 espaços são as dependências de cada uma)
function gemfileLock(text) {
  const out = []
  for (const section of text.split(/^GEM\s*$/m).slice(1)) {
    const specs = section.split(/^\S/m)[0]
    for (const m of specs.matchAll(/^ {4}([\w.-]+) \(([^)\s]+)\)\s*$/gm)) out.push(pkg(m[1], m[2].replace(/-(x86|arm|aarch|universal|java|mingw|x64)[\w-]*$/, '')))
  }
  return out
}

function nugetLock(text) {
  const lock = JSON.parse(text)
  const seen = new Map()
  for (const deps of Object.values(lock.dependencies ?? {}))
    for (const [name, d] of Object.entries(deps ?? {})) if (d?.resolved && d.type !== 'Project') seen.set(`${name}@${d.resolved}`, pkg(name, d.resolved))
  return [...seen.values()]
}

// <PackageReference Include="Nome" Version="1.2.3" /> (ou <Version>1.2.3</Version> dentro)
function csproj(text) {
  const out = []
  for (const m of text.matchAll(/<PackageReference\b([^>]*?)(\/>|>([\s\S]*?)<\/PackageReference>)/g)) {
    const name = m[1].match(/Include="([^"]+)"/)?.[1]
    const version = m[1].match(/Version="([^"]+)"/)?.[1] ?? m[3]?.match(/<Version>([^<]+)<\/Version>/)?.[1]
    if (name && plainVersion(version)) out.push(pkg(name, version, /PrivateAssets="all"/i.test(m[1]) && /analyzers|test/i.test(name)))
  }
  return out
}

// <dependency><groupId/><artifactId/><version/><scope/></dependency>, com ${propriedade} do <properties>.
function pomXml(text) {
  const props = {}
  const propBlock = text.match(/<properties>([\s\S]*?)<\/properties>/)?.[1] ?? ''
  for (const m of propBlock.matchAll(/<([\w.-]+)>([^<]+)<\/\1>/g)) props[m[1]] = m[2].trim()
  props['project.version'] = text.match(/<\/parent>[\s\S]*?<version>([^<]+)<\/version>/)?.[1] ?? text.match(/<version>([^<]+)<\/version>/)?.[1]
  const resolve = (v) => String(v ?? '').replace(/\$\{([^}]+)\}/g, (_, k) => props[k] ?? '')
  const out = []
  for (const m of text.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const tag = (t) => m[1].match(new RegExp(`<${t}>([^<]+)</${t}>`))?.[1]?.trim()
    const version = resolve(tag('version'))
    if (tag('groupId') && tag('artifactId') && plainVersion(version)) out.push(pkg(`${resolve(tag('groupId'))}:${tag('artifactId')}`, version, tag('scope') === 'test'))
  }
  return out
}

// grupo:artefato:versão=compileClasspath,runtimeClasspath
function gradleLock(text) {
  return [...text.matchAll(/^([\w.-]+):([\w.-]+):([\w.+-]+)=(.*)$/gm)].map((m) => pkg(`${m[1]}:${m[2]}`, m[3], !/(compile|runtime)Classpath/.test(m[4]) || /^test/i.test(m[4])))
}

// implementation 'grupo:artefato:1.2.3' · testImplementation("grupo:artefato:1.2.3")
function buildGradle(text) {
  const out = []
  for (const m of text.matchAll(/^\s*(\w+)\s*\(?\s*["']([\w.-]+):([\w.-]+):([\w.+-]+)["']/gm)) {
    if (!/implementation|api|compile|runtime|kapt|ksp|annotationProcessor/i.test(m[1]) || !plainVersion(m[4])) continue
    out.push(pkg(`${m[2]}:${m[3]}`, m[4], /^(test|androidTest|debug)/.test(m[1])))
  }
  return out
}

// [versions] kotlin = "2.0.0" · [libraries] x = { module = "g:a", version.ref = "kotlin" } (ou group/name/version)
function versionCatalog(text) {
  const versions = {}
  const section = (name) => text.match(new RegExp(`^\\[${name}\\]\\s*$([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, 'm'))?.[1] ?? ''
  for (const m of section('versions').matchAll(/^\s*([\w.-]+)\s*=\s*"([^"]+)"/gm)) versions[m[1]] = m[2]
  const out = []
  for (const m of section('libraries').matchAll(/^\s*[\w.-]+\s*=\s*(.+)$/gm)) {
    const v = m[1]
    const short = v.match(/^"([\w.-]+):([\w.-]+):([\w.+-]+)"/)
    const module = v.match(/module\s*=\s*"([\w.-]+:[\w.-]+)"/)?.[1] ?? (v.match(/group\s*=\s*"([^"]+)"/) && `${v.match(/group\s*=\s*"([^"]+)"/)[1]}:${v.match(/name\s*=\s*"([^"]+)"/)?.[1]}`)
    const version = v.match(/version\.ref\s*=\s*"([^"]+)"/) ? versions[v.match(/version\.ref\s*=\s*"([^"]+)"/)[1]] : v.match(/version\s*=\s*"([^"]+)"/)?.[1]
    if (short) out.push(pkg(`${short[1]}:${short[2]}`, short[3]))
    else if (module && plainVersion(version)) out.push(pkg(module, version))
  }
  return out
}

// "requires": ["zlib/1.3.1#hash%123"] (Conan 2) ou "ref": "zlib/1.2.13" (Conan 1)
function conanLock(text) {
  const lock = JSON.parse(text)
  const refs = [...(lock.requires ?? []), ...(lock.build_requires ?? []).map((r) => ({ r, dev: true }))]
  for (const n of Object.values(lock.graph_lock?.nodes ?? {})) if (n.ref) refs.push(n.ref)
  return refs
    .map((r) => (typeof r === 'string' ? { r, dev: false } : r))
    .map(({ r, dev }) => ({ m: String(r).match(/^([\w.+-]+)\/([\w.+-]+)/), dev }))
    .filter((x) => x.m)
    .map((x) => pkg(x.m[1], x.m[2], x.dev))
}
