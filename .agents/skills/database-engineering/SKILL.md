---
name: database-engineering
description: Database schema modeling, idempotent migrations, indexing strategies, N+1 query prevention, and connection pooling for PostgreSQL and Prisma/TypeORM — with Golden Arsenal package guide and deprecation-safe install commands.
lastResearched: 2026-10-01
---

> [!NOTE]
> **Skill Freshness**: `lastResearched` is set at authoring time. The skill synthesizer flags this
> skill as stale after 90 days and triggers a refresh. Do not manually bump `lastResearched` —
> the `skill_synthesizer --promote` command updates it automatically after a successful compile cycle.

# 🗄️ Database Engineering & Schema Standards

> [!IMPORTANT]
> All database schemas, migrations, and query patterns must prioritize correctness, performance, and type safety. Never write raw SQL strings — use typed ORMs.

---

## 0. Golden Arsenal — Package Install Protocol

> [!CAUTION]
> **MANDATORY PRE-INSTALL DEPRECATION CHECK**: Before every `npm install`, run:
> ```
> npm view <package-name> deprecated
> ```
> If output is non-empty → package is DEPRECATED. DO NOT install.

### Approved Database Packages (Current, Non-Deprecated)

| Package | Purpose | Install Command |
|---|---|---|
| `@prisma/client` | Prisma query client | `npm install @prisma/client` |
| `prisma` | Prisma CLI (dev dependency) | `npm install -D prisma` |
| `drizzle-orm` | Lightweight SQL ORM | `npm install drizzle-orm` |
| `drizzle-kit` | Drizzle migrations CLI | `npm install -D drizzle-kit` |
| `postgres` | Native PostgreSQL driver (for Drizzle) | `npm install postgres` |
| `pg` | Node PostgreSQL client | `npm install pg` + `npm install -D @types/pg` |
| `ioredis` | Redis client | `npm install ioredis` |

> [!WARNING]
> NEVER install: `typeorm` without careful version pinning (frequent breaking changes), `sequelize` (verbose, legacy API), `knex` without checking current deprecation status. Prefer Prisma or Drizzle for new projects.

### CLI Scaffold Commands
```bash
# Initialize Prisma (creates prisma/schema.prisma and .env)
npx prisma init

# After editing schema, generate the client
npx prisma generate

# Create and run a migration
npx prisma migrate dev --name <migration-name>

# Reset database in development
npx prisma migrate reset

# Initialize Drizzle
npx drizzle-kit init

# Push Drizzle schema to database
npx drizzle-kit push:pg
```

---

## 1. Schema Design Principles

### Idempotent Migrations
All migrations must be safe to re-run:
```sql
-- ✅ Idempotent
CREATE TABLE IF NOT EXISTS users (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- ❌ Will error on re-run
CREATE TABLE users (...);
ALTER TABLE users ADD COLUMN email_verified BOOLEAN;
```

### Prisma Schema Best Practices
```prisma
// ✅ Correct Prisma schema patterns
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relation to posts
  posts     Post[]

  @@index([email])  // Index on frequently queried fields
  @@map("users")    // Explicit table name
}

model Post {
  id       String @id @default(cuid())
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])  // Always index foreign keys
}
```

---

## 2. N+1 Query Prevention

```typescript
// ❌ N+1: 1 query for posts + N queries for authors
const posts = await prisma.post.findMany();
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
}

// ✅ Single JOIN query via include
const posts = await prisma.post.findMany({
  include: { author: { select: { id: true, email: true, name: true } } }
});

// ✅ Select only needed fields (reduces payload)
const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true }  // Never select *
});
```

---

## 3. Indexing Strategy

```prisma
model Order {
  id         String   @id @default(cuid())
  userId     String
  status     String
  createdAt  DateTime @default(now())

  // Index foreign keys
  @@index([userId])
  // Composite index for common query pattern: orders by user + status
  @@index([userId, status])
  // Partial index for active orders only (if your DB supports it)
  @@index([createdAt])  // For date-range queries
}
```

Indexing rules:
- Always index foreign keys
- Index fields used in `WHERE`, `ORDER BY`, or `JOIN` conditions
- Composite index: put the most selective field first
- Monitor with `EXPLAIN ANALYZE` for slow queries

---

## 4. Connection Pooling

```typescript
// Prisma — use a global singleton to prevent connection pool exhaustion
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
}
```

> [!CAUTION]
> Never instantiate `new PrismaClient()` in every request handler — connection pool exhaustion will crash under load. Always use the global singleton pattern above.

---

## 5. Transaction Pattern

```typescript
// For operations that must all succeed or all fail:
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email, name } });
  const profile = await tx.profile.create({ data: { userId: user.id } });
  await tx.auditLog.create({ data: { action: 'USER_CREATED', userId: user.id } });
  return { user, profile };
});
```

---

## 6. Security Rules

- Never use raw SQL string interpolation: use `prisma.$queryRaw` with tagged template literals only
- All sensitive fields (`password`, `token`) MUST be excluded from default `select`
- Use `@map` and `@@map` for consistent naming
- Rotate database credentials via environment variables — never hardcode
