# Epic 2: Social Deepening — Group + Season + Revive

## Scope
v0.1.10 — v0.1.16 (7 sub-versions)

## Summary
Complete the social competitive ecosystem: group leaderboard, monthly season system, share revive item loop, and daily challenge enhancements.

## Sub-versions
| Version | Description | Key Files |
|---------|-------------|-----------|
| v0.1.10 | Group leaderboard — data layer (LeaderboardManager + ShareManager) | `LeaderboardManager.js`, `ShareManager.js`, `game.js` |
| v0.1.11 | Group leaderboard — UI (MenuManager screen + tab switching) | `MenuManager.js`, `game.js` |
| v0.1.12 | Season system — cloud function + data model | `cloud/functions/leaderboard/index.js`, `LeaderboardManager.js` |
| v0.1.13 | Season system — UI + rewards | `MenuManager.js`, `ItemManager.js` |
| v0.1.14 | Share revive — revive item + Toolbar integration | `ItemManager.js`, `Toolbar.js`, `ResultPanel.js` |
| v0.1.15 | Daily challenge — friendship challenge + rank display | `DailyChallenge.js`, `ResultPanel.js` |
| v0.1.16 | Integration testing + bug fixes | All above files, `core.test.mjs` |

## Governing ADRs
- None specific (uses existing architecture patterns)

## Key Integration Points
- `wx.getGroupCloudStorage` for group leaderboard
- `wx.onShow` shareTicket capture for group context
- Cloud function leaderboard collection extensions for season
- ItemManager economy system for revive item and season rewards

## Acceptance Criteria
- [ ] Group leaderboard shows correct rankings after group share
- [ ] Season system correctly tracks, ranks, and rewards monthly
- [ ] Share revive grants item → consumes item → undoes move
- [ ] Daily challenge shows national rank and friend comparison
- [ ] All social features work in mock mode (no WeChat API dependency)
- [ ] No crashes from API unavailability (graceful fallbacks)
