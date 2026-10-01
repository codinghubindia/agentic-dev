---
name: modern-ui-motion
description: Production-grade web motion choreography, GPU-accelerated micro-interactions, spring physics, FLIP layout animations, 60/120 FPS runtime optimizations, and Golden Arsenal package guide with deprecation-safe install commands.
lastResearched: 2026-10-01
---

> [!NOTE]
> **Skill Freshness**: `lastResearched` is set at authoring time. The skill synthesizer flags this
> skill as stale after 90 days and triggers a refresh. Do not manually bump `lastResearched` —
> the `skill_synthesizer --promote` command updates it automatically after a successful compile cycle.

# ⚡ Modern UI Motion & Kinetic Choreography

> [!IMPORTANT]
> Motion in software is not decoration—it is **spatial explanation**. Every animation must communicate where an element came from, what triggered it, and where it is going. Motion is a **first-class deliverable**. Static UIs are rejected.

---

## 0. Golden Arsenal — Package Install Protocol

> [!CAUTION]
> **MANDATORY PRE-INSTALL DEPRECATION CHECK**: Before every `npm install`, run:
> ```
> npm view <package-name> deprecated
> ```
> Parse the output specifically for the word `deprecated`. The command may produce npm notices,
> funding messages, or peer dependency warnings that are NOT deprecation. Only block install if
> the output contains the literal word `deprecated`. Safe check pattern:
> ```
> npm view <package-name> deprecated 2>/dev/null | grep -i "deprecated"
> ```
> If that grep returns output → package is deprecated. If empty → safe to install.

### Approved Motion Packages (Current, Non-Deprecated)

| Package | Purpose | Install Command |
|---|---|---|
| `framer-motion` | Full Framer Motion — spring physics, layout animations, gestures, AnimatePresence | `npm install framer-motion` |
| `motion` | **Same library as framer-motion** — rebranded package name in v11+. Identical API. Pick ONE, never install both. `motion` is the newer package name; `framer-motion` still receives updates. For new projects use `framer-motion` (more community resources). | `npm install framer-motion` |
| `@formkit/auto-animate` | Zero-config list reorder animations | `npm install @formkit/auto-animate` |
| `tailwindcss-animate` | Tailwind utility animation classes | `npm install tailwindcss-animate` |
| `react-spring` | Physics-based spring animations (alternative to Framer Motion) | `npm install @react-spring/web` |

> [!CAUTION]
> **NEVER install both `framer-motion` AND `motion` in the same project.** They conflict and
> will cause duplicate `AnimatePresence` instances and context errors. Choose exactly ONE:
> - New project → `npm install framer-motion` (preferred, more docs/examples)
> - Bundle-size critical → `npm install motion` (same API, ~30% smaller)
> Never import from both in the same codebase.

> [!WARNING]
> NEVER install: `react-transition-group` (legacy API), `animejs` v3 (deprecated build system), `velocity-animate` (unmaintained), `react-motion` (superseded). Always verify with `npm view <pkg> deprecated` before installing.

### CLI Scaffold Commands (Use These, NEVER manually edit config files)
```bash
# Add Tailwind CSS (if not present)
npx tailwindcss init -p

# Add Framer Motion
npm install framer-motion

# Add auto-animate for zero-config list transitions
npm install @formkit/auto-animate
```

---

## 1. The Kinetic Duration Scale

Never guess animation durations. Use the calibrated scale:

| Duration | Intended Use Case | Concrete Examples |
|---|---|---|
| **50–100ms** | Micro-interactions | Button press scale (`0.97`), toggle switch slide, checkbox checkmark. |
| **150–250ms** | Element state transitions | Hover highlights, dropdown menu popover, accordion expand. |
| **250–350ms** | Component entrances/exits | Modal dialog appearance, drawer slide-out, toast notification. |
| **350–500ms** | Page/route transitions | Full-page fade/slide between routes. |
| **>500ms** | BANNED for functional UI | Anything over 500ms feels sluggish in real products. |

---

## 2. Spring Physics over Linear Easing

Linear easing (`linear`) looks artificial and robotic. Functional UI must use **damped spring physics**:

