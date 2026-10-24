# "How it will work" diagram

Only with the owner's OK: it uses more tokens than usual. The feature drawing works like an Artifact: it opens on its own on a canvas in the browser and the owner approves or asks for changes there. It applies to a feature diagram and to the project architecture (layers and `--architecture` in `new-project.md`). Write the JSON **in one go**, without planning the drawing in text first: you don't position anything, you only say which lane and which column each piece goes in; the dashboard draws it.

## What to show

- **One main path**, from start to finish, the way the person lives it: what they do, what the screen shows, what the server decides, where the data lives. In `mainPath`, the ids in order.
- **Only the detours that matter**: the main error case and the way back to try again. Don't draw every detail.
- **Lanes = who does it** (2 to 5): e.g. `Person`, `Screen`, `Server`, `Database`, `External service` (Pix, email…). Use the project's names when it helps ("Cart screen").
- **Columns = the order** (0, 1, 2…). Pieces that happen at the same moment can share a column in different lanes. Never two pieces in the same lane and column.
- **Plain language** in the labels, written in the user's language (up to 32 characters; detail goes in `sublabel`, up to 48).
- **Explanation of each piece** in `detail` (up to 400 characters, 2 to 3 sentences): what it is, why it exists and what happens there, for people who don't code. It's what opens when the owner clicks the piece on the canvas. Skip it only for the person and the result when the label already says it all.
- Up to 30 pieces and 50 connections; for a feature, 6 to 14 pieces is usually enough.

## Format

```json
{
  "version": 1,
  "title": "Discount coupon in the cart",
  "summary": "The person types the coupon, the server checks it and the total already shows the discount.",
  "lanes": [
    { "id": "person", "label": "Person" },
    { "id": "screen", "label": "Cart screen" },
    { "id": "server", "label": "Server" },
    { "id": "db", "label": "Database" }
  ],
  "nodes": [
    { "id": "types", "lane": "person", "col": 0, "type": "person", "label": "Types the coupon" },
    { "id": "apply", "lane": "screen", "col": 1, "type": "screen", "label": "Clicks Apply" },
    { "id": "check", "lane": "server", "col": 2, "type": "decision", "label": "Coupon valid?", "sublabel": "within date and usage limit", "detail": "The server checks that the coupon exists, is still within its date and hasn't passed its usage limit. The check stays on the server so nobody can change the discount from the browser." },
    { "id": "coupons", "lane": "db", "col": 2, "type": "data", "label": "Coupons table" },
    { "id": "invalid", "lane": "screen", "col": 3, "type": "error", "label": "Shows: invalid coupon" },
    { "id": "total", "lane": "screen", "col": 4, "type": "end", "label": "Total with discount" }
  ],
  "edges": [
    { "from": "types", "to": "apply" },
    { "from": "apply", "to": "check" },
    { "from": "check", "to": "coupons", "label": "looks up the coupon" },
    { "from": "check", "to": "total", "label": "valid" },
    { "from": "check", "to": "invalid", "label": "not valid", "kind": "error" },
    { "from": "invalid", "to": "apply", "kind": "back" }
  ],
  "mainPath": ["types", "apply", "check", "total"],
  "notes": ["The coupon is checked on the server, never only on the screen."]
}
```

- Piece `type`: `person` (the person), `screen` (screen or button), `action` (something the system does), `decision` (a yes/no question), `data` (where the data lives), `external` (outside service), `error` (what the person sees when it goes wrong), `end` (the result).
- Connection `kind`: `main` (set automatically for the `mainPath` connections), `normal`, `error` (when it goes wrong), `back` (goes back and tries again).
- `notes`: up to 4 sentences with what doesn't fit in the drawing (a rule, a limit).
- `paths` (optional, on the piece): up to 5 paths where it lives in the code, relative to the root (`"src/routes/agenda/**"`, `"src/lib/cupom.ts"`). In the architecture, put them on every piece that becomes code: the plugin checks on its own, at the start of each session, which ones already exist, and the dashboard shows the ones that are still only a plan as faded. Leave without `paths` what isn't project code (the person, an outside service).

## Send

1. Write it to `.faundr/painel/diagram.json`.
2. Run `faundr diagram-save` (for a feature other than the current one: `--feature "<name>"`). Run it with a 10-minute timeout: it saves, opens the canvas in the owner's browser and **waits** for them to approve or ask for changes.
3. If a list of problems comes back, fix **only** the points raised and run it again. At most 2 corrections; if it still fails, tell the owner what's missing instead of rewriting everything.
4. What the command answers decides the next step:
   - **APPROVED**: it's the owner's OK to build. Don't ask again; say in one line that they approved and start with the first step.
   - **ASKED FOR CHANGES**: read the reason, adjust the drawing (and the plan, if something changed; record it in Faundr) and save again. Say in one line what changed. Don't build before the OK.
   - **No answer in 9 minutes**: run `faundr diagram-wait` once to keep waiting; if again nothing comes, ask in the terminal whether they approve.
5. The architecture (`--architecture`) doesn't go through approval: it saves and appears in **Architecture**, in the project menu, on a canvas where each piece opens its explanation.
