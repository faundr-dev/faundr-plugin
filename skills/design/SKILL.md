---
name: design
description: Takes care of the project's design in Faundr — creates the design.md (the guide that standardizes colors, fonts and components) when it doesn't exist and audits the screens against it (screen off the standard, component rebuilt instead of reused, visual bug like a clipped or overlapping menu). Use when the user asks, when Faundr says the project has no design.md, or when Faundr asks for the quick audit at the end of the response.
argument-hint: '"[--files a.tsx,b.tsx]  (no argument: full audit)"'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## Design context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" design-context $ARGUMENTS`

The "Mode" (`Modo`) above says what to do: **full** (`completo`: the user called the skill) or **quick** (`rápido`: Faundr asked at the end of the response, only for the listed files).

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it's not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

## 1. No design.md? Create it first (full mode only)

The design.md is the rule for the screens: without it there's nothing to audit against. The design belongs to the user: **never write the design.md without asking**.

**1a. Survey what already exists.** Read the global styles, the tokens and the screens from the context above and put together a proposal: reference screen, colors, fonts, shape (radii, cuts, borders), light/dark theme, ready-made components.

**1b. Ask (use the ask-the-user tool, up to 4 questions in one round).** Each question brings your proposal taken from the code as the first option ("(Recommended)") and real alternatives. Cover:
- **Reference:** which screen represents the look they want (list the candidates).
- **Colors:** the palette found (cite the hex values), whether it's this one, whether an accent color is missing or they want another.
- **Typography:** the fonts found in headings and body text.
- **Personality:** 2–3 adjectives for the look (e.g. sober/technical, light/friendly) and whether there's a signature mark (a cut, a stroke, a shape) that should repeat.
- **Scope** (in a second round, if needed): does it need to work on phones (yes / computer only / built for phones)? Product type (app or dashboard / site or landing page / both)? Theme (dark / light / both)? Motion (no animation / sober / expressive)? Save the answers with `faundr design-scope --mobile … --product … --theme … --motion …`.
If the user already said any of this in this conversation, don't ask again: use it and cite it. If they answer "Other", follow what they wrote.

