// Guarda antes de cada edição (faundr guard, hook PreToolUse): chaves no código, regras e workflows ligados ao arquivo,
// skills, trechos proibidos, quem depende do arquivo, avisos de laço de edição, colegas no mesmo arquivo e migration
// irreversível.

import fs from 'node:fs'
import path from 'node:path'
import { destructiveMigration, guardContent } from './security.mjs'
import { dependentsNote, readGraph } from './dependents.mjs'
import { skillsFileOnce } from './skills.mjs'
import { workflowsForFile, workflowsOnce } from './workflows.mjs'
import { forbiddenIn, forbiddenNote, readRules, rulesFor, rulesNote } from './rules.mjs'
import { editLoopNote, takeLoopAlerts } from './loop.mjs'
import { fileWarning, readTeam } from './team.mjs'
import { toolEdits } from './agent.mjs'
import { ensureSessionCheckpoint } from './checkpoints.mjs'
import { CONFIG_DIR, findUp, LINK_FILE, log, readState, readStdin, writeState } from './cli-core.mjs'
import { editedFile } from './hook-stop.mjs'
import { takeSecurityAlert } from './cmd-security.mjs'

// Regras ligadas ao arquivo, cada uma uma vez por sessão.
function rulesOnce(root, sid, rel) {
  try {
    const shown = readState(root).rulesShown
    const ids = shown?.session === sid ? shown.ids : []
    const rules = rulesFor(readRules(root), rel, ids)
    if (!rules.length) return null
    writeState(root, { rulesShown: { session: sid, ids: [...ids, ...rules.map((r) => r.id)] } })
    return rulesNote(root, rel, rules)
  } catch (err) {
    log(`guard rules: ${err?.message ?? err}`)
    return null
  }
}

// Workflow ligado ao arquivo, cada um uma vez por sessão.
function workflowsFileOnce(root, sid, rel) {
  try {
    return workflowsOnce(root, sid, (list, ids) => workflowsForFile(list, rel, ids), `Editing ${rel}`)
  } catch (err) {
    log(`guard workflows: ${err?.message ?? err}`)
    return null
  }
}

// Skill com o momento "antes de editar" cujos arquivos batem: avisa uma vez por sessão.
function skillsFileGuard(root, sid, rel) {
  try {
    return skillsFileOnce(root, sid, rel)
  } catch (err) {
    log(`guard skills: ${err?.message ?? err}`)
    return null
  }
}

// Regra do time com padrão proibido que a mudança traz: avisa a cada edição (não só a primeira).
function forbiddenCheck(root, rel, content) {
  try {
    return forbiddenNote(rel, forbiddenIn(readRules(root), rel, content))
  } catch (err) {
    log(`guard broken rule: ${err?.message ?? err}`)
    return null
  }
}

// Antes da primeira edição de cada arquivo na sessão: quem depende dele, pelo grafo local.
function dependentsOnce(root, sid, rel) {
  try {
    const shown = readState(root).dependentsShown
    const files = shown?.session === sid ? shown.files : []
    if (files.includes(rel)) return null
    const graph = readGraph(root)
    if (!graph) return null
    writeState(root, { dependentsShown: { session: sid, files: [...files, rel].slice(-200) } })
    return dependentsNote(graph, rel)
  } catch (err) {
    log(`guard dependents: ${err?.message ?? err}`)
    return null
  }
}

// Avisos do detector de loop: o mesmo erro seguidas vezes, ou muitas mudanças no arquivo com algo falhando.
function loopNotes(sid, file, rel) {
  try {
    let priorEdits = 0
    try {
      priorEdits = fs.readFileSync(editedFile(sid), 'utf8').split('\n').filter((l) => l.trim() === file).length
    } catch {
      // Sessão sem edições ainda: zero.
    }
    return [...takeLoopAlerts(CONFIG_DIR, sid), editLoopNote(CONFIG_DIR, sid, { rel, priorEdits })]
  } catch (err) {
    log(`guard loop: ${err?.message ?? err}`)
    return []
  }
}

