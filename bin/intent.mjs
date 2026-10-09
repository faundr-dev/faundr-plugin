// O pedido parece trabalho novo de vários passos (funcionalidade, melhoria grande)? Sem IA e sem rede: roda a cada
// pergunta, antes de o agente começar, para ele registrar a funcionalidade (e perguntar o escopo se o pedido for vago).
// Na dúvida, avisa: o aviso diz ao agente para ignorá-lo quando não for o caso.

const plain = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Pedir para construir ou mudar algo.
const BUILD = new RegExp(
  '\\b(' +
    [
      'cri(a|ar|e|em)',
      'adicion\\w*',
      'acrescent\\w*',
      'implement\\w*',
      'constru\\w*',
      'desenvolv\\w*',
      '(faz|faca|fazer) (um|uma|umas|uns|essa|esse|essas|esses|as|os)',
      'replic\\w*',
      'partir (para|pra)',
      'mont(a|ar|e)',
      'comec(a|ar|e|em|ando)',
      'inici(a|ar|e)',
      'modific\\w*',
      'edit(a|ar|e)',
      'integr(a|ar|e)',
      'automatiz\\w*',
      'melhor(a|ar|e)',
      'aprimor\\w*',
      'otimiz\\w*',
      'refator\\w*',
      'reformul\\w*',
      'redesenh\\w*',
      'transform\\w*',
      'migr(a|ar|e)',
      'substitu\\w*',
      'troc(a|ar)',
      'permit(a|ir)',
      'tem que (ser|ter)',
      'precisa (ter|ser)',
      'falta (um|uma)',
      'quero (que|um|uma|ter|poder|criar|fazer)',
      'preciso (de um|de uma|que|criar|fazer)',
      'gostaria (de|que)',
      'vamos (fazer|criar|construir|montar|adicionar|implementar|para|pra|dar|desenhar|iniciar|comecar)',
    ].join('|') +
    ')\\b',
)
// Peça nova do produto, ou a próxima parte de um trabalho.
const NEW_THING =
  /\b(nov[oa]s?|outr[oa]|proxim[oa]) (parte|passo|tela|pagina|funcao|funcionalidade|aba|integracao|botao|fluxo|relatorio|area|secao|rota|modulo|recurso|comando|etapa|fase|painel|cadastro|formulario)\b/
// "fase 2", "etapa 3": seguir para a próxima parte do trabalho.
const NEXT_STEP = /\b(fase|etapa) \d/
// Conserto pontual: vira tarefa, não funcionalidade.
const FIX = /\b(corrig\w*|consert\w*|bug|erro|falh\w*|quebr\w*|nao (funciona|abre|carrega|aparece))\b/
// Pedido de rotina (commit, publicar, bilhete), mesmo com "faça": não é trabalho novo.
const ROUTINE = /\b(commit|push|publi\w*|deploy|handoff|bilhete)\b/
// Resumo que o Claude Code põe no lugar da conversa quando ela é compactada.
const CONTINUED = /^this session is being continued/
// Pergunta ou análise, sem pedir para construir.
const QUESTION = /^(quero saber|queria saber|qual|quais|como|por ?que|porque|onde|quando|quanto|o que|sera|explic\w*|me (explica|diz|fala)|veja|analis\w*|avali\w*|compar\w*|resum\w*)\b/

/** 'feature' quando o pedido parece trabalho novo de vários passos; null quando não. */
export function featureIntent(prompt) {
  const raw = String(prompt ?? '').trim()
  if (raw.length < 20 || /^[/!#<]/.test(raw)) return null
  const text = plain(raw)
  if (CONTINUED.test(text) || (ROUTINE.test(text) && text.length < 160)) return null
  const build = BUILD.test(text)
  const fresh = NEW_THING.test(text) || NEXT_STEP.test(text)
  if (!build && !fresh) return null
  if (FIX.test(text) && !fresh) return null
  if (QUESTION.test(text) && !fresh && raw.endsWith('?')) return null
  return 'feature'
}

/** O aviso para o agente (curto: entra só nos pedidos que batem). */
export function featureNudge(current) {
  return [
    '[Faundr] Este pedido parece trabalho novo de vários passos. Antes de começar:',
    '- Se não for (pergunta, ajuste pequeno, correção pontual), ignore este aviso.',
    current ? `- Se for continuação da funcionalidade atual ("${current}"), só adicione os passos novos: faundr task "<passo>".` : null,
    '- Se for nova: com o pedido vago (não diz para quem é, o que fica de fora ou como saber que ficou pronto), faça 2 a 3 perguntas curtas numa rodada só, com a ferramenta de perguntas (opções concretas, a recomendada primeiro); com o pedido claro, não pergunte.',
    '- Registre antes de construir: faundr feature "<título curto>" --desc "<objetivo>" --done-when "<critério>; <critério>" e um faundr task "<passo>" por passo. Com fases (MVP e depois, agora X e depois Y), registre já cada etapa seguinte: faundr feature "<etapa>" --after atual --desc "<o que entra>".',
  ]
    .filter(Boolean)
    .join('\n')
}