**1c. Write `DESIGN.md` at the root** with the answers and the exact values from the code (write the prose in the project's content language, shown in the Faundr context):
- Sections: **Principles** (3–5 sentences: what the look communicates), **Colors** (each token with name, hex value and use; no color outside this list), **Typography** (fonts, weights, heading/body sizes), **Spacing and shape** (radii, borders, cuts, shadows), **Components** (what already exists and must be reused, with the file path and when to use each variant), **Screen patterns** (page structure, empty/loading/error states, menus and modals), **Motion** (the project's curves and durations — if there are none, propose the quality floor ones: exit `cubic-bezier(0.23, 1, 0.32, 1)`, button 100–160 ms, menu 150–250 ms, modal 200–300 ms —, what doesn't animate because it's used all the time, and "respects reduced motion"), **Scope and exceptions** (the scope answers and the decided exceptions, "technique — reason", e.g. "Lucide icons only — brand choice"), **Don't** (concrete mistakes to avoid; always include: disabling phone zoom, removing the focus outline without a replacement, clickable `div` instead of a button, `transition-all`, blocking paste in fields).
- Write the values exactly as they are in the code (e.g. `@theme` tokens, `styles.css` classes), so the automatic check recognizes the palette.
- At the top, one line saying where each decision came from (e.g. "colors and fonts: tokens from src/styles.css, confirmed by the user on 09/29").
- Then run `faundr design-lint` so the dashboard knows the design.md exists, and show the user a summary of what was decided.

## 2. Audit

Read the **quality floor** (path in the context): it holds the numbers and the list of what to reject that apply to every screen.

**Quick mode:** read only the listed files and compare with the design.md and the floor. Fix right away whatever is simple (color outside the palette, style that already exists as a component). Record what can't be fixed now. Don't open the browser.

**Before anything, read the design scope ("Escopo do design") and the archived findings ("Achados arquivados") in the context.** What the owner turned off or archived doesn't apply to this project: don't record it again. Scope "computer only" = don't look for responsiveness problems. A decided exception in the design.md ("technique — reason") is not a problem. If the design.md asks for something that breaks an objective rule (e.g. a light gray that fails contrast), don't fix it or ignore it silently: record it and ask the owner whether to keep it.

**Full mode:** go through every screen and component. **Form your opinion by looking at the screens and the code before reading the automatic check's list**; then compare: say where you agree, what only the check caught and which of its findings are false alarms (archive those with the evidence). Besides the checklist below, on each screen ask: what decision or task does the person do here, and does the screen help with it (a generic dashboard of cards and a chart with no question in the title is a finding)? Look, by type (`--kind`, and the rule `--rule theme/name`), for:
- **Responsive** (`responsive`, theme `responsivo`) — if the scope asks for phones: what happens below 768 px in each multi-column component (it must be solved in the component itself); forgotten range between 600 and 1024 px; large fixed widths; `h-screen`/`100vh` (use `dvh`); field with font < 16 px (the iPhone zooms); actions that only appear on hover; tables and charts on a narrow screen; phone navigation; fixed bar covering content; touch targets < 44 px. Point to **component and screen**.
- **Accessibility** (`a11y`, theme `acessibilidade`): focus outline removed without a replacement; icon-only button without `aria-label`; clickable `div` without keyboard support; image without `alt`; field with only a placeholder (no label); text contrast < 4.5:1 (3:1 for large text, icons and borders); status shown only by color; modal that doesn't trap or return focus; errors and toasts without `aria-live`; phone zoom disabled; animation without `prefers-reduced-motion`.
- **Motion** (`motion`, theme `movimento`): what's used many times a day or by keyboard (shortcuts, command palette, navigation, list hover) shouldn't animate; interface animation over 300 ms (modal/drawer up to 500, toast up to 400); `ease-in` on interface; `transition-all`; animating width, height or position (except accordion); entering from `scale(0)`; animation without purpose.
- **Content and states** (`content`, theme `conteudo`): screen that fetches data without loading/empty/error; empty state that doesn't say why or what to do; error without what to do; made-up or filler data ("John Doe", sample numbers); buttons with the same intent and different labels; vague labels ("Click here", "OK"); "..." instead of "…".
- **App identity** (`identity`, theme `identidade`): favicon and iPhone icon (apple-touch-icon), forgotten default title ("Vite + React"), page description, share image, `lang` on `<html>`, `meta viewport`, `theme-color`.
- **Off design** (`off_spec`, theme `design`): colors, fonts, radii, spacing or screen patterns different from the design.md. A whole screen off the standard is **one** finding (not one per line).
- **Repetition** (`duplicate`, theme `repeticao`): the same element (button, card, field, menu) rebuilt in several places instead of a reusable component.
- **Visual bug** (`visual`, theme `visual`): menu or tooltip clipped by the parent's `overflow`, wrong z-index, off-center modal, overflowing text, overlap.
- **Good practice** (`practice`, theme `pratica`): missing base component (Button, Input, Card…), dead control (`href="#"`), `alert()` for errors.

If the development server is up (address in the context), **use the browser** (Claude in Chrome) in full mode only, and **measure instead of just looking**:

1. List the main screens (app routes) and give each a short name ("Projects", "Design → Problems"…). Always use the same name for the same screen: that's how Faundr tracks the screen across audits.
2. For each screen, measure at widths **375, 768, 1024 and 1440 px** (only 1024 and 1440 if the scope is "computer only"), without resizing the window: generate the script with `faundr design-measure-script --url "<full screen URL, e.g. http://localhost:3000/projetos>" --widths 375,768,1024,1440` and run it with `javascript_tool` in a tab open on the same site, with `await` in front. It opens the screen in an invisible iframe at each width (the login carries over, it's the same site), measures and returns a short summary; the full result stays in `window.__faundrMedicao`. For each measurement `i`, take `JSON.stringify(window.__faundrMedicao[i])`, save it to a temporary file and record it: `faundr design-measure-save --screen "<screen>" --file <file.json>`.
   **Two themes:** when the scope is "light and dark" (or it wasn't filled in and the code has both), the script forces each theme: the main one at the requested widths and the other only at the smallest and largest. The script's first line states the plan; each measurement carries its `tema` and the CLI tags the finding with it. If the script says "não consegui pôr a tela no tema…" (couldn't put the screen in the theme), the screen doesn't switch themes the usual ways (`data-theme` attribute, `dark`/`light` class, `prefers-color-scheme`): tell the user instead of forcing the measurement. If the first line suggests filling in the scope, ask the owner whether the app really has both themes and save the answer with `faundr design-scope --theme …`. (To measure the window as it is, without --url, the script returns a single measurement; then pass `--width`.) The CLI creates one finding per screen, width and rule — sideways scrolling and what goes past the edge, touch targets < 44 px, clipped text, real contrast, text < 12 px, slow transitions, text stuck to the edge — and resolves on its own what disappeared since the previous measurement: don't record those again with design-finding.
3. At 1440 px, open each menu, dropdown and modal and take a screenshot: anything clipped, hidden or overlapping becomes a `visual` finding. With two themes, also take a screenshot of each main screen in the second theme: a logo, icon or image that vanishes into the background, or a border that disappears, becomes a `visual` finding with `--rule visual/some-no-tema`.
4. **Keyboard** (one screen of each type): press Tab a few times and check in the screenshot that focus shows and follows the visual order; open a modal and see whether Esc closes it and focus returns. Problems become `a11y` findings.
5. Say in the summary what only a real device confirms (sticky hover, phone keyboard, safe areas) — browser emulation doesn't reproduce that.

In the coverage, what was measured this way is `--how navegador`. If the server isn't up, audit from the code only, mark responsive and visual as `parcial` and say so in the summary.

The automatic check (no AI) has already recorded the findings listed in the context — don't record them again; confirm or discard them in your analysis.

**Archive (it's not resolving).** When an open finding doesn't apply to this project — a false alarm you proved, or it contradicts a decision recorded in the scope/design.md — archive it with the evidence: `faundr design-archive D-<n> --reason false-alarm|not-applicable|design-decision --note "<who decided and why>"`, and tell the user in the response. When in doubt, ask in one sentence instead of archiving. Never archive to "get past" a real problem.

**One-off exception in the code.** When a piece of code breaks an automatic rule on purpose (e.g. a canvas with a fixed width), you can mark it in the code itself, on the line above: `// faundr-ignore <rule>: <reason>` (or `{/* faundr-ignore <rule>: <reason> */}` inside JSX; `faundr-ignore-file <rule>: <reason>` applies to the whole file). Use it only with a real reason and tell the user; for "doesn't apply to the whole project", prefer turning the rule off in the scope.

## 3. Record in Faundr

One command per real problem (no guessing; point to file and line):

`faundr design-finding "<short title, the problem>" --kind <type> --rule <theme>/<short-name> --severity high|medium|low --file <path> --line <n> --detail "<what's wrong, why it matters and how to fix it, in plain language>"`

Write the title and detail in the project's content language (Faundr shows it in the context).

- `--rule`: the type's theme + a short lowercase hyphenated name, reusing the same name for the same problem (e.g. `responsivo/grid-sem-celular`, `responsivo/largura-fixa`, `acessibilidade/foco-removido`, `movimento/duracao-longa`, `conteudo/sem-estado-vazio`, `identidade/sem-favicon`). It's how the owner archives or turns off a whole rule.
- **Severity by the yardstick, not by impression:** `high` = blocks the task, fails basic accessibility (text contrast, invisible focus, zoom disabled, button without a name) or breaks on phones (horizontal scrolling, unreachable content), or a whole screen off the standard; `medium` = visible error that has a workaround; `low` = polish and consistency. Tiebreaker: "would the person open a support ticket because of this?" → at least `medium`.
- If the command answers "regra desligada" (rule turned off) or "was already archived", don't insist.
- Previous findings you checked that are already fixed: `faundr design-resolve D-<n>`.

**Full mode only — record the coverage**, one command per theme, so the owner sees what was checked (not just what failed):

`faundr design-coverage --theme <theme> --result passou|falhou|parcial|nao-verificado --how codigo|navegador|aparelho --score <0-4> --note "<in one sentence: what you looked at and what you found>"`

Themes: `responsivo`, `acessibilidade`, `movimento`, `conteudo`, `identidade`, `design` (consistency with the design.md), `visual`. Theme turned off in the scope: `nao-verificado` with the note "turned off in the scope". Score: 4 = nothing to fix; 3 = polish only; 2 = visible problems with a workaround; 1 = something blocks use or fails basic accessibility; 0 = theme broken on almost every screen. Be honest: what you couldn't check (e.g. phone without a browser) is `parcial` or `nao-verificado`, never `passou`. At the end, close the audit with `faundr design-coverage --finish` (it stores the scores for the trend on the dashboard).

## 4. Answer

Short summary for the user, in plain language and in the user's language: whether you created the design.md, how many findings per type, the 3 most important (with D-n), what you archived (with the reason) and what you suggest doing first. In full mode, also show a short table per theme — **Theme | Result | Score | How checked** — and what couldn't be checked. When offering fixes, follow the order: (1) what breaks use or accessibility; (2) missing states; (3) responsive and flow; (4) deviation from the design.md; (5) polish — and say everything can be fixed in that order with `/faundr:design-fix` (no number) or one at a time with `/faundr:design-fix D-<n>`. In full mode **don't go fixing everything**: offer to fix. The findings appear in the project's Design section on the dashboard.
