---
name: database-engineering
description: Database schema modeling, idempotent migrations, indexing strategies, N+1 query prevention, and connection pooling for PostgreSQL and Prisma/TypeORM.
lastResearched: 2026-10-01
---

# 🗄️ Database Engineering & Schema Integrity

> [!IMPORTANT]
> Database operations must be strictly idempotent, migration-driven, and optimized against N+1 query traps.

---

## 1. Idempotent Migration Standard

* All database migrations must have forward (`UP`) and rollback (`DOWN`) integrity.
* Schema migrations must be versioned timestamped files (e.g. `202610010001_create_users.sql`).
* Never run destructive `DROP TABLE` in production migrations; use column deprecation phases.

---

## 2. Indexing Strategy

* Every foreign key column MUST have a dedicated B-tree index (e.g. `CREATE INDEX idx_orders_user_id ON orders(user_id)`).
* Search queries on strings must use gin/trigram indexes or lowercase functional indexes:
  `CREATE INDEX idx_users_email_lower ON users(LOWER(email));`
* Unique constraints must be enforced at the database engine level, not just in application code.

---

## 3. Preventing the N+1 Query Anti-Pattern

* **In ORMs (Prisma / Drizzle / TypeORM):**  
  Never fetch parent records in a loop. Always use eager loading / includes:
  ```typescript
  // ❌ N+1 Trap:
  const users = await prisma.user.findMany();
  for (const user of users) {
    const posts = await prisma.post.findMany({ where: { userId: user.id } });
  }

  // ✅ Eager Loading (1 Query with Join):
  const usersWithPosts = await prisma.user.findMany({
    include: { posts: true }
  });
  ```
