# ADR-004: Level Editor Implementation Strategy

## Status
Proposed (2026-05-09)

## Context
The game needs a DIY level editor where players can create and share custom levels. The WeChat Mini Game environment has no DOM, no standard UI controls, no rich text input. The editor must be built entirely on Canvas 2D.

## Decision
Implement the level editor as a **pure Canvas 2D widget** following the existing Widget pattern (`setLayout`, `draw`, `handleTap`, `update`), not as a WebView or separate mini-program page.

### Architecture
```
src/ui/LevelEditor.js    → Widget following existing pattern
game.js                   → editorMode flag, routes to LevelEditor instead of BoardRenderer+TouchHandler
```

### Editor modes
1. **Place mode**: Tap grid cells to place tiles (cycle: cause → effect → paradox → empty)
2. **Config mode**: Select color (3 options) and icon (3 options) for next placement
3. **Link mode**: Drag between tiles to create/remove causalLinks (v0.2.6+)
4. **Test mode**: Play the level with full engine integration
5. **Publish mode**: Validate, title, and upload

### Text input
Since Canvas 2D has no text input, the title is set via `wx.showKeyboard` (WeChat API) or a pre-filled default ("Untitled Level #N").

## Alternatives Considered

### A) WebView-based editor
- **Rejected**: WebView has different lifecycle, performance overhead, and communication complexity with the game context. Mini Game → WebView → Mini Game round-trips add latency.

### B) Separate mini-program page
- **Rejected**: Requires app restructuring; increases complexity; breaks the single-codebase model

### C) Simplified "auto-generate only" editor (no manual placement)
- **Rejected**: Removes the creative core of the editor; players want to design specific layouts, not just tune parameters

## Consequences
- **Positive**: Consistent Canvas 2D rendering; reuses BoardRenderer for editor grid; follows existing Widget pattern; no dependency on external UI frameworks
- **Negative**: Text input is cumbersome; no undo/redo out of the box (must implement manually); complex UI requires careful hit-testing
- **Risk**: Medium — editor complexity could balloon. Mitigation: MVP editor (v0.2.5-v0.2.6) supports only placement + test + save; advanced features (link mode, multi-select) deferred

## Related
- `src/ui/LevelEditor.js` — new file
- `src/ui/MenuManager.js` — editor entry point
- `game.js` — editorMode
- ADR-005 (Community Level Storage)
