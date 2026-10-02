# Firebase
Quando ler: `firebase`, `firebase-admin`, `firebase-functions`, `@react-native-firebase/*`, `reactfire` no `package.json`; arquivos `firebase.json`, `.firebaserc`, `firestore.rules`, `database.rules.json`, `storage.rules`, `functions/`; variáveis `NEXT_PUBLIC_FIREBASE_*`/`VITE_FIREBASE_*`.

Modelo mental: igual ao Supabase, o navegador fala direto com Firestore, Realtime Database (RTDB) e Storage. A config do app (`apiKey`, `projectId`, `storageBucket`) é pública por desenho e não é segredo. A barreira são as Security Rules, que são três motores separados (Firestore, RTDB, Storage). Cloud Functions com Admin SDK ignoram todas as rules.

Fontes de verdade: os arquivos de rules referenciados em `firebase.json` (`"firestore": { "rules": "firestore.rules" }`, `"database": { "rules": ... }`, `"storage": { "rules": ... }`). Se o app usa um desses produtos e o `firebase.json` não aponta arquivo de rules para ele, ou o arquivo não está no repositório, as rules vivem só no console: registre como lacuna de prova e recomende versionar as rules (isso por si só é um achado baixo/médio; não conclua "seguro").

## firebase-rules-abertas — `allow read, write: if true` ou modo de teste com data
- Gravidade típica: crítica (qualquer pessoa na internet lê, altera e apaga o banco). Depois da data do modo de teste, as rules negam tudo (o app quebra, e o time tende a "abrir de novo").
- Onde procurar: `firestore.rules`, `storage.rules`: `if true`, `allow read, write;` (sem condição), `if request.time < timestamp.date(`; `database.rules.json`: `".read": true`, `".write": true` na raiz ou em nós altos.
- Como confirmar lendo o código: leia cada `match` e suas condições. Em Firestore/Storage, se qualquer `match` que casa com um caminho permite, está permitido (OR entre matches); então um `match /{document=**} { allow read, write: if true; }` anula todas as regras finas.
- Descarta se: a regra aberta está num caminho de dados públicos só leitura (ex.: `allow read: if true` em `/public_posts/{id}` com `allow write: if false` ou escrita com dono).
- Não descarta: regras finas corretas convivendo com um curinga `{document=**}` aberto; "a data ainda não venceu".
- Como corrigir: remover curingas amplos e escrever regras por coleção com dono (ver abaixo).
- CWE: CWE-284

## firebase-auth-como-unica-regra — `request.auth != null` como única condição
- Gravidade típica: crítica quando o cadastro é aberto (qualquer um cria conta e lê/escreve dados de todos). Alta se o cadastro é restrito mas os usuários não deveriam ver dados uns dos outros.
- Onde procurar: `allow read, write: if request.auth != null;`, `if request.auth.uid != null`, RTDB `"auth != null"`, Storage `allow read, write: if request.auth != null;`. Também `request.auth.token.email_verified == true` sozinho, ou checagens de presença de claim (`request.auth.token.role != null`) sem comparar valor.
- Como confirmar lendo o código: pergunte se, para aquela coleção, um usuário qualquer deveria acessar todos os documentos. Se a coleção tem dono (`users`, `orders`, `messages`), precisa comparar com `request.auth.uid`.
- Descarta se: dado é compartilhado por desenho entre todos os usuários logados (ex.: catálogo interno) e não há campos sensíveis; ou a condição compara dono/associação.
- Não descarta: "só funcionários têm conta" quando o provedor de login está aberto (e-mail/senha, Google, anônimo) no projeto.
- Como corrigir:
  ```
  match /orders/{orderId} {
    allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
    allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
    allow update, delete: if request.auth != null && resource.data.ownerId == request.auth.uid
      && request.resource.data.ownerId == resource.data.ownerId;
  }
  ```
- CWE: CWE-285

