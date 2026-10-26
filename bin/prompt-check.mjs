#!/usr/bin/env node
// Hook UserPromptSubmit síncrono: roda antes de o agente ler cada pedido, então fica separado do faundr.mjs (só
// carrega o detector e a cópia local da memória) e não usa a rede. Três avisos, cada um só quando vale:
// - pedido parece funcionalidade nova: registrar, com as etapas, e perguntar o escopo se for vago;
// - pedido parece uma regra ("a partir de agora…", "nunca…"): registrar como regra do time;
// - workflow do projeto cujo assunto bate com o pedido (cópia local .faundr/painel/workflows.json), uma vez por sessão;
// - skill conectada cujo assunto bate com o pedido (cópia local .faundr/painel/skills.json), uma vez por sessão;
// - regras e decisões do assunto do pedido, da cópia local (.faundr/painel/memory.json), cada uma uma vez por sessão;
// - quem mais está no projeto, da cópia local da foto do time, só quando o time mudou desde o último aviso;
// - pedidos do painel, recados de outras sessões e notas do time que chegaram (cópia local da caixa de entrada).
// O registro do pedido no diário continua no hook assíncrono do faundr.mjs.
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio.
import fs from 'node:fs'
import { faundrPath, findDirWith, readStdin } from './paths.mjs'
import { featureIntent, featureNudge, ruleIntent, ruleNudge } from './intent.mjs'
import { memoryNote, readMemoryIndex, relevantMemory } from './rules.mjs'
import { readTeam, teamPromptNote } from './team.mjs'
import { takeInbox } from './inbox.mjs'
import { workflowsForPrompt, workflowsOnce } from './workflows.mjs'
import { noteSkillRan, readSkillIndex, skillsOnce, typedSkill } from './skills.mjs'
import { markSkillStart } from './ai-cost.mjs'
import { skillStepsNote, stepOff } from './flows.mjs'
import { agentStdout } from './agent.mjs'

// Os hooks do Codex chamam com o argumento codex: as skills ali se chamam com $.
agentStdout(process.argv[2] === 'codex' ? 'codex' : 'claude')

const readState = (root) => {
  try {
    return JSON.parse(fs.readFileSync(faundrPath(root, 'state'), 'utf8'))
  } catch {
    // Sem estado salvo (ou ilegível): começa do zero.
    return {}
  }
}

// Mesma lista do guard (regras ligadas a arquivos): o que já chegou ao agente nesta sessão não volta.
function relevantOnce(root, sid, prompt) {
  if (!sid) return null
  const state = readState(root)
  const ids = state.rulesShown?.session === sid ? state.rulesShown.ids : []
  const items = relevantMemory(readMemoryIndex(root), prompt, ids)
  if (!items.length) return null
  fs.writeFileSync(
    faundrPath(root, 'state'),
    JSON.stringify({ ...readState(root), rulesShown: { session: sid, ids: [...ids, ...items.map((m) => m.id)] } }, null, 2),
  )
  return memoryNote(items)
}

// O time mudou (alguém entrou, saiu ou passou a mexer em outros arquivos): avisa quem já estava trabalhando.
function teamOnce(root, sid) {
  if (!sid) return null
  const state = readState(root)
  const last = state.teamSeen?.session === sid ? state.teamSeen.sig : null
  const { note, sig } = teamPromptNote(readTeam(root), sid, last)
  if (sig !== (last ?? '')) fs.writeFileSync(faundrPath(root, 'state'), JSON.stringify({ ...readState(root), teamSeen: { session: sid, sig } }, null, 2))
  return note
}

try {
  const payload = JSON.parse(await readStdin())
  const root = findDirWith(payload.cwd ?? process.cwd(), '.faundr.json')
  if (root) {
    const notes = []
    // Passos do workflow padrão "Cada pedido" que o projeto desligou no painel.
    const on = (key) => !stepOff(root, key)
    if (on('prompt.feature') && featureIntent(payload.prompt)) notes.push(featureNudge(readState(root).status?.feature?.title ?? null))
    if (on('prompt.rule') && ruleIntent(payload.prompt)) notes.push(ruleNudge())
    // /faundr:x digitado não passa pela ferramenta Skill: os passos desligados dela chegam por aqui.
    const typed = String(payload.prompt ?? '').trim().match(/^\/(faundr:[\w-]+)/)
    if (typed) notes.push(skillStepsNote(root, typed[1]))
    // /nome de uma skill conectada (segurança, testes, qualidade, erros): o fim da resposta pede o registro do resultado.
    try {
      noteSkillRan(root, payload.session_id, typedSkill(payload.prompt))
      // Custo da IA: /nome de uma skill conhecida (não um comando do Claude Code, como /clear) marca o começo.
      const typedName = typedSkill(payload.prompt)
      if (typedName && readSkillIndex(root).some((s) => s.name === typedName)) markSkillStart(root, payload.session_id, typedName, payload.transcript_path)
    } catch {
      // Um aviso que falha não impede os outros (o hook nunca quebra o agente).
    }
    try {
      notes.push(workflowsOnce(root, payload.session_id, (list, ids) => workflowsForPrompt(list, payload.prompt, ids), 'This request'))
    } catch {
      // Um aviso que falha não impede os outros (o hook nunca quebra o agente).
    }
    try {
      if (on('prompt.skills')) notes.push(skillsOnce(root, payload.session_id, payload.prompt, process.argv[2] === 'codex' ? 'codex' : 'claude'))
    } catch {
      // Um aviso que falha não impede os outros (o hook nunca quebra o agente).
    }
    try {
      notes.push(relevantOnce(root, payload.session_id, payload.prompt))
    } catch {
      // Um aviso que falha não impede os outros (o hook nunca quebra o agente).
    }
    try {
      if (on('prompt.team')) notes.push(teamOnce(root, payload.session_id))
    } catch {
      // Um aviso que falha não impede os outros (o hook nunca quebra o agente).
    }
    try {
      notes.push(...takeInbox(root, payload.session_id))
    } catch {
      // Um aviso que falha não impede os outros (o hook nunca quebra o agente).
    }
    const additionalContext = notes.filter(Boolean).join('\n\n')
    if (additionalContext) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } }))
  }
} catch {
  // Regra de ouro dos hooks: qualquer erro sai em silêncio para não quebrar o agente.
}
