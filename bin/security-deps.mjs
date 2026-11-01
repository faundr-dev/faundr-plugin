// Dependências com falha conhecida: lockfiles, consulta ao OSV (com cache) e o achado de cada pacote
// (parte de security.mjs).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { LANG_LOCKFILE, parseLangLockfile, preferLocks } from './lockfiles-langs.mjs'
import { LOCKFILE, parseLockfile } from './lockfiles.mjs'
import { t } from './i18n.mjs'
import { readText } from './security-base.mjs'

// ---- pacotes (lockfile + OSV) ---------------------------------------------------------------

const cmpParts = (a, b) => {
  const pa = String(a).split('.')
  const pb = String(b).split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1
    if (pb[i] === undefined) return 1
    const na = /^\d+$/.test(pa[i]) ? Number(pa[i]) : null
    const nb = /^\d+$/.test(pb[i]) ? Number(pb[i]) : null
    if (na !== null && nb !== null && na !== nb) return na - nb
    if (na === null && nb !== null) return 1
    if (na !== null && nb === null) return -1
    if (na === null && pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

/** Compara versões semver (1.2.3-beta.1). */
export function compareVersions(a, b) {
  const [ma, pa] = String(a).replace(/^v/, '').split(/-(.*)/s)
  const [mb, pb] = String(b).replace(/^v/, '').split(/-(.*)/s)
  const main = cmpParts(ma.split('+')[0], mb.split('+')[0])
  if (main) return main
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  return cmpParts(pa, pb)
}

const OSV = 'https://api.osv.dev/v1'
const CACHE_FILE = path.join(os.homedir(), '.faundr', 'osv-cache.json')

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    // Sem cache ainda (primeira checagem) ou arquivo corrompido: começa vazio e busca tudo no OSV.
    return {}
  }
}

// Ecossistemas que o Faundr lê (lockfiles.mjs e lockfiles-langs.mjs), com o nome que o OSV usa.
const OSV_ECOSYSTEMS = new Set(['npm', 'PyPI', 'crates.io', 'Go', 'Packagist', 'Pub', 'RubyGems', 'NuGet', 'Maven', 'ConanCenter'])

async function osvDetails(ids, known) {
  const cache = readCache()
  const missing = ids.filter((id) => cache[id]?.modified !== known.get(id))
  for (let i = 0; i < missing.length; i += 8) {
    await Promise.all(
      missing.slice(i, i + 8).map(async (id) => {
        const res = await fetch(`${OSV}/vulns/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) return
        const v = await res.json()
        cache[id] = {
          modified: v.modified,
          summary: v.summary ?? '',
          details: (v.details ?? '').slice(0, 800),
          aliases: v.aliases ?? [],
          severity: v.database_specific?.severity ?? null,
          vectors: (v.severity ?? []).map((s) => s.score),
          cwe: v.database_specific?.cwe_ids ?? [],
          affected: (v.affected ?? [])
            .filter((a) => OSV_ECOSYSTEMS.has(a.package?.ecosystem))
            .map((a) => ({ name: a.package.name, ranges: a.ranges ?? [], versions: a.versions?.length > 200 ? [] : (a.versions ?? []) })),
          url: v.references?.find((r) => r.type === 'ADVISORY')?.url ?? `https://osv.dev/vulnerability/${id}`,
        }
      }),
    )
  }
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
  } catch {
    // Sem gravar o cache a checagem sai igual; só busca os detalhes no OSV de novo da próxima vez.
  }
  return cache
}