## firebase-dono-do-payload — Regra que confia no dono enviado, ou escrita sem restringir campos
- Gravidade típica: crítica quando permite gravar `role`/`isAdmin`/`plan`/`credits` ou trocar o dono; alta nos demais casos.
- Onde procurar: `allow create`/`update` que não compara `request.resource.data.ownerId` com `request.auth.uid`; `update` sem restrição de campos; coleções `users/{uid}` com `allow write: if request.auth.uid == uid` onde o documento tem `role`.
- Como confirmar lendo o código: em `create`, o dono gravado deve ser o `uid`. Em `update`, o dono não pode mudar e campos privilegiados não podem ser tocados. Procure `hasOnly`/`affectedKeys`.
- Descarta se: há `request.resource.data.keys().hasOnly([...])` no create e `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` no update sem campos privilegiados, e comparação de dono; ou campos privilegiados vivem em outro documento sem escrita pelo cliente (ou em custom claims).
- Não descarta: o app não oferece campo `role` no formulário; validação feita só no front ou numa Cloud Function que o cliente pode pular escrevendo direto no Firestore.
- Como corrigir:
  ```
  allow update: if request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'photoURL']);
  ```
- CWE: CWE-915

## firebase-list-e-regras-nao-sao-filtros — Leitura de coleção inteira / collectionGroup
- Gravidade típica: alta.
- Onde procurar: `allow read` (que inclui `get` e `list`) com condição que não depende do documento; `allow list: if request.auth != null`; `match /{path=**}/comments/{id}` (regras de `collectionGroup`); subcoleções sem regra própria.
- Como confirmar lendo o código: `allow get` protegido por dono, mas `allow list` aberto, deixa listar todos. Regras de Firestore não se herdam para subcoleções: uma subcoleção sem `match` fica negada (seguro), mas um `match /{document=**}` a cobre. Consultas `collectionGroup` usam o `match` com `{path=**}`.
- Descarta se: `list` exige a mesma condição de dono (`resource.data.ownerId == request.auth.uid`), o que obriga o cliente a filtrar por dono na query.
- Não descarta: "a tela só consulta com `where('ownerId', '==', uid)`" (o atacante consulta sem filtro; a rule é que decide).
- Como corrigir: usar `resource.data` na condição de `read`/`list`; revisar regras `{path=**}`.
- CWE: CWE-639

## firebase-rtdb-cascata — Regra do pai libera o filho (Realtime Database)
- Gravidade típica: alta a crítica.
- Onde procurar: `database.rules.json` com `.read`/`.write` em nós altos (`"users": { ".read": "auth != null", "$uid": { ".read": "$uid === auth.uid" } }`).
- Como confirmar lendo o código: no RTDB as regras cascateiam: uma permissão concedida num nó pai vale para todos os filhos e não pode ser revogada por regra mais funda. No exemplo acima, qualquer logado lê todos os usuários, apesar da regra do `$uid`.
- Descarta se: permissões concedidas só nos nós folha com `$uid === auth.uid` (ou associação), sem concessões nos pais; `.validate` nos campos sensíveis.
- Não descarta: a regra do filho "parece restrita".
- Como corrigir: remover `.read`/`.write` dos pais e conceder só nos nós de cada usuário.
- CWE: CWE-284

## firebase-storage-rules — Storage aberto, sem dono, sem tipo/tamanho
- Gravidade típica: alta para arquivos privados; crítica se escrita é aberta (hospedagem de conteúdo malicioso na conta do app, custo).
- Onde procurar: `storage.rules`: `match /{allPaths=**}`, `allow read, write: if request.auth != null`, `if true`; uploads com caminho sem `uid`. Também `makePublic()` ou `public: true` no Admin SDK.
- Como confirmar lendo o código: o caminho deve conter o `uid` e a regra comparar com `request.auth.uid`; escrita deve limitar `request.resource.size` e `request.resource.contentType`.
- Descarta se: `match /users/{uid}/{file=**} { allow read, write: if request.auth.uid == uid && request.resource.size < 5 * 1024 * 1024 && request.resource.contentType.matches('image/.*'); }` (para write) e nenhum curinga aberto.
- Não descarta: regras Storage corretas mas objetos tornados públicos via ACL pelo Admin SDK (a ACL é outra porta, via `storage.googleapis.com`).
- Como corrigir: caminhos por `uid`, limites de tamanho/tipo, remover `makePublic`.
- CWE: CWE-284

