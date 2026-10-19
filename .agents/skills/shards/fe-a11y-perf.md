# Micro-Skill: Accessibility (a11y) & Web Performance

**Scope**: WCAG 2.1 AA compliance, Core Web Vitals, and rendering performance.

## Rules & Checklists
1. **Contrast Ratios**:
   - Normal text must achieve >= 4.5:1 contrast against its background.
   - Large text (>=18pt or >=14pt bold) and active UI borders must achieve >= 3:1 contrast.
2. **Keyboard Navigation & Focus**:
   - Every interactive control must be reachable via `Tab` / `Shift+Tab`.
   - Never suppress outline rings (`outline: none`) without providing a high-contrast `:focus-visible` ring.
   - Dialogs/Modals must trap focus while open and restore focus to trigger element upon closing.
3. **Core Web Vitals Budgets**:
   - LCP (Largest Contentful Paint) < 2.5s: Preload hero fonts and critical images; avoid render-blocking scripts.
   - INP (Interaction to Next Paint) < 200ms: Keep event handler CPU execution under 50ms; yield to main thread.
   - CLS (Cumulative Layout Shift) < 0.1: Always define explicit `width` and `height` (or aspect-ratio) on images and embeds.
4. **List Virtualization**:
   - Collections exceeding 50 items must be virtualized using `@tanstack/react-virtual` or `react-window`.
5. **Reduced Motion**:
   - Respect `@media (prefers-reduced-motion: reduce)` by disabling non-essential layout and entrance animations.
