// Textos dos achados de design (o que é, por que importa, como corrigir), em inglês e português
// (parte de design-rules.mjs).
import { FLUTTER_TEXT } from './design-flutter.mjs'
import { NATIVE_TEXT } from './design-native.mjs'
import { t } from './i18n.mjs'

// Título e explicação de cada achado (n = quantas vezes no arquivo), na língua da pessoa (t na hora do achado).
export const TEXT = {
  'identidade/sem-favicon': () => [
    t('App without a favicon (the browser tab icon)', 'App sem favicon (ícone da aba do navegador)'),
    t('The browser tab and bookmarks show a generic icon. Make the favicon from the logo (SVG + 32 px PNG) and declare it in the <head> with <link rel="icon">.', 'A aba do navegador e os favoritos mostram um ícone genérico. Gere o favicon a partir da logo (SVG + PNG 32 px) e declare no <head> com <link rel="icon">.'),
  ],
  'identidade/sem-apple-touch-icon': () => [
    t('No icon for the iPhone home screen (apple-touch-icon)', 'Sem ícone para a tela inicial do iPhone (apple-touch-icon)'),
    t('Whoever saves the app to the iPhone home screen sees a blurry screenshot. Add a 180×180 PNG and <link rel="apple-touch-icon">.', 'Quem salva o app na tela inicial do iPhone vê um print borrado. Adicione um PNG 180×180 e <link rel="apple-touch-icon">.'),
  ],
  'identidade/titulo-padrao': (c) => [
    t(`Default or empty page title${c.title ? ` ("${c.title}")` : ''}`, `Título da página padrão ou vazio${c.title ? ` ("${c.title}")` : ''}`),
    t('The title shows on the tab, in bookmarks and in search. Replace the template title with the app name (ideally, one title per screen).', 'O título aparece na aba, nos favoritos e na busca. Troque o título do template pelo nome do app (e, de preferência, um título por tela).'),
  ],
  'identidade/sem-descricao': () => [
    t('No page description (meta description)', 'Sem descrição da página (meta description)'),
    t('It is the text shown on Google and in shared links. Add <meta name="description" content="…"> with one sentence about the app.', 'É o texto que aparece no Google e em links compartilhados. Adicione <meta name="description" content="…"> com uma frase sobre o app.'),
  ],
  'identidade/sem-imagem-de-compartilhamento': () => [
    t('No share image (og:image)', 'Sem imagem de compartilhamento (og:image)'),
    t('When the link is pasted in WhatsApp, Slack or social media, it shows no image. Add <meta property="og:image"> (1200×630).', 'Ao colar o link no WhatsApp, Slack ou redes, aparece sem imagem. Adicione <meta property="og:image"> (1200×630).'),
  ],
  'identidade/sem-idioma': () => [
    t('Page without a declared language (<html lang>)', 'Página sem idioma declarado (<html lang>)'),
    t('Without lang, screen readers use the wrong pronunciation and the browser offers translation for no reason. Use <html lang="en"> (or the app language).', 'Sem lang, o leitor de tela lê com a pronúncia errada e o navegador oferece tradução à toa. Use <html lang="pt-BR"> (ou o idioma do app).'),
  ],
  'identidade/sem-theme-color': () => [
    t('No browser bar color (theme-color)', 'Sem cor da barra do navegador (theme-color)'),
    t('On phones, the browser bar keeps the default color instead of the app color. Add <meta name="theme-color"> with the background color from design.md.', 'No celular, a barra do navegador fica com a cor padrão em vez da cor do app. Adicione <meta name="theme-color"> com a cor de fundo do design.md.'),
  ],
  'responsivo/sem-viewport': () => [
    t('No <meta name="viewport">: on phones the page opens tiny', 'Sem <meta name="viewport">: no celular a página abre minúscula'),
    t('Without the viewport meta, the phone draws the page as if it were a computer and shrinks everything. Add <meta name="viewport" content="width=device-width, initial-scale=1">.', 'Sem a meta viewport, o celular desenha a página como se fosse um computador e encolhe tudo. Adicione <meta name="viewport" content="width=device-width, initial-scale=1">.'),
  ],
  'responsivo/zoom-desligado': () => [
    t('Phone zoom turned off (user-scalable=no / maximum-scale=1)', 'Zoom do celular desligado (user-scalable=no / maximum-scale=1)'),
    t('People with poor eyesight cannot zoom in. Remove user-scalable=no and maximum-scale from the viewport meta.', 'Quem enxerga mal não consegue aproximar a tela. Tire user-scalable=no e maximum-scale da meta viewport.'),
  ],
  'responsivo/grid-sem-celular': (c, n) => [
    t(`Multi-column grid with no phone version${n > 1 ? ` (${n} places)` : ''}`, `Grade de várias colunas sem versão de celular${n > 1 ? ` (${n} lugares)` : ''}`),
    t(`Classes like "${c.token}" without a screen prefix (sm:, md:, lg:) squeeze the columns on phones. Start with grid-cols-1 and add columns on bigger screens (e.g. grid-cols-1 md:grid-cols-${c.cols}).`, `Classes como "${c.token}" sem um prefixo de tela (sm:, md:, lg:) deixam as colunas espremidas no celular. Comece com grid-cols-1 e aumente nas telas maiores (ex.: grid-cols-1 md:grid-cols-${c.cols}).`),
  ],
  'responsivo/largura-fixa': (c, n) => [
    t(`Large fixed width (${c.token})${n > 1 ? ` in ${n} places` : ''}`, `Largura fixa grande (${c.token})${n > 1 ? ` em ${n} lugares` : ''}`),
    t('An element with a fixed width bigger than a phone screen (~360 px) causes sideways scrolling. Use max-w-[…] with w-full, or set the width only from md: up.', 'Um elemento com largura fixa maior que a tela do celular (~360 px) cria rolagem para o lado. Use max-w-[…] com w-full, ou largura só a partir de md:.'),
  ],
  'responsivo/altura-100vh': (c, n) => [
    t(`Full-screen height with 100vh (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Altura de tela cheia com 100vh (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('On phones, 100vh does not account for the browser bar and the bottom of the screen gets hidden. Use dvh (h-dvh, min-h-dvh, calc(100dvh - …)).', 'No celular, 100vh não desconta a barra do navegador e o fim da tela fica escondido. Use dvh (h-dvh, min-h-dvh, calc(100dvh - …)).'),
  ],
  'responsivo/largura-100vw': (c, n) => [
    t(`100vw width (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Largura de 100vw (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('100vw includes the scrollbar and often causes sideways scrolling. Use w-full.', '100vw inclui a barra de rolagem e costuma criar rolagem para o lado. Use w-full.'),
  ],
  'responsivo/campo-com-fonte-pequena': (c, n) => [
    t(`Text field with a font smaller than 16 px (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Campo de texto com fonte menor que 16 px (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('On iPhone, tapping a field with a font smaller than 16 px makes the page zoom in by itself. Use text-base on phones and go smaller only from md: up (e.g. text-base md:text-sm).', 'No iPhone, ao tocar num campo com fonte menor que 16 px, a página dá zoom sozinha. Use text-base no celular e diminua só a partir de md: (ex.: text-base md:text-sm).'),
  ],
  'responsivo/so-no-hover': (c, n) => [
    t(`Content that only shows on mouse hover${n > 1 ? ` (${n} places)` : ''}`, `Conteúdo que só aparece ao passar o mouse${n > 1 ? ` (${n} lugares)` : ''}`),
    t(`"${c.token}" hides the element until the mouse hovers over it, but phones have no hover and keyboard users never see it. Also show it with group-focus-within: / focus-visible: (or keep it visible on phones).`, `"${c.token}" esconde o elemento até o mouse passar por cima, mas no celular não existe hover e pelo teclado ele nunca aparece. Mostre também com group-focus-within: / focus-visible: (ou deixe visível no celular).`),
  ],
  'responsivo/safe-area-sem-viewport-fit': () => [
    t('Uses env(safe-area-inset-*) but the viewport has no viewport-fit=cover', 'Usa env(safe-area-inset-*) mas a viewport não tem viewport-fit=cover'),
    t('Without viewport-fit=cover, the iPhone safe areas (notch, bottom bar) are zero and the adjustment does nothing. Add viewport-fit=cover to the viewport meta.', 'Sem viewport-fit=cover, as áreas seguras do iPhone (entalhe, barra de baixo) valem zero e o ajuste não funciona. Acrescente viewport-fit=cover à meta viewport.'),
  ],
  'acessibilidade/foco-removido': (c, n) => [
    t(`Focus outline removed with no replacement${n > 1 ? ` (${n} places)` : ''}`, `Contorno de foco removido sem substituto${n > 1 ? ` (${n} lugares)` : ''}`),
    t('Keyboard users cannot see where they are. When you remove the outline, give another focus sign (e.g. focus-visible:ring-2 or focus-visible:border-…).', 'Quem navega pelo teclado não vê onde está. Ao tirar o outline, dê outro sinal de foco (ex.: focus-visible:ring-2 ou focus-visible:border-…).'),
  ],
  'acessibilidade/botao-sem-nome': (c, n) => [
    t(`Icon-only button with no name for screen readers${n > 1 ? ` (${n} buttons)` : ''}`, `Botão só com ícone, sem nome para leitor de tela${n > 1 ? ` (${n} botões)` : ''}`),
    t('The screen reader just says "button". Add aria-label="…" (or sr-only text) saying what the button does.', 'O leitor de tela anuncia só "botão". Adicione aria-label="…" (ou um texto sr-only) dizendo o que o botão faz.'),
  ],
  'acessibilidade/imagem-sem-alt': (c, n) => [
    t(`Image without alternative text (alt)${n > 1 ? ` (${n} images)` : ''}`, `Imagem sem texto alternativo (alt)${n > 1 ? ` (${n} imagens)` : ''}`),
    t('Without alt, the screen reader reads the file name. Describe the image in alt="…" (or alt="" if it is just decoration).', 'Sem alt, o leitor de tela lê o nome do arquivo. Descreva a imagem em alt="…" (ou alt="" se for só decoração).'),
  ],
  'acessibilidade/colar-bloqueado': () => [
    t('Field that blocks pasting', 'Campo que bloqueia colar'),
    t('Blocking paste gets in the way of password managers and people who have trouble typing. Remove the preventDefault from onPaste.', 'Bloquear o colar atrapalha gerenciadores de senha e quem tem dificuldade de digitar. Tire o preventDefault do onPaste.'),
  ],
  'acessibilidade/elemento-clicavel-sem-teclado': (c, n) => [
    t(`Clickable element that is neither a button nor a link (<${c.tag} onClick>)${n > 1 ? `, ${n} places` : ''}`, `Elemento clicável que não é botão nem link (<${c.tag} onClick>)${n > 1 ? `, ${n} lugares` : ''}`),
    t('It cannot be reached with the keyboard, and the screen reader does not know it is clickable. Use <button> (action) or <a>/<Link> (navigation).', 'Não dá para chegar nele pelo teclado nem o leitor de tela sabe que é clicável. Use <button> (ação) ou <a>/<Link> (navegação).'),
  ],
  'acessibilidade/tabindex-positivo': () => [
    t('Positive tabIndex changes the keyboard order', 'tabIndex positivo muda a ordem do teclado'),
    t('A tabIndex above 0 makes Tab jump to this element before everything else. Use 0 (or nothing) and let the HTML order decide.', 'tabIndex maior que 0 faz o Tab pular para esse elemento antes de todo o resto. Use 0 (ou nada) e deixe a ordem do HTML mandar.'),
  ],
  'acessibilidade/contraste-baixo': (c) => [
    t(`Low contrast: ${c.text} on ${c.bg} (${c.ratio}:1)`, `Contraste baixo: ${c.text} sobre ${c.bg} (${c.ratio}:1)`),
    t(
      `Under the accessibility guideline (WCAG AA), text needs at least 4.5:1 (3:1 only for large text, icons and borders). ${c.text} (${c.textValue}) on ${c.bg} (${c.bgValue}) gives ${c.ratio}:1${c.others ? `; it also fails on ${c.others}` : ''}. Lighten the text, darken the background, or use this color only where 3:1 is enough.`,
      `Pela regra de acessibilidade (WCAG AA), texto precisa de pelo menos 4,5:1 (3:1 só para texto grande, ícones e bordas). ${c.text} (${c.textValue}) sobre ${c.bg} (${c.bgValue}) dá ${c.ratio}:1${c.others ? `; também falha sobre ${c.others}` : ''}. Clareie o texto, escureça o fundo ou use esta cor só onde 3:1 basta.`,
    ),
  ],
  'acessibilidade/sem-reduced-motion': () => [
    t('Animations that ignore "reduce motion"', 'Animações sem respeitar "reduzir movimento"'),
    t('People who turn on "reduce motion" in their system (motion sickness, vertigo) still see the animations. Wrap the animations in motion-safe: or add @media (prefers-reduced-motion: reduce) turning them off.', 'Quem liga "reduzir movimento" no sistema (enjoo, labirintite) continua vendo as animações. Envolva as animações em motion-safe: ou adicione @media (prefers-reduced-motion: reduce) desligando-as.'),
  ],
  'acessibilidade/sem-color-scheme': () => [
    t('Dark theme without color-scheme', 'Tema escuro sem color-scheme'),
    t('Without color-scheme: dark, scrollbars, fields and native menus show up light in the dark theme. Add color-scheme: dark to :root (or the scheme-dark class).', 'Sem color-scheme: dark, barras de rolagem, campos e menus nativos aparecem claros no tema escuro. Adicione color-scheme: dark no :root (ou a classe scheme-dark).'),
  ],
  'movimento/transition-all': (c, n) => [
    t(`transition-all${n > 1 ? ` in ${n} places` : ''}`, `transition-all${n > 1 ? ` em ${n} lugares` : ''}`),
    t('It animates every property that changes (even size and background color at once), which is heavy and causes surprises. List only what changes: transition-colors, transition-opacity, transition-transform.', 'Anima toda propriedade que mudar (inclusive tamanho e cor de fundo de uma vez), pesa e dá efeitos inesperados. Liste só o que muda: transition-colors, transition-opacity, transition-transform.'),
  ],
  'movimento/ease-in': (c, n) => [
    t(`ease-in curve in the interface${n > 1 ? ` (${n} places)` : ''}`, `Curva ease-in em interface${n > 1 ? ` (${n} lugares)` : ''}`),
    t('ease-in starts slowly: the click feels delayed. In interfaces, use ease-out (or an exit curve like cubic-bezier(0.23, 1, 0.32, 1)).', 'ease-in começa devagar: o clique parece atrasado. Em interface, use ease-out (ou uma curva de saída como cubic-bezier(0.23, 1, 0.32, 1)).'),
  ],
  'movimento/entra-do-zero': (c, n) => [
    t(`Element that appears from scale(0)${n > 1 ? ` (${n} places)` : ''}`, `Elemento que surge de scale(0)${n > 1 ? ` (${n} lugares)` : ''}`),
    t('Growing from zero looks artificial. Start from 0.95 with opacity 0 (e.g. scale-95 opacity-0 → scale-100 opacity-100).', 'Crescer do zero parece artificial. Comece de 0.95 com opacidade 0 (ex.: scale-95 opacity-0 → scale-100 opacity-100).'),
  ],
  'movimento/anima-tamanho-ou-posicao': (c, n) => [
    t(`Animating width, height or position (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Animação de largura, altura ou posição (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Animating width/height/top/left recalculates the page every frame and stutters. Animate transform (translate, scale) and opacity.', 'Animar width/height/top/left recalcula a página a cada quadro e engasga. Anime transform (translate, scale) e opacity.'),
  ],
  'movimento/duracao-longa': (c, n) => [
    t(`Long interface animation (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Animação de interface longa (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Above 300 ms the interface feels slow (modals and drawers up to 500 ms; toasts up to 400 ms). Shorten to 150–250 ms.', 'Acima de 300 ms a interface parece lenta (modal e gaveta até 500 ms; toast até 400 ms). Encurte para 150–250 ms.'),
  ],
  'movimento/quique': (c, n) => [
    t(`Bounce animation (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Animação de quique (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Bounce and elastic effects in an interface look like a toy and distract. Use a smooth exit curve.', 'Quique e elástico em interface parecem brinquedo e distraem. Use uma curva de saída suave.'),
  ],
  'movimento/toaster-duplicado': (c) => [
    t(`More than one <Toaster> in the app (${c.count})`, `Mais de um <Toaster> no app (${c.count})`),
    t('Each <Toaster> draws its own stack of notices: messages show up twice or in different places. Keep just one, in the root layout.', 'Cada <Toaster> desenha sua própria pilha de avisos: as mensagens aparecem duplicadas ou em lugares diferentes. Deixe um só, no layout raiz.'),
  ],
  'conteudo/dado-de-enchimento': (c, n) => [
    t(`Sample data left on screen ("${c.token}")${n > 1 ? `, ${n} places` : ''}`, `Dado de exemplo esquecido na tela ("${c.token}")${n > 1 ? `, ${n} lugares` : ''}`),
    t('Sample names, phone numbers or text ("Lorem ipsum", "John Doe") make the app look unfinished. Use real data or an empty state.', 'Nome, telefone ou texto de exemplo ("Lorem ipsum", "John Doe") passa a impressão de app inacabado. Use dados reais ou um estado vazio.'),
  ],
  'conteudo/reticencias': (c, n) => [
    t(`Three dots ("...") instead of an ellipsis ("…")${n > 1 ? `, ${n} places` : ''}`, `Três pontos ("...") no lugar de reticências ("…")${n > 1 ? `, ${n} lugares` : ''}`),
    t('Use the ellipsis character "…" (e.g. "Loading…"): it takes the right space and does not break at the end of a line.', 'Use o caractere de reticências "…" (ex.: "Carregando…"): ocupa o espaço certo e não quebra no fim da linha.'),
  ],
  'conteudo/alerta-do-navegador': (c, n) => [
    t(`Browser alert()/confirm()${n > 1 ? ` (${n} places)` : ''}`, `alert()/confirm() do navegador${n > 1 ? ` (${n} lugares)` : ''}`),
    t('The browser box freezes the page, looks like the system and ignores the design. Use a notice (toast) or a modal from the app itself.', 'A caixa do navegador trava a página, tem a cara do sistema e não segue o design. Use um aviso (toast) ou um modal do próprio app.'),
  ],
  'conteudo/clique-aqui': (c, n) => [
    t(`"Click here" link or button${n > 1 ? ` (${n} places)` : ''}`, `Link ou botão "Clique aqui"${n > 1 ? ` (${n} lugares)` : ''}`),
    t('The text does not say where it goes; screen reader users hear a list of "click here". Write the action: "Download the report", "See plans".', 'O texto não diz para onde vai; quem usa leitor de tela ouve uma lista de "clique aqui". Escreva a ação: "Baixar o relatório", "Ver planos".'),
  ],
  'pratica/controle-morto': (c, n) => [
    t(`Link or button that does nothing (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Link ou botão que não faz nada (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('href="#" or an empty onClick looks like it works but goes nowhere. Connect it to the real action or remove the element.', 'href="#" ou onClick vazio parece funcionar mas não leva a lugar nenhum. Ligue à ação real ou tire o elemento.'),
  ],
  'design/cinzas-misturados': (c) => [
    t(`Grays from different families mixed together (${c.families})`, `Cinzas de famílias diferentes misturados (${c.families})`),
    t(`Tailwind has several gray families (slate, gray, zinc, neutral, stone) with slightly different tones; mixing them gives a "dirty" gray. The main one here is ${c.main}; replace ${c.others}.`, `O Tailwind tem várias famílias de cinza (slate, gray, zinc, neutral, stone) com tons levemente diferentes; misturar dá um cinza "sujo". A principal aqui é ${c.main}; troque ${c.others}.`),
  ],
  'design/icones-misturados': (c) => [
    t(`More than one icon library (${c.libs})`, `Mais de uma biblioteca de ícones (${c.libs})`),
    t('Icons from different libraries have different strokes and sizes. Pick one and use only that one (and note it in design.md).', 'Ícones de bibliotecas diferentes têm traço e tamanho diferentes. Escolha uma e use só ela (e registre no design.md).'),
  ],
  'design/z-index-alto': (c, n) => [
    t(`Three-digit z-index (${c.token})${n > 1 ? `, ${n} places` : ''}`, `z-index de três dígitos (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('A huge z-index is a sign of layers fighting each other. Define a small scale (e.g. 10 menu, 20 header, 30 popover, 50 modal) and use only that.', 'z-index enorme é sinal de briga de camadas. Defina uma escala pequena (ex.: 10 menu, 20 header, 30 popover, 50 modal) e use só ela.'),
  ],
  'design/texto-miudo': (c, n) => [
    t(`Text smaller than 12 px (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Texto menor que 12 px (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Below 12 px it is hard to read, especially on phones. Use at least text-xs (12 px), or note it in design.md if it is an intentional label.', 'Abaixo de 12 px fica difícil de ler, ainda mais no celular. Use no mínimo text-xs (12 px), ou registre no design.md se for um rótulo proposital.'),
  ],
  'design/texto-em-degrade': (c, n) => [
    t(`Gradient text${n > 1 ? ` (${n} places)` : ''}`, `Texto em degradê${n > 1 ? ` (${n} lugares)` : ''}`),
    t('Gradient text is the trademark of AI-made pages and usually has poor contrast. Use a solid color from the palette.', 'Texto com gradiente é a marca registrada de página feita por IA e costuma ter contraste ruim. Use uma cor sólida da paleta.'),
  ],
  'design/tema-nao-segue-sistema': () => [
    t('Light and dark themes that ignore the system setting', 'Tema claro e escuro sem seguir o do sistema'),
    t('The app has both themes but does not check the device preference (prefers-color-scheme): someone using their phone in dark mode opens the app in light, and vice versa. Start with the system theme (or offer a "System" option) and let the person switch.', 'O app tem os dois temas, mas não olha a preferência do aparelho (prefers-color-scheme): quem usa o celular no escuro abre o app claro, e vice-versa. Comece pelo tema do sistema (ou ofereça a opção "Sistema") e deixe a pessoa trocar.'),
  ],
  'identidade/theme-color-unico': () => [
    t('One browser bar color for both themes', 'Uma cor de barra do navegador para os dois temas'),
    t('theme-color paints the browser bar on phones. With a single color, the bar clashes with the page in the other theme. Use two theme-color tags with media="(prefers-color-scheme: light)" and "(prefers-color-scheme: dark)", or change the color along with the theme.', 'O theme-color pinta a barra do navegador no celular. Com uma cor só, no outro tema a barra fica destoando da página. Use duas tags theme-color com media="(prefers-color-scheme: light)" e "(prefers-color-scheme: dark)", ou troque a cor junto com o tema.'),
  ],
  'design/emoji-como-icone': (c, n) => [
    t(`Emoji used as an icon or decoration (${c.token})${n > 1 ? `, ${n} places` : ''}`, `Emoji usado como ícone ou enfeite (${c.token})${n > 1 ? `, ${n} lugares` : ''}`),
    t('Emoji look different on each system and do not match the stroke of the app icons. Use the project icon library.', 'Emoji muda de cara em cada sistema e não segue o traço dos ícones do app. Use a biblioteca de ícones do projeto.'),
  ],
}
Object.assign(TEXT, FLUTTER_TEXT, NATIVE_TEXT)

export const lineList = (lines) => (lines.length ? ` ${t('Lines', 'Linhas')}: ${lines.slice(0, 12).join(', ')}${lines.length > 12 ? '…' : ''}.` : '')
