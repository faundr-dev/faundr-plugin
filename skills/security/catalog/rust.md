# Rust na web: Axum, Actix Web, Rocket e Warp
Quando ler: existe `Cargo.toml`; arquivos `.rs` com `axum::`, `actix_web::`, `rocket::` ou `warp::`.

Primeiro passo: anote o framework (pelo `Cargo.toml`) e ache onde as rotas são registradas (`Router::new().route(...)`, `App::new().service(...)`, `#[get("/...")]`, `routes![...]`) e onde fica o login (extractor de usuário, `middleware::from_fn`, `.wrap(...)`, guard do Rocket).

## rust-rota-sem-auth — Rota que muda dados sem exigir login
- Gravidade típica: alta; crítica se apaga, paga ou muda papéis.
- Onde procurar: rotas `post`/`put`/`patch`/`delete` cujo handler não recebe o extractor de usuário (`AuthUser`, `Claims`, `Session`) e que não estão num `Router` com a camada de autenticação (`.route_layer(...)`, `.wrap(...)`).
- Como confirmar lendo o código: siga o handler até o `Router` e veja se a camada de login vale para ele; no Axum, `.layer` aplicado antes de um `.route` não protege a rota adicionada depois.
- Descarta se: a rota é pública por desenho (login, cadastro, webhook com assinatura conferida).
- Não descarta: o frontend só mostra o botão para quem está logado.
- Como corrigir: receba o usuário como argumento do handler (extractor que falha sem token) ou ponha a rota no grupo com `route_layer(middleware::from_fn(exige_login))`.
- CWE: CWE-306

## rust-idor — Busca pelo ID recebido sem conferir o dono
- Gravidade típica: alta.
- Onde procurar: `Path(id)`, `web::Path<i64>`, `Query(params)` usados direto em `sqlx::query!("... where id = $1", id)` ou `diesel ... .find(id)`.
- Como confirmar lendo o código: a consulta também filtra pelo usuário do token (`and user_id = $2`) ou há checagem depois?
- Descarta se: a consulta parte do usuário logado ou há checagem de permissão logo depois.
- Como corrigir: `where id = $1 and user_id = $2` com o id do usuário vindo do extractor de login, nunca do corpo.
- CWE: CWE-639

## rust-sql-cru — SQL montado com texto de fora
- Gravidade típica: alta.
- Onde procurar: `sqlx::query(&format!(...))`, `sql_query(format!(...))`, `conn.execute(&sql, ...)`. A checagem automática pega o `format!` na mesma linha; leia também o SQL montado em várias linhas (`let mut sql = String::new(); sql.push_str(...)`) e o `QueryBuilder::push` com valor de fora (o certo é `push_bind`).
- Descarta se: os valores vão por `.bind(...)`, `push_bind` ou pela macro `query!`.
- Como corrigir: parâmetros sempre; nome de coluna ou ordenação dinâmica só de uma lista fixa (`match` com os valores aceitos).
- CWE: CWE-89

## rust-validacao-de-entrada — Corpo da requisição usado sem validar
- Gravidade típica: média.
- Onde procurar: `Json<T>`/`web::Json<T>`/`Form<T>` com structs que derivam `Deserialize` e vão direto para o banco.
- Como confirmar lendo o código: a struct tem campos como `role`, `is_admin`, `user_id`, `preco`? Há `validator::Validate` (`#[validate(...)]` e `.validate()`) ou checagem manual? `#[serde(deny_unknown_fields)]` ajuda.
- Como corrigir: struct de entrada só com os campos permitidos, validação antes de gravar, e o dono vindo do token.
- CWE: CWE-20

## rust-panico-e-limites — Pedido que derruba ou trava o servidor
- Gravidade típica: média.
- Onde procurar: `.unwrap()`/`.expect()`/índice `[i]` em dado que vem do pedido (no Axum e no Actix o panic derruba só a tarefa, mas em `std::thread` ou código síncrono pode derrubar tudo); corpo sem limite (`DefaultBodyLimit::disable()`, `PayloadConfig` muito alto); laço ou alocação pelo tamanho que o cliente manda (`Vec::with_capacity(n)` com `n` do pedido).
- Como corrigir: trate o erro com `?` e uma resposta 400; mantenha o limite de corpo (`DefaultBodyLimit::max`) e limite os tamanhos vindos de fora.
- CWE: CWE-400, CWE-248

## rust-unsafe — Bloco unsafe com dado de fora
- Gravidade típica: alta quando o dado vem do pedido; baixa em código interno.
- Onde procurar: `unsafe { ... }`, `from_raw_parts`, `get_unchecked`, `transmute`, `CStr::from_ptr`, FFI (`extern "C"`) recebendo tamanho ou ponteiro calculado a partir da entrada.
- Como confirmar lendo o código: o tamanho e o índice são conferidos antes do bloco? Há um comentário `// SAFETY:` dizendo por que é seguro, e ele é verdade?
- Como corrigir: use as versões seguras (`get`, `slice`), confira os limites antes do `unsafe` e escreva o `// SAFETY:`.
- CWE: CWE-119

## rust-segredos-e-config — Segredo no código e cripto fraca
- Gravidade típica: média a alta.
- Onde procurar: chaves em `const`/`static`, `DecodingKey::from_secret(b"...")` fixo, `rand::random`/`thread_rng` gerando token (prefira `OsRng`), cookie de sessão sem `secure(true)`/`http_only(true)`.
- Como corrigir: segredos em variável de ambiente; `rand::rngs::OsRng` para tokens; cookies com `secure`, `http_only` e `same_site`.
- CWE: CWE-798, CWE-338, CWE-614

## rust-arquivo-e-caminho — Caminho de arquivo vindo de fora
- Gravidade típica: alta.
- Onde procurar: `tokio::fs::read`, `File::open`, `ServeFile`, `NamedFile::open` com nome vindo da URL; upload salvo com `field.file_name()`.
- Como confirmar lendo o código: o caminho é conferido depois do `join` (`canonicalize` e `starts_with(pasta)`)? Componentes `..` são recusados?
- Como corrigir: gere o nome do arquivo no servidor; confira `caminho.canonicalize()?.starts_with(&pasta)` antes de abrir.
- CWE: CWE-22
