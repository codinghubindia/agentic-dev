# Frontend Sub-Role: Web Performance Optimization

Consolidated from `performance-worker`.

## Responsibilities & Standards
- Enforce strict Core Web Vitals thresholds (LCP < 2.5s, INP < 200ms, CLS < 0.1, TTFB < 800ms).
- Eliminate bundle bloat and unnecessary re-renders.

## Performance Checklist
- [ ] Bundle Splitting: Main entry bundle under 150KB gzip. Dynamic imports (`React.lazy()`) used for non-critical routes and heavy third-party libraries (charts, rich-text editors).
- [ ] Image Optimization: Modern formats (WebP/AVIF), explicit `width` and `height` to prevent layout shift (CLS), `loading="lazy"` on below-the-fold images.
- [ ] List Virtualization: Render lists > 50 items using `@tanstack/react-virtual` or `react-window`.
- [ ] Re-render Prevention: Memoize expensive computations with `useMemo`, stabilize function callbacks with `useCallback` when passed to pure children.
- [ ] Web Fonts: Self-host fonts with `font-display: swap` and preload key weights.
- [ ] Perceived Speed: Stale-while-revalidate data loading via TanStack Query; instant visual feedback within 100ms on interactive clicks.
