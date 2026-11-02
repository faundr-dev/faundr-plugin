// Textos dos achados de qualidade no código: desempenho, falhas escondidas, tipos, complexidade,
// excesso e limpeza (parte de TEXT, em quality-texts.mjs), com os trechos que mudam por linguagem.
import { t } from './i18n.mjs'

// O que escreve no console em cada linguagem (Dart, PHP, Go, Java, Kotlin, C#, Rust e C/C++ marcam ctx.lang; Python marca ctx.py).
// Funções (e não tabelas prontas): a língua é decidida na hora, não quando o módulo carrega.
const LOG_CALLS = () => ({
  dart: 'print/debugPrint',
  php: t('echo, error_log or var_dump', 'echo, error_log ou var_dump'),
  go: t('log.Println or fmt.Println', 'log.Println ou fmt.Println'),
  java: t('System.out.println, printStackTrace or the logger', 'System.out.println, printStackTrace ou o logger'),
  kotlin: t('println, printStackTrace or the logger', 'println, printStackTrace ou o logger'),
  csharp: t('Console.WriteLine or the logger', 'Console.WriteLine ou o logger'),
  rust: t('eprintln!, println! or log', 'eprintln!, println! ou o log'),
  c: t('printf or fprintf(stderr)', 'printf ou fprintf(stderr)'),
  cpp: t('std::cerr, printf or the logger', 'std::cerr, printf ou o logger'),
})
const logCalls = (c) => LOG_CALLS()[c.lang] ?? 'console.log/console.error'
const DEBUG_STOP = { dart: 'debugger()', php: 'dd()', go: 'runtime.Breakpoint()', csharp: 'Debugger.Break()' }
// Linguagens de servidor: o print vai para a saída do programa, e o log tem nome próprio em cada uma.
const SERVER_LANGS = new Set(['go', 'java', 'kotlin', 'csharp', 'rust', 'c', 'cpp'])
const serverLog = (c) =>
  SERVER_LANGS.has(c.lang)
    ? {
        go: 'log/slog',
        java: t('a logger (SLF4J/Logback)', 'o logger (SLF4J/Logback)'),
        kotlin: t('a logger (SLF4J, or Log on Android)', 'o logger (SLF4J ou Log no Android)'),
        csharp: 'ILogger',
        rust: t('log or tracing', 'o log ou o tracing'),
        c: t("the program's log", 'o log do programa'),
        cpp: t('a logger (spdlog, for example)', 'o logger (spdlog, por exemplo)'),
      }[c.lang]
    : undefined
// No Go o "catch" é o if err != nil; no Rust, o braço Err(_) do match (ou o if let Err).
const isGo = (c) => c.lang === 'go'
const HANDLER = { go: 'if err != nil', rust: 'Err(_) =>' }
const handler = (c) => HANDLER[c.lang] ?? 'catch'
export const assertExample = (c) => {
  const expected = t('expected', 'esperado')
  const value = t('value', 'valor')
  return (
    {
      php: '$this->assertSame(...)',
      dart: `expect(${value}, equals(...))`,
      go: 'if got != want { t.Errorf(...) }',
      java: `assertEquals(${expected}, ${value})`,
      kotlin: `assertEquals(${expected}, ${value})`,
      csharp: `Assert.Equal(${expected}, ${value})`,
      rust: `assert_eq!(${value}, ${expected})`,
      c: `EXPECT_EQ(${value}, ${expected})`,
      cpp: t(`EXPECT_EQ(${value}, ${expected}) or REQUIRE(${value} == ${expected})`, `EXPECT_EQ(${value}, ${expected}) ou REQUIRE(${value} == ${expected})`),
    }[c.lang] ?? 'expect(...).toBe(...)'
  )
}
export const lineWord = () => t('line', 'linha')
const linesWord = () => t('lines', 'linhas')

// "O que é" do catch vazio, conforme a linguagem (Python, Go/Rust ou o catch de sempre).
const catchEmptyWhat = (c) => {
  if (c.py) return t('An except block only has pass: it does nothing with the error.', 'Um bloco except só tem pass: não faz nada com o erro.')
  if (HANDLER[c.lang]) return t(`A ${handler(c)} block is empty: the error is checked and then forgotten.`, `Um bloco ${handler(c)} está vazio: o erro é conferido e esquecido.`)
  return t('A catch block (or .catch) does nothing with the error.', 'Um bloco catch (ou .catch) não faz nada com o erro.')
}

