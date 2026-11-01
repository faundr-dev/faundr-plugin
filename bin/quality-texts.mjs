// Textos dos achados de qualidade (título, o que é, por que importa, como resolver), separados de
// quality-rules.mjs para o arquivo das regras não crescer demais. Cada função recebe o contexto do achado (c),
// quantas vezes ele aparece no arquivo (n) e a lista de ocorrências (all).
// Os textos vão para o painel: t(inglês, português), escolhido na hora de montar o achado.
import { t } from './i18n.mjs'
import { lineWord, TEXT_CODE } from './quality-texts-code.mjs'
import { TEXT_PROJECT } from './quality-texts-project.mjs'

export const TEXT = { ...TEXT_CODE, ...TEXT_PROJECT }

/** "Linhas: 3, 8, 12." no fim do detalhe (até 12 linhas). */
export const lineList = (lines) => (lines.length ? ` ${t('Lines', 'Linhas')}: ${lines.slice(0, 12).join(', ')}${lines.length > 12 ? '…' : ''}.` : '')

/** "Funções: a (30, linha 4); b (22, linha 9)." no fim do detalhe da complexidade. */
export const functionList = (items, measure) =>
  ` ${t('Functions', 'Funções')}: ${items.map((x) => `${x.name} (${x[measure]}, ${lineWord()} ${x.line})`).join('; ')}.`

/** Textos das regras da casa (.faundr-regras) e das regras da memória com padrão proibido. */
export function houseText(c, n) {
  const places = n > 1 ? t(` (${n} places)`, ` (${n} lugares)`) : ''
  if (c.memory)
    return [
      t(`Team rule broken: ${c.name}${places}`, `Regra do time contrariada: ${c.name}${places}`),
      t(
        `The code has what the rule recorded in Faundr forbids (pattern: ${c.pattern}).`,
        `O código tem o que a regra registrada no Faundr proíbe (padrão: ${c.pattern}).`,
      ),
      c.message || t('The team recorded this rule for the project.', 'O time registrou esta regra para o projeto.'),
      t(
        'Adjust the code to follow the rule. If it no longer applies, change or delete the rule in the dashboard (Memory) instead of ignoring it.',
        'Ajuste o código para seguir a regra. Se ela não vale mais, mude ou apague a regra no painel (Memória) em vez de ignorar.',
      ),
    ]
  return [
    t(`House rule: ${c.name}${places}`, `Regra da casa: ${c.name}${places}`),
    t(`The code matches a rule written by the team in ${c.file}.`, `O código bate com uma regra escrita pelo time em ${c.file}.`),
    c.message || t('The team decided this should not appear in the code.', 'O time decidiu que isto não deve aparecer no código.'),
    t(
      'Do what the rule asks. If the rule no longer applies, edit or delete its file.',
      'Siga o que a regra pede. Se a regra não vale mais, edite ou apague o arquivo dela.',
    ),
  ]
}
