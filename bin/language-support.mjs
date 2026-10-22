// O que o Faundr faz em cada linguagem — fonte única. O plugin usa para avisar quando uma parte não foi
// analisada; o painel (aba Linguagens da Stack e a página geral) importa este mesmo arquivo.
// Regra: uma linguagem só vira 'completo' numa função depois de passar no projeto de exemplo dos testes
// do plugin (plugin/test/fixtures/langs). Tipos: language-support.d.mts.

/** Funções do Faundr que olham o código, na ordem em que aparecem no painel. */
export const SUPPORT_FEATURES = [
  { key: 'mapa', label: 'Mapa do código', short: 'Mapa' },
  { key: 'qualidade', label: 'Qualidade', short: 'Qualidade' },
  { key: 'seguranca', label: 'Segurança do código', short: 'Segurança' },
  { key: 'dependencias', label: 'Bibliotecas com falha conhecida', short: 'Bibliotecas' },
  { key: 'segredos', label: 'Senhas e chaves expostas', short: 'Senhas e chaves' },
  { key: 'erros', label: 'Erros dos comandos', short: 'Erros' },
  { key: 'producao', label: 'Erros no app publicado', short: 'App no ar' },
  { key: 'testes', label: 'Testes', short: 'Testes' },
  { key: 'design', label: 'Design', short: 'Design' },
  { key: 'stack', label: 'Stack', short: 'Stack' },
]

/** completo: o Faundr analisa sozinho · parcial: analisa uma parte (a nota diz qual) ·
 *  claude: o Faundr ainda não analisa sozinho; o Claude revisa lendo o código quando você pede ·
 *  nao: ainda não funciona · na: não se aplica a essa linguagem. */
export const SUPPORT_STATUS = {
  completo: 'Completo',
  parcial: 'Parcial',
  claude: 'Só o Claude',
  nao: 'Ainda não',
  na: 'Não se aplica',
}

const CLAUDE_DESIGN = ['claude', 'o Claude audita lendo as telas (/faundr:design)']
const SECRETS = ['completo']
const NA = ['na']

