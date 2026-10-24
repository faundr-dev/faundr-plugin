// Conversa do Codex (o rollout .jsonl em transcript_path) traduzida para o formato da do Claude Code, para a mesma
// soma de usage.mjs medir as duas: tokens por resposta, ferramentas, o que os hooks do Faundr puseram no contexto e o
// aviso do fim da resposta. Só números e nomes de ferramenta seguem adiante; o texto fica no computador.

import fs from 'node:fs'

const FAUNDR_MARK = '[Faundr]'
// No modo de código do Codex, cada chamada "exec" é um trecho de JavaScript que chama as ferramentas de verdade.
const INNER_TOOL = /\btools\.(\w+)\(/g
const INNER_CMD = /\bcmd\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
// O terminal do Codex conta como o Bash do Claude Code (o guarda e a medição tratam os dois igual).
const TOOL_NAME = { exec_command: 'Bash', shell: 'Bash', shell_command: 'Bash', local_shell: 'Bash' }

export const isCodexEntry = (e) => ['session_meta', 'turn_context', 'response_item', 'event_msg', 'token_usage_record'].includes(e?.type)

const textOfParts = (parts) =>
  typeof parts === 'string' ? parts : Array.isArray(parts) ? parts.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('') : ''

function unquote(literal) {
  if (literal.startsWith('"')) {
    try {
      return JSON.parse(literal)
    } catch {
      // Texto com escape que o JSON não aceita: usa como está.
    }
  }
  return literal.slice(1, -1)
}

/** Ferramentas de uma chamada: as de dentro do "exec" (modo de código) ou a própria function_call. */
function callTools(p) {
  if (p.type === 'custom_tool_call' && p.name === 'exec') {
    const code = String(p.input ?? '')
    const names = [...code.matchAll(INNER_TOOL)].map((m) => TOOL_NAME[m[1]] ?? m[1])
    const commands = [...code.matchAll(INNER_CMD)].map((m) => unquote(m[1]))
    return { names: names.length ? names : ['exec'], command: commands.join('\n') }
  }
  let args = {}
  try {
    args = typeof p.arguments === 'string' ? JSON.parse(p.arguments) : p.arguments ?? {}
  } catch {
    // Argumentos ilegíveis: conta a ferramenta sem o comando.
  }
  const command = Array.isArray(args.command) ? args.command.join(' ') : args.cmd ?? args.command ?? (typeof p.input === 'string' ? p.input : '')
  return { names: [TOOL_NAME[p.name] ?? p.name], command: String(command ?? '') }
}

/** Linhas do rollout do Codex → entradas no formato da conversa do Claude Code. `model`: o da rodada anterior. */
export function codexEntries(lines, { model = null } = {}) {
  const out = []
  for (const e of lines) {
    const p = e.payload ?? {}
    if (e.type === 'turn_context' && p.model) model = p.model
    else if (e.type === 'token_usage_record' && p.usage) {
      const u = p.usage
      const cached = u.cached_input_tokens ?? 0
      out.push({
        type: 'assistant',
        message: {
          id: p.response_id ?? `${p.turn_id}:${out.length}`,
          model: model ?? 'codex',
          content: [],
          // No Codex a entrada já inclui o que veio do cache; no Claude Code são separados.
          usage: {
            input_tokens: Math.max(0, (u.input_tokens ?? 0) - cached),
            cache_read_input_tokens: cached,
            cache_creation_input_tokens: u.cache_write_input_tokens ?? 0,
            output_tokens: u.output_tokens ?? 0,
          },
        },
      })
    } else if (e.type === 'response_item' && (p.type === 'custom_tool_call' || p.type === 'function_call')) {
      const { names, command } = callTools(p)
      const content = names.map((name, i) => ({ type: 'tool_use', id: i ? `${p.call_id}#${i}` : p.call_id, name, input: { command: i ? '' : command } }))
      out.push({ type: 'assistant', message: { id: `tools:${p.call_id}`, content, usage: {} } })
    } else if (e.type === 'response_item' && (p.type === 'custom_tool_call_output' || p.type === 'function_call_output')) {
      const text = typeof p.output === 'string' ? p.output : textOfParts(p.output?.content ?? p.output)
      out.push({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: p.call_id, content: text }] } })
    } else if (e.type === 'response_item' && p.type === 'message' && p.role === 'developer') {
      const text = textOfParts(p.content)
      if (!text.includes(FAUNDR_MARK)) continue
      out.push({ attachment: { type: 'hook_additional_context', content: [text] } })
      // O Codex não guarda a saída do hook à parte: o que entrou no contexto é o que foi mandado.
      out.push({ attachment: { type: 'hook_success', stdout: JSON.stringify({ hookSpecificOutput: { additionalContext: text } }) } })
    } else if (e.type === 'event_msg' && p.type === 'item_completed' && p.item?.type === 'UserMessage') {
      out.push({ type: 'user', message: { content: [{ type: 'text', text: textOfParts(p.item.content) }] } })
    } else if (e.type === 'event_msg' && p.type === 'item_completed' && p.item?.type === 'HookPrompt') {
      // O Stop barrado vira um novo pedido com o motivo: é o aviso do fim da resposta.
      const text = textOfParts(p.item.fragments)
      if (text.includes(FAUNDR_MARK)) out.push({ attachment: { type: 'hook_blocking_error', hookEvent: 'Stop', blockingError: { blockingError: text } } })
    }
  }
  return out
}

