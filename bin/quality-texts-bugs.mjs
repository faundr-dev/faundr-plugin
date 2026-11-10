// Textos dos achados de bin/bug-rules.mjs (defeitos que só aparecem com dados de verdade, processos juntos ou
// pasta com acento), parte de TEXT em quality-texts.mjs.
// faundr-ignore-file falha/json-gravado-por-cima,falha/caminho-do-modulo,desempenho/regex-de-email-lenta: os textos citam o defeito como exemplo
import { t } from './i18n.mjs'

const places = (n) => (n > 1 ? t(` (${n} places)`, ` (${n} lugares)`) : '')

export const TEXT_BUGS = {
  'falha/limite-acima-de-1000': (c, n, all) => [
    t(`Supabase query asks for more than 1000 rows${places(n)}`, `Consulta do Supabase pede mais de 1000 linhas${places(n)}`),
    t(
      `.limit(${all.map((x) => x.limit).join(', ')}) — but Supabase returns at most 1000 rows per request, so anything past that never arrives.`,
      `.limit(${all.map((x) => x.limit).join(', ')}) — mas o Supabase devolve no máximo 1000 linhas por pedido, e o resto não chega.`,
    ),
    t(
      'No error and no warning: totals, reports and lists come out short once the table passes 1000 rows, and with ascending order you get the oldest rows, not the latest.',
      'Sem erro e sem aviso: contas, relatórios e listas saem faltando quando a tabela passa de 1000 linhas, e com ordem crescente vêm as mais antigas, não as últimas.',
    ),
    t(
      'Page with .range(from, to) until a page comes back short (with a stable .order), or move the math into the database (a view or an rpc that returns the total).',
      'Pagine com .range(de, até) até vir uma página incompleta (com um .order estável), ou leve a conta para o banco (view ou rpc que devolve o total).',
    ),
  ],
  'falha/lista-cortada-em-1000': (c, n, all) => [
    t(`"Everything that exists" read without paging${places(n)}`, `"Tudo o que já existe" lido sem paginar${places(n)}`),
    t(
      `The query on ${[...new Set(all.map((x) => x.table))].join(', ')} has no .range/.limit and its result is used as the complete list (to tell what is new, to compare or to sync).`,
      `A consulta em ${[...new Set(all.map((x) => x.table))].join(', ')} não tem .range/.limit e o resultado é usado como a lista completa (para saber o que é novo, comparar ou sincronizar).`,
    ),
    t(
      'Supabase cuts every response at 1000 rows. Past that, rows that already exist look new: they get inserted again, hit the unique index and the whole save fails — or get counted twice.',
      'O Supabase corta toda resposta em 1000 linhas. Passou disso, o que já existe parece novo: é inserido de novo, bate no índice único e a gravação inteira falha — ou é contado duas vezes.',
    ),
    t(
      'Read page by page (.order("id").range(from, from + 999) in a loop until a short page) or filter in the database by what came in (.in("key", batch)).',
      'Leia de página em página (.order("id").range(de, de + 999) num laço até vir uma página incompleta) ou filtre no banco pelo que chegou (.in("chave", lote)).',
    ),
  ],
  'falha/json-gravado-por-cima': (c, n) => [
    t(`JSON file read, changed and written back in place${places(n)}`, `Arquivo JSON lido, alterado e gravado por cima${places(n)}`),
    t(
      'writeFileSync(file, JSON.stringify({ ...read(file), ... })) writes straight onto the file, with no temp file and rename.',
      'writeFileSync(arquivo, JSON.stringify({ ...ler(arquivo), ... })) grava direto no arquivo, sem arquivo temporário e troca de nome.',
    ),
    t(
      'When two processes run together (hooks, workers, CLI and server), one reads the file half-written, falls back to {} and saves only its own piece: everything else in the file is gone. Or one overwrites what the other just saved.',
      'Quando dois processos rodam juntos (hooks, workers, CLI e servidor), um lê o arquivo pela metade, cai no {} e grava só o pedaço dele: o resto do arquivo some. Ou um grava por cima do que o outro acabou de salvar.',
    ),
    t(
      'Write to file.tmp-<pid> and fs.renameSync it over the real one (the swap is atomic). If the file exists but did not parse, do not write: try again later.',
      'Grave em arquivo.tmp-<pid> e troque com fs.renameSync (a troca é de uma vez). Se o arquivo existe e não deu para ler, não grave: tente de novo depois.',
    ),
  ],
  'falha/caminho-do-modulo': (c, n) => [
    t(`Module path from new URL(import.meta.url).pathname${places(n)}`, `Caminho do módulo por new URL(import.meta.url).pathname${places(n)}`),
    t(
      '.pathname keeps the URL encoding: a space becomes %20 and "ç" becomes %C3%A7; on Windows there is also a slash before C:.',
      '.pathname fica no formato de URL: espaço vira %20 e "ç" vira %C3%A7; no Windows ainda sobra uma barra antes do C:.',
    ),
    t(
      'It works on your machine and breaks for anyone whose folder has a space or an accent ("My Projects", "Área de Trabalho"): files are "not found" and the feature quietly stops.',
      'Funciona na sua máquina e quebra para quem tem espaço ou acento na pasta ("Meus Projetos", "Área de Trabalho"): os arquivos "não existem" e a função para sem aviso.',
    ),
    t(
      "Use fileURLToPath(import.meta.url) from 'node:url' (or import.meta.dirname on Node 20.11+).",
      "Use fileURLToPath(import.meta.url) de 'node:url' (ou import.meta.dirname no Node 20.11+).",
    ),
  ],
  'falha/rede-sem-prazo': (c, n) => [
    t(`Network call with no timeout on the server${places(n)}`, `Chamada de rede sem prazo no servidor${places(n)}`),
    t('fetch with no signal in a route, cron, worker or hook.', 'fetch sem signal numa rota, cron, worker ou hook.'),
    t(
      'If the other service hangs, the request waits until the platform kills it — the cron stops halfway (the rest never gets checked) and the hook is cut off after it already changed things.',
      'Se o outro serviço trava, o pedido espera até a plataforma derrubar — o cron para no meio (o resto nunca é conferido) e o hook é cortado depois de já ter mudado coisas.',
    ),
    t(
      'Pass signal: AbortSignal.timeout(10_000) (the right number of seconds for that service) and treat the timeout as a failure of that item, not of the whole run.',
      'Passe signal: AbortSignal.timeout(10_000) (os segundos certos para esse serviço) e trate o estouro como falha daquele item, não da rodada inteira.',
    ),
  ],
  'falha/promessa-solta': (c, n, all) => [
    t(`Async call with no await and no .catch${places(n)}`, `Chamada async sem await e sem .catch${places(n)}`),
    t(
      `${[...new Set(all.map((x) => x.name))].join(', ')}() is async and can throw, but here it is called and forgotten.`,
      `${[...new Set(all.map((x) => x.name))].join(', ')}() é async e pode lançar erro, mas aqui é chamada e esquecida.`,
    ),
    t(
      'On Node 15+, a rejected promise nobody handles takes down the whole process: one network blip and the server, worker or CLI dies.',
      'No Node 15+, uma promessa rejeitada sem ninguém tratar derruba o processo inteiro: uma falha de rede e o servidor, o worker ou a CLI cai.',
    ),
    t(
      'Add .catch(() => {}) (with a comment saying why it is safe to ignore), await it, or wrap the whole body of the async function in try/catch so it never rejects.',
      'Ponha .catch(() => {}) (com um comentário dizendo por que pode ignorar), use await, ou envolva o corpo todo da função async num try/catch para ela nunca rejeitar.',
    ),
  ],
  'falha/erro-vira-lista-vazia': (c, n) => [
    t(`Failed load shown as an empty list${places(n)}`, `Falha ao carregar vira lista vazia${places(n)}`),
    t(
      '.then(({ data }) => setList(data ?? [])) ignores error: when the request fails, the screen gets [].',
      '.then(({ data }) => setLista(data ?? [])) ignora o error: quando a busca falha, a tela recebe [].',
    ),
    t(
      'Offline, with the database down or with an expired login, the person sees "nothing here" and thinks their data is gone — or that there is nothing left to do.',
      'Sem internet, com o banco fora ou com o login vencido, a pessoa vê "nada aqui" e acha que perdeu os dados — ou que não há nada a fazer.',
    ),
    t(
      'Read error too: keep the list as "not loaded" and show "Could not load — Try again" instead of the empty state.',
      'Leia o error também: deixe a lista como "não carregou" e mostre "Não deu para carregar — Tentar de novo" em vez do estado vazio.',
    ),
  ],
  'desempenho/realtime-sem-espera': (c, n, all) => [
    t(`Realtime reloads the whole list on every row${places(n)}`, `Realtime recarrega a lista inteira a cada linha${places(n)}`),
    t(
      `.on('postgres_changes', …, load) on ${[...new Set(all.map((x) => x.table))].join(', ')}: each changed row triggers a new fetch.`,
      `.on('postgres_changes', …, load) em ${[...new Set(all.map((x) => x.table))].join(', ')}: cada linha alterada dispara uma busca nova.`,
    ),
    t(
      'A batch that writes 200 rows becomes 200 fetches per open tab, and a slow old response can land after the new one and show stale data.',
      'Uma gravação de 200 linhas vira 200 buscas por aba aberta, e uma resposta velha e lenta pode chegar depois da nova e mostrar dado antigo.',
    ),
    t(
      'Debounce the reload (300–500 ms after the last change) and keep a request counter so only the latest response is applied.',
      'Espere a rajada acabar antes de buscar (300–500 ms depois da última mudança) e use um contador para só aceitar a resposta mais recente.',
    ),
  ],
  'falha/tamanho-sem-conferir': (c, n, all) => [
    t(`Read loop advances by a size that came from the input${places(n)}`, `Laço de leitura anda pelo tamanho que veio da entrada${places(n)}`),
    t(
      `The position moves by ${all.map((x) => x.field).join(', ')}, read from JSON.parse, without checking it is a non-negative integer that fits in the body.`,
      `A posição anda por ${all.map((x) => x.field).join(', ')}, lido de JSON.parse, sem conferir se é inteiro, não negativo e cabe no corpo.`,
    ),
    t(
      'A negative length moves the position back: the loop re-reads the same item forever and memory keeps growing — one request can freeze the server. A fractional or huge one cuts the data in the wrong place.',
      'Um tamanho negativo faz a posição voltar: o laço relê o mesmo item para sempre e a memória cresce sem parar — um pedido trava o servidor. Fracionário ou enorme corta os dados no lugar errado.',
    ),
    t(
      'Before advancing: Number.isInteger(len) && len >= 0 && pos + len <= body.length, otherwise reject the input. Also cap the number of items.',
      'Antes de andar: Number.isInteger(len) && len >= 0 && pos + len <= corpo.length, senão recuse a entrada. Limite também o número de itens.',
    ),
  ],
  'desempenho/regex-de-email-lenta': (c, n) => [
    t(`Email regex with no anchor (slow on long text)${places(n)}`, `Regex de e-mail sem âncora (lenta em texto comprido)${places(n)}`),
    t(
      '/[\\w.+-]+@…/g has nothing before the first group: on a long text without a matching email it restarts at every character and reads to the end each time.',
      '/[\\w.+-]+@…/g não tem nada antes do primeiro grupo: num texto comprido sem e-mail que case, ela recomeça em cada caractere e lê até o fim de novo.',
    ),
    t(
      'The time grows with the square of the length: 80 thousand characters took 3.4 s. A long error message, log or JSON locks up the request (or the user’s page).',
      'O tempo cresce com o quadrado do tamanho: 80 mil caracteres levaram 3,4 s. Uma mensagem de erro, log ou JSON comprido trava o pedido (ou a página de quem usa).',
    ),
    t(
      'Anchor the start with a lookbehind — /(?<![\\w.+-])[\\w.+-]+@…/g — and cut the text before the regex (.slice(0, 10_000)).',
      'Ancore o começo com lookbehind — /(?<![\\w.+-])[\\w.+-]+@…/g — e corte o texto antes da regex (.slice(0, 10_000)).',
    ),
  ],
  'falha/randomuuid-sem-alternativa': (c, n) => [
    t(`crypto.randomUUID() with no fallback in code that runs in someone else’s app${places(n)}`, `crypto.randomUUID() sem alternativa em código que roda no app dos outros${places(n)}`),
    t(
      'An SDK, published package or served script calls crypto.randomUUID() directly.',
      'Um SDK, pacote publicado ou script servido chama crypto.randomUUID() direto.',
    ),
    t(
      'It only exists on https/localhost pages, Safari 15.4+ and, without an import, Node 19+. Elsewhere it throws a TypeError inside the app that installed you — often right when it was trying to report an error.',
      'Ele só existe em página https/localhost, Safari 15.4+ e, sem import, Node 19+. Fora disso lança TypeError dentro do app de quem instalou — muitas vezes justo quando ia reportar um erro.',
    ),
    t(
      'Check first (crypto?.randomUUID), fall back to crypto.getRandomValues and then Math.random, and keep the call inside the try.',
      'Teste antes (crypto?.randomUUID), caia para crypto.getRandomValues e depois Math.random, e deixe a chamada dentro do try.',
    ),
  ],
}
