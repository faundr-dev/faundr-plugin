---
name: design-showcase
description: Gera ou atualiza a Vitrine do design no Faundr — réplicas visuais dos componentes do projeto (botões, campos, cards, menus, etiquetas…) com as variantes lado a lado, lidas do design.md e do código de cada componente. Aparecem em Design → Vitrine no painel. Use quando o usuário pedir, ou quando o painel mostrar réplicas desatualizadas.
argument-hint: "[nome do componente]  (sem argumento: todos os desatualizados e os que faltam)"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## Contexto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" showcase-context`

Use a CLI com a ferramenta Bash, sempre com aspas: `faundr ...` (se não estiver no PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

## O que é

Cada réplica é HTML estático que reproduz o visual de um componente, desenhado pelo painel num quadro isolado com o CSS e as fontes do próprio projeto. Não é o componente rodando: é uma cópia fiel, feita por você lendo o código. Por isso precisa ser **fiel**: as mesmas classes, a mesma estrutura, os mesmos textos típicos.

## 1. Escolha os componentes

- Com design.md: todos da tabela de componentes (exceto moldura de página inteira, como AppShell — no máximo uma versão reduzida).
- Sem design.md: os componentes reutilizados em várias telas (botões, campos, cards, menus, etiquetas, modais, avisos). Sugira criar o design.md com /faundr:design.
- Com argumento: só aquele componente. Sem argumento e com vitrine existente: só os que não estão "atual" no contexto, mais os que faltam. Mantenha as outras réplicas como estão no arquivo.

## 2. Leia o código de cada um

Abra o arquivo do componente (e o CSS da classe, quando for classe global) antes de escrever. Nunca replique pelo nome: pegue as classes e a estrutura reais.

## 3. Escreva `.faundr/showcase.json`

```json
{
  "version": 1,
  "components": [
    {
      "name": "Botão principal (.f-btn)",
      "file": "src/styles.css",
      "files": ["src/styles.css"],
      "group": "Botões",
      "usage": "Ação principal da tela (uma por área).",
      "background": "#151515",
      "width": 480,
      "variants": [
        { "name": "Padrão", "html": "<button class=\"f-btn\">Novo projeto</button>" },
        { "name": "Com ícone", "html": "<button class=\"f-btn\"><svg …></svg>Novo projeto</button>" },
        { "name": "Desabilitado", "html": "<button class=\"f-btn\" disabled>Novo projeto</button>" }
      ]
    }
  ]
}
```

- `file`: o arquivo principal do componente; `files`: todos os arquivos cujo visual a réplica copia (o componente e o CSS das classes). **É por eles que o Faundr marca a réplica como desatualizada quando o código muda**; não esqueça o CSS.
- `group`: agrupa no canvas (Botões, Campos, Cards, Navegação, Etiquetas, Feedback, Modais, Outros).
- `usage`: quando usar, em português simples (do design.md).
- `background`: fundo onde o componente aparece de verdade (ex.: o fundo das telas escuras). Sem ele, vale o fundo do `body` do projeto.
- `width`: largura do quadro em px (200–1400; padrão 480). Use mais para cards e cabeçalhos.
- `variants`: 1 a 8 estados lado a lado: padrão, com ícone, tamanhos, ativo, desabilitado, vazio, com conteúdo longo… Para hover/foco, escreva a variante com as classes do estado já aplicadas (ex.: `bg-neutral-200` no lugar de `hover:bg-neutral-200`) e diga no nome ("Ao passar o mouse").

Regras do HTML:
- Use `class` (não `className`) e as classes exatas do código; siga o que o contexto diz sobre o CSS (Tailwind 4, 3 ou CSS puro).
- Componente React: escreva o HTML que ele renderiza, com props de exemplo realistas (textos do próprio app, não "Lorem ipsum").
- Ícones: SVG embutido com os mesmos traços do ícone original (ex.: Lucide: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"` e os paths do ícone).
- Sem `<script>`, sem imagens externas (use um bloco de cor no lugar de foto) e sem depender de dados reais do usuário.
- Menus, dropdowns e modais: desenhe-os já abertos, em posição normal (sem `fixed`), dentro da largura do quadro.

## 4. Envie

`faundr showcase-save`

A CLI confere o formato, carimba a impressão digital de cada componente, junta o CSS e as fontes do projeto e envia. Se apontar problemas, corrija e rode de novo.

## 5. Responda

Uma ou duas frases: quantas réplicas criou ou atualizou e onde ver (Design → Vitrine no painel). Se algum componente não deu para replicar com fidelidade (depende de dados, canvas, animação), diga qual e por quê.
