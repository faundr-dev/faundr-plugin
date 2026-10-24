// Importa resultados de outras ferramentas para a seção Segurança (achados S-n com origem "import"):
// - Snyk Open Source (snyk test --json)
// - SARIF de qualquer ferramenta (Snyk Code, Semgrep/Opengrep, CodeQL, Gitleaks, Trivy, OSV-Scanner…)
// - Security Advisor do Supabase (resposta da API /advisors/security ou do MCP get_advisors)
// Cada ferramenta fecha só os próprios achados. Do Snyk ficam só título e link (os textos são deles).
import { createHash } from 'node:crypto'
import { t } from './i18n.mjs'

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)
const SEV = ['critical', 'high', 'medium', 'low']
const bySeverity = (s) => (SEV.includes(String(s).toLowerCase()) ? String(s).toLowerCase() : 'medium')

/** Detecta o formato e devolve { tool, findings }. `maskSecrets(texto)` esconde chaves nos trechos. */
export function parseImport(json, maskSecrets = (t) => t) {
  if (Array.isArray(json?.lints)) return supabaseAdvisors(json.lints)
  if (json?.runs && Array.isArray(json.runs)) return sarif(json, maskSecrets)
  const snyk = Array.isArray(json) ? json : [json]
  if (snyk.some((p) => Array.isArray(p?.vulnerabilities))) return snykOpenSource(snyk)
  throw new Error('Unrecognized format. Accepted: JSON from "snyk test --json", SARIF (.sarif/.json) and the Supabase Security Advisor result.')
}

// Dica de correção do Snyk: o caminho de atualização sugerido, a versão corrigida ou nenhuma ainda.
function snykFix(v, upgrade, fixed, chain) {
  if (upgrade) return t(`Update to ${upgrade}${chain ? ` (the package comes from ${chain})` : ''}.`, `Atualize para ${upgrade}${chain ? ` (o pacote vem de ${chain})` : ''}.`)
  if (fixed)
    return t(
      `Update ${v.packageName} to ${fixed} or newer${chain ? ` (it comes from ${chain}; update ${chain.split(' > ')[0]} first)` : ''}.`,
      `Atualize ${v.packageName} para ${fixed} ou mais nova${chain ? ` (ele vem de ${chain}; atualize primeiro o ${chain.split(' > ')[0]})` : ''}.`,
    )
  return t('There is no fixed version yet.', 'Ainda não existe versão corrigida.')
}

function snykOpenSource(projects) {
  const findings = []
  for (const p of projects) {
    const file = p.displayTargetFile ?? p.targetFile ?? p.path ?? 'package.json'
    for (const v of p.vulnerabilities ?? []) {
      const fixed = v.nearestFixedInVersion ?? v.fixedIn?.[0] ?? null
      const chain = Array.isArray(v.from) && v.from.length > 2 ? v.from.slice(1).map((x) => x.replace(/@[^@]+$/, '')).join(' > ') : null
      const upgrade = Array.isArray(v.upgradePath) ? v.upgradePath.find((x) => x) : null
      findings.push({
        source: 'dependency',
        rule_id: v.id,
        severity: bySeverity(v.severity),
        confidence: 'high',
        title: `${v.packageName} ${v.version}: ${v.title}`,
        detail: t(
          `Snyk found the flaw ${v.id} in version ${v.version} of the package ${v.packageName}. Details in the Snyk advisory (link below).`,
          `O Snyk encontrou a falha ${v.id} na versão ${v.version} do pacote ${v.packageName}. Detalhes no aviso do Snyk (link abaixo).`,
        ),
        impact: v.malicious
          ? t('The package was flagged as malicious.', 'O pacote foi marcado como malicioso.')
          : t('Depends on how the project uses the package; see the Snyk advisory.', 'Depende de como o projeto usa o pacote; veja o aviso do Snyk.'),
        fix: snykFix(v, upgrade, fixed, chain),
        file,
        package: v.packageName,
        version: v.version,
        fixed_in: fixed,
        introduced_by: chain,
        cve: [...(v.identifiers?.CVE ?? []), ...(v.identifiers?.GHSA ?? [])].slice(0, 20),
        cwe: (v.identifiers?.CWE ?? []).slice(0, 20),
        advisory_url: `https://security.snyk.io/vuln/${encodeURIComponent(v.id)}`,
        fingerprint: `${file}|${v.packageName}|${v.id}`,
      })
    }
  }
  return { tool: 'snyk', findings: [...new Map(findings.map((f) => [f.fingerprint, f])).values()] }
}

// Gravidade no SARIF: pela nota security-severity (CVSS) quando existe; senão, pelo nível do resultado.
function sarifSeverity(score, level) {
  if (Number.isFinite(score) && score > 0) {
    if (score >= 9) return 'critical'
    if (score >= 7) return 'high'
    if (score >= 4) return 'medium'
    return 'low'
  }
  if (level === 'error') return 'high'
  if (level === 'note' || level === 'none') return 'low'
  return 'medium'
}

