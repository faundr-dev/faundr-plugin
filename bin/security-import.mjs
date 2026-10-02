// Importa resultados de outras ferramentas para a seção Segurança (achados S-n com origem "import"):
// - Snyk Open Source (snyk test --json)
// - SARIF de qualquer ferramenta (Snyk Code, Semgrep/Opengrep, CodeQL, Gitleaks, Trivy, OSV-Scanner…)
// - Security Advisor do Supabase (resposta da API /advisors/security ou do MCP get_advisors)
// Cada ferramenta fecha só os próprios achados. Do Snyk ficam só título e link (os textos são deles).
import { createHash } from 'node:crypto'

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)
const SEV = ['critical', 'high', 'medium', 'low']
const bySeverity = (s) => (SEV.includes(String(s).toLowerCase()) ? String(s).toLowerCase() : 'medium')

/** Detecta o formato e devolve { tool, findings }. `maskSecrets(texto)` esconde chaves nos trechos. */
export function parseImport(json, maskSecrets = (t) => t) {
  if (Array.isArray(json?.lints)) return supabaseAdvisors(json.lints)
  if (json?.runs && Array.isArray(json.runs)) return sarif(json, maskSecrets)
  const snyk = Array.isArray(json) ? json : [json]
  if (snyk.some((p) => Array.isArray(p?.vulnerabilities))) return snykOpenSource(snyk)
  throw new Error('Formato não reconhecido. Aceito: JSON do "snyk test --json", SARIF (.sarif/.json) e o resultado do Security Advisor do Supabase.')
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
        detail: `O Snyk encontrou a falha ${v.id} na versão ${v.version} do pacote ${v.packageName}. Detalhes no aviso do Snyk (link abaixo).`,
        impact: v.malicious ? 'O pacote foi marcado como malicioso.' : 'Depende de como o projeto usa o pacote; veja o aviso do Snyk.',
        fix: upgrade
          ? `Atualize para ${upgrade}${chain ? ` (o pacote vem de ${chain})` : ''}.`
          : fixed
            ? `Atualize ${v.packageName} para ${fixed} ou mais nova${chain ? ` (ele vem de ${chain}; atualize primeiro o ${chain.split(' > ')[0]})` : ''}.`
            : 'Ainda não existe versão corrigida.',
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
      const severity = Number.isFinite(score) && score > 0
        ? score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low'
        : r.level === 'error' ? 'high' : r.level === 'note' || r.level === 'none' ? 'low' : 'medium'
      const message = maskSecrets(String(r.message?.text ?? rule.shortDescription?.text ?? r.ruleId ?? ''))
      const title = maskSecrets(String(rule.shortDescription?.text ?? rule.name ?? message.split(/(?<=\.)\s/)[0] ?? r.ruleId)).slice(0, 280)
      const cwe = [...new Set(JSON.stringify(rule.properties?.tags ?? rule.properties?.cwe ?? []).match(/CWE-\d+/gi) ?? [])]
      const fp = Object.values(r.partialFingerprints ?? r.fingerprints ?? {})[0]
      findings.push({
        source: isSecrets ? 'secret' : 'code',
        rule_id: String(r.ruleId ?? rule.id ?? 'sarif').slice(0, 200),
        severity,
        confidence: 'medium',
        title: title || 'Problema apontado pela ferramenta',
        detail: `${run.tool?.driver?.name ?? 'A ferramenta'} apontou: ${message}`.slice(0, 3000),
        impact: maskSecrets(String(rule.fullDescription?.text ?? rule.help?.text ?? '')).slice(0, 1500),
        fix: maskSecrets(String(rule.help?.text ?? rule.help?.markdown ?? '')).slice(0, 3000) || 'Veja a regra na documentação da ferramenta.',
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
export function supabaseAdvisors(lints) {
  const findings = lints
    .filter((l) => (l.categories ?? ['SECURITY']).includes('SECURITY'))
    .map((l) => {
      const obj = [l.metadata?.schema, l.metadata?.name].filter(Boolean).join('.')
      return {
        source: 'database',
        rule_id: `supabase:${l.name}`,
        severity: l.level === 'ERROR' ? 'critical' : l.level === 'WARN' ? 'medium' : 'low',
        confidence: 'high',
        title: `${l.title}${obj ? `: ${obj}` : ''}`.slice(0, 280),
        detail: `O Security Advisor do Supabase apontou: ${l.detail ?? l.description ?? l.title}`.slice(0, 3000),
        impact: String(l.description ?? '').slice(0, 1500),
        fix: `Siga a orientação do Supabase: ${l.remediation ?? 'https://supabase.com/docs/guides/database/database-linter'}`,
        file: null,
        line: null,
        advisory_url: l.remediation ?? null,
        fingerprint: l.cache_key ?? `${l.name}|${obj}`,
      }
    })
  return { tool: 'supabase-advisor', findings }
}
