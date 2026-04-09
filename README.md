# Theme Park Vibes

A browser-based 3D spooky theme park tycoon built with Three.js, React and TypeScript.

## Overview

Theme Park Vibes is a playable management sandbox focused on building a haunted amusement park, tuning prices, keeping visitors happy, unlocking content through research and completing optional challenges. The game mixes a retro 90s horror presentation with a lightweight but structured tycoon loop.

## Current Gameplay

- Build a park on a grid using paths, rides, shops, services and decoration
- Set the park entry price and adjust ride or building prices
- Simulate visitors with needs for `fun`, `hunger`, `thirst` and `hygiene`
- Earn money from tickets and park facilities while avoiding happiness drops
- Unlock advanced content through timed research
- Complete optional sandbox challenges for bonus money and rating
- Improve park rating through visitor satisfaction, facility variety and decoration appeal

## Main Systems

### Economy
- Starting money: `$20,000`
- Configurable park entry price
- Configurable usage prices for rides, shops and services
- Income, expenses, net profit, visitor counts, happiness and park rating tracked in the HUD
- Price fairness affects whether visitors buy and how happy they stay after using content

### Construction
- `Paths`: `1x1`, drag-to-build supported
- `Rides`: footprint-based placement, must connect to paths
- `Shops`: `1x1`, must be adjacent to a path
- `Services`: `1x1`, must be adjacent to a path
- `Decoration`: `1x1`, can be placed without path adjacency

Current buildable content includes:
- `Cursed Carousel`
- `Eye of Doom`
- `Terror Coaster`
- `Witch Cauldron`
- `Poison Stand`
- `Voodoo Shop`
- `Haunted WC`
- `Spooky Tree`
- `Jack-o-Lantern`

### Visitors
- Visitors spawn at the park entrance and move with A* pathfinding
- They choose destinations based on need, price, value, reachability, crowding and local appeal
- Local congestion slightly discourages overcrowded routes and destinations
- Visitors leave if they run out of money or become too unhappy

### Research
- One active research at a time
- Research costs money and completes over time
- Unlocks advanced rides, shops and decoration
- UI distinguishes locked, active and completed projects clearly

### Challenges
- Optional sandbox objectives
- Track progress in real time
- Reward money and rating boosts
- Completed challenges are visually marked in the UI

## Controls

- `RMB + drag`: pan camera
- `Mouse wheel`: zoom
- `LMB`: place or select
- `LMB drag`: draw paths
- `R`: rotate current building
- `RMB` or `Esc`: cancel build mode

## UI Overview

- `HUD`: money, visitors, happiness, rating and park economy
- `Park`: entry price and park overview
- `Challenges`: optional objective tracking
- `Research`: unlock progression
- `Build`: construction catalog by category
- `?`: help and controls

## Tech Stack

- `Three.js` for rendering and scene management
- `React` for UI
- `TypeScript` for static typing
- `Vite` for development and build
- `Tailwind CSS` plus custom UI styling
- `Lucide React` for icons

## Project Structure

```text
src/
  core/         Core rendering and runtime
  data/         Building and gameplay data
  entities/     World entities
  input/        Mouse and camera controls
  systems/      Building, economy, visitors, pathfinding, research
  types/        Shared game types
  ui/           HUD, panels, menus and toasts
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
- Gameplay documentation is maintained in [docs/game-logic.md](docs/game-logic.md)

## License

MIT