// PreToolUse: antes de gravar, procura chaves no conteúdo novo. Barra as mais perigosas e avisa das outras.
// Outra sessão viva mexeu neste arquivo: avisa uma vez por arquivo e sessão (a foto do time é a cópia local).
function teamOnce(root, sid, rel) {
  if (!sid) return null
  const note = fileWarning(readTeam(root), sid, rel)
  if (!note) return null
  const state = readState(root)
  const warned = state.teamWarned?.session === sid ? state.teamWarned.files : []
  if (warned.includes(rel)) return null
  writeState(root, { teamWarned: { session: sid, files: [...warned, rel] } })
  return note
}

// Migração sem volta: antes de rodar, backup, caminho de volta e um aviso ao dono (sem parar para pedir OK).
function destructiveNote(content, rel) {
  const what = destructiveMigration(content, rel)
  if (!what.length) return null
  return `[Faundr] Irreversible migration in ${rel}: ${what.join('; ')}. Before applying it to the database, without stopping to ask: (1) tell the user in one plain-language line what is lost; (2) make sure there is a recent backup (Supabase: Database → Backups, or supabase db dump); (3) write at the top of the migration, in a comment, the SQL that undoes it (recreate the column and copy the data back from a copy table, for example); (4) if the published app still uses what will disappear, do it in two steps: first the code stops using it, then the migration deletes it.`
}

export async function guard() {
  const payload = JSON.parse(await readStdin())
  const linkFile = findUp(payload.cwd ?? process.cwd(), LINK_FILE)
  if (!linkFile) return
  const root = path.dirname(linkFile)
  // Claude Code edita um arquivo por vez; o apply_patch do Codex pode mexer em vários.
  const edits = toolEdits(payload.tool_name, payload.tool_input).map((e) => ({
    ...e,
    rel: path.relative(root, path.resolve(payload.cwd ?? process.cwd(), e.file)).split(path.sep).join('/'),
  }))
  if (!edits.length) return
  const checked = edits.map((e) => ({ ...e, ...guardContent(e.content, e.rel) }))
  const blocked = checked.filter((e) => e.block.length)
  // Ponto de volta antes da primeira edição da sessão (e de novo a cada 30 min de edições).
  let checkpoint = null
  if (!blocked.length) {
    try {
      checkpoint = ensureSessionCheckpoint(root, payload.session_id, { configDir: CONFIG_DIR })
    } catch (err) {
      log(`guard restore point: ${err?.message ?? err}`)
    }
  }
  const how = 'Put the value in the .env file (which does not go to git) and read it with process.env.VARIABLE_NAME; if it is only an example, use a clearly fake value (e.g. sk_live_xxx).'
  if (blocked.length) {
    const where = blocked.map((e) => `${e.rel} (${e.block.map((b) => `${b.name}: ${b.masked}`).join('; ')})`).join(', ')
    log(`guard: blocked ${blocked.flatMap((e) => e.block.map((b) => b.name)).join(', ')} in ${blocked.map((e) => e.rel).join(', ')}`)
    return process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `[Faundr] Blocked: the content of ${where} has a secret key. A secret key cannot stay in the code. ${how} If the key was already pasted in the conversation or saved somewhere else, suggest the user rotate it at the provider.`,
        },
      }),
    )
  }
  // O alerta da checagem de segurança em segundo plano entra antes da próxima edição: o hook de cada pergunta
  // roda em segundo plano e o Claude Code descarta o que ele devolve.
  const context = [
    checkpoint && '[Faundr] Restore point of the files saved before this change (to undo: /faundr:undo).',
    takeSecurityAlert(payload.session_id),
    ...checked.flatMap(({ file, rel, content, warn, isNew }) => [
      warn.length && `[Faundr] Warning: ${rel} is about to receive what looks like a secret key (${warn.map((w) => `${w.name}: ${w.masked}`).join('; ')}). ${how}`,
      destructiveNote(content, rel),
      ...loopNotes(payload.session_id, file, rel),
      forbiddenCheck(root, rel, content),
      rulesOnce(root, payload.session_id, rel),
      workflowsFileOnce(root, payload.session_id, rel),
      skillsFileGuard(root, payload.session_id, rel),
      teamOnce(root, payload.session_id, rel),
      !isNew && dependentsOnce(root, payload.session_id, rel),
    ]),
  ].filter(Boolean)
  if (context.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context.join('\n\n') } }))
}
