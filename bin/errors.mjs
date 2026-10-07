// Erros no desenvolvimento (fase 0), sem IA: lê a saída dos comandos que o agente roda (build, checagem
// de tipos, testes, lint, scripts) e separa cada erro, com uma impressão digital estável (sem número de
// linha) para o mesmo erro manter o mesmo E-n entre execuções. Chaves na saída saem mascaradas.
import path from 'node:path'
import { findSecrets, mask } from './security.mjs'

const KINDS = [
  ['typecheck', /(^|[\s/])(tsc|vue-tsc|svelte-check|mypy|pyright)(\s|$)|\btype-?check\b/],
  ['lint', /(^|[\s/])(eslint|biome|ruff|stylelint|oxlint)(\s|$)|\bnpm run lint\b|\b(pnpm|yarn|bun)( run)? lint\b|prettier (--check|-c)\b/],
  ['test', /(^|[\s/])(vitest|jest|mocha|pytest|ava)(\s|$)|playwright test|\bnode --test\b|\b(npm|pnpm|yarn|bun)( run)? test\b|\bnpm t\b/],
  ['build', /\b(vite|next|nuxt|astro|remix|react-router|tsup|webpack|rollup|parcel) build\b|\b(npm|pnpm|yarn|bun) (run )?build\b|\besbuild\b|\bwrangler deploy --dry-run\b|\b(cargo|go) build\b/],
  ['run', /(^|[\s/])(node|tsx|ts-node|bun|deno|python3?|py)\s+(\S+\/)?[\w.-]+\.(m?[jt]sx?|c[jt]s|py)\b|\bnpx tsx\b/],
]

// Comando sem o que não muda o resultado: `cd pasta &&`, variáveis, redirecionamentos e o corte da saída.
export function normalizeCommand(command) {
  let c = String(command ?? '').replace(/\s+/g, ' ').trim()
  c = c.replace(/^(cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*)+/, '')
  c = c.replace(/^([A-Z_][A-Z0-9_]*=\S*\s+)+/, '')
  c = c.replace(/\s*\|\s*(head|tail)(\s+-n)?(\s+-?\d+)?\s*$/g, '')
  c = c.replace(/\s*[12]?>&[12]/g, '').replace(/\s*[12]?>\s*\/dev\/null/g, '')
  return c.trim().slice(0, 300)
}

// Programas que rodam checagens; o resto (git, grep, ls, for, echo…) não interessa.
const RUNNERS = /^(npx|pnpx|bunx|npm|pnpm|yarn|bun|deno|node|tsx|ts-node|tsc|vue-tsc|svelte-check|vite|next|nuxt|astro|vitest|jest|mocha|ava|playwright|eslint|biome|ruff|stylelint|oxlint|prettier|mypy|pyright|pytest|python3?|py|uv|poetry|cargo|go|esbuild|tsup|webpack|rollup|parcel|wrangler|remix|react-router)(\s|$)/

/** Que tipo de checagem o comando é (ou null: comando que não interessa, como git, grep, ls). */
export function classify(command) {
  const c = normalizeCommand(command)
  // Comandos do próprio Faundr repetem erros já registrados na saída: nunca contam como erro novo.
  if (!c || /\bfaundr(\.mjs)?\b/.test(c)) return null
  // Cada parte de `a && b; c | d`. Para classificar, sem o conteúdo entre aspas ("npx tsc" dentro de um
  // echo não conta); a chave do comando são só as partes que rodam checagens, então `tsc | tail -5; echo fim`
  // e `tsc` são o mesmo comando.
  const checks = []
  let kind = null
  for (const part of splitCommand(c)) {
    const bare = part
      .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (q) => (/^["'][^\s"']+\.(m?[jt]sx?|c[jt]s|py)["']$/.test(q) ? 'script.' + q.slice(1, -1).split('.').pop() : '""'))
      .replace(/^([A-Z_][A-Z0-9_]*=\S*\s+)+/, '')
    if (!RUNNERS.test(bare)) continue
    if (/\b(dev|serve|preview|watch|start)\b/.test(bare) && !/\bbuild\b/.test(bare)) continue // servidores ficam rodando
    const k = KINDS.find(([, re]) => re.test(bare))?.[0]
    if (!k) continue
    kind ??= k
    checks.push(part.replace(/^([A-Z_][A-Z0-9_]*=\S*\s+)+/, '').replace(/\s*[12]?>&[12]/g, '').trim())
  }
  return kind ? { kind, checkKey: checks.join(' && ').slice(0, 300) } : null
}

