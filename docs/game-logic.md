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
- Default ticket price: `$5`
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

- Spawn rate: randomized between `15` and `23` seconds
- Maximum concurrent visitors: `22`
- Starting money per visitor: `$60–$150`

### Personality archetypes

Each visitor is assigned a personality at spawn that modifies their behaviour:

| Personality | Effect |
|---|---|
| `thrill_seeker` | Ride score ×1.4, shop score ×0.85, fun decay ×1.25 |
| `foodie` | Food/drink shop score ×1.4, ride score ×0.85, hunger/thirst decay ×1.15–1.20 |
| `relaxer` | Density penalty ×0.5, fun decay ×0.80, hunger/thirst decay ×0.85, gift shop score ×1.2 |

### Mood momentum

- Each visitor tracks a `moodMomentum` value in `[-1, +1]`.
- Positive events (fair ride price, fun boost) push it toward `+1`.
- Negative events (price rejection, crowd frustration) push it toward `-1`.
- It decays toward `0` naturally over time.
- A positive momentum raises price tolerance; a negative one lowers it.

### Natural leave arc

- Each visitor has a `naturalLeaveDuration` (180–300 s) randomised at spawn.
- After that time, the leave threshold rises from `15` toward `40`, so long-staying visitors gradually become harder to retain.

### Needs

Visitors track:

- `fun` - starts at `30` (excited to be at the park)
- `hunger` - starts at `70`
- `thirst` - starts at `70`
- `hygiene` - starts at `90`
- `money` - starts between `$60` and `$150`
- `happiness`

### Happiness

- Happiness is derived continuously from needs.
- Current weighting:
  - `40% fun`
  - `20% hunger`
  - `20% thirst`
  - `20% hygiene`

### Need decay (per second, base rates modified by personality)

| Need | Base rate |
|---|---|
| `fun` | 0.45 |
| `hunger` | 0.50 |
| `thirst` | 0.60 |
| `hygiene` | 0.30 |

- Thirst decays fastest — drink stands are the most urgently needed shop.
- Hygiene decays slowest — restrooms are a comfort upgrade, not an emergency.

### Leaving the park

A visitor leaves when:

- `money <= 0`
- `happiness < leaveThreshold` (starts at 15; rises after `naturalLeaveDuration`)
- the park is closed and they reach the entrance

### Activity choice

Visitors score reachable targets using:

- dominant need (amplified by personality multiplier)
- ride variety penalty (each repeated ride scores lower)
- affordability
- price fairness (adjusted by moodMomentum)
- travel distance (Manhattan heuristic for scoring; A* only for the winner)
- local crowd density (relaxers less sensitive; thrill-seekers slightly more)
- nearby decoration appeal

Gift shop desire scales with happiness: happy visitors with spare cash (> $20) treat themselves proportionally more.

If no strong target exists, they wander to another path tile. If the park is closed, they head to the entrance instead.

### Ride fun boost

Fun gained from a ride is based on the ride's intrinsic `funFactor` and `quality`, **not** the admission price set by the player. Price affects only whether the visitor accepts the cost, not how much fun they get.

```
funBoost = Min(100, funFactor × (quality / 60) + decorationBonus)
```

### Ride cooldown and variety penalty

- `60 seconds` before a visitor will re-enter the same ride.
- Repeated use of the same ride applies a cumulative variety penalty (`-12%` per extra use, max `-40%`).
- Multiple different rides are required to keep fun levels high throughout a visit.

### Visitor mood emojis

- Visitors can occasionally show a small emoji above their head as an in-world mood signal.
- Emojis are contextual and temporary, not permanent status markers.
- Only one emoji is shown per visitor at a time.
- The system is intentionally throttled with cooldowns and random chance so the park does not become visually noisy.

Current mood mapping:

- low `hunger` -> food emoji
- low `thirst` -> drink emoji
- low `fun` -> bored emoji
- very high `happiness` (> 88) -> excited emoji (🤩)
- high `happiness` (> 78) -> happy emoji (😊)
- low `happiness` -> sad emoji
- very low `hygiene` -> sick / disgust emoji
- crowd frustration -> annoyed emoji
- price rejection -> money / frustration emoji
- very low `money` (< 12) -> broke emoji (😔)
- spawn -> excitement burst (🎉, suppressed during ride entry animation)

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
- Challenges are grouped into 5 thematic tiers visible in the panel.
- All challenges are always visible — no artificial gating.

