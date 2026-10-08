// LGPD para quem não programa: que dados pessoais o app coleta, quais são sensíveis, para quais empresas eles vão
// (rastreadores e serviços) e o que falta (política de privacidade, termos, aviso de cookies, excluir a conta).
// Sem IA e sem ler dados de usuários: só nomes de campos, colunas, pacotes e endereços no código.

import fs from 'node:fs'
import path from 'node:path'
import { checkPrivacy } from './launch.mjs'

const MAX_FILE = 400_000
const SKIP = /(^|\/)(node_modules|dist|build|\.next|\.output|\.svelte-kit|\.git|\.faundr|vendor|coverage|\.wrangler|\.vercel|bench|docs?|examples?|plugin|engine)\//
const TEST = /(^|\/)(tests?|__tests__|e2e|spec|fixtures?)\/|\.(test|spec)\.[a-z]+$/i
const UI = /\.(m?[jt]sx|vue|svelte|astro|html)$/
const CODE = /\.(m?[jt]sx?|cjs|vue|svelte|astro|html|py|rb|php)$/

function read(root, rel) {
  try {
    const abs = path.join(root, rel)
    if (fs.statSync(abs).size > MAX_FILE) return ''
    return fs.readFileSync(abs, 'utf8')
  } catch {
    return ''
  }
}

// Categorias de dado pessoal (art. 5º, I) e sensível (art. 5º, II, e dados de crianças, art. 14), pelo nome do campo.
export const CATEGORIES = [
  { name: 'Nome', re: /^(full_?name|nome(_completo)?|first_?name|last_?name|sobrenome|display_?name)$/i },
  { name: 'E-mail', re: /e_?mail/i },
  { name: 'Telefone', re: /(phone|telefone|celular|whats_?app|mobile)/i },
  { name: 'CPF ou documento', re: /^(cpf|cnpj|rg|documento|document(_number)?|passport|passaporte|tax_?id)$/i },
  { name: 'Endereço', re: /(address|endereco|endereço|^cep$|zip_?code|postal|street|^rua$|bairro|^city$|cidade)/i },
  { name: 'Data de nascimento ou idade', re: /(birth|nascimento|^dob$|^idade$|^age$|bday)/i },
  { name: 'Localização', re: /(latitude|longitude|^lat$|^lng$|geoloca|^location$|localiza)/i },
  { name: 'IP e aparelho', re: /(ip_?address|^ip$|user_?agent|device_?id)/i },
  { name: 'Dados de pagamento', re: /(card_?number|cartao|cartão|cc-number|^iban$|pix_?key|chave_?pix|bank_?account|conta_?bancaria)/i },
  { name: 'Foto ou imagem da pessoa', re: /(avatar|photo|foto|selfie|profile_?pic)/i },
  { name: 'Senha', re: /(password|senha)/i },
  { name: 'Saúde', sensitive: true, re: /(health|saude|saúde|diagnos|medical|medic[oa]|doenca|doença|^cid$|alergi|gravidez|pregnan|prescri|receita_medica)/i },
  { name: 'Religião', sensitive: true, re: /relig/i },
  { name: 'Origem racial ou étnica', sensitive: true, re: /(^race$|^raca$|^raça$|etnia|ethnic)/i },
  { name: 'Vida ou orientação sexual', sensitive: true, re: /(sexual|orientacao|orientação)/i },
  { name: 'Opinião política ou filiação', sensitive: true, re: /(politic|partido|sindica)/i },
  { name: 'Biometria ou dado genético', sensitive: true, re: /(biometr|impressao_?digital|impressão_?digital|face_?id|facial|genetic|genétic|^dna$)/i },
  { name: 'Dados de crianças', sensitive: true, re: /(crianca|criança|^child|kid_|menor_de_idade|^minor|^aluno_menor)/i },
]
// autocomplete do HTML diz exatamente o que o campo pede.
const AUTOCOMPLETE = {
  name: 'Nome', 'given-name': 'Nome', 'family-name': 'Nome', email: 'E-mail', tel: 'Telefone', 'street-address': 'Endereço', 'postal-code': 'Endereço',
  'address-line1': 'Endereço', bday: 'Data de nascimento ou idade', 'cc-number': 'Dados de pagamento', 'new-password': 'Senha', 'current-password': 'Senha', photo: 'Foto ou imagem da pessoa',
}
const INPUT_TYPE = { email: 'E-mail', tel: 'Telefone', password: 'Senha' }

