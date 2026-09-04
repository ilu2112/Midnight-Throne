# Midnight Throne

A reference-table and bestiary browser for the *Ker Nethalas — Gravebound Edition* tabletop RPG, built with Vue 3, Vite, and Vue Router. All content is extracted from the rulebook PDF into structured JSON and rendered as a searchable, cross-linked web app.

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
