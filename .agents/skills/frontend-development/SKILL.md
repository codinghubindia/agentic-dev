---
name: frontend-development
description: Comprehensive guide for building modern React frontends — component architecture, TypeScript patterns, state management (TanStack Query v5, Zustand v5), Vite 6, Tailwind CSS (v4 & v3), accessibility (WCAG 2.1 AA), and testing with Vitest and MSW v2.
refreshMode: full
lastResearched: 2026-09-28
sources:
  - https://react.dev/blog/2024/12/05/react-19
  - https://react.dev/reference/react/useActionState
  - https://react.dev/learn/you-might-not-need-an-effect
  - https://vite.dev/guide/
  - https://tailwindcss.com/docs/installation/framework-guides/vite
  - https://tanstack.com/query/v5/docs/react/overview
  - https://zustand.docs.pmnd.rs/
  - https://testing-library.com/docs/react-testing-library/intro/
  - https://mswjs.io/docs/
---

## Overview
This skill provides standards, architectural patterns, and production-tested practices for building robust React web frontends. It covers project bootstrapping with Vite and strict TypeScript, styling with Tailwind CSS (v4 and v3), declarative state management separating client state (Zustand v5) and server state (TanStack Query v5), asynchronous transitions, accessibility (WCAG 2.1 AA), and behavioral testing with Vitest, React Testing Library, and Mock Service Worker (MSW v2).

## Key Patterns

### Pattern 1: Project Setup with Vite & Tailwind CSS (v4 & v3)
Bootstrap modern React applications using Vite with strict TypeScript and proper path resolution.

```bash
# Initialize React + TypeScript application
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D @types/node
```

**Tailwind CSS Setup (Tailwind v4 — Recommended Default):**
```bash
npm install tailwindcss @tailwindcss/vite
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tanstack') || id.includes('zustand')) return 'state';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'framework';
          }
        },
      },
    },
  },
});
```

```css
/* src/index.css (Tailwind v4) */
@import "tailwindcss";

@theme {
  --color-brand-primary: #2563eb;
  --color-brand-secondary: #475569;
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

*Note for Tailwind CSS v3 Projects:* If working with an existing Tailwind v3 project, install `tailwindcss postcss autoprefixer`, initialize with `npx tailwindcss init -p` to guarantee both `tailwind.config.js` and `postcss.config.js` are created, configure the `content` array for `./src/**/*.{ts,tsx}`, and use `@tailwind base; @tailwind components; @tailwind utilities;` in `src/index.css`.

---

### Pattern 2: Component Architecture & React 19/18 Conventions
Maintain strict separation of concerns across directory boundaries:
- `components/ui/`: Dumb presentational primitives with explicit prop types and no data fetching.
- `components/features/`: Composed domain features wiring UI components with state hooks.
- `pages/`: Route-level orchestrators managing layout and page-level metadata.

```typescript
// src/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

```tsx
// src/components/ui/Button.tsx
import React from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

// In React 19, ref is accepted directly as a standard prop (no forwardRef needed)
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 focus-visible:ring-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
    ghost: 'hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-400',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  return (
    <button
      ref={ref}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
```

---

### Pattern 3: Server State Management with TanStack Query v5
Server state is asynchronous, cached, and owned remotely. Define queries using `queryOptions` factories for full type inference and testability.

```typescript
// src/api/users.ts
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export const userQueries = {
  all: () => ['users'] as const,
  list: (page: number) =>
    queryOptions({
      queryKey: [...userQueries.all(), 'list', page],
      queryFn: async (): Promise<{ users: User[]; totalPages: number }> => {
        const res = await fetch(`/api/users?page=${page}`);
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      },
      staleTime: 1000 * 60 * 5, // 5 minutes fresh
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...userQueries.all(), 'detail', id],
      queryFn: async (): Promise<User> => {
        const res = await fetch(`/api/users/${id}`);
        if (!res.ok) throw new Error(`Failed to fetch user ${id}`);
        return res.json();
      },
      staleTime: 1000 * 60 * 10,
    }),
};

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUser: Omit<User, 'id'>): Promise<User> => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) throw new Error('Failed to create user');
      return res.json();
    },
    // Optimistic cache invalidation
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueries.all() });
    },
  });
}
```

