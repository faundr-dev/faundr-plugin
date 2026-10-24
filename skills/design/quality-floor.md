# Interface quality floor (Faundr)

The minimum every screen must meet, in any project. Read it before creating or changing a screen and before fixing a design finding. **The project's design.md rules**: when it decides something else (section "Scope and exceptions"), follow the design.md. The numbers come from WCAG 2.2, web-interface-guidelines (Vercel), impeccable, anti-slop, taste-skill and Emil Kowalski's skills (studies in Faundr's `docs/research/design-*.md`).

## Numbers

| Theme | Minimum |
|---|---|
| Text contrast | 4.5:1 (large text ≥ 24 px or ≥ 18.66 px bold: 3:1). Icons, field borders and focus: 3:1 |
| Touch target (phone) | 44×44 px (on desktop, 24×24), with ~8 px between neighboring targets |
| Text field on phone | font ≥ 16 px (otherwise the iPhone zooms) |
| Text | body ≥ 14 px on phone; nothing below 12 px (label ≥ 11 px only if the design.md decides) |
| Line of text | 45–75 characters; body line height ≥ 1.4; heading 1.1–1.25 |
| Widths to test | 375, 768, 1024, 1440 px (no sideways scrolling on any) |
| Interface animation | 100–300 ms (button 100–160, tooltip 125–200, menu 150–250, modal/drawer 200–500, toast ≤ 400) |
| Curve | exit (`ease-out` or `cubic-bezier(0.23, 1, 0.32, 1)`); never `ease-in` on interface; no bounce |
| Loading | spinner only after ~200 ms; if it shows, it stays at least ~400 ms (no flicker) |
| Palette | 1 accent color; 1 gray family; 1 radius scale; 1 icon library |

## Every screen has

- **States**: loading (says what), empty (says why and what action), error (says what failed and what to do), no permission. First use ≠ filter with no results.
- **Visible focus** on everything clickable; Tab order matches the visual order; Esc closes modal and menu; modal traps and returns focus.
- **Accessible names**: icon-only button has `aria-label`; image has `alt`; field has a label (placeholder is not a label).
- **Semantics**: action = `<button>`, navigation = `<a>`/`<Link>`; no clickable `div`.
- **Phone**: what happens below 768 px is solved in the component itself (columns become 1, table scrolls inside a box, menu becomes a drawer); nothing that only appears on hover; `dvh` instead of `100vh`.
- **Motion with purpose**: what's used many times a day or by keyboard doesn't animate; respect "reduce motion".
- **Honest text**: no made-up or sample data ("John Doe", decorative numbers); labels state the action ("Save changes", not "OK"); errors say the next step; "…" and not "...".
- **Identity**: favicon, title per screen, `lang`, description.

## Reject (signs of an autopilot screen)

- Grid of identical cards with icon + title + text for everything.
- Default dashboard (sidebar + 4 number cards + chart + table) without answering "what decision does the person make here?"; chart without a question in the title.
- Decorative hero metric, made-up round numbers, "10,000+ users" without proof.
- Gradient text, decorative glass (blur), glow/colored shadow, colored stripe on the side of the card.
- Reflex modal (what fits on the page doesn't go in a modal); confirmation on an action that could be undone.
- Emoji as icon; two icon styles; grays from different families.
- Spaced uppercase label above every heading; decorative 01/02/03 numbering.
- `transition-all`, long animation, bounce, entering from `scale(0)`.

## When fixing

Never change, without asking: URLs, navigation labels, names and order of form fields, logo, legal text. Fix in this order: (1) broken, data loss, inaccessible; (2) missing states; (3) responsive and flow; (4) deviation from the design.md; (5) polish.
