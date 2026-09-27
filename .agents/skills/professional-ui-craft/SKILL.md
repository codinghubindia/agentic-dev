---
name: professional-ui-craft
description: Advanced visual craft guide covering color psychology, cognitive design principles, purposeful animation choreography, custom data visualization standards, fast UI perception patterns, and a hard anti-vibe-code blacklist. Mandatory reading for uiux-lead and ui-component-worker before any UI work.
refreshMode: protected
lastResearched: 2026-09-28
sources:
  - https://www.interaction-design.org/literature/topics/gestalt-principles
  - https://lawsofux.com
  - https://m3.material.io/styles/motion/overview
  - https://www.smashingmagazine.com/2021/04/complete-guide-color-theory/
  - https://web.dev/articles/inp
---

# Professional UI Craft

> [!IMPORTANT]
> This skill defines the **visual quality bar** for all UI work in this framework. Every agent producing or reviewing UI must read this before starting. The Anti-Vibe-Code Blacklist (Section 4) is a HARD rule list — violations block handoff.

---

## 1. Color Psychology & Theory (Applied)

### 1.1 Emotional Color Mapping
Color is not decoration — it communicates meaning before the user reads a word.

| Color Family | Psychology | Best Used For |
|---|---|---|
| Red / Orange | Urgency, energy, action, danger | CTAs, alerts, error states, sale badges |
| Yellow / Amber | Caution, optimism, attention | Warnings, highlights, "new" badges |
| Green | Trust, growth, safety, success | Success states, positive metrics, health apps |
| Blue | Trust, calm, reliability, depth | Finance, healthcare, productivity, auth flows |
| Purple | Premium, creativity, wisdom | Creative tools, luxury, AI/tech products |
| Gray / Neutral | Professionalism, balance | Backgrounds, secondary text, borders |

**Rule**: Match your brand color family to the emotional tone your product needs. A health app using aggressive red CTAs creates subconscious dissonance.

### 1.2 The 60-30-10 Rule (With Psychology)
- **60%** Neutral (backgrounds, surfaces) — the silent foundation
- **30%** Secondary tone (cards, sections, subtle fills) — adds depth without distraction
- **10%** Accent/brand color — this is where attention goes. Use it only for what matters most.

> [!CAUTION]
> Violating this ratio is the #1 cause of visually chaotic UIs. If your accent color appears on 40% of the page, nothing is emphasized and everything is noise.

### 1.3 Building a Proper Color Scale
Never use a single brand hex. Build a 10-shade scale using HSL:

```css
/* Example: Building a proper blue scale */
--color-blue-50:  hsl(220, 100%, 97%);  /* Near-white tint */
--color-blue-100: hsl(220, 96%,  93%);
--color-blue-200: hsl(220, 94%,  86%);
--color-blue-300: hsl(220, 91%,  75%);
--color-blue-400: hsl(220, 87%,  65%);
--color-blue-500: hsl(220, 80%,  55%);  /* Brand primary */
--color-blue-600: hsl(220, 76%,  46%);  /* Hover state */
--color-blue-700: hsl(220, 73%,  38%);
--color-blue-800: hsl(220, 70%,  29%);
--color-blue-900: hsl(220, 67%,  19%);
--color-blue-950: hsl(220, 65%,  12%);  /* Near-black shade */
```

**HSL rules**:
- Decrease lightness by ~8-10% per step going darker
- Decrease saturation slightly as you go darker (more natural)
- Use the 500 as primary, 600 as hover, 700 for pressed states

### 1.4 The Tinted Gray Rule
Never use pure `hsl(0, 0%, 50%)` gray. Always tint it toward your brand hue:

```css
/* ❌ Dead gray — looks accidental */
--color-text-secondary: #808080;

/* ✅ Brand-tinted gray — feels intentional */
--color-text-secondary: hsl(220, 8%, 50%);  /* Slight blue tint for blue-brand app */
```

### 1.5 Dark Mode Color Rules
- Never simply invert light mode colors — dark mode has its own hierarchy
- Dark mode backgrounds: `hsl(220, 15%, 10%)` for base, `hsl(220, 12%, 14%)` for surface, `hsl(220, 10%, 18%)` for elevated
- Reduce saturation of accent colors in dark mode by 10-15% (they appear more vivid on dark backgrounds)
- Text in dark mode: `hsl(220, 15%, 88%)` (not pure white — pure white causes eye strain)

