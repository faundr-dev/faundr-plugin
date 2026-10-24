# C and C++: memory, servers and programs that read outside data
When to read: there is a `CMakeLists.txt`, `Makefile`, `meson.build`, `conanfile.*` or `vcpkg.json`; `.c`, `.cpp`, `.h`, `.hpp` files.

First step: find out where outside data comes in — network (`recv`, `read` on a socket, Boost.Asio, Crow, Drogon, cpp-httplib), files the user picks, arguments (`argv`), environment variables — and follow each one to where it is copied, used as a size or passed to the shell or the database.

## c-estouro-de-memoria — Copy without checking the size
- Typical severity: critical when the data comes from the network or an outside file; high otherwise.
- Where to look: `memcpy`, `strncpy`, `read`, `recv`, `fread` and loops that write into a fixed buffer (`char buf[256]`) using a size that comes from the request or the file. The automatic check catches `gets`, `strcpy`, `strcat` and `sprintf`; also read `memcpy(dest, src, len)` with an outside `len` and `buf[i]` without checking `i`.
- How to confirm by reading the code: is the size compared with `sizeof(destination)` (or the allocated capacity) before the copy? Can size arithmetic wrap around (`a + b` in `size_t`, `len - 1` with `len == 0`)?
- Ruled out if: the size is checked against the destination's capacity right before, or the destination is `std::string`/`std::vector` with `push_back`/`assign`.
- How to fix: check the bounds before copying; in C++, `std::string`, `std::vector`, `std::span` and `.at()`; in C, `snprintf` and `strlcpy`.
- CWE: CWE-120, CWE-787, CWE-190

## c-uso-depois-de-liberar — Memory used after free/delete
- Typical severity: high.
- Where to look: `free`/`delete` followed by use of the same pointer, pointers stored in two structures, `return` of a pointer to a local variable, iterator used after `erase`/`push_back` on the same `std::vector`.
- How to confirm by reading the code: after freeing, is the pointer nulled and does no other path still use it?
- How to fix: in C++, `std::unique_ptr`/`std::shared_ptr` instead of `new`/`delete`; in C, null the pointer after `free` and make clear who owns the memory.
- CWE: CWE-416, CWE-415

## c-comando-e-formato — Shell and printf with outside text
- Typical severity: high.
- Where to look: `system`, `popen`, `execl` with `/bin/sh -c`; `printf`/`fprintf`/`syslog` with the message in place of the format. The automatic check catches the variable directly in `system(cmd)` and `printf(msg)`; read how the text was built beforehand (`snprintf(cmd, ..., "convert %s", name)`).
- Ruled out if: the command is fixed, or the program is called without a shell (`execv`/`posix_spawn`) with each argument separate.
- How to fix: `execv`/`posix_spawn` with the argument list; always a fixed format: `printf("%s", msg)`.
- CWE: CWE-78, CWE-134

## c-sql-cru — SQL built with outside text
- Typical severity: high.
- Where to look: `sqlite3_exec`, `mysql_query`, `PQexec` receiving text built with `snprintf`, `std::format`, `+` or `std::ostringstream`.
- Ruled out if: the query uses `sqlite3_prepare_v2` + `sqlite3_bind_*`, `PQexecParams` or the equivalent with parameters.
- How to fix: always parameters; dynamic column name only from a fixed list.
- CWE: CWE-89

## c-servidor-http — Routes without login and outside file paths
- Typical severity: high.
- Where to look: Crow (`CROW_ROUTE`), Drogon (`ADD_METHOD_TO`, filters), cpp-httplib (`svr.Post`), Pistache and Boost.Beast routes that change data without checking a session or token; files served with a name coming from the URL (`std::ifstream(folder + name)`).
- How to confirm by reading the code: does the handler check the token before acting? Is the path normalized (`std::filesystem::weakly_canonical`) and checked to stay inside the folder?
- How to fix: login filter/middleware on routes that change data; check the canonical path's prefix before opening.
- CWE: CWE-306, CWE-22

## c-segredos-e-cripto — Secret in the code and weak crypto
- Typical severity: medium to high.
- Where to look: keys and passwords in `#define`/`const char*`, `rand()`/`srand(time(NULL))` generating a token or password, MD5/SHA1 for passwords, `CURLOPT_SSL_VERIFYPEER 0`.
- How to fix: secrets in an environment variable or a file outside the repository; system random numbers (`getrandom`, `RAND_bytes`, `std::random_device` only for the seed); Argon2 (libsodium `crypto_pwhash`) for passwords.
- CWE: CWE-798, CWE-338, CWE-916

## c-compilacao — Compiler protections turned off
- Typical severity: low to medium.
- Where to look: `CMakeLists.txt`/`Makefile` without `-Wall -Wextra`, with `-fno-stack-protector`, `-z execstack`, `-D_FORTIFY_SOURCE=0`, or a production build without `-O2 -D_FORTIFY_SOURCE=2` and without PIE.
- How to fix: turn on `-Wall -Wextra -Werror` in development, `-fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE -pie` in production, and run the tests with `-fsanitize=address,undefined`.
- CWE: CWE-693
