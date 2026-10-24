# Business logic
When to read: the app charges money (Stripe, Mercado Pago, Paddle, Lemon Squeezy, Pix), has plans/limits/credits/coupons/referrals, cart, stock, bookings, votes, balance, or multi-step flows (onboarding, approval, order → paid → shipped).

How to work: start from the invariants, not from the screens. Write down for yourself 3 to 5 sentences that must always be true (e.g., "balance never goes negative", "a coupon is used only once per account", "the pro plan only exists if there was a payment confirmed by the provider", "total charged = sum of catalog prices"). Then look for the code that writes each of these values and see whether the invariant is guaranteed on the server, at write time.

## preco-vindo-do-cliente — Price, total or quantity set by the front end
- Typical severity: critical (purchase for R$ 0.01, negative quantity generates credit).
- Where to look: checkout/order creation. Grep: `price_data`, `unit_amount: body`, `amount: req.body`, `total:` coming from the body, `quantity: body.quantity`, `stripe.paymentIntents.create({ amount: `, `preference.create` (Mercado Pago) with `unit_price` from the client, `discount` from the body.
- How to confirm by reading the code: see where each number used in the charge comes from. It must come from the catalog on the server (database or Stripe `price_...`), with the quantity validated (integer, ≥1, ≤maximum).
- Ruled out if: the server receives only product IDs and quantities, looks up prices in the database/Stripe and calculates the total; or uses `line_items: [{ price: 'price_...', quantity }]` with `price` from a server allowlist and validated `quantity`.
- Not ruled out by: the front end calculates and the server "checks that it's positive"; a Stripe `price` accepted from the client without an allowlist (the attacker passes the `price_` of another cheaper product from the same catalog); discount calculated on the front end.
- How to fix:
  ```ts
  const Item = z.object({ productId: z.string(), quantity: z.number().int().min(1).max(20) });
  const items = z.array(Item).max(50).parse(body.items);
  const products = await db.product.findMany({ where: { id: { in: items.map(i => i.productId) }, active: true } });
  const line_items = items.map(i => ({ price: products.find(p => p.id === i.productId)!.stripePriceId, quantity: i.quantity }));
  ```
- CWE: CWE-602