// "O que é" do catch que devolve valor vazio, conforme a linguagem.
const catchNullWhat = (c) => {
  if (c.py) return t('The except returns None, [], {} or False without logging the error.', 'O except devolve None, [], {} ou False sem registrar o erro.')
  if (isGo(c)) {
    return t(
      'The if err != nil returns nil, zero or false and leaves err out: the caller gets "no error".',
      'O if err != nil devolve nil, zero ou false e deixa o err de fora: quem chamou recebe "sem erro".',
    )
  }
  if (c.lang === 'rust') {
    return t(
      'The Err(_) becomes None, false, zero or the default value: the caller gets a result without knowing there was an error.',
      'O Err(_) vira None, false, zero ou o valor padrão: quem chamou recebe um resultado sem saber que deu erro.',
    )
  }
  return t(
    `The catch returns ${c.lang ? 'null, false or an empty list' : 'null, undefined, [] or {}'} without logging the error.`,
    `O catch devolve ${c.lang ? 'null, false ou uma lista vazia' : 'null, undefined, [] ou {}'} sem registrar o erro.`,
  )
}

// Textos do print esquecido: PHP (vai para a página), linguagem de servidor (tem log próprio) ou app.
const printWhat = (c, call, log) => {
  if (c.lang === 'php') return t(`${c.call ?? 'var_dump()'} writes the variable straight onto the page.`, `${c.call ?? 'var_dump()'} escreve a variável direto na página.`)
  if (log) return t(`${call} writes straight to the program output, outside the entry point (main).`, `${call} escreve direto na saída do programa, fora do ponto de entrada (main).`)
  return t(`${call} writes to the app console.`, `${call} escreve no console do app.`)
}
const printWhy = (c, log) => {
  if (c.lang === 'php') return t('It shows internal data to people using the site and breaks the HTML or JSON of the response.', 'Mostra dados internos para quem usa o site e quebra o HTML ou o JSON da resposta.')
  if (log) return t('With no level or date, it gets lost in the server output and may leak data into the log.', 'Sem nível nem data, some no meio da saída do servidor e pode vazar dados no log.')
  return t(
    "Nobody sees it in the live app, but it may leak data into the device log and makes the app slower.",
    'No app publicado ninguém vê, mas pode vazar dados no log do aparelho e deixa o app mais lento.',
  )
}
const printFix = (c, log) => {
  if (c.lang === 'php') return t("Delete it. To record something, use the framework's log (Log::info in Laravel).", 'Apague. Para registrar algo, use o log do framework (Log::info no Laravel).')
  if (log) return t(`Delete the ones that were for testing. To record something for real, use ${log}.`, `Apague os que eram para teste. Para registrar algo de verdade, use ${log}.`)
  return t(
    'Delete the ones that were for testing. To record something for real, use the logging package or the error service.',
    'Apague os que eram para teste. Para registrar algo de verdade, use o pacote logging ou o serviço de erros.',
  )
}

// "O que é" da parada de depuração esquecida, conforme a linguagem.
const debuggerWhat = (c) => {
  if (c.py) return t(`${c.call ?? 'breakpoint()'} stops the program waiting for someone to type in the terminal.`, `${c.call ?? 'breakpoint()'} para o programa esperando alguém digitar no terminal.`)
  if (c.lang === 'php') {
    return t(
      `${c.call ?? 'dd()'} shows the variable and stops the request right away: people using the site see the debug screen.`,
      `${c.call ?? 'dd()'} mostra a variável e para o pedido na hora: quem usa o site vê a tela de depuração.`,
    )
  }
  if (c.lang === 'dart' || DEBUG_STOP[c.lang]) return t(`${DEBUG_STOP[c.lang]} stops the program when it runs with the debugger on.`, `${DEBUG_STOP[c.lang]} para o programa quando ele roda com o depurador ligado.`)
  return t('The debugger statement stops the code when DevTools is open.', 'A instrução debugger para o código quando o DevTools está aberto.')
}

