---
name: prisma
description: Prisma v5 ORM — schema modeling, migrations, query patterns, connection pooling, and transactions.
category: backend
packages: [@prisma/client, prisma]
workerRoles: [strike-worker-backend]
microTasks: [B1, B2]
currentVersion: 5.20.0
lastResearched: 2026-10-01
refreshIntervalDays: 60
status: stable
---

> [!NOTE]
> Prisma v5 removed several deprecated APIs from v4 (findUnique is renamed, raw query API changed). This skill covers v5 API only.

# 🗃️ Prisma v5 — Type-Safe ORM

## 0. Install & Scaffold (3-step sequence — do not skip step 2)
```bash
npm view @prisma/client deprecated 2>/dev/null | grep -i deprecated
npm install @prisma/client
npm install -D prisma
npx prisma init
# ⚠️ STEP 2 (MANDATORY before any other prisma commands):
# Set DATABASE_URL in .env — the placeholder must be replaced with a real URL:
# DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
npx prisma generate   # generates the type-safe client
npx prisma migrate dev --name init  # creates first migration
```

---

## 1. Schema Modeling

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])          // query optimization
  @@index([role, createdAt]) // composite index for filtered queries
}

model Post {
  id        String  @id @default(cuid())
  title     String
  content   String?
  published Boolean @default(false)
  authorId  String
  author    User    @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@index([published, createdAt])
}

enum Role { USER ADMIN MODERATOR }
```

---

## 2. Connection Pooling Singleton

```typescript
// src/lib/prisma.ts — ALWAYS use a singleton, never new PrismaClient() per request
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma; // prevent hot-reload from creating new instances
}
```

---

## 3. Query Patterns

```typescript
import { prisma } from '../lib/prisma.js';

// ✅ Use select to avoid over-fetching
const users = await prisma.user.findMany({
  where: { role: 'USER', createdAt: { gte: new Date('2024-01-01') } },
  select: { id: true, email: true, name: true }, // NEVER select * in production
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: (page - 1) * 20,
});

// ✅ N+1 prevention — use include for related data
const postsWithAuthors = await prisma.post.findMany({
  where: { published: true },
  include: { author: { select: { id: true, name: true } } }, // single query, joined
  take: 10,
});

// ✅ Upsert for create-or-update
const user = await prisma.user.upsert({
  where: { email: input.email },
  update: { name: input.name },
  create: { email: input.email, name: input.name },
});
```

---

## 4. Transactions

```typescript
// Interactive transaction — use for complex multi-step operations
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email, name } });
  const profile = await tx.profile.create({ data: { userId: user.id } });
  // Both operations succeed or both roll back
  return { user, profile };
});

// Batch transaction (simpler, for independent operations)
const [users, posts] = await prisma.$transaction([
  prisma.user.findMany(),
  prisma.post.findMany({ where: { published: true } }),
]);
```

---

## 5. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| `new PrismaClient()` in each request | Use singleton from `lib/prisma.ts` |
| `findMany()` without `select` | Always specify `select` fields |
| Loop of `findById` calls | Use `findMany({ where: { id: { in: ids } } })` |
| `prisma migrate dev` before DATABASE_URL set | Set real DATABASE_URL first |
| `prisma generate` after schema change in prod | Run in build step, not at runtime |
