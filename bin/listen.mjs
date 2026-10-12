// Multiplayer 4: `faundr escutar`, o ajudante do botão "Rodar agora" (opcional, desligado por padrão).
// A pessoa liga num terminal, no próprio computador. Ele pergunta ao painel, de tempos em tempos, se ela escreveu um
// pedido para si mesma com "Rodar agora" e, se sim, abre uma sessão oficial do Claude Code em segundo plano
// (`claude --bg`), numa cópia separada da pasta (`-w`), com o login que ela mesma fez. Regras:
//   - só pedidos da própria pessoa para ela mesma (o servidor e o banco também conferem);
//   - no máximo 2 sessões de fundo ao mesmo tempo;
//   - nunca pula as confirmações do Claude Code (sem --dangerously-skip-permissions);
//   - o Faundr nunca vê nem guarda o login do Claude.
import { spawnSync } from 'node:child_process'
import readline from 'node:readline/promises'

const POLL_MS = 20_000

export const WARNING = `O "faundr escutar" abre sessões do Claude Code sozinho, no seu computador, com a SUA assinatura do Claude
(cada sessão gasta o seu limite de uso, como se você tivesse aberto na mão).

- Só roda pedidos que você mesmo escreveu no painel para você, com "Rodar agora".
- No máximo 2 sessões ao mesmo tempo, cada uma numa cópia separada da pasta.
- As confirmações do Claude Code continuam valendo: quando a sessão precisar de você, ela aparece em Atividade → Agora.
- A Anthropic ainda não confirmou se esse uso automático é permitido nos planos Pro e Max. Use por sua conta.

Para parar: Ctrl+C.`

/** Texto que a sessão de fundo recebe. */
export function runPrompt(id, body) {
  const code = id.slice(0, 8)
  return [
    `Pedido que o próprio usuário escreveu no painel do Faundr (${code}), aberto pelo ajudante "faundr escutar": «${body.replace(/\s+/g, ' ').trim()}».`,
    'Você está numa cópia separada da pasta (mesa de trabalho). Faça o pedido como se o usuário tivesse pedido aqui.',
    `Ao terminar, rode: faundr fila --feito ${code} "<o que foi feito, em uma linha>".`,
    'Não junte o trabalho ao projeto principal: o usuário revisa e pede para juntar depois (skill "mesa" do Faundr).',
  ].join(' ')
}

/** Argumentos do Claude Code: sessão de fundo, cópia separada da pasta e um nome que a pessoa reconhece. */
export function bgArgs(id, body) {
  const code = id.slice(0, 8)
  const title = body.replace(/\s+/g, ' ').trim().slice(0, 40)
  return ['--bg', '--worktree', `faundr-${code}`, '--name', `Faundr: ${title}`, runPrompt(id, body)]
}

function openSession(root, run, log) {
  const r = spawnSync('claude', bgArgs(run.id, run.body), { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  if (r.error || r.status !== 0) {
    const why = (r.error?.code === 'ENOENT' ? 'o comando claude não foi encontrado (o Claude Code está instalado?)' : (r.stderr || r.stdout || String(r.error ?? '')).trim()).slice(0, 400)
    log(`Não consegui abrir a sessão para o pedido ${run.id.slice(0, 8)}: ${why}`)
    return { status: 'failed', error: why }
  }
  const name = (r.stdout ?? '').trim().split(/\s+/).find((w) => /^[a-z0-9-]{4,}$/i.test(w)) ?? null
  log(`Sessão aberta em segundo plano para o pedido ${run.id.slice(0, 8)}${name ? ` (${name}: claude attach ${name})` : ''}.`)
  return { status: 'running', name }
}

/**
 * Laço do ajudante. `api(body)` fala com /api/cli/requests; `consent` guarda o "sim" da pessoa na configuração.
 */
export async function escutar({ root, machine, api, consented, saveConsent, log = console.log }) {
  if (!consented) {
    log(WARNING)
    if (!process.stdin.isTTY) throw new Error('Rode faundr escutar num terminal: ele precisa do seu "sim" antes da primeira vez.')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const answer = (await rl.question('\nDigite "sim" para ligar: ')).trim().toLowerCase()
    rl.close()
    if (answer !== 'sim') return log('Não liguei. Nada foi feito.')
    saveConsent()
  }
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    await api({ action: 'listen-stop', machine }).catch(() => {})
    log('Ajudante desligado. O "Rodar agora" sumiu do painel.')
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  log(`Ajudante ligado em ${machine}. No painel, em Atividade → Pedidos, escreva um pedido para você com "Rodar agora". Ctrl+C para parar.`)
  let lastError = null
  while (!stopping) {
    try {
      const { runs } = await api({ action: 'listen', machine })
      lastError = null
      for (const run of runs ?? []) {
        log(`Pedido novo: «${run.body.slice(0, 120)}»`)
        const result = openSession(root, run, log)
        await api({ action: 'run-status', id: run.id, status: result.status, name: result.name ?? null, error: result.error ?? null }).catch(() => {})
      }
    } catch (err) {
      // Sem rede ou painel fora do ar: avisa uma vez e continua tentando.
      if (lastError !== err.message) log(`Sem conexão com o painel (${err.message}); tentando de novo.`)
      lastError = err.message
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}
