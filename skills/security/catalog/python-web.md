# Python on the web: Django, Flask and FastAPI
When to read: `django`, `flask` or `fastapi` in `requirements*.txt`, `pyproject.toml` or `Pipfile`; `settings.py`, `urls.py`, `views.py`, `app.py`, `main.py` files, `routers/`.

First step: note the framework and the version (lockfile). Find where routes are declared: `urls.py` (Django), `@app.route`/`@bp.route` (Flask), `@app.get/post`/`APIRouter` (FastAPI).

## py-rota-sem-auth — Route that changes data without requiring login
- Typical severity: high; critical if it deletes, pays or changes roles.
- Where to look: Django: views without `@login_required`, `LoginRequiredMixin` or `permission_classes` (DRF); Flask: routes without `@login_required` (Flask-Login) or a token check; FastAPI: endpoints without `Depends(get_current_user)` (or equivalent).
- How to confirm by reading the code: list the routes that accept POST/PUT/PATCH/DELETE and check, one by one, whether authentication is on the route itself or on a router with `dependencies=[Depends(...)]`.
- Ruled out if: the route is public by design (login, sign-up, webhook with a checked signature).
- Not ruled out by: the frontend only shows the button to logged-in users.
- How to fix: Django `@login_required` / DRF `permission_classes = [IsAuthenticated]`; FastAPI `user = Depends(get_current_user)` on the endpoint or the router.
- CWE: CWE-306

## py-idor — Lookup by the received ID without checking the owner
- Typical severity: high.
- Where to look: `Model.objects.get(id=...)`, `get_object_or_404(Model, pk=pk)`, `session.get(Model, id)`, `db.query(Model).filter(Model.id == id)`.
- How to confirm by reading the code: does the query also filter by the user (`owner=request.user`, `Model.user_id == user.id`) or is there a check afterwards?
- Ruled out if: the query starts from the user (`request.user.orders.get(pk=pk)`) or there is an object permission (DRF `has_object_permission`).
- How to fix: `get_object_or_404(Order, pk=pk, owner=request.user)`.
- CWE: CWE-639

## py-sql-cru — SQL built with user text
- Typical severity: high.
- Where to look: `cursor.execute`, `.raw(`, `.extra(`, SQLAlchemy's `text(`, `engine.execute`. The automatic check catches f-strings, `%` and `.format` on the same line; also read SQL built across several lines.
- Ruled out if: the values go in as parameters (`execute(sql, (a, b))`, `text("... :id").bindparams(id=x)`).
- How to fix: always parameters; dynamic column names only from a fixed list.
- CWE: CWE-89

## py-validacao-de-entrada — Request body used without validation
- Typical severity: medium; high if the value goes into a query, file or command.
- Where to look: `request.json`, `request.form`, `request.POST`, `await request.json()` used directly; FastAPI with a `dict` parameter instead of a Pydantic model.
- How to fix: Pydantic (FastAPI), Forms/Serializers (Django/DRF), marshmallow or pydantic in Flask; body size limit.
- CWE: CWE-20

## py-segredo-e-debug — SECRET_KEY in the code and DEBUG on
- Typical severity: high.
- Where to look: `SECRET_KEY = "..."` in `settings.py`, `app.secret_key = "..."`, `DEBUG = True`, `app.run(debug=True)` (the automatic check catches hard-coded debug), `ALLOWED_HOSTS = ['*']`.
- Ruled out if: it comes from an environment variable and production sets the right values.
- How to fix: `SECRET_KEY = os.environ["SECRET_KEY"]`, `DEBUG = os.environ.get("DEBUG") == "1"`, `ALLOWED_HOSTS` with the domain.
- CWE: CWE-798, CWE-489

## py-ssrf — Server fetches a URL the user sends
- Typical severity: high (can read cloud metadata and internal services).
- Where to look: `requests.get(url)`, `httpx.get(url)`, `urllib.request.urlopen(url)` with `url` coming from the request (link preview, import by URL, configurable webhook).
- How to fix: allowlist of domains, `https` only, and blocking internal IPs (127.0.0.0/8, 10/8, 169.254.169.254…).
- CWE: CWE-918

## py-upload-e-caminho — File saved or read with the name the user sent
- Typical severity: high.
- Where to look: `open(os.path.join(FOLDER, name))`, `send_file(name)`, `file.save(os.path.join(..., file.filename))`, `FileResponse(path)`.
- How to fix: `werkzeug.utils.secure_filename`, a server-generated name (uuid), and check that the final path stays inside the folder (`Path(...).resolve().is_relative_to(FOLDER)`).
- CWE: CWE-22
