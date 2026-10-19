# Micro-Skill: Database Schema Design & Indexing

**Scope**: Relational schema normalization, primary key strategies, and index optimization.

## Rules & Checklists
1. **Primary Key Strategy**:
   - Prefer UUIDv7 (time-ordered, sequential) or `BIGINT/BIGSERIAL` to prevent B-tree page fragmentation.
   - Avoid random UUIDv4 as clustered primary keys on high-write tables.
2. **Foreign Key Integrity**:
   - Always define explicit foreign key constraints with explicit `ON DELETE` actions (`CASCADE`, `RESTRICT`, `SET NULL`).
   - Add indexes on all foreign key columns to prevent table locks during cascades.
3. **Index Selection**:
   - Index columns used frequently in `WHERE`, `JOIN`, and `ORDER BY` clauses.
   - For composite indexes, place equality condition columns first, followed by range/sorting columns.
   - Use partial indexes for skewed distributions (e.g. `CREATE INDEX ON orders (created_at) WHERE status = 'pending'`).
   - Use GIN indexes for JSONB containment (`?`, `@>`) and PostgreSQL full-text search vectors.
4. **Column Constraints**:
   - Make columns `NOT NULL` by default; only allow `NULL` if nullability has explicit business semantics.
   - Use `CHECK` constraints to validate enum-like values or bounded numeric ranges at the database level.
5. **Timestamp Tracking**:
   - Include `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` on all persistent tables.
