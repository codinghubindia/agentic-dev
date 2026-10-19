# Micro-Skill: Backend Data Access & ORM

**Scope**: Data access layer, query optimization, and data layer patterns.

## Rules & Checklists
1. **Repository Encapsulation**:
   - Isolate database interactions within dedicated repository classes/functions.
   - Domain services must interact with repositories, never issuing raw ad-hoc queries directly.
2. **N+1 Prevention**:
   - Eager-load relations using joins (`include` / `relations`) or batch loaders (`DataLoader`).
   - Audit database query logs during test runs to ensure O(1) query count per request.
3. **Strict Query Parameterization**:
   - Never use string interpolation or concatenation when building raw SQL queries.
   - Always pass parameters through sanitized binding placeholders (`$1`, `?`).
4. **Efficient Pagination**:
   - Use keyset/cursor pagination (`WHERE id > $lastId ORDER BY id ASC LIMIT $limit`) for lists exceeding 100 rows.
   - Avoid deep `OFFSET` pagination which triggers sequential table scans.
5. **Connection & Resource Safety**:
   - Always return client connections to the pool in a `finally` block or use scoped ORM context.
   - Set query statement timeouts (e.g. 5000ms) to prevent rogue query deadlocks.
