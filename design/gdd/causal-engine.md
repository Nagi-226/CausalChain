# Causal Engine (因果律消除引擎)

> **Status**: In Design (bootstrapped from v0.0.9 codebase + v0.1.1 engine foundation)
> **Author**: Nagi_226 + Claude Code
> **Last Updated**: 2026-05-09
> **Implements Pillar**: "One-sentence rules" + "Mastery takes a lifetime"
> **Implemented in**: `src/core/CausalEngine.js`, `src/core/BoardGenerator.js`, `src/core/Difficulty.js`
> **Creative Director Review (CD-GDD-ALIGN)**: Skipped — Solo mode

## Overview

The CausalEngine is the heart of the game — it manages the 6×8 tile board, validates cause→effect drag matches, computes the chain rewind cascade after each elimination, and determines win/deadlock conditions. It is a pure-logic module with no rendering or UI dependencies. All gameplay values are data-driven through Difficulty presets and level configuration.

### What the system does
- Maintains a 2D grid of causal tiles (Cause / Effect / Paradox)
- Validates player drag-and-drop match attempts against adjacency and color+icon matching rules
- Computes BFS-based rewind layers that propagate through causal chain links after each elimination
- Supports item effects: freeze rewind, undo last move, reshuffle board
- Exposes state snapshot / restore for save/load and undo

### What the game would lose without it
No gameplay. The CausalEngine IS the game — every other module renders, animates, or extends it.

## Player Fantasy

**Indirect** — players don't interact with the engine directly. They feel it through:
- The satisfying "snap" of a correct cause→effect match
- The tension of watching a rewind ripple propagate and wondering "how far will it go?"
- The "aha" moment of realizing their move choice triggered an unexpected chain reaction
- The strategic depth of planning moves to minimize rewind cascades (for star ratings)

The engine's job is to make every move feel consequential — the butterfly effect is real, calculated, and visible.

## Detailed Design

### Core Rules

#### Rule 1: Tile Types
The board contains tiles of three types:
- **CAUSE** (`cause`): Initiator — can only be the source (from) of a match
- **EFFECT** (`effect`): Receiver — can only be the target (to) of a match
- **PARADOX** (`paradox`): Dual-role — can act as either source or target (v0.1.1+)

Every tile has a `color` (crimson / azure / gold) and an `icon` (spark / leaf / moon), producing 9 pair types via 3×3 combination.

#### Rule 2: Match Validation
A match is valid when ALL of these conditions hold:
1. Source tile type is CAUSE or PARADOX
2. Target tile type is EFFECT or PARADOX
3. Source and target are adjacent (Manhattan distance = 1, i.e., 4-directional neighbors)
4. Source and target have matching color AND matching icon

If any condition fails, the match is rejected with a specific reason code:
- `empty_tile` — one or both positions are null
- `not_adjacent` — tiles are not 4-directional neighbors
- `source_not_cause` — source is EFFECT (and not PARADOX)
- `target_not_compatible` — target is CAUSE (and not PARADOX)
- `pair_mismatch` — color or icon don't match

#### Rule 3: Elimination
On a valid match:
1. Both tiles are removed from the board (set to null)
2. The match is recorded in the move history with before/after snapshots
3. Steps counter increments by 1
4. Score increments by 1

#### Rule 4: Chain Rewind Cascade
After elimination, a BFS-based rewind wave propagates outward:
1. Start from the two eliminated positions
2. For each depth step (up to `rewindDepth`, default 1-4):
   a. Check 4-directional neighbors of current frontier positions
   b. Check tiles linked via `causalLinks` (chain-linked tiles)
   c. If `crossLayerDepth > 1` (v0.1.1+), also traverse `causalLinks` recursively up to `crossLayerDepth` hops for cross-chain rewind
   d. All found non-eliminated tiles are collected into a "layer"
   e. Each tile in the layer is eliminated (set to null)
   f. If the eliminated pair contained a PARADOX tile (v0.1.1+), there is a `paradoxRatio` probability of expanded rewind radius
3. Each depth iteration produces one rewind layer (for animation sequencing)
4. If `freezeNext` is true, skip all rewind (item effect)

