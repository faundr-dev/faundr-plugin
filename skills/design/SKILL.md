---
name: design
description: Cuida do design do projeto no Faundr — cria o design.md (o guia que padroniza cores, fontes e componentes) quando ele não existe e audita as telas contra ele (tela fora do padrão, componente recriado em vez de reutilizado, bug visual como menu cortado ou sobreposto). Use quando o usuário pedir, quando o Faundr disser que o projeto não tem design.md, ou quando o Faundr pedir a auditoria rápida no fim da resposta.
argument-hint: "[--files a.tsx,b.tsx]  (sem argumento: auditoria completa)"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## Contexto de design

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-context $ARGUMENTS`

O "Modo" acima diz o que fazer: **completo** (o usuário chamou a skill) ou **rápido** (o Faundr pediu no fim da resposta, só para os arquivos listados).

Use a CLI com a ferramenta Bash, sempre com aspas: `faundr ...` (se não estiver no PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

## 1. Sem design.md? Crie primeiro (só no modo completo)

O design.md é a regra das telas: sem ele não há contra o que auditar. O design é do usuário: **nunca escreva o design.md sem perguntar**.

**1a. Levante o que já existe.** Leia os estilos globais, os tokens e as telas do contexto acima e monte uma proposta: tela de referência, cores, fontes, forma (raios, cortes, bordas), tema claro/escuro, componentes já prontos.

**1b. Pergunte (use a ferramenta de perguntas ao usuário, até 4 perguntas numa rodada).** Cada pergunta traz a sua proposta tirada do código como primeira opção ("(Recomendado)") e alternativas reais. Cubra:
- **Referência:** qual tela representa o visual que ele quer (liste as candidatas).
- **Cores:** a paleta encontrada (cite os hex), se é essa, se falta uma cor de destaque ou se quer outra.
- **Tipografia:** as fontes encontradas nos títulos e no texto.
- **Personalidade:** 2–3 adjetivos do visual (ex.: sóbrio/técnico, leve/amigável) e se há alguma marca registrada (um corte, um traço, uma forma) que deve se repetir.
- **Escopo** (numa segunda rodada, se precisar): precisa funcionar no celular (sim / só no computador / feito para celular)? Tipo de produto (app ou painel / site ou landing / os dois)? Tema (escuro / claro / os dois)? Movimento (sem animação / sóbrio / expressivo)? Grave as respostas com `faundr design-scope --mobile … --product … --theme … --motion …`.
Se o usuário já disse algo disso nesta conversa, não pergunte de novo: use e cite. Se ele responder "Outro", siga o que ele escreveu.

**1c. Escreva `DESIGN.md` na raiz** com as respostas e com os valores exatos do código:
- Seções: **Princípios** (3–5 frases: o que o visual comunica), **Cores** (cada token com nome, valor hex e uso; nada de cor fora desta lista), **Tipografia** (fontes, pesos, tamanhos de título/texto), **Espaçamento e forma** (raios, bordas, cortes, sombras), **Componentes** (o que já existe e deve ser reutilizado, com o caminho do arquivo e quando usar cada variante), **Padrões de tela** (estrutura de página, estados vazio/carregando/erro, menus e modais), **Movimento** (curvas e durações do projeto — se não houver nenhuma, proponha as do piso de qualidade: saída `cubic-bezier(0.23, 1, 0.32, 1)`, botão 100–160 ms, menu 150–250 ms, modal 200–300 ms —, o que não anima por ser usado o tempo todo, e "respeita reduzir movimento"), **Escopo e exceções** (as respostas de escopo e as exceções decididas, "técnica — motivo", ex.: "ícones só Lucide — escolha da marca"), **Não faça** (erros concretos a evitar; inclua sempre: desligar o zoom do celular, tirar o contorno de foco sem substituto, `div` clicável no lugar de botão, `transition-all`, bloquear colar em campos).
- Escreva os valores exatamente como estão no código (ex.: tokens do `@theme`, classes do `styles.css`), para a checagem automática reconhecer a paleta.
- No topo, uma linha dizendo de onde veio cada decisão (ex.: "cores e fontes: tokens de src/styles.css, confirmados pelo usuário em 29/09").
- Depois rode `faundr design-lint` para o painel saber que o design.md existe, e mostre ao usuário um resumo do que ficou decidido.

## 2. Audite

Leia o **piso de qualidade** (caminho no contexto): são os números e a lista do que recusar que valem para toda tela.

**Modo rápido:** leia só os arquivos listados e compare com o design.md e o piso. Corrija na hora o que for simples (cor fora da paleta, estilo que já existe como componente). Registre o que não der para corrigir agora. Não abra o navegador.

**Antes de tudo, leia o "Escopo do design" e os "Achados arquivados" do contexto.** O que o dono desligou ou arquivou não vale para este projeto: não registre de novo. Escopo "só no computador" = não procure problemas de responsividade. Exceção decidida no design.md ("técnica — motivo") não é problema. Se o design.md pede algo que quebra uma regra objetiva (ex.: cinza claro que reprova contraste), não corrija nem ignore em silêncio: registre e pergunte ao dono se mantém.

**Modo completo:** passe por todas as telas e componentes. **Forme sua opinião olhando as telas e o código antes de ler a lista da checagem automática**; depois compare: diga onde concorda, o que só a checagem pegou e quais achados dela são falso alarme (arquive esses com a evidência). Além do checklist abaixo, em cada tela pergunte: que decisão ou tarefa a pessoa faz aqui, e a tela ajuda nisso (painel genérico de cards e gráfico sem pergunta no título é achado)? Procure, por tipo (`--kind`, e a regra `--rule tema/nome`):
- **Responsivo** (`responsive`, tema `responsivo`) — se o escopo pede celular: o que acontece abaixo de 768 px em cada componente de várias colunas (precisa estar resolvido no próprio componente); faixa esquecida entre 600 e 1024 px; larguras fixas grandes; `h-screen`/`100vh` (use `dvh`); campo com fonte < 16 px (o iPhone dá zoom); ações que só aparecem no hover; tabelas e gráficos em tela estreita; navegação no celular; barra fixa cobrindo conteúdo; alvos de toque < 44 px. Aponte **componente e tela**.
- **Acessibilidade** (`a11y`, tema `acessibilidade`): contorno de foco removido sem substituto; botão só com ícone sem `aria-label`; `div` clicável sem teclado; imagem sem `alt`; campo só com placeholder (sem rótulo); contraste de texto < 4,5:1 (3:1 para texto grande, ícones e bordas); status mostrado só por cor; modal que não prende nem devolve o foco; erros e toasts sem `aria-live`; zoom do celular desligado; animação sem `prefers-reduced-motion`.
- **Movimento** (`motion`, tema `movimento`): o que se usa muitas vezes por dia ou pelo teclado (atalhos, paleta de comandos, navegação, hover de lista) não deve animar; animação de interface acima de 300 ms (modal/gaveta até 500, toast até 400); `ease-in` em interface; `transition-all`; animar largura, altura ou posição (exceto acordeão); entrar com `scale(0)`; animação sem propósito.
- **Conteúdo e estados** (`content`, tema `conteudo`): tela que busca dados sem carregando/vazio/erro; vazio que não diz o porquê nem a ação; erro sem o que fazer; dado inventado ou de enchimento ("John Doe", números de exemplo); botões com a mesma intenção e rótulos diferentes; rótulos vagos ("Clique aqui", "OK"); "..." no lugar de "…".
- **Identidade do app** (`identity`, tema `identidade`): favicon e ícone do iPhone (apple-touch-icon), título padrão esquecido ("Vite + React"), descrição da página, imagem de compartilhamento, `lang` no `<html>`, `meta viewport`, `theme-color`.
- **Fora do design** (`off_spec`, tema `design`): cores, fontes, raios, espaçamentos ou padrões de tela diferentes do design.md. Uma tela inteira fora do padrão é **um** achado (não um por linha).
- **Repetição** (`duplicate`, tema `repeticao`): o mesmo elemento (botão, card, campo, menu) montado de novo em vários lugares em vez de um componente reutilizável.
- **Bug visual** (`visual`, tema `visual`): menu ou tooltip cortado por `overflow` do pai, z-index errado, modal fora do centro, texto estourando, sobreposição.
- **Boa prática** (`practice`, tema `pratica`): falta de componente base (Button, Input, Card…), controle morto (`href="#"`), `alert()` para erro.

Se o servidor de desenvolvimento estiver no ar (endereço no contexto), **use o navegador** (Claude in Chrome) só no modo completo, e **meça em vez de só olhar**:

1. Liste as telas principais (rotas do app) e dê um nome curto a cada uma ("Projetos", "Design → Problemas"…). Use sempre o mesmo nome para a mesma tela: é por ele que o Faundr acompanha a tela entre auditorias.
2. Para cada tela, meça nas larguras **375, 768, 1024 e 1440 px** (só 1024 e 1440 se o escopo for "só no computador"), sem redimensionar a janela: gere o script com `faundr design-measure-script --url "<URL completa da tela, ex.: http://localhost:3000/projetos>" --widths 375,768,1024,1440` e rode-o com `javascript_tool` numa aba aberta no mesmo site, com `await` na frente. Ele abre a tela num iframe invisível em cada largura (o login vale, é o mesmo site), mede e devolve um resumo curto; o resultado completo fica em `window.__faundrMedicao`. Para cada largura `i`, pegue `JSON.stringify(window.__faundrMedicao[i])`, salve num arquivo temporário e registre: `faundr design-measure-save --screen "<tela>" --file <arquivo.json>`. (Para medir a janela como está, sem --url, o script devolve uma medição só; aí passe `--width`.) A CLI cria um achado por tela, largura e regra — rolagem para o lado e quem passa da borda, alvos de toque < 44 px, texto cortado, contraste real, texto < 12 px, transições lentas, texto colado na borda — e resolve sozinha o que sumiu desde a medição anterior: não registre esses de novo com design-finding.
3. Em 1440 px, abra cada menu, dropdown e modal e tire print: algo cortado, escondido ou sobreposto vira achado `visual`.
4. **Teclado** (uma tela de cada tipo): aperte Tab algumas vezes e confira no print que o foco aparece e segue a ordem visual; abra um modal e veja se Esc fecha e se o foco volta. Problemas viram achados `a11y`.
5. Diga no resumo o que só um aparelho de verdade confirma (hover grudado, teclado do celular, áreas seguras) — a emulação do navegador não reproduz isso.

Na cobertura, o que foi medido assim é `--how navegador`. Se o servidor não estiver no ar, audite só pelo código, marque responsivo e visual como `parcial` e diga isso no resumo.

A checagem automática (sem IA) já registrou os achados listados no contexto — não os registre de novo; confirme ou descarte na sua análise.

**Arquivar (não é resolver).** Quando um achado aberto não vale para este projeto — falso alarme que você comprovou, ou contraria uma decisão registrada no escopo/design.md — arquive com a evidência: `faundr design-archive D-<n> --reason falso-alarme|nao-se-aplica|decisao-de-design --note "<quem decidiu e por quê>"`, e conte ao usuário na resposta. Na dúvida, pergunte em uma frase em vez de arquivar. Nunca arquive para "passar" um problema real.

**Exceção pontual no código.** Quando um trecho quebra uma regra automática de propósito (ex.: um canvas com largura fixa), dá para marcar no próprio código, na linha de cima: `// faundr-ignore <regra>: <motivo>` (ou `{/* faundr-ignore <regra>: <motivo> */}` dentro do JSX; `faundr-ignore-file <regra>: <motivo>` vale para o arquivo inteiro). Use só com motivo real e conte ao usuário; para "não vale no projeto todo", prefira desligar a regra no escopo.