const PEOPLE_TABLE = /(user|profile|customer|client|contact|member|lead|pessoa|usuario|usuário|aluno|paciente|cliente|funcionario|employee|person|people)/i
const categoryOf = (field) => CATEGORIES.find((c) => c.re.test(field.replace(/^.*\./, '')))

/** Campos de formulário nas telas: name=, register('x'), autocomplete=, type=email|tel|password. */
function uiFields(text) {
  const out = []
  for (const m of text.matchAll(/\b(?:name|id|htmlFor)=["'{`]+([\w.-]{2,40})["'`}]/g)) out.push({ field: m[1] })
  for (const m of text.matchAll(/\bregister\(\s*["'`]([\w.]{2,40})["'`]/g)) out.push({ field: m[1] })
  for (const m of text.matchAll(/\bautoComplete=["']([\w-]+)["']|\bautocomplete=["']([\w-]+)["']/g)) {
    const cat = AUTOCOMPLETE[m[1] ?? m[2]]
    if (cat) out.push({ category: cat })
  }
  for (const m of text.matchAll(/<input[^>]*\btype=["'](email|tel|password)["']/gi)) out.push({ category: INPUT_TYPE[m[1].toLowerCase()] })
  return out
}

/** Colunas criadas nas migrações SQL e campos do Prisma: [{ table, column }]. */
function dbColumns(root, files) {
  const out = []
  for (const f of files.filter((x) => /(^|\/)(supabase\/migrations|migrations|db\/migrations|prisma\/migrations)\/.*\.sql$/.test(x))) {
    const sql = read(root, f).replace(/--.*$/gm, '')
    for (const t of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(([\s\S]*?)\n\)\s*;/gi))
      for (const c of t[2].matchAll(/^\s*"?([a-z_][\w]*)"?\s+[a-z]/gim))
        if (!/^(constraint|primary|unique|check|foreign)$/i.test(c[1])) out.push({ table: t[1].replace(/"|^public\./g, ''), column: c[1], file: f })
    for (const a of sql.matchAll(/alter\s+table\s+(?:only\s+)?([\w."]+)([\s\S]*?);/gi))
      for (const c of a[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi)) out.push({ table: a[1].replace(/"|^public\./g, ''), column: c[1], file: f })
  }
  for (const f of files.filter((x) => /(^|\/)schema\.prisma$/.test(x))) {
    const text = read(root, f)
    for (const mdl of text.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\}/g))
      for (const c of mdl[2].matchAll(/^\s*(\w+)\s+\w/gm)) out.push({ table: mdl[1], column: c[1], file: f })
  }
  return out
}

// Empresas que recebem dados: rastreadores (com cookies, pedem consentimento) e serviços (operadores).
export const THIRD_PARTIES = [
  { name: 'Google Analytics / Tag Manager', kind: 'rastreador', cookies: true, what: 'páginas visitadas, aparelho, localização aproximada e identificador do navegador', re: /googletagmanager\.com|google-analytics\.com|\bgtag\(|@next\/third-parties\/google|\breact-ga4?\b/, dep: /^(react-ga4?|@next\/third-parties|vue-gtag|ga-4-react)$/ },
  { name: 'Meta Pixel (Facebook/Instagram)', kind: 'rastreador', cookies: true, what: 'páginas visitadas e ações (cadastro, compra) para anúncios', re: /connect\.facebook\.net|\bfbq\(/, dep: /^react-facebook-pixel$/ },
  { name: 'TikTok Pixel', kind: 'rastreador', cookies: true, what: 'páginas visitadas e ações para anúncios', re: /analytics\.tiktok\.com|\bttq\.(load|page|track)/ },
  { name: 'LinkedIn Insight', kind: 'rastreador', cookies: true, what: 'visitas para anúncios no LinkedIn', re: /snap\.licdn\.com|_linkedin_partner_id/ },
  { name: 'Hotjar', kind: 'rastreador', cookies: true, what: 'gravação de cliques, rolagem e o que a pessoa faz na tela', re: /static\.hotjar\.com|hotjar\.com\/c\//, dep: /^@hotjar\/browser$/ },
  { name: 'Microsoft Clarity', kind: 'rastreador', cookies: true, what: 'gravação de cliques e rolagem', re: /clarity\.ms\/tag|\bclarity\(\s*["']/, dep: /^@microsoft\/clarity$/ },
  { name: 'Mixpanel', kind: 'rastreador', cookies: true, what: 'eventos de uso ligados à pessoa', dep: /^mixpanel(-browser)?$/ },
  { name: 'Amplitude', kind: 'rastreador', cookies: true, what: 'eventos de uso ligados à pessoa', dep: /^@amplitude\// },
  { name: 'Segment', kind: 'rastreador', cookies: true, what: 'eventos de uso repassados a outras ferramentas', dep: /^@segment\// },
  { name: 'PostHog', kind: 'rastreador', cookies: true, what: 'eventos de uso e, se ligado, gravação da tela', dep: /^posthog-(js|node)$/ },
  { name: 'Plausible', kind: 'rastreador', cookies: false, what: 'contagem de visitas sem cookies nem dados pessoais', re: /plausible\.io\/js/ },
  { name: 'Vercel Analytics', kind: 'rastreador', cookies: false, what: 'contagem de visitas sem cookies', dep: /^@vercel\/(analytics|speed-insights)$/ },
  { name: 'YouTube (vídeo incorporado)', kind: 'rastreador', cookies: true, what: 'o Google guarda cookies de quem vê o vídeo', re: /youtube\.com\/embed\/(?!.*nocookie)/ },
  { name: 'Google reCAPTCHA', kind: 'servico', cookies: true, what: 'comportamento no formulário para saber se é robô', re: /google\.com\/recaptcha|grecaptcha/, dep: /^react-google-recaptcha/ },
  { name: 'Intercom', kind: 'servico', cookies: true, what: 'conversas de atendimento, nome e e-mail', re: /widget\.intercom\.io/, dep: /^@intercom\/|^react-use-intercom$/ },
  { name: 'Crisp', kind: 'servico', cookies: true, what: 'conversas de atendimento', re: /client\.crisp\.chat/ },
  { name: 'HubSpot', kind: 'servico', cookies: true, what: 'contatos, formulários e visitas', re: /js\.hs-scripts\.com|js\.hsforms\.net/ },
  { name: 'Sentry (erros)', kind: 'servico', cookies: false, what: 'erros do app, com o endereço IP e o que a pessoa fez antes do erro', dep: /^@sentry\// },
  { name: 'Supabase (banco e login)', kind: 'servico', cookies: false, what: 'todos os dados guardados pelo app e o login', dep: /^@supabase\/(supabase-js|ssr|auth-helpers)/ },
  { name: 'Firebase (banco e login)', kind: 'servico', cookies: false, what: 'dados guardados pelo app e o login', dep: /^firebase(-admin)?$/ },
  { name: 'Clerk (login)', kind: 'servico', cookies: true, what: 'contas e login', dep: /^@clerk\// },
  { name: 'Stripe (pagamento)', kind: 'servico', cookies: true, what: 'nome, e-mail e dados de pagamento', dep: /^(stripe|@stripe\/stripe-js)$/ },
  { name: 'Mercado Pago (pagamento)', kind: 'servico', cookies: true, what: 'nome, CPF, e-mail e dados de pagamento', dep: /^(mercadopago|@mercadopago\/)/ },
  { name: 'OpenAI (IA)', kind: 'servico', cookies: false, what: 'o texto que as pessoas escrevem ou enviam para a IA (fora do Brasil)', dep: /^(openai|@ai-sdk\/openai)$/ },
  { name: 'Anthropic (IA)', kind: 'servico', cookies: false, what: 'o texto que as pessoas escrevem ou enviam para a IA (fora do Brasil)', dep: /^(@anthropic-ai\/sdk|@ai-sdk\/anthropic)$/ },
  { name: 'Google Gemini (IA)', kind: 'servico', cookies: false, what: 'o texto que as pessoas escrevem ou enviam para a IA (fora do Brasil)', dep: /^(@google\/generative-ai|@google\/genai|@ai-sdk\/google)$/ },
  { name: 'Resend / SendGrid / Mailgun (e-mail)', kind: 'servico', cookies: false, what: 'e-mail e nome de quem recebe mensagens', dep: /^(resend|@sendgrid\/mail|mailgun\.js|nodemailer)$/ },
  { name: 'Google Maps', kind: 'servico', cookies: true, what: 'endereços e localização buscados no mapa', re: /maps\.googleapis\.com/, dep: /^@react-google-maps\/|^@vis\.gl\/react-google-maps$/ },
]

function dependencies(root, files) {
  const deps = new Set()
  for (const f of files.filter((x) => /(^|\/)package\.json$/.test(x) && !/node_modules|(^|\/)(plugin|engine|bench)\//.test(x))) {
    try {
      const pkg = JSON.parse(read(root, f))
      for (const d of Object.keys({ ...pkg.dependencies })) deps.add(d)
    } catch {}
  }
  return deps
}

const COOKIE_CONSENT_DEP = /(cookieconsent|cookie-consent|@cookiehub|cookiebot|klaro|osano|onetrust|usercentrics|@consentmanager)/i
const COOKIE_CONSENT_TEXT = /(aceitar (todos os )?cookies|accept (all )?cookies|consentimento (de|para) cookies|cookie consent|gerenciar cookies|prefer[eê]ncias de cookies)/i
const TERMS_PATH = /(termos|terms|tos\b|condicoes|condições)/i
const TERMS_TEXT = /(termos de uso|termos de serviço|terms of (service|use))/i
const DELETE_ACCOUNT = /(excluir (minha )?conta|apagar (minha )?conta|deletar (minha )?conta|delete (my )?account|deleteUser\(|auth\.admin\.deleteUser|delete_account|account\/delete|excluir-conta)/i

/** Inventário de dados pessoais e terceiros, e os itens de LGPD para o checklist. */
export function privacyScan(root, files) {
  const app = files.filter((f) => !SKIP.test(f) && !TEST.test(f))
  const code = app.filter((f) => CODE.test(f))
  const ui = code.filter((f) => UI.test(f))
  const data = new Map() // categoria -> { sensitive, where: Set }
  const add = (category, where) => {
    const c = CATEGORIES.find((x) => x.name === category)
    if (!c) return
    const cur = data.get(category) ?? { category, sensitive: !!c.sensitive, where: new Set() }
    if (cur.where.size < 6) cur.where.add(where)
    data.set(category, cur)
  }
  for (const f of ui) {
    for (const x of uiFields(read(root, f))) {
      const cat = x.category ?? categoryOf(x.field)?.name
      if (cat) add(cat, `tela ${f}`)
    }
  }
  for (const c of dbColumns(root, app)) {
    // "name" sozinho só é nome de pessoa em tabela de pessoas (não o nome de um projeto ou produto).
    const cat = categoryOf(c.column) ?? (/^name$/i.test(c.column) && PEOPLE_TABLE.test(c.table) ? { name: 'Nome' } : null)
    if (cat) add(cat.name, `banco ${c.table}.${c.column}`)
  }

  const deps = dependencies(root, files)
  const texts = new Map(code.map((f) => [f, read(root, f)]))
  // Login: quase todo app com login guarda e-mail e senha (ou o perfil do Google).
  const allCode = [...texts.values()].join('\n')
  const auth = /auth\.signUp|signInWithPassword|signInWithOtp|createUserWithEmailAndPassword|signIn\(\s*["']credentials|NextAuth|@clerk|lucia|better-auth/.test(allCode)
  if (auth) add('E-mail', 'login')
  if (/signInWithOAuth|GoogleAuthProvider|provider:\s*["']google["']|GoogleProvider/.test(allCode)) {
    add('Nome', 'login com Google/rede social')
    add('Foto ou imagem da pessoa', 'login com Google/rede social')
  }

  const third = []
  for (const t of THIRD_PARTIES) {
    const viaDep = t.dep && [...deps].some((d) => t.dep.test(d))
    const viaCode = t.re ? code.filter((f) => t.re.test(texts.get(f))).slice(0, 3) : []
    if (viaDep || viaCode.length) third.push({ name: t.name, kind: t.kind, cookies: t.cookies, what: t.what, evidence: viaCode.length ? viaCode : ['package.json'] })
  }

  const has = (re) => code.some((f) => re.test(texts.get(f)))
  const policy = checkPrivacy(root, files)
  const termsFile = app.find((f) => UI.test(f) && TERMS_PATH.test(f))
  const cookieTrackers = third.filter((t) => t.cookies && t.kind === 'rastreador')
  const consent = [...deps].some((d) => COOKIE_CONSENT_DEP.test(d)) || has(COOKIE_CONSENT_TEXT)
  const sensitive = [...data.values()].filter((d) => d.sensitive)
  const abroad = third.filter((t) => /IA\)|Google|Meta|TikTok|LinkedIn|Hotjar|Microsoft|Mixpanel|Amplitude|Segment|Intercom|HubSpot/.test(t.name))

  const checks = [
    { key: 'lgpd-privacidade', status: policy.status, detail: policy.detail, evidence: policy.evidence },
    termsFile
      ? { key: 'lgpd-termos', status: 'ok', detail: `Há uma página de termos (${termsFile}).`, evidence: [termsFile] }
      : has(TERMS_TEXT)
        ? { key: 'lgpd-termos', status: 'aviso', detail: 'O site cita os termos de uso, mas não achei a página deles.', evidence: [] }
        : { key: 'lgpd-termos', status: 'falta', detail: 'Não há termos de uso: as regras de uso do app, o que a pessoa pode e não pode fazer e as responsabilidades.', evidence: [] },
    !cookieTrackers.length
      ? { key: 'lgpd-cookies', status: 'na', detail: 'Não achei rastreadores que usem cookies (analytics, pixel de anúncios, gravação de tela).', evidence: [] }
      : consent
        ? { key: 'lgpd-cookies', status: 'ok', detail: `Há aviso de cookies para: ${cookieTrackers.map((t) => t.name).join(', ')}.`, evidence: [] }
        : {
            key: 'lgpd-cookies',
            status: 'falta',
            detail: `O site usa ${cookieTrackers.map((t) => t.name).join(', ')} sem pedir o consentimento da pessoa antes. Rastreador de anúncios e de comportamento precisa do "aceito" antes de ligar.`,
            evidence: cookieTrackers.flatMap((t) => t.evidence).slice(0, 5),
          },
    !auth
      ? { key: 'lgpd-exclusao', status: 'na', detail: 'O app não tem contas de usuário.', evidence: [] }
      : has(DELETE_ACCOUNT)
        ? { key: 'lgpd-exclusao', status: 'ok', detail: 'A pessoa consegue pedir para excluir a conta.', evidence: [] }
        : { key: 'lgpd-exclusao', status: 'falta', detail: 'O app tem contas, mas não achei como a pessoa exclui a própria conta e os dados. A LGPD garante esse direito (art. 18).', evidence: [] },
    sensitive.length
      ? { key: 'lgpd-sensiveis', status: 'aviso', detail: `O app parece guardar dados sensíveis: ${sensitive.map((d) => d.category).join(', ')}. Eles pedem consentimento específico e destacado, e cuidado redobrado com quem acessa.`, evidence: [] }
      : { key: 'lgpd-sensiveis', status: 'ok', detail: 'Não achei dados sensíveis (saúde, religião, origem racial, biometria, crianças…).', evidence: [] },
    { key: 'lgpd-terceiros', status: abroad.length && policy.status !== 'ok' ? 'aviso' : 'ok', detail: third.length ? `Os dados passam por ${third.length} empresa(s): ${third.map((t) => t.name).join(', ')}.${abroad.length ? ' Parte delas fica fora do Brasil: a política de privacidade precisa dizer isso.' : ''}` : 'Não achei serviços de fora que recebam dados das pessoas.', evidence: [] },
  ]
  return {
    data: [...data.values()].map((d) => ({ category: d.category, sensitive: d.sensitive, where: [...d.where] })).sort((a, b) => Number(b.sensitive) - Number(a.sensitive) || a.category.localeCompare(b.category)),
    thirdParties: third,
    auth,
    checks,
  }
}
