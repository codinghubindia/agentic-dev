---
name: performance-optimization
description: Web performance optimization guide covering Core Web Vitals measurement (LCP, CLS, INP, FCP, TTFB), Lighthouse auditing, JavaScript bundle analysis and reduction, React rendering optimization, image optimization, caching strategies, resource hints, virtualization of long lists, and performance budget enforcement.
refreshMode: full
lastResearched: 2024-01-01
---

# Performance Optimization Skill

Standards for measuring, analyzing, and optimizing frontend web application performance.

---

## 1. Performance Budgets

Define budgets BEFORE starting work. Measure BEFORE optimizing.

| Metric | Good | Needs Work | Poor (Critical) |
|---|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | 200–500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |
| FCP (First Contentful Paint) | ≤ 1.8s | 1.8–3.0s | > 3.0s |
| TTFB (Time to First Byte) | ≤ 800ms | 800–1800ms | > 1800ms |
| JS Bundle (initial, gzipped) | ≤ 200KB | 200–500KB | > 500KB |
| Total page weight | ≤ 1MB | 1–3MB | > 3MB |
| Lighthouse Performance Score | ≥ 90 | 70–89 | < 70 |

**Rule:** Never ship without a baseline measurement. Every optimization must have a before/after metric.

---

## 2. Measurement Tools

### Lighthouse CLI
```bash
# Audit a specific page
npx lighthouse http://localhost:3000 \
  --output=json \
  --output-path=./lighthouse-report.json \
  --chrome-flags="--headless" \
  --preset=desktop

# For mobile preset
npx lighthouse http://localhost:3000 \
  --preset=perf \
  --emulated-form-factor=mobile
```

### Bundle Analysis
```bash
# Vite projects
npx vite-bundle-visualizer

# Webpack projects
npx webpack-bundle-analyzer dist/stats.json

# Next.js
npm install @next/bundle-analyzer
# Add to next.config.js: withBundleAnalyzer({ enabled: true })
```

### Web Vitals Runtime (ship with the app)
```typescript
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics({ name, value, rating }: { name: string; value: number; rating: string }) {
  // Send to your analytics endpoint
  navigator.sendBeacon('/api/vitals', JSON.stringify({ name, value, rating }));
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

---

## 3. JavaScript Bundle Reduction

### Route-Level Code Splitting (biggest single win)
```tsx
import { lazy, Suspense } from 'react';

// ❌ Eagerly imported — all code in initial bundle
import { DashboardPage } from './pages/Dashboard';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';

// ✅ Lazy loaded — each route is a separate chunk
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// Always wrap lazy components in Suspense
<Route path="/dashboard" element={
  <Suspense fallback={<PageSkeleton />}>
    <DashboardPage />
  </Suspense>
} />
```

### Component-Level Splitting for Heavy Libraries
```tsx
// Split out heavy libraries into their own chunk
const RichEditor = lazy(() => import('./components/RichEditor'));   // quill, tiptap, etc.
const PDFViewer = lazy(() => import('./components/PDFViewer'));      // pdf.js
const MapView = lazy(() => import('./components/MapView'));          // leaflet, mapbox
const ChartView = lazy(() => import('./components/ChartView'));      // recharts, chart.js

// Load on interaction (not on page load)
function EditPost() {
  const [editorLoaded, setEditorLoaded] = useState(false);
  return (
    <>
      <button onClick={() => setEditorLoaded(true)}>Open Editor</button>
      {editorLoaded && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <RichEditor />
        </Suspense>
      )}
    </>
  );
}
```

### Tree Shaking — Import Only What You Use
```typescript
// ❌ Entire lodash in bundle (~70KB gzipped)
import _ from 'lodash';
const result = _.debounce(fn, 300);

// ✅ Just the function (~1KB)
import debounce from 'lodash/debounce';

// ✅ Even better — use native/smaller alternatives
// lodash.debounce → native setTimeout wrapper
// moment.js → date-fns (tree-shakable) or native Intl
// axios → native fetch with a thin wrapper

// ❌ Entire icon library in bundle
import * as Icons from 'react-icons/fa';

// ✅ Only the icons you need
import { FaUser, FaHome, FaSearch } from 'react-icons/fa';
```

### Dependency Audit — Check Bundle Impact Before Adding
```bash
# Check a package's bundle size before installing
npx bundlephobia lodash
# Shows: Size: 71.5kB | Gzipped: 25.2kB | Tree-shaking: ❌

