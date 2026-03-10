# WaibSpace Improvement Ideas

---

## User-Driven Style Personalization

ComponentBlock primitives ship with default styling via CSS variables. In the future, users can override these through natural language:

- "Hey Waib, my favorite colors are green and blue." — Adjusts accent and primary palette.
- "Hey Waib, I like pastel colors, and I'd like the blocks to pop more." — Shifts palette to pastels, adds stronger box-shadow for depth/lift.
- "My vision is impaired, I could really use some high contrast colors." — Switches to a high-contrast theme (larger text, bold borders, WCAG AAA ratios).

**How it works:** A style-preferences agent interprets the request, maps it to CSS variable overrides (e.g. `--color-accent`, `--color-surface`, `--shadow-md`), and persists them in user memory. On next render, the WaibRenderer applies the user's style layer on top of defaults. No component code changes needed — the primitive components already consume CSS variables.

This ties directly into the Interaction Vocabulary vision: the system doesn't just learn *what* you click — it learns *how* you want things to look and feel.
