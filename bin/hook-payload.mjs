// O que o hook do diário manda para o Faundr: só os campos que o servidor lê, montados um a um (lista do que pode
// sair, não do que é tirado). Conteúdo de arquivo (o que o Write grava, o antes e o depois do Edit, a célula do
// NotebookEdit, o patch do Codex) e a saída das ferramentas (Read, Bash, Grep, WebFetch…) ficam no computador.
// O que o servidor tirava da saída (commit feito, número da tarefa criada) é calculado aqui e sai só o resultado.

import { toolEdits } from './agent.mjs'
import { maskPayload } from './security-secrets.mjs'

const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])
const TASK_STATUS = new Set(['pending', 'in_progress', 'completed', 'deleted'])

// Texto que sai: chaves mascaradas e no máximo `max` caracteres.
function text(value, max) {
  if (typeof value !== 'string' || !value) return undefined
  const masked = maskPayload(value)
  return masked.length > max ? `${masked.slice(0, max)}…` : masked
}

// Pedido e resposta podem trazer código colado: o bloco entre ``` não sai.
const withoutCode = (value) => (typeof value === 'string' ? value.replace(/```[\s\S]*?(```|$)/g, '[code]') : value)

/** Texto que a ferramenta devolveu, só para tirar o resultado aqui (nunca sai). */
function responseText(r) {
  if (typeof r === 'string') return r
  if (r && typeof r === 'object') return String(r.stdout ?? r.output ?? '')
  return ''
}

/**
 * Commit feito ("[main abc1234] mensagem" na saída). Com -q/--quiet o git não imprime nada: vale se o comando
 * terminou bem (este é o PostToolUse, não o de falha) e não disse que não havia o que commitar.
 */
export function commitDone(payload) {
  if (payload.hook_event_name !== 'PostToolUse' || !SHELL_TOOLS.has(payload.tool_name)) return false
  const command = String(payload.tool_input?.command ?? '')
  if (!/\bgit\b[^\n|;&]*\bcommit\b/.test(command)) return false
  const output = responseText(payload.tool_response)
  return (
    /^\[[^\]\s]+ [0-9a-f]{7,}\]/m.test(output) ||
    (/\bgit\b[^\n|;&]*\bcommit\b[^\n|;&]*\s(-q|--quiet)\b/.test(command) && !/nothing to commit|nada a submeter|no changes added/i.test(output))
  )
}

/** Número da tarefa que o TaskCreate criou (o TaskUpdate depois se refere a ele). */
export function createdTaskId(payload) {
  if (payload.tool_name !== 'TaskCreate') return undefined
  const r = JSON.stringify(payload.tool_response ?? '')
  const id = r.match(/"?(?:task_?[iI]d|id)"?\s*[:=]\s*"?([\w-]+)"?/)?.[1] ?? r.match(/#(\d+)/)?.[1]
  return id ? id.slice(0, 60) : undefined
}

// Só a lista de tarefas: o texto e o estado de cada uma.
function todos(list) {
  if (!Array.isArray(list)) return undefined
  return list.slice(0, 100).map((t) => ({ content: text(t?.content, 300), status: TASK_STATUS.has(t?.status) ? t.status : undefined }))
}

/** Entrada da ferramenta: caminho do arquivo, comando, nome da skill e os campos das listas de tarefas e do plano. */
function toolInput(toolName, input = {}) {
  const shell = SHELL_TOOLS.has(toolName)
  // O apply_patch do Codex traz o patch inteiro em command: daqui só sai o primeiro arquivo.
  const file = toolName === 'apply_patch' ? toolEdits(toolName, input)[0]?.file : input.file_path
  const out = {
    file_path: typeof file === 'string' ? file : undefined,
    notebook_path: typeof input.notebook_path === 'string' ? input.notebook_path : undefined,
    command: shell ? text(Array.isArray(input.command) ? input.command.join(' ') : input.command, 300) : undefined,
    description: text(input.description, toolName === 'TaskCreate' ? 2000 : 200),
    pattern: text(input.pattern, 200),
    url: text(input.url, 300),
    skill: text(input.skill, 120),
    name: toolName === 'Skill' ? text(input.name, 120) : undefined,
    // Plano aprovado: é o plano da pessoa, vira a funcionalidade no painel.
    plan: toolName === 'ExitPlanMode' ? text(input.plan, 20_000) : undefined,
    todos: toolName === 'TodoWrite' ? todos(input.todos) : undefined,
    subject: text(input.subject, 300),
    taskId: input.taskId != null ? String(input.taskId).slice(0, 60) : undefined,
    status: TASK_STATUS.has(input.status) ? input.status : undefined,
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined))
}

/** Payload do hook no formato que vai para /api/hooks/event. */
export function hookPayload(p) {
  const input = p.tool_name ? toolInput(p.tool_name, p.tool_input ?? {}) : {}
  const derived = { commit: commitDone(p) || undefined, taskId: createdTaskId(p) }
  const out = {
    session_id: p.session_id,
    hook_event_name: p.hook_event_name,
    cwd: p.cwd,
    source: typeof p.source === 'string' ? p.source.slice(0, 40) : undefined,
    reason: typeof p.reason === 'string' ? p.reason.slice(0, 40) : undefined,
    agent_id: typeof p.agent_id === 'string' ? p.agent_id.slice(0, 120) : undefined,
    agent_type: typeof p.agent_type === 'string' ? p.agent_type.slice(0, 120) : undefined,
    prompt: text(withoutCode(p.prompt), 500),
    last_assistant_message: text(withoutCode(p.last_assistant_message), 1000),
    tool_name: p.tool_name,
    tool_input: Object.keys(input).length ? input : undefined,
    derived: derived.commit || derived.taskId ? JSON.parse(JSON.stringify(derived)) : undefined,
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined))
}
