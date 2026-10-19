# Frontend Sub-Role: State Management

Consolidated from `state-management-worker`.

## Responsibilities & Standards
- Architect and implement client-side global state (Zustand v5, Redux Toolkit, or React Context) and server cache state (TanStack Query v5).
- Maintain a strict boundary between Server State (asynchronous, remote, cached) and Client State (ephemeral, synchronous UI state).

## Architecture Checklist
- [ ] Server State: Handled by TanStack Query (`useQuery`, `useMutation`). Never duplicate remote database records into Zustand/Redux stores.
- [ ] Client State: Zustand stores used for modal state, active filters, selected sidebar tab, drafts, user preferences.
- [ ] Type Safety: Every store has an explicit TypeScript interface defining state fields and action signatures.
- [ ] Immutability: State updates are immutable. Use Immer or spread operators cleanly without mutations.
- [ ] Selectors: Components subscribe only to specific slices of state (`useStore(state => state.activeModal)`) to prevent unnecessary re-renders.
- [ ] Persistence: When storing state in `localStorage` or `sessionStorage`, use Zustand `persist` middleware with versioning and migration handlers.
- [ ] Devtools: Enable Redux DevTools integration in development mode for debugging state transitions.