## firebase-functions-sem-token — Cloud Function `onRequest` sem verificar ID token
- Gravidade típica: alta a crítica (funções usam Admin SDK e ignoram rules).
- Onde procurar: `functions/src/**`: `onRequest(`, `functions.https.onRequest(`, Express dentro de functions; `req.body.uid`, `req.query.userId`; `admin.auth().verifyIdToken` (ausência é o sinal).
- Como confirmar lendo o código: `onCall` recebe a identidade pronta (`request.auth` na v2, `context.auth` na v1), mas a função precisa checar se ela é nula. `onRequest` não verifica nada sozinho: deve ler `Authorization: Bearer <idToken>` e chamar `await getAuth().verifyIdToken(token)`. Depois, usar o `uid` verificado, nunca o do corpo.
- Descarta se: `onCall` com `if (!request.auth) throw new HttpsError('unauthenticated', ...)` e uso de `request.auth.uid`; `onRequest` com `verifyIdToken` antes do trabalho; ou função pública por desenho (webhook com assinatura).
- Não descarta: `onCall` sem checar `request.auth` (anônimos passam com `auth` nulo); `uid` do corpo "porque o app sempre manda o certo".
- Como corrigir:
  ```ts
  export const deleteDoc = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'login');
    const ref = db.doc(`orders/${request.data.id}`);
    const snap = await ref.get();
    if (snap.get('ownerId') !== request.auth.uid) throw new HttpsError('permission-denied', 'no');
    await ref.delete();
  });
  ```
- CWE: CWE-306

## firebase-admin-sdk-sem-checagem — Admin SDK acessa dado sem checar dono
- Gravidade típica: alta.
- Onde procurar: qualquer código servidor (Functions, route handlers do Next, Workers) com `firebase-admin` (`getFirestore()`, `admin.firestore()`) respondendo a pedidos de usuário.
- Como confirmar lendo o código: como o Admin SDK ignora rules, toda checagem de dono/tenant precisa estar no código antes de ler/escrever.
- Descarta se: filtro/checagem de dono com o `uid` verificado em cada operação.
- Não descarta: "as rules protegem" (não valem para o Admin SDK).
- Como corrigir: checagem explícita de dono, como no exemplo acima.
- CWE: CWE-639

## firebase-trigger-concede-privilegio — Trigger que concede papel com base em dado do cliente
- Gravidade típica: crítica.
- Onde procurar: `onDocumentCreated`, `onDocumentWritten`, `functions.firestore.document(...).onCreate`, `beforeUserCreated`; chamadas `setCustomUserClaims(` com valor lido de documento que o usuário escreve.
- Como confirmar lendo o código: veja de onde vem o papel concedido. Se vem de um documento gravável pelo cliente (`users/{uid}.role`), o usuário se promove.
- Descarta se: o papel vem de fonte que o cliente não escreve (tabela de convites criada pelo servidor, lista de admins no código/config).
- Não descarta: "a tela de cadastro não tem campo de papel".
- Como corrigir: conceder papel só a partir de dados do servidor; negar escrita do campo nas rules.
- CWE: CWE-269

## firebase-app-check-como-authz — App Check tratado como autorização
- Gravidade típica: média (a confusão costuma esconder uma regra aberta, que é o achado real).
- Onde procurar: comentários/código que dizem "protegido pelo App Check"; `enforceAppCheck: true` em função sem checagem de `auth`; rules abertas "porque o App Check está ligado".
- Como confirmar lendo o código: App Check atesta que o pedido veio do app legítimo; não diz quem é o usuário nem o que ele pode acessar, e pode ser contornado por quem roda o app. Veja se, sem App Check, a regra/função seria aberta.
- Descarta se: rules e funções têm autorização por usuário e o App Check é camada extra.
- Não descarta: App Check "enforced" no console como única defesa.
- Como corrigir: manter App Check, mas escrever rules/checagens por usuário.
- CWE: CWE-285