// match: nomes de linguagem da Stack (stack.languages) ou de tecnologia (stack.tech) que ligam a linha.
export const LANGUAGE_SUPPORT = [
  {
    id: 'js-ts', name: 'JavaScript e TypeScript', examples: 'Node, React, Next.js, TanStack',
    match: { languages: ['TypeScript', 'JavaScript'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'react-native', name: 'React Native', examples: 'Expo',
    match: { tech: ['React Native', 'Expo'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'vue', name: 'Vue', examples: 'Nuxt',
    match: { languages: ['Vue'], tech: ['Vue', 'Nuxt'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'],
      seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS, erros: ['completo'], producao: ['completo'], testes: ['completo'], design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'angular', name: 'Angular',
    match: { tech: ['Angular'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'svelte-astro', name: 'Svelte e Astro',
    match: { languages: ['Svelte', 'Astro'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'],
      seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS, erros: ['completo'], producao: ['completo'], testes: ['completo'], design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'python', name: 'Python', examples: 'Django, Flask, FastAPI',
    match: { languages: ['Python'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'],
      dependencias: ['completo'], segredos: SECRETS, erros: ['completo'], producao: ['completo'], testes: ['completo'],
      design: NA, stack: ['completo'],
    },
  },
  {
    id: 'flutter', name: 'Flutter e Dart',
    match: { languages: ['Dart'], tech: ['Flutter'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'],
      dependencias: ['completo'], segredos: SECRETS, erros: ['completo'], producao: ['completo'], testes: ['completo'], design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'php', name: 'PHP', examples: 'Laravel',
    match: { languages: ['PHP'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'go', name: 'Go',
    match: { languages: ['Go'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: NA, stack: ['completo'],
    },
  },
  {
    id: 'java', name: 'Java', examples: 'Spring',
    match: { languages: ['Java'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: NA, stack: ['completo'],
    },
  },
  {
    id: 'kotlin', name: 'Kotlin', examples: 'Android',
    match: { languages: ['Kotlin'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: CLAUDE_DESIGN, stack: ['completo'],
    },
  },
  {
    id: 'csharp', name: 'C#', examples: '.NET',
    match: { languages: ['C#'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: NA, stack: ['completo'],
    },
  },
  {
    id: 'rust', name: 'Rust', examples: 'Axum, Actix Web',
    match: { languages: ['Rust'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['completo'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: NA, stack: ['completo'],
    },
  },
  {
    id: 'c', name: 'C',
    match: { languages: ['C'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['parcial', 'só com Conan (conan.lock); o vcpkg não tem base pública de falhas conhecidas'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: NA, stack: ['completo'],
    },
  },
  {
    id: 'cpp', name: 'C++',
    match: { languages: ['C++'] },
    features: {
      mapa: ['completo'], qualidade: ['completo'], seguranca: ['completo'], dependencias: ['parcial', 'só com Conan (conan.lock); o vcpkg não tem base pública de falhas conhecidas'], segredos: SECRETS,
      erros: ['completo'], producao: ['completo'], testes: ['completo'], design: NA, stack: ['completo'],
    },
  },
  {
    id: 'docker', name: 'Docker',
    match: { languages: ['Docker'] },
    features: {
      mapa: NA, qualidade: ['completo'], seguranca: ['completo'],
      dependencias: ['nao', 'as imagens base não têm base pública de falhas conhecidas (OSV); a Qualidade avisa imagem sem versão fixa'], segredos: SECRETS,
      erros: ['completo'], producao: NA, testes: NA, design: NA, stack: ['completo'],
    },
  },
  {
    id: 'html', name: 'HTML',
    match: { languages: ['HTML'] },
    features: {
      mapa: NA, qualidade: ['completo'], seguranca: ['completo'], dependencias: NA, segredos: SECRETS,
      erros: NA, producao: ['completo'], testes: NA, design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'css', name: 'CSS', examples: 'Sass, Less',
    match: { languages: ['CSS', 'SCSS', 'Less'] },
    features: {
      mapa: NA, qualidade: ['completo'], seguranca: NA, dependencias: NA, segredos: SECRETS,
      erros: ['completo'], producao: NA, testes: NA, design: ['completo'], stack: ['completo'],
    },
  },
  {
    id: 'tailwind', name: 'Tailwind',
    match: { tech: ['Tailwind CSS'] },
    features: {
      mapa: NA, qualidade: NA, seguranca: NA, dependencias: NA, segredos: NA, erros: NA, producao: NA, testes: NA, design: ['completo'], stack: ['completo'],
    },
  },
]

/** Linhas da tabela que valem para um projeto, a partir da Stack detectada (linguagens e tecnologias). */
export function supportForStack(stack) {
  const langs = new Set((stack?.languages ?? []).map((l) => l.name))
  const tech = new Set((stack?.tech ?? []).map((t) => t.name))
  return LANGUAGE_SUPPORT.filter((l) => (l.match.languages ?? []).some((n) => langs.has(n)) || (l.match.tech ?? []).some((n) => tech.has(n)))
}

/** Linhas do projeto em que a função não roda sozinha (parcial, só o Claude ou ainda não) — para o aviso. */
export function supportGaps(stack, feature) {
  return supportForStack(stack)
    .map((l) => ({ id: l.id, name: l.name, status: l.features[feature]?.[0] ?? 'na', note: l.features[feature]?.[1] }))
    .filter((g) => g.status === 'parcial' || g.status === 'claude' || g.status === 'nao')
}

/** Arquivo de código de qualquer linguagem da tabela (para a revisão do Claude, que lê qualquer uma). */
export const SOURCE_FILE = /\.(m?[jt]sx?|c[jt]s|py|go|rs|java|kts?|php|cs|dart|c|h|cc|cpp|cxx|hpp|hh|hxx|vue|svelte|astro|html?|css|scss|rb|swift|sql)$|(^|\/)Dockerfile[\w.-]*$/i

/** Linhas para o pacote de contexto do Claude: onde a checagem automática não cobre e ele precisa ler. */
export function gapLines(stack, feature) {
  return supportGaps(stack, feature).map((g) => `- ${g.name}: ${g.status === 'parcial' ? `a checagem automática cobre só uma parte (${g.note})` : 'a checagem automática ainda não cobre'}; revise lendo o código`)
}
