# ADR-002: Cross-Layer Rewind Implementation Strategy

## Status
Accepted (2026-05-09)

## Context
The current rewind system propagates one hop per depth step along `causalLinks`. The design requires "cross-layer causality" — rewind effects that skip 2-3 hops to trigger distant tiles. This requires a traversal strategy that finds linked tiles at variable depth without breaking the existing BFS layer structure.

## Decision
Cross-layer traversal happens **within each depth step** via a recursive linked-tile search, not as separate depth steps.

```js
// Within each step of the BFS layer loop:
if (crossLayerDepth > 1) {
  const crossLinked = this._getLinkedTilesRecursive(sourceTile, crossLayerDepth, visited);
  candidates.push(...crossLinked.map(t => ({ ..., relation: 'cross-chain' })));
}
```

### _getLinkedTilesRecursive
- Follows `causalLinks` up to `maxDepth` hops
- Uses a shared `visited` Set to prevent cycles
- Returns tiles with their actual hop distance

### Link annotation
- Standard chain link: `{ relation: 'chain', depth: 1 }`
- Cross-layer link: `{ relation: 'cross-chain', depth: 2-3 }`
- BoardGenerator creates cross-chain links between non-adjacent pairs within the same chain

## Alternatives Considered

### A) Extra depth steps in the main BFS loop
- **Rejected**: Would mix cross-layer and normal rewind layers, making animation timing unpredictable. Keeping cross-layer finds in the same step means they animate together.

### B) Pre-computed "extended neighborhood" per tile
- **Rejected**: Storage cost grows with `crossLayerDepth × linkCount`; pre-computation adds generation complexity; dynamic traversal is fast enough (BFS < 10ms target)

## Consequences
- **Positive**: Clean separation of 'chain' vs 'cross-chain' in rewind layer entries; animation timing preserved; no pre-computation storage cost
- **Negative**: Recursive traversal per frontier tile per depth step; need visited-set discipline to prevent cycles
- **Risk**: Medium — performance must be verified at max board (48 tiles, crossLayerDepth=3, chainLength=12). Mitigation: BFS < 10ms target enforced by test

## Related
- ADR-001 (Paradox Tile) — paradox tiles interact with cross-layer traversal
- `src/core/CausalEngine.js` — _computeRewindLayers(), _getLinkedTilesRecursive()
- `src/core/BoardGenerator.js` — _annotateCrossLayer()