### Challenge types

- `visitor_count` — total visitors who have entered the park
- `active_visitors` — concurrent visitors present at the same time
- `ride_count` — number of rides built
- `shop_count` — number of shops built
- `service_count` — number of services (restrooms) built
- `decoration_count` — number of decorations placed
- `build_count` — combined services + decorations count
- `happiness_streak` — average happiness above `target` sustained for `duration` seconds
- `profit_streak` — positive net profit sustained for `duration` seconds
- `rating_threshold` — park rating reaches `target`

### Tier structure and challenge set

**Tier I — The Gates Open**
- Build first ride → $400 + 3★
- Open a shop → $250 + 2★
- Welcome 15 visitors → $300 + 3★

**Tier II — The Haunting Begins**
- Place 3 decorations → $300 + 2★
- Reach 30 total visitors → $500 + 3★
- Build a restroom → $300 + 2★
- Keep happiness above 60 for 25s → $500 + 4★
- Stay profitable for 30s → $600 + 3★

**Tier III — A Real Nightmare**
- Build all 3 shop types → $700 + 4★
- Reach 60 total visitors → $800 + 4★
- Build 3 rides → $900 + 5★
- Reach park rating 50 → $800

**Tier IV — Empire of Fear**
- Reach 100 total visitors → $1500 + 6★
- Have 15 active visitors at once → $1000 + 4★
- Keep happiness above 72 for 45s → $1200 + 6★
- Reach park rating 70 → $1800
- Stay profitable for 90s → $1500 + 5★

**Tier V — Legend of the Damned**
- Reach 200 total visitors → $3500 + 8★
- Keep happiness above 80 for 60s → $2500 + 7★
- Reach park rating 85 → $3000
- Stay profitable for 120s → $2500 + 6★

Total reward pool: ~$24 850 across 20 challenges.

## 9. Park Rating

- Park rating updates once per second.
- Rating formula:

```
happinessComponent  = averageHappiness × 0.55        (max ~55)
facilityComponent   = Min(facilityScore, 28)          (max 28)
decorationComponent = Min(decorationAppeal, 18)       (max 18)

base = happinessComponent + facilityComponent + decorationComponent
```

The facility score cap was raised from 16 → 28 so parks with 7+ buildings still gain rating value. The decoration cap was raised from 8 → 18 to reward continued theming.

### Rating caps

- Rating is capped by current active visitors:

| Active visitors | Max rating |
|---|---|
| 0 | 19 |
| 1–4 | 29 |
| 5–9 | 44 |
| 10–14 | 64 |
| 15+ | 92 |

- Rating is also capped by facility diversity:
  - one facility type: max `49`
  - two facility types: max `69`
  - three facility types: max `92`

This keeps visitor happiness, facility variety, and layout growth all relevant to long-term progression.

## 10. Architecture & Utilities

### Event Communication (EventBus)

`Game` exposes a typed `events: EventBus<GameEvents>` instead of nullable public callbacks.
React UI subscribes via `game.events.on('economyUpdate', handler)`.

Typed events:
- `economyUpdate` — EconomyState snapshot
- `buildingSelected` — SelectedBuildingInfo | null
- `buildCancel` — void
- `rotationChange` — degrees (number)
- `researchUpdate` — ResearchState
- `challengesUpdate` — ChallengeState[]
- `challengeCompleted` — ChallengeState

### Pathfinding (PathfindingSystem)

- A* uses a **min-heap** instead of array sort for O(log n) open-list operations.
- Path results are **cached by (start, goal) pair**; cache is invalidated whenever the walkable grid changes (path placed or removed).

### Visitor Activity Scoring

Activity targets are selected in two phases to minimize A* calls:

1. **Phase 1** — All candidates are scored using **Manhattan distance** (no pathfinding).
2. **Phase 2** — A* is run **only for the winning candidate**.

Previously, A* was called for every candidate building on every activity assignment, making the cost O(buildings × visitors) per frame.

### Platform Detection

A single `isMobile(): boolean` is exported from `src/utils/platform.ts`.
Previously duplicated in `Scene.ts`, `Renderer.ts`, and `Visitor.ts`.
