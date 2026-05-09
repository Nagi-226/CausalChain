# ADR-003: Level Data Lazy Loading Strategy

## Status
Proposed (2026-05-09)

## Context
v0.2.0 will have 160 levels across 8 worlds. Keeping all level definitions in a single `levels.json` bundled in the main package would:
- Increase main package size (estimated ~100KB for 160 levels)
- Waste bandwidth for players who only play early worlds
- Risk exceeding WeChat Mini Game's main package limit over time

The main package must stay under 1.5 MB.

## Decision
Split level data by world, keep only worlds 1-2 in the main package, and lazy-load the rest.

```
src/data/
├── levels-w1-2.json    (40 levels)  → bundled in main package
├── levels-w3-4.json    (40 levels)  → lazy loaded
├── levels-w5-6.json    (40 levels)  → lazy loaded
└── levels-w7-8.json    (40 levels)  → lazy loaded
```

### LevelLoader utility
- `LevelLoader.loadWorld(worldId)` — returns level array for a world
- Cache in `wx.getFileSystemManager()` user data directory
- On cache miss, fetch from cloud storage
- Preload strategy: load current world + next world in background

### Fallback
- If cloud fetch fails (no network), show "Download required" prompt
- Worlds 1-2 are always available offline

## Alternatives Considered

### A) Keep all 160 levels in main package
- **Rejected**: Main package grows ~75KB; risk of exceeding 1.5 MB limit as other assets grow

### B) Cloud-only (no local bundling)
- **Rejected**: Adds network dependency even for world 1-2; startup experience degrades for all players

### C) Per-level lazy loading (not per-world)
- **Rejected**: 160 individual network requests is excessive; world-level grouping balances granularity with request count

## Consequences
- **Positive**: Main package stays lean; players not blocked by network for early levels; cloud storage cost proportional to actual usage
- **Negative**: First entry to world 3+ requires network; network failure handling needed; LevelLoader adds complexity
- **Risk**: Low — worlds 1-2 cover 40 levels, enough for initial player retention while worlds 3+ download

## Related
- `src/utils/LevelLoader.js` — new utility
- `game.js` — level data loading flow
- `src/data/levels-w*.json` — split files
