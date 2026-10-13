# Começo de projeto

Use quando o dono descreve um produto inteiro ("quero criar um app de…") ou o projeto ligado ainda não tem código nem funcionalidades. O objetivo é sair da conversa com quatro coisas no painel: a **Visão** (o que é, para quem, as partes planejadas), as **etapas** (a primeira versão e o que vem depois), as **decisões** do dono e, se ele quiser, a **arquitetura** desenhada. Nada de arquivo de plano no projeto.

Os passos 2, 4 e 5 da skill continuam valendo (olhar antes de perguntar, rodadas curtas com recomendação, resposta vaga não passa). O que muda é o assunto das perguntas e o que sai no fim.

## 1. Olhe o que já existe

Pasta vazia ou só o esqueleto de um framework? Diga numa linha só o tamanho e o que vem, terminando com a saída: "Projeto novo: vou definir com você a Visão, as etapas e as decisões antes de construir. Se preferir, eu só começo." Se já houver código, o projeto não é novo: use o `/faundr:inventario` para registrar o que existe e volte ao planejamento normal.

## 2. Perguntas de produto (no máximo 3 rodadas)

Tire as opções da descrição do dono e recomende sempre. Do que importa para o produto, não da tecnologia:

- **Rodada 1, o essencial:**
  - **Quem usa e qual a dor**, só se o pedido deixar duas leituras de verdade (ex.: só o dono marca ou o cliente também marca?). Se ele já disse, não pergunte de novo.
  - **O momento principal:** o que a pessoa faz na primeira vez que abre e que a faz voltar (é o caminho principal da arquitetura).
  - **Onde usa:** celular, computador ou os dois.
  - **Como o projeto se paga**, só se ele falou em vender, cobrar ou anunciar.
- **Rodada 2, a primeira versão:**
  - **O que entra na primeira versão** (escolha múltipla com as capacidades que apareceram; recomende a menor que já resolve a dor).
  - **Se fosse só metade, o que fica?**, só se ele marcou mais do que o recomendado.
  - **O que faria você dizer que deu errado, mesmo funcionando?**
  - O que ficou de fora vira etapa seguinte, não some.
- **Rodada 3, só se precisar:** o que muda para quem usa nos pontos sensíveis (o cliente precisa de conta? quem cancela e até quando? que dados pessoais entram? como paga?). Use `sondas.md`. O login de quem administra e a forma técnica de guardar os dados são decisões suas: vão em "Decidi sozinho".

**Decida sozinho e liste no resumo:** linguagem, framework, banco, hospedagem e nomes. Se o dono já usa algo (outro projeto, uma preferência que ele citou), siga. Não pergunte de tecnologia para quem não programa.

## 3. Resumo para aprovar (até 10 linhas, uma por campo)

```
**<Nome do produto>**
Para: <quem usa> · Dor: <o problema, em uma frase>
Momento principal: <o que a pessoa faz e o que ganha>
Primeira versão (etapa 1): <2 a 5 itens>
Pronto quando (etapa 1): <critério 1>; <critério 2>
Depois: etapa 2 <nome> · etapa 3 <nome> …
Fora por enquanto: <o que não entra em nenhuma etapa agora>
Partes do sistema: <as telas e o que fica guardado, em palavras simples, numa linha>
Decidi sozinho: <stack e escolhas técnicas numa linha, com o nome entre parênteses: "guardado na nuvem (Supabase)">  (diga se quiser mudar algo)
```

Pergunte: **"Algo errado ou faltando? Posso registrar?"** e ofereça a arquitetura numa linha: "Se quiser, também desenho a arquitetura, para ver no painel (gasta mais tokens que o normal)."

## 4. Grave no Faundr

Nesta ordem:

1. **Etapa 1:** `faundr feature "<etapa 1>" --desc "…" --done-when "…; …"` e logo depois um `faundr task "<passo>"` por passo (as tarefas vão para a funcionalidade atual, que é a etapa 1).
2. **Etapas seguintes:** `faundr feature "<etapa 2>" --after atual --desc "…"`, depois `--after "<etapa 2>"` e assim por diante. Elas ficam planejadas e não trocam a atual.
3. **Decisões do dono** e o que ficou de fora: `faundr decision "…" --why "…" --global`. As escolhas de stack que você fez sozinho também, com `--why "Decidi sozinho: <motivo>"`, porque vão guiar todo o código.
4. **Visão:** escreva `.faundr/painel/overview.json` e rode `faundr overview-save`. No começo do projeto não há código, então `evidence` é `[]` em todo item:

```json
{
  "version": 1,
  "summary": { "what": "o que é, em 1 a 3 frases", "for_whom": "quem usa", "problem": "a dor, com as palavras do dono" },
  "how_it_works": [{ "title": "passo do momento principal", "detail": "o que a pessoa faz e vê", "evidence": [] }],
  "parts": [{ "name": "nome simples", "what": "o que faz para a pessoa", "status": "planejado", "kind": "tela | api | servidor | dados | integracao | outro", "evidence": [] }],
  "progress": { "done": [], "in_progress": [], "next": ["<nome da etapa 1>", "<nome da etapa 2>"] },
  "decisions": [{ "title": "a decisão", "why": "o porquê", "evidence": [] }],
  "how_to_use": [],
  "glossary": [],
  "open_questions": ["o que ficou em aberto"]
}
```

   `how_it_works`: o momento principal em 3 a 5 passos; `parts`: de 3 a 10; `progress.next`: os nomes das etapas, exatamente como foram registrados.
5. **Arquitetura**, se o dono quiser: leia `${CLAUDE_PLUGIN_ROOT}/skills/planning/diagrama.md` e use o mesmo formato, com estas diferenças:
   - raias = camadas: `Quem usa`, `Telas`, `Servidor`, `Dados`, `Serviços de fora` (só as que existem);
   - peças = as partes do sistema (as mesmas da Visão), e o `mainPath` é o momento principal passando por elas;
   - partes de etapas futuras entram com `sublabel` "etapa N", para o dono ver o caminho todo;
   - cada peça que vira código ganha `paths` com as pastas ou arquivos planejados na stack que você escolheu (ex.: `"src/routes/agenda/**"`). Assim o painel mostra sozinho, a cada sessão, o que já foi construído e o que ainda é plano. Quando construir algo num lugar diferente do planejado, atualize os `paths` e envie de novo;
   - envie com `faundr diagram-save --architecture`. Aparece em Visão → Arquitetura.
6. Mostre `faundr board` e diga onde ver: Visão (resumo e partes), Funcionalidades (as etapas) e, se desenhou, Visão → Arquitetura. Pergunte se pode começar pela etapa 1.
