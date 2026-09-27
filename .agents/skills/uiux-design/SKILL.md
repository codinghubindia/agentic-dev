---
name: uiux-design
description: Comprehensive UI/UX design guide covering user research, information architecture, wireframing, design systems, visual hierarchy, color theory, typography, component specs, accessibility, interaction design, and design-to-dev handoff.
refreshMode: sections
lastResearched: 2026-09-27
refreshableSections:
  - "## 13. CSS Framework Selection Guide"
protectedSections:
  - "## 1. Design Process"
  - "## 2. User Research"
  - "## 3. Information Architecture"
  - "## 10. Interaction Design"
---

# UI/UX Design Skill

Standards for designing intuitive, accessible, and visually polished user interfaces.

---

## 1. Design Process

```
Discover → Define → Design → Prototype → Validate → Handoff
```

Never skip to visuals before understanding the user and their goals.

---

## 2. User Research

Before designing any screen:
- **Who is the user?** — define persona: goals, pain points, technical literacy, device preference
- **What job are they doing?** — use Jobs-to-be-Done framing ("When I _____, I want to _____ so I can _____")
- **What are the critical paths?** — identify the 3–5 flows users do most (login, primary action, error recovery)

---

## 3. Information Architecture

Structure content before styling it:

```
App
├── Auth
│   ├── Login
│   └── Register
├── Dashboard (primary workspace)
│   ├── Overview / summary
│   └── Primary list/grid
├── Detail view
│   ├── Content
│   └── Actions
└── Settings / Profile
```

**Rules:**
- Max 3 levels of navigation depth (users get lost beyond that)
- Group related items — don't scatter related actions across the UI
- Every screen needs a clear **primary action** (the most important thing the user does there)
- Secondary actions must be visually subordinate to the primary

---

## 4. Design Tokens — Define Before Designing

Always define tokens before designing components:

```json
{
  "color": {
    "brand-primary": "#4f46e5",
    "brand-secondary": "#7c3aed",
    "text-primary": "#111827",
    "text-secondary": "#6b7280",
    "text-muted": "#9ca3af",
    "bg-base": "#f9fafb",
    "bg-surface": "#ffffff",
    "bg-elevated": "#f3f4f6",
    "border": "#e5e7eb",
    "danger": "#dc2626",
    "success": "#16a34a",
    "warning": "#d97706"
  },
  "spacing": {
    "xs": "4px", "sm": "8px", "md": "16px",
    "lg": "24px", "xl": "32px", "2xl": "48px"
  },
  "radius": {
    "sm": "6px", "md": "10px", "lg": "16px", "full": "9999px"
  },
  "font-size": {
    "xs": "11px", "sm": "13px", "base": "15px",
    "lg": "18px", "xl": "22px", "2xl": "28px", "3xl": "36px"
  },
  "font-weight": {
    "normal": 400, "medium": 500, "semibold": 600, "bold": 700
  },
  "shadow": {
    "sm": "0 1px 3px rgba(0,0,0,0.08)",
    "md": "0 4px 12px rgba(0,0,0,0.08)",
    "lg": "0 10px 30px rgba(0,0,0,0.10)"
  }
}
```

**Never** use magic numbers (`padding: 13px`) in designs — always reference a token.

---

## 5. Visual Hierarchy

Every screen needs clear hierarchy — users scan in priority order:

1. **Size** — bigger = more important
2. **Weight** — bold = primary, regular = secondary
3. **Color** — accent color draws attention
4. **Contrast** — high contrast = important, low = secondary
5. **Space** — more space around an element = more important
6. **Position** — top-left first (in LTR languages)

**Checklist:**
- [ ] Can you identify the primary action in < 2 seconds?
- [ ] Is the page title/heading clear and prominent?
- [ ] Are secondary actions visually subordinate?
- [ ] Is destructive actions (delete, cancel) styled with danger color AND require confirmation?

---

## 6. Typography

```
Page title:     28–36px, bold (700), letter-spacing -0.5px
Section title:  20–24px, semibold (600)
Body text:      15–16px, regular (400), line-height 1.6
Label:          12–13px, medium (500), uppercase + letter-spacing 0.06em
Caption:        11–12px, regular (400), muted color
Code:           13–14px, monospace
```

**Rules:**
- Maximum 2 font families per product (one for headings, one for body — or just one)
- Line length: 60–80 characters for body text (beyond that: hard to read)
- Line height: 1.5–1.7 for body, 1.1–1.2 for headings
- Never use font weight below 400 for body text

