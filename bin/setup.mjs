// faundr setup: configura o Faundr de uma vez. Faz sozinho o que é seguro (login conferido, pasta ligada quando o nome
// bate com um projeto só, mapa, Stack, primeiras checagens, linha de status, skills) e devolve o que pede o OK do dono
// (mexe em arquivos do projeto ou pede algo dele), cada um com o comando que aplica. Aqui ficam as partes sem rede.
import { t } from './i18n.mjs'

/** Estado de cada item: ok (já estava), feito (o setup fez agora), pedir (precisa do OK), falta (só o dono resolve), erro. */
export const SETUP_STATUS = {
  ok: 'ok',
  feito: t('done now', 'feito agora'),
  pedir: t('needs your OK', 'precisa do seu OK'),
  falta: t('missing', 'falta'),
  erro: t('failed', 'deu erro'),
}

/** O .gitignore já deixa de fora a pasta local do Faundr (.faundr/)? */
export function gitignoreCoversFaundr(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .some((l) => /^\/?\.faundr\/?(\*\*?)?$/.test(l))
}

/** Acrescenta .faundr/ ao .gitignore (texto novo), com uma linha dizendo o porquê. */
export function withFaundrIgnored(text) {
  const base = String(text ?? '')
  if (gitignoreCoversFaundr(base)) return base
  const sep = base && !base.endsWith('\n') ? '\n' : ''
  const why = t('Faundr: code map, state and local reports (they do not go to git)', 'Faundr: mapa do código, estado e relatórios locais (não vão para o git)')
  return `${base}${sep}${base ? '\n' : ''}# ${why}\n.faundr/\n`
}

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')

/** O projeto do painel cujo nome bate com o da pasta (ou do package.json); só quando há exatamente um. */
export function guessProject(projects, names) {
  const wanted = new Set(names.map(norm).filter(Boolean))
  const hits = (projects ?? []).filter((p) => wanted.has(norm(p.name)))
  return hits.length === 1 ? hits[0] : null
}

/** Node mínimo do plugin (fetch, AbortSignal.timeout, Object.hasOwn, test runner). */
export function nodeOk(version = process.versions.node) {
  return Number(String(version).split('.')[0]) >= 20
}

/** Resumo do setup para imprimir: um item por linha e, no fim, o que pede OK com o comando. */
export function setupSummary(items) {
  const icon = { ok: '✓', feito: '✓', pedir: '?', falta: '!', erro: '✗' }
  const lines = items.map((i) => `${icon[i.status]} ${i.title}: ${i.detail}`)
  const asks = items.filter((i) => i.status === 'pedir' || i.status === 'falta')
  if (!asks.length) return [...lines, '', t('All set: Faundr is configured in this project.', 'Tudo pronto: o Faundr está configurado neste projeto.')].join('\n')
  return [
    ...lines,
    '',
    t('Needs your OK or an action from you:', 'Falta o seu OK ou uma ação sua:'),
    ...asks.map((i) => `- ${i.title}: ${i.why ?? i.detail}${i.apply ? `\n    ${i.apply}` : ''}`),
  ].join('\n')
}
