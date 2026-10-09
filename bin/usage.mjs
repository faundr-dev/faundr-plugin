// Uso da sessão, lido da conversa do Claude Code (o .jsonl em transcript_path, mais os dos subagentes):
// tokens por modelo, ferramentas, quanto o Faundr pôs no contexto, o que o aviso do fim da resposta custou e
// a economia estimada do grafo. Nada do texto da conversa sai daqui: só números.
import fs from 'node:fs'
import path from 'node:path'

const EXPLORE_TOOLS = new Set(['Read', 'Grep', 'Glob'])
// Bash usado para olhar o código (o mesmo papel de Read/Grep/Glob).
const EXPLORE_BASH = /^\s*(?:cd\s+[^&;|]+(?:&&|;)\s*)?(?:grep|rg|cat|head|tail|sed\s+-n|find|ls|wc)\b/
const GRAPH_CMD = /\bfaundr(?:\.mjs)?["']?\s+graph-(?:query|path|explain|callers|skeleton|grep)\b/
// Rodapé que `faundr graph-*` imprime (graphFooter).
const GRAPH_FOOTER = /\[Faundr\] Grafo: resposta ~(\d+) tokens; arquivos citados: \d+, ~(\d+) tokens/
const FAUNDR_MARK = '[Faundr]'

function readEntries(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const out = []
  for (const line of text.split('\n')) {
    if (!line) continue
    try {
      out.push(JSON.parse(line))
    } catch {}
  }
  return out
}

const textOf = (content) =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join('') : ''

// Pedido de verdade do usuário (não resultado de ferramenta, não mensagem interna do Claude Code).
function isPrompt(e) {
  if (e.type !== 'user' || e.isMeta || e.isCompactSummary || e.isSidechain) return false
  const c = e.message?.content
  if (typeof c === 'string') return !c.startsWith('<local-command-')
  return Array.isArray(c) && c.some((b) => b?.type === 'text') && !c.some((b) => b?.type === 'tool_result')
}

const emptyTokens = () => ({ input: 0, output: 0, cache_creation: 0, cache_read: 0, calls: 0 })
function addTokens(t, usage) {
  t.input += usage.input_tokens ?? 0
  t.output += usage.output_tokens ?? 0
  t.cache_creation += usage.cache_creation_input_tokens ?? 0
  t.cache_read += usage.cache_read_input_tokens ?? 0
  t.calls += 1
}

export function emptyUsage() {
  return {
    models: {},
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    api_calls: 0,
    user_prompts: 0,
    subagents: 0,
    tools: {},
    explore_chars: 0,
    injected_chars: 0,
    injected_sent_chars: 0,
    injected_count: 0,
    gate_blocks: 0,
    gate_tokens: emptyTokens(),
    graph_queries: 0,
    graph_answer_tokens: 0,
    graph_files_tokens: 0,
  }
}

/** Soma o uso de uma lista de entradas da conversa. `main` = conversa principal (pedidos, hooks e aviso do fim). */
export function summarizeEntries(entries, { main = true, usage = emptyUsage(), seen = new Map() } = {}) {
  const toolNames = new Map() // tool_use_id → { name, command }
  const toolSeen = new Set()
  let inGate = false
  const gateSeen = new Set()

  for (const e of entries) {
    const a = e.attachment
    if (main && a?.type === 'hook_additional_context') {
      // O que entrou de fato no contexto (pode ser só a prévia, quando passou do limite do Claude Code).
      for (const c of a.content ?? []) {
        const s = textOf(c)
        if (s.includes(FAUNDR_MARK)) {
          usage.injected_chars += s.length
          usage.injected_count += 1
        }
      }
    }
    if (main && a?.type === 'hook_success' && typeof a.stdout === 'string' && a.stdout.includes(FAUNDR_MARK)) {
      try {
        usage.injected_sent_chars += (JSON.parse(a.stdout).hookSpecificOutput?.additionalContext ?? '').length
      } catch {}
    }
    if (main && a?.type === 'hook_blocking_error' && a.hookEvent === 'Stop' && textOf(a.blockingError?.blockingError).includes(FAUNDR_MARK)) {
      usage.gate_blocks += 1
      inGate = true
    }
    if (main && isPrompt(e)) {
      usage.user_prompts += 1
      inGate = false
    }

    if (e.type === 'assistant' && e.message?.usage) {
      const id = e.message.id ?? e.uuid
      const model = e.message.model
      if (model && model !== '<synthetic>') {
        seen.set(id, { model, usage: e.message.usage })
        if (inGate && !gateSeen.has(id)) {
          gateSeen.add(id)
          addTokens(usage.gate_tokens, e.message.usage)
        }
      }
      for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
        if (b?.type !== 'tool_use' || toolSeen.has(b.id)) continue
        toolSeen.add(b.id)
        usage.tools[b.name] = (usage.tools[b.name] ?? 0) + 1
        const command = b.name === 'Bash' || b.name === 'PowerShell' ? String(b.input?.command ?? '') : ''
        toolNames.set(b.id, { name: b.name, command })
        if (GRAPH_CMD.test(command)) usage.graph_queries += 1
      }
    }

    if (e.type === 'user' && Array.isArray(e.message?.content)) {
      for (const b of e.message.content) {
        if (b?.type !== 'tool_result') continue
        const tool = toolNames.get(b.tool_use_id)
        if (!tool) continue
        const out = textOf(b.content)
        if (EXPLORE_TOOLS.has(tool.name) || (tool.command && EXPLORE_BASH.test(tool.command) && !GRAPH_CMD.test(tool.command)))
          usage.explore_chars += out.length
        const m = GRAPH_CMD.test(tool.command) && out.match(GRAPH_FOOTER)
        if (m) {
          usage.graph_answer_tokens += Number(m[1])
          usage.graph_files_tokens += Number(m[2])
        }
      }
    }
  }
  return { usage, seen }
}

