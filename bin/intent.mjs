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
      // Os mesmos pedidos em inglês.
      'creat(e|ing)',
      'add(ing)?',
      'build(ing)?',
      'develop\\w*',
      'make (a|an|some|this|that|these|those|the|it)',
      'set up',
      'start(ing)? (a|an|the|on|with|building|working)',
      'modify\\w*',
      'chang(e|ing) (the|how|it|this|that)',
      'integrat\\w*',
      'automat\\w*',
      'improv(e|ing)',
      'enhanc\\w*',
      'optimiz\\w*',
      'redesign\\w*',
      'rework\\w*',
      'migrat\\w*',
      'replac(e|ing)',
      'swap',
      'allow(ing)?',
      'let (users|people|me|the user)',
      '(has|have|needs?) to (be|have)',
      'should (be|have)',
      'is missing (a|an)',
      '(we|i) need (a|an|to)',
      'i (want|would like|d like) (to|a|an|you)',
      'let.?s (make|create|build|add|implement|design|start|begin|do|go)',
    ].join('|') +
    ')\\b',
)
// Peça nova do produto, ou a próxima parte de um trabalho.
const NEW_THING =
  /\b((nov[oa]s?|outr[oa]|proxim[oa]) (parte|passo|tela|pagina|funcao|funcionalidade|aba|integracao|botao|fluxo|relatorio|area|secao|rota|modulo|recurso|comando|etapa|fase|painel|cadastro|formulario)|(new|another|next) (part|step|screen|page|function|feature|tab|integration|button|flow|report|area|section|route|module|command|stage|phase|panel|dashboard|signup|form))\b/
// "fase 2", "etapa 3", "phase 2": seguir para a próxima parte do trabalho.
const NEXT_STEP = /\b(fase|etapa|phase|stage) \d/
// Conserto pontual: vira tarefa, não funcionalidade.
const FIX =
  /\b(corrig\w*|consert\w*|bug|erro|falh\w*|quebr\w*|nao (funciona|abre|carrega|aparece)|fix\w*|error\w*|fail\w*|broke\w*|crash\w*|(doesn.?t|does not|isn.?t|won.?t|can.?t) (work|open|load|show))\b/
// Pedido de rotina (commit, publicar, bilhete), mesmo com "faça": não é trabalho novo.
const ROUTINE = /\b(commit|push|publi\w*|deploy|handoff|bilhete|release)\b/
// Resumo que o Claude Code põe no lugar da conversa quando ela é compactada.
const CONTINUED = /^this session is being continued/
// Pergunta ou análise, sem pedir para construir.
const QUESTION = /^(quero saber|queria saber|qual|quais|como|por ?que|porque|onde|quando|quanto|o que|sera|explic\w*|me (explica|diz|fala)|veja|analis\w*|avali\w*|compar\w*|resum\w*|what|which|how|why|where|when|who|is|are|does|do|can|could|explain\w*|tell me|show me|analy[sz]\w*|evaluat\w*|summari[sz]\w*|i (want|d like) to know)\b/

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
    '[Faundr] This request looks like new multi-step work. Before you start:',
    '- If it is not (a question, a small tweak, a one-off fix), ignore this note.',
    current ? `- If it continues the current feature ("${current}"), just add the new steps: faundr task "<step>".` : null,
    '- If it is new: plan it with the faundr:planning skill before building (it sizes the request, looks at the project before asking, asks a few questions with a recommendation and shows a short summary for the owner to approve; a clear, small request needs no questions).',
    '- Record it before building: faundr feature "<short title>" --desc "<goal>" --done-when "<criterion>; <criterion>" and one faundr task "<step>" per step. With phases (MVP and later, X now and Y later), record each next stage right away: faundr feature "<stage>" --after current --desc "<what goes in>".',
  ]
    .filter(Boolean)
    .join('\n')
}

// ---- regra dita no chat ------------------------------------------------------------------------
// "a partir de agora…", "nunca apague…", "cuidado com…": o usuário está dando uma regra que deveria valer nas próximas
// sessões e para o time. Sem registrar, ela fica só nesta conversa (ou na memória local de quem está usando).

const RULE = new RegExp(
  [
    'a partir de agora',
    'daqui (pra|para) (frente|diante)',
    'de agora em diante',
    'toda vez que',
    '(sempre|nunca|jamais) (use|usar|usa|faca|fazer|coloque|colocar|deixe|deixar|mude|mudar|apague|apagar|delete|deletar|rode|rodar|publique|publicar|suba|subir|mexa|mexer|crie|criar|pergunte|perguntar|peca|pedir|mostre|mostrar|escreva|escrever|instale|instalar|commite|commitar|confie|esqueca|esquecer|remova|remover|altere|alterar|exponha|expor|guarde|guardar|grave|gravar|envie|enviar|aceite|aceitar|ignore|ignorar)',
    'nao (pode|podem|deve|devem) (usar|ter|mexer|apagar|deletar|mudar|alterar|subir|publicar|expor|ficar|aparecer|entrar)',
    '(e|eh) proibido',
    'cuidado,? (com|que|pra|para)',
    'nao (quero|aceito) (mais )?que (voce|o claude|ele|isso) (use|faca|mude|apague|mexa|coloque|rode|publique|crie|instale)',
    // As mesmas regras ditas em inglês.
    'from now on',
    'going forward',
    'from here on',
    'every time (you|we|that)',
    'whenever (you|we)',
    '(always|never) (use|do|put|leave|change|delete|remove|run|publish|push|deploy|touch|create|ask|show|write|install|commit|trust|forget|alter|expose|store|save|send|accept|ignore|edit|add)',
    '(don.?t|do not) ever',
    '(must|should) (not|never) (use|have|touch|delete|change|alter|push|publish|expose|show up|appear)',
    '(is|are) (forbidden|not allowed)',
    'be careful (with|about|that|to|not)',
    'watch out (for|with)',
    'i (don.?t|do not) want (you|claude|it|this) to (use|do|change|delete|touch|put|run|publish|create|install)',
  ]
    .map((p) => `\\b${p}\\b`)
    .join('|'),
)

/** 'rule' quando o pedido parece dar uma regra que deve continuar valendo; null quando não. */
export function ruleIntent(prompt) {
  const raw = String(prompt ?? '').trim()
  if (raw.length < 12 || /^[/!#<]/.test(raw)) return null
  const text = plain(raw.replace(/<pasted_content[\s\S]*?<\/pasted_content>/g, ' '))
  if (CONTINUED.test(text)) return null
  return RULE.test(text) ? 'rule' : null
}

export function ruleNudge() {
  return '[Faundr] The user seems to have given a rule meant to keep applying. If it is for future conversations and for the team (not just for now), record it: faundr rule "<short, affirmative rule>" --why "<reason>" (add --file "<folder or pattern>" if it applies to only part of the code; if it replaces an earlier one, --replaces "<part of its title>") and tell the user in one sentence that you recorded it. If it is just for this request, ignore this note.'
}
