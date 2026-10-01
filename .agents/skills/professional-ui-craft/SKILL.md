---
name: professional-ui-craft
description: Professional visual design craft, color psychology, 60-30-10 rule, brand-tinted surfaces, cognitive design laws, and anti-vibe-code quality blacklist.
lastResearched: 2026-10-01
---

# 🎨 Professional UI Craft & Visual Quality Standards

> [!IMPORTANT]
> This skill defines the **visual aesthetic bar** for all UI/UX work in the framework. It strictly forbids generic, bland "AI template" styles.

---

## 1. Applied Color Psychology & Surface Hierarchy

### The 60-30-10 Rule
* **60% Neutral Ground (Backgrounds & Large Surfaces):**  
  The silent foundation. Must never draw attention to itself.
* **30% Secondary Depth (Cards, Headers, Navbars, Subtle Borders):**  
  Adds architectural structure and visual separation without clutter.
* **10% High-Impact Accent (Primary CTAs, Active States, Key Metrics):**  
  Strictly capped to 10% of the visible viewport. If everything is colorful, nothing is important.

### The Brand-Tinted Gray Rule (No Dead Grays)
* **❌ Dead Grays (Banned):** `#808080`, pure `#000000`, pure `#ffffff`. They look accidental and uncrafted.
* **✅ Brand-Tinted Grays (Mandatory):** Tint neutrals with 4% to 8% saturation of your brand hue:
  ```css
  /* Example for Blue-Brand Theme (Hue 220) */
  --surface-base:      hsl(220, 16%, 98%); /* Light base */
  --surface-card:      hsl(220, 14%, 94%); /* Light elevated */
  --surface-dark-base: hsl(220, 18%, 10%); /* Dark base */
  --surface-dark-card: hsl(220, 16%, 14%); /* Dark elevated */
  --border-subtle:     hsl(220, 12%, 88%); /* 1px border */
  ```

### Elevation via Borders, Not Muddy Shadows
* Max 2 levels of surface elevation (Base Surface $\rightarrow$ Card).
* Use crisp 1px borders (`border-subtle`) instead of heavy, blurry CSS drop shadows.

---

## 2. Cognitive Design Principles (Applied UX Laws)

* **Gestalt Law of Proximity:** Elements with related functionality must be physically close. Group form labels directly over inputs (4px–8px gap). Separate distinct sections with generous white space (24px–48px gap).
* **Fitts's Law (Touch & Click Targets):**
  * All interactive elements (buttons, nav links, icon triggers) must have a **minimum 48×48px click/touch target** on mobile and 36×36px on desktop.
* **Hick's Law (Progressive Disclosure):**
  * Never show 15 form fields at once. Use multi-step wizard sequences or progressive accordions.

---

## 3. Fast UI Perception Patterns

* **Content-Matched Skeletons (No Generic Spinners):**  
  Never render a full-page spinning loader. Render a pulsating skeleton screen that matches the exact geometric shape of the incoming content.
* **Optimistic UI Updates:**  
  When a user clicks "Like" or "Save", update the UI immediately (<50ms). Sync with the server in the background and roll back only on failure.
* **Instant Visual Feedback:**  
  All interactive buttons must reflect `:active` feedback within 50ms (e.g., scale to `0.97`).

---

## 4. The Hard Anti-Vibe-Code Blacklist ⛔

Any code diff containing these anti-patterns is **immediately rejected** by the QA auditor:

| Violation | Why It Fails | Mandated Approach |
|---|---|---|
| **Emoji in functional UI** | Looks juvenile, inauthentic, unstyled | Use clean SVG icons from Lucide, Heroicons, or Radix. |
| **Rainbow gradient text** | Destroys readability and typography hierarchy | Solid high-contrast text or subtle 2-stop brand gradient on display titles only. |
| **Card-in-card-in-card** | Creates claustrophobic nesting and visual chaos | Max 2 surface layers. Use whitespace and 1px lines. |
| **Default library chart colors** | Default Recharts/Chart.js pastels look like templates | Map all data visualization series to brand color tokens. |
| **Generic spinning loaders** | Induces anxiety and feels slow | Content-matched skeleton loaders with subtle pulse. |
| **Pure black text on white** | High contrast halation causes eye strain | Darkest body text: `hsl(220, 15%, 14%)`. |