```tsx
// The Gold Standard Spring Preset
const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8
};

// Modal Entrance — felt, not just seen
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 8 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.98, y: 4 }}
  transition={springTransition}
/>

// Drawer slide-in from right
<motion.aside
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', stiffness: 300, damping: 32 }}
/>
```

---

## 3. Mandatory Micro-Interaction Patterns

These are **required** on every interactive element — not optional polish:

```tsx
// Button tactile press (MANDATORY on every button)
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
  className="..."
>
  Click me
</motion.button>

// Card hover lift (MANDATORY on all interactive cards)
<motion.div
  whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
  transition={{ duration: 0.2 }}
  className="rounded-xl p-4 border"
>
  {content}
</motion.div>

// Input focus ring pulse
<motion.input
  whileFocus={{ scale: 1.01 }}
  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
/>
```

---

## 4. Staggered Cascades & FLIP Layouts

### Staggered List Entrance (50ms Interval — MANDATORY for all lists/grids)

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 }
  }
};

const childVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }
};

// Usage:
<motion.ul variants={containerVariants} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.li key={item.id} variants={childVariants}>
      <ItemCard item={item} />
    </motion.li>
  ))}
</motion.ul>
```

### FLIP Layout Animations (for reorder/filter)
```tsx
// Add layout prop — Framer Motion handles FLIP automatically
<motion.div layout layoutId={item.id}>
  <ItemCard item={item} />
</motion.div>
```

---

## 5. Page / Route Transition Pattern

```tsx
// ── Next.js App Router (app/layout.tsx) ──────────────────────────────
'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';  // ← correct import for App Router

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();  // ← pathname is now defined
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}

// ── Next.js Pages Router (_app.tsx) ─────────────────────────────────
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';  // ← Pages Router uses useRouter
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();  // ← pathname from router
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
      >
        <Component {...pageProps} />
      </motion.div>
    </AnimatePresence>
  );
}

// ── Vite/React Router v6 (App.tsx) ──────────────────────────────────
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, Outlet } from 'react-router-dom';

export default function AnimatedLayout() {
  const location = useLocation();  // ← React Router gives location.key
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.key}   // ← location.key changes on every navigation
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
```


---

## 6. Skeleton Screen Choreography (Required for all loading states)

NEVER use `<Spinner />` for content loading. Use content-matched skeletons:

```tsx
// Content-matched skeleton with pulse animation
function CardSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3 animate-pulse">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
    </div>
  );
}

// Grid skeleton — exact shape match
function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
```

---

## 7. GPU Acceleration & 60/120 FPS Rules

* **Animate ONLY `transform` and `opacity`** — these are compositor-only, zero layout cost.
* **NEVER animate** `height`, `width`, `top`, `left`, `margin`, `padding` (trigger layout reflow).
* **Hardware acceleration hint** for persistent animations:
  ```css
  .animated-card { will-change: transform; transform: translateZ(0); }
  ```
* Use `transform: translate3d(x, y, 0)` instead of `top/left` for position.

---

## 8. Accessibility Invariant (Mandatory)

Every animated component MUST include reduced-motion fallback:

```css
/* Global — add to global.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```tsx
// In Framer Motion components
import { useReducedMotion } from 'framer-motion';

function AnimatedCard({ children }: Props) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      whileHover={shouldReduce ? {} : { y: -2 }}
      transition={{ duration: shouldReduce ? 0 : 0.2 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## 9. Anti-Pattern Blacklist

| Anti-Pattern | Why Banned | Alternative |
|---|---|---|
| `react-transition-group` | Legacy API, verbose, superseded | `framer-motion` / `motion` |
| Manually editing `tailwind.config.js` keyframes | Config file sprawl | Use `tailwindcss-animate` npm package |
| CSS `@keyframes` in component files | Global scope pollution | Tailwind `animate-*` utilities or Framer Motion |
| `setTimeout` for animation delays | Racey, unreliable | `transition: { delay: 0.1 }` in Framer Motion |
| `opacity: 0` with `display: none` toggle | Screen reader sees hidden content | Framer Motion `AnimatePresence` handles mount/unmount |
| Continuous spinning decorative elements | Distracting noise | Progress bars, skeleton screens |
