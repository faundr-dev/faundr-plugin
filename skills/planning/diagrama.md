# Diagrama "como vai funcionar"

Só com o OK do dono: gasta mais tokens que o normal. O desenho da funcionalidade funciona como um Artifact: abre sozinho num canvas no navegador e o dono aprova ou pede mudanças ali. Vale para o diagrama de uma funcionalidade e para a arquitetura do projeto (camadas e `--architecture` em `projeto.md`). Escreva o JSON **de uma vez**, sem planejar o desenho em texto antes: você não posiciona nada, só diz em que raia e em que coluna cada peça fica; o painel desenha.

## O que mostrar

- **Um caminho principal**, do começo ao fim, do jeito que a pessoa vive: o que ela faz, o que a tela mostra, o que o servidor decide, onde o dado fica. Em `mainPath`, os ids em ordem.
- **Só os desvios que importam**: o principal caso de erro e a volta para tentar de novo. Não desenhe todo detalhe.
- **Raias = quem faz** (de 2 a 5): ex. `Pessoa`, `Tela`, `Servidor`, `Banco`, `Serviço externo` (Pix, e-mail…). Use os nomes do projeto quando ajudar ("Tela do carrinho").
- **Colunas = a ordem** (0, 1, 2…). Peças que acontecem no mesmo momento podem ficar na mesma coluna em raias diferentes. Nunca duas peças na mesma raia e coluna.
- **Português simples** nos rótulos (até 32 caracteres; o detalhe vai em `sublabel`, até 48).
- **Explicação de cada peça** em `detail` (até 400 caracteres, 2 a 3 frases): o que ela é, por que existe e o que acontece ali, para quem não programa. É o que abre quando o dono clica na peça no canvas. Pule só na pessoa e no resultado quando o rótulo já diz tudo.
- Até 30 peças e 50 ligações; para uma funcionalidade, de 6 a 14 peças costuma bastar.

## Formato

```json
{
  "version": 1,
  "title": "Cupom de desconto no carrinho",
  "summary": "A pessoa digita o cupom, o servidor confere e o total já aparece com o desconto.",
  "lanes": [
    { "id": "pessoa", "label": "Pessoa" },
    { "id": "tela", "label": "Tela do carrinho" },
    { "id": "servidor", "label": "Servidor" },
    { "id": "banco", "label": "Banco" }
  ],
  "nodes": [
    { "id": "digita", "lane": "pessoa", "col": 0, "type": "person", "label": "Digita o cupom" },
    { "id": "aplicar", "lane": "tela", "col": 1, "type": "screen", "label": "Clica em Aplicar" },
    { "id": "confere", "lane": "servidor", "col": 2, "type": "decision", "label": "Cupom vale?", "sublabel": "dentro do prazo e do limite", "detail": "O servidor confere se o cupom existe, se ainda está no prazo e se não passou do limite de usos. A conferência fica no servidor para ninguém conseguir mudar o desconto pelo navegador." },
    { "id": "cupons", "lane": "banco", "col": 2, "type": "data", "label": "Tabela de cupons" },
    { "id": "invalido", "lane": "tela", "col": 3, "type": "error", "label": "Mostra: cupom inválido" },
    { "id": "total", "lane": "tela", "col": 4, "type": "end", "label": "Total com desconto" }
  ],
  "edges": [
    { "from": "digita", "to": "aplicar" },
    { "from": "aplicar", "to": "confere" },
    { "from": "confere", "to": "cupons", "label": "busca o cupom" },
    { "from": "confere", "to": "total", "label": "vale" },
    { "from": "confere", "to": "invalido", "label": "não vale", "kind": "error" },
    { "from": "invalido", "to": "aplicar", "kind": "back" }
  ],
  "mainPath": ["digita", "aplicar", "confere", "total"],
  "notes": ["O cupom é conferido no servidor, nunca só na tela."]
}
```

- `type` da peça: `person` (a pessoa), `screen` (tela ou botão), `action` (algo que o sistema faz), `decision` (uma pergunta com sim/não), `data` (onde o dado fica), `external` (serviço de fora), `error` (o que a pessoa vê quando dá errado), `end` (o resultado).
- `kind` da ligação: `main` (sai sozinho para as ligações do `mainPath`), `normal`, `error` (quando dá errado), `back` (volta e tenta de novo).
- `notes`: até 4 frases com o que não cabe no desenho (uma regra, um limite).
- `paths` (opcional, na peça): até 5 caminhos de onde ela mora no código, relativos à raiz (`"src/routes/agenda/**"`, `"src/lib/cupom.ts"`). Na arquitetura, ponha em toda peça que vira código: o plugin confere sozinho, no início de cada sessão, quais já existem, e o painel mostra apagadas as que ainda são só plano. Deixe sem `paths` o que não é código do projeto (a pessoa, um serviço de fora).

## Enviar

1. Escreva em `.faundr/painel/diagram.json`.
2. Rode `faundr diagram-save` (para outra funcionalidade que não a atual: `--feature "<nome>"`). Rode com tempo de espera de 10 minutos: ele salva, abre o canvas no navegador do dono e **espera** ele aprovar ou pedir mudanças.
3. Se voltar uma lista de problemas, corrija **só** os pontos apontados e rode de novo. No máximo 2 correções; se ainda falhar, diga ao dono o que ficou faltando em vez de reescrever tudo.
4. O que o comando responder decide o próximo passo:
   - **APROVOU**: é o OK do dono para construir. Não pergunte de novo; diga em uma linha que ele aprovou e comece pelo primeiro passo.
   - **PEDIU MUDANÇAS**: leia o motivo, ajuste o desenho (e o plano, se mudou algo; registre no Faundr) e salve de novo. Diga em uma linha o que mudou. Não construa antes do OK.
   - **Sem resposta em 9 minutos**: rode `faundr diagram-wait` uma vez para continuar esperando; se de novo não vier, pergunte no terminal se ele aprova.
5. A arquitetura (`--architecture`) não passa por aprovação: salva e aparece em **Arquitetura**, no menu do projeto, num canvas onde cada peça abre a explicação.
