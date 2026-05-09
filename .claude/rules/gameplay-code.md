---
paths:
  - "src/core/**"
---

# Gameplay Code Rules

- ALL gameplay values MUST come from external config/data files, NEVER hardcoded
- Difficulty parameters (fillRate, chainLength, paradoxRatio, etc.) come from `Difficulty.js` presets or `levels.json`
- Use delta time (dt) for ALL time-dependent calculations (animations, countdowns)
- NO direct references to UI code — use EventBus events for cross-system communication
- Every gameplay module must expose a clear public API (methods with documented signatures)
- State machines must have explicit transitions — CausalEngine.getStatus() is the canonical example
- Write unit tests for all gameplay logic — separate logic from rendering

## Examples

**Correct** (data-driven):
```js
// Values from Difficulty presets
const fillRate = this.difficulty.fillRate;
const chainRange = this.difficulty.chainLength;

// Delta-time driven animation
this.elapsed += dt;
this.progress = Math.min(1, this.elapsed / this.duration);
```

**Incorrect** (hardcoded):
```js
// VIOLATION: hardcoded gameplay value
const fillRate = 0.75;
const chainMin = 5, chainMax = 8;

// VIOLATION: not using delta time
this.x += 5;
```
