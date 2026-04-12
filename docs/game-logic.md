# Theme Park Vibes - Game Logic

This document describes the gameplay rules and simulation behavior implemented in the current codebase.

## 1. Grid, Entrance, and Navigation

- The game uses a `50x50` build grid.
- Each cell is `2x2` world units.
- The starting entrance is a double path on `x = 12-13`, from `z = 18` to `z = 24`.
- Visitors spawn at `x = 12, z = 24`.
- Visitors move only through connected path cells using A* pathfinding.
- Local visitor density influences destination scoring and can create small happiness penalties in crowded areas.

## 2. Economy and Park State

- Starting money: `$3,500`
- Default ticket price: `$8`
- Each new visitor pays the current ticket price when spawning.
- Buildings have an upfront construction cost.
- Rides, shops, and services can charge a configurable usage price.
- Decorations do not have a visitor price and instead contribute through appeal and rating.

Economy tracks:

- current money
- ticket price
- total visitors
- active visitors
- average happiness
- park rating
- daily income
- daily expenses
- net profit
- park open / closed state

### Price pressure and satisfaction

- Visitors evaluate whether prices feel fair relative to quality and value score.
- Overpriced content is more likely to be rejected.
- Accepting an overpriced attraction can still reduce happiness.

## 3. Building Categories

### Paths

- Size: `1x1`
- Cost: `$0`
- Can be placed on any empty valid cell.
- Drag-to-build is supported.

### Rides

- Must have all footprint cells free.
- At least one adjacent path cell is required.

| Ride | Size | Build cost | Default price | Fun boost | Duration |
|---|---|---|---|---|---|
| `Cursed Carousel` | 2x2 | $500 | $4 | +15 | 30s |
| `Eye of Doom` | 3x3 | $800 | $6 | +25 | 40s |
| `Terror Coaster` | 4x4 | $1500 | $10 | +40 | 50s |
| `Haunted House` | 3x3 | $1000 | $8 | +30 | 45s |

- Editable property:
  - admission price

### Shops

- Size: `1x1`
- Must be adjacent to a path.

| Shop | Build cost | Default price | Effect |
|---|---|---|---|
| `Witch Cauldron` | $200 | $8 | hunger +28 |
| `Poison Stand` | $150 | $5 | thirst +34 |
| `Voodoo Shop` | $300 | $12 | fun +8 |

- Editable property:
  - product price

### Services

- Size: `1x1`
- Must be adjacent to a path.
- Current service:
  - `Haunted WC` - build cost `$100`, default price `$2`, hygiene `+40`

- Editable property:
  - service price

### Decorations

- Size: `1x1`
- Can be placed on empty valid cells without path adjacency.

| Decoration | Build cost | Appeal radius | Appeal bonus |
|---|---|---|---|
| `Spooky Tree` | $30 | 4 cells | 5 |
| `Jack-o-Lantern` | $50 | 3 cells | 7 |
| `Gravestone` | $20 | 3 cells | 4 |
| `Pumpkin` | $15 | 3 cells | 6 |

- Decorations increase local destination appeal.
- Total decoration appeal also contributes to park rating.

## 4. Visitor Simulation

### Visitor spawn and limits

- Spawn rate: randomized between `20` and `32` seconds
- Maximum concurrent visitors: `18`
- Starting money per visitor: `$30-$100`

### Needs

Visitors track:

- `fun` - starts at `50`
- `hunger` - starts at `100`
- `thirst` - starts at `100`
- `hygiene` - starts at `100`
- `money` - starts between `$30` and `$100`
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
- the park is closed and they reach the entrance

### Activity choice

Visitors score reachable targets using:

- dominant need
- affordability
- price fairness
- travel distance
- local crowd density
- nearby decoration appeal

If no strong target exists, they wander to another path tile. If the park is closed, they head to the entrance instead.

### Visitor mood emojis

- Visitors can occasionally show a small emoji above their head as an in-world mood signal.
- Emojis are contextual and temporary, not permanent status markers.
- Only one emoji is shown per visitor at a time.
- The system is intentionally throttled with cooldowns and random chance so the park does not become visually noisy.

Current mood mapping:

- low `hunger` -> food emoji
- low `thirst` -> drink emoji
- low `fun` -> bored emoji
- high `happiness` -> happy emoji
- low `happiness` -> sad emoji
- very low `hygiene` -> sick / disgust emoji
- crowd frustration -> annoyed emoji
- price rejection -> money / frustration emoji

Priority order:

1. price rejection and crowd frustration
2. hygiene / sick reaction
3. hunger and thirst
4. boredom
5. sadness
6. happiness

Notes:

- Happy emojis are intentionally rarer than negative need feedback.
- Visitors do not keep an emoji visible all the time even if the same need remains low.
- Ride invisibility suppresses the emoji while the visitor is hidden inside the attraction.

## 5. Building Effects on Visitors

### Rides

- Increase `fun`
- Have configurable prices
- Higher-tier rides offer stronger fun gains and better attraction value

### Food shop

- Restores `hunger`

### Drink shop

- Restores `thirst`

### Gift shop

- Boosts `fun` by `8`
- Only becomes a meaningful choice when the visitor still has spare money and decent happiness

### Restroom

- Restores `hygiene`

## 6. Building Management

- Clicking an existing ride, shop, service, or decoration opens the building panel.
- Supported actions:
  - `Move` - removes the building from the map, enters relocation mode, and restores the original building if relocation is canceled
  - `Sell` - removes the building and refunds `50%` of build cost
- Price editing is shown only for rides, shops, and services.
- Decorations have no editable usage price.

## 7. Research and Unlocks

- The game includes a timed research system.
- Only one research can run at a time.

### Starting unlocked content

- path
- Cursed Carousel
- Witch Cauldron
- Poison Stand
- Voodoo Shop
- Haunted WC
- Spooky Tree
- Gravestone
- Pumpkin

### Research rules

- Starting a research spends money immediately.
- Research progresses automatically over time.
- Completing a research unlocks new buildable content.

### Current research unlocks

| Research | Cost | Duration | Unlocks | Requires |
|---|---|---|---|---|
| `Pumpkin Lantern Rituals` | $200 | 25s | Jack-o-Lantern | - |
| `Eye of Doom Blueprints` | $500 | 50s | Eye of Doom | - |
| `House of Screams` | $750 | 60s | Haunted House | Eye of Doom Blueprints |
| `Terror Coaster Engineering` | $1100 | 90s | Terror Coaster | Eye of Doom Blueprints, House of Screams |

## 8. Sandbox Challenges

- Challenges update automatically during play.
- Rewards are granted once, auto-claimed, and then marked as completed.

### Current challenge set

- Build `1` ride
- Reach `10` total visitors
- Build `3` services or decorations
- Reach `25` total visitors
- Build `2` shops
- Keep average happiness above `65` for `20` seconds
- Maintain positive net profit for `30` seconds
- Build `3` rides
- Reach `75` total visitors
- Keep happiness above `75` for `30` seconds
- Reach park rating `80`
- Reach `150` total visitors
- Stay profitable for `60` seconds

### Rewards

- Rewards are combinations of:
  - bonus money
  - rating boosts or rating pressure relief

## 9. Park Rating

- Park rating updates once per second.
- Rating is based on:
  - average visitor happiness
  - facility score from the current park layout
  - decoration appeal bonus

### Rating caps

- Rating is capped by current active visitors.
- Rating is also capped by facility diversity:
  - one facility type: max `49`
  - two facility types: max `69`
  - three facility types: max `92`

This keeps visitor happiness, facility variety, and layout growth all relevant to long-term progression.
