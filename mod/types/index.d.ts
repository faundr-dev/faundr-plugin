// Contrato do estado do mod do Faundr: a última medição da sessão (para a faixa) e os avisos já mostrados.
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Measure = { context?: { percent?: number }; rateLimits?: Limit[] }

declare module 'claude-code' {
  interface PluginState {
    'faundr-mod': { measure: Measure | null; seen: string[] }
  }
}
