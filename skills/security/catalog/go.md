# Go on the web: net/http, Gin, Echo, Fiber and Chi
When to read: there is a `go.mod`; `.go` files with `http.HandleFunc`, `gin.`, `echo.`, `fiber.` or `chi.`.

First step: note the framework (from `go.mod`) and find where routes are registered (`r.GET`, `e.POST`, `mux.HandleFunc`, `app.Post`) and which middlewares each group uses (`r.Group(..., auth)`, `r.Use(...)`).

## go-rota-sem-auth — Route that changes data without requiring login
- Typical severity: high; critical if it deletes, pays or changes roles.
- Where to look: POST/PUT/PATCH/DELETE routes registered outside the group with the auth middleware.
- How to confirm by reading the code: follow each route to its group (`router.Group`) and see whether the login middleware is on it or on the route itself.
- Ruled out if: the route is public by design (login, sign-up, webhook with a checked signature).
- Not ruled out by: the frontend only shows the button to logged-in users.
- How to fix: register the route inside the protected group (`api := r.Group("/api", authMiddleware)`).
- CWE: CWE-306

## go-idor — Lookup by the received ID without checking the owner
- Typical severity: high.
- Where to look: `c.Param("id")`, `chi.URLParam(r, "id")`, `r.PathValue("id")` used directly in `db.First(&x, id)`, `WHERE id = $1`.
- How to confirm by reading the code: does the query also filter by the context's user (`user_id = $2`) or is there a check afterwards?
- Ruled out if: the query starts from the logged-in user or there is a permission check right after.
- How to fix: `db.Where("id = ? AND user_id = ?", id, userID).First(&order)`.
- CWE: CWE-639

## go-sql-cru — SQL built with outside text
- Typical severity: high.
- Where to look: `db.Query`, `db.Exec`, `QueryRow`, `sqlx.Select`, GORM `Raw`, `Where`, `Order`. The automatic check catches `fmt.Sprintf` and `+` on the same line; also read SQL built across several lines (`strings.Builder`, `sql += ...`).
- Ruled out if: the values go in as parameters (`$1`, `?`, `db.Where("a = ?", x)`).
- How to fix: always parameters; dynamic column name or ordering only from a fixed list (a map of accepted values).
- CWE: CWE-89

## go-validacao-de-entrada — Request body used without validation
- Typical severity: medium.
- Where to look: `json.NewDecoder(r.Body).Decode(&x)`, `c.Bind`, `c.ShouldBindJSON` followed by a database write.
- How to confirm by reading the code: are there `binding:"required"`/`validate:"..."` tags and is the Bind error checked? Do fields like `Role`, `IsAdmin`, `UserID` come from the body?
- How to fix: an input struct with only the allowed fields, `validator` with rules, and the owner coming from the context, never from the body.
- CWE: CWE-20

## go-segredos-e-config — Secret in the code and server without limits
- Typical severity: medium to high.
- Where to look: keys in `const`, `http.ListenAndServe` without `ReadTimeout`/`WriteTimeout`, `r.Body` read without `http.MaxBytesReader`, `math/rand` generating a token or password.
- How to fix: secrets in an environment variable; `http.Server{ReadHeaderTimeout: ...}`; `http.MaxBytesReader`; `crypto/rand` for tokens.
- CWE: CWE-798, CWE-400, CWE-338

## go-arquivo-e-caminho — File path coming from outside
- Typical severity: high.
- Where to look: `os.Open`, `os.ReadFile`, `http.ServeFile`, `c.File` with a name coming from the URL or the form; upload saved with `header.Filename`.
- How to confirm by reading the code: is the path cleaned (`filepath.Clean`) and checked to stay inside the folder (`strings.HasPrefix` after `filepath.Join`)? In Go 1.24+, `os.Root` solves it.
- How to fix: generate the file name on the server and use `os.OpenRoot(folder)` or check the prefix after the Join.
- CWE: CWE-22
