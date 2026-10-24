// Uso da sessão, lido da conversa do Claude Code (o .jsonl em transcript_path, mais os dos subagentes) ou da do
// Codex (traduzida para o mesmo formato em codex-transcript.mjs): tokens por modelo, ferramentas, quanto o Faundr pôs
// no contexto, o que o aviso do fim da resposta custou e a economia estimada do grafo. Nada do texto da conversa sai
// daqui: só números.
import fs from 'node:fs'
import path from 'node:path'
import { codexEntries, isCodexEntry } from './codex-transcript.mjs'

const EXPLORE_TOOLS = new Set(['Read', 'Grep', 'Glob'])
// Bash usado para olhar o código (o mesmo papel de Read/Grep/Glob). No Codex o terminal costuma ser o PowerShell.
const EXPLORE_BASH = /^\s*(?:cd\s+[^&;|]+(?:&&|;)\s*)?(?:grep|rg|cat|head|tail|sed\s+-n|find|ls|wc|get-content|gc|select-string|get-childitem|type)\b/i
const GRAPH_CMD = /\bfaundr(?:\.mjs)?["']?\s+graph-(?:query|path|explain|callers|skeleton|grep)\b/
// Rodapé que `faundr graph-*` imprime (graphFooter).
// Rodapé em inglês e o antigo, em português (conversas de antes da troca).
const GRAPH_FOOTER = /\[Faundr\] (?:Graph: answer|Grafo: resposta) ~(\d+) tokens; (?:files cited|arquivos citados): \d+, ~(\d+) tokens/
const FAUNDR_MARK = '[Faundr]'

// Conversa do Codex: traduz para o formato do Claude Code. `model` é o da rodada anterior ao trecho lido.
const normalize = (entries, model) => (entries.some(isCodexEntry) ? codexEntries(entries, { model }) : entries)

function readEntries(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    // Transcrição ausente ou ilegível: nada a somar.
    return []
  }
  const out = []
  for (const line of text.split('\n')) {
    if (!line) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // Linha cortada (o arquivo ainda está sendo escrito): pula só ela.
    }
  }
  return normalize(out)
}

const contentText = (c) => (typeof c === 'string' ? c : c?.text ?? '')
const textOf = (content) => {
  if (typeof content === 'string') return content
  return Array.isArray(content) ? content.map(contentText).join('') : ''
}

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

/** Avisos dos hooks do Faundr: o que entrou no contexto, o que foi mandado e os bloqueios do fim. Devolve o novo inGate. */
function countHook(a, usage, inGate) {
  if (a?.type === 'hook_additional_context') {
    // O que entrou de fato no contexto (pode ser só a prévia, quando passou do limite do Claude Code).
    for (const c of a.content ?? []) {
      const s = textOf(c)
      if (s.includes(FAUNDR_MARK)) {
        usage.injected_chars += s.length
        usage.injected_count += 1
      }
    }
  }
  if (a?.type === 'hook_success' && typeof a.stdout === 'string' && a.stdout.includes(FAUNDR_MARK)) {
    try {
      usage.injected_sent_chars += (JSON.parse(a.stdout).hookSpecificOutput?.additionalContext ?? '').length
    } catch {
      // Saída do hook sem JSON válido: não dá para medir, não conta.
    }
  }
  if (a?.type === 'hook_blocking_error' && a.hookEvent === 'Stop' && textOf(a.blockingError?.blockingError).includes(FAUNDR_MARK)) {
    usage.gate_blocks += 1
    return true
  }
  return inGate
}

/** Resposta do Claude: tokens por chamada (e os gastos depois de um bloqueio do fim) e as ferramentas pedidas. */
function countAssistant(e, usage, seen, st) {
  const id = e.message.id ?? e.uuid
  const model = e.message.model
  if (model && model !== '<synthetic>') {
    seen.set(id, { model, usage: e.message.usage })
    if (st.inGate && !st.gateSeen.has(id)) {
      st.gateSeen.add(id)
      addTokens(usage.gate_tokens, e.message.usage)
    }
  }
  for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
    if (b?.type !== 'tool_use' || st.toolSeen.has(b.id)) continue
    st.toolSeen.add(b.id)
    usage.tools[b.name] = (usage.tools[b.name] ?? 0) + 1
    const command = b.name === 'Bash' || b.name === 'PowerShell' ? String(b.input?.command ?? '') : ''
    st.toolNames.set(b.id, { name: b.name, command })
    if (GRAPH_CMD.test(command)) usage.graph_queries += 1
  }
}

