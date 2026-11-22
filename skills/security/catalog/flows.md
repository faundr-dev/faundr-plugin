# Flows end to end (money, invitations and ownership, leaving, deletion)
When to read: always when the app has accounts. Single checks look at one route at a time; the worst problems live **between** steps: a state reached out of order, an event that arrives twice, a step that trusts the one before it.

Golden rule: walk each flow from the first click to the last effect, as each actor of the threat model, and then walk it again **out of order, twice, half-way and at the same time as someone else**. At each step ask: what does this step believe because of the previous one, and who else could make it believe that?

How to work: for each flow, write the states (e.g. `invited → accepted → member → removed`) and, for each arrow, the one piece of code allowed to make it. Then look for every other piece of code that writes the same column. A transition with two writers that check different things is a finding.

## Money
Follow it from the price shown to the access granted, and back.
- **Who decides the amount and the product?** The server, from its own catalog. A price, plan id, quantity, currency, discount or trial length that arrives from the browser and reaches the provider is a finding (`business-logic.md`).
- **What turns "paid" on?** Only a provider event whose signature was verified, or a server-side query to the provider that checks the session belongs to this account and was not used before. The success page, a query parameter or a client call are not proof.
- **Whose payment is it?** The event's customer or reference must be matched to the account on the server. Can one payment unlock two accounts, or someone else's account? Can I start a checkout for another organization's id?
- **Replays and order.** The same event delivered twice, events out of order (cancel before create, an old "active" after a "canceled"), an event for a subscription the app no longer knows. Is each event applied once (stored event id) and is the newest state taken from the provider rather than from the order of arrival?
- **The way down.** Refund, chargeback, failed renewal, cancellation, downgrade, end of trial: does access actually end, everywhere it is checked? Does anything granted while paid (seats, storage, generated keys, scheduled jobs) keep working after?
- **Where the plan is checked.** Every paid feature and every limit, on the server, at the moment of use, not only on the screen or at login. Is the limit read fresh or from a token or cache that outlives the change? Does a metering or quota write that fails stop the paid call (fail closed) or let it through?
- **Seats and shared plans.** Who can add a member to a paid organization, and does that bypass the seat limit (two invites accepted at once, an invite sent before the downgrade)?
- **Money out.** Credits, referrals, coupons, payouts: can I refer myself, use a code twice, apply it after the price is fixed, go negative, or race two redemptions?

## Invitations, roles and ownership
- **Sending.** Who may invite, and with which role? Can a member invite someone with a role above their own, or re-invite themselves? Is the role taken from the request or decided on the server?
- **Accepting.** Is the invite bound to the address it was sent to, and is that address verified on the account accepting it (a provider that returns an unverified email counts as "no")? Is the token single-use, unguessable, expiring, and useless after revocation? Two accepts at once?
- **Changing roles.** Who may change whose role? Check each pair (admin → admin, admin → owner, owner → owner, self → self). Is the rule in the database (function, trigger, policy) or only on the screen? Try it by direct update, by upsert, by INSERT of a second membership row, and by the invite flow with a higher role.
- **Ownership.** Transfer, the last owner leaving or being removed or deleted, an organization left with no owner, two owners removing each other at the same time. The "at least one owner" rule must be enforced where two calls cannot both pass.
- **Personal and team spaces.** Can a personal space be turned into, merged with or confused with a team one? Can I create a team with an id or slug that collides with an existing one?

## Leaving and being removed
The moment after removal is where access most often lingers. For a removed member, a revoked invite and a deleted account, check each of these stops at once:
- sessions and refresh tokens; API or CLI tokens issued while a member; personal access keys;
- signed URLs and download links already handed out; realtime subscriptions already open;
- rows they created (do the team's rows vanish with them by cascade? do they keep "author" powers?);
- pending invites they sent; scheduled jobs, webhooks and integrations they set up, running with their identity;
- caches, search indexes and exports that still hold the team's data under their id;
- a role claim inside a token that stays valid until it expires (the server must look the membership up, not trust the claim).

## Account and data deletion
- Does deleting an account delete what the privacy policy says it deletes, in every table, in storage and in third parties, and **only** that (not the team's shared data)?
- Can someone delete or export another person's or organization's data by id?
- Is deletion final where promised and reversible where promised (soft delete that still shows up in a list, an export or a search)?
- After deletion, can the same email, slug or id be registered again and inherit anything (old invites, old tokens, old files at the same path)?

## Anything metered, limited or single-use
Trials, free quotas, rate limits, one-time codes, password reset and email change links, magic links, device codes.
- Is the "used" mark written in the same statement that checks it (conditional update), or is it read, checked and written in three steps?
- Does it expire, and is the expiry checked on the server?
- Is it bound to the account and the action it was issued for (a reset token used to change the email, a code issued for one device approved by another person)?
- Can the limit be reset by creating another account, another organization, or by changing a field the limit is keyed on?

## What a finding from this topic looks like
Name the flow, the step, the actor and the order: "A member removed from the organization keeps a CLI token that still writes to its projects, because the token check looks up the token but not the membership (file:line)". Give the exact sequence of calls as the proof. Severity by the catalog's yardstick: paying nothing, taking over an organization or keeping access after removal are high or critical.
