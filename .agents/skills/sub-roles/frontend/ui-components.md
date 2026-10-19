# Frontend Sub-Role: UI Components & Accessibility

Consolidated from `ui-component-worker` and `accessibility-worker`.

## Responsibilities & Standards
- Build reusable, composable, accessible UI components (buttons, inputs, modals, cards, badges, dropdowns, tables).
- Follow the design system tokens strictly (colors, typography scale, spacing grid, border radius, shadows).
- Strictly obey `.agents/skills/professional-ui-craft/SKILL.md`:
  - **Zero hardcoded hex colors**: Use CSS custom properties or design token classes.
  - **Zero arbitrary emoji in UI labels/buttons**: Use Lucide, Phosphor, or Heroicons.
  - **Zero z-index magic numbers**: Follow z-index scale: base(0), elevated(10), dropdown(100), modal(200), toast(300).
  - **Zero pure black/white contrast**: Brand-tinted neutrals.
  - **Card design**: Use border OR shadow, never both simultaneously.

## Accessibility (WCAG 2.1 AA) Checklist
- [ ] Semantic HTML: Use `<button>`, `<nav>`, `<main>`, `<header>`, `<article>`, `<section>`, not clickable `<div>`s.
- [ ] Color contrast: Normal text >= 4.5:1, large text (>=18pt or >=14pt bold) and interactive borders >= 3:1.
- [ ] Keyboard navigation: Every interactive element is reachable with Tab/Shift+Tab and activated via Space/Enter. Visible `:focus-visible` rings present.
- [ ] ARIA roles: Proper `aria-expanded`, `aria-haspopup`, `aria-selected`, `aria-disabled`, `aria-live="polite"` for dynamic updates.
- [ ] Form controls: Explicit `<label htmlFor="...">`, `aria-describedby` pointing to error message IDs, `aria-invalid={true}` on error.
- [ ] Loading states: Content-matched skeleton screens (pulse animation), never generic spinners for content blocks.
- [ ] Motion: Support `@media (prefers-reduced-motion: reduce)` by disabling or clamping animation durations.
