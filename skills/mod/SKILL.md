---
description: Cria um mod do Claude Code bem feito — uma mudança na própria tela ou no jeito do Claude trabalhar (painel ao lado, faixa acima do prompt, item na linha de status, aviso rápido, comando com barra, regra que bloqueia ou reescreve uma ferramenta, som). Segue as melhores práticas — pergunta o essencial, separa a lógica para testar, valida, checa os tipos, testa no terminal e no app — e registra no Faundr. Use quando o usuário pedir para criar, mudar ou consertar um mod, ou quando o que ele quer só um mod resolve.
argument-hint: [o que o mod faz]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(claude plugin validate *) Bash(claude plugin test *)
---

Pedido do usuário: $ARGUMENTS

Um **mod** é um plugin pequeno que muda o próprio Claude Code: o que aparece na tela (painel, faixa acima do prompt, linha de status, aviso rápido) ou o que acontece (antes de uma ferramenta rodar, quando um pedido chega, um comando novo com barra). Ele roda dentro do Claude Code, sem Node e sem navegador: tudo o que está fora dele chega por `$`.

Fale com o usuário em português simples. Ele pode não programar: diga o que o mod vai fazer na tela dele, não como funciona por dentro.

## 1. Carregue o guia oficial antes de escrever

Chame a skill `plugin-authoring` do Claude Code (ferramenta Skill). Ela traz o que muda a cada versão do Claude Code e esta skill não repete: **a pasta onde escrever o mod nesta sessão**, o arquivo de tipos desta versão (a referência de cada evento, de cada método de `$` e de cada elemento de tela), os exemplos prontos e como o recarregamento ao vivo funciona. Sem ela você escreve de memória, e a API muda entre versões. Para um detalhe da API, procure no arquivo de tipos pelo nome (`'tool.call'`, `Pane: {`) e leia a declaração; não adivinhe.

## 2. Confira se é mesmo um mod

Antes de criar, veja se algo mais simples resolve, e diga qual:

- texto fixo embaixo do terminal, sem reagir a nada → a barra de status do Faundr (`/faundr:statusline`) ou um item dela no painel (Terminal);
- instruções que o Claude deve seguir → uma regra (`/faundr:rule`) ou um workflow (`/faundr:workflow`);
- um roteiro que o usuário chama → uma skill.

Se já existe um mod que faz isso (o `faundr-mod` já avisa em 80% e 95% do contexto e dos limites e desenha a faixa acima do prompt), mostre e pare.

## 3. Pergunte só o que falta

Se o pedido não diz, faça numa rodada só (ferramenta de perguntas, com opções, a recomendada primeiro), no máximo 3 perguntas:

- **o que aparece e quando** (ex.: "aviso quando o contexto passa de 80%", "painel com os testes que falharam");
- **onde**: só no terminal, ou também no app (desktop) e no VS Code;
- **o que a pessoa pode ligar e desligar** (vira opção do mod, no menu de configuração, em vez de valor fixo no código).

Com o pedido claro, não pergunte.

## 4. Registre no Faundr

`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "Mod: <nome>" --desc "<o que faz>" --done-when "<critério>; validado e testado"` e um `task` por passo (forma, lógica e testes, tela, validação, entrega).

## 5. Escreva com estas práticas

**Forma**
- Nome curto em kebab-case (`aviso-contexto`). Três arquivos, na pasta que o guia oficial indicar: `.claude-plugin/plugin.json` (nome, versão `0.1.0`, descrição de uma linha), `hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`) e `hooks/register.tsx` exportando `register: Register` (tipo importado de `'claude-code'`).
- Escolha o evento pela tabela do guia oficial (painel, faixa acima do prompt, linha de status, aviso, `tool.call`, `prompt.submit`, comando). Um mod faz uma coisa; duas ideias, dois mods.
- Opções que a pessoa escolhe vão em `userConfig` no `plugin.json` e chegam em `options`; nada de valor mágico no código.

