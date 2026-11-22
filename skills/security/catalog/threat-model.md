# Threat model (understand the app before looking for flaws)
When to read: always, first. The other topics list mistakes people commonly make. This one is how you find the ones only **this** app can have.

Golden rule: a security problem is a promise of the app that someone can break. You cannot find broken promises before you know what the app promises. Write the model down; it goes into the answer and every later step is checked against it.

## 1. What is worth taking or breaking (assets)
Read the overview, the schema (tables and columns), the routes and the pricing. List, in the app's own words:
- **Data**: whose it is (one person, a team, an organization, the public) and how bad a leak or a silent change would be. Mark the columns that are personal (email, phone, address, document numbers), secret (tokens, keys, hashes, webhook secrets) or that decide something (role, plan, owner, price, status, quota).
- **Money**: who pays whom, what is metered or limited, what a free account must not get.
- **Powers**: who can invite, remove, promote, delete, export, publish, deploy, run code or spend.
- **Keys the app holds for others**: payment provider, email, AI provider, cloud, source control. What can each one do if it leaks or is used on behalf of the wrong person?
- **Other people's machines**: code of this project that runs inside the user's own computer, browser or CI (a CLI, an SDK, an extension, a hook). There the asset is everything that machine can reach.

## 2. Who could try (actors)
For each one, write what they already have before they start:
- a visitor with nothing but the public URL and the public key that ships in the browser;
- a logged-in account that belongs to **no** team (anyone can sign up);
- the member with the lowest role in a team, and a read-only member;
- an admin against the owner (and an owner against another owner);
- someone who **was** a member: removed, invite revoked, account deleted, with tokens and sessions issued before;
- a member of another tenant who knows or can guess an id;
- whoever can call a webhook or a public ingestion endpoint;
- whoever can open a pull request, name a branch or publish a package the project installs;
- whoever can write text an AI model or agent of this app will read (a document, a ticket, a commit message, a web page, a tool result);
- the app's own servers and jobs running with a full-power key (what happens when they are handed attacker-chosen input?).

Do not skip the "boring" actors. Most real break-ins are the lowest member or the removed one, not the anonymous hacker.

## 3. Trust boundaries
Draw where data moves from a less trusted place to a more powerful one. Each crossing needs a check on the powerful side:
- browser → server (every field, header and id is the attacker's);
- server → database with a full-power key (the database rules no longer protect: the code must);
- database row a user can write → later read by an admin screen, a job, a full-power client or an AI;
- outside service → webhook (who proves it really came from them, and only once?);
- repository text → CI running with deploy keys;
- one tenant's data → shared cache, search index, logs, analytics, exports;
- stored text → HTML, a file path, a URL to fetch, a shell command, a prompt.

## 4. Invariants (the promises)
Write 10 to 20 sentences that must always be true, one line each, specific to this app. Good ones name the asset, the actor and the condition:
- "A project's rows are only read by members of its organization."
- "Only an owner creates, changes or removes an owner; an organization always has at least one."
- "A plan above free exists only while the payment provider says the subscription is active."
- "A removed member cannot read or write anything of the team from the next request on, including with tokens issued before."
- "An invite is accepted only by the address it was sent to, once."
- "The id of the tenant in a row never changes after it is created."
- "Nothing a member writes is executed, rendered as HTML or followed as an instruction by another member's session or by an AI agent."
- "A webhook event changes state only if its signature is valid, and only once."

Bad ones are generic ("the app is secure", "inputs are validated"): they cannot be broken, so they cannot be checked.

## 5. Use the model
- For each invariant, list every place that **writes** the thing it protects (grep the column, the table, the function) and every place that **reads** it to decide. The invariant holds only if every writer enforces it, in the database or on the server, at write time.
- For each actor, walk each invariant and ask "how would I break this with what I have?". Try the direct way, then the sibling ways: another verb, the bulk or export version, the old route, the database function behind the screen, the realtime channel, the storage path, the job that runs later with more power.
- An invariant nobody enforces anywhere is a finding even without an exploit path in hand: say so, with the writers you found.
- An invariant you could not check from the code (it depends on dashboard configuration, on the provider, on the deploy) is a "Needs check" with the exact missing fact.
- At the end, the coverage is stated per invariant: held (with the control), broken (S-n), or not checked (why).
