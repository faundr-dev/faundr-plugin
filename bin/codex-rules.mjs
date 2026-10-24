// Regra do Codex que deixa os comandos do Faundr rodarem fora da área protegida: nela os comandos do agente ficam
// sem rede, e faundr task/done/feature precisam falar com o painel. Só o setup cria a regra (com o OK da pessoa).
// O Codex lê as regras antes do hook do início da sessão, e o caminho do plugin muda a cada versão: por isso a regra
// libera um atalho de caminho fixo (~/.faundr/codex/faundr.mjs), que o início de cada sessão aponta para a versão atual.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const codexRulesFile = (home = os.homedir()) => path.join(home, '.codex', 'rules', 'faundr.rules')
export const codexLauncher = (home = os.homedir()) => path.join(home, '.faundr', 'codex', 'faundr.mjs')

// O agente escreve o caminho com / ou com \: a regra aceita os dois.
const bothSlashes = (file) => [...new Set([file.split(path.sep).join('/'), file.split('/').join('\\')])]

export function codexRulesText(home = os.homedir()) {
  return [
    '# Faundr: os comandos do Faundr falam com o painel pela rede (criado pelo setup do Faundr; para tirar, apague este arquivo).',
    'prefix_rule(',
    `    pattern = ["node", ${JSON.stringify(bothSlashes(codexLauncher(home)))}],`,
    '    decision = "allow",',
    '    justification = "Faundr records the work on the dashboard over the network",',
    ')',
    '',
  ].join('\n')
}

export function launcherText(pluginRoot) {
  const target = pathToFileURL(path.join(pluginRoot, 'bin', 'faundr.mjs')).href
  return `// Atalho do Faundr para o Codex: aponta para a versão instalada do plugin (refeito no início de cada sessão).\nawait import(${JSON.stringify(target)})\n`
}

function writeIfChanged(file, text) {
  try {
    if (fs.readFileSync(file, 'utf8') === text) return false
  } catch {
    // Ainda não existe.
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return true
}

/** Aponta o atalho para o plugin atual; com `create`, cria também a regra. Devolve se a regra existe. */
export function syncCodexRules(pluginRoot, { home = os.homedir(), create = false } = {}) {
  writeIfChanged(codexLauncher(home), launcherText(pluginRoot))
  if (create) writeIfChanged(codexRulesFile(home), codexRulesText(home))
  return fs.existsSync(codexRulesFile(home))
}
