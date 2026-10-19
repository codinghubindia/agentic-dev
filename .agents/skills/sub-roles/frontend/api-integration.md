# Frontend Sub-Role: API Integration & Client Services

Consolidated from `api-integration-worker`.

## Responsibilities & Standards
- Build typed API client functions that interface between the UI and backend REST/GraphQL endpoints.
- Derive types directly from executable contracts (`contracts.ts` / OpenAPI / Zod schemas).

## API Integration Checklist
- [ ] Contract Alignment: Client function request arguments and response shapes match `contracts.ts` exactly.
- [ ] TanStack Query Hooks: Wrap every API endpoint in a custom hook (`useUserData(id)`, `useUpdateProfile()`).
- [ ] Query Keys Factory: Maintain structured query keys (`userKeys.all`, `userKeys.detail(id)`) for safe invalidation.
- [ ] Optimistic Updates: Destructive or quick user interactions (like, bookmark, toggle, rename) apply immediately to UI cache and rollback on mutation error.
- [ ] Auth Interceptors: HTTP client (fetch/axios) automatically attaches `Authorization: Bearer <token>` and refreshes tokens on 401.
- [ ] Error Normalization: API errors normalize into an RFC 7807/9457 shape (`{ title, detail, status, code, validationErrors }`) so UI displays friendly field-level messages.
- [ ] Loading & Error States: Every consuming component gracefully handles `isLoading`, `isError`, and `data === undefined`.
