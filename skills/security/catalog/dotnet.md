# C# and .NET: ASP.NET Core, Minimal APIs and Blazor
When to read: there is a `*.csproj` or `*.sln`; `.cs` files with `[ApiController]`, `app.MapGet/MapPost`, `Controller`, or `.cshtml`/`.razor` pages.

First step: note the .NET version (`TargetFramework` in the `.csproj`) and read `Program.cs`: authentication (`AddAuthentication`, `AddJwtBearer`), authorization (`AddAuthorization`, `FallbackPolicy`), CORS and the order of the `app.Use...` calls.

## cs-rota-sem-auth — Route that changes data without requiring login
- Typical severity: high; critical if it deletes, pays or changes roles.
- Where to look: `[HttpPost]`, `[HttpPut]`, `[HttpDelete]` in controllers without `[Authorize]`; `app.MapPost(...)` without `.RequireAuthorization()`; `[AllowAnonymous]` on an action that changes data.
- How to confirm by reading the code: is there a `FallbackPolicy` requiring an authenticated user in `Program.cs`? If not, each controller or route needs `[Authorize]`.
- Ruled out if: the route is public by design (login, sign-up, webhook with a checked signature).
- Not ruled out by: the frontend only shows the button to logged-in users.
- How to fix: `builder.Services.AddAuthorization(o => o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())` and `[AllowAnonymous]` only on what is public.
- CWE: CWE-306

## cs-idor — Lookup by the received ID without checking the owner
- Typical severity: high.
- Where to look: `db.Orders.FindAsync(id)`, `FirstOrDefaultAsync(p => p.Id == id)` with `id` coming from the route.
- How to confirm by reading the code: does the query also filter by the user (`p.UserId == User.FindFirstValue(ClaimTypes.NameIdentifier)`) or is there an `IAuthorizationService.AuthorizeAsync(User, resource, policy)`?
- Ruled out if: the query starts from the logged-in user or there is a resource check right after.
- How to fix: `FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId)`.
- CWE: CWE-639

## cs-overposting — Entity filled directly from the body (overposting)
- Typical severity: high.
- Where to look: an action that receives the EF entity (`[FromBody] User u`) and does `db.Update(u)`/`SaveChanges`; `TryUpdateModelAsync` without a field list.
- How to confirm by reading the code: does the entity have `Role`, `IsAdmin`, `Balance`, `OwnerId`? Is the input model the entity or a DTO?
- How to fix: a DTO (record) with only the editable fields and a field-by-field copy; the owner comes from `User`, never from the body.
- CWE: CWE-915

## cs-sql-cru — SQL built with outside text
- Typical severity: high.
- Where to look: `FromSqlRaw`, `ExecuteSqlRaw`, `SqlCommand`, `CommandText`, Dapper `Query`/`Execute`. The automatic check catches `$"...{x}"` and `+` on the same line.
- Ruled out if: `FromSqlInterpolated`/`FromSql` (the `{x}` becomes a parameter), `@parameter` with `Parameters.Add`, Dapper with an anonymous object.
- How to fix: LINQ or always parameters; dynamic ordering only from a fixed list.
- CWE: CWE-89

## cs-antiforgery — Cookie-based form without an anti-forgery token
- Typical severity: medium.
- Where to look: MVC/Razor Pages with cookie login: POST actions with `[IgnoreAntiforgeryToken]`, `options.Filters.Add(new IgnoreAntiforgeryTokenAttribute())`, or a Minimal API with `.DisableAntiforgery()` receiving a form.
- Ruled out if: the API uses only a header token (JWT), with no session cookie.
- How to fix: `[ValidateAntiForgeryToken]` (or a global `AutoValidateAntiforgeryTokenAttribute`) and `@Html.AntiForgeryToken()` in the form.
- CWE: CWE-352

## cs-config-e-erros — Configuration that exposes data
- Typical severity: medium to high.
- Where to look: `app.UseDeveloperExceptionPage()` outside `if (app.Environment.IsDevelopment())`, secrets in a committed `appsettings.json`, missing `UseHttpsRedirection`/`UseHsts`, logs with the whole `{@request}`.
- How to fix: developer error page only in Development; secrets in User Secrets or environment variables; HSTS in production.
- CWE: CWE-209, CWE-798
