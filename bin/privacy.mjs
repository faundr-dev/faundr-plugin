// LGPD para quem não programa: que dados pessoais o app coleta, quais são sensíveis, para quais empresas eles vão
// (rastreadores e serviços) e o que falta (política de privacidade, termos, aviso de cookies, excluir a conta).
// Sem IA e sem ler dados de usuários: só nomes de campos, colunas, pacotes e endereços no código.

import fs from 'node:fs'
import path from 'node:path'
import { t } from './i18n.mjs'
import { checkPrivacy, PAGE_DIR } from './launch.mjs'

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
// name: a chave interna (em português, como sempre foi); en: o nome mostrado em inglês.
export const CATEGORIES = [
  { name: 'Nome', en: 'Name', re: /^(full_?name|nome(_completo)?|first_?name|last_?name|sobrenome|display_?name)$/i },
  { name: 'E-mail', en: 'Email', re: /e_?mail/i },
  { name: 'Telefone', en: 'Phone', re: /(phone|telefone|celular|whats_?app|mobile)/i },
  { name: 'CPF ou documento', en: 'ID or tax number', re: /^(cpf|cnpj|rg|documento|document(_number)?|passport|passaporte|tax_?id)$/i },
  { name: 'Endereço', en: 'Address', re: /(address|endereco|endereço|^cep$|zip_?code|postal|street|^rua$|bairro|^city$|cidade)/i },
  { name: 'Data de nascimento ou idade', en: 'Date of birth or age', re: /(birth|nascimento|^dob$|^idade$|^age$|bday)/i },
  { name: 'Localização', en: 'Location', re: /(latitude|longitude|^lat$|^lng$|geoloca|^location$|localiza)/i },
  { name: 'IP e aparelho', en: 'IP and device', re: /(ip_?address|^ip$|user_?agent|device_?id)/i },
  { name: 'Dados de pagamento', en: 'Payment data', re: /(card_?number|cartao|cartão|cc-number|^iban$|pix_?key|chave_?pix|bank_?account|conta_?bancaria)/i },
  { name: 'Foto ou imagem da pessoa', en: "Person's photo or image", re: /(avatar|photo|foto|selfie|profile_?pic)/i },
  { name: 'Senha', en: 'Password', re: /(password|senha)/i },
  { name: 'Saúde', en: 'Health', sensitive: true, re: /(health|saude|saúde|diagnos|medical|medic[oa]|doenca|doença|^cid$|alergi|gravidez|pregnan|prescri|receita_medica)/i },
  { name: 'Religião', en: 'Religion', sensitive: true, re: /relig/i },
  { name: 'Origem racial ou étnica', en: 'Racial or ethnic origin', sensitive: true, re: /(^race$|^raca$|^raça$|etnia|ethnic)/i },
  { name: 'Vida ou orientação sexual', en: 'Sex life or sexual orientation', sensitive: true, re: /(sexual|orientacao|orientação)/i },
  { name: 'Opinião política ou filiação', en: 'Political opinion or affiliation', sensitive: true, re: /(politic|partido|sindica)/i },
  { name: 'Biometria ou dado genético', en: 'Biometric or genetic data', sensitive: true, re: /(biometr|impressao_?digital|impressão_?digital|face_?id|facial|genetic|genétic|^dna$)/i },
  { name: 'Dados de crianças', en: "Children's data", sensitive: true, re: /(crianca|criança|^child|kid_|menor_de_idade|^minor|^aluno_menor)/i },
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
  { name: 'Google Analytics / Tag Manager', kind: 'rastreador', cookies: true, what: 'páginas visitadas, aparelho, localização aproximada e identificador do navegador', whatEn: 'pages visited, device, approximate location and browser identifier', re: /googletagmanager\.com|google-analytics\.com|\bgtag\(|@next\/third-parties\/google|\breact-ga4?\b/, dep: /^(react-ga4?|@next\/third-parties|vue-gtag|ga-4-react)$/ },
  { name: 'Meta Pixel (Facebook/Instagram)', kind: 'rastreador', cookies: true, what: 'páginas visitadas e ações (cadastro, compra) para anúncios', whatEn: 'pages visited and actions (sign-up, purchase) for ads', re: /connect\.facebook\.net|\bfbq\(/, dep: /^react-facebook-pixel$/ },
  { name: 'TikTok Pixel', kind: 'rastreador', cookies: true, what: 'páginas visitadas e ações para anúncios', whatEn: 'pages visited and actions for ads', re: /analytics\.tiktok\.com|\bttq\.(load|page|track)/ },
  { name: 'LinkedIn Insight', kind: 'rastreador', cookies: true, what: 'visitas para anúncios no LinkedIn', whatEn: 'visits for LinkedIn ads', re: /snap\.licdn\.com|_linkedin_partner_id/ },
  { name: 'Hotjar', kind: 'rastreador', cookies: true, what: 'gravação de cliques, rolagem e o que a pessoa faz na tela', whatEn: 'recording of clicks, scrolling and what the person does on screen', re: /static\.hotjar\.com|hotjar\.com\/c\//, dep: /^@hotjar\/browser$/ },
  { name: 'Microsoft Clarity', kind: 'rastreador', cookies: true, what: 'gravação de cliques e rolagem', whatEn: 'recording of clicks and scrolling', re: /clarity\.ms\/tag|\bclarity\(\s*["']/, dep: /^@microsoft\/clarity$/ },
  { name: 'Mixpanel', kind: 'rastreador', cookies: true, what: 'eventos de uso ligados à pessoa', whatEn: 'usage events tied to the person', dep: /^mixpanel(-browser)?$/ },
  { name: 'Amplitude', kind: 'rastreador', cookies: true, what: 'eventos de uso ligados à pessoa', whatEn: 'usage events tied to the person', dep: /^@amplitude\// },
  { name: 'Segment', kind: 'rastreador', cookies: true, what: 'eventos de uso repassados a outras ferramentas', whatEn: 'usage events passed on to other tools', dep: /^@segment\// },
  { name: 'PostHog', kind: 'rastreador', cookies: true, what: 'eventos de uso e, se ligado, gravação da tela', whatEn: 'usage events and, if turned on, screen recording', dep: /^posthog-(js|node)$/ },
  { name: 'Plausible', kind: 'rastreador', cookies: false, what: 'contagem de visitas sem cookies nem dados pessoais', whatEn: 'visit counts without cookies or personal data', re: /plausible\.io\/js/ },
  { name: 'Vercel Analytics', kind: 'rastreador', cookies: false, what: 'contagem de visitas sem cookies', whatEn: 'visit counts without cookies', dep: /^@vercel\/(analytics|speed-insights)$/ },
  { name: 'YouTube (vídeo incorporado)', en: 'YouTube (embedded video)', kind: 'rastreador', cookies: true, what: 'o Google guarda cookies de quem vê o vídeo', whatEn: 'Google stores cookies for whoever watches the video', re: /youtube\.com\/embed\/(?!.*nocookie)/ },
  { name: 'Google reCAPTCHA', kind: 'servico', cookies: true, what: 'comportamento no formulário para saber se é robô', whatEn: 'behavior on the form, to tell whether it is a bot', re: /google\.com\/recaptcha|grecaptcha/, dep: /^react-google-recaptcha/ },
  { name: 'Intercom', kind: 'servico', cookies: true, what: 'conversas de atendimento, nome e e-mail', whatEn: 'support conversations, name and email', re: /widget\.intercom\.io/, dep: /^@intercom\/|^react-use-intercom$/ },
  { name: 'Crisp', kind: 'servico', cookies: true, what: 'conversas de atendimento', whatEn: 'support conversations', re: /client\.crisp\.chat/ },
  { name: 'HubSpot', kind: 'servico', cookies: true, what: 'contatos, formulários e visitas', whatEn: 'contacts, forms and visits', re: /js\.hs-scripts\.com|js\.hsforms\.net/ },
  { name: 'Sentry (erros)', en: 'Sentry (errors)', kind: 'servico', cookies: false, what: 'erros do app, com o endereço IP e o que a pessoa fez antes do erro', whatEn: 'app errors, with the IP address and what the person did before the error', dep: /^@sentry\// },
  { name: 'Supabase (banco e login)', en: 'Supabase (database and login)', kind: 'servico', cookies: false, what: 'todos os dados guardados pelo app e o login', whatEn: 'all the data the app stores, and the login', dep: /^@supabase\/(supabase-js|ssr|auth-helpers)/ },
  { name: 'Firebase (banco e login)', en: 'Firebase (database and login)', kind: 'servico', cookies: false, what: 'dados guardados pelo app e o login', whatEn: 'data the app stores, and the login', dep: /^firebase(-admin)?$/ },
  { name: 'Clerk (login)', kind: 'servico', cookies: true, what: 'contas e login', whatEn: 'accounts and login', dep: /^@clerk\// },
  { name: 'Stripe (pagamento)', en: 'Stripe (payment)', kind: 'servico', cookies: true, what: 'nome, e-mail e dados de pagamento', whatEn: 'name, email and payment data', dep: /^(stripe|@stripe\/stripe-js)$/ },
  { name: 'Mercado Pago (pagamento)', en: 'Mercado Pago (payment)', kind: 'servico', cookies: true, what: 'nome, CPF, e-mail e dados de pagamento', whatEn: 'name, CPF (Brazilian tax ID), email and payment data', dep: /^(mercadopago|@mercadopago\/)/ },
  { name: 'OpenAI (IA)', en: 'OpenAI (AI)', kind: 'servico', cookies: false, what: 'o texto que as pessoas escrevem ou enviam para a IA (fora do Brasil)', whatEn: 'the text people write or send to the AI (processed in the United States)', dep: /^(openai|@ai-sdk\/openai)$/ },
  { name: 'Anthropic (IA)', en: 'Anthropic (AI)', kind: 'servico', cookies: false, what: 'o texto que as pessoas escrevem ou enviam para a IA (fora do Brasil)', whatEn: 'the text people write or send to the AI (processed in the United States)', dep: /^(@anthropic-ai\/sdk|@ai-sdk\/anthropic)$/ },
  { name: 'Google Gemini (IA)', en: 'Google Gemini (AI)', kind: 'servico', cookies: false, what: 'o texto que as pessoas escrevem ou enviam para a IA (fora do Brasil)', whatEn: 'the text people write or send to the AI (processed in the United States)', dep: /^(@google\/generative-ai|@google\/genai|@ai-sdk\/google)$/ },
  { name: 'Resend / SendGrid / Mailgun (e-mail)', en: 'Resend / SendGrid / Mailgun (email)', kind: 'servico', cookies: false, what: 'e-mail e nome de quem recebe mensagens', whatEn: 'email and name of whoever receives messages', dep: /^(resend|@sendgrid\/mail|mailgun\.js|nodemailer)$/ },
  { name: 'Google Maps', kind: 'servico', cookies: true, what: 'endereços e localização buscados no mapa', whatEn: 'addresses and locations searched on the map', re: /maps\.googleapis\.com/, dep: /^@react-google-maps\/|^@vis\.gl\/react-google-maps$/ },
]

function dependencies(root, files) {
  const deps = new Set()
  for (const f of files.filter((x) => /(^|\/)package\.json$/.test(x) && !/node_modules|(^|\/)(plugin|engine|bench)\//.test(x))) {
    try {
      const pkg = JSON.parse(read(root, f))
      for (const d of Object.keys({ ...pkg.dependencies })) deps.add(d)
    } catch {
      // package.json com JSON quebrado: fica de fora da lista de pacotes.
    }
  }
  return deps
}

const COOKIE_CONSENT_DEP = /(cookieconsent|cookie-consent|@cookiehub|cookiebot|klaro|osano|onetrust|usercentrics|@consentmanager)/i
const COOKIE_CONSENT_TEXT = /(aceitar (todos os )?cookies|accept (all )?cookies|consentimento (de|para) cookies|cookie consent|gerenciar cookies|prefer[eê]ncias de cookies)/i
const TERMS_PATH = /(^|\/)[^/]*(termos|terms|condicoes|condições)[^/]*(\/(page|index|route)\.[a-z]+)?$/i
// Link para a página de termos (não só o texto citado numa explicação).
const TERMS_LINK = /\b(href|to)=\{?["'`][^"'`]*(termos|terms|condicoes)[^"'`]*["'`]/i
const DELETE_ACCOUNT = /(excluir (minha )?conta|apagar (minha )?conta|deletar (minha )?conta|delete (my )?account|deleteUser\(|auth\.admin\.deleteUser|delete_account|account\/delete|excluir-conta)/i

// Empresas com sede fora do Brasil (a política precisa avisar da transferência), pelo nome interno.
const ABROAD = /IA\)|Google|Meta|TikTok|LinkedIn|Hotjar|Microsoft|Mixpanel|Amplitude|Segment|Intercom|HubSpot/

// Serviços de fora que recebem dados: pelo pacote instalado ou pelo endereço citado no código.
function thirdParties(deps, code, texts) {
  const third = []
  for (const p of THIRD_PARTIES) {
    const viaDep = p.dep && [...deps].some((d) => p.dep.test(d))
    const viaCode = p.re ? code.filter((f) => p.re.test(texts.get(f))).slice(0, 3) : []
    if (viaDep || viaCode.length)
      third.push({
        name: t(p.en ?? p.name, p.name),
        kind: p.kind,
        cookies: p.cookies,
        what: t(p.whatEn, p.what),
        evidence: viaCode.length ? viaCode : ['package.json'],
        abroad: ABROAD.test(p.name),
      })
  }
  return third
}

function termsCheck(termsFile, has) {
  if (termsFile) return { key: 'lgpd-termos', status: 'ok', detail: t(`There is a terms page (${termsFile}).`, `Há uma página de termos (${termsFile}).`), evidence: [termsFile] }
  if (has(TERMS_LINK))
    return { key: 'lgpd-termos', status: 'aviso', detail: t('The site mentions the terms of use, but I did not find their page.', 'O site cita os termos de uso, mas não achei a página deles.'), evidence: [] }
  return {
    key: 'lgpd-termos',
    status: 'falta',
    detail: t(
      'There are no terms of use: the rules for using the app, what people can and cannot do, and who is responsible for what.',
      'Não há termos de uso: as regras de uso do app, o que a pessoa pode e não pode fazer e as responsabilidades.',
    ),
    evidence: [],
  }
}

function cookiesCheck(cookieTrackers, consent) {
  if (!cookieTrackers.length)
    return {
      key: 'lgpd-cookies',
      status: 'na',
      detail: t('I did not find trackers that use cookies (analytics, ad pixels, screen recording).', 'Não achei rastreadores que usem cookies (analytics, pixel de anúncios, gravação de tela).'),
      evidence: [],
    }
  const names = cookieTrackers.map((p) => p.name).join(', ')
  if (consent) return { key: 'lgpd-cookies', status: 'ok', detail: t(`There is a cookie notice for: ${names}.`, `Há aviso de cookies para: ${names}.`), evidence: [] }
  return {
    key: 'lgpd-cookies',
    status: 'falta',
    detail: t(
      `The site uses ${names} without asking for the person's consent first. Ad and behavior trackers need an "I accept" before they turn on.`,
      `O site usa ${names} sem pedir o consentimento da pessoa antes. Rastreador de anúncios e de comportamento precisa do "aceito" antes de ligar.`,
    ),
    evidence: cookieTrackers.flatMap((p) => p.evidence).slice(0, 5),
  }
}

function deletionCheck(auth, has) {
  if (!auth) return { key: 'lgpd-exclusao', status: 'na', detail: t('The app has no user accounts.', 'O app não tem contas de usuário.'), evidence: [] }
  if (has(DELETE_ACCOUNT)) return { key: 'lgpd-exclusao', status: 'ok', detail: t('People can ask to delete their account.', 'A pessoa consegue pedir para excluir a conta.'), evidence: [] }
  return {
    key: 'lgpd-exclusao',
    status: 'falta',
    detail: t(
      'The app has accounts, but I did not find how people delete their own account and data. Privacy laws give them this right.',
      'O app tem contas, mas não achei como a pessoa exclui a própria conta e os dados. A LGPD garante esse direito (art. 18).',
    ),
    evidence: [],
  }
}

function sensitiveCheck(sensitive) {
  if (sensitive.length) {
    const list = sensitive.map((d) => d.category).join(', ')
    return {
      key: 'lgpd-sensiveis',
      status: 'aviso',
      detail: t(
        `The app seems to store sensitive data: ${list}. It needs specific, prominent consent, and extra care with who can access it.`,
        `O app parece guardar dados sensíveis: ${list}. Eles pedem consentimento específico e destacado, e cuidado redobrado com quem acessa.`,
      ),
      evidence: [],
    }
  }
  return {
    key: 'lgpd-sensiveis',
    status: 'ok',
    detail: t('I did not find sensitive data (health, religion, racial origin, biometrics, children…).', 'Não achei dados sensíveis (saúde, religião, origem racial, biometria, crianças…).'),
    evidence: [],
  }
}

function thirdPartiesCheck(third, abroad, policy) {
  const outside = abroad.length ? t(' Some of them are in other countries: the privacy policy needs to say so.', ' Parte delas fica fora do Brasil: a política de privacidade precisa dizer isso.') : ''
  const names = third.map((p) => p.name).join(', ')
  const detail = third.length
    ? t(`The data goes through ${third.length} company(ies): ${names}.${outside}`, `Os dados passam por ${third.length} empresa(s): ${names}.${outside}`)
    : t("I did not find outside services that receive people's data.", 'Não achei serviços de fora que recebam dados das pessoas.')
  return { key: 'lgpd-terceiros', status: abroad.length && policy.status !== 'ok' ? 'aviso' : 'ok', detail, evidence: [] }
}

/** Inventário de dados pessoais e terceiros, e os itens de LGPD para o checklist. */
export function privacyScan(root, files) {
  const app = files.filter((f) => !SKIP.test(f) && !TEST.test(f))
  const code = app.filter((f) => CODE.test(f))
  const ui = code.filter((f) => UI.test(f))
  const data = new Map() // categoria -> { sensitive, where: Set }
  const add = (category, where) => {
    const c = CATEGORIES.find((x) => x.name === category)
    if (!c) return
    const cur = data.get(category) ?? { category: t(c.en, c.name), sensitive: !!c.sensitive, where: new Set() }
    if (cur.where.size < 6) cur.where.add(where)
    data.set(category, cur)
  }
  for (const f of ui) {
    for (const x of uiFields(read(root, f))) {
      const cat = x.category ?? categoryOf(x.field)?.name
      if (cat) add(cat, t(`screen ${f}`, `tela ${f}`))
    }
  }
  for (const c of dbColumns(root, app)) {
    // "name" sozinho só é nome de pessoa em tabela de pessoas (não o nome de um projeto ou produto).
    const cat = categoryOf(c.column) ?? (/^name$/i.test(c.column) && PEOPLE_TABLE.test(c.table) ? { name: 'Nome' } : null)
    if (cat) add(cat.name, t(`database ${c.table}.${c.column}`, `banco ${c.table}.${c.column}`))
  }

  const deps = dependencies(root, files)
  const texts = new Map(code.map((f) => [f, read(root, f)]))
  // Login: quase todo app com login guarda e-mail e senha (ou o perfil do Google).
  const allCode = [...texts.values()].join('\n')
  const auth = /auth\.signUp|signInWithPassword|signInWithOtp|createUserWithEmailAndPassword|signIn\(\s*["']credentials|NextAuth|@clerk|lucia|better-auth/.test(allCode)
  if (auth) add('E-mail', 'login')
  if (/signInWithOAuth|GoogleAuthProvider|provider:\s*["']google["']|GoogleProvider/.test(allCode)) {
    add('Nome', t('Google/social login', 'login com Google/rede social'))
    add('Foto ou imagem da pessoa', t('Google/social login', 'login com Google/rede social'))
  }

  const third = thirdParties(deps, code, texts)

  const has = (re) => code.some((f) => re.test(texts.get(f)))
  const policy = checkPrivacy(root, files)
  const termsFile = app.find((f) => UI.test(f) && PAGE_DIR.test(f) && TERMS_PATH.test(f))
  const cookieTrackers = third.filter((t) => t.cookies && t.kind === 'rastreador')
  const consent = [...deps].some((d) => COOKIE_CONSENT_DEP.test(d)) || has(COOKIE_CONSENT_TEXT)
  const sensitive = [...data.values()].filter((d) => d.sensitive)
  const abroad = third.filter((p) => p.abroad)

  const checks = [
    { key: 'lgpd-privacidade', status: policy.status, detail: policy.detail, evidence: policy.evidence },
    termsCheck(termsFile, has),
    cookiesCheck(cookieTrackers, consent),
    deletionCheck(auth, has),
    sensitiveCheck(sensitive),
    thirdPartiesCheck(third, abroad, policy),
  ]
  return {
    data: [...data.values()].map((d) => ({ category: d.category, sensitive: d.sensitive, where: [...d.where] })).sort((a, b) => Number(b.sensitive) - Number(a.sensitive) || a.category.localeCompare(b.category)),
    thirdParties: third.map(({ abroad: _, ...p }) => p),
    auth,
    checks,
  }
}
