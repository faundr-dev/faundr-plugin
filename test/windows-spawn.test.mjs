// Comandos abertos pelo shell no Windows (mvnw.cmd, gradlew.bat, flutter) e o claude.cmd instalado pelo npm.
import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { shellArg } from '../bin/tests-langs.mjs'
import { npmShimTarget } from '../bin/listen.mjs'

test('shellArg: pasta com espaço e nome com & viram texto entre aspas', () => {
  assert.equal(shellArg('C:\\Meus Projetos\\app\\mvnw.cmd', true), '"C:\\Meus Projetos\\app\\mvnw.cmd"')
  assert.equal(shellArg('test/a&calc.dart', true), '"test/a&calc.dart"')
  assert.equal(shellArg('-Dtest=A,B', true), '-Dtest=A,B')
  assert.equal(shellArg('tests/a b.rs', false), "'tests/a b.rs'")
  assert.equal(shellArg("it's", false), "'it'\\''s'")
  assert.equal(shellArg('--no-fail-fast', false), '--no-fail-fast')
})

test('npmShimTarget: abre direto o programa que o claude.cmd chama', () => {
  const shim = path.join('C:\\npm', 'claude.cmd')
  assert.deepEqual(npmShimTarget(shim, '"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*'), {
    cmd: path.join('C:\\npm', 'node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe'),
    pre: [],
  })
  const js = npmShimTarget(shim, '"%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*')
  assert.equal(js.cmd, process.execPath)
  assert.equal(js.pre[0], path.join('C:\\npm', 'node_modules\\@anthropic-ai\\claude-code\\cli.js'))
  assert.equal(npmShimTarget(shim, '@echo off'), null)
})
