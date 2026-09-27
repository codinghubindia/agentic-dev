---
name: frontend-development
description: Comprehensive guide for building modern React frontends — component architecture, TypeScript patterns, state management, API integration with React Query, accessibility (WCAG 2.1 AA), performance optimization, and testing with React Testing Library.
refreshMode: full
lastResearched: 2024-01-01
---

# Frontend Development Skill

Standards and procedures for building production-grade React web frontends in a multi-agent software company.

---

## 1. Project Structure

```
frontend/
├── src/
│   ├── api/                  # typed API client functions (one file per domain)
│   ├── components/
│   │   ├── ui/               # base design-system components (Button, Input, Modal...)
│   │   └── features/         # feature-specific composed components
│   ├── hooks/                # custom React hooks (useAuth, useUsers, usePagination)
│   ├── pages/                # route-level page components
│   ├── routes/               # route config, auth guards, lazy loading
│   ├── store/                # global state (Zustand / Redux slices)
│   ├── styles/               # global CSS, design tokens, theme
│   ├── types/                # shared TypeScript interfaces/types
│   └── utils/                # pure utility functions
├── public/
├── index.html
└── vite.config.ts
```

---

## 2. TypeScript — Strict Mode

Always enable strict TypeScript:
```json
// tsconfig.json
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true } }
```
- Never use `any` — use `unknown` + narrowing when the type is genuinely unknown
- All component props must have explicit TypeScript interfaces
- API response types derived from `api-contract.json` — use a shared types package or generated types

---

## 3. Component Architecture

**Separation of concerns:**
- `ui/` components: purely presentational, no data fetching, no business logic, only props
- `features/` components: composed from `ui/` + hooks, may call API hooks
- `pages/` components: orchestrate features for a route, handle page-level layout

**Component file structure:**
```typescript
// components/ui/Button/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  'aria-label'?: string;
}

export function Button({ variant, size = 'md', disabled, loading, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(styles.button, styles[variant], styles[size])}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" aria-hidden /> : children}
    </button>
  );
}
```

---

## 4. API Integration — React Query

Use React Query (TanStack Query) for all server state:

```typescript
// hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser } from '@/api/users';

export const useUsers = (page: number) =>
  useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers({ page }),
    staleTime: 1000 * 60 * 5,    // 5 minutes
    placeholderData: (prev) => prev,  // keep previous page while loading
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};
```

- Always handle: `isLoading`, `isError`, `error`, `data` states in the component
- Use `staleTime` to prevent unnecessary refetches
- Invalidate queries after mutations — never manually update cache

---

## 5. State Management (Zustand)

For global client state (auth, UI preferences, cart, etc.):

```typescript
// store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth-storage' }
  )
);
```

- Only put **client-only** state in Zustand (server state belongs in React Query)
- Persist auth token to localStorage via `persist` middleware
- On logout: clear ALL persisted state — no stale user data

---

## 6. Routing with Protected Routes

```typescript
// routes/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  const location = useLocation();

  if (!token) {
    // Preserve the intended destination for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
```

- All routes behind auth must use `ProtectedRoute`
- No flash of protected content — check auth BEFORE rendering
- Use `React.lazy` + `Suspense` for code-splitting every route

---

## 7. Error Boundaries

Wrap feature sections with error boundaries to prevent full-page crashes:

```typescript
// In page-level components:
<ErrorBoundary fallback={<ErrorFallback />}>
  <UsersList />
</ErrorBoundary>
```

- Use `react-error-boundary` library
- Every route page must have an error boundary
- Error boundary fallback must provide a "retry" or "go home" action

---

## 8. Accessibility (WCAG 2.1 AA)

Non-negotiable standards:
- **Color contrast**: text ≥ 4.5:1, large text ≥ 3:1
- **Focus management**: every interactive element must have a visible focus ring (never `outline: none` without a custom replacement)
- **ARIA**: all icon buttons need `aria-label`, all form inputs need `<label>`, all modals need `role="dialog"` + `aria-labelledby`
- **Keyboard navigation**: Tab through all interactive elements, Enter/Space activate buttons/links, Escape closes modals
- **Screen reader**: use semantic HTML first; `aria-*` only when semantics are insufficient
- **Motion**: respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
  ```

---

## 9. Performance

- Bundle size: lazy-load all routes and heavy libraries (charts, rich text editors)
- Images: use `loading="lazy"` and `width`/`height` attributes to prevent layout shift
- Lists: virtualize long lists (> 100 items) with `@tanstack/virtual`
- Memoization: use `React.memo`, `useMemo`, `useCallback` only when profiling shows a problem — not preemptively

---

## 10. Testing Standards

- Use React Testing Library — query by `role`, `label`, `text` — never by `testId` for logic
- Test behavior, not implementation: "user clicks login, sees dashboard" not "useState was called"
- Mock API with `msw` (Mock Service Worker) — never mock fetch/axios directly
- Coverage target: ≥ 80% for components and hooks


## ⚠️ PACKAGE INSTALLATION & VITE + TAILWIND CSS
ALWAYS check skills first before searching the web for package installation steps.

**Strict Vite + Tailwind + PostCSS Setup:**
If initializing a React project with Vite and Tailwind CSS, you MUST follow these exact steps to prevent PostCSS initialization errors:
1. `npm create vite@latest frontend -- --template react-ts`
2. `cd frontend`
3. `npm install`
4. `npm install -D tailwindcss postcss autoprefixer`
5. `npx tailwindcss init -p` (The `-p` flag is CRITICAL as it creates both tailwind.config.js AND postcss.config.js)
6. Add the Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`) to `src/index.css`.
