# Logging and monitoring (knowing what happened and noticing the attack)
When to read: always, in a quick pass, and carefully when the app has money, admins, customer data or several people per organization. Here you are not looking for an open door, but for whether the owner will **notice** and **understand** a problem: who did what, when, and whether someone is trying right now. Logs that leak passwords or personal data are in `data-exposure.md` (`logs-com-segredo-ou-pii`); production errors are Faundr's Errors section (`/faundr:errors-setup`).

Golden rule: every action that changes money, access or another person's data leaves a record that the user themselves can't delete or forge.

## sem-registro-de-acoes-sensiveis — Important action with no trace of who did it
- Typical severity: medium (without a record, improper access or an admin mistake can't be investigated or undone); high in an app with money, health data or several organizations, or when the law requires it (LGPD: knowing who accessed personal data helps respond to incidents).
- Where to look: admin routes, role or owner changes, member invite and removal, bulk delete, export, email/password/MFA change, refund, plan change; `audit_log`, `activity`, `events` tables; audit triggers (`supa_audit`, `pgaudit`).
- How to confirm by reading the code: for each action on this list, is there a write with who (user id verified on the server), what, on which resource, when and from where (IP), done on the server?
- Ruled out if: there is an audit table or service written on the server (or a database trigger) for these actions; or the app has no action of this kind.
- Not ruled out by: a `console.log` that disappears after a few days at the provider; a record written by the front end (the user may not send it or may send a fake one).
- How to fix: an `audit_log (id, actor_id, action, target, metadata jsonb, ip, created_at)` table written on the server or by a trigger, read-only for admins and with no UPDATE/DELETE policy.
- CWE: CWE-778

## registro-alteravel-pelo-usuario — Audit record the user can delete or forge
- Typical severity: medium; high when the record is used to decide something (billing, dispute, evidence).
- Where to look: RLS policies on the audit/activity table; inserts done by the Supabase client in the browser; `actor_id`/`user_id` fields coming from the request body.
- How to confirm by reading the code: does the regular user have INSERT with a free `actor_id`, or UPDATE/DELETE on the table?
- Ruled out if: only the server (or a `security definer` trigger) writes, the author comes from `auth.uid()`, and there is no UPDATE/DELETE policy.
- Not ruled out by: "nobody will mess with this through the console".
- How to fix: write via trigger or on the server, author from `auth.uid()`, no UPDATE/DELETE for `authenticated`.
- CWE: CWE-117

## sem-alerta-de-abuso — Attack in progress goes unnoticed
- Typical severity: medium when there are expensive routes (AI, email, SMS) or login without MFA; low in a small app with no per-use cost.
- Where to look: spending limits at the AI/email/SMS provider; failed login counting; Supabase alerts (usage, Auth); Sentry/uptime turned on (`faundr errors-dsn`, `faundr errors-uptime`).
- How to confirm by reading the code: if someone tries a thousand passwords or burns the AI quota tonight, does anything warn the owner? This is usually outside the code (provider dashboard): if so, record it as "Needs check" with where to look.
- Ruled out if: spending limit and alert configured at the provider for the expensive routes; error and site-down alerts turned on; login with an attempt limit.
- Not ruled out by: a rate limit with no warning when it fires a lot (the attack is blocked, but nobody learns it is happening — it becomes a note, not an issue, if the limit exists).
- How to fix: spending cap and email alert at the AI/email/SMS provider; errors and uptime turned on in Faundr; count failed logins per account and warn above a threshold.
- CWE: CWE-778

## falha-de-seguranca-silenciosa — Security control that fails without anyone knowing
- Typical severity: medium; high if the failure lets things through (fails open, see `access-and-idor.md`).
- Where to look: `try { verifySignature() } catch {}`, `catch (e) { return next() }`, a webhook that answers 200 even when the signature doesn't match, a permission check that returns `true` when the database errors.
- How to confirm by reading the code: when the control errors, is the request refused and the error recorded (Sentry/log)?
- Ruled out if: the error refuses the request and is recorded.
- Not ruled out by: "the error is rare".
- How to fix: fail closed (refuse) and send the error to monitoring.
- CWE: CWE-390