```tsx
// src/components/features/UserList.tsx
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { userQueries } from '@/api/users';
import { Button } from '@/components/ui/Button';

export function UserList() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isPlaceholderData } = useQuery({
    ...userQueries.list(page),
    placeholderData: keepPreviousData, // Replaces keepPreviousData: true in v5
  });

  if (isPending) return <div role="status">Loading users...</div>;
  if (isError) return <div role="alert" className="text-red-600">{error.message}</div>;

  return (
    <section aria-labelledby="users-heading" className="space-y-4">
      <h2 id="users-heading" className="text-xl font-bold">User Directory</h2>
      <ul className="divide-y divide-slate-200">
        {data.users.map((user) => (
          <li key={user.id} className="py-2 flex justify-between">
            <span>{user.name}</span>
            <span className="text-slate-500">{user.email}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage((old) => Math.max(old - 1, 1))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isPlaceholderData || page >= data.totalPages}
          onClick={() => setPage((old) => old + 1)}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
```

---

### Pattern 4: Client State Management with Zustand v5
Use Zustand exclusively for true client-side global state (authentication session, UI preferences, drafts). Use `useShallow` from `zustand/react/shallow` to prevent unnecessary re-renders when selecting multiple state properties.

```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface UserSession {
  id: string;
  name: string;
  email: string;
  token: string;
}

interface AuthState {
  session: UserSession | null;
  theme: 'light' | 'dark' | 'system';
  setSession: (session: UserSession) => void;
  logout: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      theme: 'system',
      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'app-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session, theme: state.theme }),
    }
  )
);

// Selector hook with useShallow optimization
export function useCurrentUser() {
  return useAuthStore(
    useShallow((state) => ({
      isAuthenticated: Boolean(state.session?.token),
      user: state.session,
      logout: state.logout,
    }))
  );
}
```

---

### Pattern 5: React Actions & Responsive Transitions (`useActionState`, `useTransition`)
Modern React forms and async triggers leverage Actions and Transitions to avoid uncoordinated loading spinners and UI freezes.

```tsx
// src/components/features/UpdateProfileForm.tsx
import { useActionState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';

interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

async function updateProfile(previousState: ActionResponse, formData: FormData): Promise<ActionResponse> {
  const username = formData.get('username') as string;
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) throw new Error('Profile update failed');
    return { success: true, message: 'Profile updated successfully' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export function UpdateProfileForm({ initialName }: { initialName: string }) {
  const [state, formAction, isPending] = useActionState(updateProfile, { success: false });

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-700">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={initialName}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-green-600">{state.message}</p>
      ) : null}

      <Button type="submit" loading={isPending} disabled={isPending}>
        {isPending ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  );
}
```

---

### Pattern 6: Protected Routing with React Router Data APIs
Use React Router Data Routers (`createBrowserRouter`) with auth guards and code splitting via `React.lazy`.

```tsx
// src/routes/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.session?.token);
  const location = useLocation();

  if (!token) {
    // Preserve requested route for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
```

```tsx
// src/routes/index.tsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<div>Loading...</div>}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<div>Loading dashboard...</div>}>
            <DashboardPage />
          </Suspense>
        ),
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

---

### Pattern 7: Accessibility (WCAG 2.1 AA Compliance)
Every user interface must be accessible out of the box without requiring mouse navigation.

1. **Semantic Structure & Headings**: Ensure logical heading hierarchies (`h1` -> `h2` -> `h3`).
2. **Keyboard Navigation & Visible Focus**: Never remove outlines without providing a high-contrast replacement (`focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none`).
3. **Screen Reader Landmarks & Labels**:
   - Every `<button>` containing only an icon must have an `aria-label`.
   - Every input field must have an associated `<label htmlFor="id">`.
   - Modals and dialogs must implement `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and focus trap (use `@radix-ui/react-dialog` or native `<dialog>`).
4. **Contrast & Reduced Motion**:
   - Ensure text contrast is at least 4.5:1 against background colors.
   - Respect motion preferences:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, ::before, ::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

---