## 3. Registre no Faundr

Um comando por problema real (sem achismo; aponte arquivo e linha):

`faundr design-finding "<título curto, o problema>" --kind <tipo> --rule <tema>/<nome-curto> --severity high|medium|low --file <caminho> --line <n> --detail "<o que está errado, por que importa e como corrigir, em português simples>"`

- `--rule`: o tema do tipo + um nome curto em minúsculas com hífen, reutilizando o mesmo nome para o mesmo problema (ex.: `responsivo/grid-sem-celular`, `responsivo/largura-fixa`, `acessibilidade/foco-removido`, `movimento/duracao-longa`, `conteudo/sem-estado-vazio`, `identidade/sem-favicon`). É por ela que o dono arquiva ou desliga uma regra inteira.
- **Gravidade pela régua, não por impressão:** `high` = impede a tarefa, falha acessibilidade básica (contraste de texto, foco invisível, zoom desligado, botão sem nome) ou quebra no celular (rolagem horizontal, conteúdo inalcançável), ou tela inteira fora do padrão; `medium` = erro visível que tem contorno; `low` = polimento e consistência. Desempate: "a pessoa abriria um chamado no suporte por causa disso?" → pelo menos `medium`.
- Se o comando responder "regra desligada" ou "já estava arquivado", não insista.
- Achados anteriores que você verificou e já estão corrigidos: `faundr design-resolve D-<n>`.

