# Diagrama "como vai funcionar"

Só com o OK do dono: gasta mais tokens que o normal. Vale para o diagrama de uma funcionalidade e para a arquitetura do projeto (camadas e `--architecture` em `projeto.md`). Escreva o JSON **de uma vez**, sem planejar o desenho em texto antes: você não posiciona nada, só diz em que raia e em que coluna cada peça fica; o painel desenha.

## O que mostrar

- **Um caminho principal**, do começo ao fim, do jeito que a pessoa vive: o que ela faz, o que a tela mostra, o que o servidor decide, onde o dado fica. Em `mainPath`, os ids em ordem.
- **Só os desvios que importam**: o principal caso de erro e a volta para tentar de novo. Não desenhe todo detalhe.
- **Raias = quem faz** (de 2 a 5): ex. `Pessoa`, `Tela`, `Servidor`, `Banco`, `Serviço externo` (Pix, e-mail…). Use os nomes do projeto quando ajudar ("Tela do carrinho").
- **Colunas = a ordem** (0, 1, 2…). Peças que acontecem no mesmo momento podem ficar na mesma coluna em raias diferentes. Nunca duas peças na mesma raia e coluna.
- **Português simples** nos rótulos (até 32 caracteres; o detalhe vai em `sublabel`, até 48).
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
    { "id": "confere", "lane": "servidor", "col": 2, "type": "decision", "label": "Cupom vale?", "sublabel": "dentro do prazo e do limite" },
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
2. Rode `faundr diagram-save` (para outra funcionalidade que não a atual: `--feature "<nome>"`).
3. Se voltar uma lista de problemas, corrija **só** os pontos apontados e rode de novo. No máximo 2 correções; se ainda falhar, diga ao dono o que ficou faltando em vez de reescrever tudo.
4. Diga em uma frase onde ver: página da funcionalidade no painel, em **Como vai funcionar**.
