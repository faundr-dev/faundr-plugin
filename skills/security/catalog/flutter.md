# Flutter and Dart
When to read: `pubspec.yaml` with `flutter:`; `lib/`, `android/`, `ios/` folders. Remember: the app goes onto the person's device, and everything inside it (keys, addresses, rules) can be read by whoever downloads the app.

First step: note the backend the app uses (Supabase, Firebase, own API) and also read its topic (`supabase.md`, `firebase.md`): in a mobile app, the real security lives in the backend.

## flutter-segredo-no-app — Secret key inside the app
- Typical severity: critical if it is a server key (Supabase service_role, Stripe secret key, OpenAI key).
- Where to look: `lib/**` (constants, `.env` bundled as an asset in `pubspec.yaml`, `String.fromEnvironment`), `android/app/src/main/res/values/*.xml`, `ios/Runner/Info.plist`. The automatic key check already looks for known patterns; here, check the ones only you recognize by name.
- How to confirm by reading the code: does the key give access to anything beyond what the user can do themselves? A public key (Supabase anon with RLS, Stripe publishable key) is expected in the app.
- How to fix: move the call to the server (Edge Function, Cloud Function, own API) and keep only the public key in the app.
- CWE: CWE-798

## flutter-armazenamento-inseguro — Token or personal data in SharedPreferences or a plain file
- Typical severity: medium; high for long-lived tokens.
- Where to look: `SharedPreferences`, `Hive` without encryption, `File(...).writeAsString` with a token, password, CPF. The automatic check catches `setString` with a token-like name.
- How to fix: `flutter_secure_storage` (Keychain/Keystore) for tokens; encryption (`HiveAesCipher`) for stored personal data.
- CWE: CWE-922

## flutter-rede-insegura — Unencrypted HTTP or certificate accepted without checking
- Typical severity: high.
- Where to look: `http://` addresses (the automatic check catches them), `badCertificateCallback`, `android:usesCleartextTraffic="true"` in `AndroidManifest.xml`, `NSAllowsArbitraryLoads` in `Info.plist`.
- How to fix: `https://` only; remove the cleartext traffic exceptions; internal certificate only in debug builds.
- CWE: CWE-319, CWE-295

## flutter-regra-so-no-app — Permission checked only on the screen
- Typical severity: high.
- Where to look: admin screens hidden by `if (user.isAdmin)`, disabled buttons, per-user filters done in the app after fetching everything.
- How to confirm by reading the code: does the backend query already come filtered by the user (RLS in Supabase, Firestore rules, check in the API)? If the app fetches everything and filters on the screen, anyone with the token reads other people's data directly from the API.
- How to fix: the rule goes to the backend (RLS, Security Rules, check on the route); the screen only reflects it.
- CWE: CWE-602

## flutter-webview — WebView with JavaScript and outside content
- Typical severity: medium; high if the WebView exposes channels to Dart (`addJavaScriptChannel`) with sensitive actions.
- Where to look: `WebViewController`, `JavaScriptMode.unrestricted`, `loadRequest(Uri.parse(url))` with `url` coming from outside, `addJavaScriptChannel`.
- How to fix: load only your own domains (`NavigationDelegate` blocking the rest) and validate the messages received through the channels.
- CWE: CWE-749

## flutter-deep-link — App link that performs an action without confirming
- Typical severity: medium.
- Where to look: `go_router`/`uni_links`/`app_links` with routes that do something directly (confirm payment, change email, accept invite).
- How to fix: the link only opens the screen; the action asks for confirmation and the backend checks the link's token.
- CWE: CWE-939
