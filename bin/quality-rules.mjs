// Qualidade do código sem IA (fase 1): falha silenciosa, tipos fracos, complexidade, código demais, limpeza,
// testes pulados e instruções da IA quebradas. Critérios do Ponytail (MIT) e dos plugins oficiais da Anthropic
// (Apache-2.0), destilados em docs/research/qualidade-proposta.md. A leitura do código é pela árvore de sintaxe
// (tree-sitter, em dist/graph.mjs); aqui ficam a lista de arquivos, as regras do projeto inteiro e os textos.
//
// Um achado por arquivo por regra (com as linhas no detalhe) ou um por projeto. Exceção no código: comentário
// `faundr-ignore <regra>: motivo` na linha ou na anterior; `faundr-ignore-file <regra>` vale para o arquivo.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { analyzeQuality, qualityGrammar, unusedCode } from '../dist/graph.mjs'
import { ignoreSet } from './design-rules.mjs'
import { projectParts } from './parts.mjs'
import { projectFiles } from './security.mjs'

const MAX_FILE = 400_000
const TEST_PATH = /(^|\/)(__tests__|__mocks__|tests?|e2e|spec)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$/
const GENERATED = /\.(d\.ts|min\.js)$|\.gen\.[jt]sx?$|(^|\/)(dist|build|out|vendor|generated|\.output)\//
const GENERATED_HEADER = /^(\/\/|\/\*)[^\n]*(@generated|auto-?generated|gerado por|do not edit|não edite)/i
// Telas: onde console.log é esquecimento (em CLI e servidor ele é a saída normal).
const UI_FILE = /\.(tsx|jsx)$/
const SERVER_PATH = /(^|\/)(api|server|bin|scripts|cli|functions|workers?)(\/|$)/

// kind: grupo que o painel mostra; severity: a gravidade pela régua (não pelo modelo).
export const RULES = {
  'falha/catch-vazio': { kind: 'failure', severity: 'medium' },
  'falha/catch-so-loga': { kind: 'failure', severity: 'low' },
  'falha/catch-devolve-nulo': { kind: 'failure', severity: 'low' },
  'falha/mock-em-producao': { kind: 'failure', severity: 'high' },
  'tipos/any': { kind: 'types', severity: 'low' },
  'tipos/as-any': { kind: 'types', severity: 'medium' },
  'tipos/ts-ignore-sem-motivo': { kind: 'types', severity: 'medium' },
  'tipos/eslint-disable-sem-motivo': { kind: 'types', severity: 'low' },
  'tipos/non-null-em-excesso': { kind: 'types', severity: 'low' },
  'complexidade/funcao': { kind: 'complexity', severity: 'medium' },
  'complexidade/funcao-longa': { kind: 'complexity', severity: 'low' },
  'complexidade/aninhamento': { kind: 'complexity', severity: 'medium' },
  'complexidade/ternario-aninhado': { kind: 'complexity', severity: 'low' },
  'complexidade/arquivo-grande': { kind: 'complexity', severity: 'low' },
  'demais/dependencia-dispensavel': { kind: 'excess', severity: 'medium' },
  'demais/dependencia-sem-uso': { kind: 'excess', severity: 'low' },
  'demais/codigo-comentado': { kind: 'excess', severity: 'low' },
  'limpeza/console-log': { kind: 'cleanup', severity: 'low' },
  'limpeza/debugger': { kind: 'cleanup', severity: 'medium' },
  'limpeza/todo-antigo': { kind: 'cleanup', severity: 'low' },
  'testes/only': { kind: 'tests', severity: 'high' },
  'testes/pulado': { kind: 'tests', severity: 'low' },
  'testes/sem-conferencia': { kind: 'tests', severity: 'medium' },
  'testes/espera-fixa': { kind: 'tests', severity: 'medium' },
  'testes/hora-real': { kind: 'tests', severity: 'low' },
  'instrucoes/arquivo-inexistente': { kind: 'instructions', severity: 'medium' },
  'instrucoes/script-inexistente': { kind: 'instructions', severity: 'medium' },
  'limpeza/atalho-sem-prazo': { kind: 'cleanup', severity: 'low' },
  'morto/arquivo-orfao': { kind: 'excess', severity: 'low' },
  'morto/export-sem-uso': { kind: 'excess', severity: 'low', ownLines: true },
  'demais/duplicado': { kind: 'excess', severity: 'medium', ownLines: true },
  'ts/erro-de-tipo': { kind: 'tool', severity: 'medium', ownLines: true },
  'eslint/erro': { kind: 'tool', severity: 'medium', ownLines: true },
  'eslint/aviso': { kind: 'tool', severity: 'low', ownLines: true },
}

