import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { changesSince, createCheckpoint, ensureSessionCheckpoint, findCheckpoint, listCheckpoints, rescueBundle, restoreCheckpoint, restoreSummary, unsafeCheckpointRoot } from '../bin/checkpoints.mjs'
import { setLang } from '../bin/i18n.mjs'

setLang('pt')

const git = (root, ...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cp-'))
  git(root, 'init', '-q')
  git(root, 'config', 'user.email', 't@t')
  git(root, 'config', 'user.name', 't')
  fs.writeFileSync(path.join(root, '.gitignore'), '.env\n')
  fs.writeFileSync(path.join(root, 'a.txt'), 'um\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'inicio')
  return root
}

const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8')

test('checkpoint guarda os arquivos sem mexer no git do usuário', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'a.txt'), 'dois\n')
  fs.writeFileSync(path.join(root, 'novo.txt'), 'novo\n')
  const status = git(root, 'status', '--porcelain').stdout
  const c = createCheckpoint(root, { reason: 'teste', session: 's1' })
  assert.equal(c.created, true)
  assert.equal(git(root, 'status', '--porcelain').stdout, status, 'índice e arquivos intactos')
  assert.equal(git(root, 'stash', 'list').stdout, '')
  const [only] = listCheckpoints(root)
  assert.equal(only.reason, 'teste')
  assert.equal(only.session, 's1')
  // Sem mudança: não cria outro.
  assert.equal(createCheckpoint(root, { reason: 'de novo' }).created, false)
  assert.equal(listCheckpoints(root).length, 1)
})

test('voltar desfaz edições, apaga o que foi criado depois, traz o apagado e pode ser desfeito', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'b.txt'), 'b original\n')
  fs.writeFileSync(path.join(root, '.env'), 'SEGREDO=1\n')
  const c = createCheckpoint(root, { reason: 'antes' })
  fs.writeFileSync(path.join(root, 'a.txt'), 'quebrado\n')
  fs.rmSync(path.join(root, 'b.txt'))
  fs.mkdirSync(path.join(root, 'pasta'))
  fs.writeFileSync(path.join(root, 'pasta', 'c.txt'), 'criado depois\n')
  fs.writeFileSync(path.join(root, '.env'), 'SEGREDO=2\n')

  const changes = changesSince(root, c)
  assert.deepEqual(changes.map((x) => `${x.status}:${x.path}`).sort(), ['alterado:a.txt', 'apagado:b.txt', 'criado:pasta/c.txt'])

  const r = restoreCheckpoint(root, c)
  assert.equal(read(root, 'a.txt'), 'um\n')
  assert.equal(read(root, 'b.txt'), 'b original\n')
  assert.equal(fs.existsSync(path.join(root, 'pasta')), false, 'pasta vazia some')
  assert.equal(read(root, '.env'), 'SEGREDO=2\n', '.env (ignorado) não muda')
  assert.deepEqual(changesSince(root, c), [])

  // Desfazer a volta: o estado salvo antes é o mais novo.
  assert.equal(findCheckpoint(root, '1').ref, r.saved.ref)
  restoreCheckpoint(root, findCheckpoint(root, '1'))
  assert.equal(read(root, 'a.txt'), 'quebrado\n')
  assert.equal(read(root, 'pasta/c.txt'), 'criado depois\n')
  assert.equal(fs.existsSync(path.join(root, 'b.txt')), false)
})

test('um por sessão, de novo depois de 30 min, só com git', () => {
  const root = repo()
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cfg-'))
  // Hora fixa: o resultado não depende do dia em que o teste roda.
  const t0 = Date.UTC(2026, 0, 15, 12)
  fs.writeFileSync(path.join(root, 'a.txt'), 'x\n')
  assert.ok(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 }))
  fs.writeFileSync(path.join(root, 'a.txt'), 'y\n')
  assert.equal(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 + 60_000 }), null)
  assert.ok(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 + 31 * 60_000 }))
  assert.equal(listCheckpoints(root).length, 2)
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-nogit-'))
  assert.equal(ensureSessionCheckpoint(plain, 's2', { configDir }), null)
})

