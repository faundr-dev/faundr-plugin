// Regras de bin/bug-rules.mjs: cada uma com o trecho real de antes da correção (commit ebe1cf4, tem que achar) e o
// de depois (commits 582951d e 183ef79, não pode achar). Varredura de 10/11/2026.
// Rodar: node --test plugin/test
// faundr-ignore-file falha/caminho-do-modulo: os trechos de antes trazem o defeito de propósito
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setLang } from '../bin/i18n.mjs'
import { BUG_RULES, bugFindings } from '../bin/bug-rules.mjs'
import { RULES, runQuality } from '../bin/quality-rules.mjs'
import { TEXT } from '../bin/quality-texts.mjs'

setLang('pt')

const rules = (file, code) => bugFindings(file, code).map((h) => h.rule)

// [regra, arquivo, antes (acha), depois (não acha)]
const CASES = [
  [
    'falha/limite-acima-de-1000',
    'src/server/session-log.ts',
    `import type { SupabaseClient } from '@supabase/supabase-js'
    const { data: events } = await db
      .from('events')
      .select(DIGEST_EVENT_FIELDS)
      .eq('session_id', session.id)
      .order('created_at')
      .limit(2000)`,
    `import type { SupabaseClient } from '@supabase/supabase-js'
    const { data: events } = await db
      .from('events')
      .select(DIGEST_EVENT_FIELDS)
      .eq('session_id', session.id)
      // As 1000 mais recentes (o teto de linhas do Supabase), viradas para a ordem do tempo.
      .order('created_at', { ascending: false })
      .limit(1000)`,
  ],
  [
    'falha/lista-cortada-em-1000',
    'src/server/quality.ts',
    `import type { SupabaseClient } from '@supabase/supabase-js'
  const { data: existing, error: readError } = await db
    .from('quality_findings')
    .select('id, fingerprint, status, rule_id, file, ignore_until')
    .eq('project_id', projectId)
    .eq('origin', 'scan')
  if (readError) throw dbError(readError)`,
    `import type { SupabaseClient } from '@supabase/supabase-js'
  const { data: existing, error: readError } = await allRows((from, to) =>
    db
      .from('quality_findings')
      .select('id, fingerprint, status, rule_id, file, ignore_until')
      .eq('project_id', projectId)
      .eq('origin', 'scan')
      .order('id')
      .range(from, to),
  )
  if (readError) throw dbError(readError)`,
  ],
  [
    'falha/json-gravado-por-cima',
    'plugin/bin/cli-core.mjs',
    `export function writeState(root, patch) {
  fs.mkdirSync(path.join(root, '.faundr'), { recursive: true })
  fs.writeFileSync(stateFile(root), JSON.stringify({ ...readState(root), ...patch }, null, 2))
}`,
    `export function writeState(root, patch) {
  writeJsonAtomic(stateFile(root), { ...readJsonObject(stateFile(root)), ...patch }, 2)
}`,
  ],
  [
    'falha/caminho-do-modulo',
    'engine/src/parser.ts',
    `  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1'))`,
    `  const here = path.dirname(fileURLToPath(import.meta.url))`,
  ],
  [
    'falha/rede-sem-prazo',
    'src/server/star-history.ts',
    `async function github(path: string) {
  const token = githubToken()
  const res = await fetch(\`https://api.github.com\${path}\`, {
    headers: {
      accept: 'application/vnd.github+json',
      ...(token ? { authorization: \`Bearer \${token}\` } : {}),
    },
  })
}`,
    `async function github(path: string) {
  const token = githubToken()
  const res = await fetch(\`https://api.github.com\${path}\`, {
    headers: {
      accept: 'application/vnd.github+json',
      ...(token ? { authorization: \`Bearer \${token}\` } : {}),
    },
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  })
}`,
  ],
  [
    'falha/promessa-solta',
    'plugin/sdk/faundr-errors.mjs',
    `const proc = typeof process !== 'undefined' && process.versions ? process : null
export async function capture(error, extra = {}) {
  if (!options?.enabled) return
  const event = { event_id: crypto.randomUUID().replace(/-/g, '') }
  try {
    await fetch(options.ingest, { method: 'POST', body: JSON.stringify(event) })
  } catch {
    // Sem rede ou Faundr fora do ar: o erro do app não pode virar outro erro.
  }
}

export const errorHandler = () => (error, req, _res, next) => {
  capture(error, { request: req, mechanism: 'express', handled: false })
  next(error)
}`,
    `const proc = typeof process !== 'undefined' && process.versions ? process : null
export async function capture(error, extra = {}) {
  try {
    if (!options?.enabled) return
    const event = { event_id: eventId() }
    await fetch(options.ingest, { method: 'POST', body: JSON.stringify(event) })
  } catch {
    // Sem rede ou Faundr fora do ar: o erro do app não pode virar outro erro.
  }
}

export const errorHandler = () => (error, req, _res, next) => {
  capture(error, { request: req, mechanism: 'express', handled: false })
  next(error)
}`,
  ],
  [
    'falha/erro-vira-lista-vazia',
    'src/components/errors/ErrorsPanel.tsx',
    `import { supabase } from '#/lib/supabase'
export function useErrors(projectId: string): ErrorsData {
  const [issues, setIssues] = useState<ErrorIssue[] | undefined>(undefined)
  useEffect(() => {
    const load = () =>
      supabase
        .from('error_issues')
        .select('id, ref, kind, title')
        .eq('project_id', projectId)
        .order('ref')
        .then(({ data }) => setIssues((data ?? []) as ErrorIssue[]))
    load()
  }, [projectId])
  return { issues }
}`,
    `import { supabase } from '#/lib/supabase'
export function useErrors(projectId: string): ErrorsData {
  const { data, failed, retry } = useLiveQuery(\`errors-\${projectId}\`, ['error_issues'], \`project_id=eq.\${projectId}\`, () =>
    supabase
      .from('error_issues')
      .select('id, ref, kind, title')
      .eq('project_id', projectId)
      .order('ref')
      .then(({ data, error }) => ({ data: (data ?? []) as ErrorIssue[], error })),
  )
  return { issues: data, failed, retry }
}`,
  ],
  [
    'desempenho/realtime-sem-espera',
    'src/components/errors/ErrorsPanel.tsx',
    `import { supabase } from '#/lib/supabase'
    const load = () =>
      supabase
        .from('error_issues')
        .select('id, ref, kind, title')
        .eq('project_id', projectId)
        .order('ref')
        .then(({ data }) => setIssues((data ?? []) as ErrorIssue[]))
    load()
    const channel = supabase
      .channel(\`errors-\${projectId}-\${crypto.randomUUID()}\`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'error_issues', filter: \`project_id=eq.\${projectId}\` }, load)
      .subscribe()`,
    `import { supabase } from '#/lib/supabase'
    const load = () =>
      supabase
        .from('error_issues')
        .select('id, ref, kind, title')
        .eq('project_id', projectId)
        .order('ref')
        .then(({ data }) => setIssues((data ?? []) as ErrorIssue[]))
    load()
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(load, DEBOUNCE_MS)
    }
    const channel = supabase
      .channel(\`errors-\${projectId}-\${crypto.randomUUID()}\`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'error_issues', filter: \`project_id=eq.\${projectId}\` }, later)
      .subscribe()`,
  ],
  [
    'falha/tamanho-sem-conferir',
    'src/lib/error-event.ts',
    `  while (pos < body.length) {
    const headerLine = readLine()
    if (!headerLine.trim()) continue
    const item = obj(JSON.parse(headerLine))
    const type = str(item.type)
    types.push(type)
    let payload: string
    if (typeof item.length === 'number') {
      payload = decoder.decode(body.subarray(pos, pos + item.length))
      pos += item.length
      if (body[pos] === 10) pos++
    } else payload = readLine()
  }`,
    `  while (pos < body.length) {
    const headerLine = readLine()
    if (!headerLine.trim()) continue
    const item = obj(JSON.parse(headerLine))
    const type = str(item.type)
    types.push(type)
    let payload: string
    if (typeof item.length === 'number') {
      const len = item.length
      if (!Number.isInteger(len) || len < 0 || pos + len > body.length) throw new Error('Tamanho de item inválido')
      payload = decoder.decode(body.subarray(pos, pos + len))
      pos += len
      if (body[pos] === 10) pos++
    } else payload = readLine()
  }`,
  ],
  [
    'desempenho/regex-de-email-lenta',
    'src/lib/error-event.ts',
    `    .replace(/\\b\\d(?:[ -]?\\d){12,18}\\b/g, (m) => (luhn(m.replace(/\\D/g, '')) ? '[cartão]' : m))
    .replace(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g, '[e-mail]')`,
    `const EMAIL = /(?<![\\w.+-])[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g
    .replace(/(^|[^\\w.+-])[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g, '$1[e-mail]')`,
  ],
  [
    'falha/randomuuid-sem-alternativa',
    'public/sdk/v1.js',
    `      const event = {
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: Date.now() / 1000,
      }`,
    `  // id do evento sem crypto.randomUUID (só existe em https e no Safari 15.4+).
  const eventId = () => {
    const c = globalThis.crypto
    if (c?.randomUUID) return c.randomUUID().replace(/-/g, '')
    return Math.random().toString(16).slice(2)
  }`,
  ],
]