// Dependências que a linguagem, o Node ou o navegador já resolvem (tabela do Ponytail, docs/platform-native.md).
const NATIVE = {
  uuid: ['crypto.randomUUID()', 'Node 19+ e todos os navegadores atuais'],
  'node-uuid': ['crypto.randomUUID()', 'Node 19+ e todos os navegadores atuais'],
  'lodash.clonedeep': ['structuredClone(obj)', 'Node 17+ e navegadores atuais'],
  'clone-deep': ['structuredClone(obj)', 'Node 17+ e navegadores atuais'],
  qs: ['URLSearchParams', 'para parâmetros simples (sem objetos aninhados)'],
  'query-string': ['URLSearchParams', 'para parâmetros simples (sem objetos aninhados)'],
  rimraf: ['fs.rm(caminho, { recursive: true, force: true })', 'Node 14.14+'],
  mkdirp: ['fs.mkdir(caminho, { recursive: true })', 'Node 10.12+'],
  'node-fetch': ['fetch nativo', 'Node 18+'],
  'cross-fetch': ['fetch nativo', 'Node 18+ e navegadores'],
  'isomorphic-fetch': ['fetch nativo', 'Node 18+ e navegadores'],
  'left-pad': ["texto.padStart(n, ' ')", 'qualquer ambiente atual'],
  'object-assign': ['Object.assign ou { ...obj }', 'qualquer ambiente atual'],
  'array-flatten': ['lista.flat(Infinity)', 'qualquer ambiente atual'],
  'lodash.flatten': ['lista.flat()', 'qualquer ambiente atual'],
  'es6-promise': ['Promise nativa', 'qualquer ambiente atual'],
  'promise-polyfill': ['Promise nativa', 'qualquer ambiente atual'],
  'body-parser': ['express.json() / express.urlencoded()', 'Express 4.16+'],
  'is-number': ["typeof x === 'number' && Number.isFinite(x)", 'qualquer ambiente atual'],
  'abort-controller': ['AbortController nativo', 'Node 15+ e navegadores'],
  'url-parse': ['new URL(texto)', 'qualquer ambiente atual'],
}

// Pacotes usados sem import no código (ferramentas, plugins por nome na configuração, CSS).
const IMPLICIT = /^(@types\/|typescript$|tslib$|react-dom$|@tailwindcss\/|tailwindcss$|postcss|autoprefixer$|@vitejs\/|vite$|wrangler$|@cloudflare\/workers-types$|eslint|prettier|@?babel|core-js$|regenerator-runtime$|sharp$)/

