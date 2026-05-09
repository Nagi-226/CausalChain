# Systems Index — 因果律消除

> **Status**: Bootstrapped from codebase structure
> **Last Updated**: 2026-05-09

## MVP Systems (Implemented — v0.0.1–v0.0.9)

| Priority | System | Category | Layer | GDD | Status |
|----------|--------|----------|-------|-----|--------|
| P0 | CausalEngine | Foundation | Core | `design/gdd/causal-engine.md` | Designed (8 sections) |
| P0 | BoardGenerator | Foundation | Core | — | Code-only |
| P0 | BoardValidator | Foundation | Core | — | Code-only |
| P1 | BoardRenderer | Rendering | UI | — | Code-only |
| P1 | TouchHandler | Input | Core | — | Code-only |
| P1 | TileAnimator | Rendering | Animation | — | Code-only |
| P1 | EffectRenderer | Rendering | VFX | — | Code-only |
| P2 | HUD | UI | UI | — | Code-only |
| P2 | Toolbar | UI | UI | — | Code-only |
| P2 | Tutorial | UI | UI | — | Code-only |
| P2 | MenuManager | UI | UI | — | Code-only |
| P2 | ResultPanel | UI | UI | — | Code-only |
| P3 | ItemManager | Economy | Monetization | — | Code-only |
| P3 | AdManager | Economy | Monetization | — | Code-only |
| P3 | LeaderboardManager | Social | Social | — | Code-only |
| P3 | ShareManager | Social | Social | — | Code-only |
| P3 | DailyChallenge | Social | Social | — | Code-only |
| P4 | Difficulty | Foundation | Data | — | Code-only |
| P4 | Solver | Foundation | Core | — | Code-only |

## Planned Systems (v0.1.0–v0.2.0)

| Priority | System | Category | Layer | GDD | Status |
|----------|--------|----------|-------|-----|--------|
| P1 | ParadoxCausality (extends CausalEngine) | Foundation | Core | In CausalEngine GDD | Planned |
| P1 | CrossLayerRewind (extends CausalEngine) | Foundation | Core | In CausalEngine GDD | Planned |
| P2 | CausalPathRenderer | Rendering | VFX | — | Planned |
| P3 | GroupLeaderboard (extends LeaderboardManager) | Social | Social | — | Planned |
| P3 | SeasonSystem | Social | Social | — | Planned |
| P4 | LevelEditor | UI | Tool | — | Planned |
| P4 | CommunityBrowser | UI | UI | — | Planned |
| P4 | LevelLoader | Foundation | Data | — | Planned |

## Dependencies Graph

```
CausalEngine ◄── BoardGenerator, BoardValidator, Solver
BoardGenerator ◄── Difficulty
BoardRenderer ◄── CausalEngine, TileAnimator, EffectRenderer
TouchHandler ◄── BoardRenderer, CausalEngine, TileAnimator
HUD, Toolbar, Tutorial, MenuManager, ResultPanel ◄── CausalEngine (via commands)
ItemManager ◄── CausalEngine (adapter methods)
LeaderboardManager, ShareManager, DailyChallenge ◄── CausalEngine (state)
```

## Design Order (by dependency depth)

1. CausalEngine (no dependencies — foundation)
2. Difficulty (no dependencies — data)
3. BoardGenerator (depends on CausalEngine, Difficulty)
4. BoardValidator, Solver (depend on CausalEngine)
5. BoardRenderer, TileAnimator, EffectRenderer (depend on CausalEngine)
6. TouchHandler (depends on BoardRenderer, CausalEngine)
7. All UI widgets (depend on CausalEngine via commands)
8. Social/Monetization modules (depend on CausalEngine state)