#### Rule 5: Win/Deadlock/Move Budget
- **Win**: All tiles eliminated (`countTiles() === 0`)
- **Deadlock**: Not won AND no legal moves exist
- **Move Budget Spent**: `moveBudget > 0` AND `steps >= moveBudget` AND not won
- Status returns: `'won'` | `'lost'` | `'playing'`
- Fail reason returns: `'moveBudget'` | `'noMoves'` | `'unknown'`

### States and Transitions

| State | Description | Transitions To |
|-------|-------------|---------------|
| `playing` | Board has tiles and legal moves exist | `won` (all tiles eliminated), `lost` (no legal moves or move budget spent) |
| `won` | All tiles eliminated | None (terminal) |
| `lost` | Deadlock or move budget spent | `playing` (via undo or reshuffle) |

The engine also tracks internal flags:
- `freezeNext: boolean` — if true, the next elimination skips rewind
- `steps: number` — count of successful eliminations
- `score: number` — equals steps (1 point per elimination)
- `rewindCount: number` — count of eliminations that triggered rewind (non-zero rewind layers)
- `reshuffleCount: number` — count of reshuffles performed

### Interactions with Other Systems

#### Upstream (provides to)
| System | Data Flow |
|--------|-----------|
| `BoardRenderer` | Full board state via `getStateSnapshot()` — tile types, positions, colors, icons |
| `TouchHandler` | `canMatch(from, to)` for drag validation; `processMove(from, to)` for drop execution |
| `HUD` | `steps`, `rewindCount`, `getStatus()`, `moveBudget`, `remainingMoves` |
| `ResultPanel` | Win/loss status, stats (moves, time, rewinds) |
| `ItemManager` | `freezeNextRewind()`, `undo()`, `reshuffle()` — item adapter methods |
| `ShareManager` | Causal path data via `getCausalInsight()` / `traceCausalPath()` |
| `LeaderboardManager` | Level result (steps, stars, time) |

#### Downstream (consumes from)
| System | Data Flow |
|--------|-----------|
| `BoardGenerator` | Receives generated board + difficulty config at construction |
| `Difficulty` | Reads difficulty parameters (fillRate, chainLength, paradoxRatio, etc.) |
| `Solver` | Used by `getCausalInsight()` to find optimal path for hint system |

## Formulas

### Board Generation Formula
The `BoardGenerator` reverse-generates a solvable board:

```
tileCount = round(rows × cols × fillRate)
tileCount = tileCount - (tileCount % 2)  // force even
pairCount = tileCount / 2
dominoSlots = rows × (cols / 2)  // horizontal adjacent pairs
```

If `pairCount > dominoSlots`, generation fails (board too full for horizontal-only domino placement).

### Chain Rewind Cascade
The `_computeRewindLayers` BFS algorithm:

```
depth = max(1, difficulty.rewindDepth)
crossLayer = max(0, difficulty.crossLayerDepth || 0)
paradoxProb = difficulty.paradoxRatio || 0
hasParadoxTrigger = removed.some(tile => tile.type === 'paradox')

for step in 1..depth:
  for each position in frontier:
    neighbors = getNeighbors(position)  // 4-directional
    linked = getLinkedTiles(sourceTile)
    if crossLayer > 1:
      linked += getLinkedTilesRecursive(sourceTile, crossLayer, visited)
    for each candidate in (neighbors + linked):
      if not visited:
        if hasParadoxTrigger AND random() < paradoxProb:
          relation = 'paradox_expand'  // extra reach
        add to layer
  frontier = all found positions
```

**Performance Budget**: < 10ms for 48-tile board at `rewindDepth=4, crossLayerDepth=3`

### Legal Move Detection
```
for each tile (type == CAUSE or PARADOX) on board:
  for each 4-directional neighbor (type == EFFECT or PARADOX):
    if tile.color == neighbor.color AND tile.icon == neighbor.icon:
      add { from: tile.position, to: neighbor.position } to moves
```

Time complexity: O(rows × cols × 4) = O(192) for 6×8 board — basically constant.

