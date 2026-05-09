# ADR-001: Paradox Tile Implementation Strategy

## Status
Accepted (2026-05-09)

## Context
Causal Chain Elimination currently has only two tile types: CAUSE and EFFECT. The design calls for a third type — PARADOX — a tile that simultaneously acts as both cause and effect. This requires decisions about type hierarchy, matching logic, generation, and validation.

## Decision
Paradox is implemented as a **separate, equal tile type** alongside CAUSE and EFFECT in `TILE_TYPES`, not as a subtype or flag on existing types.

```js
const TILE_TYPES = Object.freeze({
  CAUSE: 'cause',
  EFFECT: 'effect',
  PARADOX: 'paradox'
});
```

### Matching logic
`canMatch()` explicitly handles 4 combinations:
1. CAUSE → EFFECT (standard)
2. PARADOX → EFFECT (paradox as source)
3. CAUSE → PARADOX (paradox as target)
4. PARADOX → PARADOX (dual paradox)

### Generation
`BoardGenerator._convertParadox()` selects pairs by ratio and converts both tiles to PARADOX type. A paradox pair sustains itself: one paradox acts as cause, the other as effect.

### Validation
`BoardValidator` accepts PARADOX type. Balance check uses `cause + paradox === effect + paradox`.

## Alternatives Considered

### A) Boolean flag on existing types (`tile.paradox = true`)
- **Rejected**: Would require checking the flag in every type-aware code path. The behavioral difference (can act as both source and target) is fundamental enough to warrant a distinct type.

### B) Union type with `TILE_TYPES.ALL` array
- **Rejected**: Adds indirection without benefit. Explicit branching in canMatch is more readable and debuggable.

## Consequences
- **Positive**: Clear type semantics; simple explicit matching logic; easy to extend with more paradox-specific behavior (e.g., paradox-only rewind effects)
- **Negative**: Every type-checking location needs a PARADOX branch; balance validation is now a 3-variable equation instead of 2
- **Risk**: Low. The explicit matching logic prevents unintended paradox interactions

## Related
- ADR-002 (Cross-Layer Rewind) — paradox tiles have special rewind behavior
- `src/core/CausalEngine.js` — TILE_TYPES, canMatch(), findLegalMoves()
- `src/core/BoardGenerator.js` — _convertParadox()
- `src/core/BoardValidator.js` — validate()