---

## 2. Cognitive Design Principles

### 2.1 Gestalt Laws (Apply These to Every Layout)

| Law | What It Means | How to Apply |
|---|---|---|
| **Proximity** | Elements close together are seen as related | Group related actions/info. Separate unrelated items with space. |
| **Similarity** | Elements that look alike are seen as a group | Use consistent styling for the same category of elements |
| **Continuity** | The eye follows lines and paths | Align elements to guide the eye. Use visual lines for navigation flows. |
| **Closure** | The brain completes incomplete shapes | Use partial borders/shapes intentionally to indicate continuation |
| **Figure/Ground** | Elements are perceived as either foreground or background | Modals, tooltips, dropdowns must have strong contrast from background |
| **Common Fate** | Elements moving together are perceived as related | Animate related items together (stagger siblings, not random elements) |

### 2.2 Cognitive Load Laws

**Hick's Law** — More choices = longer decision time (logarithmic)
- Navigation: max 7 items visible at once (group the rest under "More")
- Forms: one question per step for complex flows (wizard patterns)
- Dropdown menus: group items, use dividers, max 12 items before search is needed

**Miller's Law** — Working memory holds 7±2 items
- Don't show more than 7 data points in a single chart without grouping
- Don't show more than 7 filter chips simultaneously
- Break long forms into sections of ≤7 fields each

**Fitts's Law** — Time to hit a target = function of distance / size
- Mobile primary actions: bottom of screen (within thumb reach), minimum 48×48px
- Desktop primary CTA: generous size, near where the eye already is (reading-end of a form, post-content)
- Danger actions (delete): smaller, away from common interaction zones

**Von Restorff Effect** — The thing that is different gets remembered
- One element should stand out on any given screen — the primary CTA
- If everything is highlighted, nothing is highlighted
- Use this deliberately: a colored button in a sea of white cards draws all attention

### 2.3 Progressive Disclosure
Never show everything at once. Reveal complexity progressively:

```
Level 1: Core action (visible immediately)
Level 2: Common options (one click/tap away)
Level 3: Advanced settings (two clicks away, often in a "More" or gear icon)
```

Examples:
- Email client: Compose (L1) → CC/BCC (L2) → Schedule send, formatting toolbar (L3)
- Settings page: Common settings (L1) → Advanced tab (L2) → Developer API keys (L3)

---

## 3. Animation & Motion Design

### 3.1 The Cardinal Rule of Animation
**Every animation must communicate something.** If you cannot articulate what the animation communicates (state change, hierarchy, direction of origin, cause and effect), remove it.

### 3.2 Duration Scale

| Duration | Use Case | Example |
|---|---|---|
| 50–100ms | Micro-feedback | Button press color change, checkbox tick, toggle switch |
| 150–250ms | Element state transitions | Hover effects, focus rings, dropdown opening |
| 250–350ms | Component entrance/exit | Toast notification, tooltip, popover |
| 350–500ms | Page/modal transitions | Route change, modal open/close, drawer slide |
| >500ms | Deliberate dramatic effect ONLY | Onboarding animation, success celebration, empty state illustration |

> [!CAUTION]
> Durations over 500ms in functional UI feel sluggish. Reserve them for moments that deserve attention.

### 3.3 Easing Reference

```css
/* Elements entering the viewport */
.enter { transition: all 250ms cubic-bezier(0.0, 0.0, 0.2, 1); }  /* ease-out: fast start, gentle stop */

/* Elements leaving the viewport */
.exit  { transition: all 200ms cubic-bezier(0.4, 0.0, 1, 1); }   /* ease-in: gentle start, fast end */

/* Elements moving within the viewport */
.move  { transition: all 300ms cubic-bezier(0.4, 0.0, 0.2, 1); } /* ease-in-out: smooth both ends */

/* Interactive/gesture-based (drag, swipe) */
/* Use spring physics via Framer Motion: */
/* transition={{ type: 'spring', stiffness: 400, damping: 30 }} */
```

### 3.4 Stagger Patterns
When multiple items animate in together, stagger them:

