---
paths:
  - "src/data/**"
  - "assets/themes/**"
---

# Data File Rules

- All JSON files must be valid JSON — broken JSON blocks the entire level loading pipeline
- Every data file must have a `version` field for schema migration tracking
- Use consistent key naming: camelCase for keys within JSON files
- Numeric values must be accompanied by inline comments or companion docs explaining their meaning
- No orphaned data entries — every level/themes/strings entry must be referenced by code
- Version data files when making breaking schema changes (bump the version field)
- Strings must use dot-path keys (e.g. `"menu.dailyChallenge"`), no hardcoded strings in code
- Theme data is purely declarative (colors, sizes, opacity) — no logic in JSON
- Level data references theme by ID string — theme and level data are independent

## Examples

**Correct** (levels.json entry):
```json
{
  "id": 41,
  "nameKey": "levels.41.name",
  "seed": "paradox-gate-41",
  "difficulty": 5,
  "fillRate": 0.58,
  "minimumSteps": 14,
  "theme": "gear",
  "generator": {
    "colors": 3,
    "icons": 3,
    "chainLength": 3,
    "paradoxRatio": 0.08,
    "relationMode": "paradox-intro"
  }
}
```

**Incorrect**:
```json
{
  "id": 41,
  "name": "Hard Level 41",
  "diff": 5
}
```
Violations: hardcoded name instead of `nameKey`, abbreviated key `diff` instead of `difficulty`, missing required generator fields.
