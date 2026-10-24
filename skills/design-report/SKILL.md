---
description: 'Records in Faundr a design problem the user saw (e.g. "the list menu opens hidden"). It becomes a D-n finding in the Design section of the dashboard.'
argument-hint: '<what you saw and where>'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Problem reported by the user: $ARGUMENTS

1. Find where it is in the code: look for the screen/component mentioned (use `faundr graph-query "<screen>"` if the project has a graph, or search for the text that appears on screen). If you cannot tell which screen it is, ask the user in one sentence.
2. Classify:
   - `visual`: something broken on screen (cut off, hidden, overlapping, off-center, overflowing).
   - `responsive`: breaks on mobile or smaller screens (goes past the edge, does not fit, hard to tap).
   - `a11y`: accessibility (low contrast, invisible focus, button without a name for screen readers).
   - `off_spec`: different from design.md (color, font, shape, screen off the standard).
   - `duplicate`: the same element recreated instead of reusing a component.
   - `motion`: animation that is slow, odd or too much.
   - `content`: screen text, empty/loading/error states missing or bad.
   - `identity`: tab icon (favicon), page title, description, sharing image.
   - `practice`: something that should exist is missing (base component, control that does nothing).
   Severity: `high` if it prevents use, fails basic accessibility or breaks on mobile; `medium` if it is a visible error with a workaround; `low` if it is a detail.
   Rule: the type's theme + short name (e.g. `responsivo/largura-fixa`, `identidade/sem-favicon`).
3. Record it with the Bash tool, without changing the meaning of what the user said; in `--detail`, what they saw + the likely cause you found in the code (write it in the user's language):
   `faundr design-finding "<short title>" --kind <type> --rule <theme/name> --severity <severity> --file <path> --line <n> --detail "<details>" --manual`

Confirm in one sentence with the D-n number and say it can be fixed with `/faundr:design-fix D-<n>`. Do not start fixing now.
