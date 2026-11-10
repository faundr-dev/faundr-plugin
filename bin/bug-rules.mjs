// Defeitos que passam no teste e na checagem de tipos e só aparecem com dados de verdade, vários processos ao mesmo
// tempo ou uma pasta com acento: lista cortada em 1000 linhas pelo Supabase, estado JSON gravado por cima por dois
// hooks, caminho do módulo com %20, chamada à rede sem prazo, promessa solta que derruba o Node, tela que mostra
// "nada aqui" quando a busca falhou, Realtime que refaz a busca a cada linha, laço de leitura que anda pelo tamanho
// que veio da entrada, regex de e-mail quadrática e crypto.randomUUID em código que roda na página dos outros.
// Saíram da varredura de 10/11/2026 (docs/research/reports/varredura-codigo-2026-11-10.md): cada regra pega uma
// falha que estava no código. Leitura por texto (sem a árvore de sintaxe), por arquivo; cada função devolve
// [{ line, ...ctx }].

const lineAt = (text, index) => text.slice(0, index).split('\n').length

// Telas (onde o erro de carga vira lista vazia e o Realtime recarrega) e código que roda no servidor, em cron ou em hook.
const UI_FILE = /\.(tsx|jsx|vue|svelte|astro)$|(^|\/)(components|hooks|pages|views|screens)\//
const BACKEND_PATH = /(^|\/)(server|api|functions|workers?|cron|jobs|hooks?|bin|scripts|lambda|edge-functions)(\/|$)|(^|\/)server\.[cm]?[jt]s$/
// Código que roda na página ou no programa de outra pessoa: SDK, pacote publicado, script servido pelo site.
const THIRD_PARTY_RUNTIME = /(^|\/)(sdk|packages\/[^/]+\/(src|lib)?)\/|(^|\/)public\/.*\.[cm]?js$/

/** Comando até a primeira linha em branco ou o primeiro ";" (no máximo `max` caracteres). */
function statementAt(text, index, max = 700) {
  const rest = text.slice(index, index + max)
  const end = rest.search(/;|\n\s*\n/)
  return end === -1 ? rest : rest.slice(0, end)
}

/** Corpo entre a chave que abre em `open` e a que fecha (no máximo `max` caracteres). */
function blockFrom(text, open, max = 4000) {
  let depth = 0
  for (let i = open; i < Math.min(text.length, open + max); i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1)
  }
  return text.slice(open, open + max)
}

const usesSupabase = (text) => /supabase|postgrest/i.test(text)

// ---- Supabase: .limit acima de 1000 ------------------------------------------------------------------------