// Separa `a && b || c; d | e` fora das aspas.
function splitCommand(c) {
  const parts = []
  let cur = ''
  let quote = null
  for (let i = 0; i < c.length; i++) {
    const ch = c[i]
    if (quote) {
      if (ch === '\\' && quote === '"') cur += ch + (c[++i] ?? '')
      else {
        if (ch === quote) quote = null
        cur += ch
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if ((ch === '&' || ch === '|') && c[i + 1] === ch) {
      parts.push(cur)
      cur = ''
      i++
    } else if (ch === ';' || ch === '|') {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/**
 * A saída foi filtrada ou truncada? Então não prova que um erro sumiu. (`| head` e `| tail` só contam
 * quando o comando falhou: sem nenhum erro na saída, o comando passou.)
 */
export function isPartial(command, output) {
  return /\|\s*(grep|rg|sed|awk|head|tail|findstr|select-string|select-object)\b/i.test(String(command ?? '')) || /\[\+?\d+ (chars|characters|lines)\b|output truncated|… \[\+\d+\]/i.test(output)
}

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g
export const stripAnsi = (s) => String(s ?? '').replace(ANSI, '').replace(/\r\n?/g, '\n')

function maskSecrets(text) {
  let out = text
  try {
    for (const s of findSecrets(text)) out = out.split(s.secret).join(mask(s.secret))
  } catch {}
  // Valor depois de "senha=", "token:"… mesmo quando não tem formato de chave conhecida.
  return out.replace(
    /\b(pass(?:word|wd)?|senha|secret|token|api[_-]?key|authorization|cookie)(["']?\s*[:=]\s*["']?)(?:bearer\s+)?([^\s"',;]{6,})/gi,
    (_, name, sep, value) => `${name}${sep}${mask(value)}`,
  )
}

// O que muda de uma execução para outra sai da identidade do erro.
export function normalizeMessage(message) {
  return String(message)
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>')
    .replace(/\b[0-9a-f]{12,}\b/g, '<hex>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/(?:[a-z]:)?[\\/][\w .@-]+(?:[\\/][\w .@-]+)+/gi, (p) => `<path:${p.split(/[\\/]/).pop()}>`)
    .replace(/\b\d+(\.\d+)?\s*(ms|s|kb|mb|b)\b/g, '<n>$2')
    .replace(/\d+/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
}

function relFile(file, root, cwd = root) {
  if (!file) return null
  let f = String(file).trim().replace(/^file:\/\/\/?/, '').replace(/\\/g, '/')
  // Caminho relativo à pasta em que o comando rodou (ex.: `cd frontend && vitest` → "src/a.test.ts").
  if (!path.isAbsolute(f) && root && cwd && path.resolve(cwd) !== path.resolve(root)) f = path.resolve(cwd, f)
  const r = String(root ?? '').replace(/\\/g, '/').replace(/\/$/, '')
  if (r && f.toLowerCase().startsWith(r.toLowerCase() + '/')) f = f.slice(r.length + 1)
  else if (path.isAbsolute(f) && r) {
    const rel = path.relative(root, f).split(path.sep).join('/')
    if (!rel.startsWith('..')) f = rel
  }
  return f.replace(/^\.\//, '').slice(0, 500)
}

const isOwnFrame = (f) => f && !/node_modules|node:internal|^node:|<anonymous>|internal\/|\/deps\/|site-packages|lib\/python/.test(f)

function excerptAround(lines, index, before = 3, after = 12) {
  return lines.slice(Math.max(0, index - before), index + after).join('\n').trim().slice(0, 4000)
}

// ---- Leitores: cada um devolve { tool, code, message, file, line, index } -----------------------

function tsErrors(lines) {
  const out = []
  const re = /^\s*(.+?\.(?:[mc]?tsx?|vue|svelte|astro))(?:\((\d+),\d+\)|:(\d+):\d+)\s*(?:-\s*|:\s*)?error\s+(TS\d+):\s*(.+)$/
  lines.forEach((l, i) => {
    const m = l.match(re)
    if (m) out.push({ tool: 'tsc', code: m[4], message: m[5].trim(), file: m[1], line: Number(m[2] ?? m[3]), index: i })
  })
  return out
}

function esbuildErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:✘|X)\s*\[ERROR\]\s*(.+)$/)
    if (!m) return
    let file = null
    let line = null
    for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
      const at = lines[j].match(/^\s+(\S+?):(\d+):(\d+):?\s*$/)
      if (at) {
        file = at[1]
        line = Number(at[2])
        break
      }
    }
    out.push({ tool: 'esbuild', code: null, message: m[1].trim(), file, line, index: i })
  })
  lines.forEach((l, i) => {
    const m = l.match(/\[vite\]:?\s*(Rollup failed to resolve import "([^"]+)" from "([^"]+)")/)
    if (m) out.push({ tool: 'vite', code: 'unresolved-import', message: `Rollup failed to resolve import "${m[2]}"`, file: m[3], line: null, index: i })
    const v = l.match(/^\s*\[(vite|plugin [\w:/-]+|commonjs--resolver)\]\s+(.+)$/)
    if (v && !m && /error|failed|cannot|could not|not found|unexpected/i.test(v[2])) {
      const at = v[2].match(/(?:file:\s*)?([^\s:]+\.(?:[mc]?[jt]sx?|vue|svelte|css)):(\d+)/)
      out.push({ tool: 'vite', code: null, message: v[2].replace(/\s*file:\s*\S+$/, '').trim(), file: at?.[1] ?? null, line: at ? Number(at[2]) : null, index: i })
    }
  })
  return out
}

function eslintErrors(lines) {
  const out = []
  let file = null
  lines.forEach((l, i) => {
    if (/^(?:[a-z]:)?[\\/]?[\w.@ -]+([\\/][\w.@ -]+)*\.[a-z]{1,5}$/i.test(l.trim()) && !/^\s/.test(l)) file = l.trim()
    const m = l.match(/^\s+(\d+):(\d+)\s+error\s+(.+?)\s{2,}([@\w/-]+)\s*$/)
    if (m && file) out.push({ tool: 'eslint', code: m[4], message: m[3].trim(), file, line: Number(m[1]), index: i })
  })
  return out
}

function testErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    // vitest: " FAIL  src/a.test.ts > grupo > caso"   jest: "● grupo › caso"
    const v = l.match(/^\s*(?:×|✗|FAIL)\s+(\S+\.(?:test|spec)\.[mc]?[jt]sx?)\s+>\s+(.+)$/)
    const j = !v && l.match(/^\s*●\s+(.+›.+)$/)
    const p = l.match(/^FAILED\s+(\S+?)::(\S+)(?:\s+-\s+(.+))?$/)
    if (v || j) {
      let reason = ''
      for (let k = i + 1; k < Math.min(lines.length, i + 12); k++) {
        const r = lines[k].trim()
        if (/^(\w*Error|Error|expected|Expected|AssertionError)\b.*[:]/.test(r) || /^expect\(/.test(r)) {
          reason = r
          break
        }
      }
      const name = (v ? v[2] : j[1]).replace(/\s*\d+ms$/, '').trim()
      out.push({ tool: v ? 'vitest' : 'jest', code: null, message: `Teste falhou: ${name}${reason ? ` (${reason})` : ''}`, file: v ? v[1] : null, line: null, index: i, key: name })
    } else if (p) {
      out.push({ tool: 'pytest', code: null, message: `Teste falhou: ${p[2]}${p[3] ? ` (${p[3]})` : ''}`, file: p[1], line: null, index: i, key: p[2] })
    }
  })
  return out
}

function pythonErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    if (!/^Traceback \(most recent call last\):/.test(l)) return
    let file = null
    let line = null
    let k = i + 1
    for (; k < lines.length; k++) {
      const f = lines[k].match(/^\s+File "([^"]+)", line (\d+)/)
      if (f) {
        if (isOwnFrame(f[1])) {
          file = f[1]
          line = Number(f[2])
        }
        continue
      }
      if (/^\s/.test(lines[k])) continue
      break
    }
    const last = lines[k]?.match(/^([\w.]+(?:Error|Exception|Exit|Interrupt)\w*):?\s*(.*)$/)
    if (last) out.push({ tool: 'python', code: last[1], message: `${last[1]}: ${last[2]}`.trim(), file, line, index: k })
  })
  return out
}

