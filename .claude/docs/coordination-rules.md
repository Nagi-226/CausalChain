# Agent Coordination Rules — 因果律消除

Adapted from CCGS framework for solo WeChat Mini Game development.

## Model Tier Assignment

| Tier | Model | When to use |
|------|-------|-------------|
| **Haiku** | `claude-haiku-4-5-20251001` | Read-only status checks, formatting, simple lookups |
| **Sonnet** | `claude-sonnet-4-6` | Implementation, design authoring, analysis — default |
| **Opus** | `claude-opus-4-6` | Multi-document synthesis, phase gate verdicts, cross-system review |

## Review Modes

- `lean` (current): Phase gates only. Per-skill director gates skipped. Best for solo dev.
- `full`: All gates active. Every workflow step reviewed by directors.
- `solo`: No gates. Maximum speed. Use for prototypes and experiments.

Set via `production/review-mode.txt`.

## Subagent Usage

For complex multi-step tasks, use subagents (spawned via Agent tool):
- `Explore` agent: Codebase search and research
- `code-reviewer` agent: Post-implementation code review
- `Plan` agent: Architecture and design planning

## Rules

1. **Write code first, ask questions later** — for well-defined tasks, implement directly
2. **Plan before complex changes** — use EnterPlanMode for multi-file architecture changes
3. **Verify with tests** — unit tests for core logic (CausalEngine, BoardGenerator, etc.)
4. **Keep it simple** — no over-engineering; WeChat Mini Game has constraints
5. **Single responsibility** — one class per file, clear module boundaries