test('git que passa do prazo não deixa a sessão 30 min sem ponto: tenta de novo em 5 min', () => {
  const root = repo()
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cfg-'))
  const t0 = Date.UTC(2026, 0, 15, 12)
  fs.writeFileSync(path.join(root, 'a.txt'), 'x\n')
  assert.throws(() => ensureSessionCheckpoint(root, 's1', { configDir, now: t0, timeoutMs: 1 }))
  assert.equal(listCheckpoints(root).length, 0)
  assert.equal(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 + 60_000 }), null)
  assert.ok(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 + 6 * 60_000 }))
})

test('repositório sem nenhum commit também funciona', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cp0-'))
  git(root, 'init', '-q')
  fs.writeFileSync(path.join(root, 'a.txt'), '1\n')
  const c = createCheckpoint(root, { reason: 'zero' })
  fs.writeFileSync(path.join(root, 'a.txt'), '2\n')
  restoreCheckpoint(root, c)
  assert.equal(read(root, 'a.txt'), '1\n')
})

test('a volta explica o que se perde, o que é apagado e o que não muda', () => {
  const point = { at: '2026-10-13T16:17:00Z', reason: 'antes da primeira mudança da sessão' }
  const text = restoreSummary(point, [
    { status: 'alterado', path: 'src/login.ts' },
    { status: 'criado', path: 'src/novo.ts' },
    { status: 'apagado', path: 'src/velho.ts' },
  ])
  assert.match(text, /1 voltam como eram; as mudanças feitas neles depois do checkpoint se perdem: src\/login\.ts/)
  assert.match(text, /1 criados depois do checkpoint são apagados: src\/novo\.ts/)
  assert.match(text, /1 apagados depois do checkpoint voltam: src\/velho\.ts/)
  assert.match(text, /não muda: o \.env.*banco de dados/)
  assert.match(restoreSummary(point, []), /nada muda/)
  setLang('en')
  assert.match(restoreSummary(point, [{ status: 'criado', path: 'src/novo.ts' }]), /1 created after the checkpoint are deleted: src\/novo\.ts/)
  assert.match(restoreSummary(point, []), /nothing changes/)
  setLang('pt')
})

test('a volta avisa quando pacotes ou migrações do banco mudam', () => {
  const point = { at: '2026-10-06T12:00:00Z', reason: 'antes da primeira mudança da sessão' }
  const text = restoreSummary(point, [{ status: 'alterado', path: 'package.json' }, { status: 'criado', path: 'supabase/migrations/0068_x.sql' }])
  assert.match(text, /npm install/)
  assert.match(text, /o banco não volta/)
  assert.doesNotMatch(restoreSummary(point, [{ status: 'alterado', path: 'src/a.ts' }]), /Atenção/)
})

test('restore <n> só acha pelo número; código do commit precisa de 7+ letras hex', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'a.txt'), '1\n')
  const older = createCheckpoint(root, { reason: 'um', now: 1000 })
  fs.writeFileSync(path.join(root, 'a.txt'), '2\n')
  const newer = createCheckpoint(root, { reason: 'dois', now: 2000 })
  assert.equal(findCheckpoint(root, '1').ref, newer.ref)
  assert.equal(findCheckpoint(root, '2').ref, older.ref)
  assert.equal(findCheckpoint(root, '#2').ref, older.ref)
  assert.equal(findCheckpoint(root, older.commit.slice(0, 10)).ref, older.ref)
  assert.equal(findCheckpoint(root, older.ref).ref, older.ref)
  assert.equal(findCheckpoint(root, older.commit.slice(0, 6)), null, 'prefixo curto não vale')
  assert.equal(findCheckpoint(root, '8'), null, 'número sem checkpoint não cai num commit que começa com 8')
  assert.equal(findCheckpoint(root, 'zzzzzzz'), null)
})

test('troca só de maiúsculas (A.txt → a.txt) não perde o arquivo na volta', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'Nome.txt'), 'conteúdo\n')
  const c = createCheckpoint(root, { reason: 'antes' })
  fs.renameSync(path.join(root, 'Nome.txt'), path.join(root, 'tmp-rename'))
  fs.renameSync(path.join(root, 'tmp-rename'), path.join(root, 'nome.txt'))
  const r = restoreCheckpoint(root, c)
  assert.deepEqual(r.failed, [])
  assert.ok(fs.readdirSync(root).includes('Nome.txt'), fs.readdirSync(root).join(','))
  assert.equal(read(root, 'Nome.txt'), 'conteúdo\n')
})