---

## 7. Color Usage

```
Primary/accent: 5–10% of the UI (buttons, links, highlights)
Neutral:        80–85% (backgrounds, text, borders)
Semantic:       5–10% (success green, error red, warning yellow)
```

**Accessibility — minimum contrast ratios:**
- Body text: 4.5:1 against background (WCAG AA)
- Large text (18px bold or 24px regular): 3:1
- UI components/icons: 3:1
- Never convey information by color alone — add icon or label

**Dark mode rule:** Define all colors with both light and dark values — never hardcode `#ffffff` or `#000000` directly.

---

## 8. Component Specifications

When specifying components for developers, always include:

```markdown
## Button — Primary

**Purpose**: Main call-to-action. One per view.

**Anatomy**:
- Background: `color.brand-primary` → hover: darken 8%
- Text: white, font-weight: 600, font-size: sm (13px)
- Padding: `spacing.sm spacing.md` (8px 16px)
- Border-radius: `radius.sm` (6px)
- Height: 36px (sm), 42px (md, default), 48px (lg)
- Transition: background 150ms ease

**States**:
- Default: brand-primary bg
- Hover: brand-primary darkened 8%
- Focus: 2px outline, brand-primary, 2px offset (MUST be visible)
- Disabled: 50% opacity, cursor: not-allowed
- Loading: spinner icon + disabled state

**Don'ts**:
- Never use more than one primary button per page section
- Never disable without explaining why (show tooltip or error)
```

---

## 9. Spacing & Layout

**8-point grid system:** All spacing must be multiples of 4 or 8.
```
✅ 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
❌ 5, 7, 13, 17 (magic numbers)
```

**Layout containers:**
```
Full width:   100%
Wide content: max-width 1200px
Content:      max-width 900px
Narrow/form:  max-width 480px
```

**Card layout rules:**
- Cards need consistent padding (16–24px)
- Cards need border or shadow — not both (pick one visual cue)
- Card corner radius consistent with the design system

---

## 10. Interaction Design

**Feedback for every user action:**
- Button click → immediate visual response (loading state, or success)
- Form submission → clear success/error state
- Async operations → loading indicator, not a blank screen
- Destructive actions → confirmation dialog, not instant execution

**Animation principles:**
- Duration: 100–300ms for UI responses, 300–500ms for page transitions
- Easing: `ease-out` for elements entering, `ease-in` for elements leaving
- Purpose: animations must communicate state change, not just decorate
- Respect `prefers-reduced-motion` — provide a no-animation fallback

---

## 11. Responsive Design

```
Mobile:  < 640px   — single column, bottom navigation, full-width buttons
Tablet:  640–1024px — 2-column layouts, side navigation appears
Desktop: > 1024px  — full navigation, multi-column, sidebar patterns
```

**Mobile-first rule:** Design for 375px width first, then scale up.
**Touch targets:** Minimum 44×44px for any interactive element on mobile.
**Thumb zone:** Primary actions in the bottom 60% of the mobile screen.

---

## 12. Design-to-Dev Handoff Checklist

Before handing off to `ui-component-worker` or `frontend-lead`:
- [ ] All design tokens documented in `design-spec.md`
- [ ] Every component state designed: default, hover, focus, active, disabled, loading, error, empty
- [ ] All responsive breakpoints specified
- [ ] All ARIA roles and labels specified for interactive components
- [ ] Color contrast verified (use a contrast checker)
- [ ] All icons from a consistent icon set (no mixing icon libraries)
- [ ] Font sizes use the token scale (no arbitrary sizes)
- [ ] Spacing uses the 8-point grid (no arbitrary spacing)
- [ ] Component spec includes: purpose, anatomy, states, do's and don'ts

---

## 13. CSS Framework Selection Guide

Choose the right CSS approach before starting implementation. Align with `frontend-lead` on the decision.

---

### Option A — Tailwind CSS *(recommended for most new projects)*

**Best for:** Custom designs, full control over every pixel, no design system overhead.

```html
<!-- Tailwind: utility classes directly in JSX -->
<button class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700
               text-white text-sm font-semibold rounded-lg transition-colors
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
               disabled:opacity-50 disabled:cursor-not-allowed">
  Save changes
</button>
```

**Tailwind configuration for design tokens:**
```js
// tailwind.config.ts
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          500: '#4f46e5',   // primary
          600: '#4338ca',   // primary hover
          700: '#3730a3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '10px',
        sm: '6px',
        lg: '16px',
      },
    },
  },
};
```

