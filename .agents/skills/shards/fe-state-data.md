# Micro-Skill: Frontend State & Data Synchronization

**Scope**: Client state (Zustand) vs server cache (TanStack Query v5).

## Rules & Checklists
1. **Server vs Client Separation**:
   - Server State: Managed strictly via TanStack Query (`useQuery`, `useMutation`). Never mirror remote database records into Zustand.
   - Client State: Zustand stores used for modal open states, sidebar collapse, active filters, form drafts.
2. **Query Keys Factory**:
   - Always define structured query keys: `const userKeys = { all: ['users'], detail: (id) => ['users', id] }`.
   - Never use raw unorganized strings in `queryKey: ['user-data-123']`.
3. **Optimistic Updates**:
   - On rapid mutations (like, toggle, pin, reorder):
     - Cancel outgoing refetches (`queryClient.cancelQueries`).
     - Snapshot current cache (`queryClient.getQueryData`).
     - Optimistically mutate UI cache immediately (`queryClient.setQueryData`).
     - Roll back cache on error in `onError(err, vars, ctx)`.
4. **Selector Subscriptions**:
   - Always select specific slices: `useStore(s => s.activeTab)`. Avoid full store destructuring (`const { activeTab, ... } = useStore()`).
5. **Storage Persistence**:
   - Use Zustand `persist` middleware with an explicit `version` number and migration callback when caching to `localStorage`.
