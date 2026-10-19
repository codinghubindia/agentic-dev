# Backend Sub-Role: Data Access & Repositories

Consolidated from `data-access-worker`.

## Responsibilities & Standards
- Implement repository patterns, ORM/query builder models (Prisma, Drizzle, Kysely, Mongoose), and raw optimized queries.
- Prevent connection pool exhaustion, N+1 query bugs, and unindexed table scans.

## Data Access Checklist
- [ ] Repository Layer: Encapsulate data fetching logic away from services. Return typed domain entities.
- [ ] N+1 Prevention: Use batch loading (DataLoader), SQL joins (`JOIN`), or Prisma `include` with relations. Never execute queries inside loops.
- [ ] Connection Pooling: Manage pool sizing (min/max connections), idle timeouts, and graceful shutdown (`prisma.$disconnect()` / `pool.end()`).
- [ ] Safe Parameterization: Every SQL query parameterized or handled by ORM — zero raw string interpolation or SQL injection risk.
- [ ] Pagination & Limits: Enforce `take`/`limit` on all collection queries to prevent out-of-memory errors from unbounded fetches.