**Lógica separada da tela**
- Ponha as contas e decisões num arquivo à parte sem `$` (ex.: `hooks/alerts.ts`: "quais avisos mostrar com estes números"). O `register.tsx` só liga eventos a essa lógica. Assim dá para testar a lógica sozinha e ler o mod sem o Claude Code.

**Estado**
- Valor da sessão em `$.state`; valor que atravessa sessões em `$.store`. Cada valor declarado no contrato `types/index.d.ts` (`interface PluginState`) e o arquivo citado em `"types"` no `plugin.json`.
- Variáveis soltas do módulo somem a cada recarga (o `register` roda de novo). Não guarde nada importante nelas.
- O que a tela lê vem de `atom`: leia com `read` ao desenhar e escreva com `update` num evento. Desenhar não faz conta pesada, não lê arquivo nem rede: o `ui.render` roda muitas vezes.

**Respeitar o resto do Claude Code**
- Chame `next(e)` sempre que não for de propósito responder sozinho: sem ele, os outros plugins e o comportamento normal param ali. Para mudar algo, `next({ ...e, campo })`.
- Hook que barra (`tool.call`, `prompt.submit`, `command.run` e os que o `validate` chama de *gating*) leva `.catch(($, e, next) => next.called ? next(e) : { deny: '<motivo em português>' })`. Sem isso, um erro no hook deixa passar o que ele devia barrar.
- Sem `import()` dinâmico (o módulo não carrega), sem Node (`fs`, `process`) e sem DOM: use `$.fs`, `$.process`, `$.clock`, `$.model`.

**Tela**
- Elementos vêm de `$.ui.resolve(e)` (`const { Box, Text } = $.ui.resolve(e)`), conforme a superfície (`terminal`, `desktop`, `vscode`, `mobile`). Nunca suponha uma só.
- Funcione em terminal estreito: corte texto longo, desça para outra linha em vez de estourar.
- Significado nunca só pela cor (negrito, inverso ou palavra junto). Sem emoji como ícone.
- Avisos rápidos (`$.ui.toast`) com parcimônia: cada aviso uma vez, e só volta quando a situação muda (ex.: depois de `/compact`).
- Nada para mostrar → `next(e)` (a tela normal), não uma caixa vazia.

**Textos**
- Em português simples, curtos, dizendo o que fazer ("Contexto em 82%: hora de /compact"). Motivo de bloqueio explica o porquê e o caminho.

## 6. Verifique antes de dizer que ficou pronto

1. `claude plugin validate <pasta do mod>` sem erro. Leia a lista do que o mod liga e chama: tem que bater com o que você quis.
2. Tipos: `tsc -p <pasta do mod>` (os tipos ficam em `.claude-plugin/types/` depois da primeira carga; antes dela, use o `tsconfig.json` do cabeçalho do arquivo de tipos, guardado fora da pasta do mod).
3. Pelo menos um `*.test.ts` do comportamento pedido, rodado com `claude plugin test <pasta do mod>`. Teste de tela monta nas duas superfícies: `for (const surface of ['terminal', 'desktop'] as const)`.
4. Com o recarregamento ao vivo ligado, o mod carrega quando a resposta termina. Se aparecer uma linha apagada com `<mod>: ... refused` ou um hook pulado, leia o motivo e corrija. Para ver tudo: `claude --debug`.

Se algo falhou, diga o que falhou, com a mensagem. Não diga que está pronto.

## 7. Entregue

- Explique em 2 a 3 frases o que o mod faz e como ver funcionando ("mande uma mensagem e olhe acima do prompt").
- Se o recarregamento ao vivo foi recusado, diga que o mod carrega na próxima sessão.
- A pasta da sessão é temporária: ofereça copiar o mod para uma pasta que a pessoa guarde (no projeto, `mods/<nome>/`). Para outras pessoas instalarem, só se ela pedir: `.claude-plugin/marketplace.json` no repositório e a linha `/plugin install <mod> --marketplace <dono>/<repositório>` no README.
- Feche cada passo no Faundr (`faundr done "<trecho do nome>"`) e registre uma decisão se houve escolha que importa (`decision "<escolha>" --why "<porquê>"`).