## Edge Cases

- **If a rewind cascade would eliminate the last tiles**: The game correctly transitions to `won` state. The rewind operates on a snapshot — removing tiles during cascade doesn't affect the current step's validation.
- **If freezeNext is active**: `_computeRewindLayers` returns an empty array `[]`. The `rewindCount` is NOT incremented (rewindLayers.length === 0 check).
- **If undo is called with empty history**: Returns `{ success: false, reason: 'empty_history' }`. No state change.
- **If reshuffle can't find a legal arrangement after 80 attempts**: Restores the original board arrangement. Returns `{ success: false, reason: 'no_legal_shuffle' }`.
- **If processMove is called when status is not 'playing'**: Returns failure with `reason: 'game_over'` unless `options.ignoreTerminal === true`.
- **If a PARADOX tile is the ONLY remaining tile**: A paradox tile can match with itself if another paradox exists, or with any compatible EFFECT/CAUSE. If no legal paradox match exists, it's a deadlock.
- **If crossLayerDepth > chain length**: Recursive traversal naturally exhausts at the end of the chain — no error, just no additional tiles found.
- **If two paradox tiles trigger rewind simultaneously**: Both contribute to the `hasParadoxTrigger` check; the combined `paradoxProb` applies to each frontier position independently.

## Dependencies

### Hard Dependencies (system cannot function without)
| System | Interface | Version |
|--------|-----------|---------|
| `Difficulty` | `Difficulty.normalize(difficulty)` → config object with fillRate, chainLength, paradoxRatio, crossLayerRatio, rewindDepth, crossLayerDepth | v0.1.1 |
| `BoardGenerator` | `new BoardGenerator(options).generate()` → `{ board, solution, metadata }` | v0.0.2 |
| `EventBus` | `this.eventBus.emit(eventName, data)` for 'match:success', 'match:failed', 'board:changed', 'move:undo', 'board:reshuffle', 'item:freeze' | v0.0.0 |
| `PRNG` | `new PRNG(seed)` → deterministic random for board generation and reshuffle | v0.0.1 |

### Soft Dependencies (enhanced by)
| System | Interface |
|--------|-----------|
| `Solver` | `new Solver().solve(board)` → optimal solution path for causal insight hints |
| `BoardValidator` | `new BoardValidator().validate(board)` → pre-generation validation |

## Tuning Knobs

All knobs are exposed through `Difficulty` presets and per-level overrides in `levels.json`.

| Knob | Config Path | Range | Effect of Too High | Effect of Too Low |
|------|-------------|-------|-------------------|-------------------|
| `fillRate` | `difficulty.fillRate` | 0.32–1.0 | Board too crowded, fewer legal moves, higher deadlock chance | Board too sparse, trivially easy |
| `chainLength` | `difficulty.chainLength` | `[1,2]`–`[8,12]` | Massive rewind cascades wipe board unpredictably | No chain effect, game becomes simple matching |
| `rewindDepth` | `difficulty.rewindDepth` | 1–4 | Every elimination clears half the board | No meaningful chain propagation |
| `rewindCoverage` | `difficulty.rewindCoverage` | 0.1–0.85 | (Not yet wired into generation — forward-looking) | — |
| `directRatio` | `difficulty.directRatio` | 0.15–0.8 | Too few chain tiles, game feels like simple match | Too few direct pairs, game becomes chaos |
| `paradoxRatio` | `difficulty.paradoxRatio` | 0–0.30 | Too many unpredictably-behaving tiles, player frustration | Paradox mechanic doesn't appear enough to matter |
| `crossLayerRatio` | `difficulty.crossLayerRatio` | 0–0.30 | Rewind cascades become too large and unpredictable | Cross-layer mechanic irrelevant |
| `crossLayerDepth` | `difficulty.crossLayerDepth` | 0–3 | Performance risk (recursive traversal depth) | No cross-layer effect |
| `guaranteedPairs` | `level.generator.guaranteedPairs` | 2–5 | — | Fewer guaranteed adjacent pairs, higher deadlock risk |

## Visual/Audio Requirements

