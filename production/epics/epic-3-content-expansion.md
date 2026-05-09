# Epic 3: Content Expansion — Worlds 5-8

## Scope
v0.2.0 — v0.2.4 (5 sub-versions)

## Summary
Add 80 new levels across 4 new worlds, implement level data lazy loading, and maintain main package size under 1.5 MB.

## Sub-versions
| Version | Description | Key Files |
|---------|-------------|-----------|
| v0.2.0 | World 5 "Web of Fate" Crystal Cave theme + 20 levels (81-100) | `themes.json`, `levels.json`, `strings.json` |
| v0.2.1 | World 6 "Time Maze" Desert Ruins theme + 20 levels (101-120) + layer mechanics | `themes.json`, `levels.json`, `BoardGenerator.js`, `BoardRenderer.js` |
| v0.2.2 | World 7 "Causal Abyss" Volcano theme + 20 levels (121-140) | `themes.json`, `levels.json` |
| v0.2.3 | World 8 "Eternal Paradox" Star Field theme + 20 levels (141-160) | `themes.json`, `levels.json` |
| v0.2.4 | Level data split + lazy loading + package optimization | `LevelLoader.js`, `levels-w*.json`, `game.js` |

## Governing ADRs
- ADR-003: Level Data Lazy Loading Strategy

## New Themes
| World | Theme Key | Palette |
|-------|-----------|---------|
| 5 | crystal | Purple/cyan/crystal white |
| 6 | desert | Sand/terracotta/turquoise |
| 7 | volcano | Crimson/orange/black |
| 8 | starfield | Deep space black/white/gold |

## Acceptance Criteria
- [ ] All 4 new themes render correctly with distinct visual identity
- [ ] 80 new levels pass solvability validation (≥ 85% average at high difficulty)
- [ ] Main package < 1.5 MB
- [ ] Worlds 3-8 levels load on demand without blocking gameplay
- [ ] Offline fallback for unloaded worlds works correctly
