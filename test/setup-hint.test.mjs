import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HINT_EVERY_MS, setupHint } from '../bin/setup-hint.mjs'

const base = { cwd: '/proj', now: 1_000_000_000_000, seen: {}, skill: (n) => `/faundr:${n}`, isProject: true }

test('tudo pronto: nenhum aviso', () => {
  assert.equal(setupHint({ ...base, linked: true, hasToken: true }).text, null)
})

test('pasta ligada sem login: pede o /faundr:login, sempre', () => {
  const r = setupHint({ ...base, linked: true, hasToken: false, seen: { '/proj': base.now } })
  assert.match(r.text, /\/faundr:login/)
})

test('pasta de projeto sem ligar: sugere o /faundr:setup e lembra que avisou', () => {
  const r = setupHint({ ...base, linked: false, hasToken: true })
  assert.match(r.text, /\/faundr:setup/)
  assert.equal(r.seen['/proj'], base.now)
})

test('não repete na mesma pasta antes de 7 dias, e volta depois', () => {
  const seen = { '/proj': base.now }
  assert.equal(setupHint({ ...base, linked: false, hasToken: false, seen, now: base.now + HINT_EVERY_MS - 1 }).text, null)
  assert.ok(setupHint({ ...base, linked: false, hasToken: false, seen, now: base.now + HINT_EVERY_MS }).text)
})

test('pasta que não parece projeto: nenhum aviso', () => {
  assert.equal(setupHint({ ...base, linked: false, hasToken: false, isProject: false }).text, null)
})

test('no Codex o comando sai com $', () => {
  const r = setupHint({ ...base, linked: true, hasToken: false, skill: (n) => `$faundr:${n}` })
  assert.match(r.text, /\$faundr:login/)
})
