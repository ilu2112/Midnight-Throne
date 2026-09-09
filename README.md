# Midnight Throne

This is a fan-made companion app for the *Ker Nethalas — Gravebound Edition* tabletop RPG — a quick way to look up the rulebook's tables, browse the bestiary, and run a couple of small tools for a session (Room Generator, Locks & Traps) instead of flipping through the PDF.

## About the code

This project is vibe-coded: built by talking to Claude Code rather than being hand-written line by line. That's also why the code is the way it is — if something looks inconsistent or overengineered in places, that's the reason.

## Features

- **Tables** — every random/lookup table from the rulebook (loot, items, encounters, hit locations, room shapes, and more), grouped by category in the sidebar, with search and sortable columns.
- **Bestiary** — a searchable, filterable list of every monster (with type and Overseer filters) and a detail page per monster showing:
  - stats, flavor text, and traits, with hover tooltips explaining the formally-defined creature traits (Alert, Frightening, Pack, etc.)
  - a Hit Location table resolved from the monster's body plan, with the vulnerable spot highlighted
  - a Spoils entry linked to the matching loot table when one exists
  - a merged D6 action table (repeated "Same as N" rows collapsed into ranges) and any level-adaptation notes
- **Cross-referencing** — table cells and monster text that mention another table or monster automatically become links to that page.
- Illustrated monster portraits and room-shape diagrams.

## Requirements

- Node, matching the version in `.nvmrc` (run `nvm use` if you have nvm)
- pnpm (see the `packageManager` field in `package.json` — enable it with `corepack use pnpm` if needed)

## Getting started

```
nvm use
pnpm install
pnpm dev
```

## Production build

```
pnpm build
pnpm preview
```

## Project structure

- `src/data/` — table and bestiary data extracted from the rulebook PDF (`table_*.json` files plus `combat_encounter_monsters.json`)
- `src/registry.js` — auto-discovery of the data files above, plus lookup helpers (`findTable`, `findMonster`, etc.)
- `src/lib/` — shared helpers: `textLinks.js` (cross-reference linking between tables/monsters) and `traitTooltips.js` (creature trait glossary tooltips)
- `src/views/` — page views: home, table view, monster list, monster detail
- `src/router/` — Vue Router configuration
- `public/monster-portraits/`, `public/room-shapes/` — illustrated assets referenced from the data
