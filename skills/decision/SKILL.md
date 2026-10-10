---
description: Registra uma decisão técnica do time no Faundr (chega aos agentes quando o trabalho passa pelo assunto dela).
argument-hint: <decisão> [porque ...]
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

Separe a decisão (curta, afirmativa, ex.: "Auth fica no Supabase") do porquê, e rode com a ferramenta Bash, com aspas:
`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" decision "<decisão>" --why "<porquê>"`

Se a decisão vale só para uma parte do código (arquivos, pastas ou padrões como `src/server/**`), acrescente um `--file "<caminho>"` por caminho: ela deixa de entrar no início de toda sessão e chega ao agente antes de ele editar esses arquivos.

Confirme em uma frase: a decisão chega aos agentes deste projeto quando importa (no início da sessão enquanto é recente, quando um pedido falar do assunto e antes de editar os arquivos ligados a ela).

Se a decisão muda uma anterior (o usuário diz "em vez de", "agora é", "mudou"), acrescente `--replaces "<trecho do título da antiga>"`: a antiga fica obsoleta. Se o comando avisar que ela "parece com" outra, diga ao usuário qual e pergunte se a antiga deve ser aposentada (`faundr memory-edit <id> --obsolete`).

Sem `--file`, a decisão se liga sozinha aos arquivos que esta sessão editou (quando são poucos). Se ela vale para o projeto todo, acrescente `--global`.
