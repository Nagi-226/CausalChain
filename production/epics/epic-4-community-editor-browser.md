# Epic 4: Community — Level Editor + Browser

## Scope
v0.2.5 — v0.2.10 (6 sub-versions)

## Summary
Build a complete DIY level creation and sharing ecosystem: Canvas-based level editor, cloud-published community levels, browser with sorting/filtering, and community share cards.

## Sub-versions
| Version | Description | Key Files |
|---------|-------------|-----------|
| v0.2.5 | Editor — basic grid + tile placement | `LevelEditor.js` (new), `game.js` |
| v0.2.6 | Editor — test mode + draft save/load | `LevelEditor.js`, `game.js` |
| v0.2.7 | Editor — publish + cloud function | `LevelEditor.js`, `cloud/functions/leaderboard/index.js` |
| v0.2.8 | Community browser — list + sort + filter | `CommunityBrowser.js` (new), `MenuManager.js`, cloud function |
| v0.2.9 | Community browser — load/play/rate levels | `CommunityBrowser.js`, `game.js`, cloud function |
| v0.2.10 | Community share cards + deep links | `ShareManager.js`, `game.js` |

## Governing ADRs
- ADR-004: Level Editor Implementation Strategy
- ADR-005: Community Level Storage Strategy

## New Files
- `src/ui/LevelEditor.js` — level editor widget
- `src/ui/CommunityBrowser.js` — community browser widget
- `src/utils/LevelLoader.js` — lazy level data loader

## Cloud Function Extensions
- `publishCommunityLevel` — validate and store
- `getCommunityLevels` — paginated query with sort
- `submitCommunityPlayResult` — play/clear/stars tracking
- `rateCommunityLevel` — rating update

## Acceptance Criteria
- [ ] Editor can create a valid, playable level from scratch
- [ ] Draft save/load works reliably
- [ ] Published levels appear in community browser
- [ ] Community levels can be loaded, played, and rated
- [ ] Community share card deep-links correctly
- [ ] All editor/community features work in mock mode
- [ ] No more than 5 published levels per user
