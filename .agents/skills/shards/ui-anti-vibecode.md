# Micro-Skill: Anti-Vibe-Code Quality Standards

**Scope**: Enforcing strict visual craft rules from `professional-ui-craft`.

## Rules & Checklists
1. **Zero Hardcoded Hex Colors**: Never write `#1E40AF` or `#fff` in component markup. Use CSS custom properties (`var(--primary)`) or design tokens (`text-primary-600`).
2. **Zero Emoji in Functional UI**: Never use emojis (`🚀`, `🔥`, `🎉`) in buttons, tab headers, or alerts. Use professional SVG icons (Lucide, Phosphor).
3. **The 60-30-10 Color Rule**: 60% Neutral (surfaces), 30% Secondary (cards, borders), 10% Brand accent (never exceed 10% viewport area).
4. **Tinted Neutrals**: Never use pure neutral `#808080`. Always use brand-tinted grays (e.g. `hsl(220, 8%, 50%)`).
5. **No Z-Index Magic Numbers**: Disallow `z-[9999]`. Use standard scale: base(0), elevated(10), dropdown(100), modal(200), toast(300).
6. **No Arbitrary Rainbow Gradients**: Multi-hue text or borders are banned. Use single brand color or subtle 2-stop tonal gradient.
7. **Elevation & Card Boundary**: Maximum 2 levels of surface nesting. Cards use a border OR a shadow — never both simultaneously.
8. **Typography & Tabular Data**: Max 2 font families (1 sans/display, 1 mono). Always use `tabular-nums` for data tables, metrics, and counters.
9. **Motion Choreography**: Duration ≤300ms with ease-out curve. Always wrap animations in `motion-reduce:` / `prefers-reduced-motion`.
