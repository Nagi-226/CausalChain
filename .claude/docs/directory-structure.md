# Directory Structure — 因果律消除

```text
/
├── CLAUDE.md                          # Master configuration
├── VERSION_ROADMAP.md                 # Version roadmap v0.0.1 → v0.1.0
├── causal-chain-elimination-master-prompt.md  # Full game design document
├── game.js                            # Game entry point (WeChat Mini Game)
├── game.json                          # WeChat Mini Game configuration
├── project.config.json                # WeChat DevTools configuration
├── .claude/                           # CCGS framework configuration
│   ├── settings.json                  # Claude Code project settings
│   ├── settings.local.json            # Local settings (gitignored)
│   ├── docs/                          # CCGS documentation
│   │   ├── directory-structure.md     # This file
│   │   ├── technical-preferences.md   # Engine + coding standards
│   │   ├── coordination-rules.md      # Agent coordination rules
│   │   └── skills-reference.md        # Available skills catalog
│   ├── skills/                        # CCGS skill definitions (symlinked/copied)
│   ├── agents/                        # CCGS agent definitions (symlinked/copied)
│   ├── rules/                         # Path-specific coding rules
│   │   ├── gameplay-code.md
│   │   ├── ui-code.md
│   │   ├── prototype-code.md
│   │   └── test-standards.md
│   └── hooks/                         # Hook scripts
├── src/                               # Game source code
│   ├── core/                          # Core game logic
│   │   ├── CausalEngine.js            # Causal chain BFS backtrack engine
│   │   ├── BoardGenerator.js          # Board reverse-generation algorithm
│   │   ├── BoardValidator.js          # Board solvability verification
│   │   ├── Solver.js                  # Optimal solution solver
│   │   └── Difficulty.js              # Difficulty controller
│   ├── render/                        # Rendering
│   │   ├── BoardRenderer.js           # Board drawing
│   │   ├── TileAnimator.js            # Tile animations (drag/eliminate/backtrack)
│   │   ├── EffectRenderer.js          # Special effects (particles/ripples/flash)
│   │   └── CausalPathRenderer.js      # Causal chain path graph generation
│   ├── ui/                            # User interface
│   │   ├── HUD.js                     # Top status bar
│   │   ├── Toolbar.js                 # Bottom item toolbar
│   │   ├── Tutorial.js                # Tutorial guide overlay
│   │   ├── ResultPanel.js             # Win/fail screen
│   │   └── MenuManager.js             # Menu management
│   ├── input/                         # Input handling
│   │   └── TouchHandler.js            # Touch/drag handler
│   ├── social/                        # Social features
│   │   ├── LeaderboardManager.js      # Leaderboard manager
│   │   ├── ShareManager.js            # Share card generation
│   │   └── DailyChallenge.js          # Daily challenge seed
│   ├── monetization/                  # Monetization
│   │   ├── AdManager.js               # Ad manager
│   │   └── ItemManager.js             # Item management
│   ├── data/                          # Data files
│   │   ├── levels.json                # 200-level definitions
│   │   ├── tutorials.json             # Tutorial configuration
│   │   └── strings.json               # String table (i18n placeholder)
│   └── utils/                         # Utilities
│       ├── EventBus.js                # Custom event system
│       ├── ObjectPool.js              # Object pool (reduce GC)
│       └── Timer.js                   # requestAnimationFrame wrapper
├── open-data-context/                 # WeChat Open Data Context
│   └── index.js                       # Friend leaderboard rendering
├── assets/                            # Game assets
│   ├── icons/                         # Causal tile icons (inline SVG, ~50)
│   ├── sounds/                        # Sound effects (.mp3, 4 files)
│   └── themes/                        # World theme color config
├── cloud/                             # Cloud functions
│   └── functions/                     # Leaderboard stats + daily seed
├── design/                            # Game design documents
│   ├── gdd/                           # Per-system GDDs
│   ├── ux/                            # UX specifications
│   ├── art/                           # Art bible + asset specs
│   └── narrative/                     # World themes + lore
├── docs/                              # Technical documentation
│   └── architecture/                  # ADRs + master architecture
├── tests/                             # Test suites
│   ├── unit/                          # Unit tests
│   └── integration/                   # Integration tests
├── prototypes/                        # Throwaway prototypes
├── production/                        # Production management
│   ├── epics/                         # Epic definitions
│   ├── sprints/                       # Sprint plans
│   ├── milestones/                    # Milestone definitions
│   ├── playtests/                     # Playtest reports
│   ├── qa/                            # QA evidence + test plans
│   ├── review-mode.txt                # "lean" / "full" / "solo"
│   ├── session-state/                 # Session state (gitignored)
│   └── session-logs/                  # Session audit trail (gitignored)
└── tools/                             # Build and pipeline tools
```
