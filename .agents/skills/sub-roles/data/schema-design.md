# Data Sub-Role: Database Schema Design

Consolidated from `schema-design-worker`.

## Responsibilities & Standards
- Design normalized relational schemas (PostgreSQL) or document schemas (MongoDB) adhering to domain invariants.

## Schema Checklist
- [ ] Primary Keys: Use UUIDv7 or CUID2 for distributed scalability and sortable primary keys, or BIGINT identity keys.
- [ ] Foreign Keys & Constraints: Explicit foreign keys with appropriate `ON DELETE` semantics (`CASCADE`, `RESTRICT`, `SET NULL`).
- [ ] Integrity Constraints: `NOT NULL` on required fields, `CHECK` constraints on ranges/enums, and `UNIQUE` constraints on natural keys (e.g. email, slug).
- [ ] Timestamps: Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- [ ] Index Strategy: Foreign key columns, lookup keys, and frequent filter/sort columns indexed. Composite indexes ordered by cardinality.
