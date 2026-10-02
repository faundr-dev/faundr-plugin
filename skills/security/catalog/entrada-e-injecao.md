# Entrada do usuário e injeção
Quando ler: sempre que houver código de servidor que monta consultas, comandos, caminhos de arquivo, templates ou HTML com dados de fora; ou front que renderiza HTML/markdown vindo de usuário, de API externa ou de LLM.

Como trabalhar: para cada candidato, trace fonte → transformação → sink. Fonte = qualquer coisa que o usuário controla (body, query, params, headers, cookies, nome de arquivo, conteúdo de arquivo, webhook de terceiro, saída de LLM, dados já salvos por outro usuário). Sink = o ponto perigoso (query, exec, fs, render). O controle que descarta tem de estar no caminho, antes do sink, e ser do tipo certo para aquele contexto (escapar HTML não protege SQL; `path.join` não é checagem de contenção).

## sqli-raw-e-concatenacao — SQL montado com texto do usuário
- Gravidade típica: crítica (leitura/alteração do banco inteiro, bypass de login). Desce para média se o único valor interpolado é validado como número/enum antes.
- Onde procurar: template strings em SQL. Grep: `` sql` `` com `${` fora de helpers seguros, `$queryRawUnsafe(`, `$executeRawUnsafe(`, `Prisma.raw(`, `sql.raw(` (Drizzle), `knex.raw(` com concatenação, `.whereRaw(`, `.orderByRaw(`, `sequelize.query(` com template, `db.query('... ' + x)`, `pool.query(\`...${`, `env.DB.prepare(\`...${` (Cloudflare D1), `supabase.rpc` chamando função que usa `execute format(` com `%s`.
- Como confirmar lendo o código: veja se o valor entra como parâmetro (placeholder) ou como texto. Formas seguras: `` prisma.$queryRaw`... ${x}` `` (tagged template parametriza), `` sql`... ${x}` `` do Drizzle/`postgres`/`@vercel/postgres`, `db.query('... $1', [x])`, `env.DB.prepare('... ?').bind(x)`. Formas inseguras: `$queryRawUnsafe` com template, `sql.raw(x)`, concatenação com `+`. Identificadores (nome de coluna/tabela em `ORDER BY`) não podem ser parametrizados: precisam de allowlist.
- Descarta se: o valor é passado como parâmetro; ou é um identificador validado contra allowlist fixa (`['created_at','name'].includes(sort)`); ou é convertido para número (`Number.parseInt` com checagem de `NaN`) antes.
- Não descarta: "usa ORM" (os métodos `*Raw`/`*Unsafe` não protegem); escape manual com `replace("'", "''")`; validação Zod `z.string()` (aceita qualquer texto); em PL/pgSQL, `execute 'select ... ' || p_x` ou `format('%s', p_x)` (use `%L`/`%I` ou `using`).
- Como corrigir:
  ```ts
  const rows = await prisma.$queryRaw`SELECT * FROM "Post" WHERE title ILIKE ${'%' + q + '%'}`;
  const col = ({ name: 'name', date: 'created_at' } as const)[sort] ?? 'created_at';
  ```
- CWE: CWE-89

## nosqli-operadores — Objeto do usuário usado como filtro (MongoDB e similares)
- Gravidade típica: crítica em login (`{ password: { $ne: null } }` entra sem senha); alta em consultas de dados.
- Onde procurar: `User.findOne({ email: req.body.email, password: req.body.password })`, `collection.find(req.query)`, `find({ ...req.body })`, `$where`, `$expr` com valores do usuário; `mapReduce`. Também filtros PostgREST montados a partir de texto do usuário (`.or(\`name.ilike.%${q}%\`)`), que permitem injetar condições extras na string de filtro.
- Como confirmar lendo o código: veja se os campos do filtro podem chegar como objeto em vez de string (body JSON aceita `{"$ne": null}`; `qs` do Express converte `?password[$ne]=x` em objeto).
- Descarta se: schema (Zod) exige `z.string()` em cada campo antes do filtro; ou `mongoose` com `sanitizeFilter: true`/`mongo-sanitize`; ou o filtro é montado campo a campo com `String(x)`. Para `.or()` do Supabase: valor do usuário não entra na string do filtro (use `.ilike('name', \`%${q}%\`)`, que parametriza).
- Não descarta: TypeScript dizendo `string` (não valida em tempo de execução).
- Como corrigir: validar tipos com Zod antes da consulta; nunca espalhar `req.query`/`req.body` num filtro.
- CWE: CWE-943

## command-injection — Comando de sistema com texto do usuário
- Gravidade típica: crítica (execução de código no servidor).
- Onde procurar: `child_process.exec(`, `execSync(`, `spawn(..., { shell: true })`, `` $`...` `` (zx/Bun shell com string montada), `new Function(`, `eval(`, `vm.runInNewContext(`; ferramentas que chamam `ffmpeg`, `imagemagick`, `git`, `pdftk`, `yt-dlp` com nome de arquivo ou URL do usuário.
- Como confirmar lendo o código: `exec` passa por shell, então `;`, `|`, `$()` funcionam. `execFile`/`spawn` sem `shell` recebem argumentos em array (seguro contra shell), mas ainda aceitam injeção de opção se o valor começa com `-` (ex.: `git` com `--upload-pack=`).
- Descarta se: `execFile`/`spawn` com array de argumentos, sem `shell: true`, e o valor do usuário vem depois de `--` ou é validado por regex estrita (ex.: `/^[a-zA-Z0-9_-]+$/`).
- Não descarta: aspas em volta do valor (`exec(\`convert "${file}"\`)`); remoção de `;` só.
- Como corrigir: `execFile('ffmpeg', ['-i', '--', inputPath, outPath])` com caminhos gerados pelo servidor; evitar `eval`/`new Function` com qualquer dado externo.
- CWE: CWE-78

## ssti-template — Template montado com texto do usuário
- Gravidade típica: crítica (em EJS/Pug/Handlebars/Nunjucks costuma levar a execução de código); média em engines sem acesso a código.
- Onde procurar: `ejs.render(userString`, `pug.render(`, `Handlebars.compile(userInput)`, `nunjucks.renderString(`, `_.template(userInput)`; e-mails "personalizáveis" pelo usuário; templates salvos no banco e editáveis por clientes.
- Como confirmar lendo o código: o problema é compilar o texto do usuário como template, não passar o valor como variável. `ejs.render(templateFixo, { name: userName })` é seguro; `ejs.render(userTemplate, data)` não é.
- Descarta se: templates fixos no código e o usuário só fornece valores; ou engine sem lógica (Mustache "logic-less") com escape automático e sem helpers perigosos.
- Não descarta: "só admins editam o template" (reduz gravidade, não descarta).
- Como corrigir: não compilar texto do usuário; se precisa de personalização, usar placeholders simples substituídos com `replaceAll('{{name}}', escape(value))`.
- CWE: CWE-1336

## path-traversal — Caminho de arquivo com nome do usuário
- Gravidade típica: crítica em escrita (sobrescreve código/config); alta em leitura (`.env`, chaves, código-fonte).
- Onde procurar: `fs.readFile(`, `fs.createReadStream(`, `fs.writeFile(`, `res.sendFile(`, `res.download(`, `path.join(UPLOAD_DIR, req.params.name)`, extração de zip (`adm-zip`, `unzipper`, `tar`) sem checar entradas, chaves de S3/R2 montadas com nome do usuário.
- Como confirmar lendo o código: `path.join('/uploads', '../../.env')` resolve para fora. Deve haver resolução + checagem de contenção.
- Descarta se: `const p = path.resolve(BASE, name); if (!p.startsWith(BASE + path.sep)) throw ...`; ou o nome é gerado pelo servidor (UUID) e o original fica só no banco; ou allowlist de nomes. Em `res.sendFile(name, { root: BASE })` o Express bloqueia `..` no caminho relativo.
- Não descarta: `name.replace('../', '')` (não recursivo; `....//` passa); checagem antes de decodificar URL; `path.join` sozinho.
- Como corrigir: gerar nomes no servidor; para ler, resolver e conferir contenção; em zips, rejeitar entradas com `..` ou caminho absoluto.
- CWE: CWE-22

## xss-dangerously-set-inner-html — HTML do usuário renderizado sem sanitizar
- Gravidade típica: alta para XSS armazenado (atinge outros usuários, rouba sessão se o token está em `localStorage`, age em nome da vítima); média para refletido; baixa para self-XSS (só o próprio usuário vê o que digitou).
- Onde procurar: React `dangerouslySetInnerHTML`, Vue `v-html`, Svelte `{@html`, Angular `[innerHTML]` com `bypassSecurityTrustHtml`, DOM `innerHTML =`, `outerHTML`, `insertAdjacentHTML`, `document.write`; markdown: `marked(`, `markdown-it` com `html: true`, `react-markdown` com `rehype-raw`, `showdown`; editores ricos (TipTap/Quill) salvando HTML que depois é renderizado cru.
- Como confirmar lendo o código: trace o conteúdo até a origem. Se é do usuário, de terceiro ou de LLM, precisa passar por sanitização com allowlist antes do sink (ou no momento de salvar, desde que todas as escritas passem por ela).
- Descarta se: `DOMPurify.sanitize(html)`/`isomorphic-dompurify`/`sanitize-html` com configuração padrão ou mais restrita no caminho; `react-markdown` sem `rehype-raw` (não renderiza HTML cru); conteúdo 100% estático do código.
- Não descarta: sanitizar com regex (`replace(/<script>/g, '')`); sanitizar no front antes de enviar (o atacante chama a API direto); DOMPurify configurado com `ADD_TAGS: ['iframe']`/`ADD_ATTR: ['onerror']`; sanitizar e depois modificar a string.
- Como corrigir: `<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.html) }} />`, ou renderizar como texto.
- CWE: CWE-79

## xss-href-javascript — URL do usuário em href/src
- Gravidade típica: média a alta (clique executa script no domínio do app).
- Onde procurar: `<a href={user.website}>`, `<iframe src={...}>`, `window.location = param`, `window.open(param)`, `<object data>`; links em perfis, bios, "site da empresa".
- Como confirmar lendo o código: React não bloqueia `javascript:` em `href` (só avisa no console em versões recentes). Veja se a URL é validada por protocolo.
- Descarta se: `new URL(u).protocol` conferido contra `['http:', 'https:']` ao salvar ou renderizar.
- Não descarta: `includes('http')` (aceita `javascript:alert(1)//http`); validação só no formulário do front; bloquear só a string minúscula `javascript:` (`JavaScript:` e espaços/tabs antes também funcionam).
- Como corrigir: `const safe = ['http:', 'https:'].includes(new URL(u).protocol) ? u : '#'` (com try/catch para URL inválida).
- CWE: CWE-79

## prototype-pollution — Merge recursivo com chaves do usuário
- Gravidade típica: média; alta se o objeto poluído afeta autorização (`if (user.isAdmin)` herdado do protótipo) ou leva a execução via gadget.
- Onde procurar: funções de merge profundo próprias (`function deepMerge(target, src)` com `for (const key in src)`), `lodash.merge`/`_.defaultsDeep`/`_.set` com caminho do usuário, `Object.assign` recursivo, parsers de query que aceitam `__proto__`; configurações "salvas pelo usuário" mescladas com defaults.
- Como confirmar lendo o código: veja se chaves `__proto__`, `constructor`, `prototype` são filtradas antes da atribuição e se a origem é JSON do usuário.
- Descarta se: o merge ignora essas chaves, ou usa `Object.create(null)`/`Map`, ou a entrada passa por schema estrito (Zod `z.object` remove chaves desconhecidas) antes do merge; `lodash` atualizado (versões corrigidas bloqueiam `__proto__` em `merge`/`set`).
- Não descarta: `JSON.parse` "é seguro" (ele cria a chave `__proto__` como propriedade própria; o merge é que polui).
- Como corrigir: validar com schema antes; no merge, `if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;`.
- CWE: CWE-1321

## deserializacao-insegura — Desserializar dados do usuário com formato que executa código
- Gravidade típica: crítica.
- Onde procurar: `node-serialize` (`unserialize`), `serialize-javascript` usado ao contrário com `eval`, `js-yaml` `load` em versões antigas (<4) ou com schema que permite funções, `vm`/`eval` sobre JSON; em Python, `pickle.loads`, `yaml.load` sem `SafeLoader`; cookies/sessões serializados sem assinatura.
- Como confirmar lendo o código: identifique a origem dos bytes desserializados; se vêm do usuário, o formato precisa ser só de dados (JSON).
- Descarta se: `JSON.parse` + validação de schema; `yaml.load` do `js-yaml` ≥4 (seguro por padrão); dado assinado pelo servidor (HMAC verificado antes).
- Não descarta: "o cookie é base64" (não é assinatura).
- Como corrigir: trocar por JSON + Zod; assinar o que precisa voltar do cliente.
- CWE: CWE-502

## open-redirect — Redirecionamento para URL do parâmetro
- Gravidade típica: baixa isolado (phishing); média/alta se encadeia com OAuth (vaza `code`/token) ou SSRF.
- Onde procurar: `redirect(searchParams.get('next'))`, `NextResponse.redirect(new URL(param))`, `res.redirect(req.query.url)`, `window.location.href = params.get('returnTo')`, rotas `/go?url=`, `/out?to=`. Caso específico do callback de login em `autenticacao.md` (`oauth-redirect-e-next`).
- Como confirmar lendo o código: veja se o destino é restringido a caminho relativo seguro ou allowlist de origens.
- Descarta se: `raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')`; ou `new URL(raw, base).origin === base` com allowlist.
- Não descarta: `url.includes('meusite.com')` (aceita `meusite.com.evil.io`); `startsWith('https://meusite.com')` (aceita `https://meusite.com.evil.io`).
- Como corrigir: aceitar só caminhos relativos ou IDs de destino mapeados no servidor.
- CWE: CWE-601