/** Resultados das ferramentas: o que foi lido para explorar e o tamanho das respostas do grafo. */
function countToolResults(content, usage, toolNames) {
  for (const b of content) {
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

/** Soma o uso de uma lista de entradas da conversa. `main` = conversa principal (pedidos, hooks e aviso do fim). */
export function summarizeEntries(entries, { main = true, usage = emptyUsage(), seen = new Map() } = {}) {
  // toolNames: tool_use_id → { name, command }
  const st = { toolNames: new Map(), toolSeen: new Set(), inGate: false, gateSeen: new Set() }

  for (const e of entries) {
    if (main) st.inGate = countHook(e.attachment, usage, st.inGate)
    if (main && isPrompt(e)) {
      usage.user_prompts += 1
      st.inGate = false
    }
    if (e.type === 'assistant' && e.message?.usage) countAssistant(e, usage, seen, st)
    if (e.type === 'user' && Array.isArray(e.message?.content)) countToolResults(e.message.content, usage, st.toolNames)
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
  } catch {
    // Sessão sem subagentes: a pasta não existe.
  }
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

// Arquivos citados: "src=<arquivo>" (graph-query), "Source: <arquivo>" (ou "Fonte:") e "<arquivo>:L<linha>" (graph-callers, graph-path).
const CITED_FILE = /(?:\bsrc=|(?:Fonte|Source):\s+)([^\s\]]+)|([\w./@-]+\.\w+):L\d+/g
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
    } catch {
      // Arquivo citado sumiu ou não abre: fica fora da estimativa.
    }
  }
  if (!counted) return ''
  return `[Faundr] Graph: answer ~${tokensOf(output.length)} tokens; files cited: ${counted}, ~${tokensOf(chars)} tokens if read in full.`
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

// ---- Custo de uma skill: só o trecho da conversa depois de uma marca ------------------------------------------
// Quando uma skill começa, guarda o tamanho da conversa e de cada subagente; no fim da resposta, soma só o que veio
// depois (sem reler a conversa inteira, que passa de dezenas de MB).

const subagentDir = (transcriptPath) => path.join(path.dirname(transcriptPath), path.basename(transcriptPath, '.jsonl'), 'subagents')
const sizeOf = (file) => {
  try {
    return fs.statSync(file).size
  } catch {
    // Arquivo ainda não existe: começa do zero.
    return 0
  }
}

/** Marca: o tamanho da conversa e dos subagentes que já existem. */
export function transcriptMark(transcriptPath) {
  if (!transcriptPath) return null
  const subs = {}
  try {
    for (const f of fs.readdirSync(subagentDir(transcriptPath))) if (f.endsWith('.jsonl')) subs[f] = sizeOf(path.join(subagentDir(transcriptPath), f))
  } catch {
    // Sem subagentes ainda.
  }
  return { main: sizeOf(transcriptPath), subs }
}

function entriesFrom(file, offset) {
  let text = ''
  try {
    const fd = fs.openSync(file, 'r')
    const size = fs.fstatSync(fd).size
    const buf = Buffer.alloc(Math.max(0, size - offset))
    fs.readSync(fd, buf, 0, buf.length, offset)
    fs.closeSync(fd)
    text = buf.toString('utf8')
  } catch {
    return []
  }
  const out = []
  for (const line of text.split('\n')) {
    if (!line) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // A primeira linha pode vir cortada pela marca: pula só ela.
    }
  }
  return normalize(out, offset ? modelBefore(file, offset) : null)
}

// Codex: o modelo vem no turn_context de cada rodada, que pode ter ficado antes da marca.
function modelBefore(file, offset) {
  try {
    const fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(offset)
    fs.readSync(fd, buf, 0, offset, 0)
    fs.closeSync(fd)
    return [...buf.toString('utf8').matchAll(/"type":"turn_context".*?"model":"([^"]+)"/g)].at(-1)?.[1] ?? null
  } catch {
    // Arquivo ilegível: sem modelo conhecido.
    return null
  }
}

/** Tokens gastos depois da marca (conversa + subagentes, novos ou que cresceram), por tipo e por modelo. */
export function usageSince(transcriptPath, mark) {
  if (!transcriptPath || !mark) return null
  const { usage, seen } = summarizeEntries(entriesFrom(transcriptPath, mark.main ?? 0))
  try {
    for (const f of fs.readdirSync(subagentDir(transcriptPath)).filter((x) => x.endsWith('.jsonl')))
      summarizeEntries(entriesFrom(path.join(subagentDir(transcriptPath), f), mark.subs?.[f] ?? 0), { main: false, usage, seen })
  } catch {
    // Sem subagentes.
  }
  const t = { input: 0, output: 0, cache_creation: 0, cache_read: 0, calls: 0, models: {} }
  for (const { model, usage: u } of seen.values()) {
    t.input += u.input_tokens ?? 0
    t.output += u.output_tokens ?? 0
    t.cache_creation += u.cache_creation_input_tokens ?? 0
    t.cache_read += u.cache_read_input_tokens ?? 0
    t.calls += 1
    t.models[model] = (t.models[model] ?? 0) + 1
  }
  return t
}
