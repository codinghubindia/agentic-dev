# Micro-Skill: Anti-Vibe-Code Quality Standards

**Scope**: Enforcing strict visual craft rules from `professional-ui-craft`.

## Rules & Checklists
1. **Zero Hardcoded Hex Colors**:
   - Never write `#1E40AF` or `#fff` in component markup or styles. Use CSS custom properties (`var(--primary)`) or design tokens (`text-primary-600`).
2. **Zero Emoji in Functional UI**:
   - Never use emojis (`🚀`, `🔥`, `🎉`, `✅`) in buttons, tab headers, or alert banners.
   - Use professional SVG icon libraries (Lucide, Phosphor, Heroicons).
3. **The 60-30-10 Color Rule**:
   - 60% Neutral (backgrounds, surfaces), 30% Secondary tone (cards, borders), 10% Brand accent.
   - Brand color must never exceed 10% of total viewport area.
4. **Tinted Neutrals**:
   - Never use pure neutral gray `#808080`. Always use brand-tinted grays (e.g. `hsl(220, 8%, 50%)` for a blue brand).
5. **No Z-Index Magic Numbers**:
   - Disallowed: `z-[9999]`, `z-[99999]`.
   - Use standard z-index scale: base(0), elevated(10), dropdown(100), modal(200), toast(300).
6. **No Arbitrary Rainbow Gradients**:
   - Multi-hue gradient text or multi-color borders look amateur. Use single brand color or subtle 2-stop tonal gradient.
7. **Elevation Consistency**:
   - Maximum 2 levels of surface nesting (page background -> card surface). Never nest card-in-card-in-card.
