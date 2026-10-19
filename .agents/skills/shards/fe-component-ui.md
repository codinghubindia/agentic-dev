# Micro-Skill: Frontend UI Components

**Scope**: UI component creation, design tokens, and composability.

## Rules & Checklists
1. **Semantic HTML**:
   - Use native `<button>`, `<nav>`, `<main>`, `<header>`, `<article>` — never clickable `<div>`s.
   - Every interactive control must have an accessible label (`aria-label` or visible text).
2. **Design Tokens**:
   - Never use arbitrary CSS spacing or font sizes; use the token scale (`p-2`, `p-4`, `p-6`).
   - Cards: Choose a border OR a shadow — never both simultaneously.
   - Buttons: Minimum interactive touch target is 44x44px desktop, 48x48px mobile.
3. **Loading & Skeleton States**:
   - Match skeleton shape to the exact geometry of expected content (no generic spinners).
   - Use subtle pulse animation (`animate-pulse`); never continuous decorative spinning logos.
4. **Error Boundaries**:
   - Wrap major page components and complex interactive widgets in local error boundaries.
   - Always provide a user-friendly retry button on caught rendering errors.
5. **Composability**:
   - Prefer compound component patterns (`<Select><Select.Option /></Select>`) for complex controls.
   - Pass style overrides through `className` with `cn()` / `clsx` utility merging.