for (const [rule, file, before, after] of CASES)
  test(`${rule}: acha no código de antes e não no corrigido`, () => {
    assert.ok(rules(file, before).includes(rule), `deveria achar em ${file} (antes)`)
    assert.ok(!rules(file, after).includes(rule), `não deveria achar em ${file} (depois)`)
  })

test('toda regra tem gravidade, grupo e os quatro textos', () => {
  for (const rule of Object.keys(BUG_RULES)) {
    assert.ok(RULES[rule], `${rule} sem entrada em RULES`)
    const texts = TEXT[rule]({}, 2, [{ line: 1, table: 't', limit: 2000, name: 'f', field: 'item.length' }])
    assert.equal(texts.length, 4, rule)
    for (const s of texts) assert.ok(typeof s === 'string' && s.length > 10, `${rule}: texto vazio`)
  }
})

test('escopo: cada regra só onde o defeito acontece', () => {
  // .limit acima de 1000 em outra biblioteca (sem Supabase no arquivo) não conta.
  assert.deepEqual(rules('src/a.ts', "const r = await knex.from('t').select('*').limit(5000)"), [])
  // .in(coluna, lista): o tamanho vem de quem chama.
  assert.deepEqual(rules('src/server/a.ts', "import { supabase } from './supabase'\nconst { data: existing } = await db.from('t').select('k').in('k', keys)"), [])
  // fetch numa tela e num script rodado à mão não contam; a definição do handler fetch(request) { } também não.
  assert.deepEqual(rules('src/components/A.tsx', "await fetch('/api/x')"), [])
  assert.deepEqual(rules('scripts/sync.mjs', "await fetch('https://x')"), [])
  assert.deepEqual(rules('src/server.ts', 'export default {\n  fetch(request: Request) {\n    return handle(request)\n  },\n}'), [])
  // Promessa solta no navegador (sem process/node:) só vai para o console; dentro de função async é outro caso.
  assert.deepEqual(rules('extension/popup.js', 'async function render() { await x() }\nrender()'), [])
  assert.deepEqual(rules('src/server/a.ts', "import fs from 'node:fs'\nasync function save() { await x() }\nasync function main() {\n  save()\n}"), [])
  assert.deepEqual(rules('src/server/a.ts', "import fs from 'node:fs'\nasync function save() { await x() }\nfunction main() {\n  if (a) {\n    save()\n  }\n}"), ['falha/promessa-solta'])
  // Lista vazia de leitura de uma linha só (.maybeSingle) é "não configurado", outro caso.
  assert.deepEqual(rules('src/components/A.tsx', "import { supabase } from '#/lib/supabase'\nsupabase.from('t').select('a').eq('id', id).maybeSingle().then(({ data }) => setRow(data ?? []))"), [])
  // Realtime de tabela lida como uma linha só (configuração) não vem em rajada.
  assert.deepEqual(rules('src/components/A.tsx', "import { supabase } from '#/lib/supabase'\nconst load = () => supabase.from('cfg').select('a').eq('project_id', p).maybeSingle().then(({ data }) => setCfg(data))\nch.on('postgres_changes', { event: '*', schema: 'public', table: 'cfg' }, load)"), [])
  // randomUUID no próprio app (https) é normal; só em SDK, pacote publicado e script servido.
  assert.deepEqual(rules('src/components/A.tsx', 'const id = crypto.randomUUID()'), [])
  // pos += line.length com texto do próprio código não é entrada.
  assert.deepEqual(rules('src/lib/a.ts', 'for (const line of lines) {\n  pos += line.length\n}'), [])
  // Exemplo em comentário não é código.
  assert.deepEqual(rules('src/server/a.ts', "// antes: const here = new URL(import.meta.url).pathname\n * const item = JSON.parse(l); pos += item.length"), [])
  // Gravação JSON atômica (temporário + rename) não conta.
  assert.deepEqual(rules('bin/a.mjs', "fs.writeFileSync(tmp, JSON.stringify({ ...readState(root), ...patch }))\nfs.renameSync(tmp, file)"), [])
})

