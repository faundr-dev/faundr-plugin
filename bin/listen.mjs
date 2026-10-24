// Multiplayer 4: `faundr listen`, o ajudante do botão "Rodar agora" (opcional, desligado por padrão).
// A pessoa liga num terminal, no próprio computador. Ele pergunta ao painel, de tempos em tempos, se ela escreveu um
// pedido para si mesma com "Rodar agora" e, se sim, abre uma sessão oficial do Claude Code em segundo plano
// (`claude --bg`), numa cópia separada da pasta (`-w`), com o login que ela mesma fez. Regras:
//   - só pedidos da própria pessoa para ela mesma (o servidor e o banco também conferem);
//   - no máximo 2 sessões de fundo ao mesmo tempo;
//   - nunca pula as confirmações do Claude Code (sem --dangerously-skip-permissions);
//   - o Faundr nunca vê nem guarda o login do Claude.
import { spawnSync } from 'node:child_process'
import readline from 'node:readline/promises'
import { t } from './i18n.mjs'

const POLL_MS = 20_000

export const warning = () =>
  t(
    `"faundr listen" opens Claude Code sessions on its own, on your computer, with YOUR Claude subscription
(each session uses your usage limit, as if you had opened it by hand).

- It only runs requests you wrote on the dashboard for yourself, with "Run now".
- At most 2 sessions at the same time, each in a separate copy of the folder.
- Claude Code confirmations still apply: when the session needs you, it shows up in Activity → Now.
- Anthropic has not yet confirmed whether this automatic use is allowed on the Pro and Max plans. Use it at your own risk.

To stop: Ctrl+C.`,
    `O "faundr listen" abre sessões do Claude Code sozinho, no seu computador, com a SUA assinatura do Claude
(cada sessão gasta o seu limite de uso, como se você tivesse aberto na mão).

- Só roda pedidos que você mesmo escreveu no painel para você, com "Rodar agora".
- No máximo 2 sessões ao mesmo tempo, cada uma numa cópia separada da pasta.
- As confirmações do Claude Code continuam valendo: quando a sessão precisar de você, ela aparece em Atividade → Agora.
- A Anthropic ainda não confirmou se esse uso automático é permitido nos planos Pro e Max. Use por sua conta.

Para parar: Ctrl+C.`,
  )

/** Texto que a sessão de fundo recebe. */
export function runPrompt(id, body) {
  const code = id.slice(0, 8)
  return [
    `Request the user wrote on the Faundr dashboard for themselves (${code}), opened by the "faundr listen" helper: «${body.replace(/\s+/g, ' ').trim()}».`,
    'You are in a separate copy of the folder (workbench). Do the request as if the user had asked for it here.',
    `When you finish, run: faundr inbox --done ${code} "<what was done, in one line>".`,
    'Do not merge the work into the main project: the user reviews it and asks to merge later (Faundr "merge" skill).',
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
    const why = (r.error?.code === 'ENOENT' ? t('the claude command was not found (is Claude Code installed?)', 'o comando claude não foi encontrado (o Claude Code está instalado?)') : (r.stderr || r.stdout || String(r.error ?? '')).trim()).slice(0, 400)
    log(t(`Could not open the session for request ${run.id.slice(0, 8)}: ${why}`, `Não consegui abrir a sessão para o pedido ${run.id.slice(0, 8)}: ${why}`))
    return { status: 'failed', error: why }
  }
  const name = (r.stdout ?? '').trim().split(/\s+/).find((w) => /^[a-z0-9-]{4,}$/i.test(w)) ?? null
  const attach = name ? ` (${name}: claude attach ${name})` : ''
  log(t(`Background session opened for request ${run.id.slice(0, 8)}${attach}.`, `Sessão aberta em segundo plano para o pedido ${run.id.slice(0, 8)}${attach}.`))
  return { status: 'running', name }
}

/**
 * Laço do ajudante. `api(body)` fala com /api/cli/requests; `consent` guarda o "sim" da pessoa na configuração.
 */
export async function escutar({ root, machine, api, consented, saveConsent, log = console.log }) {
  if (!consented) {
    log(warning())
    if (!process.stdin.isTTY) throw new Error(t('Run faundr listen in a terminal: it needs your "yes" before the first time.', 'Rode faundr listen num terminal: ele precisa do seu "sim" antes da primeira vez.'))
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const answer = (await rl.question(t('\nType "yes" to turn it on: ', '\nDigite "sim" para ligar: '))).trim().toLowerCase()
    rl.close()
    if (answer !== 'sim' && answer !== 'yes') return log(t('Not turned on. Nothing was done.', 'Não liguei. Nada foi feito.'))
    saveConsent()
  }
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    await api({ action: 'listen-stop', machine }).catch(() => {
      // Sem rede ao desligar: o painel tira o "Rodar agora" sozinho quando o ajudante para de responder.
    })
    log(t('Helper turned off. "Run now" is gone from the dashboard.', 'Ajudante desligado. O "Rodar agora" sumiu do painel.'))
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  log(
    t(
      `Helper on at ${machine}. On the dashboard, in Activity → Requests, write a request for yourself with "Run now". Ctrl+C to stop.`,
      `Ajudante ligado em ${machine}. No painel, em Atividade → Pedidos, escreva um pedido para você com "Rodar agora". Ctrl+C para parar.`,
    ),
  )
  let lastError = null
  while (!stopping) {
    try {
      const { runs } = await api({ action: 'listen', machine })
      lastError = null
      for (const run of runs ?? []) {
        log(t(`New request: «${run.body.slice(0, 120)}»`, `Pedido novo: «${run.body.slice(0, 120)}»`))
        const result = openSession(root, run, log)
        await api({ action: 'run-status', id: run.id, status: result.status, name: result.name ?? null, error: result.error ?? null }).catch(() => {
          // Sem rede agora: a sessão já abriu; só a situação no painel fica para trás.
        })
      }
    } catch (err) {
      // Sem rede ou painel fora do ar: avisa uma vez e continua tentando.
      if (lastError !== err.message) log(t(`No connection to the dashboard (${err.message}); trying again.`, `Sem conexão com o painel (${err.message}); tentando de novo.`))
      lastError = err.message
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}
