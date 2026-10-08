import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { foreignKeysWithoutIndex, queriesInLoops, unboundedQueries } from '../bin/perf-rules.mjs'
import { scanProject } from '../bin/security.mjs'

test('lista sem limite: só a que traz tudo', () => {
  const text = [
    "const a = await supabase.from('posts').select('*')",
    "const b = await supabase.from('posts').select('*').limit(20)",
    "const c = await supabase.from('posts').select('*').eq('id', id).single()",
    "const d = await supabase.from('posts').select('id', { count: 'exact', head: true })",
    "await supabase.from('posts').insert({ a: 1 }).select()",
    'const e = await prisma.user.findMany()',
    'const f = await prisma.user.findMany({ take: 10 })',
  ].join(';\n')
  assert.deepEqual(unboundedQueries('a.ts', text).map((q) => [q.line, q.table]), [
    [1, 'posts'],
    [6, 'user'],
  ])
})

test('consulta dentro de laço; lote e Promise.all não contam', () => {
  const loop = "for (const id of ids) {\n  const { data } = await supabase.from('a').select().eq('id', id)\n}"
  assert.equal(queriesInLoops('a.ts', loop).length, 1)
  const batch = "for (let i = 0; i < ids.length; i += 300) {\n  await db.from('a').select().in('id', ids.slice(i, i + 300))\n}"
  assert.equal(queriesInLoops('a.ts', batch).length, 0)
  const parallel = "await Promise.all(ids.map(async (id) => {\n  await fetch(`/x/${id}`)\n}))"
  assert.equal(queriesInLoops('a.ts', parallel).length, 0)
})

test('chave estrangeira sem índice nas migrações', () => {
  const fks = foreignKeysWithoutIndex([
    {
      file: 'm/1.sql',
      sql: 'create table public.posts (\n  id uuid primary key,\n  author_id uuid references public.users (id),\n  org_id uuid not null references public.orgs (id),\n  editor uuid references auth.users (id)\n);\ncreate index posts_org on public.posts (org_id, created_at);\n',
    },
    { file: 'm/2.sql', sql: 'alter table public.posts add column team_id uuid references public.teams (id);\ncreate index on public.posts using btree (editor);' },
  ])
  assert.deepEqual(fks.map((f) => `${f.table}.${f.column}@${f.file}`).sort(), ['posts.author_id@m/1.sql', 'posts.team_id@m/2.sql'])
})

function project(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-pay-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true })
    fs.writeFileSync(path.join(d, rel), text)
  }
  return d
}

test('regras de pagamento: corpo convertido, sem idempotência, valor do navegador e liberação na página de obrigado', async () => {
  const root = project({
    'src/routes/api/webhook.ts':
      "import Stripe from 'stripe'\nexport async function POST(request) {\n  const body = await request.json()\n  const event = stripe.webhooks.constructEvent(JSON.stringify(body), sig, secret)\n  if (event.type === 'checkout.session.completed') await liberar(event.data.object)\n}\n",
    'src/routes/api/checkout.ts':
      "export async function POST(request) {\n  const body = await request.json()\n  return stripe.checkout.sessions.create({ line_items: [{ price_data: { currency: 'brl', unit_amount: body.price } }] })\n}\n",
    'src/routes/obrigado.tsx': "export default function Obrigado() {\n  useEffect(() => { supabase.from('profiles').update({ plan: 'pro' }).eq('id', user.id) }, [])\n}\n",
    'src/routes/api/webhook-ok.ts':
      "export async function POST(request) {\n  const raw = await request.text()\n  const event = stripe.webhooks.constructEvent(raw, sig, secret)\n  if (event.type === 'checkout.session.completed') await db.from('events').insert({ id: event.id })\n}\n",
  })
  const { findings } = await scanProject(root, { deps: false })
  const got = findings.filter((f) => /^(stripe-|payment-)/.test(f.rule_id)).map((f) => `${f.rule_id}@${f.file}`).sort()
  assert.deepEqual(got, [
    'payment-amount-from-client@src/routes/api/checkout.ts',
    'payment-fulfilled-on-redirect@src/routes/obrigado.tsx',
    'payment-webhook-not-idempotent@src/routes/api/webhook.ts',
    'stripe-webhook-parsed-body@src/routes/api/webhook.ts',
  ])
})