test('runQuality: achado com texto em português, faundr-ignore respeitado e teste só com caminho do módulo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-bugs-'))
  try {
    fs.mkdirSync(path.join(dir, 'src', 'server'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'test'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'src', 'server', 'a.ts'), "import { supabase } from './db'\nexport const a = () => supabase.from('t').select('a').eq('x', 1).limit(5000)\n")
    fs.writeFileSync(
      path.join(dir, 'src', 'server', 'b.ts'),
      "import { supabase } from './db'\n// faundr-ignore falha/limite-acima-de-1000: a view devolve 5000 (max_rows aumentado)\nexport const b = () => supabase.from('t').select('a').eq('x', 1).limit(5000)\n",
    )
    fs.writeFileSync(path.join(dir, 'test', 'c.test.mjs'), "const here = new URL(import.meta.url).pathname\nfetch('https://x')\n")
    const { findings } = await runQuality(dir, { history: false, tools: false })
    const limit = findings.filter((f) => f.rule_id === 'falha/limite-acima-de-1000')
    assert.deepEqual(limit.map((f) => f.file), ['src/server/a.ts'])
    assert.match(limit[0].title, /mais de 1000 linhas/)
    assert.equal(limit[0].severity, 'medium')
    assert.deepEqual(findings.filter((f) => f.file === 'test/c.test.mjs').map((f) => f.rule_id), ['falha/caminho-do-modulo'])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
