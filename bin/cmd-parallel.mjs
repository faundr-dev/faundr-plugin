// Etapas em paralelo: faundr parallel (lista as etapas prontas, abre e fecha uma bancada por etapa).

import { closeMesa, listMesas, openMesa, readyStages } from './parallel.mjs'
import { t } from './i18n.mjs'
import { DEFAULT_API_URL, linkedProject, textArg } from './cli-core.mjs'
import { memoryApi } from './cmd-features.mjs'

// ---- Etapas em paralelo ----------------------------------------------------------------------------------

export async function parallelCommand(args) {
  const { root } = linkedProject()
  const sub = args[0]
  // Fechar sempre pode (para não prender ninguém numa mesa aberta); abrir e listar são do Duo para cima.
  if (sub === 'close') return parallelClose(root, args.slice(1))
  const board = await memoryApi({ action: 'board' })
  if (board.collab === false)
    throw new Error(
      t(
        `Parallel workbenches are not part of the Free plan. The Duo plan unlocks them: ${DEFAULT_API_URL}/pricing`,
        `As mesas em paralelo não fazem parte do plano Grátis. O plano Duo libera: ${DEFAULT_API_URL}/pt-br/precos`,
      ),
    )
  if (sub === 'open') return parallelOpen(root, args.slice(1))
  const ready = readyStages(board.allFeatures)
  const open = listMesas(root)
  if (open.length) console.log(`Open workbenches: ${open.map((m) => `${m.branch} (${m.dir})`).join('; ')}\n`)
  if (!ready.length) return console.log('No planned stage can start now: each one waits for the previous stage to finish, or none is planned (faundr feature "<stage>" --after "<previous>").')
  console.log(`${ready.length} stage(s) can start now${ready.length > 1 ? '; none depends on another one in this list, so they can go in parallel' : ''}:`)
  for (const s of ready) {
    console.log(`- ${s.title} (after "${s.after}")${s.body ? ` — ${s.body}` : ''}`)
    for (const task of s.tasks) console.log(`    [ ] ${task}`)
  }
  console.log('\nOpen the workbenches: faundr parallel open "<stage>; <stage>"')
}

function parallelOpen(root, args) {
  const titles = textArg(args).split(';').map((s) => s.trim()).filter(Boolean)
  if (!titles.length) throw new Error('usage: faundr parallel open "<stage>; <stage>"')
  for (const title of titles) {
    const m = openMesa(root, title)
    console.log(`${m.existed ? 'Already open' : 'Opened'}: "${title}" in ${m.dir} (branch ${m.branch})`)
  }
  console.log('\nEach helper works only inside its folder and commits on its branch. Then merge each one: git merge --no-ff mesa/<name>, run the tests, and close it with faundr parallel close <name>.')
}

function parallelClose(root, args) {
  const slugs = args.includes('--all') ? listMesas(root).map((m) => m.slug) : [textArg(args)].filter(Boolean)
  if (!slugs.length) throw new Error('usage: faundr parallel close <name> | --all')
  for (const slug of slugs) {
    const r = closeMesa(root, slug)
    console.log(`Closed ${slug}${r.branchKept ? `: the branch ${r.branchKept} has work that was not merged, so it was kept` : ''}.`)
  }
}
