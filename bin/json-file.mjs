// Estado local em JSON que vários hooks leem, alteram e gravam ao mesmo tempo (no Stop rodam `hook` e `gate`; em
// cada ferramenta, `guard` e `hook`). Duas proteções:
// - a gravação vai para um arquivo temporário e troca de nome de uma vez: quem lê nunca pega o arquivo pela metade;
// - se o arquivo existe e não deu para ler, não grava por cima (gravaria `{}` + o pedaço novo e zeraria o resto).
import fs from 'node:fs'
import path from 'node:path'

/** Marca o objeto lido de um arquivo ilegível: writeJsonAtomic não grava objeto marcado. */
export const UNREADABLE = Symbol('faundr.unreadable')

// Arquivo ilegível que ninguém mexe há esse tempo está estragado de vez (e não no meio de uma gravação).
const BROKEN_AFTER_MS = 5_000

const pause = (ms) => {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  } catch {
    // Sem Atomics.wait (raro): tenta de novo sem esperar.
  }
}

/**
 * Lê para alterar e gravar de volta. Sem o arquivo: `fallback`. Existe e não deu para ler (outro processo no
 * Windows segurando, conteúdo estragado): `undefined`, e quem chamou não grava.
 */
export function readJsonForUpdate(file, fallback) {
  for (let i = 0; i < 3; i++) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (err) {
      if (err?.code === 'ENOENT') return fallback
    }
    pause(25)
  }
  // Continua ilegível e parado há um tempo: guarda de lado e recomeça, senão o estado nunca mais grava.
  try {
    if (Date.now() - fs.statSync(file).mtimeMs > BROKEN_AFTER_MS) {
      fs.renameSync(file, `${file}.broken`)
      return fallback
    }
  } catch {
    // Não deu nem para olhar o arquivo: trata como ilegível.
  }
  return undefined
}

/** Igual a readJsonForUpdate para um objeto: ilegível volta como `fallback` marcado, que não é gravado. */
export function readJsonObject(file, fallback = {}) {
  const data = readJsonForUpdate(file, fallback)
  return data === undefined ? { ...fallback, [UNREADABLE]: true } : data
}

/** Grava de uma vez (temporário + troca de nome). Devolve false sem gravar quando `data` veio de arquivo ilegível. */
export function writeJsonAtomic(file, data, space) {
  if (data?.[UNREADABLE]) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify(data, null, space))
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, file)
      return true
    } catch (err) {
      // No Windows, a troca falha enquanto outro processo está com o arquivo aberto: tenta mais algumas vezes.
      if (i >= 4) {
        try {
          fs.unlinkSync(tmp)
        } catch {
          // O temporário já sumiu.
        }
        throw err
      }
      pause(20)
    }
  }
}
