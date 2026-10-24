---
name: overview
description: Writes or updates the "Project overview" in Faundr — the brutally clear summary of what is being built (what it is, for whom, how it works, parts, where we are, decisions, how to use it). Use when the user asks, when Faundr warns at the start of the session that the Overview is outdated, or after finishing an important feature in a project linked to Faundr.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## 1. Read the project context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" overview-context`

If you need to confirm something (for example, what a command really does), read the indicated evidence file. Do not make things up: everything you write must be backed by the context above or by the files.

## 2. Write the Overview for someone who does NOT code

The reader is the project owner, who may not understand their own code. Rules:
- Plain language, in the project's content language (Faundr shows it in the context), short sentences. No unexplained jargon (if you use "API", "hook", "graph", explain it in the glossary).
- Say **what the thing does for the person**, not how it is implemented.
- Be specific: real names of this project's screens, commands and features.
- If a previous Overview exists, **update it**: keep what is still true and fix what changed.
- Put in `evidence` the file paths that prove each item (1 to 4 per item).

## 3. Format (JSON) — save to `.faundr/painel/overview.json`

```json
{
  "version": 1,
  "summary": {
    "what": "1 to 3 sentences: what the project is",
    "for_whom": "who it is for",
    "problem": "what problem it solves"
  },
  "how_it_works": [
    { "title": "short step", "detail": "1-2 sentences on what happens", "evidence": ["path/file"] }
  ],
  "parts": [
    {
      "name": "human name of the part (e.g. Dashboard, Claude Code plugin)",
      "what": "what it does for the user",
      "status": "pronto | em_andamento | planejado",
      "kind": "tela | api | servidor | dados | plugin | motor | integracao | outro",
      "evidence": ["path/file"]
    }
  ],
  "progress": { "done": ["what has already been delivered, each item confirmed in the commits or on the board"], "in_progress": [], "next": [] },
  "decisions": [{ "title": "decision", "why": "why", "evidence": ["..."] }],
  "how_to_use": [{ "title": "what the person wants to do", "detail": "how to do it, short step by step", "command": "/command if there is one" }],
  "glossary": [{ "term": "technical term", "meaning": "simple explanation" }],
  "open_questions": ["real questions the project has not answered yet"]
}
```

`progress.in_progress` and `progress.next` stay **empty**: the dashboard reads what is in progress and the next stages straight from the Features board, live (text written here would go stale). If the board has things already done that are still open, suggest the owner run `/faundr:tidy-board`. Open concerns recorded in Faundr go into `open_questions`. Sizes: `how_it_works` 3–6 steps; `parts` 3–10; `decisions` the 3–8 most important; `how_to_use` covers **all** the commands/flows the user has available (explain each one; at most 40); `glossary` only terms that appear in the text (at most 30). Lists over the limit are rejected on send.

## 4. Send

Save the file with the Write tool to `.faundr/painel/overview.json` (at the root of the linked project) and run:

`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" overview-save`

If the response points out missing fields, fix the JSON and run it again. At the end, say in one sentence that the Overview was updated and what changed compared to the previous one.
