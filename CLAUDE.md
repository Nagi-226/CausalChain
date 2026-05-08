# 因果律消除 (Causal Chain Elimination) — WeChat Mini Game

## Project Identity

- **Type**: WeChat Mini Game (Canvas 2D)
- **Language**: JavaScript ES6+
- **Engine**: None (native WeChat Mini Game API + Canvas 2D)
- **Framework**: Claude Code Game Studios (CCGS) — adapted for WeChat Mini Game
- **Repo**: causalChain
- **Design Doc**: `causal-chain-elimination-master-prompt.md`

## Technology Stack

- **Platform**: WeChat Mini Game (微信小游戏)
- **Rendering**: Canvas 2D (native API, no third-party render library)
- **Language**: JavaScript ES6+
- **State Management**: Custom lightweight state machine
- **Level Storage**: Local JSON + WeChat Cloud Development (CDN)
- **Leaderboard**: WeChat Open Data Context + Cloud Development
- **Ads**: WeChat Rewarded Video / Interstitial / Banner SDK
- **Sharing**: wx.shareAppMessage / wx.showShareImageMenu
- **Dev Tools**: Claude Code (AI-assisted coding) + WeChat DevTools

## Project Structure

@.claude/docs/directory-structure.md

## CCGS Integration

This project uses the CCGS framework adapted for WeChat Mini Game:
- CCGS skills from `E:\Open-Source Projects by others\Claude-Code-Game-Studios\.claude\skills\`
- Workflow phases: Concept → Systems Design → Technical Setup → Pre-Production → Production → Polish → Release
- Review mode: `lean` (phase gates only, suitable for solo development)
- Agent team model: Subagents (not experimental agent teams)

## Version Roadmap

@VERSION_ROADMAP.md

## Coding Standards

- Pure JavaScript ES6+, no TypeScript (WeChat Mini Game constraint)
- No third-party game frameworks or render libraries
- Single responsibility per file, clear module boundaries
- Canvas 2D rendering only (no WebGL for MVP)
- All gameplay values data-driven (external config)
- Target: < 1.5 MB main package, < 50 MB memory, 60 FPS

## Key Performance Targets

| Metric | Target |
|--------|--------|
| Startup | < 1.5s |
| Frame rate | 60 FPS (normal), 30 FPS (low-end) |
| Memory | < 50 MB |
| Package | < 1.5 MB |
| BFS backtrack calc | < 10ms (48-tile board) |

## Coordination Rules

@.claude/docs/coordination-rules.md

## Review Mode

`production/review-mode.txt` → `lean`

## Active Version

Current: **v0.0.9 visual polish / release hardening** → Previous: **v0.0.8 done_local_validated** → Target: **v0.1.0**

## Daily AI Tools Monitor

At the end of your first response in a conversation, read `.claude/monitor/last_check.txt`:
- Date = today → skip.
- Date < today → run `.claude/monitor/daily-check.md` workflow. If findings exist, append a brief `---`-separated report (max 8 lines). If no findings, remain silent.
- Never block or delay the user's actual request for this. Never auto-install anything.
