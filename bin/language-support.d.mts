// Tipos de language-support.mjs, para o painel (src/) importar a mesma tabela.

export type SupportFeature = 'mapa' | 'qualidade' | 'seguranca' | 'dependencias' | 'segredos' | 'erros' | 'producao' | 'testes' | 'design' | 'stack'
export type SupportStatus = 'completo' | 'parcial' | 'claude' | 'nao' | 'na'

export type LanguageSupport = {
  id: string
  name: string
  /** Nome em inglês, só quando difere do português. */
  name_en?: string
  examples?: string
  match: { languages?: string[]; tech?: string[] }
  features: Record<SupportFeature, [SupportStatus, string?]>
}

export const SUPPORT_FEATURES: { key: SupportFeature; label: string; short: string }[]
export const SUPPORT_STATUS: Record<SupportStatus, string>
export const LANGUAGE_SUPPORT: LanguageSupport[]

type StackLike = { languages?: { name: string }[]; tech?: { name: string }[] } | null | undefined
export function supportForStack(stack: StackLike): LanguageSupport[]
export function supportGaps(stack: StackLike, feature: SupportFeature): { id: string; name: string; name_en?: string; status: SupportStatus; note?: string }[]
export const SOURCE_FILE: RegExp
export function gapLines(stack: StackLike, feature: SupportFeature): string[]
export function supportName(row: { name: string; name_en?: string }, lang: 'en' | 'pt'): string
export function supportNote(note: string | undefined, lang: 'en' | 'pt'): string | undefined