// CVSS 3.x: nota base a partir do vetor (CVSS:3.1/AV:N/AC:L/...).
export function cvss3(vector) {
  const m = Object.fromEntries(String(vector).split('/').map((p) => p.split(':')))
  if (!m.AV || !m.S) return null
  const scope = m.S === 'C'
  const W = { AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }, AC: { L: 0.77, H: 0.44 }, UI: { N: 0.85, R: 0.62 }, CIA: { H: 0.56, L: 0.22, N: 0 } }
  const pr = { N: 0.85, L: scope ? 0.68 : 0.62, H: scope ? 0.5 : 0.27 }[m.PR]
  const iss = 1 - (1 - W.CIA[m.C]) * (1 - W.CIA[m.I]) * (1 - W.CIA[m.A])
  const impact = scope ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss
  const exploit = 8.22 * W.AV[m.AV] * W.AC[m.AC] * pr * W.UI[m.UI]
  if (!(impact > 0)) return 0
  const up = (x) => Math.ceil(x * 10 - 1e-9) / 10
  return up(Math.min(scope ? 1.08 * (impact + exploit) : impact + exploit, 10))
}

function vulnSeverity(id, v) {
  if (id.startsWith('MAL-')) return 'critical'
  const label = { CRITICAL: 'critical', HIGH: 'high', MODERATE: 'medium', MEDIUM: 'medium', LOW: 'low' }[String(v.severity).toUpperCase()]
  if (label) return label
  const score = v.vectors.map(cvss3).find((s) => s !== null)
  if (score == null) return 'medium'
  return scoreSeverity(score)
}

