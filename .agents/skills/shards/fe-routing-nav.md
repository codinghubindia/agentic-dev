# Micro-Skill: Frontend Client Routing & Navigation

**Scope**: Route declarations, auth guards, code splitting, and layout hierarchies.

## Rules & Checklists
1. **Typed Route Paths**:
   - Centralize all route paths in a typed constant map (e.g., `ROUTES.DASHBOARD = '/dashboard'`). Zero raw strings in `navigate()` or `<Link href="">`.
2. **Code Splitting (Lazy Loading)**:
   - Every page route component MUST be loaded with `React.lazy()` and wrapped in `<Suspense fallback={<PageSkeleton />}>`.
   - Never import page components via static synchronous imports at the router entry point.
3. **Authentication Guards**:
   - Check authentication state before rendering protected route children.
   - Redirect unauthenticated users immediately (`/login?redirect=...`) with no flash of protected content.
4. **Role-Based Guards**:
   - Validate user roles/permissions on restricted routes. Render an explicit 403 Forbidden screen if unauthorized.
5. **Layouts & Deep Linking**:
   - Use nested route layouts (`<Outlet />`) for shared chrome (navigation bar, sidebar, drawer).
   - Preserve URL search parameters and state when navigating between tabs and filtered views.
6. **404 Catch-All**:
   - Configure a catch-all `path="*"` route with a clear explanation and button to return to home.
