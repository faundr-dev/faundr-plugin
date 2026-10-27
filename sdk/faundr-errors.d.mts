// Tipos do SDK de erros do Faundr para o servidor (faundr-errors.mjs). Copiado junto com `faundr errors-sdk`.

export type FaundrOptions = {
  /** Endereço de envio (DSN) do projeto, em Faundr → Erros → App publicado. */
  dsn: string
  /** Commit do build; sem ele, lê COMMIT_SHA, VERCEL_GIT_COMMIT_SHA, RENDER_GIT_COMMIT… */
  release?: string
  environment?: string
  /** No Node, o padrão é ligar só com NODE_ENV=production. */
  enabled?: boolean
}

type RequestLike = { method?: string; url?: string; originalUrl?: string }

export function init(options: FaundrOptions): void
export function capture(error: unknown, extra?: { request?: RequestLike; mechanism?: string; handled?: boolean }): Promise<void>
export function errorHandler(): (error: unknown, req: RequestLike, res: unknown, next: (error?: unknown) => void) => void
export function withFaundr<Env, H extends object>(options: FaundrOptions | ((env: Env) => FaundrOptions), handler: H): H
