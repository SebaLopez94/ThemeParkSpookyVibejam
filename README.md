# Theme Park Vibes

A browser-based 3D spooky theme park tycoon built with Three.js, React, and TypeScript.

## Overview

Theme Park Vibes is a haunted park management sandbox focused on path layout, ride placement, pricing, visitor satisfaction, research progression, and optional challenge goals. The game leans into retro spooky arcade presentation while keeping the simulation code modular and readable.

## Current Gameplay

- Build a park on a grid using paths, rides, shops, services, and decorations
- Manage entry price plus per-building prices for rides, shops, and services
- Keep visitors happy by serving their `fun`, `hunger`, `thirst`, and `hygiene` needs
- Earn money from tickets and facility usage while covering maintenance costs
- Unlock more advanced content through timed research
- Complete optional challenges for bonus money and rating boosts
- Raise park rating through visitor happiness, facility variety, and decoration appeal

## Main Systems

### Economy

- Starting money: `$3,500`
- Default ticket price: `$8`
- Visitors pay entry on spawn
- Rides, shops, and services support configurable usage prices
- Maintenance is charged every `20s`
- HUD tracks money, visitors, happiness, rating, income, expenses, and net profit

### Construction

- `Paths`: `1x1`, free, drag-to-build supported
- `Rides`: footprint-based placement, must connect to an existing path
- `Shops`: `1x1`, must be adjacent to a path
- `Services`: `1x1`, must be adjacent to a path
- `Decoration`: `1x1`, can be placed without path adjacency
- `Move` preserves the building and restores it to the original tile if the move is canceled
- `Sell` refunds `50%` of build cost

Current catalog:

- `Cursed Carousel`
- `Eye of Doom`
- `Terror Coaster`
- `Haunted House`
- `Witch Cauldron`
- `Poison Stand`
- `Voodoo Shop`
- `Haunted WC`
- `Spooky Tree`
- `Jack-o-Lantern`
- `Gravestone`
- `Pumpkin`

### Visitors

- Visitors spawn at the entrance path and move with A* pathfinding
- Spawn interval is randomized between `20s` and `32s`
- Maximum concurrent visitors: `18`
- They choose destinations based on need, affordability, price fairness, travel distance, crowding, and decoration appeal
- Visitors leave when they run out of money, become too unhappy, or the park closes and they reach the exit

### Research

- One active research at a time
- Research spends money immediately and completes over time
- Unlocks advanced rides and decorations
- Dependencies gate later-game content

### Challenges

- Optional sandbox objectives with live progress tracking
- Rewards grant bonus money and, in most cases, rating pressure relief
- Challenges auto-claim on completion and trigger a celebration UI

## Controls

- `RMB + drag`: pan camera
- `Mouse wheel`: zoom
- `LMB`: place or select
- `LMB drag`: draw paths
- `R`: rotate current building
- `RMB` or `Esc`: cancel build mode

## UI Overview

- `HUD`: money, visitors, happiness, rating, and park economy
- `Manage Park`: ticket price, park open/close, overview
- `Challenges`: objective tracking
- `Research`: progression and unlocks
- `Build`: construction catalog
- `?`: help and controls

## Project Structure

```text
src/
  core/         Core rendering and runtime
  data/         Building definitions, research, and challenge data
  entities/     World entities
  input/        Mouse and camera controls
  systems/      Building, economy, visitors, pathfinding, research, challenges
  types/        Shared game types
  ui/           HUD, panels, menus, and toasts
  Game.ts       Main game orchestrator
  App.tsx       React shell and UI composition
docs/
  game-logic.md Current gameplay rules and balancing overview
```

## Development

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Type check

```bash
npm run typecheck
```

### Production build

```bash
npm run build
```

## Notes

- The project is client-side only
- The visual direction intentionally leans into retro spooky arcade vibes
- Gameplay details are documented in [docs/game-logic.md](docs/game-logic.md)

## License

MIT
