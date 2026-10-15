# Go na web: net/http, Gin, Echo, Fiber e Chi
Quando ler: existe `go.mod`; arquivos `.go` com `http.HandleFunc`, `gin.`, `echo.`, `fiber.` ou `chi.`.

Primeiro passo: anote o framework (pelo `go.mod`) e ache onde as rotas são registradas (`r.GET`, `e.POST`, `mux.HandleFunc`, `app.Post`) e quais middlewares cada grupo usa (`r.Group(..., auth)`, `r.Use(...)`).

## go-rota-sem-auth — Rota que muda dados sem exigir login
- Gravidade típica: alta; crítica se apaga, paga ou muda papéis.
- Onde procurar: rotas POST/PUT/PATCH/DELETE registradas fora do grupo com o middleware de autenticação.
- Como confirmar lendo o código: siga cada rota até o grupo (`router.Group`) e veja se o middleware de login está nele ou na própria rota.
- Descarta se: a rota é pública por desenho (login, cadastro, webhook com assinatura conferida).
- Não descarta: o frontend só mostra o botão para quem está logado.
- Como corrigir: registre a rota dentro do grupo protegido (`api := r.Group("/api", authMiddleware)`).
- CWE: CWE-306

## go-idor — Busca pelo ID recebido sem conferir o dono
- Gravidade típica: alta.
- Onde procurar: `c.Param("id")`, `chi.URLParam(r, "id")`, `r.PathValue("id")` usados direto em `db.First(&x, id)`, `WHERE id = $1`.
- Como confirmar lendo o código: a consulta também filtra pelo usuário do contexto (`user_id = $2`) ou há checagem depois?
- Descarta se: a consulta parte do usuário logado ou há checagem de permissão logo depois.
- Como corrigir: `db.Where("id = ? AND user_id = ?", id, userID).First(&pedido)`.
- CWE: CWE-639

## go-sql-cru — SQL montado com texto de fora
- Gravidade típica: alta.
- Onde procurar: `db.Query`, `db.Exec`, `QueryRow`, `sqlx.Select`, GORM `Raw`, `Where`, `Order`. A checagem automática pega `fmt.Sprintf` e `+` na mesma linha; leia também SQL montado em várias linhas (`strings.Builder`, `sql += ...`).
- Descarta se: os valores vão como parâmetros (`$1`, `?`, `db.Where("a = ?", x)`).
- Como corrigir: parâmetros sempre; nome de coluna ou ordenação dinâmica só de uma lista fixa (map de valores aceitos).
- CWE: CWE-89

## go-validacao-de-entrada — Corpo da requisição usado sem validar
- Gravidade típica: média.
- Onde procurar: `json.NewDecoder(r.Body).Decode(&x)`, `c.Bind`, `c.ShouldBindJSON` seguido de gravação no banco.
- Como confirmar lendo o código: há tags `binding:"required"`/`validate:"..."` e a checagem do erro do Bind? Campos como `Role`, `IsAdmin`, `UserID` vêm do corpo?
- Como corrigir: struct de entrada só com os campos permitidos, `validator` com regras, e o dono vindo do contexto, nunca do corpo.
- CWE: CWE-20

## go-segredos-e-config — Segredo no código e servidor sem limites
- Gravidade típica: média a alta.
- Onde procurar: chaves em `const`, `http.ListenAndServe` sem `ReadTimeout`/`WriteTimeout`, `r.Body` lido sem `http.MaxBytesReader`, `math/rand` gerando token ou senha.
- Como corrigir: segredos em variável de ambiente; `http.Server{ReadHeaderTimeout: ...}`; `http.MaxBytesReader`; `crypto/rand` para tokens.
- CWE: CWE-798, CWE-400, CWE-338

## go-arquivo-e-caminho — Caminho de arquivo vindo de fora
- Gravidade típica: alta.
- Onde procurar: `os.Open`, `os.ReadFile`, `http.ServeFile`, `c.File` com nome vindo da URL ou do formulário; upload salvo com `header.Filename`.
- Como confirmar lendo o código: o caminho é limpo (`filepath.Clean`) e conferido para ficar dentro da pasta (`strings.HasPrefix` depois do `filepath.Join`)? Em Go 1.24+, `os.Root` resolve.
- Como corrigir: gere o nome do arquivo no servidor e use `os.OpenRoot(pasta)` ou confira o prefixo depois do Join.
- CWE: CWE-22
