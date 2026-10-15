# Python na web: Django, Flask e FastAPI
Quando ler: `django`, `flask` ou `fastapi` em `requirements*.txt`, `pyproject.toml` ou `Pipfile`; arquivos `settings.py`, `urls.py`, `views.py`, `app.py`, `main.py`, `routers/`.

Primeiro passo: anote o framework e a versão (lockfile). Ache onde as rotas são declaradas: `urls.py` (Django), `@app.route`/`@bp.route` (Flask), `@app.get/post`/`APIRouter` (FastAPI).

## py-rota-sem-auth — Rota que muda dados sem exigir login
- Gravidade típica: alta; crítica se apaga, paga ou muda papéis.
- Onde procurar: Django: views sem `@login_required`, `LoginRequiredMixin` ou `permission_classes` (DRF); Flask: rotas sem `@login_required` (Flask-Login) ou checagem de token; FastAPI: endpoints sem `Depends(get_current_user)` (ou equivalente).
- Como confirmar lendo o código: liste as rotas que aceitam POST/PUT/PATCH/DELETE e veja, uma a uma, se a autenticação está na própria rota ou num router com `dependencies=[Depends(...)]`.
- Descarta se: a rota é pública por desenho (login, cadastro, webhook com assinatura conferida).
- Não descarta: o frontend só mostra o botão para quem está logado.
- Como corrigir: Django `@login_required` / DRF `permission_classes = [IsAuthenticated]`; FastAPI `user = Depends(get_current_user)` no endpoint ou no router.
- CWE: CWE-306

## py-idor — Busca pelo ID recebido sem conferir o dono
- Gravidade típica: alta.
- Onde procurar: `Model.objects.get(id=...)`, `get_object_or_404(Model, pk=pk)`, `session.get(Model, id)`, `db.query(Model).filter(Model.id == id)`.
- Como confirmar lendo o código: a consulta também filtra pelo usuário (`owner=request.user`, `Model.user_id == user.id`) ou há checagem depois?
- Descarta se: a consulta parte do usuário (`request.user.pedidos.get(pk=pk)`) ou há permissão de objeto (DRF `has_object_permission`).
- Como corrigir: `get_object_or_404(Pedido, pk=pk, dono=request.user)`.
- CWE: CWE-639

## py-sql-cru — SQL montado com texto do usuário
- Gravidade típica: alta.
- Onde procurar: `cursor.execute`, `.raw(`, `.extra(`, `text(` do SQLAlchemy, `engine.execute`. A checagem automática pega f-string, `%` e `.format` na mesma linha; leia também SQL montado em várias linhas.
- Descarta se: os valores vão como parâmetros (`execute(sql, (a, b))`, `text("... :id").bindparams(id=x)`).
- Como corrigir: parâmetros sempre; nomes de coluna dinâmicos só de uma lista fixa.
- CWE: CWE-89

## py-validacao-de-entrada — Corpo da requisição usado sem validar
- Gravidade típica: média; alta se o valor vai para consulta, arquivo ou comando.
- Onde procurar: `request.json`, `request.form`, `request.POST`, `await request.json()` usados direto; FastAPI com parâmetro `dict` em vez de modelo Pydantic.
- Como corrigir: Pydantic (FastAPI), Forms/Serializers (Django/DRF), marshmallow ou pydantic no Flask; limite de tamanho do corpo.
- CWE: CWE-20

## py-segredo-e-debug — SECRET_KEY no código e DEBUG ligado
- Gravidade típica: alta.
- Onde procurar: `SECRET_KEY = "..."` em `settings.py`, `app.secret_key = "..."`, `DEBUG = True`, `app.run(debug=True)` (a checagem automática pega o debug fixo), `ALLOWED_HOSTS = ['*']`.
- Descarta se: vem de variável de ambiente e produção define os valores certos.
- Como corrigir: `SECRET_KEY = os.environ["SECRET_KEY"]`, `DEBUG = os.environ.get("DEBUG") == "1"`, `ALLOWED_HOSTS` com o domínio.
- CWE: CWE-798, CWE-489

## py-ssrf — Servidor busca uma URL que o usuário manda
- Gravidade típica: alta (pode ler metadados da nuvem e serviços internos).
- Onde procurar: `requests.get(url)`, `httpx.get(url)`, `urllib.request.urlopen(url)` com `url` vinda da requisição (pré-visualização de link, importar por URL, webhook configurável).
- Como corrigir: lista de domínios permitidos, só `https`, e bloqueio de IPs internos (127.0.0.0/8, 10/8, 169.254.169.254…).
- CWE: CWE-918

## py-upload-e-caminho — Arquivo salvo ou lido com o nome que o usuário mandou
- Gravidade típica: alta.
- Onde procurar: `open(os.path.join(PASTA, nome))`, `send_file(nome)`, `file.save(os.path.join(..., file.filename))`, `FileResponse(caminho)`.
- Como corrigir: `werkzeug.utils.secure_filename`, nome gerado pelo servidor (uuid), e conferir que o caminho final continua dentro da pasta (`Path(...).resolve().is_relative_to(PASTA)`).
- CWE: CWE-22
