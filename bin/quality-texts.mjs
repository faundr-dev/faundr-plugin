// Textos dos achados de qualidade (título, o que é, por que importa, como resolver), separados de
// quality-rules.mjs para o arquivo das regras não crescer demais. Cada função recebe o contexto do achado (c),
// quantas vezes ele aparece no arquivo (n) e a lista de ocorrências (all).

export const TEXT = {
  'desempenho/consulta-sem-limite': (c, n, all) => [
    n > 1 ? `${n} listas buscadas sem limite` : `Lista buscada sem limite (${c.table})`,
    `A consulta traz todas as linhas de ${[...new Set(all.map((x) => x.table))].join(', ')} de uma vez, sem .limit/.range (ou take no Prisma).`,
    'Com poucos dados é rápido; quando o app cresce, a tela demora, o navegador trava e a conta do banco sobe (o Supabase devolve no máximo 1000 linhas e o resto some sem aviso).',
    'Pagine (.range(de, até) ou .limit(n)) e mostre "carregar mais"; para contar, use count com head: true em vez de trazer as linhas.',
  ],
  'desempenho/consulta-em-laco': (c, n) => [
    n > 1 ? `${n} consultas dentro de laços` : 'Consulta dentro de um laço',
    'Um laço (for, forEach ou map) faz uma ida ao banco ou à rede a cada volta.',
    'Com 100 itens são 100 idas e voltas: a tela ou a rota fica lenta e pode estourar o tempo limite do servidor.',
    'Busque tudo de uma vez (.in("id", lista) ou um join) ou grave em lote (insert/upsert com a lista), e use o resultado dentro do laço.',
  ],
  'desempenho/fk-sem-indice': (c, n, all) => [
    n > 1 ? `${n} chaves estrangeiras sem índice` : `Chave estrangeira sem índice (${c.table}.${c.column})`,
    `Colunas que apontam para outra tabela, sem índice: ${all.map((x) => `${x.table}.${x.column}`).join(', ')}.`,
    'Buscar por elas, juntar tabelas ou apagar a linha apontada faz o banco ler a tabela inteira: fica lento quando a tabela cresce.',
    `Crie o índice numa migração nova, por exemplo: create index on public.${c.table} (${c.column});`,
  ],
  'falha/catch-vazio': (c, n) => [
    n > 1 ? `${n} erros engolidos em silêncio (${c.py ? 'except: pass' : 'catch vazio'})` : `Erro engolido em silêncio (${c.py ? 'except: pass' : 'catch vazio'})`,
    c.py ? 'Um bloco except só tem pass: não faz nada com o erro.' : 'Um bloco catch (ou .catch) não faz nada com o erro.',
    'Quando algo falha aqui, ninguém fica sabendo: o app segue como se tivesse dado certo e o problema aparece depois, longe da causa.',
    'Trate o erro (avise a pessoa, tente de novo, registre) ou, se ignorar for de propósito, deixe um comentário dentro do bloco dizendo por quê.',
  ],
  'falha/catch-so-loga': (c, n) => [
    n > 1 ? `${n} erros que só vão para o console` : 'Erro que só vai para o console',
    c.py ? 'O except só chama print() e o código segue em frente.' : 'O catch só chama console.log/console.error e o código segue em frente.',
    c.py ? 'O print some no meio da saída do servidor: quem chamou recebe um resultado como se tivesse dado certo.' : 'No site publicado ninguém olha o console: a pessoa vê a tela parada ou um dado errado, sem aviso.',
    'Mostre um aviso para a pessoa, devolva o erro para quem chamou, ou registre num serviço de erros (o Faundr recebe pelo SDK do Sentry).',
  ],
  'falha/catch-devolve-nulo': (c, n) => [
    n > 1 ? `${n} erros trocados por valor vazio` : 'Erro trocado por valor vazio',
    c.py ? 'O except devolve None, [], {} ou False sem registrar o erro.' : 'O catch devolve null, undefined, [] ou {} sem registrar o erro.',
    'Quem chamou não consegue diferenciar "não tem dados" de "deu erro": a tela mostra vazio quando, na verdade, falhou.',
    'Registre o erro antes de devolver o valor vazio, ou devolva o erro para quem chamou decidir.',
  ],
  'falha/mock-em-producao': (c) => [
    'Dado de teste (mock) importado em código de verdade',
    `O arquivo importa ${c.from ?? 'um mock'}, que tem cara de dado falso usado só em teste.`,
    'O app publicado pode mostrar dados inventados ou fingir que algo funcionou.',
    'Troque pelo serviço real ou mova o import para o arquivo de teste.',
  ],
  'tipos/any': (c, n) => [
    `${n} uso${n > 1 ? 's' : ''} de any`,
    'O tipo any desliga a checagem do TypeScript para aquele valor.',
    'Erros de digitação e campos que não existem passam sem aviso e só aparecem quando a pessoa usa o app.',
    'Descreva o formato (type/interface), use unknown e confira antes de usar, ou o tipo que a biblioteca já exporta.',
  ],
  'tipos/as-any': (c, n) => [
    `${n} conversão${n > 1 ? 'ões' : ''} forçada${n > 1 ? 's' : ''} para any (as any)`,
    '"as any" manda o TypeScript parar de reclamar em vez de corrigir o tipo.',
    'Quase sempre esconde um erro de verdade que o TypeScript tinha achado.',
    'Corrija o tipo na origem; se o dado vem de fora, confira o formato antes de usar.',
  ],
  'tipos/ts-ignore-sem-motivo': (c, n) => [
    `${n} ${c.directive ?? '@ts-ignore'} sem motivo`,
    'Um comentário desliga a checagem do TypeScript na linha seguinte sem dizer por quê.',
    'Ninguém sabe se ainda é preciso; o erro escondido pode ter virado um bug.',
    'Corrija o tipo e apague o comentário. Se for mesmo preciso, prefira @ts-expect-error com o motivo na mesma linha.',
  ],
  'tipos/eslint-disable-sem-motivo': (c, n) => [
    `${n} eslint-disable sem motivo`,
    'Uma regra do ESLint foi desligada sem explicação.',
    'O aviso pode ter sido um problema real; sem motivo, ninguém consegue revisar depois.',
    'Corrija o que o ESLint apontou, ou escreva o motivo: // eslint-disable-next-line regra -- porquê.',
  ],
  'tipos/non-null-em-excesso': (c) => [
    `${c.count} usos de "!" para dizer que o valor nunca é vazio`,
    'O operador ! (non-null) afirma que um valor existe sem conferir.',
    'Quando o valor vem vazio de verdade (dado que não carregou, campo opcional), o app quebra com "Cannot read properties of null".',
    'Confira antes (if, ?. ou ??) nos lugares em que o valor pode faltar.',
  ],
  'complexidade/funcao': (c, n) => [
    n > 1 ? `${n} funções complicadas demais` : `Função complicada demais: ${c.name}`,
    `Funções com muitos caminhos possíveis (if, laços, &&, ||, ternários)${n > 1 ? '' : `: ${c.name} tem ${c.complexity}`} (limite: 20).`,
    'Cada caminho é um jeito de dar errado. Fica difícil de entender, testar e mudar sem quebrar outra coisa.',
    'Separe em funções menores com nomes que digam o que fazem; troque cadeias de if por uma tabela ou por retornos antecipados.',
  ],
  'complexidade/funcao-longa': (c, n) => [
    n > 1 ? `${n} funções longas demais` : `Função longa demais: ${c.name}`,
    `Funções com mais de 150 linhas${n > 1 ? '' : `: ${c.name} tem ${c.lines}`}.`,
    'Função longa costuma fazer várias coisas ao mesmo tempo e é difícil de revisar.',
    'Separe as partes (buscar dados, decidir, mostrar) em funções ou componentes menores.',
  ],
  'complexidade/aninhamento': (c, n) => [
    n > 1 ? `${n} trechos com if/laços aninhados demais` : `Trecho aninhado demais em ${c.name}`,
    `Blocos (if, for, while, try, switch) uns dentro dos outros${n > 1 ? '' : `, ${c.depth} níveis`} (limite: 4).`,
    'Código em escada é difícil de seguir: é fácil esquecer em qual condição você está.',
    'Use retorno antecipado (if (!x) return), extraia o miolo para uma função, ou junte condições.',
  ],
  'complexidade/ternario-aninhado': (c, n) => [
    `${n} ternário${n > 1 ? 's' : ''} aninhado${n > 1 ? 's' : ''} ${c.py ? '(a if x else b if y else c)' : '(a ? b : c ? d : e)'}`,
    c.py ? 'Um "valor if condição else outro" dentro de outro.' : 'Um "condição ? sim : não" dentro de outro.',
    'É difícil de ler e de ver qual caso cai em qual valor.',
    'Use if/else, um switch, ou um objeto que mapeia cada caso ao seu valor.',
  ],
  'complexidade/arquivo-grande': (c) => [
    `Arquivo grande: ${c.lines} linhas`,
    `O arquivo tem ${c.lines} linhas de código (limite: 600).`,
    'Arquivo grande junta assuntos diferentes; cada mudança mexe em tudo e conflita com o trabalho de outras pessoas.',
    'Separe por assunto (um arquivo por tela, por recurso ou por tipo de regra).',
  ],
  'demais/dependencia-dispensavel': (c) => [
    `Pacote dispensável: ${c.pkg}`,
    `${c.pkg} faz o que ${c.native} já faz (${c.where}).`,
    'Cada pacote é mais código para baixar, atualizar e vigiar contra falhas de segurança.',
    `Troque por ${c.native} e remova o pacote do package.json.`,
  ],
  'demais/dependencia-sem-uso': (c, n) => [
    n > 1 ? `${n} pacotes que nenhum arquivo usa` : `Pacote que nenhum arquivo usa: ${c.pkg}`,
    `Está em "dependencies" do package.json, mas nenhum arquivo importa: ${c.list}. Confira antes de remover: pode ser usado pela configuração ou pela linha de comando.`,
    'Pacote parado aumenta a instalação e o que precisa ser vigiado contra falhas.',
    'Se não é usado, remova com npm uninstall <pacote>. Se é usado só no desenvolvimento, mova para devDependencies.',
  ],
  'demais/codigo-comentado': (c, n) => [
    n > 1 ? `${n} blocos de código comentado` : 'Bloco de código comentado',
    `Trechos de código desligados com // (o primeiro tem ${c.lines} linhas).`,
    'Código comentado envelhece: ninguém sabe se ainda vale, e o git já guarda o histórico.',
    'Apague. Se precisar de volta, está no histórico do git.',
  ],
  'limpeza/console-log': (c, n) => [
    `${n} console.log esquecido${n > 1 ? 's' : ''} em tela`,
    'console.log ou console.debug em arquivo de tela.',
    'Suja o console de quem usa o site e pode mostrar dados que não deveriam aparecer.',
    'Apague os que eram para teste. Para erros de verdade, use um aviso na tela ou o serviço de erros.',
  ],
  'limpeza/debugger': (c, n) => [
    `${n} ${c.py ? 'breakpoint()' : 'debugger'} esquecido${n > 1 ? 's' : ''}`,
    c.py ? `${c.call ?? 'breakpoint()'} para o programa esperando alguém digitar no terminal.` : 'A instrução debugger para o código quando o DevTools está aberto.',
    c.py ? 'É sobra de depuração; no servidor, o pedido fica travado esperando.' : 'É sobra de depuração; não deveria ir para o site publicado.',
    'Apague a linha.',
  ],
  'limpeza/todo-antigo': (c, n) => [
    `${n} TODO/FIXME com mais de 90 dias`,
    `Anotações de "fazer depois" que ficaram para trás. A mais antiga tem ${c.days} dias.`,
    'Depois de 3 meses, ou o TODO deixou de valer ou virou uma dívida esquecida.',
    'Faça o que ele pede, apague se não vale mais, ou registre como tarefa no Faundr.',
  ],
  'testes/only': (c, n) => [
    `${n} teste${n > 1 ? 's' : ''} com .only`,
    `${c.call} faz rodar só esse teste e pula todos os outros do arquivo.`,
    'Os outros testes param de rodar sem ninguém perceber, e um erro passa batido.',
    'Tire o .only (é sobra de depuração).',
  ],
  'testes/pulado': (c, n) => [
    `${n} teste${n > 1 ? 's' : ''} pulado${n > 1 ? 's' : ''}`,
    `Testes desligados com ${c.call} (skip, todo, xit).`,
    'Teste pulado não protege nada; costuma ser um teste que quebrou e foi deixado de lado.',
    'Conserte e religue, ou apague se o comportamento não existe mais.',
  ],
  'testes/sem-conferencia': (c, n, all) => [
    n > 1 ? `${n} testes que não conferem nada` : `Teste que não confere nada: ${c.name}`,
    `Testes sem expect/assert: rodam o código mas nunca checam o resultado, então passam sempre. ${(all ?? [c]).slice(0, 6).map((x) => `"${x.name}" (linha ${x.line})`).join(', ')}. Confira se a conferência não está numa função auxiliar.`,
    'Teste que passa sempre dá falsa segurança: o código pode estar errado e ninguém fica sabendo.',
    'Acrescente a conferência do resultado esperado (expect(...).toBe(...)), com o valor escrito à mão, não calculado como o código calcula.',
  ],
  'testes/espera-fixa': (c, n) => [
    `${n} espera${n > 1 ? 's' : ''} com tempo fixo no teste`,
    `O teste espera um tempo fixo (${c.call}) em vez de esperar a coisa acontecer.`,
    'É a principal causa de teste instável: num computador mais lento a espera não basta, num mais rápido ela desperdiça tempo.',
    'Espere pelo resultado: no Playwright, expect(locator).toBeVisible() já espera sozinho; no Vitest, use vi.useFakeTimers() e avance o relógio.',
  ],
  'testes/hora-real': () => [
    'Teste que depende da data e hora reais',
    'O arquivo usa new Date() ou Date.now() sem relógio falso (vi.useFakeTimers, jest.useFakeTimers, setSystemTime, page.clock).',
    'O resultado muda conforme o dia e a hora em que roda: passa hoje e falha no fim do mês, à meia-noite ou em outro fuso.',
    'Fixe a data no teste: vi.useFakeTimers() + vi.setSystemTime(new Date("2026-01-15T10:00:00Z")), ou passe a data como parâmetro.',
  ],
  'instrucoes/arquivo-inexistente': (c, n) => [
    n > 1 ? `${c.doc} cita ${n} arquivos que não existem` : `${c.doc} cita um arquivo que não existe`,
    `As instruções para a IA citam: ${c.list}.`,
    'A IA lê esse arquivo em toda conversa e vai procurar (ou criar) coisas no lugar errado.',
    'Atualize os caminhos ou apague as linhas que não valem mais.',
  ],
  'instrucoes/script-inexistente': (c, n) => [
    n > 1 ? `${c.doc} manda rodar ${n} scripts que não existem` : `${c.doc} manda rodar um script que não existe`,
    `Comandos citados que não estão em "scripts" do package.json: ${c.list}.`,
    'A IA vai tentar rodar o comando, falhar e perder tempo descobrindo o certo.',
    'Corrija o nome do script nas instruções ou crie o script no package.json.',
  ],
  'limpeza/atalho-sem-prazo': (c, n, all) => [
    `${n} atalho${n > 1 ? 's' : ''} sem dizer quando melhorar`,
    `Comentários // faundr: que registram uma simplificação, mas sem o gatilho para rever: ${(all ?? [c]).slice(0, 6).map((x) => `linha ${x.line}: "${x.text}"`).join('; ')}.`,
    'Atalho sem prazo vira dívida esquecida: ninguém sabe quando ele deixa de servir.',
    'Complete no formato // faundr: <o limite>, <quando melhorar> (ex.: "// faundr: busca tudo de uma vez, paginar quando passar de 500 itens").',
  ],
  'morto/arquivo-orfao': () => [
    'Arquivo que ninguém usa',
    'Nenhum outro arquivo importa este, e o nome dele não aparece em nenhum outro lugar do projeto. Confira antes de apagar: pode ser chamado de um jeito que a checagem não enxerga.',
    'Arquivo parado confunde quem lê (e a IA): parece fazer parte do app, mas não faz.',
    'Se não é usado, apague (o git guarda o histórico). Se é chamado por fora (script, configuração), marque com // faundr-ignore-file morto/arquivo-orfao: motivo.',
  ],
  'morto/export-sem-uso': (c, n, all) => [
    n > 1 ? `${n} coisas exportadas que ninguém usa` : `Exportado e nunca usado: ${c.name}`,
    `Funções, componentes ou constantes exportados que nenhum outro arquivo importa, nem o próprio arquivo usa: ${(all ?? [c]).map((x) => `${x.name} (linha ${x.line})`).slice(0, 15).join(', ')}.`,
    'Código morto continua sendo lido, mantido e atualizado sem servir para nada.',
    'Apague o que não serve mais. Se é usado de um jeito que a checagem não enxerga, marque com // faundr-ignore morto/export-sem-uso: motivo.',
  ],
  'demais/duplicado': (c, n, all) => [
    n > 1 ? `${n} trechos repetidos de outros arquivos` : `Trecho repetido de ${c.other}`,
    `Blocos de 8 ou mais linhas iguais em outro lugar: ${(all ?? [c]).slice(0, 8).map((x) => `linhas ${x.line}–${x.to} iguais a ${x.other}:${x.otherLine}`).join('; ')}.`,
    'Código copiado precisa ser corrigido em todos os lugares; quando alguém esquece um, o mesmo erro volta.',
    'Junte numa função ou componente só e use nos dois lugares.',
  ],
  'ts/erro-de-tipo': (c, n, all) => [
    `${n} erro${n > 1 ? 's' : ''} de tipo do TypeScript`,
    `O tsc do próprio projeto acusa: ${(all ?? [c]).slice(0, 6).map((x) => `linha ${x.line ?? '?'}: ${x.message} (${x.code})`).join('; ')}.`,
    'Erro de tipo costuma ser um bug de verdade (campo que não existe, valor que pode faltar) e pode quebrar o build.',
    'Corrija cada erro na origem, sem any nem @ts-ignore.',
  ],
  'eslint/erro': (c, n, all) => [
    `${n} erro${n > 1 ? 's' : ''} do ESLint`,
    `O ESLint do projeto acusa: ${(all ?? [c]).slice(0, 6).map((x) => `linha ${x.line ?? '?'}: ${x.message} (${x.rule})`).join('; ')}.`,
    'São as regras que o próprio projeto escolheu seguir.',
    'Corrija ou, se a regra não vale ali, desligue com eslint-disable-next-line regra -- motivo.',
  ],
  'eslint/aviso': (c, n, all) => [
    `${n} aviso${n > 1 ? 's' : ''} do ESLint`,
    `O ESLint do projeto avisa: ${(all ?? [c]).slice(0, 6).map((x) => `linha ${x.line ?? '?'}: ${x.message} (${x.rule})`).join('; ')}.`,
    'Avisos acumulados escondem os que importam.',
    'Corrija aos poucos ou ajuste a configuração do ESLint se a regra não serve ao projeto.',
  ],
}

/** Textos das regras da casa (.faundr-regras) e das regras da memória com padrão proibido. */
export function houseText(c, n) {
  if (c.memory)
    return [
      `Regra do time contrariada: ${c.name}${n > 1 ? ` (${n} lugares)` : ''}`,
      `O código tem o que a regra registrada no Faundr proíbe (padrão: ${c.pattern}).`,
      c.message || 'O time registrou esta regra para o projeto.',
      'Ajuste o código para seguir a regra. Se ela não vale mais, mude ou apague a regra no painel (Memória) em vez de ignorar.',
    ]
  return [
    `Regra da casa: ${c.name}${n > 1 ? ` (${n} lugares)` : ''}`,
    `O código bate com uma regra escrita pelo time em ${c.file}.`,
    c.message || 'O time decidiu que isto não deve aparecer no código.',
    'Siga o que a regra pede. Se a regra não vale mais, edite ou apague o arquivo dela.',
  ]
}