function sarif(doc, maskSecrets) {
  const findings = []
  let tool = 'sarif'
  for (const run of doc.runs) {
    const name = String(run.tool?.driver?.name ?? 'sarif').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    tool = `sarif-${name}`.slice(0, 60)
    const rules = new Map((run.tool?.driver?.rules ?? []).map((r) => [r.id, r]))
    const isSecrets = /gitleaks|betterleaks|trufflehog|secret/.test(name)
    for (const r of run.results ?? []) {
      const rule = rules.get(r.ruleId) ?? run.tool?.driver?.rules?.[r.ruleIndex] ?? {}
      const loc = r.locations?.[0]?.physicalLocation
      const file = loc?.artifactLocation?.uri ? decodeURIComponent(loc.artifactLocation.uri).replace(/^file:\/\/\/?/, '').replace(/\\/g, '/') : null
      const line = loc?.region?.startLine ?? null
      const score = Number(rule.properties?.['security-severity'] ?? r.properties?.['security-severity'])
      const severity = sarifSeverity(score, r.level)
      const message = maskSecrets(String(r.message?.text ?? rule.shortDescription?.text ?? r.ruleId ?? ''))
      const title = maskSecrets(String(rule.shortDescription?.text ?? rule.name ?? message.split(/(?<=\.)\s/)[0] ?? r.ruleId)).slice(0, 280)
      const cwe = [...new Set(JSON.stringify(rule.properties?.tags ?? rule.properties?.cwe ?? []).match(/CWE-\d+/gi) ?? [])]
      const fp = Object.values(r.partialFingerprints ?? r.fingerprints ?? {})[0]
      findings.push({
        source: isSecrets ? 'secret' : 'code',
        rule_id: String(r.ruleId ?? rule.id ?? 'sarif').slice(0, 200),
        severity,
        confidence: 'medium',
        title: title || t('Issue flagged by the tool', 'Problema apontado pela ferramenta'),
        detail: t(`${run.tool?.driver?.name ?? 'The tool'} flagged: ${message}`, `${run.tool?.driver?.name ?? 'A ferramenta'} apontou: ${message}`).slice(0, 3000),
        impact: maskSecrets(String(rule.fullDescription?.text ?? rule.help?.text ?? '')).slice(0, 1500),
        fix: maskSecrets(String(rule.help?.text ?? rule.help?.markdown ?? '')).slice(0, 3000) || t("See the rule in the tool's documentation.", 'Veja a regra na documentação da ferramenta.'),
        file,
        line,
        snippet: loc?.region?.snippet?.text ? maskSecrets(loc.region.snippet.text.trim()).slice(0, 240) : null,
        cwe,
        advisory_url: rule.helpUri ?? null,
        fingerprint: fp ? `${r.ruleId}|${fp}` : `${r.ruleId}|${file}|${hash(message)}`,
      })
    }
  }
  return { tool, findings: [...new Map(findings.map((f) => [f.fingerprint, f])).values()] }
}

// Security Advisor do Supabase: o mesmo verificador do painel do Supabase, olhando o banco de verdade
// (inclusive o que foi configurado direto no painel e não está nas migrations).
function advisorSeverity(level) {
  if (level === 'ERROR') return 'critical'
  if (level === 'WARN') return 'medium'
  return 'low'
}

export function supabaseAdvisors(lints) {
  const findings = lints
    .filter((l) => (l.categories ?? ['SECURITY']).includes('SECURITY'))
    .map((l) => {
      const obj = [l.metadata?.schema, l.metadata?.name].filter(Boolean).join('.')
      return {
        source: 'database',
        rule_id: `supabase:${l.name}`,
        severity: advisorSeverity(l.level),
        confidence: 'high',
        title: `${l.title}${obj ? `: ${obj}` : ''}`.slice(0, 280),
        detail: t(`The Supabase Security Advisor flagged: ${l.detail ?? l.description ?? l.title}`, `O Security Advisor do Supabase apontou: ${l.detail ?? l.description ?? l.title}`).slice(0, 3000),
        impact: String(l.description ?? '').slice(0, 1500),
        fix: t(`Follow Supabase's guidance: ${l.remediation ?? 'https://supabase.com/docs/guides/database/database-linter'}`, `Siga a orientação do Supabase: ${l.remediation ?? 'https://supabase.com/docs/guides/database/database-linter'}`),
        file: null,
        line: null,
        advisory_url: l.remediation ?? null,
        fingerprint: l.cache_key ?? `${l.name}|${obj}`,
      }
    })
  return { tool: 'supabase-advisor', findings }
}