test('arquivo preso não para a volta: o resto volta e ele sai na lista de falhas', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'b.txt'), 'b\n')
  const c = createCheckpoint(root, { reason: 'antes' })
  fs.writeFileSync(path.join(root, 'a.txt'), 'mudou\n')
  // Uma pasta no lugar de b.txt: escrever nela falha (como um arquivo preso pelo OneDrive).
  fs.rmSync(path.join(root, 'b.txt'))
  fs.mkdirSync(path.join(root, 'b.txt'))
  const r = restoreCheckpoint(root, c)
  assert.equal(read(root, 'a.txt'), 'um\n')
  assert.deepEqual(r.failed.map((f) => f.path), ['b.txt'])
  assert.ok(r.saved.commit, 'o estado de antes ficou salvo para desfazer')
})

test('a volta nunca mexe em .env*, node_modules nem no que o .gitignore ignora agora', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cp-ign-'))
  git(root, 'init', '-q')
  // Sem .gitignore: .env e node_modules ficam fora da foto mesmo assim.
  fs.writeFileSync(path.join(root, '.env.local'), 'SEGREDO=1\n')
  fs.mkdirSync(path.join(root, 'node_modules', 'x'), { recursive: true })
  fs.writeFileSync(path.join(root, 'node_modules', 'x', 'i.js'), '1\n')
  fs.writeFileSync(path.join(root, 'notas.txt'), 'antes\n')
  const c = createCheckpoint(root, { reason: 'antes' })
  const files = git(root, 'ls-tree', '-r', '--name-only', c.tree).stdout.split('\n').filter(Boolean)
  assert.deepEqual(files, ['notas.txt'])
  // Depois do checkpoint, notas.txt entra no .gitignore e muda: a volta não toca nele.
  fs.writeFileSync(path.join(root, '.gitignore'), 'notas.txt\n')
  fs.writeFileSync(path.join(root, 'notas.txt'), 'depois\n')
  fs.writeFileSync(path.join(root, '.env.local'), 'SEGREDO=2\n')
  restoreCheckpoint(root, c)
  assert.equal(read(root, 'notas.txt'), 'depois\n')
  assert.equal(read(root, '.env.local'), 'SEGREDO=2\n')
  assert.ok(fs.existsSync(path.join(root, 'node_modules', 'x', 'i.js')))
})

test('worktree ligada tem a sua própria lista de checkpoints', () => {
  const root = repo()
  const wt = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-wt-')), 'ajudante')
  assert.equal(git(root, 'worktree', 'add', '-q', '-b', 'ajudante', wt).status, 0)
  fs.writeFileSync(path.join(wt, 'a.txt'), 'na worktree\n')
  const inWt = createCheckpoint(wt, { reason: 'worktree' })
  assert.match(inWt.ref, /^refs\/faundr\/wt\/ajudante\/checkpoints\/\d+$/)
  assert.equal(listCheckpoints(root).length, 0, 'não aparece no projeto principal')
  fs.writeFileSync(path.join(root, 'a.txt'), 'no principal\n')
  const inMain = createCheckpoint(root, { reason: 'principal' })
  assert.match(inMain.ref, /^refs\/faundr\/checkpoints\/\d+$/)
  assert.deepEqual(listCheckpoints(wt).map((c) => c.reason), ['worktree'])
  assert.deepEqual(listCheckpoints(root).map((c) => c.reason), ['principal'])
  assert.equal(findCheckpoint(wt, '1').ref, inWt.ref)
})

test('git começando na pasta pessoal ou na raiz do disco não ganha checkpoint', () => {
  const home = os.homedir()
  assert.equal(unsafeCheckpointRoot(home), true)
  assert.equal(unsafeCheckpointRoot(path.parse(process.cwd()).root), true)
  assert.equal(unsafeCheckpointRoot(path.join(home, 'projetos', 'loja')), false)
  assert.throws(() => createCheckpoint(home), /pasta pessoal ou raiz do disco/)
})

