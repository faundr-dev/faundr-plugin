// Língua do que a pessoa lê direto do plugin (setup, linha de status, saídas do terminal, achados gravados no painel).
// O que vai só para o Claude fica em inglês: ele responde na língua da pessoa.
// Ordem: faundr config lang (em ~/.faundr/config.json) > FAUNDR_LANG > LC_ALL/LC_MESSAGES/LANG (fora do Windows)
// > língua do sistema > inglês.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const LANGS = ['en', 'pt']

// 'pt-BR', 'pt_BR.UTF-8', 'Portuguese_Brazil.1252' → 'pt'; o resto → 'en'.
export function normalizeLang(value) {
  const v = String(value ?? '').trim().toLowerCase()
  if (!v || v === 'c' || v === 'posix') return null
  if (v.startsWith('pt') || v.startsWith('portuguese')) return 'pt'
  return 'en'
}

export function detectLang({ config = {}, env = process.env, systemLocale, platform = process.platform } = {}) {
  if (LANGS.includes(config.lang)) return config.lang
  // No Windows o LANG vem do Git Bash (en_US.UTF-8 mesmo num Windows em português): vale a língua do sistema.
  const vars = platform === 'win32' ? [env.FAUNDR_LANG] : [env.FAUNDR_LANG, env.LC_ALL, env.LC_MESSAGES, env.LANG]
  for (const v of vars) {
    const lang = normalizeLang(v)
    if (lang) return lang
  }
  const sys = systemLocale ?? Intl.DateTimeFormat().resolvedOptions().locale
  return normalizeLang(sys) ?? 'en'
}

function configLang() {
  try {
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.faundr', 'config.json'), 'utf8')).lang
  } catch {
    // Sem config: segue para o ambiente e a língua do sistema.
    return undefined
  }
}

let current = null
export function lang() {
  current ??= detectLang({ config: { lang: configLang() } })
  return current
}

// Para testes e para quem precisa forçar (ex.: logo depois de faundr config lang).
export function setLang(value) {
  current = LANGS.includes(value) ? value : null
}

// Para datas e números no que a pessoa lê: toLocaleString(locale(), …).
export function locale() {
  return lang() === 'pt' ? 'pt-BR' : 'en-US'
}

// t('Done', 'Pronto'): o texto na língua da pessoa.
export function t(en, pt) {
  return lang() === 'pt' ? pt : en
}
