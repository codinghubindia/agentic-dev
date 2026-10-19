# Micro-Skill: Database Migrations & Zero-Downtime DDL

**Scope**: Safe schema migrations, reversible UP/DOWN scripts, and lock prevention.

## Rules & Checklists
1. **Reversible UP and DOWN**:
   - Every migration must provide both an `UP` migration and an idempotent `DOWN` rollback script.
   - Verify that running `UP -> DOWN -> UP` produces an identical schema state in CI.
2. **Lock Timeout Protection**:
   - Set an explicit statement and lock timeout at the start of migrations: `SET lock_timeout = '4s';`.
   - Never allow a migration to queue indefinitely behind long-running analytical queries.
3. **Non-Blocking Indexing**:
   - In PostgreSQL, always build production indexes using `CREATE INDEX CONCURRENTLY`.
   - Drop indexes with `DROP INDEX CONCURRENTLY`.
4. **Expand-Contract Pattern**:
   - Phase 1: Add new nullable column or table.
   - Phase 2: Deploy code writing to both old and new columns.
   - Phase 3: Backfill historical data in chunked batches (e.g. 1000 rows/batch).
   - Phase 4: Deploy code reading exclusively from new column.
   - Phase 5: Drop deprecated column in a subsequent release.
5. **No Long-Running Data Migrations**:
   - Never run massive data transforms (`UPDATE table SET ...`) inside schema DDL transaction blocks.
