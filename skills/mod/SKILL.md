---
description: Creates a well-built Claude Code mod — a change to Claude Code's own screen or to the way Claude works (side panel, band above the prompt, status line item, quick notice, slash command, rule that blocks or rewrites a tool, sound). Follows best practices — asks the essentials, separates the logic so it can be tested, validates, type-checks, tests in the terminal and in the app — and records it in Faundr. Use when the user asks to create, change or fix a mod, or when what they want can only be done with a mod.
argument-hint: [what the mod does]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *) Bash(claude plugin validate *) Bash(claude plugin test *)
---

User request: $ARGUMENTS

A **mod** is a small plugin that changes Claude Code itself: what appears on screen (panel, band above the prompt, status line, quick notice) or what happens (before a tool runs, when a request arrives, a new slash command). It runs inside Claude Code, with no Node and no browser: everything outside it comes through `$`.

Talk to the user in plain language, in the user's language. They may not code: say what the mod will do on their screen, not how it works inside.

## 1. Load the official guide before writing

Call Claude Code's `plugin-authoring` skill (Skill tool). It brings what changes with each Claude Code version and this skill doesn't repeat: **the folder to write the mod in for this session**, this version's types file (the reference for each event, each `$` method and each screen element), ready-made examples and how live reload works. Without it you write from memory, and the API changes between versions. For an API detail, search the types file by name (`'tool.call'`, `Pane: {`) and read the declaration; don't guess.

## 2. Check that it really is a mod

Before creating, see whether something simpler solves it, and say which:

- fixed text below the terminal, not reacting to anything → Faundr's status line (`/faundr:statusline`) or one of its items on the dashboard (Terminal);
- instructions Claude should follow → a rule (`/faundr:rule`) or a workflow (`/faundr:workflow`);
- a script the user calls → a skill.

If a mod that does this already exists (`faundr-mod` already warns at 80% and 95% of the context and limits and draws the band above the prompt), show it and stop.

## 3. Ask only what's missing

If the request doesn't say, ask in a single round (ask-the-user tool, with options, the recommended one first), at most 3 questions:

- **what appears and when** (e.g. "notice when context goes past 80%", "panel with the failed tests");
- **where**: only in the terminal, or also in the app (desktop) and in VS Code;
- **what the person can turn on and off** (becomes a mod option, in the settings menu, instead of a fixed value in the code).

With a clear request, don't ask.

## 4. Record it in Faundr

`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" feature "Mod: <name>" --desc "<what it does>" --done-when "<criterion>; validated and tested"` and one `task` per step (shape, logic and tests, screen, validation, delivery).

## 5. Write it with these practices

**Shape**
- Short kebab-case name (`context-alert`). Three files, in the folder the official guide indicates: `.claude-plugin/plugin.json` (name, version `0.1.0`, one-line description), `hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`) and `hooks/register.tsx` exporting `register: Register` (type imported from `'claude-code'`).
- Choose the event from the official guide's table (panel, band above the prompt, status line, notice, `tool.call`, `prompt.submit`, command). A mod does one thing; two ideas, two mods.
- Options the person chooses go in `userConfig` in `plugin.json` and arrive in `options`; no magic values in the code.

**Logic separate from the screen**
- Put the calculations and decisions in a separate file without `$` (e.g. `hooks/alerts.ts`: "which notices to show with these numbers"). `register.tsx` only wires events to that logic. That way the logic can be tested on its own and the mod can be read without Claude Code.

**State**
- Session value in `$.state`; value that crosses sessions in `$.store`. Each value declared in the `types/index.d.ts` contract (`interface PluginState`) and the file referenced in `"types"` in `plugin.json`.
- Loose module variables vanish on each reload (`register` runs again). Don't keep anything important in them.
- What the screen reads comes from an `atom`: read it with `read` when drawing and write it with `update` in an event. Drawing doesn't do heavy computation, read files or hit the network: `ui.render` runs many times.

**Respect the rest of Claude Code**
- Call `next(e)` whenever you aren't deliberately answering on your own: without it, the other plugins and the normal behavior stop there. To change something, `next({ ...e, field })`.
- A hook that blocks (`tool.call`, `prompt.submit`, `command.run` and those `validate` calls *gating*) gets `.catch(($, e, next) => next.called ? next(e) : { deny: '<reason in the user\'s language>' })`. Without it, an error in the hook lets through what it should block.
- No dynamic `import()` (the module doesn't load), no Node (`fs`, `process`) and no DOM: use `$.fs`, `$.process`, `$.clock`, `$.model`.

**Screen**
- Elements come from `$.ui.resolve(e)` (`const { Box, Text } = $.ui.resolve(e)`), according to the surface (`terminal`, `desktop`, `vscode`, `mobile`). Never assume just one.
- Work in a narrow terminal: truncate long text, wrap to another line instead of overflowing.
- Meaning never by color alone (bold, inverse or a word alongside). No emoji as icons.
- Quick notices (`$.ui.toast`) sparingly: each notice once, and it only comes back when the situation changes (e.g. after `/compact`).
- Nothing to show → `next(e)` (the normal screen), not an empty box.

**Text**
- In plain language, in the user's language, short, saying what to do ("Context at 82%: time to /compact"). A block reason explains the why and the way forward.

## 6. Verify before saying it's done

1. `claude plugin validate <mod folder>` with no errors. Read the list of what the mod wires and calls: it has to match what you intended.
2. Types: `tsc -p <mod folder>` (the types land in `.claude-plugin/types/` after the first load; before that, use the `tsconfig.json` from the types file's header, kept outside the mod folder).
3. At least one `*.test.ts` of the requested behavior, run with `claude plugin test <mod folder>`. A screen test mounts on both surfaces: `for (const surface of ['terminal', 'desktop'] as const)`.
4. With live reload on, the mod loads when the response ends. If a dimmed line with `<mod>: ... refused` or a skipped hook shows up, read the reason and fix it. To see everything: `claude --debug`.

If something failed, say what failed, with the message. Don't say it's done.

## 7. Deliver

- Explain in 2 to 3 sentences what the mod does and how to see it working ("send a message and look above the prompt").
- If live reload was refused, say the mod loads in the next session.
- The session folder is temporary: offer to copy the mod to a folder the person keeps (in the project, `mods/<name>/`). For other people to install it, only if they ask: `.claude-plugin/marketplace.json` in the repository and the line `/plugin install <mod> --marketplace <owner>/<repository>` in the README.
- Close each step in Faundr (`faundr done "<part of the name>"`) and record a decision if there was a choice that matters (`decision "<choice>" --why "<why>"`).
