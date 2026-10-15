# PHP e Laravel
Quando ler: arquivos `.php`, `composer.json`, `artisan`, pastas `app/Http`, `routes/`, `resources/views/*.blade.php`. As regras gerais de PHP valem para qualquer projeto; as de Laravel, quando `laravel/framework` está no `composer.json`.

Primeiro passo: anote a versão do PHP (`require.php` no `composer.json`) e do Laravel (`composer.lock`). Confira se `.env` está fora do git e se `APP_DEBUG=false` e `APP_ENV=production` no servidor (a checagem automática já procura `.env` versionado).

## laravel-rota-sem-auth — Rota que muda dados sem middleware de login
- Gravidade típica: alta; crítica se apaga, paga ou muda papéis.
- Onde procurar: `routes/web.php` e `routes/api.php`. Grep: `Route::post`, `Route::put`, `Route::patch`, `Route::delete`, `Route::resource`, `->middleware(`, `Route::middleware(`, `Route::group(`.
- Como confirmar lendo o código: para cada rota que muda dados, veja se ela está dentro de um grupo com `auth`/`auth:sanctum` (ou o controller chama `$this->middleware('auth')` no construtor). Rotas de `api.php` não recebem sessão: precisam de `auth:sanctum` ou token.
- Descarta se: a rota é pública por desenho (cadastro, login, webhook com assinatura conferida).
- Não descarta: o link para a rota só aparece para quem está logado; o botão está escondido na tela.
- Como corrigir: `Route::middleware('auth')->group(function () { ... })` e, na API, `auth:sanctum`.
- CWE: CWE-306

## laravel-idor — Controller busca pelo ID da URL sem conferir o dono
- Gravidade típica: alta.
- Onde procurar: `Model::find($id)`, `findOrFail($request->id)`, route model binding (`show(Pedido $pedido)`) em controllers.
- Como confirmar lendo o código: depois de buscar, o controller confere `$pedido->user_id === auth()->id()`, usa uma Policy (`$this->authorize('view', $pedido)` / `Gate::authorize`) ou busca já filtrando pelo dono (`auth()->user()->pedidos()->findOrFail($id)`)?
- Descarta se: há Policy registrada e chamada em cada ação, ou a consulta parte do usuário logado.
- Não descarta: o ID é um UUID "difícil de adivinhar" (IDs vazam em URLs, e-mails e logs).
- Como corrigir: `$pedido = auth()->user()->pedidos()->findOrFail($id);` ou uma Policy com `authorize`.
- CWE: CWE-639

## laravel-mass-assignment — create/update com tudo o que veio do formulário
- Gravidade típica: alta quando o modelo tem campos como `is_admin`, `role`, `user_id`, `saldo`.
- Onde procurar: `Model::create($request->all())`, `->update($request->all())`, `->fill($request->all())`, `protected $guarded = []` (a checagem automática pega este último).
- Como confirmar lendo o código: veja o `$fillable` do modelo; se ele lista campos sensíveis, ou se `$guarded` está vazio, a pessoa pode mandar esses campos no formulário.
- Descarta se: usa `$request->validated()` com um FormRequest que só valida os campos permitidos, e `$fillable` não tem campos sensíveis.
- Como corrigir: `$fillable` só com o que o formulário pode mudar e `Model::create($request->validated())`.
- CWE: CWE-915

## php-sql-injection — Consulta montada com texto do usuário
- Gravidade típica: alta; crítica em rota pública.
- Onde procurar: `DB::raw`, `DB::select/statement`, `whereRaw`, `orderByRaw`, `selectRaw`, `$pdo->query`, `mysqli_query`. A checagem automática pega os casos com a variável na mesma linha; leia também consultas montadas em várias linhas (`$sql .= " AND nome = '$nome'"`).
- Descarta se: os valores vão como parâmetros (`?` ou `:nome`) e nomes de coluna/ordem vêm de uma lista fixa.
- Não descarta: `addslashes`, `str_replace` de aspas ou `intval` só em alguns campos.
- Como corrigir: query builder (`->where('nome', $nome)`) ou `DB::select('... where id = ?', [$id])`; para `orderBy` dinâmico, compare com uma lista de colunas permitidas.
- CWE: CWE-89

## php-upload-inseguro — Upload que aceita qualquer arquivo ou grava na pasta pública
- Gravidade típica: crítica se dá para enviar `.php` para uma pasta servida pelo servidor.
- Onde procurar: `$request->file(`, `->store(`, `->move(`, `move_uploaded_file`, `$_FILES`.
- Como confirmar lendo o código: há validação de tipo e tamanho (`'arquivo' => 'required|mimes:jpg,png,pdf|max:5120'`)? O nome final é gerado pelo servidor (não o nome enviado)? O destino fica fora de `public/` ou num disco que não executa PHP?
- Como corrigir: valide `mimes` e `max`, use `->store('uploads', 's3')` ou `storage/app`, e sirva por uma rota que confere o dono.
- CWE: CWE-434

## laravel-debug-em-producao — APP_DEBUG ligado ou página de erro detalhada no ar
- Gravidade típica: alta (mostra variáveis de ambiente, consultas e o código).
- Onde procurar: `.env.example`, configs de deploy (`fly.toml`, Dockerfile, `render.yaml`), `config/app.php` com `'debug' => true` fixo.
- Descarta se: `APP_DEBUG` vem de variável de ambiente e o ambiente de produção define `false`.
- Como corrigir: `APP_DEBUG=false` em produção; erros vão para o log ou para o Sentry (`sentry/sentry-laravel`).
- CWE: CWE-489

## laravel-csrf-desligado — Rotas de formulário fora da proteção CSRF
- Gravidade típica: média; alta se a rota muda senha, e-mail ou pagamento.
- Onde procurar: `$except` em `VerifyCsrfToken` (ou `validateCsrfTokens(except: [...])` no `bootstrap/app.php` do Laravel 11), formulários Blade sem `@csrf`.
- Descarta se: a exceção é um webhook que confere a assinatura do provedor.
- Como corrigir: tire a rota do `$except`; em formulários, `@csrf`.
- CWE: CWE-352
