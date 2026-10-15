# Java e Kotlin: Spring Boot, Ktor e Android
Quando ler: existe `pom.xml`, `build.gradle` ou `build.gradle.kts`; arquivos `.java`/`.kt` com `@RestController`, `@Controller`, `routing {` (Ktor) ou `AndroidManifest.xml`.

Primeiro passo: anote o framework e a versão (Spring Boot, Ktor, Android). Ache a configuração de segurança (`SecurityFilterChain`, `@EnableWebSecurity`, `install(Authentication)`) e liste os controladores.

## jvm-rota-sem-auth — Rota que muda dados sem exigir login
- Gravidade típica: alta; crítica se apaga, paga ou muda papéis.
- Onde procurar: `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`; no Ktor, `post {`/`delete {` fora de `authenticate {`. No Spring, `requestMatchers(...).permitAll()` amplos demais.
- Como confirmar lendo o código: confira o caminho da rota contra as regras do `SecurityFilterChain` (a primeira que casa vale) e as anotações `@PreAuthorize`/`@Secured`.
- Descarta se: a rota é pública por desenho (login, cadastro, webhook com assinatura conferida).
- Não descarta: o frontend só mostra o botão para quem está logado.
- Como corrigir: `anyRequest().authenticated()` por padrão e liberar só o que é público; no Ktor, a rota dentro de `authenticate("auth") { }`.
- CWE: CWE-306

## jvm-idor — Busca pelo ID recebido sem conferir o dono
- Gravidade típica: alta.
- Onde procurar: `@PathVariable Long id` usado em `repository.findById(id)`, `findById(id).orElseThrow()`, `em.find(Pedido.class, id)`.
- Como confirmar lendo o código: a consulta também filtra pelo usuário logado (`findByIdAndOwner(id, user)`) ou há `@PreAuthorize("@guard.isOwner(#id)")`?
- Descarta se: a consulta parte do usuário logado ou há checagem de permissão logo depois.
- Como corrigir: `pedidoRepository.findByIdAndOwnerId(id, auth.getName())`.
- CWE: CWE-639

## jvm-mass-assignment — Entidade preenchida direto do corpo da requisição
- Gravidade típica: alta.
- Onde procurar: `@RequestBody Usuario usuario` (a entidade JPA) salvo com `repository.save(usuario)`; campos `role`, `admin`, `saldo`, `ownerId` na entidade.
- Como confirmar lendo o código: o controlador recebe a própria entidade em vez de um DTO? Há `@JsonIgnore`/`@JsonProperty(access = READ_ONLY)` nos campos sensíveis?
- Como corrigir: receba um DTO (record) só com os campos editáveis e copie para a entidade; o dono vem do usuário logado.
- CWE: CWE-915

## jvm-sql-cru — SQL ou JPQL montado com texto de fora
- Gravidade típica: alta.
- Onde procurar: `createQuery`, `createNativeQuery`, `@Query(... nativeQuery = true)` com SpEL, `JdbcTemplate.query`, `Statement.execute`. A checagem automática pega concatenação, `String.format` e template do Kotlin na mesma linha.
- Descarta se: os valores vão como parâmetros (`:nome` com `setParameter`, `?` com `PreparedStatement`).
- Como corrigir: parâmetros sempre; ordenação dinâmica com `Sort.by` de uma lista fixa de campos.
- CWE: CWE-89

## jvm-actuator-e-config — Endpoints de administração expostos
- Gravidade típica: alta.
- Onde procurar: `management.endpoints.web.exposure.include=*` no `application.properties`/`.yml`, `/actuator/env`, `/actuator/heapdump` sem proteção; `spring.h2.console.enabled=true`; `server.error.include-stacktrace=always`.
- Como corrigir: exponha só `health` e `info`, proteja o resto com login de admin, desligue o console do H2 fora do ambiente local.
- CWE: CWE-200

## android-armazenamento-e-webview — Dados e WebView no app Android
- Gravidade típica: média a alta.
- Onde procurar: token em `SharedPreferences` comum, `android:allowBackup="true"`, `usesCleartextTraffic="true"`, `WebView` com `setJavaScriptEnabled(true)` + `addJavascriptInterface`, `android:exported="true"` em telas internas.
- Como corrigir: `EncryptedSharedPreferences`/Keystore para tokens, `network_security_config` sem cleartext, WebView só com conteúdo próprio, `exported="false"` no que não precisa ser aberto de fora.
- CWE: CWE-312, CWE-319, CWE-749