export const TEXT_CODE = {
  'desempenho/consulta-sem-limite': (c, n, all) => {
    const tables = [...new Set(all.map((x) => x.table))].join(', ')
    return [
      n > 1 ? t(`${n} lists fetched with no limit`, `${n} listas buscadas sem limite`) : t(`List fetched with no limit (${c.table})`, `Lista buscada sem limite (${c.table})`),
      t(
        `The query brings every row of ${tables} at once, with no .limit/.range (or take in Prisma).`,
        `A consulta traz todas as linhas de ${tables} de uma vez, sem .limit/.range (ou take no Prisma).`,
      ),
      t(
        'With little data it is fast; as the app grows, the screen gets slow, the browser freezes and the database bill goes up (Supabase returns at most 1000 rows and the rest disappears without warning).',
        'Com poucos dados é rápido; quando o app cresce, a tela demora, o navegador trava e a conta do banco sobe (o Supabase devolve no máximo 1000 linhas e o resto some sem aviso).',
      ),
      t(
        'Paginate (.range(from, to) or .limit(n)) and show "load more"; to count, use count with head: true instead of fetching the rows.',
        'Pagine (.range(de, até) ou .limit(n)) e mostre "carregar mais"; para contar, use count com head: true em vez de trazer as linhas.',
      ),
    ]
  },
  'desempenho/consulta-em-laco': (c, n) => [
    n > 1 ? t(`${n} queries inside loops`, `${n} consultas dentro de laços`) : t('Query inside a loop', 'Consulta dentro de um laço'),
    t('A loop (for, forEach or map) makes one trip to the database or the network on every pass.', 'Um laço (for, forEach ou map) faz uma ida ao banco ou à rede a cada volta.'),
    t(
      'With 100 items that is 100 round trips: the screen or the route gets slow and can hit the server time limit.',
      'Com 100 itens são 100 idas e voltas: a tela ou a rota fica lenta e pode estourar o tempo limite do servidor.',
    ),
    t(
      'Fetch everything at once (.in("id", list) or a join) or write in a batch (insert/upsert with the list), and use the result inside the loop.',
      'Busque tudo de uma vez (.in("id", lista) ou um join) ou grave em lote (insert/upsert com a lista), e use o resultado dentro do laço.',
    ),
  ],
  'desempenho/fk-sem-indice': (c, n, all) => {
    const cols = all.map((x) => `${x.table}.${x.column}`).join(', ')
    return [
      n > 1 ? t(`${n} foreign keys without an index`, `${n} chaves estrangeiras sem índice`) : t(`Foreign key without an index (${c.table}.${c.column})`, `Chave estrangeira sem índice (${c.table}.${c.column})`),
      t(`Columns that point to another table, without an index: ${cols}.`, `Colunas que apontam para outra tabela, sem índice: ${cols}.`),
      t(
        'Searching by them, joining tables or deleting the row they point to makes the database read the whole table: it gets slow as the table grows.',
        'Buscar por elas, juntar tabelas ou apagar a linha apontada faz o banco ler a tabela inteira: fica lento quando a tabela cresce.',
      ),
      t(
        `Create the index in a new migration, for example: create index on public.${c.table} (${c.column});`,
        `Crie o índice numa migração nova, por exemplo: create index on public.${c.table} (${c.column});`,
      ),
    ]
  },
  'falha/catch-vazio': (c, n) => [
    t(
      `${n > 1 ? `${n} errors swallowed` : 'Error swallowed'} silently (${c.py ? 'except: pass' : `empty ${handler(c)}`})`,
      `${n > 1 ? `${n} erros engolidos` : 'Erro engolido'} em silêncio (${c.py ? 'except: pass' : `${handler(c)} vazio`})`,
    ),
    catchEmptyWhat(c),
    t(
      'When something fails here, nobody finds out: the app carries on as if it worked and the problem shows up later, far from the cause.',
      'Quando algo falha aqui, ninguém fica sabendo: o app segue como se tivesse dado certo e o problema aparece depois, longe da causa.',
    ),
    t(
      'Handle the error (tell the person, retry, log it) or, if ignoring it is on purpose, leave a comment inside the block saying why.',
      'Trate o erro (avise a pessoa, tente de novo, registre) ou, se ignorar for de propósito, deixe um comentário dentro do bloco dizendo por quê.',
    ),
  ],
  'falha/catch-so-loga': (c, n) => [
    n > 1 ? t(`${n} errors that only go to the console`, `${n} erros que só vão para o console`) : t('Error that only goes to the console', 'Erro que só vai para o console'),
    c.py
      ? t('The except only calls print() and the code moves on.', 'O except só chama print() e o código segue em frente.')
      : t(`The ${handler(c)} only calls ${logCalls(c)} and the code moves on.`, `O ${handler(c)} só chama ${logCalls(c)} e o código segue em frente.`),
    c.py || serverLog(c)
      ? t(
          "The message gets lost in the server output: whoever called gets a result as if it had worked.",
          'A mensagem some no meio da saída do servidor: quem chamou recebe um resultado como se tivesse dado certo.',
        )
      : t(
          'On the live site nobody looks at the console: the person sees a frozen screen or wrong data, with no warning.',
          'No site publicado ninguém olha o console: a pessoa vê a tela parada ou um dado errado, sem aviso.',
        ),
    t(
      'Show the person a message, return the error to the caller, or report it to an error service (Faundr receives it through the Sentry SDK).',
      'Mostre um aviso para a pessoa, devolva o erro para quem chamou, ou registre num serviço de erros (o Faundr recebe pelo SDK do Sentry).',
    ),
  ],
  'falha/catch-devolve-nulo': (c, n) => [
    n > 1 ? t(`${n} errors replaced by an empty value`, `${n} erros trocados por valor vazio`) : t('Error replaced by an empty value', 'Erro trocado por valor vazio'),
    catchNullWhat(c),
    t(
      'The caller cannot tell "there is no data" from "something failed": the screen shows empty when it actually failed.',
      'Quem chamou não consegue diferenciar "não tem dados" de "deu erro": a tela mostra vazio quando, na verdade, falhou.',
    ),
    t(
      'Log the error before returning the empty value, or return the error so the caller can decide.',
      'Registre o erro antes de devolver o valor vazio, ou devolva o erro para quem chamou decidir.',
    ),
  ],
  'falha/unwrap': (c, n) => [
    t(`${n} .unwrap() outside tests`, `${n} .unwrap() fora dos testes`),
    t(
      '.unwrap() takes the value out of a Result or Option and, if it is an error or empty, crashes the program (panic) right away.',
      '.unwrap() pega o valor de um Result ou Option e, se for erro ou vazio, derruba o programa (panic) na hora.',
    ),
    t(
      'A missing file, a network outage or unexpected data turns into a server or app crash, with no useful message.',
      'Um arquivo que falta, uma rede fora do ar ou um dado inesperado vira uma queda do servidor ou do app, sem mensagem útil.',
    ),
    t(
      'Use ? to return the error to the caller, handle it with match or unwrap_or, or switch to .expect("why this never fails") when it truly cannot fail.',
      'Use ? para devolver o erro a quem chamou, trate com match ou unwrap_or, ou troque por .expect("por que nunca falha") quando não poder falhar for verdade.',
    ),
  ],
  'falha/mock-em-producao': (c) => [
    t('Test data (mock) imported into real code', 'Dado de teste (mock) importado em código de verdade'),
    t(
      `The file imports ${c.from ?? 'a mock'}, which looks like fake data meant only for tests.`,
      `O arquivo importa ${c.from ?? 'um mock'}, que tem cara de dado falso usado só em teste.`,
    ),
    t('The live app may show made-up data or pretend something worked.', 'O app publicado pode mostrar dados inventados ou fingir que algo funcionou.'),
    t('Replace it with the real service or move the import to the test file.', 'Troque pelo serviço real ou mova o import para o arquivo de teste.'),
  ],
  'tipos/any': (c, n) => [
    t(`${n} use${n > 1 ? 's' : ''} of any`, `${n} uso${n > 1 ? 's' : ''} de any`),
    t('The any type turns off TypeScript checking for that value.', 'O tipo any desliga a checagem do TypeScript para aquele valor.'),
    t(
      'Typos and fields that do not exist slip through without warning and only show up when someone uses the app.',
      'Erros de digitação e campos que não existem passam sem aviso e só aparecem quando a pessoa usa o app.',
    ),
    t(
      'Describe the shape (type/interface), use unknown and check before using it, or use the type the library already exports.',
      'Descreva o formato (type/interface), use unknown e confira antes de usar, ou o tipo que a biblioteca já exporta.',
    ),
  ],
  'tipos/as-any': (c, n) => [
    t(`${n} forced conversion${n > 1 ? 's' : ''} to any (as any)`, `${n} ${n > 1 ? 'conversões forçadas' : 'conversão forçada'} para any (as any)`),
    t('"as any" tells TypeScript to stop complaining instead of fixing the type.', '"as any" manda o TypeScript parar de reclamar em vez de corrigir o tipo.'),
    t('It almost always hides a real error that TypeScript had found.', 'Quase sempre esconde um erro de verdade que o TypeScript tinha achado.'),
    t('Fix the type at the source; if the data comes from outside, check its shape before using it.', 'Corrija o tipo na origem; se o dado vem de fora, confira o formato antes de usar.'),
  ],
  'tipos/ts-ignore-sem-motivo': (c, n) => [
    t(`${n} ${c.directive ?? '@ts-ignore'} with no reason`, `${n} ${c.directive ?? '@ts-ignore'} sem motivo`),
    t('A comment turns off TypeScript checking on the next line without saying why.', 'Um comentário desliga a checagem do TypeScript na linha seguinte sem dizer por quê.'),
    t('Nobody knows if it is still needed; the hidden error may have become a bug.', 'Ninguém sabe se ainda é preciso; o erro escondido pode ter virado um bug.'),
    t(
      'Fix the type and delete the comment. If it really is needed, prefer @ts-expect-error with the reason on the same line.',
      'Corrija o tipo e apague o comentário. Se for mesmo preciso, prefira @ts-expect-error com o motivo na mesma linha.',
    ),
  ],
  'tipos/eslint-disable-sem-motivo': (c, n) => [
    t(`${n} eslint-disable with no reason`, `${n} eslint-disable sem motivo`),
    t('An ESLint rule was turned off with no explanation.', 'Uma regra do ESLint foi desligada sem explicação.'),
    t('The warning may have been a real problem; without a reason, nobody can review it later.', 'O aviso pode ter sido um problema real; sem motivo, ninguém consegue revisar depois.'),
    t(
      'Fix what ESLint pointed out, or write the reason: // eslint-disable-next-line rule -- why.',
      'Corrija o que o ESLint apontou, ou escreva o motivo: // eslint-disable-next-line regra -- porquê.',
    ),
  ],
  'tipos/non-null-em-excesso': (c) => [
    t(`${c.count} uses of "!" to say the value is never empty`, `${c.count} usos de "!" para dizer que o valor nunca é vazio`),
    t('The ! (non-null) operator claims a value exists without checking.', 'O operador ! (non-null) afirma que um valor existe sem conferir.'),
    t(
      'When the value really is empty (data that did not load, an optional field), the app breaks with "Cannot read properties of null".',
      'Quando o valor vem vazio de verdade (dado que não carregou, campo opcional), o app quebra com "Cannot read properties of null".',
    ),
    t('Check first (if, ?. or ??) wherever the value may be missing.', 'Confira antes (if, ?. ou ??) nos lugares em que o valor pode faltar.'),
  ],
  'complexidade/funcao': (c, n) => [
    n > 1 ? t(`${n} functions that are too complicated`, `${n} funções complicadas demais`) : t(`Function too complicated: ${c.name}`, `Função complicada demais: ${c.name}`),
    t(
      `Functions with many possible paths (if, loops, &&, ||, ternaries)${n > 1 ? '' : `: ${c.name} has ${c.complexity}`} (limit: 20).`,
      `Funções com muitos caminhos possíveis (if, laços, &&, ||, ternários)${n > 1 ? '' : `: ${c.name} tem ${c.complexity}`} (limite: 20).`,
    ),
    t(
      'Every path is one more way to go wrong. It gets hard to understand, test and change without breaking something else.',
      'Cada caminho é um jeito de dar errado. Fica difícil de entender, testar e mudar sem quebrar outra coisa.',
    ),
    t(
      'Split it into smaller functions with names that say what they do; replace chains of if with a table or early returns.',
      'Separe em funções menores com nomes que digam o que fazem; troque cadeias de if por uma tabela ou por retornos antecipados.',
    ),
  ],
  'complexidade/funcao-longa': (c, n) => [
    n > 1 ? t(`${n} functions that are too long`, `${n} funções longas demais`) : t(`Function too long: ${c.name}`, `Função longa demais: ${c.name}`),
    t(
      `Functions with more than 150 lines${n > 1 ? '' : `: ${c.name} has ${c.lines}`}.`,
      `Funções com mais de 150 linhas${n > 1 ? '' : `: ${c.name} tem ${c.lines}`}.`,
    ),
    t('A long function usually does several things at once and is hard to review.', 'Função longa costuma fazer várias coisas ao mesmo tempo e é difícil de revisar.'),
    t(
      'Split the parts (fetch data, decide, display) into smaller functions or components.',
      'Separe as partes (buscar dados, decidir, mostrar) em funções ou componentes menores.',
    ),
  ],
  'complexidade/aninhamento': (c, n) => [
    n > 1 ? t(`${n} spots with too many nested ifs/loops`, `${n} trechos com if/laços aninhados demais`) : t(`Code nested too deep in ${c.name}`, `Trecho aninhado demais em ${c.name}`),
    t(
      `Blocks (if, for, while, try, switch) inside one another${n > 1 ? '' : `, ${c.depth} levels`} (limit: 4).`,
      `Blocos (if, for, while, try, switch) uns dentro dos outros${n > 1 ? '' : `, ${c.depth} níveis`} (limite: 4).`,
    ),
    t('Staircase code is hard to follow: it is easy to forget which condition you are in.', 'Código em escada é difícil de seguir: é fácil esquecer em qual condição você está.'),
    t(
      'Use an early return (if (!x) return), move the core into a function, or combine conditions.',
      'Use retorno antecipado (if (!x) return), extraia o miolo para uma função, ou junte condições.',
    ),
  ],
  'complexidade/ternario-aninhado': (c, n) => [
    t(
      `${n} nested ternar${n > 1 ? 'ies' : 'y'} ${c.py ? '(a if x else b if y else c)' : '(a ? b : c ? d : e)'}`,
      `${n} ternário${n > 1 ? 's' : ''} aninhado${n > 1 ? 's' : ''} ${c.py ? '(a if x else b if y else c)' : '(a ? b : c ? d : e)'}`,
    ),
    c.py
      ? t('A "value if condition else other" inside another one.', 'Um "valor if condição else outro" dentro de outro.')
      : t('A "condition ? yes : no" inside another one.', 'Um "condição ? sim : não" dentro de outro.'),
    t('It is hard to read and to see which case ends up with which value.', 'É difícil de ler e de ver qual caso cai em qual valor.'),
    t('Use if/else, a switch, or an object that maps each case to its value.', 'Use if/else, um switch, ou um objeto que mapeia cada caso ao seu valor.'),
  ],
  'complexidade/arquivo-grande': (c) => [
    t(`Large file: ${c.lines} lines`, `Arquivo grande: ${c.lines} linhas`),
    t(`The file has ${c.lines} lines of code (limit: 600).`, `O arquivo tem ${c.lines} linhas de código (limite: 600).`),
    t(
      "A large file mixes different subjects; every change touches everything and clashes with other people's work.",
      'Arquivo grande junta assuntos diferentes; cada mudança mexe em tudo e conflita com o trabalho de outras pessoas.',
    ),
    t('Split it by subject (one file per screen, per feature or per kind of rule).', 'Separe por assunto (um arquivo por tela, por recurso ou por tipo de regra).'),
  ],
  'demais/dependencia-dispensavel': (c) => [
    t(`Package you can do without: ${c.pkg}`, `Pacote dispensável: ${c.pkg}`),
    t(`${c.pkg} does what ${c.native} already does (${c.where}).`, `${c.pkg} faz o que ${c.native} já faz (${c.where}).`),
    t(
      'Every package is more code to download, update and watch for security flaws.',
      'Cada pacote é mais código para baixar, atualizar e vigiar contra falhas de segurança.',
    ),
    t(`Replace it with ${c.native} and remove the package from package.json.`, `Troque por ${c.native} e remova o pacote do package.json.`),
  ],
  'demais/dependencia-sem-uso': (c, n) => [
    n > 1 ? t(`${n} packages no file uses`, `${n} pacotes que nenhum arquivo usa`) : t(`Package no file uses: ${c.pkg}`, `Pacote que nenhum arquivo usa: ${c.pkg}`),
    t(
      `It is in "dependencies" in package.json, but no file imports it: ${c.list}. Check before removing: it may be used by the configuration or from the command line.`,
      `Está em "dependencies" do package.json, mas nenhum arquivo importa: ${c.list}. Confira antes de remover: pode ser usado pela configuração ou pela linha de comando.`,
    ),
    t('An idle package makes the install bigger and adds to what must be watched for flaws.', 'Pacote parado aumenta a instalação e o que precisa ser vigiado contra falhas.'),
    t(
      'If it is not used, remove it with npm uninstall <package>. If it is only used during development, move it to devDependencies.',
      'Se não é usado, remova com npm uninstall <pacote>. Se é usado só no desenvolvimento, mova para devDependencies.',
    ),
  ],
  'demais/codigo-comentado': (c, n) => [
    n > 1 ? t(`${n} blocks of commented-out code`, `${n} blocos de código comentado`) : t('Block of commented-out code', 'Bloco de código comentado'),
    t(
      `Pieces of code turned off with ${c.py ? '#' : '//'} (the first one has ${c.lines} lines).`,
      `Trechos de código desligados com ${c.py ? '#' : '//'} (o primeiro tem ${c.lines} linhas).`,
    ),
    t(
      'Commented-out code goes stale: nobody knows if it still applies, and git already keeps the history.',
      'Código comentado envelhece: ninguém sabe se ainda vale, e o git já guarda o histórico.',
    ),
    t('Delete it. If you need it back, it is in the git history.', 'Apague. Se precisar de volta, está no histórico do git.'),
  ],
  'limpeza/console-log': (c, n) => [
    t(`${n} console.log left behind in screens`, `${n} console.log esquecido${n > 1 ? 's' : ''} em tela`),
    t('console.log or console.debug in a screen file.', 'console.log ou console.debug em arquivo de tela.'),
    t(
      "It clutters the console of people using the site and may show data that should not appear.",
      'Suja o console de quem usa o site e pode mostrar dados que não deveriam aparecer.',
    ),
    t(
      'Delete the ones that were for testing. For real errors, show a message on the screen or use the error service.',
      'Apague os que eram para teste. Para erros de verdade, use um aviso na tela ou o serviço de erros.',
    ),
  ],
  'limpeza/print-esquecido': (c, n) => {
    const call = c.call ?? 'print'
    const log = serverLog(c)
    return [
      t(`${n} ${call} left behind`, `${n} ${call} esquecido${n > 1 ? 's' : ''}`),
      printWhat(c, call, log),
      printWhy(c, log),
      printFix(c, log),
    ]
  },
  'limpeza/debugger': (c, n) => {
    const stop = c.py ? 'breakpoint()' : (DEBUG_STOP[c.lang] ?? 'debugger')
    return [
      t(`${n} ${stop} left behind`, `${n} ${stop} esquecido${n > 1 ? 's' : ''}`),
      debuggerWhat(c),
      c.py
        ? t('It is leftover debugging; on the server, the request hangs waiting.', 'É sobra de depuração; no servidor, o pedido fica travado esperando.')
        : t('It is leftover debugging; it should not go to the live site.', 'É sobra de depuração; não deveria ir para o site publicado.'),
      t('Delete the line.', 'Apague a linha.'),
    ]
  },
  'limpeza/todo-antigo': (c, n) => [
    t(`${n} TODO/FIXME older than 90 days`, `${n} TODO/FIXME com mais de 90 dias`),
    t(`"Do it later" notes that were left behind. The oldest is ${c.days} days old.`, `Anotações de "fazer depois" que ficaram para trás. A mais antiga tem ${c.days} dias.`),
    t('After 3 months, either the TODO no longer applies or it has become forgotten debt.', 'Depois de 3 meses, ou o TODO deixou de valer ou virou uma dívida esquecida.'),
    t('Do what it asks, delete it if it no longer applies, or record it as a task in Faundr.', 'Faça o que ele pede, apague se não vale mais, ou registre como tarefa no Faundr.'),
  ],
}
