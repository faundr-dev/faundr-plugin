// Aviso de começo: no início da sessão, quando falta algo para o Faundr funcionar na pasta (login ou ligar a pasta a
// um projeto), o Claude recebe uma nota para dizer ao usuário, numa linha, o que falta e o comando que resolve.
// Pasta sem projeto ligado só avisa se parecer um projeto (git ou package.json) e no máximo uma vez a cada 7 dias por
// pasta, para não incomodar quem abre o agente em qualquer lugar. Pasta ligada sem login avisa sempre: a pessoa
// claramente quer usar o Faundr ali.

import fs from 'node:fs'
import path from 'node:path'

export const HINT_EVERY_MS = 7 * 24 * 60 * 60 * 1000
const PROJECT_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile']

export const looksLikeProject = (cwd) => PROJECT_MARKERS.some((m) => fs.existsSync(path.join(cwd, m)))

/**
 * O que falta e o texto da nota (ou null). `seen` é { pasta: quando avisou }; devolve o `seen` atualizado.
 * `skill(name)` escreve o comando do jeito do agente (/faundr:x no Claude Code, $faundr:x no Codex).
 */
export function setupHint({ linked, hasToken, isProject, cwd, now, seen, skill }) {
  if (linked && hasToken) return { text: null, seen }
  if (linked && !hasToken) {
    return {
      text: `[Faundr] This folder is linked to a Faundr project, but the plugin is not signed in, so nothing from this session reaches the dashboard. In your first reply, tell the user in one line, in their language, that Faundr is missing the sign-in and that ${skill('login')} fixes it (the browser opens to approve a code). Do not run it yourself and do not repeat this later in the session.`,
      seen,
    }
  }
  const last = seen[cwd] ?? 0
  if (!isProject || now - last < HINT_EVERY_MS) return { text: null, seen }
  const what = hasToken ? `this folder is not linked to a Faundr project yet` : `it is not signed in and this folder is not linked to a project yet`
  return {
    text: `[Faundr] The Faundr plugin is installed, but ${what}. In your first reply, after answering what the user asked, add one line in their language saying that ${skill('setup')} sets Faundr up here (it signs in if needed and creates or links the project), and that they can ignore this if they don't want Faundr in this folder. Do not run it yourself and do not repeat it later in the session.`,
    seen: { ...seen, [cwd]: now },
  }
}
