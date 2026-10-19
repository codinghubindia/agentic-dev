# Frontend Sub-Role: Client-Side Routing

Consolidated from `routing-worker`.

## Responsibilities & Standards
- Configure client-side routing (React Router v6/v7, TanStack Router, Next.js App Router).
- Enforce authentication guards, role-based access control (RBAC), code splitting, nested layouts, and error boundaries.

## Routing Checklist
- [ ] Typed Route Paths: Define all route paths as typed constants or enum (`ROUTES.DASHBOARD`, `ROUTES.SETTINGS`) — zero magic string literals in `navigate()` or `<Link>`.
- [ ] Code Splitting (Lazy Loading): Every route component is imported with `React.lazy()` and wrapped in `<Suspense fallback={<PageSkeleton />}>`.
- [ ] Auth Guards: Unauthenticated users attempting to access protected routes are redirected to `/login?redirect=...` without flashing protected UI.
- [ ] Role Guards: Users lacking required role/permissions receive a typed 403 Forbidden page or redirect.
- [ ] Nested Layouts: Shared navigation shells (sidebar, topbar, mobile nav) wrap child routes via `<Outlet />`.
- [ ] 404 Catch-All: A dedicated `*` route displays an informative Not Found screen with a clear CTA to return home.
- [ ] Error Boundaries: Major route branches have route-level error boundaries with retry mechanisms.
- [ ] Scroll Restoration: Viewport resets to top on route change unless navigating with back/forward history.
