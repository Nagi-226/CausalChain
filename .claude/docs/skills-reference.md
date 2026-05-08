# Skills Reference — 因果律消除

Adapted from CCGS framework (68 skills). Below are the 19 skills copied for this project, organized by phase.

## Onboarding & Navigation

| Command | Purpose |
|---------|---------|
| `/brainstorm` | Guided ideation using MDA, SDT, Bartle, verb-first frameworks |

## Game Design

| Command | Purpose |
|---------|---------|
| `/design-system` | Guided, section-by-section GDD authoring for a single game system |
| `/map-systems` | Decompose game concept into systems, map dependencies, prioritize design order |
| `/ux-design` | Guided section-by-section UX spec authoring (screen/flow, HUD, or pattern library) |

## Architecture

| Command | Purpose |
|---------|---------|
| `/architecture-decision` | Create an Architecture Decision Record (ADR) |

## Stories & Sprints

| Command | Purpose |
|---------|---------|
| `/create-epics` | Translate GDDs + ADRs into epics — one per architectural module |
| `/create-stories` | Break a single epic into implementable story files |
| `/dev-story` | Read a story and implement it — routes to the correct programmer agent |
| `/sprint-plan` | Generate or update a sprint plan; initializes sprint-status.yaml |
| `/story-done` | 8-phase completion review after implementation; updates story file |

## Reviews & Analysis

| Command | Purpose |
|---------|---------|
| `/code-review` | Architectural code review for a file or changeset |
| `/perf-profile` | Structured performance profiling with bottleneck identification |
| `/gate-check` | Validate readiness to advance between development phases (PASS/CONCERNS/FAIL) |

## QA & Testing

| Command | Purpose |
|---------|---------|
| `/smoke-check` | Run critical path smoke test gate before QA hand-off |
| `/bug-report` | Create a structured bug report |

## Production

| Command | Purpose |
|---------|---------|
| `/playtest-report` | Generate a structured playtest report or analyze existing playtest notes |

## Release

| Command | Purpose |
|---------|---------|
| `/changelog` | Auto-generate changelog from git commits and sprint data |
| `/patch-notes` | Generate player-facing patch notes from git history and internal data |

## Creative & Content

| Command | Purpose |
|---------|---------|
| `/prototype` | Rapid throwaway prototype to validate a mechanic (relaxed standards, isolated worktree) |

---

## Review Mode

Current: `lean` (set in `production/review-mode.txt`)

- `lean`: Only phase gates run (via `/gate-check`). Per-skill director gates skipped. **Best for solo dev.**
- `full`: All gates active. Every workflow step reviewed by directors.
- `solo`: No gates. Maximum speed. Use for prototypes.

## Skills NOT Copied

The following CCGS skills are engine-specific or not needed yet:
- Engine: `setup-engine`, `godot-*`, `unity-*`, `ue-*`
- Art: `art-bible`, `asset-audit`, `asset-spec`
- Audio: Team audio skills
- Advanced: `localize`, `hotfix`, `consistency-check`, `content-audit`
- Team orchestration: `team-*` (requires experimental agent teams)

Copy these from `E:\Open-Source Projects by others\Claude-Code-Game-Studios\.claude\skills\` as needed.