function jsRuntimeErrors(lines) {
  const out = []
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:Uncaught\s+)?((?:[A-Z]\w*)?Error)(?:\s*\[[\w_]+\])?:\s+(.+)$/)
    if (!m) return
    let file = null
    let line = null
    for (let k = i + 1; k < Math.min(lines.length, i + 25); k++) {
      const at = lines[k].match(/^\s+at\s+(?:.*?\()?((?:file:\/\/\/?)?[^()\s]+?):(\d+):\d+\)?\s*$/)
      if (!at) {
        if (k > i + 1 && !/^\s+at\s/.test(lines[k])) break
        continue
      }
      if (isOwnFrame(at[1])) {
        file = at[1]
        line = Number(at[2])
        break
      }
    }
    if (!file && !lines.slice(i + 1, i + 3).some((x) => /^\s+at\s/.test(x))) return // sem pilha: provável texto comum
    out.push({ tool: 'node', code: m[1], message: `${m[1]}: ${m[2].trim()}`, file, line, index: i })
  })
  return out
}

function genericError(lines, kind) {
  const i = lines.findIndex((l) => /\b(error|erro|failed|falhou|fatal)\b/i.test(l) && l.trim().length > 6)
  const index = i >= 0 ? i : lines.findLastIndex((l) => l.trim())
  if (index < 0) return []
  return [{ tool: kind, code: null, message: lines[index].trim().slice(0, 500), file: null, line: null, index }]
}

