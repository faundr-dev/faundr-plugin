// Biblioteca de padrões de erro: o que se repetiu corrigido em outros projetos da mesma linguagem (aprovado pela
// equipe do Faundr) entra nos comandos de contexto da área e no error-show. Falhou a rede, a seção some: o contexto
// continua igual.
import { linkedProject } from './cli-core.mjs'

/** `area`: security | quality | tests | design | errors; `checkKey`: só os padrões daquela checagem. */
export async function patternLines(area, checkKey) {
  try {
    const { projectId, config } = linkedProject()
    const res = await fetch(`${config.apiUrl}/api/cli/patterns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ projectId, area, ...(checkKey ? { checkKey } : {}) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const { lang, patterns } = await res.json()
    if (!patterns?.length) return []
    return [
      `## Seen and fixed in other projects${lang ? ` with ${lang}` : ''} (approved by the Faundr team; look for them too)`,
      ...patterns.slice(0, 8).map((p) => `- ${p.title}: ${p.summary} Tip: ${p.tip}`),
      '',
    ]
  } catch {
    return []
  }
}