const TEXT = {
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

const read = (root, rel) => {
  try {
    const abs = path.join(root, rel)
    if (fs.statSync(abs).size > MAX_FILE) return null
    const text = fs.readFileSync(abs, 'utf8')
    return text.includes('\0') ? null : text
  } catch {
    // Arquivo apagado ou ilegível no meio da checagem: só não entra.
    return null
  }
}

function makeCollector() {
  const hits = new Map()
  const ignoreCache = new Map()
  return {
    hits,
    ignored: 0,
    /** `text`: o arquivo, para respeitar o faundr-ignore (as regras por arquivo já filtram antes). */
    add(rule, file, line, ctx, text) {
      if (text) {
        if (!ignoreCache.has(file)) ignoreCache.set(file, ignoreSet(text))
        if (ignoreCache.get(file).ignored(rule, line)) return void this.ignored++
      }
      const key = `${rule}|${file ?? ''}`
      const h = hits.get(key) ?? { rule, file, lines: [], ctx, all: [] }
      if (line && !h.lines.includes(line)) h.lines.push(line)
      if (ctx) h.all.push({ line, ...ctx })
      hits.set(key, h)
    },
  }
}

const lineList = (lines) => (lines.length ? ` Linhas: ${lines.slice(0, 12).join(', ')}${lines.length > 12 ? '…' : ''}.` : '')

/** Arquivos de código que entram na checagem (sem gerados, minificados e pastas de build). */
export function qualityFiles(root) {
  const { files } = projectFiles(root)
  return files.filter((f) => qualityGrammar(f) && !GENERATED.test(f))
}

/**
 * Roda as regras. `only`: só esses arquivos (checagem parcial: as regras do projeto inteiro, o código sem uso,
 * os duplicados e as ferramentas do projeto ficam de fora). `tools`: roda o tsc e o ESLint do projeto.
 */
export async function runQuality(root, { only = null, history = true, tools = true } = {}) {
  const started = Date.now()
  const all = qualityFiles(root)
  const files = only ? all.filter((f) => only.includes(f)) : all
  const c = makeCollector()
  const errors = []
  const parsed = await analyzeFiles(root, files, c, errors)

  const scopes = [{ kind: 'code', files: only ? files : null }]
  const stats = { files: files.length, lines: parsed.lines, ignored: parsed.ignored }
  if (!only) {
    wholeProject(root, all, parsed, c, { history, errors })
    scopes.push({ kind: 'project', files: null })
    stats.ranking = ranking(parsed.metrics)
    stats.shortcuts = withBlame(root, parsed.shortcuts)
    if (tools) {
      const ran = projectTools(root, c, errors)
      if (ran.length) scopes.push({ kind: 'tool', files: null, tools: ran })
      stats.tools = ran
    }
  }
  return { findings: toFindings(c), scopes, stats: { ...stats, ignored: stats.ignored + c.ignored, ms: Date.now() - started }, errors }
}

/** Lê cada arquivo pela árvore de sintaxe: achados por arquivo, medidas das funções e o que importa/exporta. */
async function analyzeFiles(root, files, c, errors) {
  const out = { lines: 0, ignored: 0, metrics: new Map(), modules: new Map(), texts: new Map(), shortcuts: [] }
  const house = houseRules(root)
  for (const rel of files) {
    const text = read(root, rel)
    if (!text || GENERATED_HEADER.test(text.slice(0, 300))) continue
    const ign = ignoreSet(text)
    const add = (rule, line, ctx) => (ign.ignored(rule, line) ? out.ignored++ : c.add(rule, rel, line, ctx))
    const test = TEST_PATH.test(rel)
    let result
    try {
      result = await analyzeQuality(rel, text, { test })
    } catch (err) {
      errors.push(`${rel}: ${err.message}`)
      continue
    }
    for (const h of result.hits) {
      if (h.rule === 'limpeza/console-log' && (!UI_FILE.test(rel) || SERVER_PATH.test(rel))) continue
      add(h.rule, h.line, h.ctx)
    }
    for (const r of house) if (r.files.test(rel)) for (const line of r.lines(text)) add(r.rule, line, r.ctx)
    for (const s of shortcutsIn(text)) {
      out.shortcuts.push({ file: rel, ...s })
      if (!s.trigger) add('limpeza/atalho-sem-prazo', s.line, { text: s.text.slice(0, 80) })
    }
    const py = rel.endsWith('.py')
    const codeLines = text.split('\n').filter((l) => l.trim() && !(py ? /^\s*#/ : /^\s*(\/\/|\*|\/\*)/).test(l)).length
    out.lines += codeLines
    out.texts.set(rel, text)
    // Código sem uso entre arquivos só sabe ler os imports do JS/TS.
    if (!py) out.modules.set(rel, result.module)
    if (test) {
      // Data e hora reais sem relógio falso: o teste muda de resultado conforme o dia.
      const clock = text.search(/\bnew Date\(\s*\)|\bDate\.now\(\)/)
      if (clock >= 0 && !/useFakeTimers|setSystemTime|mock\.timers|clock\.install|page\.clock|sinon\.useFakeTimers/.test(text))
        add('testes/hora-real', text.slice(0, clock).split('\n').length, {})
      continue
    }
    out.metrics.set(rel, { lines: codeLines, functions: result.functions })
    if (codeLines > 600) add('complexidade/arquivo-grande', null, { lines: codeLines })
  }
  return out
}

/** O que só dá para ver olhando o projeto inteiro: pacotes, instruções da IA, TODOs, código sem uso, duplicados. */
function wholeProject(root, all, parsed, c, { history, errors }) {
  projectRules(root, all, c)
  if (history) {
    try {
      oldTodos(root, c)
    } catch (err) {
      errors.push(`TODOs: ${err.message}`)
    }
  }
  const entry = entryPoints(root)
  const { orphans, exports } = unusedCode(root, parsed.modules, parsed.texts, (rel) => entry(rel) || TEST_PATH.test(rel))
  for (const rel of orphans) c.add('morto/arquivo-orfao', rel, null, {}, parsed.texts.get(rel))
  for (const e of exports) c.add('morto/export-sem-uso', e.file, e.line, { name: e.name }, parsed.texts.get(e.file))
  for (const d of duplicates(parsed.texts)) c.add('demais/duplicado', d.file, d.line, d, parsed.texts.get(d.file))
}

// Os 10 arquivos com mais caminhos possíveis somados (onde mexer dá mais trabalho e mais risco).
function ranking(metrics) {
  return [...metrics]
    .map(([file, m]) => {
      const worst = m.functions.reduce((a, b) => (b.complexity > (a?.complexity ?? 0) ? b : a), null)
      return {
        file,
        lines: m.lines,
        functions: m.functions.length,
        complexity: m.functions.reduce((s, f) => s + f.complexity, 0),
        worst: worst ? { name: worst.name, complexity: worst.complexity, line: worst.line } : null,
      }
    })
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 10)
}

function toFindings(c) {
  const findings = []
  for (const h of c.hits.values()) {
    const meta = RULES[h.rule] ?? { kind: 'instructions', severity: h.ctx?.severity ?? 'medium' }
    const [title, detail, impact, fix] = (TEXT[h.rule] ?? houseText)(h.ctx ?? {}, Math.max(1, h.lines.length), h.all)
    const severity = h.severity ?? (h.rule === 'complexidade/funcao' && h.all.some((x) => x.complexity >= 40) ? 'high' : meta.severity)
    // Complexidade: a lista de funções com o número de cada uma, da pior para a melhor.
    const measure = { 'complexidade/funcao': 'complexity', 'complexidade/funcao-longa': 'lines', 'complexidade/aninhamento': 'depth' }[h.rule]
    const list =
      measure && h.all.length > 1
        ? ` Funções: ${[...h.all].sort((a, b) => b[measure] - a[measure]).slice(0, 10).map((x) => `${x.name} (${x[measure]}, linha ${x.line})`).join('; ')}.`
        : ''
    findings.push({
      kind: meta.kind,
      rule_id: h.rule,
      severity,
      title,
      detail: `${detail}${list || (meta.ownLines ? '' : lineList(h.lines))}`.slice(0, 3000),
      impact,
      fix,
      file: h.file ?? null,
      line: h.lines[0] ?? null,
      lines: h.lines.slice(0, 200),
      fingerprint: `q:${h.rule}|${h.file ?? ''}`,
    })
  }
  return findings
}

// ---------- pontos de entrada: o que o framework ou a configuração chamam sozinhos ----------

const ENTRY = [
  /(^|\/)(src\/)?routes\//, // TanStack Router, SvelteKit, Remix
  /(^|\/)(src\/)?app\/(.*\/)?(page|layout|route|loading|error|not-found|template|default|global-error|opengraph-image|icon|sitemap|robots|manifest)\.[jt]sx?$/, // Next.js app router
  /(^|\/)(src\/)?pages\//, // Next.js pages, Astro
  /(^|\/)(middleware|instrumentation|proxy)\.[jt]s$/,
  /(^|\/)[^/]+\.config\.[cm]?[jt]s$/, // vite.config, tailwind.config, eslint.config…
  /(^|\/)(src\/)?(main|index|client|server|router|entry[-.]\w+|worker|start|app)\.[cm]?[jt]sx?$/,
  /(^|\/)(bin|scripts)\//,
  /(^|\/)(supabase\/functions|api|netlify\/functions)\//,
  /\.d\.ts$/,
]

// Em cada parte do projeto: o que o package.json declara (main, bin, exports) e os arquivos citados nos scripts
// e no wrangler, com os caminhos relativos à parte.
function entryPoints(root) {
  const declared = new Set()
  const cited = []
  for (const { dir, pkg } of projectParts(root)) {
    const addPath = (v) => typeof v === 'string' && declared.add([dir, v.replace(/^\.\//, '')].filter(Boolean).join('/'))
    addPath(pkg.main)
    addPath(pkg.module)
    if (typeof pkg.bin === 'string') addPath(pkg.bin)
    else Object.values(pkg.bin ?? {}).forEach(addPath)
    const walkExports = (v) => (typeof v === 'string' ? addPath(v) : v && typeof v === 'object' && Object.values(v).forEach(walkExports))
    walkExports(pkg.exports)
    // Arquivos citados nos scripts ("node engine/build.mjs") e no wrangler (main).
    const wrangler = read(root, path.join(dir, 'wrangler.jsonc')) ?? read(root, path.join(dir, 'wrangler.toml')) ?? ''
    cited.push({ dir, text: `${Object.values(pkg.scripts ?? {}).join(' ')} ${wrangler}` })
  }
  const inPart = (rel, dir) => (!dir ? rel : rel.startsWith(`${dir}/`) ? rel.slice(dir.length + 1) : null)
  return (rel) => declared.has(rel) || cited.some(({ dir, text }) => inPart(rel, dir) && text.includes(inPart(rel, dir))) || ENTRY.some((re) => re.test(rel))
}

// ---------- trechos duplicados ----------

const DUP_WINDOW = 8
const DUP_MIN_CHARS = 280
// Linhas que não contam (vazias, comentários, imports, só fechamento).
const TRIVIAL = /^(\/\/|\/\*|\*|#|import\b|from\s+\S+\s+import\b|export \{|[)\]}>;,:]+$|<\/[\w.]+>$)/

/** Blocos de 8+ linhas iguais (ignorando espaços) em dois lugares do projeto. Um item por bloco. */
function duplicates(texts) {
  const files = [...texts].filter(([rel]) => !TEST_PATH.test(rel))
  const sig = new Map()
  for (const [rel, text] of files)
    sig.set(
      rel,
      text
        .split('\n')
        .map((l, i) => ({ t: l.trim().replace(/\s+/g, ' '), n: i + 1 }))
        .filter((l) => l.t && !TRIVIAL.test(l.t)),
    )
  const seen = new Map()
  const pairs = new Map()
  for (const [rel, lines] of sig)
    for (let i = 0; i + DUP_WINDOW <= lines.length; i++) {
      const win = lines.slice(i, i + DUP_WINDOW).map((l) => l.t).join('\n')
      if (win.length < DUP_MIN_CHARS) continue
      const first = seen.get(win)
      if (!first) {
        seen.set(win, { rel, i })
        continue
      }
      if (first.rel === rel && i - first.i < DUP_WINDOW) continue
      for (const [a, b] of [[{ rel, i }, first], [first, { rel, i }]]) {
        const key = `${a.rel}|${b.rel}`
        const list = pairs.get(key) ?? []
        list.push({ i: a.i, other: b.i })
        pairs.set(key, list)
      }
    }
  // Junta janelas seguidas num bloco: linhas a–b deste arquivo iguais a linhas c–d do outro.
  const out = []
  for (const [key, wins] of pairs) {
    const [rel, other] = key.split('|')
    const mine = sig.get(rel)
    const theirs = sig.get(other)
    wins.sort((x, y) => x.i - y.i)
    let block = null
    const flush = () => {
      if (!block) return
      const from = mine[block.start].n
      const to = mine[block.end + DUP_WINDOW - 1].n
      out.push({ file: rel, line: from, to, other, otherLine: theirs[block.other].n, size: to - from + 1 })
      block = null
    }
    for (const w of wins) {
      if (block && w.i <= block.end + 1) block.end = w.i
      else {
        flush()
        block = { start: w.i, end: w.i, other: w.other }
      }
    }
    flush()
  }
  return out
}

// ---------- ferramentas do próprio projeto (tsc e ESLint) ----------

const TOOL_TIMEOUT = 180_000

/**
 * Roda o tsc e o ESLint que o projeto já tem instalados, em cada parte que tem a configuração deles (a raiz e,
 * num projeto dividido, frontend/ etc.). O executável pode estar na parte ou na raiz (monorepo). Devolve quais
 * rodaram ("tsc", "eslint em frontend/"…).
 */
function projectTools(root, c, errors) {
  const ran = []
  const parts = projectParts(root)
  const binIn = (dir, rel) => [path.join(root, dir, 'node_modules', rel), path.join(root, 'node_modules', rel)].find((f) => fs.existsSync(f))
  const label = (tool, dir) => (dir ? `${tool} em ${dir}/` : tool)
  for (const { dir } of parts) {
    const cwd = path.join(root, dir)
    const tsc = binIn(dir, 'typescript/bin/tsc')
    if (fs.existsSync(path.join(cwd, 'tsconfig.json')) && tsc) {
      const r = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', '.'], { cwd, encoding: 'utf8', windowsHide: true, timeout: TOOL_TIMEOUT, maxBuffer: 32 * 1024 * 1024 })
      if (r.error) errors.push(`${label('tsc', dir)}: ${r.error.message}`)
      else {
        ran.push(label('tsc', dir))
        // O tsc escreve os caminhos relativos à pasta em que rodou.
        for (const m of r.stdout.matchAll(/^(.+?)\((\d+),\d+\): error (TS\d+): (.+)$/gm))
          c.add('ts/erro-de-tipo', [dir, m[1].replace(/\\/g, '/')].filter(Boolean).join('/'), Number(m[2]), { code: m[3], message: m[4] })
      }
    }
    const eslint = binIn(dir, 'eslint/bin/eslint.js')
    const hasConfig = fs.readdirSync(cwd).some((f) => /^(eslint\.config\.[cm]?[jt]s|\.eslintrc(\.\w+)?)$/.test(f))
    if (hasConfig && eslint) {
      const r = spawnSync(process.execPath, [eslint, '.', '-f', 'json'], { cwd, encoding: 'utf8', windowsHide: true, timeout: TOOL_TIMEOUT, maxBuffer: 64 * 1024 * 1024 })
      try {
        for (const file of JSON.parse(r.stdout)) {
          const rel = path.relative(root, file.filePath).split(path.sep).join('/')
          for (const msg of file.messages ?? [])
            c.add(msg.severity === 2 ? 'eslint/erro' : 'eslint/aviso', rel, msg.line ?? null, { rule: msg.ruleId ?? 'sintaxe', message: msg.message })
        }
        ran.push(label('eslint', dir))
      } catch {
        errors.push(`${label('eslint', dir)}: ${(r.stderr || r.error?.message || 'saída inválida').split('\n')[0].slice(0, 200)}`)
      }
    }
  }
  return ran
}

// Pacotes de cada parte (a raiz e subpastas com package.json, como frontend/), cada uma com os próprios
// arquivos; e as instruções da IA de cada parte, conferidas contra os scripts de todas as partes.
function projectRules(root, files, c) {
  const parts = projectParts(root)
  for (const { dir, pkg } of parts) {
    const manifest = [dir, 'package.json'].filter(Boolean).join('/')
    const deps = Object.keys(pkg.dependencies ?? {})
    for (const name of [...deps, ...Object.keys(pkg.devDependencies ?? {})])
      if (NATIVE[name]) c.add('demais/dependencia-dispensavel', manifest, null, { pkg: name, native: NATIVE[name][0], where: NATIVE[name][1] })
    // Raiz de monorepo (workspaces): os pacotes de verdade estão nas partes.
    if (pkg.workspaces) continue
    // Os arquivos da parte; os da raiz são todos menos os das outras partes.
    const others = parts.filter((p) => p.dir && p.dir !== dir && (!dir || !p.dir.startsWith(`${dir}/`))).map((p) => `${p.dir}/`)
    const own = files.filter((f) => (!dir || f.startsWith(`${dir}/`)) && !others.some((o) => f.startsWith(o)))
    const unused = unusedDependencies(root, own, deps, pkg, dir)
    if (unused.length) c.add('demais/dependencia-sem-uso', manifest, null, { pkg: unused[0], list: unused.join(', ') })
  }
  const scripts = new Set(parts.flatMap((p) => Object.keys(p.pkg.scripts ?? {})))
  const docs = parts.flatMap(({ dir }) => (dir ? ['CLAUDE.md', 'AGENTS.md'] : ['CLAUDE.md', 'AGENTS.md', '.claude/CLAUDE.md']).map((d) => [dir, d].filter(Boolean).join('/')))
  for (const doc of docs) instructionRules(root, doc, scripts, c)
}

function unusedDependencies(root, files, deps, pkg, dir = '') {
  const candidates = deps.filter((d) => !IMPLICIT.test(d))
  if (!candidates.length) return []
  // Código + configuração + CSS + HTML da mesma parte: onde um pacote pode ser citado pelo nome.
  const extra = projectFiles(root).files.filter((f) => (!dir || f.startsWith(`${dir}/`)) && /\.(css|scss|html|json|jsonc|vue|svelte|astro|toml|ya?ml)$/.test(f) && !/package(-lock)?\.json$/.test(f))
  const used = new Set()
  const scripts = Object.values(pkg.scripts ?? {}).join('\n')
  const quoted = (name) => new RegExp(`['"\`]${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(/[^'"\`]*)?['"\`]`)
  for (const rel of [...files, ...extra]) {
    const text = read(root, rel)
    if (!text) continue
    for (const d of candidates) if (!used.has(d) && (text.includes(`'${d}`) || text.includes(`"${d}`) || text.includes(`\`${d}`)) && quoted(d).test(text)) used.add(d)
    if (used.size === candidates.length) break
  }
  return candidates.filter((d) => !used.has(d) && !new RegExp(`(^|[\\s/])${d.replace(/^@[^/]+\//, '')}\\b`).test(scripts))
}

const PATH_LIKE = /^(\.{0,2}\/)?[\w@.-]+(\/[\w@.$[\]-]+)+\/?$|^[\w-]+\.(md|json|ts|tsx|js|mjs|jsonc|toml|ya?ml|sql|css)$/

// `scripts`: os nomes dos scripts de todas as partes ("npm run dev" pode ser o de frontend/).
function instructionRules(root, doc, scripts, c) {
  const text = read(root, doc)
  if (!text) return
  const missing = new Set()
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1].replace(/:\d+(-\d+)?$/, '').replace(/[),.;]+$/, '')
    if (!PATH_LIKE.test(p) || /^https?:|[*<>{}]|\$\{/.test(p) || /^@[\w-]+\/[\w-]+$/.test(p)) continue
    const rel = p.replace(/^\.\//, '')
    if (!fs.existsSync(path.join(root, path.dirname(doc), rel)) && !fs.existsSync(path.join(root, rel))) missing.add(p)
  }
  if (missing.size) c.add('instrucoes/arquivo-inexistente', doc, null, { doc, list: [...missing].slice(0, 10).join(', ') })
  if (!scripts.size) return
  const builtin = new Set(['install', 'i', 'ci', 'test', 'start', 'init', 'add', 'remove', 'uninstall', 'update', 'exec', 'dlx', 'create', 'publish', 'link', 'audit', 'outdated', 'why', 'x'])
  const bad = new Set()
  for (const m of text.matchAll(/\b(?:npm run|pnpm(?: run)?|yarn(?: run)?|bun run)\s+([\w:.-]+)/g)) {
    const s = m[1]
    if (!scripts.has(s) && !builtin.has(s)) bad.add(s)
  }
  if (bad.size) c.add('instrucoes/script-inexistente', doc, null, { doc, list: [...bad].slice(0, 10).join(', ') })
}

// TODO/FIXME antigos: data pela autoria da linha no git (git blame), só nas linhas marcadas.
function oldTodos(root, c) {
  const grep = spawnSync('git', ['grep', '-n', '-I', '-E', '(//|/\\*|\\*|#)\\s*(TODO|FIXME|HACK|XXX)\\b', '--', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs', '*.py'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (grep.status !== 0) return
  const now = Date.now() / 1000
  for (const row of grep.stdout.split('\n').filter(Boolean).slice(0, 200)) {
    const m = row.match(/^(.+?):(\d+):/)
    if (!m || GENERATED.test(m[1])) continue
    const blame = spawnSync('git', ['blame', '--porcelain', '-L', `${m[2]},${m[2]}`, '--', m[1]], { cwd: root, encoding: 'utf8', windowsHide: true })
    const time = Number(blame.stdout?.match(/^author-time (\d+)/m)?.[1])
    if (!time) continue
    const days = Math.floor((now - time) / 86400)
    if (days < 90) continue
    const text = read(root, m[1]) ?? ''
    if (ignoreSet(text).ignored('limpeza/todo-antigo', Number(m[2]))) continue
    const key = `limpeza/todo-antigo|${m[1]}`
    const prev = c.hits.get(key)?.ctx?.days ?? 0
    c.add('limpeza/todo-antigo', m[1], Number(m[2]), { days: Math.max(days, prev) })
    c.hits.get(key).ctx = { days: Math.max(days, prev) }
  }
}

// ---------- regras da casa (.faundr-regras/*.md) ----------

const HOUSE_DIR = '.faundr-regras'
const SEVERITY_PT_IN = { alta: 'high', media: 'medium', média: 'medium', baixa: 'low', high: 'high', medium: 'medium', low: 'low' }

// "src/**/*.tsx" → expressão regular; vários padrões separados por vírgula.
function globToRegex(glob) {
  const one = (g) =>
    g
      .trim()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0000')
      .replace(/\*\*/g, '\u0001')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\u0000/g, '(.*/)?')
      .replace(/\u0001/g, '.*')
  return new RegExp(`^(${glob.split(',').map(one).join('|')})$`)
}

/** Regras escritas pelo time: uma por arquivo .md com frontmatter (nome, padrao, arquivos, gravidade) e a mensagem no corpo. */
export function houseRules(root) {
  let names = []
  try {
    names = fs.readdirSync(path.join(root, HOUSE_DIR)).filter((f) => f.endsWith('.md'))
  } catch {
    // Sem a pasta: o projeto não tem regras da casa.
    return []
  }
  const out = []
  for (const name of names) {
    const text = read(root, `${HOUSE_DIR}/${name}`) ?? ''
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!m) continue
    const meta = Object.fromEntries(
      m[1].split(/\r?\n/).map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, '')]),
    )
    if (!meta.padrao || meta.ativo === 'nao' || meta.ativo === 'false') continue
    let re
    try {
      re = new RegExp(meta.padrao.replace(/\\\\/g, '\\'))
    } catch {
      // Padrão inválido: a regra fica de fora (o comando quality-rule avisa ao criar).
      continue
    }
    const id = name.replace(/\.md$/, '')
    out.push({
      rule: `casa/${id}`,
      files: globToRegex(meta.arquivos || '**/*'),
      ctx: { name: meta.nome || id, message: m[2].trim().slice(0, 1500), severity: SEVERITY_PT_IN[meta.gravidade?.toLowerCase()] ?? 'medium', file: `${HOUSE_DIR}/${name}` },
      lines: (text2) => text2.split('\n').flatMap((l, i) => (re.test(l) ? [i + 1] : [])),
    })
  }
  return out
}

function houseText(c, n) {
  return [
    `Regra da casa: ${c.name}${n > 1 ? ` (${n} lugares)` : ''}`,
    `O código bate com uma regra escrita pelo time em ${c.file}.`,
    c.message || 'O time decidiu que isto não deve aparecer no código.',
    'Siga o que a regra pede. Se a regra não vale mais, edite ou apague o arquivo dela.',
  ]
}

// ---------- livro de atalhos (// faundr: <limite>, <quando melhorar>) ----------

// O comentário começa a linha ou vem depois do código (não conta texto dentro de aspas).
const SHORTCUT = /(?:^\s*|[;{}),]\s*)(?:\/\/|\/\*|#|\*)\s*faundr:\s*(.+?)\s*(?:\*\/)?$/
const TRIGGER = /,\s*\S.*|\b(quando|se|depois|até|assim que|when|if|once)\b/i

/** Comentários que registram uma simplificação consciente. Sem gatilho ("quando…"), viram achado. */
export function shortcutsIn(text) {
  const out = []
  text.split('\n').forEach((l, i) => {
    const m = l.match(SHORTCUT)
    if (!m) return
    const body = m[1].trim()
    const [limit, ...rest] = body.split(/,\s*/)
    out.push({ line: i + 1, text: body, limit, trigger: rest.join(', ') || (TRIGGER.test(body) ? body : '') })
  })
  return out
}

// Dono e idade de cada atalho pelo git blame (até 100 atalhos).
function withBlame(root, shortcuts) {
  const now = Date.now() / 1000
  // faundr: só os 100 primeiros atalhos ganham dono e idade, paginar quando algum projeto passar disso
  return shortcuts.slice(0, 100).map((s) => {
    const blame = spawnSync('git', ['blame', '--porcelain', '-L', `${s.line},${s.line}`, '--', s.file], { cwd: root, encoding: 'utf8', windowsHide: true })
    const time = Number(blame.stdout?.match(/^author-time (\d+)/m)?.[1])
    const author = blame.stdout?.match(/^author (.+)$/m)?.[1]
    return { ...s, author: author && author !== 'Not Committed Yet' ? author : null, days: time ? Math.max(0, Math.floor((now - time) / 86400)) : 0 }
  })
}
