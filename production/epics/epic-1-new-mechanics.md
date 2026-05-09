# Epic 1: New Mechanics — Paradox + Cross-Layer Causality

## Scope
v0.1.1 — v0.1.9 (9 sub-versions)

## Summary
Introduce two new causal mechanics (paradox tiles, cross-layer rewind), expand difficulty system to 20 levels, and create worlds 3-4 with 40 new levels.

## Sub-versions
| Version | Description | Key Files |
|---------|-------------|-----------|
| v0.1.1 | Difficulty presets 11-20 + new params | `Difficulty.js` |
| v0.1.2 | Paradox matching logic in engine | `CausalEngine.js` |
| v0.1.3 | Paradox board generation + validation | `BoardGenerator.js`, `BoardValidator.js` |
| v0.1.4 | Paradox visual rendering | `BoardRenderer.js`, `TileAnimator.js` |
| v0.1.5 | Cross-layer engine + generation | `CausalEngine.js`, `BoardGenerator.js` |
| v0.1.6 | Cross-layer visual + animation | `CausalPathRenderer.js`, `EffectRenderer.js` |
| v0.1.7 | World 3 "Gear Mechanical" theme + 20 levels (41-60) | `themes.json`, `levels.json`, `strings.json` |
| v0.1.8 | World 4 "Jungle Butterfly Storm" theme + 20 levels (61-80) | `themes.json`, `levels.json`, `strings.json` |
| v0.1.9 | World 3-4 tuning + difficulty curve validation | `levels.json`, `core.test.mjs` |

## Governing ADRs
- ADR-001: Paradox Tile Implementation Strategy
- ADR-002: Cross-Layer Rewind Implementation Strategy

## Engine Foundation (Already Implemented)
The following engine changes are already in place as architectural foundation:
- `Difficulty.js`: PRESETS 11-20, paradoxRatio/crossLayerRatio/crossLayerDepth params, clamp to 20
- `CausalEngine.js`: TILE_TYPES.PARADOX, canMatch() paradox logic, findLegalMoves() paradox support, _getLinkedTilesRecursive(), cross-layer in _computeRewindLayers()
- `BoardGenerator.js`: _convertParadox(), _annotateCrossLayer()
- `BoardValidator.js`: paradox type acceptance, updated balance check

**These changes should be extracted and committed per sub-version (v0.1.1-v0.1.5) rather than as a single monolithic commit.**

## Acceptance Criteria
- [ ] Difficulty presets 1-20 all return valid configs
- [ ] Paradox tiles match correctly in all 4 type combinations
- [ ] Paradox boards pass validation and have legal moves
- [ ] Paradox tiles visually distinct (purple border, dual arrow icon)
- [ ] Cross-layer links generated and traversed correctly
- [ ] Cross-layer rewind appears as distinct visual effect
- [ ] World 3 theme (gear) renders correctly
- [ ] World 4 theme (jungle) renders correctly
- [ ] All 80 levels pass solvability validation (≥ 95% average)
