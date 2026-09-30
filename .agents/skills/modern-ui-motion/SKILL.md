---
name: modern-ui-motion
description: Production-grade web and mobile motion choreography, GPU-accelerated micro-interactions, spring physics, FLIP layout animations, and 60/120 FPS runtime optimizations using Motion (Framer Motion), GSAP, AutoAnimate, Tailwind Motion, and Rive.
refreshMode: protected
lastResearched: 2026-09-30
sources:
  - https://motion.dev
  - https://gsap.com
  - https://auto-animate.formkit.com
  - https://m3.material.io/styles/motion/overview
  - https://animations.dev
  - https://web.dev/articles/animations-guide
---

# Modern UI Motion & High-Performance Animation

> [!IMPORTANT]
> **Performance First**: Motion in production software is not decorative candy—it is a functional communication channel providing spatial continuity, immediate feedback, and perceived snappiness. Any animation that drops below 60 FPS, causes layout thrashing, or delays user interaction is a defect.

---

## 1. The Core Laws of 60/120 FPS Motion

### 1.1 The "Composite-Only" Rule (Non-Negotiable)
The browser pipeline consists of: **JavaScript $\to$ Style Recalculation $\to$ Layout (Reflow) $\to$ Paint $\to$ Composite**.

```
❌ Layout Triggering (BAD):   width, height, top, left, margin, padding, border-width
❌ Paint Triggering (SLOW):    background-color, box-shadow, border-color, color
✅ Composite-Only (60/120 FPS): transform (translate3d, scale, rotate), opacity
```

- **NEVER animate layout properties** (`top`, `left`, `width`, `height`). Doing so forces the CPU to recalculate the geometry of the entire DOM tree on every frame.
- **ALWAYS animate composite properties** (`transform: translate3d(...)`, `scale()`, `opacity`). These execute directly on the GPU compositor thread without touching the main UI thread.

### 1.2 The FLIP Layout Principle (First, Last, Invert, Play)
When an element moves from one DOM position or dimension to another (e.g. expanding card, reordered grid, dynamic tabs):
1. **First**: Record initial bounding box (`element.getBoundingClientRect()`).
2. **Last**: Let DOM update to final state, record final bounding box.
3. **Invert**: Apply a delta transform (`transform: translate(dx, dy) scale(dw, dh)`) to snap the element visually back to its "First" position with 0 duration.
4. **Play**: Animate the transform back to identity (`translate(0, 0) scale(1, 1)`) via hardware acceleration.

*Note: In modern React, `Motion` (Framer Motion) via `layoutId` or FormKit `AutoAnimate` performs FLIP automatically at 60 FPS.*

### 1.3 `will-change` Hygiene & Memory Management
`will-change: transform, opacity` instructs the GPU to promote an element to its own render layer.
- **DO NOT** apply `will-change` globally in CSS (`* { will-change: all; }`). This causes "GPU Layer Explosion", exhausting video RAM and crashing mobile browsers.
- **DO** apply `will-change` right before or during interaction, and remove it immediately after animation completes.

---

## 2. Motion (Framer Motion) Production Patterns

### 2.1 Bundle Optimization: `LazyMotion` & `m` Components
Standard `import { motion } from 'framer-motion'` includes gesture engines, SVG morphing, drag physics, and 3D transforms (~34 KB gzip).
In production apps, use **`LazyMotion`** with `domAnimation` to cut bundle size to **<4.5 KB gzip**:

```tsx
import { LazyMotion, domAnimation, m, AnimatePresence } from 'motion/react'; // or 'framer-motion'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

// Inside components, use <m.div> instead of <motion.div>
export function FadeInCard({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      {children}
    </m.div>
  );
}
```

### 2.2 Shared Element Transitions (`layoutId`)
For seamless Apple/Stripe-style card expansion into full detail modals:

```tsx
// Grid Card
<m.div
  layoutId={`card-${item.id}`}
  onClick={() => setSelectedId(item.id)}
  className="cursor-pointer rounded-lg bg-surface p-4"
>
  <m.h3 layoutId={`title-${item.id}`} className="font-semibold">{item.title}</m.h3>
</m.div>

// Detail Modal
<AnimatePresence>
  {selectedId && (
    <m.div
      layoutId={`card-${selectedId}`}
      className="fixed inset-0 z-50 m-auto h-96 w-full max-w-lg rounded-2xl bg-surface p-8 shadow-2xl"
    >
      <m.h3 layoutId={`title-${selectedId}`} className="text-2xl font-bold">{selectedItem.title}</m.h3>
      <button onClick={() => setSelectedId(null)}>Close</button>
    </m.div>
  )}
</AnimatePresence>
```

### 2.3 Spring Physics vs Easing Curves

| Motion Type | When to Use | Parameters |
|---|---|---|
| **Spring Physics** | Direct user gestures, drag release, interactive buttons, tabs | `type: "spring", stiffness: 400, damping: 30` (snappy) |
| **Spring Physics (Bouncy)** | Micro-reactions, badges, heart likes ONLY | `type: "spring", stiffness: 500, damping: 15` |
| **Cubic Bezier (Enter)** | Viewport entrance, modal fade-in | `duration: 0.25, ease: [0.0, 0.0, 0.2, 1]` (Decelerate) |
| **Cubic Bezier (Exit)** | Modal close, toast dismissal | `duration: 0.20, ease: [0.4, 0.0, 1, 1]` (Accelerate) |