/**
 * Medidores do fim da conversa do Codex, no formato dos que a barra do Faundr guarda no Claude Code (metersSnapshot):
 * contexto ocupado e % do plano na janela de 5 h e na semana (rate_limits do último token_count).
 */
export function codexMeters(lines, { sessionId = null, now = Date.now() } = {}) {
  let model = null
  for (const e of lines) if (e?.type === 'turn_context' && e.payload?.model) model = e.payload.model
  for (let i = lines.length - 1; i >= 0; i--) {
    const p = lines[i]?.payload
    if (p?.type !== 'token_count') continue
    const r = p.rate_limits ?? {}
    const win = (w) => (typeof w?.used_percent === 'number' ? { pct: w.used_percent, resets_at: w.resets_at ?? null } : null)
    const size = p.info?.model_context_window ?? null
    const used = p.info?.last_token_usage?.input_tokens ?? null
    const out = {
      session_id: sessionId,
      context_pct: size && used !== null ? Math.round((used / size) * 1000) / 10 : null,
      context_size: size,
      five_hour: win(r.primary),
      seven_day: win(r.secondary),
      model,
      at: now,
    }
    return out.context_pct === null && !out.five_hour && !out.seven_day ? null : out
  }
  return null
}

/** Medidores lidos direto do arquivo da conversa do Codex (null se não der para ler). */
export function rolloutMeters(file, sessionId) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
  const lines = []
  for (const line of text.split('\n')) {
    if (!line.includes('"turn_context"') && !line.includes('"token_count"')) continue
    try {
      lines.push(JSON.parse(line))
    } catch {
      // Linha cortada (o arquivo ainda está sendo escrito): pula só ela.
    }
  }
  return codexMeters(lines, { sessionId })
}

/** O arquivo é uma conversa do Codex (rollout-*.jsonl em ~/.codex/sessions)? */
export const isCodexRollout = (file) => /(^|[\\/])rollout-[^\\/]*\.jsonl$/.test(String(file ?? ''))

/**
 * Código de saída de um comando do Codex: o hook não recebe, mas a conversa já tem o item CommandExecution com o
 * mesmo id (tool_use_id) quando o PostToolUse roda. Lê só o fim do arquivo. Null quando não acha.
 */
export function codexExitCode(file, toolUseId, tailBytes = 512 * 1024) {
  if (!file || !toolUseId) return null
  let text = ''
  try {
    const fd = fs.openSync(file, 'r')
    const size = fs.fstatSync(fd).size
    const start = Math.max(0, size - tailBytes)
    const buf = Buffer.alloc(size - start)
    fs.readSync(fd, buf, 0, buf.length, start)
    fs.closeSync(fd)
    text = buf.toString('utf8')
  } catch {
    return null
  }
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes(toolUseId) || !lines[i].includes('"exit_code"')) continue
    try {
      const code = JSON.parse(lines[i]).payload?.item?.exit_code
      return typeof code === 'number' ? code : null
    } catch {
      // Linha cortada no começo do trecho lido: segue procurando.
    }
  }
  return null
}

/** O mesmo, esperando um pouco: às vezes o hook roda antes de o Codex gravar o item do comando na conversa. */
export async function codexExitCodeWait(file, toolUseId, { timeoutMs = 2000, everyMs = 150 } = {}) {
  const until = Date.now() + timeoutMs
  for (;;) {
    const code = codexExitCode(file, toolUseId)
    if (code !== null || Date.now() >= until) return code
    await new Promise((resolve) => setTimeout(resolve, everyMs))
  }
}
