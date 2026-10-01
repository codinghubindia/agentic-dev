---
name: framer-motion
description: Framer Motion v11 — spring physics, AnimatePresence, layout animations, gestures, viewport triggers, and variants system.
category: frontend
packages: [framer-motion]
workerRoles: [strike-worker-frontend]
microTasks: [F3]
currentVersion: 11.11.11
lastResearched: 2026-10-01
refreshIntervalDays: 60
status: stable
---

> [!NOTE]
> **Skill Freshness**: Framer Motion v11 unified with the `motion` package. See modern-ui-motion/SKILL.md for motion choreography patterns. This file covers the package API.

> [!CAUTION]
> **NEVER install both `framer-motion` AND `motion`** — they conflict. Use `framer-motion` for new projects (more community resources). The `motion` package is the same library rebranded in v11+.

# 🎬 Framer Motion — Package API Reference

## 0. Install
```bash
# Pre-install deprecation check
npm view framer-motion deprecated 2>/dev/null | grep -i deprecated
# Install
npm install framer-motion
```

---

## 1. Core Imports

```tsx
import {
  motion,          // animated HTML/SVG elements
  AnimatePresence, // mount/unmount animations
  useAnimation,    // programmatic animation control
  useInView,       // viewport entry detection
  useScroll,       // scroll-linked animations
  useTransform,    // map one value to another
  useReducedMotion,// accessibility hook
  LayoutGroup,     // shared layout animations
} from 'framer-motion';
```

---

## 2. Variants System (Canonical Pattern)

```tsx
// Define variants OUTSIDE the component — stable reference, no re-creation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 }
  },
  exit: { opacity: 0, transition: { staggerChildren: 0.02, staggerDirection: -1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
  exit: { opacity: 0, y: -8 }
};

// Usage — variants propagate automatically to children
<motion.ul variants={containerVariants} initial="hidden" animate="visible" exit="exit">
  {items.map(item => (
    <motion.li key={item.id} variants={itemVariants}>
      <ItemCard item={item} />
    </motion.li>
  ))}
</motion.ul>
```

---

## 3. AnimatePresence — Mount/Unmount

```tsx
import { AnimatePresence, motion } from 'framer-motion';

// mode="wait" — exit completes before next child enters
// mode="sync" — exit and enter overlap
// mode="popLayout" — exiting element pops out of layout flow

<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="modal"  // ← REQUIRED: unique key so AnimatePresence tracks it
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    />
  )}
</AnimatePresence>

// ⚠️ AnimatePresence REQUIRES children to have a stable `key` prop
// ⚠️ The animated component must be a DIRECT child of AnimatePresence
```

---

## 4. Viewport Entry Animations (whileInView)

```tsx
// Animate when element enters the viewport — no IntersectionObserver boilerplate
<motion.section
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-100px' }} // once=true: only animate once
  transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
>
  <FeatureGrid />
</motion.section>
```

---

## 5. Layout Animations (FLIP)

```tsx
// Add layout prop — Framer Motion handles FLIP automatically
// Works for position, size, border-radius changes
<motion.div layout layoutId={item.id}>
  <Card data={item} />
</motion.div>

// layoutId enables shared element transitions between routes/states
// e.g. a card expanding into a modal with the same layoutId
```

---

## 6. Scroll-Linked Animations

```tsx
const { scrollYProgress } = useScroll();
const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

// Progress bar
<motion.div
  style={{ scaleX, transformOrigin: 'left' }}
  className="fixed top-0 h-1 w-full bg-brand-500"
/>
```

---

## 7. Programmatic Animation

```tsx
const controls = useAnimation();

// Trigger animations imperatively
await controls.start({ opacity: 1, x: 0 });
controls.stop();

<motion.div animate={controls} initial={{ opacity: 0, x: -20 }} />
```

---

## 8. Reduced Motion (Required)

```tsx
function AnimatedCard({ children }: Props) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduce ? {} : { opacity: 0, y: 12 }}
      animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
      whileHover={shouldReduce ? {} : { y: -2 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## 9. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| Defining variants inside component render | Define outside component |
| Missing `key` on AnimatePresence children | Add unique stable `key` prop |
| Animating `height`/`width` directly | Use `scaleY`/`scaleX` or `layout` prop |
| `animate` on element with no `initial` | Add `initial` to control starting state |
| Installing both `framer-motion` and `motion` | Pick one — they are the same package |
