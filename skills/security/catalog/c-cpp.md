# C e C++: memória, servidores e programas que leem dados de fora
Quando ler: existe `CMakeLists.txt`, `Makefile`, `meson.build`, `conanfile.*` ou `vcpkg.json`; arquivos `.c`, `.cpp`, `.h`, `.hpp`.

Primeiro passo: descubra por onde entram dados de fora — rede (`recv`, `read` num socket, Boost.Asio, Crow, Drogon, cpp-httplib), arquivos que o usuário escolhe, argumentos (`argv`), variáveis de ambiente — e siga cada um até onde é copiado, usado como tamanho ou passado ao shell ou ao banco.

## c-estouro-de-memoria — Cópia sem conferir o tamanho
- Gravidade típica: crítica quando o dado vem da rede ou de um arquivo de fora; alta nos outros casos.
- Onde procurar: `memcpy`, `strncpy`, `read`, `recv`, `fread` e laços que escrevem num buffer fixo (`char buf[256]`) usando um tamanho que vem do pedido ou do arquivo. A checagem automática pega `gets`, `strcpy`, `strcat` e `sprintf`; leia também o `memcpy(dest, src, len)` com `len` de fora e o `buf[i]` sem conferir `i`.
- Como confirmar lendo o código: o tamanho é comparado com `sizeof(destino)` (ou a capacidade alocada) antes da cópia? Contas de tamanho podem dar a volta (`a + b` em `size_t`, `len - 1` com `len == 0`)?
- Descarta se: o tamanho é conferido contra a capacidade do destino logo antes, ou o destino é `std::string`/`std::vector` com `push_back`/`assign`.
- Como corrigir: confira os limites antes de copiar; em C++, `std::string`, `std::vector`, `std::span` e `.at()`; em C, `snprintf` e `strlcpy`.
- CWE: CWE-120, CWE-787, CWE-190

## c-uso-depois-de-liberar — Memória usada depois do free/delete
- Gravidade típica: alta.
- Onde procurar: `free`/`delete` seguidos de uso do mesmo ponteiro, ponteiros guardados em duas estruturas, `return` de ponteiro para variável local, iterador usado depois de `erase`/`push_back` no mesmo `std::vector`.
- Como confirmar lendo o código: depois de liberar, o ponteiro é zerado e nenhum outro caminho ainda o usa?
- Como corrigir: em C++, `std::unique_ptr`/`std::shared_ptr` em vez de `new`/`delete`; em C, zere o ponteiro depois do `free` e deixe claro quem é o dono da memória.
- CWE: CWE-416, CWE-415

## c-comando-e-formato — Shell e printf com texto de fora
- Gravidade típica: alta.
- Onde procurar: `system`, `popen`, `execl` com `/bin/sh -c`; `printf`/`fprintf`/`syslog` com a mensagem no lugar do formato. A checagem automática pega a variável direto no `system(cmd)` e no `printf(msg)`; leia como o texto foi montado antes (`snprintf(cmd, ..., "convert %s", nome)`).
- Descarta se: o comando é fixo, ou o programa é chamado sem shell (`execv`/`posix_spawn`) com cada argumento separado.
- Como corrigir: `execv`/`posix_spawn` com a lista de argumentos; formato sempre fixo: `printf("%s", msg)`.
- CWE: CWE-78, CWE-134

## c-sql-cru — SQL montado com texto de fora
- Gravidade típica: alta.
- Onde procurar: `sqlite3_exec`, `mysql_query`, `PQexec` recebendo texto montado com `snprintf`, `std::format`, `+` ou `std::ostringstream`.
- Descarta se: a consulta usa `sqlite3_prepare_v2` + `sqlite3_bind_*`, `PQexecParams` ou o equivalente com parâmetros.
- Como corrigir: parâmetros sempre; nome de coluna dinâmico só de uma lista fixa.
- CWE: CWE-89

## c-servidor-http — Rotas sem login e caminho de arquivo de fora
- Gravidade típica: alta.
- Onde procurar: rotas do Crow (`CROW_ROUTE`), Drogon (`ADD_METHOD_TO`, filtros), cpp-httplib (`svr.Post`), Pistache e Boost.Beast que mudam dados sem conferir sessão ou token; arquivos servidos com nome vindo da URL (`std::ifstream(pasta + nome)`).
- Como confirmar lendo o código: o handler confere o token antes de agir? O caminho é normalizado (`std::filesystem::weakly_canonical`) e conferido para ficar dentro da pasta?
- Como corrigir: filtro/middleware de login nas rotas que mudam dados; confira o prefixo do caminho canônico antes de abrir.
- CWE: CWE-306, CWE-22

## c-segredos-e-cripto — Segredo no código e cripto fraca
- Gravidade típica: média a alta.
- Onde procurar: chaves e senhas em `#define`/`const char*`, `rand()`/`srand(time(NULL))` gerando token ou senha, MD5/SHA1 para senha, `CURLOPT_SSL_VERIFYPEER 0`.
- Como corrigir: segredos em variável de ambiente ou arquivo fora do repositório; números aleatórios do sistema (`getrandom`, `RAND_bytes`, `std::random_device` só para semente); Argon2 (libsodium `crypto_pwhash`) para senha.
- CWE: CWE-798, CWE-338, CWE-916

## c-compilacao — Proteções do compilador desligadas
- Gravidade típica: baixa a média.
- Onde procurar: `CMakeLists.txt`/`Makefile` sem `-Wall -Wextra`, com `-fno-stack-protector`, `-z execstack`, `-D_FORTIFY_SOURCE=0`, ou build de produção sem `-O2 -D_FORTIFY_SOURCE=2` e sem PIE.
- Como corrigir: ligue `-Wall -Wextra -Werror` no desenvolvimento, `-fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE -pie` na produção, e rode os testes com `-fsanitize=address,undefined`.
- CWE: CWE-693