- **Elimination**: White flash (200ms) + shrink animation. PARADOX elimination uses purple flash instead.
- **Rewind ripple**: Semi-transparent expanding wave from elimination point, BFS layer-by-layer (300ms per layer). PARADOX-triggered ripples include random perturbation.
- **Cross-layer rewind**: "Echo" ripple appears at distant tiles, delayed 100ms from the main ripple.
- **Chain link indicators**: Small corner marks on tiles showing they participate in chains. Color-coded: blue (chain), orange (cross-chain), purple (paradox).
- **Sound**: Elimination SFX, rewind SFX (layered — volume decreases per layer), paradox elimination has distinct SFX.

## UI Requirements

This is a pure-logic system — it has no UI of its own. UI is implemented by:
- `BoardRenderer` — renders the board state
- `TouchHandler` — translates touch events into engine calls
- `HUD` — displays steps, rewind count, status
- `ResultPanel` — displays win/loss with engine stats

## Acceptance Criteria

- **GIVEN** a 6×8 board with at least one cause→effect adjacent pair, **WHEN** `findLegalMoves()` is called, **THEN** at least one move is returned.
- **GIVEN** a board with only CAUSE tiles remaining, **WHEN** `findLegalMoves()` is called, **THEN** zero moves are returned (no EFFECT to match with).
- **GIVEN** a CAUSE tile dragged to a non-adjacent EFFECT tile of matching color+icon, **WHEN** `canMatch(from, to)` is called, **THEN** result is `{ valid: false, reason: 'not_adjacent' }`.
- **GIVEN** a CAUSE tile dragged to an adjacent CAUSE tile, **WHEN** `canMatch(from, to)` is called, **THEN** result is `{ valid: false, reason: 'target_not_compatible' }`.
- **GIVEN** a valid cause→effect match is processed, **WHEN** the board has chain-linked tiles, **THEN** `rewindLayers.length >= 1` and each layer contains affected tile positions.
- **GIVEN** `freezeNext` is set to true, **WHEN** the next match is processed, **THEN** `rewindLayers` is empty `[]` and `rewindFrozen` is true in the move record.
- **GIVEN** a move was just processed, **WHEN** `undo()` is called, **THEN** the board returns to its exact pre-move state and steps counter decrements.
- **GIVEN** a PARADOX tile (v0.1.1+) adjacent to an EFFECT tile of matching color+icon, **WHEN** `canMatch(paradox, effect)` is called, **THEN** result is `{ valid: true, reason: 'paradox_match' }`.
- **GIVEN** a board with cross-layer links (v0.1.1+), **WHEN** a chain-linked pair is eliminated, **THEN** rewind layers include tiles marked with `relation: 'cross-chain'` at depth ≥ 2.
- **GIVEN** a 48-tile board at max difficulty (rewindDepth=4, crossLayerDepth=3), **WHEN** `_computeRewindLayers` executes, **THEN** it completes in < 10ms.
- **GIVEN** the same seed and difficulty, **WHEN** two boards are generated, **THEN** they are identical (deterministic generation).
- **GIVEN** a generated board for any of the 40 existing levels, **WHEN** validated through batch testing (100 boards each), **THEN** at least one legal move exists on every board (100% solvability at generation time).

## Open Questions

1. **Paradox unpredictability tuning**: Should the `paradoxProb`-based random expansion in rewind be deterministic (seeded) for replay consistency, or truly random for authentic unpredictability? Currently implemented as `Math.random()` — truly random. Consider seeding for competitive fairness.
2. **Cross-layer depth cap**: Is `crossLayerDepth=3` the right maximum, or should it go higher for the hardest difficulties (presets 18-20)? Performance testing needed.
3. **Solver integration for paradox/cross-layer**: The current Solver uses bipartite matching on adjacency only — it doesn't model rewind cascades. For future levels with heavy paradox content, a more sophisticated solver may be needed for solvability verification.
4. **directRatio wiring**: The `directRatio` parameter exists in Difficulty presets but is not consumed by BoardGenerator. Should it control the ratio of chain-linked vs. standalone pairs during generation?