/** Uso da sessão inteira: a conversa e os subagentes (pasta <sessão>/subagents/), sem contar duas vezes a mesma resposta. */
export function transcriptUsage(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null
  const { usage, seen } = summarizeEntries(readEntries(transcriptPath))
  const subDir = path.join(path.dirname(transcriptPath), path.basename(transcriptPath, '.jsonl'), 'subagents')
  let subFiles = []
  try {
    subFiles = fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl'))
  } catch {}
  for (const f of subFiles) summarizeEntries(readEntries(path.join(subDir, f)), { main: false, usage, seen })
  usage.subagents = subFiles.length

  // Cada resposta aparece em várias linhas (uma por bloco); vale a última de cada id.
  for (const { model, usage: u } of seen.values()) {
    const t = (usage.models[model] ??= emptyTokens())
    addTokens(t, u)
    usage.input_tokens += u.input_tokens ?? 0
    usage.output_tokens += u.output_tokens ?? 0
    usage.cache_creation_tokens += u.cache_creation_input_tokens ?? 0
    usage.cache_read_tokens += u.cache_read_input_tokens ?? 0
    usage.api_calls += 1
  }
  return usage
}

// Arquivos citados: "src=<arquivo>" (graph-query), "Fonte: <arquivo>" e "<arquivo>:L<linha>" (graph-callers, graph-path).
const CITED_FILE = /(?:\bsrc=|Fonte:\s+)([^\s\]]+)|([\w./@-]+\.\w+):L\d+/g
// O Read do Claude Code lê até 2000 linhas por vez: um arquivo maior não custaria o arquivo inteiro.
const READ_LINES = 2000
const tokensOf = (chars) => Math.round(chars / 4)

/** Rodapé das consultas ao grafo: o tamanho da resposta e o dos arquivos que ela cita (o teto da economia). */
export function graphFooter(output, root) {
  const files = new Set()
  for (const m of output.matchAll(CITED_FILE)) files.add(m[1] ?? m[2])
  let chars = 0
  let counted = 0
  for (const f of files) {
    try {
      const text = fs.readFileSync(path.join(root, f), 'utf8')
      chars += text.split('\n').slice(0, READ_LINES).join('\n').length
      counted += 1
    } catch {}
  }
  if (!counted) return ''
  return `[Faundr] Grafo: resposta ~${tokensOf(output.length)} tokens; arquivos citados: ${counted}, ~${tokensOf(chars)} tokens se lidos inteiros.`
}

// O último fim de resposta e o fim da sessão costumam se perder (o Claude Code fecha antes do envio terminar):
// o plugin lembra a conversa de cada sessão e, na sessão seguinte, relê e reenvia o uso das anteriores.
const MAX_PENDING = 20

/** Lembra a conversa da sessão (as mais recentes primeiro, no máximo 20). */
export function rememberTranscript(pending, sid, transcriptPath, now = Date.now()) {
  const next = { ...(pending ?? {}) }
  if (sid && transcriptPath) next[sid] = { path: transcriptPath, at: now }
  return Object.fromEntries(
    Object.entries(next)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_PENDING),
  )
}

/** Sessões cujo uso deve ser reenviado: todas as lembradas, menos a atual. */
export function transcriptsToSync(pending, currentSid) {
  return Object.entries(pending ?? {})
    .filter(([sid]) => sid !== currentSid)
    .map(([sid, v]) => ({ sid, path: v.path }))
}