/**
 * Separa os erros da saída de um comando.
 * @returns {{ tool, code, title, message, file, line, excerpt, fingerprint }[]}
 */
// Um comando pode misturar checagens (`npm run build` roda o tsc): o tipo do erro vem de quem o escreveu.
const TOOL_KIND = { tsc: 'typecheck', eslint: 'lint', vitest: 'test', jest: 'test', pytest: 'test', esbuild: 'build', vite: 'build' }

/** A pasta em que o comando roda: a do terminal, mais o `cd <pasta> &&` do começo, se houver. */
export function commandCwd(command, base) {
  const sub = String(command ?? '').match(/^\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s&;|]+))\s*(?:&&|;)/)
  const dir = sub ? (sub[1] ?? sub[2] ?? sub[3]) : null
  return dir ? path.resolve(base, dir) : base
}

export function parseErrors(output, { kind, root, failed = true, cwd = root } = {}) {
  const text = stripAnsi(output)
  if (/^(Command timed out|Command was interrupted)/i.test(text.trim())) return []
  const lines = text.split('\n')
  // Cada tipo de comando só usa os leitores que fazem sentido para ele: um script que imprime a saída
  // de outro comando (ex.: um log com "error TS2322") não vira erro de tipos.
  const readers = {
    typecheck: [tsErrors, pythonErrors],
    lint: [eslintErrors, tsErrors],
    test: [testErrors, tsErrors, pythonErrors],
    build: [tsErrors, esbuildErrors, eslintErrors],
    run: [pythonErrors],
  }[kind] ?? [tsErrors, eslintErrors, testErrors, pythonErrors, esbuildErrors]
  let found = readers.flatMap((read) => read(lines))
  if (!found.length && kind !== 'lint' && kind !== 'typecheck') found = jsRuntimeErrors(lines)
  // Script comum que falhou sem pilha de erro (ex.: saiu com código 1 de propósito) não vira E-n.
  if (!found.length && failed && kind !== 'run') found = genericError(lines, kind)

  const seen = new Set()
  const issues = []
  for (const e of found) {
    const file = relFile(e.file, root, cwd)
    const message = maskSecrets(e.message).slice(0, 2000)
    const identity = e.key ?? message
    const fingerprint = `${TOOL_KIND[e.tool] ?? kind}|${e.tool}|${e.code ?? ''}|${file ?? ''}|${normalizeMessage(identity)}`.slice(0, 600)
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    const firstLine = message.split('\n')[0]
    issues.push({
      kind: TOOL_KIND[e.tool] ?? kind,
      tool: e.tool,
      code: e.code ?? null,
      title: (firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine) || 'Erro sem mensagem',
      message,
      file,
      line: Number.isInteger(e.line) && e.line > 0 ? e.line : null,
      excerpt: maskSecrets(excerptAround(lines, e.index)),
      fingerprint,
    })
    if (issues.length >= 50) break
  }
  return issues
}

/** Texto que a ferramenta devolveu (Bash no Claude Code: stdout/stderr no sucesso, `error` na falha). */
export function toolOutput(payload) {
  if (payload.hook_event_name === 'PostToolUseFailure') return typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error ?? '')
  const r = payload.tool_response
  if (typeof r === 'string') return r
  if (r && typeof r === 'object') return [r.stdout, r.stderr, r.output].filter((x) => typeof x === 'string').join('\n')
  return ''
}

export const maskCommand = (command) => maskSecrets(String(command ?? '')).slice(0, 500)
