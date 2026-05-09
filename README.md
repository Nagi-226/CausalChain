# 🕰️ Causal Chain Elimination · 因果律消除

> A WeChat Mini Game that innovates on both gameplay and social layers of casual puzzles.  
> Drag cause tiles onto effect tiles — but every elimination rewinds time.

[![Version](https://img.shields.io/badge/version-v0.1.0-blue)](#)
[![Platform](https://img.shields.io/badge/platform-WeChat%20Mini%20Game-green)](https://developers.weixin.qq.com/minigame/dev/guide/)
[![Language](https://img.shields.io/badge/language-JavaScript%20ES6%2B-yellow)](#)
[![License](https://img.shields.io/badge/license-MIT-brightgreen)](./LICENSE)
[![Package Size](https://img.shields.io/badge/package-0.35%20MB-lightgrey)](#)

---

## 🎮 What Is This?

**Causal Chain Elimination** is a puzzle game where every move has consequences. You drag **cause tiles** onto matching **effect tiles** to eliminate them — but each elimination triggers a **time-rewind ripple** that cascades through causally-linked tiles on the board.

The result: a game where simple rules produce deep strategic decisions, and every completed level generates a unique **causal chain path diagram** that serves as both a shareable artwork and a competitive benchmark.

### Core Mechanic (3 seconds to understand)

```
Drag [Cause] → adjacent [Effect] with matching color+icon → Eliminate → Watch rewind ripple spread
```

### Four Causality Types

| Type | Description | Appears In |
|------|-------------|------------|
| **Direct** | Cause A → Effect A | World 1 (Levels 1–20) |
| **Chain** | Cause A → Effect B → Cause C → Effect D (BFS rewind) | Worlds 1–2 (Levels 15–40) |
| **Paradox** | A tile that is simultaneously cause AND effect (purple border) | Worlds 3–4 (Levels 41–80) |
| **Cross-layer** | Rewind skips 2–3 hops to trigger distant tiles | Worlds 3–4 (Levels 61–80) |

---

## 📂 Project Structure

```
causalChain/
├── game.js                    # Game entry point + main loop
├── game.json                  # WeChat Mini Game config
├── project.config.json        # WeChat DevTools config
├── src/
│   ├── core/                  # Core game logic
│   │   ├── CausalEngine.js    #   Causal chain BFS backtrack engine
│   │   ├── BoardGenerator.js  #   Reverse-generation algorithm
│   │   ├── BoardValidator.js  #   Solvability verification
│   │   ├── Solver.js          #   Optimal solution solver
│   │   └── Difficulty.js      #   Difficulty controller (20 presets)
│   ├── render/                # Canvas 2D rendering
│   │   ├── BoardRenderer.js   #   Board + tile drawing
│   │   ├── TileAnimator.js    #   Drag/eliminate/rewind animations
│   │   ├── EffectRenderer.js  #   Particle/ripple/flash effects
│   │   └── CausalPathRenderer.js  # Causal chain path visualization
│   ├── ui/                    # User interface (Widget pattern)
│   │   ├── HUD.js             #   Top status bar
│   │   ├── Toolbar.js         #   Bottom item toolbar
│   │   ├── Tutorial.js        #   Tutorial overlay
│   │   ├── ResultPanel.js     #   Win/fail screen
│   │   └── MenuManager.js     #   Menu management
│   ├── input/                 # Touch/drag handling
│   │   └── TouchHandler.js
│   ├── social/                # Social features
│   │   ├── LeaderboardManager.js  # Friend/province leaderboard
│   │   ├── ShareManager.js        # Causal chain share card
│   │   └── DailyChallenge.js      # Daily challenge seed
│   ├── monetization/          # Ads + items
│   │   ├── AdManager.js       #   Rewarded/interstitial/banner
│   │   └── ItemManager.js     #   Freeze/reveal/undo/shuffle
│   ├── audio/                 # Sound system
│   │   └── SoundManager.js
│   ├── data/                  # Data files
│   │   ├── levels.json        #   40 level definitions
│   │   ├── strings.json       #   i18n string table
│   │   ├── tutorials.json     #   Tutorial config
│   │   ├── audio.json         #   Sound manifest
│   │   └── release-config.sample.json  # Ad/cloud config template
│   └── utils/                 # Utilities
│       ├── EventBus.js        #   Custom event system
│       ├── ObjectPool.js      #   Object pool (reduce GC)
│       └── Timer.js           #   requestAnimationFrame wrapper
├── assets/
│   ├── themes/themes.json     # World theme color configs
│   └── sounds/                # 6 sound effects (.wav)
├── cloud/functions/           # WeChat Cloud Functions
│   ├── dailyChallenge/        #   Daily seed + ranking
│   └── leaderboard/           #   Province leaderboard
├── open-data-context/         # WeChat Open Data Context
│   └── index.js               #   Friend leaderboard rendering
├── design/gdd/                # Game design documents
│   ├── game-concept.md        #   Game concept + pillars
│   ├── systems-index.md       #   System dependency map
│   └── causal-engine.md       #   CausalEngine formal GDD
├── docs/architecture/         # Architecture Decision Records
│   ├── ADR-001-paradox-tile.md
│   ├── ADR-002-cross-layer-rewind.md
│   ├── ADR-003-level-data-lazy-loading.md
│   ├── ADR-004-level-editor-canvas.md
│   └── ADR-005-community-level-storage.md
├── production/                # Production management
│   ├── epics/                 #   4 epic definitions
│   ├── gate-checks/           #   Phase gate reports
│   ├── sprints/               #   Sprint plans
│   └── qa/                    #   QA evidence
└── tests/                     # Test suites
    └── unit/core.test.mjs     #   Core unit tests
```

---

## 🚀 Quick Start

### Prerequisites

- [WeChat DevTools](https://developers.weixin.qq.com/minigame/dev/devtools/download.html) (微信开发者工具)
- A WeChat Mini Game AppID (register at [mp.weixin.qq.com](https://mp.weixin.qq.com/))

### Local Development

```bash
# Clone the repository
git clone https://github.com/Nagi-226/CausalChain.git
cd CausalChain

# Run unit tests (Node.js — no WeChat required)
node tests/unit/core.test.mjs

# Run smoke tests
node _smoke_test.js
node _smoke_test2.js
```

### WeChat DevTools

1. Open **WeChat DevTools** (微信开发者工具)
2. Import project → select the cloned directory
3. Enter your Mini Game AppID
4. Click "Compile" to preview

### Configuration

```bash
# Copy the release config template
cp src/data/release-config.sample.json src/data/release-config.local.json

# Edit with your real WeChat ad unit IDs and cloud environment
# (Leave as-is for local mock-mode development)
```

---

## 🧪 Testing

```bash
# Unit tests (core engine logic)
node tests/unit/core.test.mjs

# Smoke test 1 (module loading + integration)
node _smoke_test.js

# Smoke test 2 (end-to-end gameplay flows)
node _smoke_test2.js
```

All tests run in **Node.js** without WeChat APIs — the engine supports full mock mode.

---

## 🏗 Architecture

### Design Philosophy

- **Pure Canvas 2D** — No third-party game framework. All rendering is native WeChat Canvas API.
- **Data-driven** — Every gameplay value comes from `Difficulty.js` presets or `levels.json`. Nothing is hardcoded.
- **Widget pattern** — All UI classes implement `setLayout(w, h)`, `draw(ctx)`, `handleTap(x, y)`, `update(state)`. They communicate via command objects, never by mutating game state directly.
- **Deterministic** — Board generation uses seeded PRNG. Same seed + same difficulty = same board.

### Key Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Package size | < 1.5 MB | 0.35 MB ✅ |
| Frame rate | 60 FPS (30 FPS low-end) | ✅ |
| Memory | < 50 MB | ✅ |
| BFS backtrack | < 10ms (48-tile board) | ✅ |
| Startup time | < 1.5s (mid-range device) | ✅ |

### Widget Pattern (UI Architecture)

```
┌────────────────────────────────────────┐
│              CausalChainGame            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐ │
│  │ HUD  │ │Toolbar│ │Menu  │ │Result │ │
│  │      │ │      │ │Mgr   │ │Panel  │ │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬────┘ │
│     │        │        │        │       │
│     └────────┴────────┴────────┘       │
│          handleTap() → commands        │
│          update(state) ← game          │
└────────────────────────────────────────┘
```

---

## 📋 Development Status

### Completed (v0.0.1 – v0.0.9)
- [x] Core causal matching + BFS rewind engine
- [x] Reverse board generation (deterministic, seeded)
- [x] 40 levels across 2 worlds (Starlight, Ripple Sea)
- [x] Chain causality (2–3 hop rewind chains)
- [x] 4 item system (freeze, reveal, undo, shuffle)
- [x] Rewarded/interstitial/banner ads (mock + real)
- [x] Friend + province leaderboard
- [x] Causal chain path diagram share cards
- [x] Daily challenge (deterministic seed)
- [x] Theme-aware rendering (atmosphere, particles, board panel)
- [x] Performance profiles (low-end 30 FPS detection)
- [x] Settings (sound, low-motion, colorblind)
- [x] Sound effects (6 sounds)
- [x] Move budget gameplay rule + daily challenge best-record

### Planned (v0.1.0 – v0.2.0)
- [ ] Paradox causality (v0.1.2–v0.1.4)
- [ ] Cross-layer causality (v0.1.5–v0.1.6)
- [ ] Worlds 3–4: Gear Mechanical + Jungle (v0.1.7–v0.1.8)
- [ ] Group leaderboard + Season system (v0.1.10–v0.1.13)
- [ ] Share revive + daily challenge enhancements (v0.1.14–v0.1.15)
- [ ] Worlds 5–8: Crystal Cave, Desert Ruins, Volcano, Star Field (v0.2.0–v0.2.3)
- [ ] DIY Level Editor + Community Browser (v0.2.5–v0.2.10)

See [`VERSION_ROADMAP.md`](./VERSION_ROADMAP.md) and [detailed plan](.claude/plans/dazzling-sparking-gizmo.md) for the full 28-sub-version roadmap.

---

## 🤝 Contributing

### Development Workflow

1. **Architecture planning** happens via Claude Code (this repo's primary AI assistant). Architecture Decision Records (ADRs) and game design documents (GDDs) are committed to `docs/architecture/` and `design/gdd/`.

2. **Feature implementation** uses a multi-agent collaborative approach — different AI coding assistants (Codex CLI, Cursor) handle different domains to avoid task conflicts:
   - **Claude Code** → Architecture planning, system design, code audit
   - **Codex CLI** → Gameplay feature development (engine, logic, tests)
   - **Cursor (Gemini)** → UI polish and visual refinement

3. **Before committing** — Run the test suite:
   ```bash
   node tests/unit/core.test.mjs
   ```

### Coding Standards

See [`.claude/rules/`](.claude/rules/) for path-scoped coding rules:
- `gameplay-code.md` — No hardcoded values, delta-time for animations, EventBus for cross-system communication
- `ui-code.md` — Widget pattern, localization via `strings.json`, commands not direct mutation
- `test-standards.md` — Arrange/Act/Assert, deterministic tests, mock external APIs
- `data-files.md` — Valid JSON with version field, camelCase keys, documented schemas

### Project Configuration

This project uses [Claude Code](https://claude.ai/code) with the [CCGS (Claude Code Game Studios)](https://github.com/anthropics/claude-code) framework adapted for solo WeChat Mini Game development. See [`CLAUDE.md`](./CLAUDE.md) for AI assistant configuration.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) file for details.

The game design (`causal-chain-elimination-master-prompt.md`, `design/gdd/`) and visual assets are also MIT-licensed.

---

## 🔗 Links

- **GitHub**: [github.com/Nagi-226/CausalChain](https://github.com/Nagi-226/CausalChain)
- **WeChat Mini Game Docs**: [developers.weixin.qq.com/minigame](https://developers.weixin.qq.com/minigame/dev/guide/)
- **Game Design Document**: [`causal-chain-elimination-master-prompt.md`](./causal-chain-elimination-master-prompt.md)
- **CCGS Framework**: [Claude Code Game Studios](https://github.com/anthropics/claude-code)

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Nagi-226">Nagi_226</a> + Claude Code + Codex CLI + Cursor</sub>
</p>
