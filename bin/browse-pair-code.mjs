// Código curto da aba-ponte do navegador rápido (faundr browse --chrome), tirado do hash da senha da ponte: a CLI
// mostra no terminal e a extensão mostra no pedido de "Permitir"; a pessoa só permite se os dois forem iguais.
// Cópia idêntica em extension/pair-code.js (plugin/test/browse-pair-code.test.mjs barra cópia diferente).
// 2 letras (sem I e O, que confundem com 1 e 0) + 2 dígitos, ex.: "KX-42".
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export async function pairCode(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)))
  const b = new Uint8Array(hash)
  const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
  const first = LETTERS[n % 24]
  const second = LETTERS[Math.floor(n / 24) % 24]
  const digits = String(Math.floor(n / 576) % 100).padStart(2, '0')
  return `${first}${second}-${digits}`
}
