// Regra do Codex que deixa os comandos do Faundr rodarem fora da área protegida: nela os comandos do agente ficam
// sem rede, e faundr task/done/feature precisam falar com o painel. Só o setup cria (com o OK da pessoa); depois o
// início de cada sessão do Codex só atualiza o caminho, que muda a cada versão do plugin.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const codexRulesFile = (home = os.homedir()) => path.join(home, '.codex', 'rules', 'faundr.rules')

export function codexRulesText(pluginRoot) {
  const cli = path.join(pluginRoot, 'bin', 'faundr.mjs')
  // O agente escreve o caminho com / ou com \: a regra aceita os dois.
  const paths = [...new Set([cli.split(path.sep).join('/'), cli.split('/').join('\\')])]
  return [
    '# Faundr: os comandos do Faundr falam com o painel pela rede (criado pelo setup do Faundr; para tirar, apague este arquivo).',
    'prefix_rule(',
    `    pattern = ["node", ${JSON.stringify(paths)}],`,
    '    decision = "allow",',
    '    justification = "Faundr records the work on the dashboard over the network",',
    ')',
    '',
  ].join('\n')
}

/** Escreve a regra quando ela muda. `create: false` só atualiza uma que já existe. Devolve se escreveu. */
export function syncCodexRules(pluginRoot, { home = os.homedir(), create = false } = {}) {
  const file = codexRulesFile(home)
  const text = codexRulesText(pluginRoot)
  let current = null
  try {
    current = fs.readFileSync(file, 'utf8')
  } catch {
    if (!create) return false
  }
  if (current === text) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return true
}

export function removeCodexRules(home = os.homedir()) {
  fs.rmSync(codexRulesFile(home), { force: true })
}
