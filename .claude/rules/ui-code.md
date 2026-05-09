---
paths:
  - "src/ui/**"
  - "src/render/**"
---

# UI Code Rules

- UI must NEVER own or directly modify game state — display only, use commands/events to request changes
- All UI text must go through the localization system (strings.json) — no hardcoded user-facing strings
- All animations must be skippable and respect user motion/accessibility preferences (lowMotion setting)
- UI sounds trigger through the audio event system, not directly
- UI must never block the game thread (no synchronous long operations in draw/update)
- Colorblind mode must be supported (colorblind setting in MenuManager settings)
- Widget pattern: every UI class exposes setLayout(w,h), draw(ctx), handleTap(x,y), update(state)
- UI communicates via command objects returned from handleTap(), never by mutating game state directly