// Nota CVSS → gravidade (as faixas do CVSS 3).
function scoreSeverity(score) {
  if (score >= 9) return 'critical'
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

// Versões corrigidas de uma faixa (introduced → fixed) que valem para a versão instalada.
function fixesInRange(r, version) {
  const fixes = []
  let introduced = null
  for (const e of r.events) {
    if (e.introduced !== undefined) introduced = e.introduced
    else if (e.fixed !== undefined && introduced !== null) {
      if ((introduced === '0' || compareVersions(version, introduced) >= 0) && compareVersions(version, e.fixed) < 0) fixes.push(e.fixed)
      introduced = null
    }
  }
  return fixes
}

// Menor versão corrigida para a versão instalada (null = ainda não existe correção).
function fixedVersion(v, name, version) {
  const fixes = []
  for (const a of v.affected.filter((x) => x.name === name))
    for (const r of a.ranges) if (r.type === 'SEMVER' || r.type === 'ECOSYSTEM') fixes.push(...fixesInRange(r, version))
  return fixes.sort(compareVersions)[0] ?? null
}

// Primeiras frases do aviso (em inglês, como vem da base pública), sem cortar no meio.
function firstSentences(details, max = 320) {
  const para = (details ?? '').split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? ''
  if (!para) return ''
  if (para.length <= max) return ` ${para}`
  const cut = para.slice(0, max).match(/^(.*[.!?])\s/s)?.[1]
  return ` ${cut ?? `${para.slice(0, max).replace(/\s+\S*$/, '')}…`}`
}

// Comandos de atualização por gerenciador (a dica de correção usa o do projeto).
// force: onde fixar a versão de um pacote indireto (texto para a pessoa, por isso um getter com t()).
const MANAGER = {
  npm: { add: (n, v) => `npm install ${n}@^${v}`, update: (n) => `npm update ${n}`, remove: (n) => `npm uninstall ${n}`, get force() { return t('in "overrides" in package.json', 'em "overrides" no package.json') } },
  pnpm: { add: (n, v) => `pnpm add ${n}@^${v}`, update: (n) => `pnpm update ${n}`, remove: (n) => `pnpm remove ${n}`, get force() { return t('in "pnpm.overrides" in package.json', 'em "pnpm.overrides" no package.json') } },
  yarn: { add: (n, v) => `yarn add ${n}@^${v}`, update: (n) => `yarn up ${n}`, remove: (n) => `yarn remove ${n}`, get force() { return t('in "resolutions" in package.json', 'em "resolutions" no package.json') } },
  bun: { add: (n, v) => `bun add ${n}@^${v}`, update: (n) => `bun update ${n}`, remove: (n) => `bun remove ${n}`, get force() { return t('in "overrides" in package.json', 'em "overrides" no package.json') } },
  pip: {
    add: (n, v) => t(`change the line to ${n}==${v} in requirements and run pip install -r`, `atualize a linha para ${n}==${v} no requirements e rode pip install -r`),
    update: (n) => `pip install -U ${n}`,
    remove: (n) => `pip uninstall ${n}`,
    get force() { return t('by pinning the version in requirements', 'fixando a versão no requirements') },
  },
  poetry: { add: (n, v) => `poetry add ${n}@^${v}`, update: (n) => `poetry update ${n}`, remove: (n) => `poetry remove ${n}`, get force() { return t('as a direct dependency in pyproject.toml', 'como dependência direta no pyproject.toml') } },
  uv: { add: (n, v) => `uv add "${n}>=${v}"`, update: (n) => `uv lock --upgrade-package ${n}`, remove: (n) => `uv remove ${n}`, get force() { return t('as a direct dependency in pyproject.toml', 'como dependência direta no pyproject.toml') } },
  pipenv: { add: (n, v) => `pipenv install "${n}>=${v}"`, update: (n) => `pipenv update ${n}`, remove: (n) => `pipenv uninstall ${n}`, get force() { return t('in the Pipfile', 'no Pipfile') } },
  cargo: { add: (n, v) => `cargo update -p ${n} --precise ${v}`, update: (n) => `cargo update -p ${n}`, remove: (n) => `cargo remove ${n}`, get force() { return t('as a direct dependency in Cargo.toml', 'como dependência direta no Cargo.toml') } },
  go: {
    add: (n, v) => `go get ${n}@v${v} && go mod tidy`,
    update: (n) => `go get -u ${n} && go mod tidy`,
    remove: (n) => t(`remove the import of ${n} and run go mod tidy`, `tire o import de ${n} e rode go mod tidy`),
    get force() { return t('with go get in go.mod', 'com go get no go.mod') },
  },
  composer: { add: (n, v) => `composer require ${n}:^${v}`, update: (n) => `composer update ${n} --with-dependencies`, remove: (n) => `composer remove ${n}`, get force() { return t('as a direct dependency in composer.json', 'como dependência direta no composer.json') } },
  pub: { add: (n, v) => `flutter pub add ${n}:^${v}`, update: (n) => `flutter pub upgrade ${n}`, remove: (n) => `flutter pub remove ${n}`, get force() { return t('in dependency_overrides in pubspec.yaml', 'em dependency_overrides no pubspec.yaml') } },
  bundler: {
    add: (n, v) => t(`put gem "${n}", ">= ${v}" in the Gemfile and run bundle update ${n}`, `ponha gem "${n}", ">= ${v}" no Gemfile e rode bundle update ${n}`),
    update: (n) => `bundle update ${n}`,
    remove: (n) => t(`remove the gem ${n} from the Gemfile and run bundle install`, `tire a gem ${n} do Gemfile e rode bundle install`),
    get force() { return t('as a direct gem in the Gemfile', 'como gem direta no Gemfile') },
  },
  dotnet: { add: (n, v) => `dotnet add package ${n} --version ${v}`, update: (n) => `dotnet add package ${n}`, remove: (n) => `dotnet remove package ${n}`, get force() { return t('as a direct PackageReference in the .csproj', 'como PackageReference direta no .csproj') } },
  maven: {
    add: (n, v) => t(`change the version of ${n} to ${v} in pom.xml`, `troque a versão de ${n} para ${v} no pom.xml`),
    update: (n) => t(`update the version of ${n} in pom.xml`, `atualize a versão de ${n} no pom.xml`),
    remove: (n) => t(`remove ${n} from pom.xml`, `tire ${n} do pom.xml`),
    get force() { return t('in <dependencyManagement> in pom.xml', 'em <dependencyManagement> no pom.xml') },
  },
  gradle: {
    add: (n, v) => t(`change the version of ${n} to ${v} in build.gradle (or in libs.versions.toml)`, `troque a versão de ${n} para ${v} no build.gradle (ou no libs.versions.toml)`),
    update: (n) => t(`update the version of ${n} in build.gradle`, `atualize a versão de ${n} no build.gradle`),
    remove: (n) => t(`remove ${n} from build.gradle`, `tire ${n} do build.gradle`),
    get force() { return t('with a constraint in build.gradle', 'com uma constraint no build.gradle') },
  },
  conan: {
    add: (n, v) => t(`change to ${n}/${v} in the conanfile and run conan lock create`, `troque para ${n}/${v} no conanfile e rode conan lock create`),
    update: (n) => t(`update ${n} in the conanfile`, `atualize ${n} no conanfile`),
    remove: (n) => t(`remove ${n} from the conanfile`, `tire ${n} do conanfile`),
    get force() { return t('as a direct requirement in the conanfile', 'como requisito direto no conanfile') },
  },
}

// Pacotes de todos os lockfiles, com o ecossistema, o gerenciador e o lockfile de onde vieram.
function lockfileEntries(root, lockfiles) {
  const entries = []
  const readManifest = (dir) => {
    try {
      return JSON.parse(readText(root, path.posix.join(dir, 'package.json')) ?? '{}')
    } catch {
      // package.json ausente ou inválido: o lockfile é lido sem ele.
      return {}
    }
  }
  for (const lf of lockfiles) {
    const text = readText(root, lf)
    if (!text) continue
    let parsed
    try {
      parsed = LOCKFILE.test(lf) ? parseLockfile(lf, text, readManifest) : parseLangLockfile(lf, text)
    } catch {
      continue
    }
    if (!parsed) continue
    for (const p of parsed.pkgs) entries.push({ ...p, ecosystem: parsed.ecosystem, manager: parsed.manager, lockfile: lf })
  }
  return entries
}

const pkgKey = (e) => `${e.ecosystem}:${e.name}@${e.version}`

// Pergunta ao OSV, em lotes de 1000, quais pacotes têm falha: ids por pacote e quando cada falha mudou.
async function osvQuery(unique) {
  const known = new Map()
  const hits = new Map() // name@version → ids
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000)
    const res = await fetch(`${OSV}/querybatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: batch.map((e) => ({ package: { name: e.name, ecosystem: e.ecosystem }, version: e.version })) }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`OSV answered ${res.status}`)
    const { results } = await res.json()
    results.forEach((r, j) => {
      if (!r.vulns?.length) return
      hits.set(pkgKey(batch[j]), r.vulns.map((v) => v.id))
      for (const v of r.vulns) known.set(v.id, v.modified)
    })
  }
  return { known, hits }
}

// O GHSA vem primeiro; o resto em ordem alfabética.
function ghsaFirst(a, b) {
  if (a.startsWith('GHSA')) return -1
  if (b.startsWith('GHSA')) return 1
  return a.localeCompare(b)
}

// Uma falha costuma ter vários ids (GHSA + CVE): fica o GHSA, com os outros como apelidos.
function primaryIds(ids, details) {
  const primary = new Map()
  for (const id of ids) {
    const v = details[id]
    if (!v) continue
    const group = [id, ...v.aliases].sort(ghsaFirst)[0]
    if (!primary.has(group) || id.startsWith('GHSA')) primary.set(group, id)
  }
  return [...primary.values()]
}

function dependencyFix(e, cmd, { malicious, fixed, chain }) {
  if (malicious)
    return t(
      `Remove the package (${cmd.remove(e.via?.[0] ?? e.name)}), delete the installed dependencies folder and replace the keys and passwords on this computer.`,
      `Remova o pacote (${cmd.remove(e.via?.[0] ?? e.name)}), apague a pasta de dependências instaladas e troque as chaves e senhas deste computador.`,
    )
  if (!fixed)
    return t(
      "There is no fixed version yet. Check the advisory for another way to avoid the problem, or whether you can switch packages.",
      'Ainda não existe versão corrigida. Veja se há outra forma de evitar o problema no aviso da falha ou se dá para trocar de pacote.',
    )
  if (chain)
    return t(
      `${e.name} comes from ${chain}. Update ${e.via[0]} (${cmd.update(e.via[0])}); if that does not fix it, force ${e.name} ${fixed} or newer ${cmd.force}.`,
      `O ${e.name} vem de ${chain}. Atualize o ${e.via[0]} (${cmd.update(e.via[0])}); se não resolver, force o ${e.name} ${fixed} ou mais novo ${cmd.force}.`,
    )
  return t(`Update to version ${fixed} or newer: ${cmd.add(e.name, fixed)}`, `Atualize para a versão ${fixed} ou mais nova: ${cmd.add(e.name, fixed)}`)
}

function dependencyFinding(e, id, v) {
  const cmd = MANAGER[e.manager] ?? MANAGER.npm
  const malicious = id.startsWith('MAL-')
  const fixed = malicious ? null : fixedVersion(v, e.name, e.version)
  const chain = e.via?.length > 1 ? e.via.join(' > ') : null
  return {
    source: 'dependency',
    rule_id: id,
    severity: vulnSeverity(id, v),
    confidence: 'high',
    title: malicious ? t(`Malicious package: ${e.name}`, `Pacote malicioso: ${e.name}`) : `${e.name} ${e.version}: ${v.summary || t('known security flaw', 'falha de segurança conhecida')}`,
    detail: malicious
      ? t(
          `The package ${e.name} ${e.version} was flagged as malicious (code made to steal data or attack whoever installs it).`,
          `O pacote ${e.name} ${e.version} foi marcado como malicioso (código feito para roubar dados ou atacar quem instala).`,
        )
      : t(
          `Version ${e.version} of the package ${e.name} has a published security flaw (${id}).${firstSentences(v.details)}`,
          `A versão ${e.version} do pacote ${e.name} tem uma falha de segurança publicada (${id}).${firstSentences(v.details)}`,
        ),
    impact: malicious
      ? t(
          'It may already have run on your computer when it was installed. Remove it and replace the keys that were on the machine.',
          'Ele pode já ter rodado no seu computador ao ser instalado. Remova e troque as chaves que estavam na máquina.',
        )
      : t(
          `Depends on how the project uses the package${e.dev ? '; since it is only used during development, it does not go to the live site' : ''}.`,
          `Depende de como o projeto usa o pacote${e.dev ? '; como ele só é usado no desenvolvimento, não vai para o site publicado' : ''}.`,
        ),
    fix: dependencyFix(e, cmd, { malicious, fixed, chain }),
    file: e.lockfile,
    line: null,
    snippet: null,
    package: e.name,
    version: e.version,
    fixed_in: fixed,
    introduced_by: chain,
    dev: e.dev,
    cve: [id, ...v.aliases].filter((a) => /^(CVE|GHSA)-/.test(a)),
    cwe: v.cwe,
    advisory_url: v.url,
    fingerprint: `dependency|${e.lockfile}|${e.name}|${id}`,
  }
}

export async function scanDependencies(root, files) {
  const lockfiles = preferLocks(files.filter((f) => LOCKFILE.test(f) || LANG_LOCKFILE.test(f)))
  const entries = lockfileEntries(root, lockfiles)
  const unique = [...new Map(entries.map((e) => [pkgKey(e), e])).values()]
  if (!unique.length) return { findings: [], packages: 0, lockfiles, snapshot: { packages: [], known: [] } }

  const { known, hits } = await osvQuery(unique)
  const details = await osvDetails([...known.keys()], known)

  const findings = []
  for (const e of entries) {
    const ids = hits.get(pkgKey(e))
    if (!ids) continue
    for (const id of primaryIds(ids, details)) findings.push(dependencyFinding(e, id, details[id]))
  }
  // Lista de pacotes (só nomes e versões) para o servidor conferir todo dia se surgiu falha nova.
  const snapshot = {
    packages: unique.map((e) => ({ e: e.ecosystem, n: e.name, v: e.version, lf: e.lockfile, dev: !!e.dev, ...(e.via?.length > 1 ? { via: e.via.join(' > ') } : {}) })),
    known: [...known.keys()],
  }
  return { findings: [...new Map(findings.map((f) => [f.fingerprint, f])).values()], packages: unique.length, lockfiles, snapshot }
}
