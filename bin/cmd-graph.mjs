// Mapa do código: faundr graph (gera e envia o grafo), graph-query/path/callers/skeleton/grep, map, o contexto dos
// subagentes (subagent-start) e o processo que roda as checagens em segundo plano (background).

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { faundrPath, organizeFaundrDir } from './paths.mjs'
import { graphFooter } from './usage.mjs'
import { globalRules, readMemoryIndex } from './rules.mjs'
import { t } from './i18n.mjs'
import { CONFIG_DIR, FAUNDR_FILE, findUp, flag, GRAPH_GUIDANCE, GRAPH_LOCK_MS, LINK_FILE, loadConfig, log, projectRoot, readJson, readStdin } from './cli-core.mjs'
import { lockFile, markGraphDirty } from './hook-events.mjs'

export async function runBackground(args) {
  const jobs = JSON.parse(args[0] ?? '[]')
  await Promise.all(
    jobs.map(
      (job) =>
        new Promise((resolve) => {
          const child = spawn(process.execPath, [FAUNDR_FILE, ...job], { stdio: 'ignore', windowsHide: true })
          child.on('exit', resolve)
          child.on('error', resolve)
        }),
    ),
  )
}

// Motor do grafo (engine/ empacotado em plugin/dist/graph.mjs pelo `npm run build:engine`).
const ENGINE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'graph.mjs')
export const loadEngine = () => import(pathToFileURL(ENGINE_FILE).href)

// Consultas locais ao grafo: não precisam de rede nem de token.
export async function graphCommand(name, args) {
  const engine = await loadEngine()
  const root = projectRoot()
  // Antes de responder, refaz no grafo local só os arquivos que mudaram (o envio ao painel fica para o fim da resposta).
  let refreshed = null
  try {
    refreshed = await engine.refreshGraph(root)
  } catch (err) {
    log(`graph refresh: ${err?.message ?? err}`)
  }
  const output = await engine.runEngine([name, ...args], root)
  if (refreshed?.changed.length) {
    const files = refreshed.changed
    console.log(`(Graph updated before the query: ${files.length > 3 ? `${files.length} files` : files.join(', ')} changed.)`)
  }
  // Rodapé com o tamanho da resposta e o dos arquivos citados: o Faundr soma no fim da sessão (Impacto).
  console.log([output, graphFooter(output, root)].filter(Boolean).join('\n\n'))
}

// O único comando do mapa para o dono (/faundr:map): sem nada, gera e envia; com uma pergunta, busca;
// com duas peças "arquivo::nome" (o botão Entender do painel), mostra como elas se conectam.
export async function mapCommand(args) {
  const words = args.filter((a) => !a.startsWith('--'))
  if (!words.length) return graph(args)
  if (words.length === 2 && words.every((w) => w.includes('::'))) return graphCommand('path', args)
  return graphCommand('query', args)
}

// Subagentes não recebem o contexto do início da sessão: sem este gancho, eles buscavam só com grep e nunca no mapa.
export async function subagentStart() {
  const payload = JSON.parse(await readStdin())
  const linkFile = findUp(payload.cwd ?? process.cwd(), LINK_FILE)
  if (!linkFile) return
  const root = path.dirname(linkFile)
  // O subagente não recebe o início da sessão: leva as regras do time (as ligadas a arquivos chegam pelo guard).
  const rules = globalRules(readMemoryIndex(root))
  const teamRules = rules.length
    ? `[Faundr] Team rules (always follow them):\n${rules.map((r) => `- ${r.title}${r.body ? ` — ${r.body}` : ''}`).join('\n')}`
    : null
  const graphNote = fs.existsSync(faundrPath(root, 'graph')) ? GRAPH_GUIDANCE : null
  const additionalContext = [teamRules, graphNote].filter(Boolean).join('\n\n')
  if (additionalContext) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext } }))
}

// Gera o grafo na raiz do projeto ligado e envia graph.json + GRAPH_REPORT.md.
export async function graph(args) {
  const quiet = args.includes('--quiet')
  const say = (msg) => (quiet ? log(`graph: ${msg}`) : console.log(msg))
  const linkFile = findUp(process.cwd(), LINK_FILE)
  if (!linkFile) throw new Error(t('Folder not linked to a project. Use /faundr:link first.', 'Pasta não ligada a um projeto. Use /faundr:link primeiro.'))
  const root = path.dirname(linkFile)
  const { projectId } = readJson(linkFile) ?? {}
  const config = loadConfig()
  if (!config.token) throw new Error(t('No token. Sign in first (/faundr:login).', 'Sem token. Faça o login primeiro (/faundr:login).'))
  organizeFaundrDir(root) // o cache antigo, solto em .faundr/, ainda serve

  // Evita duas gerações ao mesmo tempo no mesmo projeto.
  const lock = lockFile(projectId)
  try {
    if (Date.now() - fs.statSync(lock).mtimeMs < GRAPH_LOCK_MS) {
      markGraphDirty(projectId) // tenta de novo no próximo Stop
      return say('another graph build is already running; will try again later')
    }
  } catch {
    // Sem trava (ou ilegível): nenhuma outra geração rodando.
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(lock, String(process.pid))

  try {
    const started = Date.now()
    const engine = await loadEngine()
    const result = await engine.buildProjectGraph(root)
    engine.writeOutputs(root, result)
    const graphJson = result.graph
    const report = result.report

    const res = await fetch(`${config.apiUrl}/api/cli/graph`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
      body: JSON.stringify({
        projectId,
        agent: flag(args, '--agent'),
        agentSessionId: flag(args, '--session'),
        graph: graphJson,
        report,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`API rejected the graph (${res.status}): ${await res.text()}`)
    const r = await res.json()
    say(`Graph sent: ${r.nodes} nodes, ${r.edges} links, ${r.communities} communities (${((Date.now() - started) / 1000).toFixed(1)} s).`)
    if (result.stats.dropped)
      say(`Note: the project went over ${result.stats.files} files and ${result.stats.dropped} were left out of the map (code went in first). To choose what is left out, list folders in a .faundrignore file at the root (same format as .gitignore).`)
  } finally {
    try {
      fs.unlinkSync(lock)
    } catch {
      // Trava já apagada: nada a fazer (ela também vence sozinha pelo tempo).
    }
  }
}