## pagamento-confirmado-pelo-front — Plan/order unlocked by the success page
- Typical severity: critical (paid access without paying).
- Where to look: a `success`/`obrigado`/`checkout/return` page that calls an API to "activate the plan"; an `/api/upgrade` route or `activatePlan` action without a verified payment; `?session_id=` used without querying Stripe; `localStorage.setItem('plan', 'pro')`; plan check done on the client.
- How to confirm by reading the code: find out what changes the plan/status to paid. It must be (a) the verified webhook (see `api-and-abuse.md` → `webhook-sem-assinatura`) or (b) a server query to the provider (`stripe.checkout.sessions.retrieve(id)` with `payment_status === 'paid'` and a check that the session belongs to the user and hasn't been used yet).
- Ruled out if: only the verified webhook or the provider query, with owner check and single use, changes the state.
- Not ruled out by: the success page is only reachable through Stripe's redirect (anyone can type the URL); `session_id` queried but without checking the current user's `client_reference_id`/`customer` (reusing someone else's session, or the same session for several accounts).
- How to fix: unlock in the webhook; on the success page, just show the state read from the database.
- CWE: CWE-602

## limite-de-plano-so-no-front — Plan/quota limits checked only in the interface
- Typical severity: high (free user uses paid features, cost without revenue); medium if the resource is cheap.
- Where to look: `if (plan === 'free')` in components; disabled buttons; `maxProjects` checked on the front end; routes/actions that create resources without reading the plan. Grep: `plan`, `tier`, `isPro`, `subscription`, `limit`, `quota`, `credits`.
- How to confirm by reading the code: for each limited resource, find the route/action/policy that creates it and see whether it reads the plan from the database and counts current usage before creating.
- Ruled out if: the check exists on the server (or in a database policy/trigger) on the same path as the creation, and the plan comes from the database/a server claim.
- Not ruled out by: plan check in middleware with cookie data; plan read from Supabase `user_metadata` (editable by the user); direct client writes to Supabase on a table without a limit policy/trigger.
- How to fix: a server function `assertWithinLimit(user, 'projects')` before creation; in Supabase, an INSERT policy with `(select count(*) from projects where owner = auth.uid()) < plan_limit` or a trigger.
- CWE: CWE-602

## corrida-uso-unico — Coupon, invite, withdrawal or credit used twice in parallel
- Typical severity: high (duplicated money/credit); medium when the gain is small.
- Where to look: the "read, check, write" pattern in code with a value effect: `if (!coupon.used) { ... await markUsed() }`, `if (balance >= amount) { await update({ balance: balance - amount }) }`, `if (user.trialUsed === false)`, invite redemption, single vote, booking the last item.
- How to confirm by reading the code: see whether the check and the write are atomic: (a) a single `UPDATE ... WHERE used = false` / `WHERE balance >= amount` checking affected rows; (b) a unique constraint in the database (`unique(user_id, coupon_id)`); (c) a transaction with `SELECT ... FOR UPDATE` or serializable isolation; (d) a SQL function that does everything in one statement.
- Ruled out if: one of the four controls above is present on the path.
- Not ruled out by: a transaction without a lock at the default level (READ COMMITTED lets both reads see "not used"); a check on the front end; sequential `await`s "too fast to race".
- How to fix:
  ```ts
  const { count } = await db.coupon.updateMany({ where: { code, usedAt: null }, data: { usedAt: new Date(), usedBy: user.id } });
  if (count === 0) throw new Error('coupon already used');
  ```
  ```sql
  update wallets set balance = balance - $1 where user_id = $2 and balance >= $1 returning balance;
  ```
- CWE: CWE-362

## estado-pulado — State transition without checking the current state
- Typical severity: medium to high (order shipped without payment, refund of an already refunded order, approving one's own request).
- Where to look: `status`/`state`/`step` fields and routes that change them (`/api/orders/[id]/ship`, `refund`, `approve`, `complete-onboarding`); updates with `status: body.status`.
- How to confirm by reading the code: each transition must check the source state on the server (`where: { id, status: 'paid' }`) and who can perform it. The client must not choose the new status freely.
- Ruled out if: explicit transitions per action (one route per transition) with `where` on the source state and a role check; or a state machine on the server.
- Not ruled out by: the screen only shows the button in the right state; `status` accepted from the body with only enum validation.
- How to fix: `updateMany({ where: { id, status: 'paid' }, data: { status: 'shipped' } })` and check `count`.
- CWE: CWE-841

## valor-negativo-e-limites-numericos — Negative, zero, fractional or huge quantity/value
- Typical severity: high when it generates credit (transferring `-100` = receiving 100) or negative stock.
- Where to look: `amount`, `quantity`, `credits`, `points`, `tip`, `transfer`, `withdraw`; schemas with `z.number()` without `.int().positive()`; `parseFloat` on money; floating-point arithmetic on cents.
- How to confirm by reading the code: check validation of sign, integer, maximum and unit (integer cents).
- Ruled out if: `z.number().int().positive().max(...)` (or equivalent) before use and monetary values in integer cents; `check (balance >= 0)` in the database.
- Not ruled out by: `min="1"` on the HTML input.
- How to fix: validate on the server and add a `check` in the database as a safety net.
- CWE: CWE-20

## indicacao-e-trial-abusaveis — Repeatable referral bonuses, trials and freebies
- Typical severity: medium (cost); high if the bonus turns into withdrawable money.
- Where to look: `referral`, `invite`, `trial`, `bonus`, `welcome credits`; sign-up that grants credits; self-referral (`referrerId === user.id`).
- How to confirm by reading the code: see whether the bonus requires a verifiable condition (confirmed email, first payment), whether there is uniqueness (one bonus per account/card), and whether the user can refer themselves.
- Ruled out if: bonus only after a paid/confirmed event, with a unique constraint and self-referral blocked.
- Not ruled out by: "nobody will create 100 accounts" (unlimited sign-up and disposable emails make it trivial).
- How to fix: grant in the payment webhook; `unique(referred_user_id)`; block `referrerId === user.id`.
- CWE: CWE-840

## assinatura-cancelada-mantem-acesso — Paid access continues after cancellation/refund/failure
- Typical severity: medium.
- Where to look: payment provider webhook handlers: see whether they handle `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed`, `charge.refunded` (Stripe) or equivalents.
- How to confirm by reading the code: list the handled events. If only `checkout.session.completed` changes the plan, nothing downgrades.
- Ruled out if: cancellation/failure/refund events downgrade the plan; or access is checked by querying the current subscription status at the provider/synced database.
- Not ruled out by: "customers rarely cancel".
- How to fix: handle end-of-subscription events and store `current_period_end`; check access by `status in ('active','trialing') and current_period_end > now()`.
- CWE: CWE-840
