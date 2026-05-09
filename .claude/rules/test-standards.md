---
paths:
  - "tests/**"
---

# Test Standards

- Tests use plain `node:assert/strict` — no test framework needed (WeChat Mini Game constraint)
- Test naming: describe what is tested in the assertion block comment or console label
- Every test must have a clear arrange/act/assert structure
- Unit tests must not depend on external state (filesystem, network, WeChat APIs — use mocks)
- Smoke tests (`_smoke_test*.js`) verify module loading and end-to-end integration
- Performance tests must specify acceptable thresholds and fail if exceeded
- Test data must be defined inline (self-contained tests — no shared mutable fixtures)
- Mock external dependencies (wx, cloud, ads) — tests should be fast and deterministic
- Every bug fix must include a regression test that would have caught the original bug
- Run `node tests/unit/core.test.mjs` before every commit

## Examples

**Correct** (descriptive block + AAA):
```js
// Paradox match: CAUSE + PARADOX with matching color/icon
{
  const board = buildBoard([['cause', 0, 0, 'crimson', 'spark'], ['paradox', 0, 1, 'crimson', 'spark']]);
  const engine = new CausalEngine({ board });
  const result = engine.canMatch({ row: 0, col: 0 }, { row: 0, col: 1 });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.reason, 'paradox_match');
}
```

**Incorrect**:
```js
// VIOLATION: no arrange/act/assert structure, vague assertions
const e = new CausalEngine({ board: someGlobalBoard });
assert.ok(e.canMatch(a, b));
```
