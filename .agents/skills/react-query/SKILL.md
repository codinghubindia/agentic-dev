---
name: react-query
description: TanStack Query v5 (formerly React Query) — useQuery, useMutation, caching, invalidation, optimistic updates, and prefetching.
category: frontend
packages: [@tanstack/react-query]
workerRoles: [strike-worker-frontend]
microTasks: [F2]
currentVersion: 5.59.0
lastResearched: 2026-10-01
refreshIntervalDays: 60
status: stable
---

> [!NOTE]
> TanStack Query v5 has BREAKING CHANGES from v4. Key changes: `cacheTime` renamed to `gcTime`, `onSuccess`/`onError` callbacks removed from `useQuery`, `isLoading` renamed to `isPending`. This skill covers v5 API only.

> [!CAUTION]
> NEVER use `useEffect` + `fetch` for server data. Always use TanStack Query for server state.

# 🔄 TanStack Query v5 — Server State Management

## 0. Install & Setup
```bash
npm view @tanstack/react-query deprecated 2>/dev/null | grep -i deprecated
npm install @tanstack/react-query
npm install -D @tanstack/react-query-devtools
```

```tsx
// main.tsx or app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // data fresh for 60 seconds
      gcTime: 5 * 60 * 1000,    // keep unused data in cache for 5 min (was cacheTime in v4)
      retry: 1,                  // retry failed requests once
      refetchOnWindowFocus: true,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## 1. useQuery Pattern

```tsx
import { useQuery } from '@tanstack/react-query';

// Query key factory (prevents typos, enables targeted invalidation)
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
};

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isPending, isError, error } = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => fetchUser(userId),
    enabled: !!userId, // only run when userId is truthy
    staleTime: 5 * 60 * 1000, // override default for this query
  });

  if (isPending) return <ProfileSkeleton />;
  if (isError) return <ErrorMessage error={error} />;
  return <Profile user={user} />;
}

// Note: v5 removed isLoading — use isPending instead
// Note: v5 removed onSuccess/onError from useQuery — use useEffect or useMutation callbacks
```

---

## 2. useMutation + Invalidation

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function CreatePostForm() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreatePostInput) => createPost(data),
    onSuccess: (newPost) => {
      // Invalidate and refetch the posts list
      queryClient.invalidateQueries({ queryKey: ['posts', 'list'] });
      // Or: directly add to cache (no refetch needed)
      queryClient.setQueryData(['posts', 'detail', newPost.id], newPost);
    },
    onError: (error) => {
      toast.error('Failed to create post');
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate(formData);
    }}>
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  );
}
```

---

## 3. Optimistic Updates

```tsx
const mutation = useMutation({
  mutationFn: (updatedTodo: Todo) => updateTodo(updatedTodo),
  onMutate: async (updatedTodo) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    // Snapshot previous value
    const previousTodos = queryClient.getQueryData(['todos']);
    // Optimistically update
    queryClient.setQueryData(['todos'], (old: Todo[]) =>
      old.map(t => t.id === updatedTodo.id ? updatedTodo : t)
    );
    return { previousTodos }; // context for rollback
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['todos'], context?.previousTodos);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

---

## 4. Prefetching (for performance)

```tsx
// Prefetch on hover — data is ready when user clicks
async function prefetchUser(userId: string) {
  await queryClient.prefetchQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => fetchUser(userId),
    staleTime: 10 * 1000,
  });
}

<UserCard onHover={() => prefetchUser(user.id)} />
```

---

## 5. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| `useEffect` + `useState` for server data | Use `useQuery` |
| Inline query keys (`queryKey: ['users']`) | Use query key factory functions |
| `isLoading` check (v4 API) | Use `isPending` in v5 |
| `onSuccess` in `useQuery` (removed in v5) | Use `useEffect` watching `data` or `useMutation` |
| `cacheTime` (v4 API) | Use `gcTime` in v5 |
| Over-using `refetchInterval` | Trust `staleTime` + `invalidateQueries` |
