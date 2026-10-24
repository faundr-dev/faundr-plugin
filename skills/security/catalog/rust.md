# Rust on the web: Axum, Actix Web, Rocket and Warp
When to read: there is a `Cargo.toml`; `.rs` files with `axum::`, `actix_web::`, `rocket::` or `warp::`.

First step: note the framework (from `Cargo.toml`) and find where routes are registered (`Router::new().route(...)`, `App::new().service(...)`, `#[get("/...")]`, `routes![...]`) and where login lives (user extractor, `middleware::from_fn`, `.wrap(...)`, Rocket guard).

## rust-rota-sem-auth — Route that changes data without requiring login
- Typical severity: high; critical if it deletes, pays or changes roles.
- Where to look: `post`/`put`/`patch`/`delete` routes whose handler doesn't receive the user extractor (`AuthUser`, `Claims`, `Session`) and that aren't in a `Router` with the auth layer (`.route_layer(...)`, `.wrap(...)`).
- How to confirm by reading the code: follow the handler to the `Router` and see whether the login layer applies to it; in Axum, a `.layer` applied before a `.route` doesn't protect the route added after it.
- Ruled out if: the route is public by design (login, sign-up, webhook with a checked signature).
- Not ruled out by: the frontend only shows the button to logged-in users.
- How to fix: receive the user as a handler argument (an extractor that fails without a token) or put the route in the group with `route_layer(middleware::from_fn(require_login))`.
- CWE: CWE-306

## rust-idor — Lookup by the received ID without checking the owner
- Typical severity: high.
- Where to look: `Path(id)`, `web::Path<i64>`, `Query(params)` used directly in `sqlx::query!("... where id = $1", id)` or `diesel ... .find(id)`.
- How to confirm by reading the code: does the query also filter by the token's user (`and user_id = $2`) or is there a check afterwards?
- Ruled out if: the query starts from the logged-in user or there is a permission check right after.
- How to fix: `where id = $1 and user_id = $2` with the user id coming from the login extractor, never from the body.
- CWE: CWE-639

## rust-sql-cru — SQL built with outside text
- Typical severity: high.
- Where to look: `sqlx::query(&format!(...))`, `sql_query(format!(...))`, `conn.execute(&sql, ...)`. The automatic check catches `format!` on the same line; also read SQL built across several lines (`let mut sql = String::new(); sql.push_str(...)`) and `QueryBuilder::push` with an outside value (the right one is `push_bind`).
- Ruled out if: the values go through `.bind(...)`, `push_bind` or the `query!` macro.
- How to fix: always parameters; dynamic column name or ordering only from a fixed list (`match` with the accepted values).
- CWE: CWE-89

## rust-validacao-de-entrada — Request body used without validation
- Typical severity: medium.
- Where to look: `Json<T>`/`web::Json<T>`/`Form<T>` with structs that derive `Deserialize` and go straight to the database.
- How to confirm by reading the code: does the struct have fields like `role`, `is_admin`, `user_id`, `price`? Is there `validator::Validate` (`#[validate(...)]` and `.validate()`) or a manual check? `#[serde(deny_unknown_fields)]` helps.
- How to fix: an input struct with only the allowed fields, validation before writing, and the owner coming from the token.
- CWE: CWE-20

## rust-panico-e-limites — Request that crashes or hangs the server
- Typical severity: medium.
- Where to look: `.unwrap()`/`.expect()`/index `[i]` on data that comes from the request (in Axum and Actix a panic only kills the task, but in `std::thread` or synchronous code it can bring everything down); body without a limit (`DefaultBodyLimit::disable()`, a very high `PayloadConfig`); loop or allocation sized by what the client sends (`Vec::with_capacity(n)` with `n` from the request).
- How to fix: handle the error with `?` and a 400 response; keep the body limit (`DefaultBodyLimit::max`) and limit sizes that come from outside.
- CWE: CWE-400, CWE-248

## rust-unsafe — Unsafe block with outside data
- Typical severity: high when the data comes from the request; low in internal code.
- Where to look: `unsafe { ... }`, `from_raw_parts`, `get_unchecked`, `transmute`, `CStr::from_ptr`, FFI (`extern "C"`) receiving a size or pointer computed from the input.
- How to confirm by reading the code: are the size and index checked before the block? Is there a `// SAFETY:` comment saying why it is safe, and is it true?
- How to fix: use the safe versions (`get`, `slice`), check the bounds before the `unsafe` and write the `// SAFETY:`.
- CWE: CWE-119

## rust-segredos-e-config — Secret in the code and weak crypto
- Typical severity: medium to high.
- Where to look: keys in `const`/`static`, hard-coded `DecodingKey::from_secret(b"...")`, `rand::random`/`thread_rng` generating a token (prefer `OsRng`), session cookie without `secure(true)`/`http_only(true)`.
- How to fix: secrets in an environment variable; `rand::rngs::OsRng` for tokens; cookies with `secure`, `http_only` and `same_site`.
- CWE: CWE-798, CWE-338, CWE-614

## rust-arquivo-e-caminho — File path coming from outside
- Typical severity: high.
- Where to look: `tokio::fs::read`, `File::open`, `ServeFile`, `NamedFile::open` with a name coming from the URL; upload saved with `field.file_name()`.
- How to confirm by reading the code: is the path checked after the `join` (`canonicalize` and `starts_with(folder)`)? Are `..` components refused?
- How to fix: generate the file name on the server; check `path.canonicalize()?.starts_with(&folder)` before opening.
- CWE: CWE-22
