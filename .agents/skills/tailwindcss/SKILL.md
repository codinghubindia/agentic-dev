---
name: tailwindcss
description: Tailwind CSS v3 — configuration, design tokens, dark mode, JIT gotchas, and component patterns.
category: frontend
packages: [tailwindcss, postcss, autoprefixer]
workerRoles: [strike-worker-frontend]
microTasks: [F1, F3]
currentVersion: 3.4.13
lastResearched: 2026-10-01
refreshIntervalDays: 90
status: stable
---

> [!NOTE]
> **Skill Freshness**: Tailwind v4 (alpha) uses a completely different config format (CSS-first). This skill covers stable v3. Check npm for v4 release status.

# 🎨 Tailwind CSS v3 — Production Patterns

## 0. Install & Scaffold
```bash
# Pre-install deprecation check
npm view tailwindcss deprecated 2>/dev/null | grep -i deprecated
# Install via CLI (generates config automatically)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
# -p flag auto-creates postcss.config.js alongside tailwind.config.js
```

---

## 1. Config — Design Token Setup

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  darkMode: 'class', // ← class-based dark mode (not 'media')
  theme: {
    extend: {
      colors: {
        // Brand color scale — generate with oklch() or tailwindshades.com
        brand: {
          50:  '#f0f7ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // ← primary
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
};
```

---

## 2. Dark Mode Pattern

```tsx
// Toggle dark mode by adding/removing 'dark' class on <html>
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return (
    <button onClick={() => setDark(d => !d)}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// Use dark: prefix in classes
<div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50">
```

---

## 3. Semantic Color Token Pattern

```tsx
// Instead of using literal colors, use semantic tokens
// Define in CSS as variables, map to Tailwind

/* global.css */
:root {
  --color-bg: theme('colors.white');
  --color-fg: theme('colors.zinc.900');
  --color-surface: theme('colors.zinc.50');
  --color-border: theme('colors.zinc.200');
}
.dark {
  --color-bg: theme('colors.zinc.950');
  --color-fg: theme('colors.zinc.50');
  --color-surface: theme('colors.zinc.900');
  --color-border: theme('colors.zinc.800');
}

// tailwind.config.js extend:
colors: {
  bg: 'var(--color-bg)',
  fg: 'var(--color-fg)',
  surface: 'var(--color-surface)',
  border: 'var(--color-border)',
}

// Usage:
<div className="bg-bg text-fg border border-border">
```

---

## 4. JIT Gotchas

```tsx
// ❌ Dynamic class strings are NOT picked up by JIT scanner
const color = isActive ? 'bg-brand-500' : 'bg-zinc-100';
// JIT sees: `bg-${color}` — purged from production build

// ✅ Use full class strings in a lookup object
const colorMap = { active: 'bg-brand-500', inactive: 'bg-zinc-100' };
const color = colorMap[isActive ? 'active' : 'inactive'];
// JIT sees full strings — kept in build

// ✅ Or use cn() / clsx() with full strings
import { clsx } from 'clsx';
clsx(isActive ? 'bg-brand-500' : 'bg-zinc-100');
```

---

## 5. Component Extraction — Use sparingly

```css
/* Use @apply ONLY for truly reused base styles — not one-offs */
/* Prefer extracting React components instead of CSS components */
@layer components {
  .btn-primary {
    @apply px-4 py-2 rounded-lg bg-brand-500 text-white font-medium
           hover:bg-brand-600 active:scale-95 transition-all;
  }
}
/* ⚠️ Do not use @apply for layout or responsive classes */
```

---

## 6. Arbitrary Values

```tsx
// When design calls for a non-standard value
<div className="mt-[22px] w-[calc(100%-2rem)] grid-cols-[1fr_2fr_1fr]">
// Use sparingly — if you need it 3+ times, add it to theme.extend
```

---

## 7. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| Hardcoded hex colors in className (`text-[#3b82f6]`) | Use brand color scale tokens |
| Dynamic class construction (`bg-${color}-500`) | Full string lookup map |
| Overusing `@apply` | Extract React component instead |
| Using `!important` (`!text-red-500`) | Fix specificity at the component level |
| Not setting `content` in tailwind.config.js | JIT won't scan files → empty production CSS |
| `darkMode: 'media'` | Use `'class'` for user-controlled toggle |
