---
name: overview
description: Escreve ou atualiza a "Visão do projeto" no Faundr — o resumo brutalmente claro do que está sendo construído (o que é, para quem, como funciona, partes, onde estamos, decisões, como usar). Use quando o usuário pedir, quando o Faundr avisar no início da sessão que a Visão está desatualizada, ou depois de concluir uma funcionalidade importante num projeto ligado ao Faundr.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## 1. Leia o contexto do projeto

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" overview-context`

Se precisar confirmar algo (por exemplo, o que um comando faz de verdade), leia o arquivo de evidência indicado. Não invente: tudo o que você escrever tem que estar sustentado pelo contexto acima ou pelos arquivos.

## 2. Escreva a Visão para alguém que NÃO programa

Quem vai ler é o dono do projeto, que pode não entender o próprio código. Regras:
- Português simples, frases curtas. Nada de jargão sem explicar (se usar "API", "hook", "grafo", explique no glossário).
- Diga **o que a coisa faz para a pessoa**, não como está implementada.
- Seja específico: nomes reais das telas, comandos e funcionalidades deste projeto.
- Se já existe uma Visão anterior, **atualize-a**: mantenha o que continua verdadeiro, corrija o que mudou, mova itens entre "em andamento" e "pronto".
- Coloque em `evidence` os caminhos de arquivo que comprovam cada item (1 a 4 por item).

## 3. Formato (JSON) — salve em `.faundr/overview.json`

```json
{
  "version": 1,
  "summary": {
    "what": "1 a 3 frases: o que é o projeto",
    "for_whom": "para quem é",
    "problem": "que problema resolve"
  },
  "how_it_works": [
    { "title": "passo curto", "detail": "1-2 frases do que acontece", "evidence": ["caminho/arquivo"] }
  ],
  "parts": [
    {
      "name": "nome humano da parte (ex.: Painel, Plugin do Claude Code)",
      "what": "o que ela faz para o usuário",
      "status": "pronto | em_andamento | planejado",
      "kind": "tela | api | servidor | dados | plugin | motor | integracao | outro",
      "evidence": ["caminho/arquivo"]
    }
  ],
  "progress": { "done": ["..."], "in_progress": ["..."], "next": ["..."] },
  "decisions": [{ "title": "decisão", "why": "porquê", "evidence": ["..."] }],
  "how_to_use": [{ "title": "o que a pessoa quer fazer", "detail": "como fazer, passo a passo curto", "command": "/comando se houver" }],
  "glossary": [{ "term": "termo técnico", "meaning": "explicação simples" }],
  "open_questions": ["dúvidas reais que o projeto ainda não respondeu"]
}
```

Preocupações abertas registradas no Faundr entram em `open_questions`. Tamanhos: `how_it_works` 3–6 passos; `parts` 3–10; `decisions` as 3–8 mais importantes; `how_to_use` cobre **todos** os comandos/fluxos que o usuário tem à disposição (explique cada um; máximo 40); `glossary` só termos que aparecem no texto (máximo 30). Listas acima do limite são recusadas no envio.

## 4. Envie

Salve o arquivo com a ferramenta Write em `.faundr/overview.json` (na raiz do projeto ligado) e rode:

`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" overview-save`

Se a resposta apontar campos faltando, corrija o JSON e rode de novo. No fim, diga em uma frase que a Visão foi atualizada e o que mudou em relação à anterior.
