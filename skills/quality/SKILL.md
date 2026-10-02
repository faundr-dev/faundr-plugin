---
description: Revisão de qualidade do código com IA no projeto ligado ao Faundr — lê o que mudou (ou o projeto inteiro, com --full) atrás do que a checagem automática não enxerga (código demais com o substituto concreto, erro escondido, tipos que não protegem, nomes e funções confusos, comentários que mentem, testes que não protegem, regras do CLAUDE.md desobedecidas) e registra cada problema real como Q-n no painel, só com confiança 80 ou mais. Use quando o usuário pedir uma revisão de qualidade, "o código está bom?", "tem código demais?", ou quando o Faundr sugerir.
argument-hint: [--full | --files a.ts,b.ts]  (sem argumento: o que mudou)
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(git diff *) Bash(git log *) Read Grep Glob
---

## Contexto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" quality-context $ARGUMENTS`

Use a CLI com a ferramenta Bash, sempre com aspas: `faundr ...` (se não estiver no PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

Você **só aponta**: não altere nenhum arquivo nesta revisão. A correção é o `/faundr:quality-fix`, quando o usuário pedir.

## 1. Prepare

1. Leia o **catálogo** (caminho no contexto) inteiro: a régua de confiança, o que não é achado, o que nunca cortar, a contraevidência e os temas.
2. Leia as **regras do projeto** listadas (CLAUDE.md, AGENTS.md, design.md). Regra escrita ali vale mais que gosto pessoal.
3. Modo **sessão** (padrão): revise só os arquivos listados, e dentro deles **só o que mudou** (`git diff HEAD -- <arquivo>` mostra as linhas). Problema em linha que ninguém mexeu não é cobrado agora. Se a lista estiver vazia, diga ao usuário e ofereça `/faundr:quality --full`.
   Modo **projeto** (`--full`): inventário por tema, começando pelos arquivos mais complexos do contexto. Não tente ler tudo: amostre com a ferramenta Grep e com `faundr graph-query "<pergunta>"` (se existir `.faundr/`), e diga no fim o que não foi olhado.
4. Antes de dizer que algo "já existe no projeto" ou "ninguém usa", **procure** (Grep) e cite onde.

## 2. Procure, tema por tema

Siga os temas do catálogo na ordem: `demais`, `falha`, `tipos`, `complexidade`, `comentarios`, `testes`, `instrucoes` (e `arquitetura` só no modo projeto). Não repita o que já está na lista "Já registrados e abertos" do contexto: se um deles for alarme falso, diga ao usuário e sugira ignorar pelo painel.

## 3. Para cada suspeita

1. **Contraevidência**: argumente contra o próprio achado, com as perguntas do catálogo. Sem conseguir apontar arquivo:linha da prova, descarte.
2. **Nota de confiança** pela régua do catálogo. Abaixo de 80: não registre (pode citar na resposta como "talvez").
3. **Gravidade pela régua**: `high` = esconde um erro que vai custar dado ou dinheiro, ou deixa o código frágil num ponto central (muitos chamadores); `medium` = atrapalha entender ou mudar, com contorno; `low` = polimento.
4. Em código demais: uma etiqueta (`apagar`, `stdlib`, `nativo`, `yagni`, `encurtar`), **sempre o substituto concreto** no `--fix` (nomeie a função ou o recurso, ou mostre a forma curta) e as linhas que sairiam em `--saves`, contadas no código. Nunca invente número.

## 4. Registre cada problema real

Um comando por problema:

`faundr quality-finding "<título curto: o problema>" --theme <tema> [--label <etiqueta>] --severity high|medium|low --confidence <80-100> --file <caminho> --line <n> --detail "<o que é e onde, em português simples>" --impact "<por que importa para quem usa ou mantém>" --fix "<o substituto concreto ou a mudança mínima>" [--saves <n>]`

Escreva `--detail`, `--impact` e `--fix` para quem **não programa** ler no painel, mas com o nome exato da função, componente ou recurso.

## 5. Registre a cobertura

`faundr quality-review-done --areas "<o que revisou; separado por ;>" --clean "<o que conferiu e está bom; separado por ;>" --summary "<2 frases>" --net "<-N linhas, -M pacotes possíveis, ou vazio>" --scores "<tema>=<0-4>; …"` (acrescente `--full` no modo projeto)

Nota por tema revisado (0 a 4): 4 = nada a corrigir; 3 = só polimento; 2 = problemas visíveis com contorno; 1 = atrapalha mudar o código com segurança; 0 = o tema está ruim em quase todo lugar. Seja honesto: tema que você não olhou fica de fora das notas.

## 6. Responda

Em português simples, poucas linhas:
1. O que foi revisado e quantos achados por tema, o maior corte primeiro.
2. Os mais importantes (Q-n e uma frase do porquê).
3. No fim: `−N linhas, −M pacotes possíveis` (só o que você contou), ou **"Enxuto. Pode seguir."** se não houver nada.
4. O que não deu para olhar (no modo projeto).

Ofereça corrigir com `/faundr:quality-fix Q-<n>`. **Não saia corrigindo sem o usuário pedir.**