npx bundlephobia date-fns
# Shows: Size: 76.2kB | Gzipped: 19.5kB | Tree-shaking: ✅
```

---

## 4. React Rendering Optimization

### Prevent Unnecessary Re-renders

**Problem: Every parent re-render causes children to re-render**
```tsx
// ❌ Recalculated on every render
function ProductList({ products, filters }) {
  const filteredProducts = products
    .filter(p => p.category === filters.category)
    .sort((a, b) => b.price - a.price); // expensive

  return filteredProducts.map(p => <ProductCard key={p.id} product={p} />);
}

// ✅ Only recalculates when products or filters change
function ProductList({ products, filters }) {
  const filteredProducts = useMemo(
    () => products
      .filter(p => p.category === filters.category)
      .sort((a, b) => b.price - a.price),
    [products, filters.category]
  );

  return filteredProducts.map(p => <ProductCard key={p.id} product={p} />);
}
```

**Memoize callbacks to prevent child re-renders**
```tsx
// ❌ New function reference on every parent render → child always re-renders
function Parent() {
  const handleDelete = (id: string) => deleteItem(id); // new ref each render
  return <Child onDelete={handleDelete} />;
}

// ✅ Stable function reference
function Parent() {
  const handleDelete = useCallback((id: string) => deleteItem(id), [deleteItem]);
  return <Child onDelete={handleDelete} />;
}

// Memoize pure child components
const Child = memo(({ onDelete, item }: Props) => (
  <div>
    <span>{item.name}</span>
    <button onClick={() => onDelete(item.id)}>Delete</button>
  </div>
));
```

### React DevTools Profiler
Use the React DevTools "Profiler" tab to:
1. Record an interaction
2. Look for components with long render times (>16ms = drops frame)
3. Look for components that render when they shouldn't (gray = wasted render)
4. Fix: add memo(), split into smaller components, or move state down

### State Colocation — Move State Down
```tsx
// ❌ Global state causes whole tree to re-render
function App() {
  const [inputValue, setInputValue] = useState(''); // too high up
  return (
    <>
      <Header />        {/* re-renders on every keystroke */}
      <Sidebar />       {/* re-renders on every keystroke */}
      <SearchInput value={inputValue} onChange={setInputValue} />
    </>
  );
}

// ✅ State lives only where it's needed
function App() {
  return (
    <>
      <Header />
      <Sidebar />
      <SearchInput /> {/* owns its own state — nothing else re-renders */}
    </>
  );
}
```

---

## 5. List Virtualization

**Rule:** Any list > 50 items MUST be virtualized.

```tsx
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// ❌ Renders all 10,000 rows in the DOM
function ProductList({ items }) {
  return <div>{items.map(item => <Row key={item.id} item={item} />)}</div>;
}

// ✅ Only renders ~15 visible rows at a time
function ProductList({ items }) {
  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          itemCount={items.length}
          itemSize={72}         // row height in px — must be fixed
          overscanCount={3}     // render 3 extra rows above/below for smooth scroll
        >
          {({ index, style }) => (
            <div style={style}>  {/* style prop positions the row — DO NOT omit */}
              <Row item={items[index]} />
            </div>
          )}
        </List>
      )}
    </AutoSizer>
  );
}

// For variable-height rows
import { VariableSizeList } from 'react-window';
```

---

## 6. Image Optimization

**Checklist for every image:**
```
✅ Format: WebP (30–50% smaller than JPEG/PNG) or AVIF (even smaller, wider support 2024+)
✅ Explicit width + height attributes (prevents CLS — browser reserves space)
✅ loading="lazy" on all below-fold images
✅ loading="eager" / fetchpriority="high" on LCP image
✅ Responsive srcset for different viewport sizes
✅ CSS object-fit: cover instead of stretching
```

```tsx
// ❌ No dimensions, no lazy loading, wrong format
<img src="/hero.png" alt="Hero" />

// ✅ Optimized
<img
  src="/hero.webp"
  alt="Hero section"
  width={1200}
  height={600}
  fetchpriority="high"       // LCP image — load immediately
  decoding="async"
/>