test('o marcador de nova tentativa é gravado antes da foto (hook derrubado no meio não trava cada edição)', () => {
  const root = repo()
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-cfg-'))
  const t0 = Date.UTC(2026, 0, 15, 12)
  fs.writeFileSync(path.join(root, 'a.txt'), 'x\n')
  // Prazo vencido = git parado no meio, como o Claude Code faria com o hook.
  assert.throws(() => ensureSessionCheckpoint(root, 's1', { configDir, now: t0, timeoutMs: 1 }))
  const marker = Number(fs.readFileSync(path.join(configDir, 'checkpoint-s1'), 'utf8'))
  assert.ok(marker < t0, 'marca de nova tentativa, não de checkpoint feito')
  assert.equal(ensureSessionCheckpoint(root, 's1', { configDir, now: t0 + 60_000 }), null)
})

test('bundle de resgate abre com git clone e guarda só os 5 mais novos', () => {
  const root = repo()
  fs.writeFileSync(path.join(root, 'novo.txt'), 'não commitado\n')
  const c = createCheckpoint(root, { reason: 'antes de: rm -rf' })
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-rescue-dir-'))
  const old = Date.now() / 1000 - 3600
  for (let i = 0; i < 6; i++) {
    fs.writeFileSync(path.join(dir, `velho-${i}.bundle`), 'x')
    fs.utimesSync(path.join(dir, `velho-${i}.bundle`), old + i, old + i)
  }
  const file = rescueBundle(root, c, { dir })
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-clone-')), 'volta')
  assert.equal(git(os.tmpdir(), 'clone', '-q', file, out).status, 0)
  // O clone pode trocar o fim de linha (core.autocrlf no Windows).
  const lf = (f) => read(out, f).replace(/\r\n/g, '\n')
  assert.equal(lf('novo.txt'), 'não commitado\n')
  assert.equal(lf('a.txt'), 'um\n')
  const left = fs.readdirSync(dir)
  assert.equal(left.length, 5)
  assert.ok(left.includes(path.basename(file)))
  assert.equal(git(root, 'branch', '--list').stdout.trim().split('\n').length, 1, 'nenhuma branch nova no projeto')
})

// Roda o hook dos comandos de verdade, com uma pasta pessoal de mentira (o ~/.faundr do teste).
function runGuard(root, command) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'faundr-home-'))
  const payload = JSON.stringify({ cwd: root, tool_name: 'Bash', tool_input: { command }, session_id: 'sessao-teste' })
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '..', 'bin', 'guard-cmd.mjs')], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, FAUNDR_LANG: 'pt' },
  })
  const out = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : ''
  return { out, home }
}

function linkedRepo() {
  const root = repo()
  fs.writeFileSync(path.join(root, '.faundr.json'), '{}\n')
  return root
}

test('o motivo do checkpoint antes de um comando não leva o texto do comando (pode ter token)', () => {
  const root = linkedRepo()
  fs.writeFileSync(path.join(root, 'a.txt'), 'mudou\n')
  const { out } = runGuard(root, 'git reset --hard && curl -H "Authorization: Bearer tokenFalso_SEGREDO" https://x.io')
  assert.match(out, /Checkpoint saved before this command \(git reset --hard\)/)
  const [c] = listCheckpoints(root)
  assert.equal(c.reason, 'antes de: git reset --hard')
  assert.doesNotMatch(JSON.stringify(listCheckpoints(root)), /SEGREDO|Bearer/)
})

test('git clean -x avisa o agente que os ignorados (.env) não estão no checkpoint', () => {
  const root = linkedRepo()
  fs.writeFileSync(path.join(root, 'novo.txt'), 'x\n')
  const { out } = runGuard(root, 'git clean -xfd')
  assert.match(out, /Checkpoint saved/)
  assert.match(out, /ignored by git \(\.env and the like\) are NOT in the checkpoint/)
})

test('apagar o .git salva um bundle de resgate fora da pasta e diz como trazer de volta', () => {
  const root = linkedRepo()
  fs.writeFileSync(path.join(root, 'novo.txt'), 'x\n')
  const { out, home } = runGuard(root, 'rm -rf .git')
  assert.match(out, /checkpoints live inside it/)
  assert.match(out, /git clone ".+\.bundle" <folder>/)
  const bundles = fs.readdirSync(path.join(home, '.faundr', 'rescue'))
  assert.equal(bundles.length, 1)
  assert.match(bundles[0], new RegExp(`^${path.basename(root)}-.+\\.bundle$`))
})
