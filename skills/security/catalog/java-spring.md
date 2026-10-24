# Java and Kotlin: Spring Boot, Ktor and Android
When to read: there is a `pom.xml`, `build.gradle` or `build.gradle.kts`; `.java`/`.kt` files with `@RestController`, `@Controller`, `routing {` (Ktor) or `AndroidManifest.xml`.

First step: note the framework and the version (Spring Boot, Ktor, Android). Find the security configuration (`SecurityFilterChain`, `@EnableWebSecurity`, `install(Authentication)`) and list the controllers.

## jvm-rota-sem-auth — Route that changes data without requiring login
- Typical severity: high; critical if it deletes, pays or changes roles.
- Where to look: `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`; in Ktor, `post {`/`delete {` outside `authenticate {`. In Spring, overly broad `requestMatchers(...).permitAll()`.
- How to confirm by reading the code: check the route's path against the `SecurityFilterChain` rules (the first one that matches wins) and the `@PreAuthorize`/`@Secured` annotations.
- Ruled out if: the route is public by design (login, sign-up, webhook with a checked signature).
- Not ruled out by: the frontend only shows the button to logged-in users.
- How to fix: `anyRequest().authenticated()` by default and open up only what is public; in Ktor, the route inside `authenticate("auth") { }`.
- CWE: CWE-306

## jvm-idor — Lookup by the received ID without checking the owner
- Typical severity: high.
- Where to look: `@PathVariable Long id` used in `repository.findById(id)`, `findById(id).orElseThrow()`, `em.find(Order.class, id)`.
- How to confirm by reading the code: does the query also filter by the logged-in user (`findByIdAndOwner(id, user)`) or is there a `@PreAuthorize("@guard.isOwner(#id)")`?
- Ruled out if: the query starts from the logged-in user or there is a permission check right after.
- How to fix: `orderRepository.findByIdAndOwnerId(id, auth.getName())`.
- CWE: CWE-639

## jvm-mass-assignment — Entity filled directly from the request body
- Typical severity: high.
- Where to look: `@RequestBody User user` (the JPA entity) saved with `repository.save(user)`; `role`, `admin`, `balance`, `ownerId` fields on the entity.
- How to confirm by reading the code: does the controller receive the entity itself instead of a DTO? Is there `@JsonIgnore`/`@JsonProperty(access = READ_ONLY)` on the sensitive fields?
- How to fix: receive a DTO (record) with only the editable fields and copy it into the entity; the owner comes from the logged-in user.
- CWE: CWE-915

## jvm-sql-cru — SQL or JPQL built with outside text
- Typical severity: high.
- Where to look: `createQuery`, `createNativeQuery`, `@Query(... nativeQuery = true)` with SpEL, `JdbcTemplate.query`, `Statement.execute`. The automatic check catches concatenation, `String.format` and Kotlin templates on the same line.
- Ruled out if: the values go in as parameters (`:name` with `setParameter`, `?` with `PreparedStatement`).
- How to fix: always parameters; dynamic ordering with `Sort.by` from a fixed list of fields.
- CWE: CWE-89

## jvm-actuator-e-config — Admin endpoints exposed
- Typical severity: high.
- Where to look: `management.endpoints.web.exposure.include=*` in `application.properties`/`.yml`, `/actuator/env`, `/actuator/heapdump` without protection; `spring.h2.console.enabled=true`; `server.error.include-stacktrace=always`.
- How to fix: expose only `health` and `info`, protect the rest with admin login, turn off the H2 console outside the local environment.
- CWE: CWE-200

## android-armazenamento-e-webview — Data and WebView in the Android app
- Typical severity: medium to high.
- Where to look: token in plain `SharedPreferences`, `android:allowBackup="true"`, `usesCleartextTraffic="true"`, `WebView` with `setJavaScriptEnabled(true)` + `addJavascriptInterface`, `android:exported="true"` on internal screens.
- How to fix: `EncryptedSharedPreferences`/Keystore for tokens, `network_security_config` without cleartext, WebView only with the app's own content, `exported="false"` on what doesn't need to be opened from outside.
- CWE: CWE-312, CWE-319, CWE-749
