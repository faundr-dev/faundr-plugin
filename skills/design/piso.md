# Piso de qualidade de interface (Faundr)

O mínimo que toda tela precisa cumprir, em qualquer projeto. Leia antes de criar ou mudar uma tela e antes de corrigir um achado de design. **O design.md do projeto manda**: quando ele decide outra coisa (seção "Escopo e exceções"), siga o design.md. Os números vêm de WCAG 2.2, web-interface-guidelines (Vercel), impeccable, anti-slop, taste-skill e das skills de Emil Kowalski (estudos em `docs/research/design-*.md` do Faundr).

## Números

| Tema | Mínimo |
|---|---|
| Contraste de texto | 4,5:1 (texto grande ≥ 24 px ou ≥ 18,66 px negrito: 3:1). Ícones, bordas de campo e foco: 3:1 |
| Alvo de toque (celular) | 44×44 px (no desktop, 24×24), com ~8 px entre alvos vizinhos |
| Campo de texto no celular | fonte ≥ 16 px (senão o iPhone dá zoom) |
| Texto | corpo ≥ 14 px no celular; nada abaixo de 12 px (rótulo ≥ 11 px só se o design.md decidir) |
| Linha de texto | 45–75 caracteres; entrelinha do corpo ≥ 1,4; título 1,1–1,25 |
| Larguras a testar | 375, 768, 1024, 1440 px (sem rolagem para o lado em nenhuma) |
| Animação de interface | 100–300 ms (botão 100–160, tooltip 125–200, menu 150–250, modal/gaveta 200–500, toast ≤ 400) |
| Curva | saída (`ease-out` ou `cubic-bezier(0.23, 1, 0.32, 1)`); nunca `ease-in` em interface; sem quique |
| Carregando | spinner só depois de ~200 ms; se aparecer, fica pelo menos ~400 ms (não pisca) |
| Paleta | 1 cor de destaque; 1 família de cinza; 1 escala de raio; 1 biblioteca de ícones |

## Toda tela tem

- **Estados**: carregando (diz o quê), vazio (diz por quê e qual a ação), erro (diz o que falhou e o que fazer), sem permissão. Primeiro uso ≠ filtro sem resultado.
- **Foco visível** em tudo que é clicável; ordem do Tab igual à ordem visual; Esc fecha modal e menu; modal prende e devolve o foco.
- **Nomes acessíveis**: botão só com ícone tem `aria-label`; imagem tem `alt`; campo tem rótulo (placeholder não é rótulo).
- **Semântica**: ação = `<button>`, navegação = `<a>`/`<Link>`; nada de `div` clicável.
- **Celular**: o que acontece abaixo de 768 px está resolvido no próprio componente (colunas viram 1, tabela rola dentro de uma caixa, menu vira gaveta); nada que só aparece no hover; `dvh` no lugar de `100vh`.
- **Movimento com propósito**: o que se usa muitas vezes por dia ou pelo teclado não anima; respeite "reduzir movimento".
- **Texto honesto**: nada de dado inventado ou de exemplo ("John Doe", números de enfeite); rótulos dizem a ação ("Salvar alterações", não "OK"); erro diz o próximo passo; "…" e não "...".
- **Identidade**: favicon, título por tela, `lang`, descrição.

## Recuse (sinais de tela feita no automático)

- Grade de cards iguais com ícone + título + texto para tudo.
- Painel padrão (barra lateral + 4 cards de número + gráfico + tabela) sem responder "que decisão a pessoa toma aqui?"; gráfico sem uma pergunta no título.
- Métrica-herói de enfeite, números redondos inventados, "+10.000 usuários" sem prova.
- Texto em degradê, vidro (blur) decorativo, brilho/sombra colorida, faixa colorida na lateral do card.
- Modal por reflexo (o que cabe na página não vai para modal); confirmação em ação que dava para desfazer.
- Emoji como ícone; dois estilos de ícone; cinzas de famílias diferentes.
- Rótulo em caixa alta espaçada acima de todo título; numeração 01/02/03 de enfeite.
- `transition-all`, animação longa, quique, entrar de `scale(0)`.

## Ao corrigir

Nunca mude, sem pedir: URLs, rótulos da navegação, nomes e ordem de campos de formulário, logo, textos legais. Corrija na ordem: (1) quebrado, perda de dados, inacessível; (2) estados faltando; (3) responsivo e fluxo; (4) desvio do design.md; (5) polimento.
