---
name: database-engineering
description: Comprehensive guide for database schema design, normalization, migration management, indexing strategy, query optimization, N+1 prevention, seed data, and ORM best practices for PostgreSQL and MongoDB.
refreshMode: sections
lastResearched: 2026-09-27
refreshableSections:
  - "ORM patterns"
  - "Migration tooling"
protectedSections:
  - "Normalization rules"
  - "Indexing strategy"
---

# Database Engineering Skill

Standards for designing, migrating, and optimising data stores in a production software company.

---

## 1. Schema Design Principles

### Normalization
- Target **3NF** (Third Normal Form) by default
- Denormalize only with documented justification and measured performance benefit
- Every table must have a **primary key** — never rely on row order

### Data Types
| Data | Type |
|---|---|
| Monetary values | `DECIMAL(19,4)` / `NUMERIC` — NEVER `FLOAT` |
| Timestamps | `TIMESTAMPTZ` (UTC) — always store in UTC |
| IDs (user-facing entities) | `UUID` (`gen_random_uuid()`) |
| IDs (internal join tables) | `SERIAL` / `BIGSERIAL` |
| Short text | `VARCHAR(n)` with appropriate `n` |
| Long text | `TEXT` |
| Booleans | `BOOLEAN` with explicit default |
| Enums | DB-level enum type or `VARCHAR` with CHECK constraint |

### Naming Conventions
- Tables: `snake_case`, plural (`users`, `order_items`)
- Columns: `snake_case` (`created_at`, `user_id`)
- Foreign keys: `<referenced_table_singular>_id` (`user_id`, `product_id`)
- Indexes: `idx_<table>_<columns>` (`idx_users_email`)
- Constraints: `<table>_<column>_<type>` (`users_email_unique`, `orders_status_check`)

### Required Audit Columns
Every entity table must have:
```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
-- For soft-delete tables:
deleted_at  TIMESTAMPTZ
```

---

## 2. Migration Standards

### Naming
```
YYYYMMDDHHMMSS_<description>.sql
20240915120000_create_users_table.sql
20240915130000_add_email_index_to_users.sql
```

### Every Migration Must Have:
```sql
-- UP (forward migration)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- DOWN (complete rollback)
DROP TABLE IF EXISTS users;
```

### Safe Column Addition on Live Tables (Zero Downtime)
```sql
-- STEP 1: Add nullable first
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- STEP 2: Backfill default value
UPDATE users SET phone = '' WHERE phone IS NULL;

-- STEP 3: Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
```
**Never** add a NOT NULL column in one step on a table with existing data.

### Index Creation on Live Tables (PostgreSQL)
```sql
-- Use CONCURRENTLY to avoid table lock
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

---

## 3. Indexing Strategy

**Always index:**
- Foreign key columns (`user_id`, `order_id`)
- Columns used in `WHERE` clauses on large tables
- Columns used in `ORDER BY` for paginated queries
- Columns used in `JOIN` conditions

**Consider composite indexes for:**
```sql
-- If you frequently query: WHERE status = 'active' ORDER BY created_at DESC
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
```

**Avoid:**
- Indexing low-cardinality columns (boolean, small enum) unless combined with high-cardinality columns
- Over-indexing write-heavy tables (each index slows INSERT/UPDATE/DELETE)

---

## 4. Query Optimization — N+1 Prevention

**The N+1 Problem:**
```typescript
// BAD — N+1: 1 query for orders + N queries for each user
const orders = await Order.findAll();
for (const order of orders) {
  order.user = await User.findById(order.userId); // N queries!
}

// GOOD — Eager loading: 1 query with JOIN
const orders = await Order.findAll({ include: [{ model: User }] });
// or raw:
const orders = await db.query(`
  SELECT o.*, u.name, u.email
  FROM orders o
  JOIN users u ON u.id = o.user_id
`);
```

**Pagination — always use cursor-based for large datasets:**
```sql
-- Offset pagination (OK for small datasets, < 10k rows)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 40;

-- Cursor pagination (for large datasets — stable, performant)
SELECT * FROM posts
WHERE created_at < :cursor
ORDER BY created_at DESC
LIMIT 20;
```

---

## 5. Data Integrity

Enforce business rules at the database level, not just the application level:

```sql
-- CHECK constraints for business invariants
ALTER TABLE products ADD CONSTRAINT products_price_positive CHECK (price > 0);
ALTER TABLE orders ADD CONSTRAINT orders_status_valid
  CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));

-- NOT NULL where the field is required by the domain
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Referential integrity (ON DELETE behavior must be documented)
ALTER TABLE order_items ADD CONSTRAINT order_items_order_fk
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  -- CASCADE: deleting an order deletes its items (correct for this domain)
  -- RESTRICT: prevent deletion if child records exist
  -- SET NULL: set FK to NULL on parent deletion (child becomes orphan)
```

---

## 6. Seed Data Standards

- Development seeds: realistic data with 10–50 records per entity, all states represented
- Test fixtures: minimal, targeted, factory-pattern (generate isolated data per test)
- Always seed a default admin user — document credentials in `database/seeds/README.md`
- Seed scripts must be idempotent (upsert, not blind insert)
- Seed order must respect FK dependencies (parent entities before children)

---

## 7. ORM Best Practices

- Define all relationships explicitly (hasMany, belongsTo, manyToMany)
- Use repository pattern — controllers never call ORM directly
- Always type query results — no untyped `any` returns from repositories
- Use transactions for multi-step operations that must be atomic
- Enable query logging in development to catch N+1 issues early
