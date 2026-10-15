# Flutter e Dart
Quando ler: `pubspec.yaml` com `flutter:`; pastas `lib/`, `android/`, `ios/`. Lembre: o app vai para o aparelho da pessoa, e tudo o que está dentro dele (chaves, endereços, regras) pode ser lido por quem baixar o app.

Primeiro passo: anote o backend que o app usa (Supabase, Firebase, API própria) e leia também o tema dele (`supabase.md`, `firebase.md`): no app de celular, a segurança de verdade mora no backend.

## flutter-segredo-no-app — Chave secreta dentro do app
- Gravidade típica: crítica se é chave de servidor (service_role do Supabase, chave secreta do Stripe, chave da OpenAI).
- Onde procurar: `lib/**` (constantes, `.env` empacotado como asset no `pubspec.yaml`, `String.fromEnvironment`), `android/app/src/main/res/values/*.xml`, `ios/Runner/Info.plist`. A checagem automática de chaves já procura padrões conhecidos; aqui confira as que só você reconhece pelo nome.
- Como confirmar lendo o código: a chave dá acesso a algo além do que o próprio usuário pode fazer? Chave pública (anon do Supabase com RLS, chave publicável do Stripe) é esperada no app.
- Como corrigir: mova a chamada para o servidor (Edge Function, Cloud Function, API própria) e deixe no app só a chave pública.
- CWE: CWE-798

## flutter-armazenamento-inseguro — Token ou dado pessoal em SharedPreferences ou arquivo comum
- Gravidade típica: média; alta para tokens de longa duração.
- Onde procurar: `SharedPreferences`, `Hive` sem criptografia, `File(...).writeAsString` com token, senha, CPF. A checagem automática pega `setString` com nome de token.
- Como corrigir: `flutter_secure_storage` (Keychain/Keystore) para tokens; criptografia (`HiveAesCipher`) para dados pessoais guardados.
- CWE: CWE-922

## flutter-rede-insegura — HTTP sem criptografia ou certificado aceito sem conferir
- Gravidade típica: alta.
- Onde procurar: endereços `http://` (a checagem automática pega), `badCertificateCallback`, `android:usesCleartextTraffic="true"` no `AndroidManifest.xml`, `NSAllowsArbitraryLoads` no `Info.plist`.
- Como corrigir: só `https://`; tire as exceções de tráfego aberto; certificado interno só em build de debug.
- CWE: CWE-319, CWE-295

## flutter-regra-so-no-app — Permissão conferida só na tela
- Gravidade típica: alta.
- Onde procurar: telas de admin escondidas por `if (user.isAdmin)`, botões desabilitados, filtros por usuário feitos no app depois de buscar tudo.
- Como confirmar lendo o código: a consulta ao backend já vem filtrada pelo usuário (RLS no Supabase, regras do Firestore, checagem na API)? Se o app busca tudo e filtra na tela, qualquer um com o token lê os dados dos outros direto na API.
- Como corrigir: a regra vai para o backend (RLS, Security Rules, checagem na rota); a tela só reflete.
- CWE: CWE-602

## flutter-webview — WebView com JavaScript e conteúdo de fora
- Gravidade típica: média; alta se o WebView expõe canais para o Dart (`addJavaScriptChannel`) com ações sensíveis.
- Onde procurar: `WebViewController`, `JavaScriptMode.unrestricted`, `loadRequest(Uri.parse(url))` com `url` vinda de fora, `addJavaScriptChannel`.
- Como corrigir: carregue só domínios seus (`NavigationDelegate` bloqueando o resto) e valide as mensagens recebidas pelos canais.
- CWE: CWE-749

## flutter-deep-link — Link do app que executa ação sem confirmar
- Gravidade típica: média.
- Onde procurar: `go_router`/`uni_links`/`app_links` com rotas que fazem algo direto (confirmar pagamento, trocar e-mail, aceitar convite).
- Como corrigir: o link só abre a tela; a ação pede confirmação e o backend confere o token do link.
- CWE: CWE-939