**Pros:** No unused CSS (purged), consistent spacing scale (4/8/12/16...), dark mode built-in (`dark:` prefix), excellent docs.
**Cons:** Long class strings, requires discipline to avoid duplication (use `@apply` for repeated patterns).

**When NOT to use:** When the team is new to utility-first and there's no time to learn. When designs are already component-library-based.

---

### Option B — Tailwind + shadcn/ui *(recommended for apps that need pre-built components fast)*

**Best for:** Admin dashboards, SaaS apps, forms-heavy UIs — anywhere you need high-quality accessible components without building from scratch.

```bash
# Install
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input dialog table
```

```tsx
// Usage — components are copied into your repo (you own them)
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create task</DialogTitle>
    </DialogHeader>
    <Input placeholder="Task title" />
    <Button>Save</Button>
  </DialogContent>
</Dialog>
```

**Pros:** Radix UI primitives underneath (fully accessible), Tailwind-based so fully customizable, components live in your codebase (not a black-box dependency), TypeScript-first.
**Cons:** Requires Tailwind. Initial setup takes time.

---

### Option C — CSS Modules *(recommended for teams preferring scoped CSS)*

**Best for:** Teams who prefer writing real CSS, avoid className conflicts, strong CSS skills.

```tsx
// Button.module.css
.button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: background 150ms ease;
}
.button:hover { background: var(--color-accent-hover); }
.button.secondary { background: var(--color-surface); color: var(--color-text-primary); }
```

```tsx
// Button.tsx
import styles from './Button.module.css';
import { clsx } from 'clsx';

export function Button({ variant = 'primary', className, ...props }) {
  return (
    <button
      className={clsx(styles.button, variant === 'secondary' && styles.secondary, className)}
      {...props}
    />
  );
}
```

**Pros:** Real CSS (full power), zero runtime cost, scoped by default, works with CSS custom properties (design tokens), familiar for CSS experts.
**Cons:** More verbose for simple cases, no utility classes, design token changes require updating CSS files.

---

### Option D — Styled Components / Emotion *(CSS-in-JS)*

**Best for:** Dynamic styles based on props, teams already using it, design systems that need JavaScript logic in styles.

```tsx
import styled from 'styled-components';

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  background: ${({ $variant }) => $variant === 'secondary' ? 'transparent' : 'var(--color-accent)'};
  color: ${({ $variant }) => $variant === 'secondary' ? 'var(--color-text-primary)' : 'white'};
  border: 1.5px solid ${({ $variant }) => $variant === 'secondary' ? 'var(--color-border)' : 'transparent'};
  transition: all 150ms ease;

  &:hover {
    background: ${({ $variant }) => $variant === 'secondary' ? 'var(--color-surface-hover)' : 'var(--color-accent-hover)'};
  }
`;
```

**Pros:** Props-driven dynamic styles, colocation of styles and component, TypeScript-typed props.
**Cons:** Runtime cost (styles injected at runtime), harder SSR, larger bundle, server components incompatible.
**Avoid for:** Next.js App Router (server components can't use CSS-in-JS with runtime).

---

### Option E — DaisyUI (Tailwind component classes)

**Best for:** Rapid prototyping, simple projects, teams new to Tailwind who want pre-built class compositions.

```html
<!-- No JS required — pure CSS classes -->
<button class="btn btn-primary">Primary</button>
<input class="input input-bordered w-full" placeholder="Email" />
<div class="card bg-base-100 shadow-md">
  <div class="card-body">
    <h2 class="card-title">Title</h2>
  </div>
</div>
```

**Pros:** Zero JavaScript, theme system with 30+ built-in themes (`data-theme="dark"`), very fast to prototype with.
**Cons:** Less customizable than raw Tailwind, opinionated component styles, not suitable for unique brand designs.

---

### Framework Decision Matrix

| Need | Best Choice |
|---|---|
| Custom unique design, full control | Tailwind CSS |
| Custom design + accessible components fast | Tailwind + shadcn/ui |
| Strong CSS skills, scoped styles | CSS Modules + CSS Variables |
| Props-driven dynamic styles | Styled Components / Emotion |
| Rapid prototype or simple app | DaisyUI |
| Next.js App Router (server components) | Tailwind or CSS Modules (no runtime CSS-in-JS) |
| Design system shared across multiple apps | CSS Modules with a package, or Tailwind preset |

**When specifying the framework choice, always document it in `design-spec.md` so `frontend-lead` and `ui-component-worker` know which approach to use.**