// Below-fold images
<img
  src="/feature.webp"
  alt="Feature"
  width={600}
  height={400}
  loading="lazy"
  decoding="async"
/>

// Responsive images
<img
  srcSet="/img-400.webp 400w, /img-800.webp 800w, /img-1200.webp 1200w"
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
  src="/img-1200.webp"
  alt="..."
  loading="lazy"
/>
```

---

## 7. Caching Strategy

### HTTP Cache Headers
```
# Static assets with content hash in filename (e.g., main.abc123.js)
Cache-Control: public, max-age=31536000, immutable

# HTML entry point (index.html) — always revalidate
Cache-Control: no-cache

# API responses — short cache for list endpoints
Cache-Control: private, max-age=60, stale-while-revalidate=300

# User-specific data — no caching
Cache-Control: no-store
```

### Vite Build Configuration for Cache-Busting
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Content hash in filename = safe to cache forever
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        // Split vendor code into separate chunk (cached separately from app code)
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
```

---

## 8. Resource Hints

Add to `index.html` `<head>` for critical resources:

```html
<!-- Preconnect: establish TCP connection early for third-party origins -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://api.yourdomain.com" />

<!-- Preload: fetch and cache critical resources immediately -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
<link rel="preload" as="font" href="/fonts/inter.woff2" type="font/woff2" crossorigin />
<link rel="preload" as="script" href="/assets/vendor.abc123.js" />

<!-- DNS-prefetch: cheaper than preconnect, for less-critical origins -->
<link rel="dns-prefetch" href="https://analytics.yourdomain.com" />

<!-- Prefetch: load next-page resources during idle time -->
<link rel="prefetch" href="/assets/dashboard.abc123.js" />
```

---

## 9. CLS Prevention

CLS (layout shift) kills user experience. Common causes and fixes:

```css
/* ❌ Image without dimensions → browser doesn't know size → content shifts */
img { width: 100%; }

/* ✅ Aspect ratio box reserves space before image loads */
.image-container {
  aspect-ratio: 16 / 9;   /* modern browsers */
  overflow: hidden;
}
img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ❌ Font swap causes text reflow → CLS */
@font-face {
  font-display: swap;   /* shows fallback, then swaps → layout shift */
}

/* ✅ Use optional (no shift) or fallback with size-adjust */
@font-face {
  font-display: optional;   /* only uses custom font if cached — no shift */
}
/* Or use font-size-adjust / size-adjust to match fallback metrics */
```

---

## 10. Performance Report Format

Always document before/after metrics. Store in `performance-report.md`:

```markdown
# Performance Report — [Date]

## Baseline (Before)
| Metric | Value | Rating |
|---|---|---|
| LCP | 4.2s | ❌ Poor |
| INP | 380ms | ❌ Poor |
| CLS | 0.18 | ⚠️ Needs Work |
| JS Bundle | 520KB | ❌ Poor |
| Lighthouse | 62 | ❌ Poor |

## After Optimization
| Metric | Value | Change | Rating |
|---|---|---|---|
| LCP | 2.1s | -50% | ✅ Good |
| INP | 145ms | -62% | ✅ Good |
| CLS | 0.04 | -78% | ✅ Good |
| JS Bundle | 178KB | -66% | ✅ Good |
| Lighthouse | 94 | +32pts | ✅ Good |

## Changes Made
1. Route-level code splitting → -290KB initial bundle
2. WebP conversion + explicit dimensions → LCP -1.2s, CLS fixed
3. react-window virtualization for product list (10k items)
4. useMemo on 3 expensive filter/sort operations
5. Preload hero image + Inter font

## Outstanding Issues
- [Any remaining issues and recommended next steps]
```

---

## 11. Audit Checklist

Before marking performance work done:
- [ ] Lighthouse score ≥ 90 on desktop, ≥ 80 on mobile
- [ ] LCP ≤ 2.5s measured at P75
- [ ] INP ≤ 200ms measured at P75
- [ ] CLS ≤ 0.1
- [ ] Initial JS bundle ≤ 200KB gzipped
- [ ] All images have explicit width + height
- [ ] All below-fold images are lazy-loaded
- [ ] LCP image has fetchpriority="high"
- [ ] Long lists (>50 items) virtualized with react-window
- [ ] Performance report (before/after) written and delivered