```tsx
// Framer Motion stagger example
<motion.ul
  variants={{
    visible: { transition: { staggerChildren: 0.05 } }  // 50ms between each child
  }}
  initial="hidden"
  animate="visible"
>
  {items.map(item => (
    <motion.li
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.2 } }
      }}
    />
  ))}
</motion.ul>
```

### 3.5 Animations to NEVER Use
- ❌ Continuous spinning logos or decorative spinners (use progress-based loading instead)
- ❌ Bouncing/elastic entrance animations on page load (distracting, unprofessional)
- ❌ Random floating/drifting background particles (visual noise)
- ❌ Parallax scrolling that serves no narrative purpose
- ❌ Text that types itself out in real-time for static content (wastes user time)
- ❌ Hover effects that move elements out of their position (breaks Fitts's Law)

### 3.6 Accessibility — Always Respect This
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

---

## 4. Anti-Vibe-Code Blacklist ⛔

> [!IMPORTANT]
> These are HARD violations. Any component or design spec containing these patterns must be corrected BEFORE handoff. These are not preferences — they are quality standards.

### 4.1 Typography & Text Violations

| Violation | Why Wrong | Correct Approach |
|---|---|---|
| Emoji in UI labels, buttons, headings (🚀✅💯🔥) | Renders inconsistently across OS, inaccessible to screen readers, unprofessional | Use icons from a single icon library (Lucide, Phosphor, Heroicons) |
| More than 6 distinct font sizes on a page | Visual chaos, no hierarchy | Use the defined type scale — max 6 sizes (xs, sm, base, lg, xl, 2xl) |
| Random font weight mixing (100, 300, 400, 500, 600, 700, 800 all in one page) | No visual rhythm | Use only 3 weights: regular (400), semibold (600), bold (700) |
| ALL CAPS for body text | Illegible for dyslexic users, feels aggressive | ALL CAPS only for labels/badges max 4 words, with letter-spacing: 0.08em |
| Text over busy image/gradient without overlay | Inaccessible, illegible | Dark overlay (rgba 0.5-0.6) or frosted glass with verified contrast |

### 4.2 Color Violations

| Violation | Why Wrong | Correct Approach |
|---|---|---|
| Rainbow gradient text | Illegible, no semantic meaning, amateur | Single color or 2-stop gradient only on display headings ≥32px |
| More than 4 semantic colors (info/success/warning/error) | Breaks semantic system | Exactly 4 semantic colors. Variants via opacity/shade, not new hues |
| Pure black (#000000) text on white (#ffffff) | Maximum contrast causes halation and reading fatigue | text: hsl(220, 15%, 12%) on bg: hsl(220, 20%, 99%) |
| Hardcoded color values in components | Breaks dark mode and theming | CSS custom properties / design tokens exclusively |
| Brand color used as background for large areas | Overwhelms and fatigues | Brand color max 10% of page area (buttons, badges, highlights) |

### 4.3 Layout & Component Violations

| Violation | Why Wrong | Correct Approach |
|---|---|---|
| Card-in-card-in-card (3+ levels of elevation nesting) | Depth confusion, claustrophobic, borders fighting each other | Max 2 levels: page surface + card. Use whitespace to group, not more cards |
| Card with both border AND shadow | Double visual cue for same meaning | Pick one: border for flat/minimal style, shadow for elevated style |
| Generic Shadcn/UI default styling (default indigo, default radius) | Indistinguishable from every other app, no brand identity | Override EVERY token: brand color, font, radius, shadow |
| Sidebar that is wider than 280px without collapse | Takes too much content space | Sidebar: 64px icon-only (collapsed), 240-280px (expanded) with toggle |
| Mobile layout copy-pasted from desktop (tiny text, tiny buttons) | Unusable on touch | Separate mobile layout: min 48px touch targets, bottom nav, full-width CTAs |
| Z-index chaos (z-index: 9999, 99999, 999999) | Layering breaks unpredictably | Defined z-index scale: base(0), elevated(10), dropdown(100), modal(200), toast(300) |

### 4.4 Interaction & Feedback Violations

| Violation | Why Wrong | Correct Approach |
|---|---|---|
| No loading state on async actions | User doesn't know if click registered | Every button that triggers async must show loading spinner and disable |
| Generic spinner for content loading | Content shifts in jarringly | Skeleton screens that match the exact shape of content |
| Instant delete without confirmation | Data loss with no recovery | Confirm destructive actions. Consider undo (30s) instead of confirm dialog |
| Form submits without any feedback | User re-clicks thinking it didn't work | Show inline loading on submit button. Success/error message after |
| Disabled buttons with no explanation | User doesn't know why or how to enable | Tooltip on disabled buttons explaining the requirement |

### 4.5 Data Visualization Violations

| Violation | Why Wrong | Correct Approach |
|---|---|---|
| Default Chart.js/Recharts rainbow colors | Clashes with brand, no meaning to colors | Override all colors with brand color scale |
| Pie chart with more than 5 segments | Too many slices = illegible | Max 5 segments. Group rest as "Other". Or use a bar chart |
| 3D charts of any kind | Distorts data perception, inaccessible | 2D only. 3D charts are decoration, not data communication |
| No chart title + subtitle | User doesn't know what they're looking at | Every chart: title (what is this) + subtitle (why it matters / time range) |
| Chart axes without labels and units | Ambiguous data | Always label axes. Always show units (USD, %, ms, users) |
| Chart colors without accessible alternatives | Color-blind users cannot read it | Use both color AND pattern/shape to encode data |

---

## 5. Custom Data Visualization Standards

### 5.1 Preferred Libraries (with Required Customization)
```tsx
// Recharts — acceptable but MUST customize all colors
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ✅ Correct: Using brand tokens
<Bar dataKey="value" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />

// ❌ Wrong: Default library color
<Bar dataKey="value" fill="#8884d8" />  // This is Recharts default — never acceptable
```

### 5.2 Chart Anatomy Requirements
Every chart MUST have:
1. **Title** — what metric is shown (e.g., "Monthly Active Users")
2. **Subtitle or caption** — context (e.g., "Last 12 months · Updated daily")
3. **Axis labels with units** — e.g., "Revenue (USD)", "Date (MMM YYYY)"
4. **Tooltip** — hover/tap to see exact values with proper formatting
5. **Empty state** — what to show when there's no data yet (not a blank white box)
6. **Loading skeleton** — matching the chart's shape

### 5.3 Color-Blind Safe Palette
For charts with multiple series, use this palette (readable by all color vision types):
```css
/* IBM Color Blind Safe Palette */
--chart-blue:   #648FFF;
--chart-violet: #785EF0;
--chart-red:    #DC267F;
--chart-orange: #FE6100;
--chart-yellow: #FFB000;
```

---

## 6. Fast UI Patterns (Perceived Performance)

The UI should FEEL fast even when the network is slow.

### 6.1 Optimistic Updates
Update the UI immediately when the user takes an action. Sync with server in background. Roll back only on error:

```tsx
const toggleLike = useMutation({
  mutationFn: (id: string) => api.post(`/posts/${id}/like`),
  onMutate: async (id) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['posts'] });
    // Snapshot the previous value
    const prev = queryClient.getQueryData(['posts']);
    // Optimistically update
    queryClient.setQueryData(['posts'], (old) =>
      old.map(p => p.id === id ? { ...p, liked: !p.liked } : p)
    );
    return { prev };
  },
  onError: (err, id, context) => {
    // Roll back on error
    queryClient.setQueryData(['posts'], context.prev);
  },
});
```

### 6.2 Skeleton Screens
Match the skeleton to the EXACT shape of the content:

```tsx
// ✅ Content-matched skeleton
function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />  {/* Avatar */}
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />  {/* Name */}
        <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />  {/* Email */}
      </div>
    </div>
  );
}

// ❌ Generic spinner — content shifts in jarringly
if (loading) return <Spinner />;
```

### 6.3 Instant Visual Response
Every user interaction must produce a visual response within 100ms, even if the server takes longer:
- Button: show loading state immediately on click (not after server responds)
- Input: show character count/validation immediately as user types
- Search: show skeleton results immediately while fetching

### 6.4 Progressive Image Loading
```tsx
// Blur-up technique: tiny placeholder → full resolution
function ProgressiveImage({ src, placeholder, alt }: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative overflow-hidden">
      <img src={placeholder} className="absolute inset-0 w-full h-full object-cover blur-md scale-110" />
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn('relative transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}
```

### 6.5 Stale-While-Revalidate
Show existing cached data immediately. Fetch fresh data in background. Only show loading on first-ever load:
```tsx
// React Query implements this automatically
useQuery({
  queryKey: ['dashboard'],
  queryFn: fetchDashboard,
  staleTime: 1000 * 60 * 2,      // Data is "fresh" for 2 minutes
  gcTime: 1000 * 60 * 10,        // Keep in cache for 10 minutes
  placeholderData: keepPreviousData,  // Show old data while refetching
});
```

---

## 7. UI Quality Self-Audit Checklist

Before ANY UI handoff, run through this checklist. All items must be ✅:

### Color & Typography
- [ ] Brand color used in ≤10% of page area
- [ ] All grays are brand-tinted (not pure neutral)
- [ ] Type scale strictly followed (max 6 sizes)
- [ ] Max 3 font weights used
- [ ] No emoji in functional UI text
- [ ] All text contrast ≥4.5:1 (body) or ≥3:1 (large/UI)

### Layout & Components
- [ ] Max 2 levels of surface elevation
- [ ] Cards use border OR shadow, not both
- [ ] No z-index magic numbers
- [ ] Mobile touch targets ≥48×48px
- [ ] 8-point grid followed (all spacing multiples of 4 or 8)

### Interactions & Animation
- [ ] Every async action has a loading state
- [ ] Content loading uses skeleton screens (not spinners)
- [ ] All animations follow duration scale
- [ ] `prefers-reduced-motion` respected
- [ ] Destructive actions require confirmation or undo

### Data Visualization
- [ ] No default library colors (all overridden with brand tokens)
- [ ] Every chart has title + subtitle + axis labels with units
- [ ] No pie charts with >5 segments
- [ ] No 3D charts
- [ ] Color-blind safe palette for multi-series charts

### Anti-Vibe-Code
- [ ] No emoji in UI labels or headings
- [ ] No rainbow gradient text
- [ ] No generic Shadcn/UI defaults (all tokens customized)
- [ ] No floating decorative particles or purposeless parallax
- [ ] No continuous spinning animations


---

## 8. Designing Mesmerizing AI Experiences

To truly delight and mesmerize users, functional UI is not enough. You must elevate the experience using these cutting-edge "magic" principles:

### 8.1 The "Alive" Interface (Generative UI)
- **Avoid Loading Spinners:** Never use a spinning circle when AI is thinking. Use **skeleton waves**, **shimmering gradients**, or **typewriter text** that reveals the model's thought process in real-time.
- **Dynamic Glows:** When the AI is active or a high-value action is ready, use a subtle, slow-breathing background glow (e.g., conic gradients with CSS `@keyframes` rotating slowly).

### 8.2 Fluid Spring Physics (Framer Motion / Reanimated)
- Never use linear transitions (`ease-in` or `ease-out`) for structural UI changes.
- **Use Spring Physics:** Bounding boxes, modals, and list reordering MUST use spring physics. 
- *Why?* Springs feel natural and responsive to the user's velocity. It makes the interface feel like a physical object you are holding, rather than a screen you are tapping.

### 8.3 Staggered AI Reveals
- When AI generates a list of items (e.g., recommendations, results), do NOT render them all at once.
- **Stagger the entrance** by 50-100ms each, sliding up slightly while fading in. This directs the eye and makes the response feel curated rather than dumped.

### 8.4 The "Zero-State" Magic
- Empty states should never just say "No data."
- Treat the empty state as the **best onboarding real estate**. Use an animated illustration, or better, provide **1-click magical AI suggestions** ("Try asking about X", "Generate a Y").

### 8.5 Micro-Haptics and Interaction Feedback
- Every button press should have a micro-interaction: a 0.95 scale squeeze (spring) or a subtle ripple.
- If implementing mobile, always specify where haptic feedback (HapticFeedback.light()) should trigger.

> [!IMPORTANT]
> If you are the `uiux-lead` or `mockup-wireframe-worker`, your design specs MUST include an "Animation & Magic" section for every screen, detailing how it breathes, loads, and mesmerizes the user.
