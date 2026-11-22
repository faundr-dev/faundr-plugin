// Contexto da revisão com IA (faundr quality-context): que arquivos revisar — o que mudou desde o começo da
// sessão ou o projeto inteiro — e o que já está registrado. A saída vai para o agente: em inglês e estável.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { SOURCE_FILE } from './language-support.mjs'
import { exists, read } from './quality-common.mjs'

// O que não é mudança de código: lockfiles, gerados, build e imagens.
export const NOT_CODE_CHANGE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|routeTree\.gen\.ts)$|(^|\/)(dist|build|out|\.output|node_modules)\/|\.(min\.js|map|svg|png|jpe?g|webp|ico|wasm)$/
// Além do código: configuração, SQL e scripts de terminal também entram na revisão (um workflow, um wrangler.jsonc).
const CONFIG_FILE = /\.(json|jsonc|json5|ya?ml|toml|ini|conf|sh|bash|zsh|ps1|bat|cmd|sql|tf|graphql|prisma|proto)$|(^|\/)(Makefile|Procfile|\.env\.example)$/i

const reviewable = (f) => !f.startsWith('..') && !path.isAbsolute(f) && (SOURCE_FILE.test(f) || CONFIG_FILE.test(f)) && !NOT_CODE_CHANGE.test(f)

/**
 * O que mudou desde `base` (o commit em que a sessão começou; sem ele, o último commit), somado ao que ainda não
 * foi commitado, aos arquivos novos e aos que a sessão editou. Com a base da sessão, o que ela já commitou
 * continua na lista (com `git diff HEAD` a revisão vinha vazia depois de um commit). Devolve os arquivos que
 * existem e, à parte, os apagados.
 */
export function changedFiles(root, base, sessionFiles = []) {
  const git = (args) => spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
  const diffFrom = (ref) => git(['diff', '--name-status', '--no-renames', ref])
  let diff = base ? diffFrom(base) : null
  // Base que não existe mais (histórico reescrito) ou sessão sem base: compara com o último commit.
  if (diff?.status !== 0) diff = diffFrom('HEAD')
  const rows = (diff.stdout ?? '').split('\n').filter(Boolean).map((row) => row.split('\t'))
  const untracked = git(['ls-files', '--others', '--exclude-standard']).stdout?.split('\n').filter(Boolean) ?? []
  const touched = [...new Set([...rows.map(([, file]) => file), ...untracked, ...sessionFiles])].filter((f) => f && reviewable(f))
  return { files: touched.filter((f) => exists(root, f)), deleted: touched.filter((f) => !exists(root, f)) }
}

/** As seções "Files to review" e "Deleted files" do modo sessão. */
export function changedLines({ files, deleted }) {
  const out = [
    `## Files to review (${files.length})`,
    ...(files.length || deleted.length ? files.map((f) => `- ${f}`) : ['- Nothing changed since the last commit. Tell the user and offer the project review: /faundr:quality --full']),
    '',
  ]
  if (deleted.length) out.push(`## Deleted files (${deleted.length}) — check that nothing still imports or mentions them`, ...deleted.map((f) => `- ${f}`), '')
  return out
}

/** Modo projeto: todos os arquivos de código, uma linha por pasta, com as linhas de cada um. */
export function projectFileLines(root, files) {
  const folders = new Map()
  let total = 0
  for (const file of [...files].sort()) {
    const dir = path.posix.dirname(file)
    const text = read(root, file)
    const lines = text === null ? null : text.split('\n').length
    total += lines ?? 0
    const folder = folders.get(dir) ?? { lines: 0, names: [] }
    folder.lines += lines ?? 0
    folder.names.push(`${path.posix.basename(file)}${lines === null ? '' : ` ${lines}`}`)
    folders.set(dir, folder)
  }
  const out = [`## All code files (${files.length} files, ${total} lines) — the review covers every folder`]
  for (const [dir, f] of folders) out.push(`- ${dir === '.' ? '(root)' : `${dir}/`} (${f.names.length} files, ${f.lines} lines): ${f.names.join(', ')}`)
  return [...out, '']
}

const fromAiReview = (f) => f.origin === 'audit' || String(f.rule_id ?? '').startsWith('ia/')
const OTHERS_MAX = 80

/**
 * O que já está registrado e aberto. Os achados da revisão com IA vêm todos (nenhuma checagem automática os
 * fecha: quem reconfere é a próxima revisão); os outros, até 80. No modo projeto os da IA ganham seção própria.
 * `line`: como escrever um achado (sem o Q-n). Os "a confirmar" (needs_check: faltou um fato para a revisão
 * decidir) vêm à parte, no fim, com o fato que falta: a revisão de agora tenta decidir cada um.
 */
export function recordedLines(findings, { files = null, full = false, line }) {
  const inScope = files ? findings.filter((f) => !f.file || files.includes(f.file)) : findings
  const relevant = inScope.filter((f) => !f.needs_check)
  const toConfirm = inScope.filter((f) => f.needs_check)
  const ai = relevant.filter(fromAiReview)
  const others = relevant.filter((f) => !fromAiReview(f))
  const item = (f) => `- Q-${f.ref} ${line(f)}`
  const out = []
  if (full)
    out.push(
      `## Open findings from earlier AI reviews (${ai.length}) — re-check every one against the code today`,
      ...(ai.length
        ? [...ai.map(item), 'For each: fixed → faundr quality-resolve Q-<n> --verified "what changed and how you checked"; still there → leave it open; do not record it again.']
        : ['- None.']),
      '',
    )
  const listed = full ? others : relevant
  out.push(`## Already recorded and open (${listed.length}) — do not record them again`)
  if (!full) out.push(...ai.map(item))
  out.push(...others.slice(0, OTHERS_MAX).map(item))
  if (others.length > OTHERS_MAX) out.push(`- … and ${others.length - OTHERS_MAX} more`)
  if (toConfirm.length)
    out.push(
      '',
      `## To confirm (${toConfirm.length}) — an earlier review was missing one fact; try to settle each one now`,
      ...toConfirm.flatMap((f) => [item(f), `  Missing fact: ${f.needs_check}`]),
      'For each: the fact is now known and it is a problem → record it again with the same title, --theme and --file, without --needs-check (confidence 80-100): it becomes a confirmed finding; it is not a problem → faundr quality-ignore Q-<n> --reason false-alarm --note "<the fact>"; still unknown → leave it.',
    )
  return out
}