---

## 3. AutoAnimate (Zero-Config List & DOM Shifts)

For CRUD lists, tab panels, search result filtering, or collapsible accordions where writing manual Framer Motion variants is overkill:

```tsx
import { useAutoAnimate } from '@formkit/auto-animate/react';

export function DynamicTodoList({ items }: { items: Todo[] }) {
  const [parent] = useAutoAnimate({
    duration: 200,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  });

  return (
    <ul ref={parent} className="space-y-2">
      {items.map(todo => (
        <li key={todo.id} className="p-3 bg-surface rounded-lg">
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```
*Note: Any item added, removed, or rearranged in `items` automatically animates smoothly with zero boilerplate.*

---

## 4. GSAP (High-Performance Timeline & Scroll Choreography)

For complex multi-stage timelines, parallax hero sections, and SVG morphing:

### 4.1 React Clean-up with `useGSAP`
Never use plain `useEffect` with GSAP in React (causes memory leaks and duplicate tweens). Always use `@gsap/react`:

```tsx
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function HeroTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } });
    
    tl.from('.hero-badge', { y: -20, opacity: 0 })
      .from('.hero-heading', { y: 30, opacity: 0 }, '-=0.5')
      .from('.hero-cta', { scale: 0.95, opacity: 0 }, '-=0.4');

    ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: '+=400',
      pin: true,
      scrub: 1,
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="h-screen">
      <div className="hero-badge">v6.0 Engine</div>
      <h1 className="hero-heading">High-Performance Motion</h1>
      <button className="hero-cta">Get Started</button>
    </div>
  );
}
```

---

## 5. Rive (Interactive Vector Runtime vs Lottie)

When the design requires animated vector characters, interactive progress indicators, or dynamic illustrations:

| Feature | Lottie (JSON) | Rive (.riv) |
|---|---|---|
| **File Size** | 150 KB – 2 MB | **15 KB – 45 KB** (90% smaller) |
| **Runtime Engine** | CPU-heavy DOM / Canvas | **WebGPU / C++ WASM Canvas** |
| **Interactivity** | Play, Pause, Seek | **Full State Machine** (responds to mouse hover, click coordinates, numerical progress) |
| **FPS** | Drops frames on mobile | **Locked 60/120 FPS** |

```tsx
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

export function InteractiveLikeButton() {
  const { rive, RiveComponent } = useRive({
    src: '/assets/like_button.riv',
    stateMachines: 'State Machine 1',
    autoplay: true,
  });

  const isLikedInput = useStateMachineInput(rive, 'State Machine 1', 'isLiked');

  return (
    <button 
      onClick={() => isLikedInput && (isLikedInput.value = !isLikedInput.value)}
      className="h-12 w-12"
    >
      <RiveComponent />
    </button>
  );
}
```

---

## 6. CSS Keyframes & Tailwind Motion (Zero-JS Micro-Interactions)

For high-frequency micro-interactions (spinners, subtle pulse, badge glow, button hovers), use pure CSS keyframes with GPU acceleration:

```css
/* In design-system / globals.css */
@keyframes subtle-scale {
  0% { transform: scale(1); }
  50% { transform: scale(0.97); }
  100% { transform: scale(1); }
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.btn-active-press:active {
  transform: scale(0.96);
  transition: transform 80ms cubic-bezier(0.2, 0, 0, 1);
}
```

---

## 7. Accessibility & Reduced Motion Mandate

Every single motion implementation **MUST** respect the user's OS accessibility settings.

### 7.1 CSS Implementation
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

### 7.2 Framer Motion / Motion Implementation
```tsx
import { useReducedMotion } from 'motion/react';

export function AccessibleAnimatedModal({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -20 },
  };

  return (
    <m.div
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: shouldReduceMotion ? 0.05 : 0.25 }}
    >
      {children}
    </m.div>
  );
}
```

---

## 8. Pre-Handoff Motion Quality Checklist

Before completing any animated component or UI transition, the developer must verify:
- [ ] **Composite-Only**: Zero animations targeting `width`, `height`, `top`, `left`, `margin`, or `padding`.
- [ ] **Frame Rate**: Maintains locked 60 FPS (or 120 FPS on ProMotion screens) with zero frame drops.
- [ ] **Duration Budget**: Micro-interactions $\le 100\text{ms}$; state transitions $\le 250\text{ms}$; modal entries $\le 350\text{ms}$. No functional animation $>500\text{ms}$.
- [ ] **Bundle Weight**: Uses `LazyMotion` or pure CSS keyframes rather than monolithic animation bundles.
- [ ] **Reduced Motion**: Tested with `prefers-reduced-motion: reduce` enabled—transitions cleanly collapse to simple instant fades.
- [ ] **FLIP Layout**: Layout reflows use `layoutId` or AutoAnimate to prevent sudden element snapping.
