# Firebase
When to read: `firebase`, `firebase-admin`, `firebase-functions`, `@react-native-firebase/*`, `reactfire` in `package.json`; `firebase.json`, `.firebaserc`, `firestore.rules`, `database.rules.json`, `storage.rules` files, `functions/`; `NEXT_PUBLIC_FIREBASE_*`/`VITE_FIREBASE_*` variables.

Mental model: like Supabase, the browser talks directly to Firestore, Realtime Database (RTDB) and Storage. The app config (`apiKey`, `projectId`, `storageBucket`) is public by design and is not a secret. The barrier is the Security Rules, which are three separate engines (Firestore, RTDB, Storage). Cloud Functions with the Admin SDK ignore all rules.

Sources of truth: the rules files referenced in `firebase.json` (`"firestore": { "rules": "firestore.rules" }`, `"database": { "rules": ... }`, `"storage": { "rules": ... }`). If the app uses one of these products and `firebase.json` doesn't point to a rules file for it, or the file isn't in the repository, the rules live only in the console: record it as a gap in the evidence and recommend versioning the rules (this alone is a low/medium finding; don't conclude "safe").

## firebase-rules-abertas — `allow read, write: if true` or test mode with a date
- Typical severity: critical (anyone on the internet reads, changes and deletes the database). After the test-mode date, the rules deny everything (the app breaks, and the team tends to "open it again").
- Where to look: `firestore.rules`, `storage.rules`: `if true`, `allow read, write;` (no condition), `if request.time < timestamp.date(`; `database.rules.json`: `".read": true`, `".write": true` at the root or on high nodes.
- How to confirm by reading the code: read each `match` and its conditions. In Firestore/Storage, if any `match` that matches a path allows, it is allowed (OR between matches); so a `match /{document=**} { allow read, write: if true; }` cancels all the fine-grained rules.
- Ruled out if: the open rule is on a path of public read-only data (e.g., `allow read: if true` on `/public_posts/{id}` with `allow write: if false` or owner-only writes).
- Not ruled out by: correct fine-grained rules living alongside an open `{document=**}` wildcard; "the date hasn't expired yet".
- How to fix: remove broad wildcards and write per-collection rules with an owner (see below).
- CWE: CWE-284

## firebase-auth-como-unica-regra — `request.auth != null` as the only condition
- Typical severity: critical when sign-up is open (anyone creates an account and reads/writes everyone's data). High if sign-up is restricted but users shouldn't see each other's data.
- Where to look: `allow read, write: if request.auth != null;`, `if request.auth.uid != null`, RTDB `"auth != null"`, Storage `allow read, write: if request.auth != null;`. Also `request.auth.token.email_verified == true` alone, or claim-presence checks (`request.auth.token.role != null`) without comparing the value.
- How to confirm by reading the code: ask whether, for that collection, any user should access all documents. If the collection has an owner (`users`, `orders`, `messages`), it needs to compare with `request.auth.uid`.
- Ruled out if: the data is shared by design among all logged-in users (e.g., an internal catalog) and has no sensitive fields; or the condition compares owner/membership.
- Not ruled out by: "only employees have accounts" when the login provider is open (email/password, Google, anonymous) in the project.
- How to fix:
  ```
  match /orders/{orderId} {
    allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
    allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
    allow update, delete: if request.auth != null && resource.data.ownerId == request.auth.uid
      && request.resource.data.ownerId == resource.data.ownerId;
  }
  ```
- CWE: CWE-285

## firebase-dono-do-payload — Rule that trusts the owner sent, or writes without restricting fields
- Typical severity: critical when it allows writing `role`/`isAdmin`/`plan`/`credits` or changing the owner; high otherwise.
- Where to look: `allow create`/`update` that doesn't compare `request.resource.data.ownerId` with `request.auth.uid`; `update` without field restriction; `users/{uid}` collections with `allow write: if request.auth.uid == uid` where the document has `role`.
- How to confirm by reading the code: in `create`, the owner written must be the `uid`. In `update`, the owner can't change and privileged fields can't be touched. Look for `hasOnly`/`affectedKeys`.
- Ruled out if: there is `request.resource.data.keys().hasOnly([...])` in create and `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` in update without privileged fields, plus the owner comparison; or privileged fields live in another document the client can't write (or in custom claims).
- Not ruled out by: the app doesn't offer a `role` field in the form; validation done only on the front end or in a Cloud Function the client can skip by writing directly to Firestore.
- How to fix:
  ```
  allow update: if request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'photoURL']);
  ```
- CWE: CWE-915

## firebase-list-e-regras-nao-sao-filtros — Reading a whole collection / collectionGroup
- Typical severity: high.
- Where to look: `allow read` (which includes `get` and `list`) with a condition that doesn't depend on the document; `allow list: if request.auth != null`; `match /{path=**}/comments/{id}` (`collectionGroup` rules); subcollections without their own rule.
- How to confirm by reading the code: `allow get` protected by owner but `allow list` open lets anyone list everything. Firestore rules are not inherited by subcollections: a subcollection without a `match` is denied (safe), but a `match /{document=**}` covers it. `collectionGroup` queries use the `match` with `{path=**}`.
- Ruled out if: `list` requires the same owner condition (`resource.data.ownerId == request.auth.uid`), which forces the client to filter by owner in the query.
- Not ruled out by: "the screen only queries with `where('ownerId', '==', uid)`" (the attacker queries without the filter; the rule decides).
- How to fix: use `resource.data` in the `read`/`list` condition; review `{path=**}` rules.
- CWE: CWE-639

## firebase-rtdb-cascata — Parent rule grants the child (Realtime Database)
- Typical severity: high to critical.
- Where to look: `database.rules.json` with `.read`/`.write` on high nodes (`"users": { ".read": "auth != null", "$uid": { ".read": "$uid === auth.uid" } }`).
- How to confirm by reading the code: in RTDB rules cascade: a permission granted on a parent node applies to all children and can't be revoked by a deeper rule. In the example above, any logged-in user reads all users, despite the `$uid` rule.
- Ruled out if: permissions granted only on leaf nodes with `$uid === auth.uid` (or membership), with no grants on parents; `.validate` on sensitive fields.
- Not ruled out by: the child rule "looks restricted".
- How to fix: remove `.read`/`.write` from parents and grant only on each user's nodes.
- CWE: CWE-284

## firebase-storage-rules — Storage open, without owner, without type/size
- Typical severity: high for private files; critical if writes are open (hosting malicious content on the app's account, cost).
- Where to look: `storage.rules`: `match /{allPaths=**}`, `allow read, write: if request.auth != null`, `if true`; uploads with a path without `uid`. Also `makePublic()` or `public: true` in the Admin SDK.
- How to confirm by reading the code: the path must contain the `uid` and the rule must compare it with `request.auth.uid`; writes must limit `request.resource.size` and `request.resource.contentType`.
- Ruled out if: `match /users/{uid}/{file=**} { allow read, write: if request.auth.uid == uid && request.resource.size < 5 * 1024 * 1024 && request.resource.contentType.matches('image/.*'); }` (for write) and no open wildcard.
- Not ruled out by: correct Storage rules but objects made public via ACL by the Admin SDK (the ACL is another door, via `storage.googleapis.com`).
- How to fix: per-`uid` paths, size/type limits, remove `makePublic`.
- CWE: CWE-284

## firebase-functions-sem-token — `onRequest` Cloud Function without verifying the ID token
- Typical severity: high to critical (functions use the Admin SDK and ignore rules).
- Where to look: `functions/src/**`: `onRequest(`, `functions.https.onRequest(`, Express inside functions; `req.body.uid`, `req.query.userId`; `admin.auth().verifyIdToken` (its absence is the signal).
- How to confirm by reading the code: `onCall` receives the identity ready (`request.auth` in v2, `context.auth` in v1), but the function needs to check whether it is null. `onRequest` verifies nothing on its own: it must read `Authorization: Bearer <idToken>` and call `await getAuth().verifyIdToken(token)`. Then use the verified `uid`, never the one from the body.
- Ruled out if: `onCall` with `if (!request.auth) throw new HttpsError('unauthenticated', ...)` and use of `request.auth.uid`; `onRequest` with `verifyIdToken` before the work; or a function public by design (webhook with signature).
- Not ruled out by: `onCall` without checking `request.auth` (anonymous callers get through with a null `auth`); `uid` from the body "because the app always sends the right one".
- How to fix:
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

## firebase-admin-sdk-sem-checagem — Admin SDK accesses data without checking the owner
- Typical severity: high.
- Where to look: any server code (Functions, Next route handlers, Workers) with `firebase-admin` (`getFirestore()`, `admin.firestore()`) answering user requests.
- How to confirm by reading the code: since the Admin SDK ignores rules, every owner/tenant check must be in the code before reading/writing.
- Ruled out if: owner filter/check with the verified `uid` on every operation.
- Not ruled out by: "the rules protect it" (they don't apply to the Admin SDK).
- How to fix: explicit owner check, as in the example above.
- CWE: CWE-639

## firebase-trigger-concede-privilegio — Trigger that grants a role based on client data
- Typical severity: critical.
- Where to look: `onDocumentCreated`, `onDocumentWritten`, `functions.firestore.document(...).onCreate`, `beforeUserCreated`; `setCustomUserClaims(` calls with a value read from a document the user writes.
- How to confirm by reading the code: see where the granted role comes from. If it comes from a client-writable document (`users/{uid}.role`), the user promotes themselves.
- Ruled out if: the role comes from a source the client doesn't write (invite table created by the server, list of admins in code/config).
- Not ruled out by: "the sign-up screen has no role field".
- How to fix: grant roles only from server data; deny writes to the field in the rules.
- CWE: CWE-269

## firebase-app-check-como-authz — App Check treated as authorization
- Typical severity: medium (the confusion usually hides an open rule, which is the real finding).
- Where to look: comments/code saying "protected by App Check"; `enforceAppCheck: true` on a function without an `auth` check; open rules "because App Check is on".
- How to confirm by reading the code: App Check attests that the request came from the legitimate app; it doesn't say who the user is or what they can access, and it can be bypassed by whoever runs the app. See whether, without App Check, the rule/function would be open.
- Ruled out if: rules and functions have per-user authorization and App Check is an extra layer.
- Not ruled out by: App Check "enforced" in the console as the only defense.
- How to fix: keep App Check, but write per-user rules/checks.
- CWE: CWE-285
