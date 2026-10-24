// Qual agente rodou o Faundr (Claude Code ou Codex) e como cada um descreve uma edição de arquivo.
// O Codex põe CODEX_SESSION_ID no terminal do agente; os hooks passam FAUNDR_AGENT aos processos de segundo plano.

export function currentAgent(env = process.env) {
  if (env.FAUNDR_AGENT === 'codex' || env.FAUNDR_AGENT === 'claude') return env.FAUNDR_AGENT
  return env.CODEX_SESSION_ID ? 'codex' : 'claude'
}

export function agentSessionId(env = process.env) {
  return (currentAgent(env) === 'codex' ? env.CODEX_SESSION_ID : env.CLAUDE_CODE_SESSION_ID) ?? null
}

// O Codex não tem o "perguntar ao usuário" nos hooks (só barrar): o Faundr barra, o agente pergunta no chat e,
// com o sim, repete o mesmo comando, que passa uma vez.
const CONFIRM_WINDOW_MS = 10 * 60_000

/**
 * Resposta do PreToolUse no Codex. `pending` é o último comando barrado à espera do sim ({ command, at }).
 * Devolve a saída a mandar (ou null para deixar passar) e o novo pendente.
 */
export function codexDecision(output, command, pending, now = Date.now()) {
  if (output.permissionDecision !== 'ask') return { output, pending }
  if (pending?.command === command && now - pending.at < CONFIRM_WINDOW_MS) return { output: null, pending: null }
  return {
    output: {
      permissionDecision: 'deny',
      permissionDecisionReason: `${output.permissionDecisionReason} Ask the user in chat before going on; only if they say yes, run exactly the same command again (Faundr lets it through once).`,
    },
    pending: { command, at: now },
  }
}

/**
 * Arquivos de um apply_patch do Codex, cada um com o texto que entra nele (as linhas com "+").
 * `kind`: add (arquivo novo), update ou delete. Um "Move to" troca o caminho final.
 */
export function patchEdits(patch) {
  if (typeof patch !== 'string') return []
  const edits = []
  let current = null
  for (const line of patch.split(/\r?\n/)) {
    const header = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/)
    if (header) {
      current = { kind: header[1].toLowerCase(), file: header[2].trim(), added: [] }
      edits.push(current)
      continue
    }
    const move = line.match(/^\*\*\* Move to: (.+)$/)
    if (move && current) current.file = move[1].trim()
    else if (current && line.startsWith('+')) current.added.push(line.slice(1))
  }
  return edits.map((e) => ({ kind: e.kind, file: e.file, content: e.added.join('\n') }))
}

/**
 * Edições de uma ferramenta no formato do Claude Code (file_path + texto novo), seja qual for o agente:
 * Edit/Write/MultiEdit/NotebookEdit vêm assim; o apply_patch do Codex vira uma por arquivo.
 */
export function toolEdits(toolName, input = {}) {
  if (toolName === 'apply_patch') {
    return patchEdits(input.command ?? input.patch ?? input.input)
      .filter((e) => e.kind !== 'delete')
      .map((e) => ({ file: e.file, content: e.content, isNew: e.kind === 'add' }))
  }
  const file = input.file_path ?? input.notebook_path
  if (!file) return []
  const content = [input.content, input.new_string, input.new_source, ...(input.edits ?? []).map((e) => e.new_string)]
    .filter((c) => typeof c === 'string')
    .join('\n')
  return [{ file, content, isNew: toolName === 'Write' }]
}