**Só no modo completo — registre a cobertura**, um comando por tema, para o dono ver o que foi verificado (não só o que falhou):

`faundr design-coverage --theme <tema> --result passou|falhou|parcial|nao-verificado --how codigo|navegador|aparelho --score <0-4> --note "<em uma frase: o que olhou e o que achou>"`

Temas: `responsivo`, `acessibilidade`, `movimento`, `conteudo`, `identidade`, `design` (consistência com o design.md), `visual`. Tema desligado no escopo: `nao-verificado` com a nota "desligado no escopo". Nota: 4 = nada a corrigir; 3 = só polimento; 2 = problemas visíveis com contorno; 1 = algo impede o uso ou falha acessibilidade básica; 0 = tema quebrado em quase toda tela. Seja honesto: o que não deu para verificar (ex.: celular sem navegador) é `parcial` ou `nao-verificado`, nunca `passou`. No fim, feche a auditoria com `faundr design-coverage --finish` (guarda as notas para a tendência no painel).

## 4. Responda

Resumo curto para o usuário, em português simples: se criou o design.md, quantos achados por tipo, os 3 mais importantes (com D-n), o que arquivou (com o motivo) e o que sugere fazer primeiro. No modo completo, mostre também um quadro curto por tema — **Tema | Resultado | Nota | Como verificou** — e o que não deu para verificar. Ao oferecer correções, siga a ordem: (1) o que quebra o uso ou a acessibilidade; (2) estados faltando; (3) responsivo e fluxo; (4) desvio do design.md; (5) polimento — e diga que dá para corrigir tudo nessa ordem com `/faundr:design-fix` (sem número) ou um de cada vez com `/faundr:design-fix D-<n>`. No modo completo **não saia corrigindo tudo**: ofereça corrigir. Os achados aparecem na seção Design do projeto no painel.
