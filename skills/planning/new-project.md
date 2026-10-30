# Project start

Use when the owner describes a whole product ("I want to build an app for…") or the linked project has no code and no features yet. The goal is to leave the conversation with four things on the dashboard: the **Project overview** (what it is, who it's for, the planned parts), the **stages** (the first version and what comes after), the owner's **decisions** and, if they want, the drawn **architecture**. No plan file in the project. Write everything in the project's content language (Faundr shows it in the context).

Steps 2, 4 and 5 of the skill still apply (look before asking, short rounds with a recommendation, vague answers don't pass). What changes is the subject of the questions and what comes out at the end.

## 1. Look at what already exists

Empty folder or just a framework skeleton? Say in a single line the size and what's coming, ending with the way out: "New project: I'll define the Project overview, the stages and the decisions with you before building. If you prefer, I'll just start." If there's already code, the project isn't new: use `/faundr:inventory` to record what exists and go back to normal planning.

## 2. Product questions (at most 3 rounds)

Take the options from the owner's description and always recommend. About what matters for the product, not the technology:

- **Round 1, the essentials:**
  - **Who uses it and what's the pain**, only if the request truly allows two readings (e.g. only the owner books, or the customer books too?). If they already said it, don't ask again.
  - **The key moment:** what the person does the first time they open it and what makes them come back (it's the main path of the architecture).
  - **Where it's used:** phone, computer or both.
  - **How the project pays for itself**, only if they mentioned selling, charging or advertising.
- **Round 2, the first version:**
  - **What goes into the first version** (multiple choice with the capabilities that came up; recommend the smallest one that already solves the pain).
  - **If it were only half, what stays?**, only if they picked more than the recommended.
  - **What would make you say it went wrong, even if it works?**
  - What was left out becomes a following stage, it doesn't disappear.
- **Round 3, only if needed:** what changes for the user at the sensitive points (does the customer need an account? who cancels and until when? what personal data goes in? how do they pay?). Use `probes.md`. The admin's login and the technical way of storing data are your decisions: they go under "Decided on my own".

**Decide on your own and list in the summary:** language, framework, database, hosting and names. If the owner already uses something (another project, a preference they mentioned), follow it. Don't ask people who don't code about technology.

## 3. Summary for approval (up to 10 lines, one per field)

```
**<Product name>**
For: <who uses it> · Pain: <the problem, in one sentence>
Key moment: <what the person does and what they get>
First version (stage 1): <2 to 5 items>
Done when (stage 1): <criterion 1>; <criterion 2>
Later: stage 2 <name> · stage 3 <name> …
Out for now: <what doesn't go into any stage right now>
System parts: <the screens and what gets stored, in simple words, on one line>
Decided on my own: <stack and technical choices on one line, with the name in parentheses: "stored in the cloud (Supabase)">  (say if you want to change anything)
```

Ask: **"Anything wrong or missing? Can I record it?"** and offer the architecture in one line: "If you want, I can also draw the architecture, to see on the dashboard (uses more tokens than usual)."

## 4. Save to Faundr

In this order:

1. **Stage 1:** `faundr feature "<stage 1>" --desc "…" --done-when "…; …"` and right after, one `faundr task "<step>"` per step (the tasks go to the current feature, which is stage 1).
2. **Following stages:** `faundr feature "<stage 2>" --after current --desc "…"`, then `--after "<stage 2>"` and so on. They stay planned and don't replace the current one. A stage that does not depend on the one before it goes after the stage it really needs (often stage 1): stages with the same previous one can later be built at the same time with `/faundr:parallel`.
3. **Owner decisions** and what was left out: `faundr decision "…" --why "…" --global`. The stack choices you made on your own too, with `--why "Decided on my own: <reason>"`, because they'll guide all the code.
4. **Project overview:** write `.faundr/painel/overview.json` and run `faundr overview-save`. At the start of the project there's no code, so `evidence` is `[]` on every item:

```json
{
  "version": 1,
  "summary": { "what": "what it is, in 1 to 3 sentences", "for_whom": "who uses it", "problem": "the pain, in the owner's words" },
  "how_it_works": [{ "title": "step of the key moment", "detail": "what the person does and sees", "evidence": [] }],
  "parts": [{ "name": "simple name", "what": "what it does for the person", "status": "planejado", "kind": "tela | api | servidor | dados | integracao | outro", "evidence": [] }],
  "progress": { "done": [], "in_progress": [], "next": ["<stage 1 name>", "<stage 2 name>"] },
  "decisions": [{ "title": "the decision", "why": "the why", "evidence": [] }],
  "how_to_use": [],
  "glossary": [],
  "open_questions": ["what was left open"]
}
```

   `how_it_works`: the key moment in 3 to 5 steps; `parts`: 3 to 10; `progress.next`: the stage names, exactly as they were recorded.
5. **Architecture**, if the owner wants it: read `${CLAUDE_PLUGIN_ROOT}/skills/planning/diagram.md` and use the same format, with these differences:
   - lanes = layers: `Who uses it`, `Screens`, `Server`, `Data`, `Outside services` (only the ones that exist);
   - pieces = the system parts (the same as in the Project overview), and the `mainPath` is the key moment going through them;
   - parts from future stages go in with `sublabel` "stage N", so the owner sees the whole path;
   - each piece that becomes code gets `paths` with the folders or files planned in the stack you chose (e.g. `"src/routes/agenda/**"`). That way the dashboard shows on its own, each session, what has already been built and what is still a plan. When you build something somewhere other than planned, update the `paths` and send again;
   - send with `faundr diagram-save --architecture`. It appears on the dashboard, in Architecture (project menu).
6. Show `faundr board` and say where to look: Project overview (summary and parts), Features (the stages) and, if you drew it, Architecture (project menu). Ask whether you can start with stage 1.
