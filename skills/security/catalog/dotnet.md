# C# e .NET: ASP.NET Core, Minimal APIs e Blazor
Quando ler: existe `*.csproj` ou `*.sln`; arquivos `.cs` com `[ApiController]`, `app.MapGet/MapPost`, `Controller`, ou páginas `.cshtml`/`.razor`.

Primeiro passo: anote a versão do .NET (`TargetFramework` no `.csproj`) e leia o `Program.cs`: autenticação (`AddAuthentication`, `AddJwtBearer`), autorização (`AddAuthorization`, `FallbackPolicy`), CORS e a ordem dos `app.Use...`.

## cs-rota-sem-auth — Rota que muda dados sem exigir login
- Gravidade típica: alta; crítica se apaga, paga ou muda papéis.
- Onde procurar: `[HttpPost]`, `[HttpPut]`, `[HttpDelete]` em controladores sem `[Authorize]`; `app.MapPost(...)` sem `.RequireAuthorization()`; `[AllowAnonymous]` em ação que muda dados.
- Como confirmar lendo o código: há `FallbackPolicy` exigindo usuário autenticado no `Program.cs`? Se não, cada controlador ou rota precisa do `[Authorize]`.
- Descarta se: a rota é pública por desenho (login, cadastro, webhook com assinatura conferida).
- Não descarta: o frontend só mostra o botão para quem está logado.
- Como corrigir: `builder.Services.AddAuthorization(o => o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())` e `[AllowAnonymous]` só no que é público.
- CWE: CWE-306

## cs-idor — Busca pelo ID recebido sem conferir o dono
- Gravidade típica: alta.
- Onde procurar: `db.Pedidos.FindAsync(id)`, `FirstOrDefaultAsync(p => p.Id == id)` com `id` vindo da rota.
- Como confirmar lendo o código: a consulta também filtra pelo usuário (`p.UserId == User.FindFirstValue(ClaimTypes.NameIdentifier)`) ou há `IAuthorizationService.AuthorizeAsync(User, recurso, política)`?
- Descarta se: a consulta parte do usuário logado ou há checagem de recurso logo depois.
- Como corrigir: `FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId)`.
- CWE: CWE-639

## cs-overposting — Entidade preenchida direto do corpo (overposting)
- Gravidade típica: alta.
- Onde procurar: ação que recebe a entidade do EF (`[FromBody] Usuario u`) e faz `db.Update(u)`/`SaveChanges`; `TryUpdateModelAsync` sem lista de campos.
- Como confirmar lendo o código: a entidade tem `Role`, `IsAdmin`, `Saldo`, `OwnerId`? O modelo de entrada é a entidade ou um DTO?
- Como corrigir: DTO (record) só com os campos editáveis e cópia campo a campo; o dono vem do `User`, nunca do corpo.
- CWE: CWE-915

## cs-sql-cru — SQL montado com texto de fora
- Gravidade típica: alta.
- Onde procurar: `FromSqlRaw`, `ExecuteSqlRaw`, `SqlCommand`, `CommandText`, Dapper `Query`/`Execute`. A checagem automática pega `$"...{x}"` e `+` na mesma linha.
- Descarta se: `FromSqlInterpolated`/`FromSql` (o `{x}` vira parâmetro), `@parametro` com `Parameters.Add`, Dapper com objeto anônimo.
- Como corrigir: LINQ ou parâmetros sempre; ordenação dinâmica só de uma lista fixa.
- CWE: CWE-89

## cs-antiforgery — Formulário com cookie sem token antifalsificação
- Gravidade típica: média.
- Onde procurar: MVC/Razor Pages com login por cookie: ações POST com `[IgnoreAntiforgeryToken]`, `options.Filters.Add(new IgnoreAntiforgeryTokenAttribute())`, ou Minimal API com `.DisableAntiforgery()` recebendo formulário.
- Descarta se: a API usa só token no cabeçalho (JWT), sem cookie de sessão.
- Como corrigir: `[ValidateAntiForgeryToken]` (ou `AutoValidateAntiforgeryTokenAttribute` global) e o `@Html.AntiForgeryToken()` no formulário.
- CWE: CWE-352

## cs-config-e-erros — Configuração que expõe dados
- Gravidade típica: média a alta.
- Onde procurar: `app.UseDeveloperExceptionPage()` fora do `if (app.Environment.IsDevelopment())`, segredos no `appsettings.json` versionado, `UseHttpsRedirection`/`UseHsts` ausentes, logs com `{@request}` inteiro.
- Como corrigir: página de erro de desenvolvimento só em Development; segredos em User Secrets ou variáveis de ambiente; HSTS em produção.
- CWE: CWE-209, CWE-798
