// Língua do conteúdo do projeto: tudo o que o agente grava no Faundr sai numa língua só por projeto (escolhida no
// painel); a conversa com cada pessoa continua na língua dela. O texto vai só para o agente, então fica em inglês.
import { LANGS } from './i18n.mjs'

const NAMES = { en: 'English', pt: 'Portuguese' }

export const validContentLang = (value) => (LANGS.includes(value) ? value : null)

// Uma linha curta, a mesma no início da sessão e no começo de cada comando *-context.
export function contentLangLine(lang) {
  const name = NAMES[validContentLang(lang) ?? 'en']
  return `[Faundr] Faundr content language: ${name} — write everything you record in Faundr (features, tasks, decisions, rules, concerns, findings, handoff, Overview, Stack, Architecture, design.md) in ${name}, even when the user writes in another language. Reply to the user in their own language.`
}

// Orientação do início da sessão: a regra das línguas + o que não se traduz.
export function languageGuidance(lang) {
  return `${contentLangLine(lang)}\n[Faundr] Faundr's instructions and skills are written in English. Command names, flags and IDs stay as they are.`
}

/**
 * A língua que vale. Sem língua no projeto (nulo), grava a da pessoa uma vez pelo `save` — que só grava se ainda
 * estiver vazia e devolve a que ficou (outra pessoa pode ter gravado antes). Sem rede ou sem a coluna no banco,
 * vale a da pessoa nesta vez e tenta de novo depois.
 */
export async function ensureContentLang(projectLang, detected, save) {
  const known = validContentLang(projectLang)
  if (known) return { lang: known, saved: false }
  const fallback = validContentLang(detected) ?? 'en'
  try {
    const stored = validContentLang(await save(fallback))
    return { lang: stored ?? fallback, saved: !!stored }
  } catch {
    return { lang: fallback, saved: false }
  }
}
