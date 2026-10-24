#!/usr/bin/env node
// Hook PreToolUse da ferramenta Skill: quando o time marcou uma skill como "Só você no terminal" (painel → Workflows),
// o Claude não chama ela sozinho. Barra com o motivo e pede para ele lembrar a pessoa em uma linha. Quando a pessoa
// digita /nome no terminal, a skill roda direto, sem passar por aqui. Numa skill do Faundr que o projeto deixou com
// passos desligados, entrega o aviso de quais pular. Não usa a rede: lê as cópias locais das skills e dos interruptores.
//
// Regra de ouro dos hooks: nunca quebrar o agente. Qualquer erro → sai em silêncio.
import { blockedSkill, noteSkillRan } from './skills.mjs'
import { markSkillStart } from './ai-cost.mjs'
import { skillStepsNote } from './flows.mjs'
import { findDirWith, readStdin } from './paths.mjs'

try {
  const payload = JSON.parse(await readStdin())
  const root = findDirWith(payload.cwd ?? process.cwd(), '.faundr.json')
  const name = payload.tool_input?.skill ?? payload.tool_input?.name
  const s = root && name ? blockedSkill(root, name) : null
  if (s)
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `[Faundr] The team set /${s.name} to run only when the person calls it (dashboard → Workflows → Skills). Do not run it; say in one line "this looks like a job for /${s.name}, want to run it?" (in the user's language) and continue without it.`,
        },
      }),
    )
  else {
    // Skill conectada (segurança, testes, qualidade, erros): o fim da resposta pede o registro do resultado.
    if (root && name) noteSkillRan(root, payload.session_id, name)
    // Custo da IA: marca o começo para o fim da resposta medir quanto ela gastou.
    if (root && name) markSkillStart(root, payload.session_id, String(name).replace(/^\//, ''), payload.transcript_path)
    // Skill do Faundr com passos desligados neste projeto: o aviso chega junto com ela.
    const note = root && name ? skillStepsNote(root, name) : null
    if (note) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: note } }))
  }
} catch {
  // Regra de ouro dos hooks: qualquer erro sai em silêncio para não quebrar o agente.
}
