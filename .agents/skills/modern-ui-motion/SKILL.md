---
name: modern-ui-motion
description: Production-grade web motion choreography, GPU-accelerated micro-interactions, spring physics, FLIP layout animations, and 60/120 FPS runtime optimizations.
lastResearched: 2026-10-01
---

# ⚡ Modern UI Motion & Kinetic Choreography

> [!IMPORTANT]
> Motion in software is not decoration—it is **spatial explanation**. Every animation must communicate where an element came from, what triggered it, and where it is going.

---

## 1. The Kinetic Duration Scale

Never guess animation durations. Use the calibrated scale:

| Duration | Intended Use Case | Concrete Examples |
|---|---|---|
| **50–100ms** | Micro-interactions | Button press scale (`0.97`), toggle switch slide, checkbox checkmark. |
| **150–250ms** | Element state transitions | Hover highlights, dropdown menu popover, accordion expand. |
| **250–350ms** | Component entrances/exits | Modal dialog appearance, drawer slide-out, toast notification. |
| **>350ms** | BANNED for functional UI | Anything over 350ms feels sluggish and frustrates users. |

---

## 2. Spring Physics over Linear Easing

Linear easing (`linear`) looks artificial and robotic. Functional UI must use **damped spring physics** (via Framer Motion / Motion One):

```tsx
// The Gold Standard Spring Preset
const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8
};

// Example Modal Entrance
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 8 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.98, y: 4 }}
  transition={springTransition}
/>
```

---

## 3. Staggered Cascades & FLIP Layouts

### Staggered Sequences (50ms Interval)
When data tables, card grids, or lists render, never allow 20 items to pop onto the screen simultaneously. Stagger children by **50ms (0.05s)** to produce a fluid cascading wave:

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
```

### FLIP Layout Animations
When elements are reordered, filtered, or expanded, wrap them with Framer Motion's `layout` prop. This executes a GPU-accelerated **FLIP (First, Last, Invert, Play)** transform, preventing harsh layout jumps.

---

## 4. GPU Acceleration & 60/120 FPS Optimization

* **Animate ONLY Transform and Opacity:**  
  Never animate `height`, `width`, `top`, `left`, or `margin`—these trigger expensive browser CPU layout reflows.  
  Always animate `transform: translate3d(...)`, `scale`, and `opacity` (handled directly by the GPU compositor).
* **Hardware Acceleration Hint:**
  Add `will-change: transform` or `transform: translateZ(0)` on continuously moving interactive cards.

---

## 5. Accessibility Invariant (Mandatory)

Every animated component MUST respect the user's OS preference for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
In Framer Motion: Wrap root transitions with `useReducedMotion()`.