### Pattern 8: Behavioral Testing with Vitest, React Testing Library & MSW v2
Mock network traffic at the protocol level using MSW v2 and test user behavior rather than implementation details.

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json({
      users: [
        { id: '1', name: 'Alice Smith', email: 'alice@example.com', role: 'admin' },
      ],
      totalPages: 1,
    });
  }),
];
```

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '@/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```tsx
// src/components/features/UserList.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { UserList } from './UserList';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('UserList', () => {
  it('renders users fetched from API', async () => {
    renderWithClient(<UserList />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading users/i);
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });
});
```

## Common Pitfalls

- **Mixing server state in Zustand or Redux stores**: Duplicating API data in global stores leads to out-of-sync caches and manual refetch orchestration.
  *Fix*: Keep all API cache in TanStack Query; keep only client-only UI state (modals open, active filters, auth token) in Zustand.
- **Overusing `useEffect` for derived data**: Recalculating state inside `useEffect` causes redundant render passes and flickering.
  *Fix*: Compute derived values directly in the render function body, or wrap with `useMemo` if computationally expensive.
- **Tailwind v4 PostCSS errors or v3 missing configs**: Installing Tailwind v4 with obsolete `postcss.config.js` or installing v3 without generating PostCSS configuration causes build failure.
  *Fix*: For Tailwind v4, use `@tailwindcss/vite` and `@import "tailwindcss";` without PostCSS config. For Tailwind v3, always run `npx tailwindcss init -p` to generate both `tailwind.config.js` and `postcss.config.js`.
- **Zustand selector re-render cascades**: Extracting multiple store values using non-primitive selectors without `useShallow` triggers re-renders on every state mutation.
  *Fix*: Wrap multi-property selector objects in `useShallow` from `zustand/react/shallow`.
- **Breaking TanStack Query tracked properties**: Using object rest destructuring (e.g. `const { ...result } = useQuery(...)`) subscribes the component to every state property and disables render optimization.
  *Fix*: Explicitly destructure only the specific properties used: `const { data, isPending, error } = useQuery(...)`.
- **Accessibility regressions on interactive elements**: Creating clickable `<div>` or `<span>` elements without keyboard handlers, roles, or focus rings.
  *Fix*: Always use `<button type="button">`, or provide `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers for Space and Enter keys.
- **Testing implementation details**: Asserting internal hook state (`expect(useState).toHaveBeenCalled()`) or querying elements by test IDs (`getByTestId`).
  *Fix*: Query by accessible roles and text (`getByRole('button', { name: /save/i })`) using `@testing-library/react`.

## Quick Reference

| Area | Best Practice Standard | Rule / Command |
|---|---|---|
| **Bundler & Tooling** | Vite 6 + `@vitejs/plugin-react` | Strict TS paths mapped in both `tsconfig.json` and `vite.config.ts` |
| **Styling (v4)** | Tailwind v4 via `@tailwindcss/vite` | Add plugin in `vite.config.ts`, import `@import "tailwindcss";` in CSS |
| **Styling (v3)** | Tailwind v3 via PostCSS | `npx tailwindcss init -p`, configure `content` glob in `tailwind.config.js` |
| **Server State** | TanStack Query v5 | Use `queryOptions`, `isPending`, and `placeholderData: keepPreviousData` |
| **Client State** | Zustand v5 | Atomic slices, domain-specific stores, `useShallow` for multi-value selectors |
| **Actions & Transitions** | React 19/18 Concurrent APIs | Use `useActionState` for form states, `useTransition` for non-urgent updates |
| **Component Refs** | Direct `ref` prop (React 19) | Pass `ref` directly as a component prop; avoid `forwardRef` boilerplate |
| **Class Merging** | `cn()` utility | Combine `clsx` and `tailwind-merge` for conflict-free dynamic classes |
| **Accessibility** | WCAG 2.1 AA | Color contrast ≥ 4.5:1, visible `focus-visible` rings, semantic landmarks |
| **Testing** | Vitest + React Testing Library + MSW v2 | Intercept requests via `http.*` handlers in Node setup; test roles and labels |

## Resources

- [React Official Documentation](https://react.dev/) — Authoritative guide for React 19, Actions, hooks, and component lifecycle.
- [Vite Documentation](https://vite.dev/guide/) — Next-generation frontend build tooling and configuration reference.
- [Tailwind CSS Vite Installation Guide](https://tailwindcss.com/docs/installation/framework-guides/vite) — Official integration instructions for Tailwind v4 and Vite.
- [TanStack Query v5 Documentation](https://tanstack.com/query/v5/docs/react/overview) — Server state management, queryOptions, caching, and mutation lifecycles.
- [Zustand Documentation](https://zustand.docs.pmnd.rs/) — State management principles, selectors, slices pattern, and v5 migration.
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) — User-centric testing best practices and API references.
- [Mock Service Worker (MSW) Documentation](https://mswjs.io/docs/) — Protocol-level API mocking with modern `http` handlers.
- [W3C WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) — Authoritative patterns for accessible web components.
