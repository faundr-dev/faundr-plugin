// faundr pending-send: manda o que ficou guardado em ~/.faundr/pending.json (ver pending.mjs). Roda em segundo plano,
// aberto pelo hook; ninguém espera por ele.
import { loadConfig, log } from './cli-core.mjs'
import { postQueuedEvent, runQueuedCommand, sendPending } from './pending.mjs'

export async function pendingSend() {
  const { token, apiUrl } = loadConfig()
  if (!token || !apiUrl) return
  const { sent, busy } = await sendPending({
    postEvent: (entry) => postQueuedEvent(entry, { apiUrl, token }),
    runCommand: (entry) => runQueuedCommand(entry),
  })
  if (sent) log(`pending: sent ${sent}`)
  else if (busy) log('pending: another sender is running')
}
