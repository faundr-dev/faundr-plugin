import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectLang, normalizeLang, setLang, t } from '../bin/i18n.mjs'

test('normalizeLang: formatos de Linux, macOS e Windows', () => {
  assert.equal(normalizeLang('pt_BR.UTF-8'), 'pt')
  assert.equal(normalizeLang('pt-PT'), 'pt')
  assert.equal(normalizeLang('Portuguese_Brazil.1252'), 'pt')
  assert.equal(normalizeLang('en_US.UTF-8'), 'en')
  assert.equal(normalizeLang('de-DE'), 'en')
  assert.equal(normalizeLang('C'), null)
  assert.equal(normalizeLang(''), null)
})

test('detectLang: a escolha salva vence o ambiente, o ambiente vence o sistema', () => {
  assert.equal(detectLang({ config: { lang: 'en' }, env: { LANG: 'pt_BR.UTF-8' }, systemLocale: 'pt-BR' }), 'en')
  const linux = { platform: 'linux' }
  assert.equal(detectLang({ config: { lang: 'en' }, env: { LANG: 'pt_BR.UTF-8' }, systemLocale: 'pt-BR', ...linux }), 'en')
  assert.equal(detectLang({ env: { FAUNDR_LANG: 'pt' }, systemLocale: 'en-US', ...linux }), 'pt')
  assert.equal(detectLang({ env: { LANG: 'C.UTF-8' }, systemLocale: 'pt-BR', ...linux }), 'en', 'LANG=C.UTF-8 é escolha de inglês')
  assert.equal(detectLang({ env: {}, systemLocale: 'pt-BR', ...linux }), 'pt')
  assert.equal(detectLang({ env: {}, systemLocale: 'ja-JP', ...linux }), 'en')
  assert.equal(detectLang({ config: { lang: 'fr' }, env: {}, systemLocale: 'pt-BR', ...linux }), 'pt', 'língua que o plugin não tem é ignorada')
})

test('detectLang: no Windows o LANG do Git Bash não vale, só FAUNDR_LANG e a língua do sistema', () => {
  const win = { platform: 'win32' }
  assert.equal(detectLang({ env: { LANG: 'en_US.UTF-8' }, systemLocale: 'pt-BR', ...win }), 'pt')
  assert.equal(detectLang({ env: { LANG: 'en_US.UTF-8', FAUNDR_LANG: 'en' }, systemLocale: 'pt-BR', ...win }), 'en')
})

test('t: devolve o texto da língua atual', () => {
  setLang('pt')
  assert.equal(t('Done', 'Pronto'), 'Pronto')
  setLang('en')
  assert.equal(t('Done', 'Pronto'), 'Done')
  setLang(null)
})
