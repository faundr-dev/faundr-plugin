---
name: design-showcase
description: Generates or updates the design Showcase in Faundr — visual replicas of the project's components (buttons, fields, cards, menus, tags…) with the variants side by side, read from design.md and from each component's code. They appear under Design → Showcase in the dashboard. Use when the user asks, or when the dashboard shows outdated replicas.
argument-hint: '"[component name]  (no argument: all outdated and missing ones)"'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

## Context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" showcase-context`

Use the CLI with the Bash tool, always with quotes: `faundr ...` (if it is not on the PATH, `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" ...`).

## What it is

Each replica is static HTML that reproduces a component's look, drawn by the dashboard in an isolated frame with the project's own CSS and fonts. It is not the component running: it is a faithful copy, made by you reading the code. That is why it needs to be **faithful**: the same classes, the same structure, the same typical texts.

## 1. Choose the components

- With design.md: all of the components table (except whole-page frames, like AppShell — at most a reduced version).
- Without design.md: the components reused across several screens (buttons, fields, cards, menus, tags, modals, notices). Suggest creating design.md with /faundr:design.
- With an argument: only that component. Without an argument and with an existing showcase: only the ones that are not "atual" (up to date) in the context, plus the missing ones. Keep the other replicas as they are in the file.

## 2. Read each one's code

Open the component's file (and the class's CSS, when it is a global class) before writing. Never replicate by name: take the real classes and structure.

## 3. Write `.faundr/painel/showcase.json`

```json
{
  "version": 1,
  "components": [
    {
      "name": "Primary button (.f-btn)",
      "file": "src/styles.css",
      "files": ["src/styles.css"],
      "group": "Buttons",
      "usage": "The screen's main action (one per area).",
      "background": "#151515",
      "width": 480,
      "variants": [
        { "name": "Default", "html": "<button class=\"f-btn\">New project</button>" },
        { "name": "With icon", "html": "<button class=\"f-btn\"><svg …></svg>New project</button>" },
        { "name": "Disabled", "html": "<button class=\"f-btn\" disabled>New project</button>" }
      ]
    }
  ]
}
```

- `file`: the component's main file; `files`: all the files whose look the replica copies (the component and the classes' CSS). **These are what Faundr uses to mark the replica as outdated when the code changes**; do not forget the CSS.
- `group`: groups on the canvas (Buttons, Fields, Cards, Navigation, Tags, Feedback, Modals, Other).
- `usage`: when to use it, in plain language, in the user's language (from design.md).
- `background`: the background where the component really appears (e.g. the background of the dark screens). Without it, the project's `body` background applies.
- `width`: frame width in px (200–1400; default 480). Use more for cards and headers.
- `variants`: 1 to 8 states side by side: default, with icon, sizes, active, disabled, empty, with long content… For hover/focus, write the variant with the state classes already applied (e.g. `bg-neutral-200` instead of `hover:bg-neutral-200`) and say so in the name ("On hover").

HTML rules:
- Use `class` (not `className`) and the exact classes from the code; follow what the context says about the CSS (Tailwind 4, 3 or plain CSS).
- React component: write the HTML it renders, with realistic example props (texts from the app itself, not "Lorem ipsum").
- Icons: inline SVG with the same strokes as the original icon (e.g. Lucide: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"` and the icon's paths).
- No `<script>`, no external images (use a color block in place of a photo) and no dependence on real user data.
- Menus, dropdowns and modals: draw them already open, in normal position (no `fixed`), within the frame width.

## 4. Send

`faundr showcase-save`

The CLI checks the format, stamps each component's fingerprint, bundles the project's CSS and fonts and sends it. If it points out problems, fix them and run it again.

## 5. Answer

One or two sentences: how many replicas you created or updated and where to see them (Design → Showcase in the dashboard). If some component could not be replicated faithfully (depends on data, canvas, animation), say which and why.
