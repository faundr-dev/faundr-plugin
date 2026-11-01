// Textos dos achados de qualidade de testes, instruções, Docker, CSS, código morto, duplicado,
// TypeScript e ESLint (parte de TEXT, em quality-texts.mjs).
import { t } from './i18n.mjs'
import { assertExample, lineWord } from './quality-texts-code.mjs'

export const TEXT_PROJECT = {
  'testes/only': (c, n) => [
    t(`${n} test${n > 1 ? 's' : ''} with .only`, `${n} teste${n > 1 ? 's' : ''} com .only`),
    t(`${c.call} runs only that test and skips all the others in the file.`, `${c.call} faz rodar só esse teste e pula todos os outros do arquivo.`),
    t('The other tests stop running without anyone noticing, and a bug slips through.', 'Os outros testes param de rodar sem ninguém perceber, e um erro passa batido.'),
    t('Remove the .only (it is leftover debugging).', 'Tire o .only (é sobra de depuração).'),
  ],
  'testes/pulado': (c, n) => [
    t(`${n} skipped test${n > 1 ? 's' : ''}`, `${n} teste${n > 1 ? 's' : ''} pulado${n > 1 ? 's' : ''}`),
    t(`Tests turned off with ${c.call} (skip, todo, xit).`, `Testes desligados com ${c.call} (skip, todo, xit).`),
    t(
      'A skipped test protects nothing; it is usually a test that broke and was set aside.',
      'Teste pulado não protege nada; costuma ser um teste que quebrou e foi deixado de lado.',
    ),
    t('Fix it and turn it back on, or delete it if the behavior no longer exists.', 'Conserte e religue, ou apague se o comportamento não existe mais.'),
  ],
  'testes/sem-conferencia': (c, n, all) => {
    const list = (all ?? [c]).slice(0, 6).map((x) => `"${x.name}" (${lineWord()} ${x.line})`).join(', ')
    return [
      n > 1 ? t(`${n} tests that check nothing`, `${n} testes que não conferem nada`) : t(`Test that checks nothing: ${c.name}`, `Teste que não confere nada: ${c.name}`),
      t(
        `Tests with no expect/assert: they run the code but never check the result, so they always pass. ${list}. Check that the assertion is not inside a helper function.`,
        `Testes sem expect/assert: rodam o código mas nunca checam o resultado, então passam sempre. ${list}. Confira se a conferência não está numa função auxiliar.`,
      ),
      t(
        'A test that always passes gives false confidence: the code may be wrong and nobody finds out.',
        'Teste que passa sempre dá falsa segurança: o código pode estar errado e ninguém fica sabendo.',
      ),
      t(
        `Add a check of the expected result (${assertExample(c)}), with the value written by hand, not computed the way the code computes it.`,
        `Acrescente a conferência do resultado esperado (${assertExample(c)}), com o valor escrito à mão, não calculado como o código calcula.`,
      ),
    ]
  },
  'testes/espera-fixa': (c, n) => [
    t(`${n} fixed-time wait${n > 1 ? 's' : ''} in the test`, `${n} espera${n > 1 ? 's' : ''} com tempo fixo no teste`),
    t(`The test waits a fixed time (${c.call}) instead of waiting for the thing to happen.`, `O teste espera um tempo fixo (${c.call}) em vez de esperar a coisa acontecer.`),
    t(
      'It is the main cause of flaky tests: on a slower computer the wait is not enough, on a faster one it wastes time.',
      'É a principal causa de teste instável: num computador mais lento a espera não basta, num mais rápido ela desperdiça tempo.',
    ),
    t(
      'Wait for the result: in Playwright, expect(locator).toBeVisible() already waits on its own; in Vitest, use vi.useFakeTimers() and move the clock forward.',
      'Espere pelo resultado: no Playwright, expect(locator).toBeVisible() já espera sozinho; no Vitest, use vi.useFakeTimers() e avance o relógio.',
    ),
  ],
  'testes/hora-real': () => [
    t('Test that depends on the real date and time', 'Teste que depende da data e hora reais'),
    t(
      'The file uses new Date() or Date.now() without a fake clock (vi.useFakeTimers, jest.useFakeTimers, setSystemTime, page.clock).',
      'O arquivo usa new Date() ou Date.now() sem relógio falso (vi.useFakeTimers, jest.useFakeTimers, setSystemTime, page.clock).',
    ),
    t(
      'The result changes with the day and time it runs: it passes today and fails at the end of the month, at midnight or in another time zone.',
      'O resultado muda conforme o dia e a hora em que roda: passa hoje e falha no fim do mês, à meia-noite ou em outro fuso.',
    ),
    t(
      'Pin the date in the test: vi.useFakeTimers() + vi.setSystemTime(new Date("2026-01-15T10:00:00Z")), or pass the date as a parameter.',
      'Fixe a data no teste: vi.useFakeTimers() + vi.setSystemTime(new Date("2026-01-15T10:00:00Z")), ou passe a data como parâmetro.',
    ),
  ],
  'instrucoes/arquivo-inexistente': (c, n) => [
    n > 1 ? t(`${c.doc} mentions ${n} files that do not exist`, `${c.doc} cita ${n} arquivos que não existem`) : t(`${c.doc} mentions a file that does not exist`, `${c.doc} cita um arquivo que não existe`),
    t(`The instructions for the AI mention: ${c.list}.`, `As instruções para a IA citam: ${c.list}.`),
    t(
      'The AI reads this file in every conversation and will look for (or create) things in the wrong place.',
      'A IA lê esse arquivo em toda conversa e vai procurar (ou criar) coisas no lugar errado.',
    ),
    t('Update the paths or delete the lines that no longer apply.', 'Atualize os caminhos ou apague as linhas que não valem mais.'),
  ],
  'instrucoes/script-inexistente': (c, n) => [
    n > 1
      ? t(`${c.doc} says to run ${n} scripts that do not exist`, `${c.doc} manda rodar ${n} scripts que não existem`)
      : t(`${c.doc} says to run a script that does not exist`, `${c.doc} manda rodar um script que não existe`),
    t(`Commands mentioned that are not in "scripts" in package.json: ${c.list}.`, `Comandos citados que não estão em "scripts" do package.json: ${c.list}.`),
    t('The AI will try to run the command, fail and waste time finding the right one.', 'A IA vai tentar rodar o comando, falhar e perder tempo descobrindo o certo.'),
    t('Fix the script name in the instructions or create the script in package.json.', 'Corrija o nome do script nas instruções ou crie o script no package.json.'),
  ],
  'limpeza/atalho-sem-prazo': (c, n, all) => {
    const list = (all ?? [c]).slice(0, 6).map((x) => `${lineWord()} ${x.line}: "${x.text}"`).join('; ')
    return [
      t(`${n} shortcut${n > 1 ? 's' : ''} that do${n > 1 ? '' : 'es'} not say when to improve`, `${n} atalho${n > 1 ? 's' : ''} sem dizer quando melhorar`),
      t(
        `// faundr: comments that record a simplification, but without the trigger to revisit it: ${list}.`,
        `Comentários // faundr: que registram uma simplificação, mas sem o gatilho para rever: ${list}.`,
      ),
      t(
        'A shortcut with no deadline becomes forgotten debt: nobody knows when it stops being good enough.',
        'Atalho sem prazo vira dívida esquecida: ninguém sabe quando ele deixa de servir.',
      ),
      t(
        'Complete it in the format // faundr: <the limit>, <when to improve> (e.g. "// faundr: fetches everything at once, paginate when it passes 500 items").',
        'Complete no formato // faundr: <o limite>, <quando melhorar> (ex.: "// faundr: busca tudo de uma vez, paginar quando passar de 500 itens").',
      ),
    ]
  },
  'docker/imagem-sem-versao': (c, n, all) => {
    const images = (all ?? [c]).map((x) => x.image).join(', ')
    return [
      n > 1 ? t(`${n} Docker images without a pinned version`, `${n} imagens do Docker sem versão fixa`) : t(`Docker image without a pinned version (${c.image})`, `Imagem do Docker sem versão fixa (${c.image})`),
      t(`The FROM uses ${images} with no tag or with :latest.`, `O FROM usa ${images} sem tag ou com :latest.`),
      t(
        'Every build pulls the newest version available: one day the app breaks (or behaves differently) without anyone touching the code.',
        'A cada build vem a versão mais nova que existir: um dia o app quebra (ou muda de comportamento) sem ninguém ter mexido no código.',
      ),
      t(
        'Pin the version in the FROM, for example node:20-alpine or python:3.12-slim, and update on purpose when you want to.',
        'Fixe a versão no FROM, por exemplo node:20-alpine ou python:3.12-slim, e atualize de propósito quando quiser.',
      ),
    ]
  },
  'docker/run-cd': (c, n) => [
    t(`${n} RUN cd in the Dockerfile`, `${n} RUN cd no Dockerfile`),
    t('The Dockerfile uses RUN cd folder && … to change folders.', 'O Dockerfile usa RUN cd pasta && … para mudar de pasta.'),
    t(
      'The cd only applies to that RUN: the following instructions go back to the previous folder, and it is easy to run something in the wrong place.',
      'O cd vale só para aquele RUN: as instruções seguintes voltam para a pasta anterior, e é fácil rodar algo no lugar errado.',
    ),
    t(
      'Use WORKDIR /folder before the commands (it creates the folder and applies to everything that comes after).',
      'Use WORKDIR /pasta antes dos comandos (ele cria a pasta e vale para tudo o que vem depois).',
    ),
  ],
  'docker/apt-sem-limpeza': (c, n) => [
    t(`${n} apt-get install without cleaning the package list`, `${n} apt-get install sem limpar a lista de pacotes`),
    t(
      'The RUN installs packages with apt-get but does not delete /var/lib/apt/lists in the same command.',
      'O RUN instala pacotes com apt-get mas não apaga /var/lib/apt/lists no mesmo comando.',
    ),
    t(
      'The package list (tens of MB) stays inside the image: it gets bigger, takes longer to upload and uses more space on the server.',
      'A lista de pacotes (dezenas de MB) fica dentro da imagem: ela fica maior, demora mais para subir e ocupa mais espaço no servidor.',
    ),
    t(
      'In the same RUN: apt-get update && apt-get install -y --no-install-recommends <packages> && rm -rf /var/lib/apt/lists/*',
      'No mesmo RUN: apt-get update && apt-get install -y --no-install-recommends <pacotes> && rm -rf /var/lib/apt/lists/*',
    ),
  ],
  'css/important-em-excesso': (c) => [
    t(`${c.count} !important in the same stylesheet`, `${c.count} !important no mesmo arquivo de estilo`),
    t(`The file uses !important ${c.count} times to beat the other rules.`, `O arquivo usa !important ${c.count} vezes para ganhar das outras regras.`),
    t(
      'Each !important forces the next tweak to use another !important: the styles turn into a fight, and changing one color starts breaking another screen.',
      'Cada !important obriga o próximo ajuste a usar outro !important: o estilo vira uma briga, e mudar uma cor passa a quebrar outra tela.',
    ),
    t(
      "Remove the !important and make the rule more specific (or change the order of the files). If it is to beat a library, use @layer or a selector from the library itself.",
      'Tire os !important e deixe a regra mais específica (ou mude a ordem dos arquivos). Se for para vencer uma biblioteca, use @layer ou um seletor da própria biblioteca.',
    ),
  ],
  'css/regra-vazia': (c, n, all) => {
    const list = (all ?? [c]).slice(0, 6).map((x) => `${x.selector} (${lineWord()} ${x.line})`).join(', ')
    return [
      n > 1 ? t(`${n} empty style rules`, `${n} regras de estilo vazias`) : t(`Empty style rule (${c.selector})`, `Regra de estilo vazia (${c.selector})`),
      t(`Selectors with no properties: ${list}.`, `Seletores sem nenhuma propriedade: ${list}.`),
      t('They do nothing, but they make readers look for where they are used.', 'Não fazem nada, mas fazem quem lê procurar onde aquilo é usado.'),
      t('Delete the empty rules.', 'Apague as regras vazias.'),
    ]
  },
  'css/aninhamento-fundo': (c) => [
    t(`Selector nested ${c.depth} levels deep in Sass/Less`, `Seletor aninhado ${c.depth} níveis no Sass/Less`),
    t(`A selector sits ${c.depth} levels inside others.`, `Um seletor fica ${c.depth} níveis dentro de outros.`),
    t(
      'The generated CSS becomes a long, overly specific selector: hard to override, and it breaks when the HTML structure changes.',
      'O CSS gerado vira um seletor longo e específico demais: difícil de sobrescrever, e ele quebra quando o HTML muda de estrutura.',
    ),
    t(
      'Nest at most 3 or 4 levels: give the inner element its own class (e.g. .menu-icon) and use it directly.',
      'Aninhe no máximo 3 ou 4 níveis: dê uma classe própria ao elemento de dentro (ex.: .menu-icone) e use direto.',
    ),
  ],
  'morto/arquivo-orfao': () => [
    t('File nobody uses', 'Arquivo que ninguém usa'),
    t(
      "No other file imports this one, and its name does not appear anywhere else in the project. Check before deleting: it may be called in a way the check cannot see.",
      'Nenhum outro arquivo importa este, e o nome dele não aparece em nenhum outro lugar do projeto. Confira antes de apagar: pode ser chamado de um jeito que a checagem não enxerga.',
    ),
    t(
      'An idle file confuses whoever reads it (and the AI): it looks like part of the app, but it is not.',
      'Arquivo parado confunde quem lê (e a IA): parece fazer parte do app, mas não faz.',
    ),
    t(
      'If it is not used, delete it (git keeps the history). If it is called from outside (a script, configuration), mark it with // faundr-ignore-file morto/arquivo-orfao: reason.',
      'Se não é usado, apague (o git guarda o histórico). Se é chamado por fora (script, configuração), marque com // faundr-ignore-file morto/arquivo-orfao: motivo.',
    ),
  ],
  'morto/export-sem-uso': (c, n, all) => {
    const list = (all ?? [c]).map((x) => `${x.name} (${lineWord()} ${x.line})`).slice(0, 15).join(', ')
    return [
      n > 1 ? t(`${n} exported things nobody uses`, `${n} coisas exportadas que ninguém usa`) : t(`Exported and never used: ${c.name}`, `Exportado e nunca usado: ${c.name}`),
      t(
        `Exported functions, components or constants that no other file imports and the file itself does not use: ${list}.`,
        `Funções, componentes ou constantes exportados que nenhum outro arquivo importa, nem o próprio arquivo usa: ${list}.`,
      ),
      t('Dead code keeps being read, maintained and updated without serving any purpose.', 'Código morto continua sendo lido, mantido e atualizado sem servir para nada.'),
      t(
        'Delete what is no longer needed. If it is used in a way the check cannot see, mark it with // faundr-ignore morto/export-sem-uso: reason.',
        'Apague o que não serve mais. Se é usado de um jeito que a checagem não enxerga, marque com // faundr-ignore morto/export-sem-uso: motivo.',
      ),
    ]
  },
  'demais/duplicado': (c, n, all) => {
    const list = (all ?? [c])
      .slice(0, 8)
      .map((x) => t(`lines ${x.line}–${x.to} same as ${x.other}:${x.otherLine}`, `linhas ${x.line}–${x.to} iguais a ${x.other}:${x.otherLine}`))
      .join('; ')
    return [
      n > 1 ? t(`${n} pieces repeated from other files`, `${n} trechos repetidos de outros arquivos`) : t(`Piece repeated from ${c.other}`, `Trecho repetido de ${c.other}`),
      t(`Blocks of 8 or more lines that are identical somewhere else: ${list}.`, `Blocos de 8 ou mais linhas iguais em outro lugar: ${list}.`),
      t(
        'Copied code has to be fixed in every place; when someone forgets one, the same bug comes back.',
        'Código copiado precisa ser corrigido em todos os lugares; quando alguém esquece um, o mesmo erro volta.',
      ),
      t('Merge it into a single function or component and use it in both places.', 'Junte numa função ou componente só e use nos dois lugares.'),
    ]
  },
  'ts/erro-de-tipo': (c, n, all) => {
    const list = (all ?? [c]).slice(0, 6).map((x) => `${lineWord()} ${x.line ?? '?'}: ${x.message} (${x.code})`).join('; ')
    return [
      t(`${n} TypeScript type error${n > 1 ? 's' : ''}`, `${n} erro${n > 1 ? 's' : ''} de tipo do TypeScript`),
      t(`The project's own tsc reports: ${list}.`, `O tsc do próprio projeto acusa: ${list}.`),
      t(
        'A type error is usually a real bug (a field that does not exist, a value that may be missing) and can break the build.',
        'Erro de tipo costuma ser um bug de verdade (campo que não existe, valor que pode faltar) e pode quebrar o build.',
      ),
      t('Fix each error at the source, without any or @ts-ignore.', 'Corrija cada erro na origem, sem any nem @ts-ignore.'),
    ]
  },
  'eslint/erro': (c, n, all) => {
    const list = (all ?? [c]).slice(0, 6).map((x) => `${lineWord()} ${x.line ?? '?'}: ${x.message} (${x.rule ?? t('syntax', 'sintaxe')})`).join('; ')
    return [
      t(`${n} ESLint error${n > 1 ? 's' : ''}`, `${n} erro${n > 1 ? 's' : ''} do ESLint`),
      t(`The project's ESLint reports: ${list}.`, `O ESLint do projeto acusa: ${list}.`),
      t('These are the rules the project itself chose to follow.', 'São as regras que o próprio projeto escolheu seguir.'),
      t(
        'Fix it or, if the rule does not apply there, turn it off with eslint-disable-next-line rule -- reason.',
        'Corrija ou, se a regra não vale ali, desligue com eslint-disable-next-line regra -- motivo.',
      ),
    ]
  },
  'eslint/aviso': (c, n, all) => {
    const list = (all ?? [c]).slice(0, 6).map((x) => `${lineWord()} ${x.line ?? '?'}: ${x.message} (${x.rule ?? t('syntax', 'sintaxe')})`).join('; ')
    return [
      t(`${n} ESLint warning${n > 1 ? 's' : ''}`, `${n} aviso${n > 1 ? 's' : ''} do ESLint`),
      t(`The project's ESLint warns: ${list}.`, `O ESLint do projeto avisa: ${list}.`),
      t('Piled-up warnings hide the ones that matter.', 'Avisos acumulados escondem os que importam.'),
      t(
        "Fix them bit by bit, or adjust the ESLint configuration if the rule does not suit the project.",
        'Corrija aos poucos ou ajuste a configuração do ESLint se a regra não serve ao projeto.',
      ),
    ]
  },
}
