# v0.1.0 Release Readiness Checklist

## Local Checks (PASS)

| Check | Result |
|-------|--------|
| 40 levels solvable (20 boards each) | 40/40 PASS |
| Package size (< 1.5 MB) | 0.25 MB PASS |
| 100 consecutive levels no crash | PASS |
| Syntax check all .js/.mjs | PASS |
| core.test.mjs | PASS |
| _smoke_test.js | PASS |
| _smoke_test2.js | PASS |

## Pre-Release (requires WeChat DevTools / real device)

- [ ] Replace placeholder ad-unit IDs in AdManager.js with real WeChat ad IDs
- [ ] Deploy cloud/functions/dailyChallenge to WeChat Cloud Development
- [ ] Deploy cloud/functions/leaderboard to WeChat Cloud Development
- [ ] Real device test: iOS WeChat 8.0+
- [ ] Real device test: Android WeChat 8.0+
- [ ] Real device test: low-end Android (2GB RAM, 30 FPS mode)
- [ ] Screen adapt: 375px, 390px, 414px, 428px widths
- [ ] WeChat review self-check (content compliance, no hidden features, privacy)
- [ ] Share card display verification
- [ ] Ad fill test (rewarded/interstitial/banner)
- [ ] Open Data Context leaderboard rendering verification
