# Guia para escrever e consertar testes

Destilado dos estudos do Faundr (`docs/research/testes-*.md` e `qualidade-plugins-anthropic.md`): a skill TDD de
Matt Pocock (MIT), o pr-test-analyzer e o test-engineer dos plugins oficiais da Anthropic (Apache-2.0), e o Stryker
(Apache-2.0). Reescrito em português.

## Antes de escrever: o que não pode quebrar

O dono não programa. Não pergunte "quais funções testar"; pergunte em linguagem de produto:
"Destas coisas, quais não podem quebrar de jeito nenhum?" e liste as funcionalidades do contexto
(ex.: "calcular o total do carrinho", "entrar com e-mail e senha", "cobrar a assinatura"). O esforço vai primeiro
para o que ele escolher. Registre a resposta com `faundr tests-map "<funcionalidade>" --critical`.

## As regras

1. **Teste pela porta da frente.** Chame a função, a rota ou a tela como quem usa o app chamaria. Não teste
   detalhe interno: teste que quebra numa refatoração que não muda o comportamento é teste ruim.
2. **Valor esperado escrito à mão.** Um número literal, um exemplo calculado de cabeça, o que a especificação diz.
   Proibido recalcular como o código calcula (`expect(soma(a, b)).toBe(a + b)`): esse teste nunca discorda do código.
3. **Dublê só na fronteira.** Simule o que é de fora e você não controla: pagamento, e-mail, IA, rede, **data e
   hora** (`vi.useFakeTimers()` + `vi.setSystemTime(...)`), sorteio. Nunca simule um módulo do próprio projeto
   (`vi.mock('./…')`) nem o que você quer testar.
4. **Casos de erro, vazio e limite.** Lista vazia, campo ausente (`null`/`undefined`), zero, negativo, exatamente no
   limite (`>` × `>=`: "compra de exatamente R$ 100"), texto com acento, falha de rede. É onde o bug mora.
5. **Veja o teste falhar antes de confiar nele.** Teste novo de código que já existe: quebre a linha de propósito
   (troque `>=` por `>`, apague a linha), rode e veja ficar vermelho; depois desfaça. Teste que nunca ficou vermelho
   pode estar testando nada.
6. **Um comportamento por teste, nome que diz o quê.** "cobra frete de R$ 15 abaixo de R$ 100", não "teste 3".
7. **Independentes e em qualquer ordem.** Nada de depender de hora real, rede real, ordem dos testes ou dado deixado
   por outro teste. Banco: use um banco de teste (`.env.test`), nunca o de produção.
8. **Espere o resultado, não o relógio.** No Playwright, `expect(locator).toBeVisible()` já espera sozinho;
   `waitForTimeout(2000)` é a principal causa de teste instável.
9. **Pirâmide.** Muitos testes pequenos e rápidos (uma função), alguns de integração (rota + banco de teste), poucos
   de ponta a ponta no navegador (2 a 5 fluxos críticos: entrar, comprar, cadastrar).
10. **Use o que o projeto já tem.** Mesmo executor (Vitest, Jest, Playwright, node --test), mesma pasta e mesmo
    jeito dos testes vizinhos. Não instale executor novo sem o OK do dono.
11. **Fatias verticais.** Um teste, rode, passe para o próximo. Não escreva vinte testes de uma vez sem rodar.
12. **Não peça teste para o trivial** (um getter, uma constante). Esforço onde há decisão: if, laço, conta, dinheiro,
    permissão.

## Teste de mutação: prova de que os testes pegam erro

O Faundr pode estragar o código de propósito (`faundr tests-mutation`) e listar cada estrago que nenhum teste percebeu
(T-n). Cada um é um caso que falta: escreva o teste, prove rodando a mutação só naquela linha
(`--files arquivo:linha-linha`) e veja virar "agora pego". Estrago que não muda o comportamento ("equivalente") não
tem teste possível: explique ao dono e ignore com motivo.

## Consertar teste falhando

- **Descubra de que lado está o erro.** Leia a mensagem e o teste. O código mudou de propósito (o teste ficou velho)
  ou o código quebrou (o teste pegou um bug)? Na dúvida, pergunte ao dono qual é o comportamento certo.
- **Nunca** apague, pule (`.skip`), afrouxe o `expect` ou mude o valor esperado só para passar sem dizer por quê.
  Se o teste estava errado, explique ao dono em uma frase o que estava errado nele.
- Teste do Playwright: veja a captura de tela da falha (o caminho vem na mensagem ou em `test-results/`).

## Consertar teste instável (passa e falha sem o código mudar)

Causas típicas, na ordem: espera com tempo fixo; data e hora reais; rede ou serviço real; teste que depende de outro
(dado que sobrou, ordem); sorteio sem semente; corrida (duas coisas ao mesmo tempo). Conserte a causa.
**Nunca** "resolva" aumentando o número de tentativas (`retries`): isso esconde o problema.
Para confirmar: rode o mesmo teste várias vezes (`faundr tests-run --files <arquivo>` repetido) e veja se para de
oscilar.