// O PostgREST do Supabase devolve no máximo 1000 linhas (max_rows): .limit(2000) traz 1000, sem erro nem aviso.
export function supabaseLimitOver1000(rel, text) {
  if (!usesSupabase(text)) return []
  const out = []
  for (const m of text.matchAll(/\.limit\(\s*(\d[\d_]*)\s*\)/g)) {
    const n = Number(m[1].replace(/_/g, ''))
    if (n <= 1000) continue
    const before = text.slice(Math.max(0, m.index - 700), m.index)
    const from = before.lastIndexOf('.from(')
    if (from === -1) continue
    const chain = before.slice(from)
    if (/\n\s*\n/.test(chain) || !/\.select\(/.test(chain) || /\.range\(/.test(chain)) continue
    out.push({ line: lineAt(text, m.index), limit: n })
  }
  return out
}

// ---- Supabase: lista lida sem paginar e usada como completa (Map/Set do que já existe) -------------------------

const SUPA_READ = /const\s*\{\s*data\s*(?::\s*(\w+))?[^}]*\}\s*=\s*await\s+/g
const LOOKUP_NAME = /^(existing\w*|known\w*|current\w*|all[A-Z]\w*|already\w*)$/
// Com .in(coluna, lista) o tamanho vem de quem chama: fica de fora.
const PAGED = /\.(range|limit|single|maybeSingle|csv)\s*\(|head\s*:\s*true|\.eq\(\s*['"`](id|uuid)['"`]|\.in\(/

// Ler "tudo o que já existe" para comparar com o que chegou: sem .range, passou de 1000 linhas o resto parece novo.
export function supabaseUnpagedLookup(rel, text) {
  if (!usesSupabase(text)) return []
  const out = []
  for (const m of text.matchAll(SUPA_READ)) {
    const name = m[1] ?? 'data'
    const stmt = statementAt(text, m.index + m[0].length)
    if (!/^[\w.]*\s*\.from\(\s*(['"`][\w.]+['"`]|[\w.]+)\s*\)/.test(stmt.trim()) || !/\.select\(/.test(stmt) || PAGED.test(stmt)) continue
    // Usada como a lista completa: "o que já existe" (existing, known…) ou um Map/Set para conferir o que é novo.
    const after = text.slice(m.index, m.index + 2500)
    const lookup = new RegExp(`new (Map|Set)(<[^>]*>)?\\(\\s*\\(?\\s*${name}\\b`)
    if (!LOOKUP_NAME.test(name) && !lookup.test(after)) continue
    out.push({ line: lineAt(text, m.index), table: stmt.match(/\.from\(\s*['"`]?([\w.]+)/)[1] })
  }
  return out
}

// ---- JSON lido, alterado e gravado por cima ------------------------------------------------------------------

// writeFileSync(f, JSON.stringify({ ...read(f), ...patch })) — a leitura e a gravação na mesma linha, sem arquivo
// temporário + rename. Dois processos juntos (hooks, workers, CLI e servidor) gravam um por cima do outro, e quem
// lê no meio da gravação pega o arquivo pela metade, cai no `{}` e grava só o pedaço novo.
const RMW = /\bwriteFileSync\(\s*([^;]{1,160}?),\s*JSON\.stringify\(\s*(\{|\[)\s*\.\.\.\s*\(?\s*(\w[\w.]*)\s*\(/g

export function jsonReadModifyWrite(rel, text) {
  if (/\brenameSync\(|\brename\(/.test(text)) return []
  const out = []
  for (const m of text.matchAll(RMW)) {
    // A leitura por cima: read/readJson/readState/JSON.parse… (não um objeto montado na hora).
    if (!/read|load|get|parse|current/i.test(m[3])) continue
    out.push({ line: lineAt(text, m.index) })
  }
  return out
}

// ---- new URL(import.meta.url).pathname ------------------------------------------------------------------------

// .pathname não decodifica: "Meus Projetos" vira "Meus%20Projetos" e "Ação" vira "A%C3%A7%C3%A3o"; no Windows
// ainda sobra a barra antes do C:. fileURLToPath resolve os três.
export function metaUrlPathname(rel, text) {
  const out = []
  for (const m of text.matchAll(/new URL\(\s*(?:['"`][^'"`]*['"`]\s*,\s*)?import\.meta\.url\s*\)\.pathname\b/g)) out.push({ line: lineAt(text, m.index) })
  return out
}

// ---- fetch sem prazo no servidor, cron ou hook ---------------------------------------------------------------

// Sem signal, um serviço que não responde segura o cron, a rota ou o hook até o limite da plataforma (que mata
// tudo, inclusive o que já tinha dado certo).
export function fetchWithoutTimeout(rel, text) {
  // scripts/: rodam à mão, e quem roda vê o travamento.
  if (UI_FILE.test(rel) || !BACKEND_PATH.test(rel) || /(^|\/)scripts?\//.test(rel)) return []
  // Arquivo que já trata prazo (AbortController próprio, helper com timeout): confia.
  if (/AbortSignal\.timeout|new AbortController|AbortSignal\.any/.test(text)) return []
  const out = []
  for (const m of text.matchAll(/(?<![\w.])fetch\(/g)) {
    // Até fechar o parêntese da chamada.
    let depth = 0
    let end = m.index + 5
    for (; end < Math.min(text.length, m.index + 1500); end++) {
      if (text[end] === '(') depth++
      else if (text[end] === ')' && --depth === 0) break
    }
    const call = text.slice(m.index, end + 1)
    // A definição de um método fetch(request) { … } (o handler do Worker), não uma chamada.
    if (/^\s*(:[^{\n]*)?\{/.test(text.slice(end + 1, end + 80))) continue
    if (/\bsignal\b/.test(call)) continue
    // fetch(url, opts) com opções montadas antes: só conta se o objeto não tem signal.
    const optsName = call.match(/,\s*(\w+)\s*\)$/)?.[1]
    if (optsName && new RegExp(`${optsName}\\s*=\\s*\\{[^}]*\\bsignal\\b`).test(text)) continue
    out.push({ line: lineAt(text, m.index) })
  }
  return out
}

// ---- promessa solta de função async do próprio arquivo -------------------------------------------------------

// No Node 15+, uma rejeição sem catch derruba o processo (servidor, worker, CLI): `capture(err)` sem await nem
// .catch, onde capture é async e pode lançar. Só no código que roda no Node (no navegador a rejeição só vai para
// o console) e só para funções que podem rejeitar (o corpo todo dentro de try/catch não rejeita).
const NODE_CODE = /\bprocess\.|from\s+['"]node:|require\(\s*['"]/

function neverRejects(body) {
  const inner = body.slice(1, -1).replace(/^\s*(\/\/[^\n]*\n\s*)*/, '')
  if (!/^try\s*\{/.test(inner)) return false
  const lastCatch = inner.lastIndexOf('catch')
  if (lastCatch === -1) return false
  const open = inner.indexOf('{', lastCatch)
  return open !== -1 && inner.slice(open + blockFrom(inner, open).length).trim() === ''
}

// A função mais próxima em volta de `index` é async? Volta pelas chaves abertas, pulando if/for/try/objetos.
function insideAsyncFunction(text, index) {
  let depth = 0
  for (let i = index - 1; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{' && depth-- === 0) {
      depth = 0
      const head = text.slice(Math.max(0, i - 300), i).trimEnd()
      if (/=>$/.test(head)) return /\basync\s*(\([^()]*\)|\w+)\s*=>$/.test(head)
      if (/\)$/.test(head)) {
        // Cabeçalho "nome(...)" : função, método ou controle (if, for…).
        let d = 0
        let j = head.length - 1
        for (; j >= 0; j--) {
          if (head[j] === ')') d++
          else if (head[j] === '(' && --d === 0) break
        }
        const before = head.slice(0, j).trimEnd()
        if (/\b(if|for|while|switch|catch|with)$/.test(before)) continue
        if (/\bfunction\s*\*?\s*\w*$|^\s*$|\b\w+$/.test(before)) return /\basync\s+(function\s*\*?\s*)?\w*$/.test(before)
      }
    }
  }
  return false
}

export function floatingAsyncCall(rel, text) {
  if (UI_FILE.test(rel) || !NODE_CODE.test(text)) return []
  const risky = new Set()
  for (const m of text.matchAll(/\basync\s+function\s+(\w+)\s*\([^)]*\)\s*\{|\b(?:const|let)\s+(\w+)\s*=\s*async\s*(?:\([^)]*\)|\w+)\s*=>\s*\{/g)) {
    if (!neverRejects(blockFrom(text, m.index + m[0].length - 1, 20000))) risky.add(m[1] ?? m[2])
  }
  if (!risky.size) return []
  const out = []
  // A chamada é a linha inteira: nada antes (await, return, void, =, argumento) e nada encadeado depois.
  for (const m of text.matchAll(new RegExp(`^[ \\t]*(${[...risky].join('|')})\\(`, 'gm'))) {
    const prev = text.slice(0, m.index).trimEnd()
    if (/(=>|=|,|\(|\?|:|&&|\|\||\+|\bawait|\breturn|\bvoid|\byield)$/.test(prev)) continue
    let depth = 0
    let end = m.index + m[0].length - 1
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++
      else if (text[end] === ')' && --depth === 0) break
    }
    const next = text.slice(end + 1, end + 40)
    // Encadeada (.catch/.then/.finally) ou a própria declaração (nome(...) { … } dentro de uma classe).
    if (/^\s*(\.|\{)/.test(next)) continue
    // Dentro de uma função async quem esquece o await é outro defeito; aqui só função comum ou o topo do arquivo.
    if (insideAsyncFunction(text, m.index)) continue
    out.push({ line: lineAt(text, m.index), name: m[1] })
  }
  return out
}

// ---- busca da tela que ignora o erro -------------------------------------------------------------------------

// `.then(({ data }) => setLista(data ?? []))`: sem rede, ou com o banco fora, a tela diz "nenhum item" em vez de
// "não deu para carregar".
export function uiIgnoresLoadError(rel, text) {
  if (!UI_FILE.test(rel) || !usesSupabase(text)) return []
  const out = []
  for (const m of text.matchAll(/\.then\(\s*\(\s*\{\s*data(?:\s*:\s*\w+)?\s*\}\s*\)\s*=>/g)) {
    const before = text.slice(Math.max(0, m.index - 900), m.index)
    const chain = before.slice(before.lastIndexOf('\n\n') + 1)
    // Uma lista (com .single/.maybeSingle, o vazio é "não configurado", outro caso).
    if (!/\.from\(|\.rpc\(/.test(chain) || /\.(single|maybeSingle)\(\s*\)\s*$/.test(chain.trimEnd())) continue
    const body = text.slice(m.index, m.index + 300).split('\n').slice(0, 4).join('\n')
    // Só quando o dado vai para o estado da tela com a lista vazia no lugar (o "nada aqui").
    if (!/\bset\w*\(\s*([\w.]+\(\s*)*\(*\s*\w+\s*(\?\?|\|\|)\s*\[\]/.test(body)) continue
    out.push({ line: lineAt(text, m.index) })
  }
  return out
}

// ---- Realtime que refaz a busca a cada linha -----------------------------------------------------------------

// .on('postgres_changes', …, load): uma gravação de 200 linhas vira 200 buscas por aba aberta, e a resposta velha
// pode chegar depois da nova.
export function realtimeReloadPerRow(rel, text) {
  if (!/postgres_changes/.test(text) || /setTimeout|debounce|throttle/i.test(text)) return []
  const out = []
  for (const m of text.matchAll(/\.on\(\s*['"`]postgres_changes['"`]/g)) {
    const call = statementAt(text, m.index, 400).split('\n').slice(0, 4).join('\n')
    // Último argumento: o nome de uma função de carga ou uma seta que só chama a carga.
    if (!/,\s*(load\w*|fetch\w*|refresh\w*|reload\w*|refetch\w*|get\w*)\s*\)|,\s*\(\s*\w*\s*\)\s*=>\s*(void\s+)?(load\w*|fetch\w*|refresh\w*|reload\w*|refetch\w*)\(\)\s*\)/i.test(call)) continue
    // Só tabela lida como lista no mesmo arquivo (uma linha por projeto, como uma configuração, não chega em rajada).
    const table = call.match(/\btable\s*:\s*['"`]([\w.]+)['"`]/)?.[1]
    const readsList = (name) =>
      [...text.matchAll(new RegExp(`\\.from\\(\\s*['"\`]${name}['"\`]\\s*\\)`, 'g'))].some((r) => {
        const stmt = statementAt(text, r.index, 900)
        return /\.select\(/.test(stmt) && !/\.(single|maybeSingle)\(|head\s*:\s*true/.test(stmt)
      })
    if (!table || !readsList(table)) continue
    out.push({ line: lineAt(text, m.index), table })
  }
  return out
}

// ---- laço de leitura que anda pelo tamanho vindo da entrada --------------------------------------------------

// pos += item.length, com item lido de JSON.parse: length negativo faz o laço voltar e reler para sempre;
// fracionário ou enorme corta errado. Confira Number.isInteger, >= 0 e o fim do corpo antes de andar.
export function lengthFromInput(rel, text) {
  const out = []
  for (const m of text.matchAll(/\b(pos|offset|cursor|off|position|ptr|idx|index|i)\s*\+=\s*(\w+)\.(length|len|size|byteLength)\b/g)) {
    const [, , obj, field] = m
    const before = text.slice(Math.max(0, m.index - 1200), m.index)
    // O objeto veio da entrada (JSON.parse), não é um texto ou uma lista do próprio código.
    if (!new RegExp(`\\b${obj}\\s*=\\s*[\\w.]*\\(?\\s*JSON\\.parse\\(`).test(before)) continue
    if (/Number\.isInteger\(|Number\.isSafeInteger\(/.test(before.slice(before.lastIndexOf(`${obj} =`)))) continue
    out.push({ line: lineAt(text, m.index), field: `${obj}.${field}` })
  }
  return out
}

// ---- regex de e-mail sem âncora --------------------------------------------------------------------------------

// /[\w.+-]+@…/g: em um texto comprido sem "@" (um JSON, um stack), cada posição recomeça e lê até o fim — 80 mil
// caracteres levaram 3,4 s. O lookbehind (?<![\w.+-]) faz cada trecho ser lido uma vez.
export function quadraticEmailRegex(rel, text) {
  const out = []
  // faundr-ignore desempenho/regex-de-email-lenta: é a regex que procura o padrão, não uma regex de e-mail
  for (const m of text.matchAll(/\/((?:\\.|[^/\n\\])*?)\[(\\w|a-zA-Z0-9|A-Za-z0-9|a-z0-9)[^\]\n]*\]\+@((?:\\.|[^/\n\\])*)\/([a-z]*)/g)) {
    const [, prefix, , , flags] = m
    if (!flags.includes('g')) continue
    // Ancorada: começo do texto, lookbehind, \b ou um caractere que não pode fazer parte do e-mail logo antes.
    if (/(\^|\(\?<!?[^)]*\)|\\b|\[\^[^\]]*\]\)?)$/.test(prefix)) continue
    out.push({ line: lineAt(text, m.index) })
  }
  return out
}

// ---- crypto.randomUUID em código que roda na casa dos outros -------------------------------------------------

// Só existe em página https/localhost, Safari 15.4+ e (sem import) Node 19+: um SDK que chama direto quebra o app
// de quem instalou justamente quando ia reportar um erro.
export function randomUuidWithoutFallback(rel, text) {
  if (!THIRD_PARTY_RUNTIME.test(rel)) return []
  // Com teste antes (crypto?.randomUUID, typeof crypto, if (crypto.randomUUID)) ou import de node:crypto.
  if (/\?\.\s*randomUUID|typeof\s+crypto|if\s*\(\s*[\w.]*randomUUID\s*\)|from\s+['"](node:)?crypto['"]|require\(\s*['"](node:)?crypto['"]\s*\)/.test(text)) return []
  const out = []
  for (const m of text.matchAll(/\bcrypto\.randomUUID\(\)/g)) out.push({ line: lineAt(text, m.index) })
  return out
}

export const BUG_RULES = {
  'falha/limite-acima-de-1000': supabaseLimitOver1000,
  'falha/lista-cortada-em-1000': supabaseUnpagedLookup,
  'falha/json-gravado-por-cima': jsonReadModifyWrite,
  'falha/caminho-do-modulo': metaUrlPathname,
  'falha/rede-sem-prazo': fetchWithoutTimeout,
  'falha/promessa-solta': floatingAsyncCall,
  'falha/erro-vira-lista-vazia': uiIgnoresLoadError,
  'desempenho/realtime-sem-espera': realtimeReloadPerRow,
  'falha/tamanho-sem-conferir': lengthFromInput,
  'desempenho/regex-de-email-lenta': quadraticEmailRegex,
  'falha/randomuuid-sem-alternativa': randomUuidWithoutFallback,
}

/** Todas as regras num arquivo: [{ rule, line, ...ctx }]. */
export function bugFindings(rel, text) {
  const code = withoutCommentLines(text)
  const out = []
  for (const [rule, fn] of Object.entries(BUG_RULES)) for (const hit of fn(rel, code)) out.push({ rule, ...hit })
  return out
}

// Linhas só de comentário (// …, e o miolo de /* … */ começando por *) viram /**/: exemplo comentado não é código.
// As linhas continuam no lugar (o número da linha do achado não muda) e não ficam em branco (linha em branco é o
// fim do comando para statementAt; um comentário no meio da cadeia .from().select() não pode cortá-la).
function withoutCommentLines(text) {
  return text
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/?\*)/.test(l) ? '/**/' : l))
    .join('\n')
}
