import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileWarning, liveOthers, pushWarning, teamLines, teamPromptNote } from '../bin/team.mjs'

const NOW = Date.parse('2026-10-10T12:00:00Z')
const ago = (min) => new Date(NOW - min * 60_000).toISOString()
const ana = { id: 's-ana', user: 'u-ana', name: 'Ana', agent: 'claude', machine: 'note-ana', branch: 'main', status: 'editing', detail: 'src/cart.ts', lastAt: ago(1), files: [{ path: 'src/cart.ts', at: ago(2) }] }
const eu = { id: 's-eu', user: 'u-eu', name: 'Eu', agent: 'claude', machine: 'pc', branch: 'main', status: 'thinking', lastAt: ago(0), files: [] }
const team = { at: ago(1), you: 'u-eu', sessions: [ana, eu] }

test('outras sessões vivas: sem a minha, sem as paradas e sem foto velha', () => {
  assert.deepEqual(liveOthers(team, 's-eu', NOW).map((s) => s.id), ['s-ana'])
  assert.deepEqual(liveOthers({ ...team, sessions: [{ ...ana, lastAt: ago(20) }] }, 's-eu', NOW), [])
  assert.deepEqual(liveOthers({ ...team, at: ago(40) }, 's-eu', NOW), [])
})

test('aviso do pedido só quando o time muda', () => {
  const first = teamPromptNote(team, 's-eu', null, NOW)
  assert.match(first.note, /entrou: Ana .*src\/cart\.ts/)
  assert.equal(teamPromptNote(team, 's-eu', first.sig, NOW).note, null)
  const left = teamPromptNote({ ...team, sessions: [eu] }, 's-eu', first.sig, NOW)
  assert.match(left.note, /ninguém mais/)
  assert.equal(teamPromptNote({ ...team, sessions: [eu] }, 's-eu', null, NOW).note, null)
})

test('aviso antes de editar arquivo que outra sessão mexeu', () => {
  assert.match(fileWarning(team, 's-eu', 'src/cart.ts', NOW), /Ana.*há 2 min/)
  assert.equal(fileWarning(team, 's-eu', 'src/outro.ts', NOW), null)
  assert.match(fileWarning({ ...team, you: 'u-ana' }, 's-eu', 'src/cart.ts', NOW), /outra sessão sua/)
})

test('push na main com outra pessoa ativa pede confirmação; na mesa, não', () => {
  assert.match(pushWarning(team, 's-eu', 'git push', 'main', NOW), /Ana está trabalhando/)
  assert.match(pushWarning(team, 's-eu', 'git push origin main', 'mesa/eu-x', NOW), /Ana/)
  assert.equal(pushWarning(team, 's-eu', 'git push -u origin mesa/eu-x', 'mesa/eu-x', NOW), null)
  assert.equal(pushWarning(team, 's-eu', 'git status', 'main', NOW), null)
  assert.equal(pushWarning({ ...team, you: 'u-ana' }, 's-eu', 'git push', 'main', NOW), null)
})

test('faundr team lista quem está e os arquivos', () => {
  assert.match(teamLines(team, 's-eu', NOW).join('\n'), /Ana · Claude Code em note-ana na branch main .*\n  arquivos da última hora: src\/cart\.ts/)
})
