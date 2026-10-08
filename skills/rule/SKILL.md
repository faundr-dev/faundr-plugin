---
description: Registra uma regra do time no Faundr. Com arquivos ou padrões (ex.: src/server/**), a regra chega ao agente na hora de editar esses arquivos, em vez de no início de toda sessão.
argument-hint: <regra> [porque ...] [em <arquivos ou pastas>]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

Separe a regra (curta e afirmativa, ex.: "Toda rota do servidor confere o acesso ao projeto"), o porquê e, se o usuário citou arquivos, pastas ou tipos de arquivo, os caminhos. Use caminhos a partir da raiz do projeto: um arquivo (`src/server/hook-events.ts`), uma pasta (`src/server`) ou um padrão (`src/routes/**/*.ts`, `*.sql`). Rode com a ferramenta Bash, com aspas, um `--file` por caminho:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" rule "<regra>" --why "<porquê>" --file "<caminho>"`

Sem caminhos, a regra vale para tudo e entra no início de toda sessão. Se a regra claramente fala de uma parte do código mas o usuário não disse onde, sugira os caminhos (use `faundr graph-query` se houver grafo) e pergunte em uma frase antes de registrar.

Confirme em uma frase: com caminhos, diga que ela chega ao agente antes de ele editar esses arquivos (já nesta sessão); sem caminhos, que todo agente recebe a regra a partir da próxima sessão.

Se a regra proíbe algo que dá para achar pelo texto do código (uma biblioteca, uma função, um jeito de escrever: "não usar axios", "sem console.log nas telas", "nada de chave do Stripe no front"), acrescente `--forbid "<expressão regular>"` (ex.: `--forbid "from ['\"]axios['\"]"`). Assim o Faundr avisa antes de uma edição que traga isso e a checagem de qualidade aponta onde já existe. Diga ao usuário o padrão que usou.
