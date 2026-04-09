# Theme Park Vibes - Game Logic

This document describes the current gameplay rules and simulation behavior implemented in the project.

## 1. Grid, Entrance and Navigation
- The game uses a `50x50` build grid.
- Each cell is `2x2` world units.
- The entrance is a double path on `x = 24-25`, from `z = 45` to `z = 49`.
- Visitors spawn at `x = 24, z = 49`.
- Visitors move only through connected path cells using A* pathfinding.
- Visitor flow is also influenced by a light local-density heuristic:
  - crowded destination cells are slightly less attractive
  - crowded current cells can reduce happiness and encourage wandering elsewhere

## 2. Economy and Park State
- Starting money: `$20,000`.
- Entry ticket is configurable from the main UI.
- Every new visitor pays the current ticket price when spawning.
- Buildings have an upfront construction cost.
- Rides, shops and services can charge a configurable usage price.
- Decoration has no direct visitor price and acts through appeal/rating.
- Economy tracks:
  - current money
  - ticket price
  - total visitors
  - active visitors
  - average happiness
  - park rating
  - total income
  - total expenses
  - net profit

### Price pressure and satisfaction
- Visitors evaluate whether a price feels fair relative to the building's value and quality.
- Overpriced buildings are more likely to be rejected.
- Using overpriced content can reduce happiness even if the visitor still pays.

## 3. Building Categories

### Paths
- Size: `1x1`
- Can be placed on any empty valid cell.
- Drag-to-build is supported.

### Rides
- Must have all footprint cells free.
- At least one adjacent path cell is required.
- Current rides:

| Ride | Size | Build cost | Default price | Fun boost | Duration |
|---|---|---|---|---|---|
| `Cursed Carousel` | 2x2 | $500 | $5 | +15 | 15s |
| `Eye of Doom` | 3x3 | $800 | $8 | +25 | 20s — **research-locked** |
| `Terror Coaster` | 4x4 | $1500 | $12 | +40 | 25s — **research-locked** |

- Editable property:
  - admission price

### Shops
- Size: `1x1`
- Must be adjacent to a path.
- Current shops:

| Shop | Build cost | Default price | Effect |
|---|---|---|---|
| `Witch Cauldron` (food) | $200 | $8 | hunger +28 |
| `Poison Stand` (drink) | $150 | $5 | thirst +34 |
| `Voodoo Shop` (gift) | $300 | $12 | fun +8 — **research-locked** |

- Editable property:
  - product price

### Services
- Size: `1x1`
- Must be adjacent to a path.
- Current service:
  - `Haunted WC` — build cost $100, default price $2, hygiene +40
- Editable property:
  - service price

### Decoration
- Size: `1x1`
- Can be placed on empty valid cells without path adjacency.
- Current decoration:

| Decoration | Build cost | Appeal radius | Appeal bonus |
|---|---|---|---|
| `Spooky Tree` | $75 | 4 cells | 5 |
| `Jack-o-Lantern` | $125 | 3 cells | 7 — **research-locked** |

- Decoration adds ambient appeal and contributes to rating.
- Nearby decorated areas are slightly more attractive for visitors when choosing destinations.

## 4. Visitor Simulation

### Visitor spawn and limits
- Spawn rate: `1 visitor every 14 seconds`
- Maximum concurrent visitors: `30`
- Starting money per visitor: `$30-$100`

### Needs
Visitors track:
- `fun` — starts at 50 (below full, so they want rides quickly)
- `hunger` — starts at 100
- `thirst` — starts at 100
- `hygiene` — starts at 100
- `money` — starts at $30–$100
- `happiness`

### Happiness
- Happiness is derived continuously from needs.
- Current weighting:
  - `40% fun`
  - `20% hunger`
  - `20% thirst`
  - `20% hygiene`

### Need decay
- `fun` decays fastest
- `thirst` decays faster than hunger
- `hygiene` decays slowest

### Leaving the park
A visitor leaves when:
- `money <= 0`
- `happiness < 15`

### Activity choice
Visitors do not use pure random behavior anymore. They score reachable targets using:
- dominant need
- affordability
- price fairness
- travel distance
- local crowd density
- nearby decoration appeal

If no good target exists, they wander to another path cell.

## 5. Building Effects on Visitors

### Rides
- Increase `fun`
- Have configurable price
- Higher-tier rides generally offer better value and stronger fun gain

### Food shop
- Restores `hunger`

### Drink shop
- Restores `thirst`

### Gift shop
- Boosts `fun` (+8)
- Only targeted when visitor has >$25 and happiness >45 (discretionary purchase)

### Restroom
- Restores `hygiene`

## 6. Building Management
- Clicking an existing ride, shop, service or decoration opens the building panel.
- Supported actions:
  - `Move` - removes the building, refunds full build cost, re-enters placement with the same building
  - `Delete` - removes the building, refunds `50%` of build cost
- Price editing is shown only for rides, shops and services.
- Decoration has no editable usage price.

## 7. Research and Unlocks
- The game includes a simple timed research system.
- Only one research can run at a time.
- Starting unlocked content:
  - path
  - Cursed Carousel
  - Witch Cauldron
  - Poison Stand
  - Haunted WC
  - Spooky Tree

### Research rules
- Starting a research spends money immediately.
- Research progresses automatically over time.
- Completing a research unlocks new buildable content.

### Current research unlocks

| Research | Cost | Duration | Unlocks | Requires |
|---|---|---|---|---|
| `Eye of Doom Blueprints` | $600 | 40s | Eye of Doom | — |
| `Souvenir Hexcraft` | $350 | 30s | Voodoo Shop | — |
| `Pumpkin Lantern Rituals` | $250 | 20s | Jack-o-Lantern | — |
| `Terror Coaster Engineering` | $1200 | 65s | Terror Coaster | Eye of Doom Blueprints |

## 8. Sandbox Challenges
- The game includes optional sandbox challenges.
- Challenges update automatically during play.
- Rewards are granted once on completion and then marked as claimed.

### Current challenge set
- Reach `20` total visitors
- Keep average happiness above `65` for `20 seconds`
- Maintain positive net profit for `25 seconds`
- Build `3` services or decorations

### Rewards
- Rewards are a combination of:
  - bonus money
  - small rating boost

## 9. Park Rating
- Park rating updates once per second.
- Rating is based on:
  - average visitor happiness
  - facility score from the current park layout
  - decoration appeal bonus

This makes decoration, services and visitor well-being all relevant to overall park performance.
