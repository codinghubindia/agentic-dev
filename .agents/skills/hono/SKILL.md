---
name: hono
description: Hono v4 — ultra-lightweight web framework for Bun, Node, Cloudflare Workers, and edge runtimes.
category: backend
packages: [hono, @hono/node-server]
workerRoles: [strike-worker-backend]
microTasks: [B2, B3]
currentVersion: 4.6.3
lastResearched: 2026-10-01
refreshIntervalDays: 60
status: stable
---

# ⚡ Hono v4 — Edge-Compatible Web Framework

## 0. Install & Scaffold
```bash
npm view hono deprecated 2>/dev/null | grep -i deprecated
npm create hono@latest my-api -- --template nodejs
# Bun version:
bun create hono my-api
```

---

## 1. App Structure

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders()); // like helmet for Hono

// Route with Zod validation built-in
const CreateUserSchema = z.object({ email: z.string().email(), name: z.string() });

app.post('/users', zValidator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json'); // fully typed
  return c.json({ id: 'new-id', ...data }, 201);
});

// Start (Node.js adapter)
serve({ fetch: app.fetch, port: 3000 });
```

---

## 2. Route Grouping

```typescript
const api = new Hono();
const users = new Hono();
const posts = new Hono();

users.get('/', (c) => c.json({ users: [] }));
users.post('/', zValidator('json', CreateUserSchema), createUser);

posts.get('/', (c) => c.json({ posts: [] }));

api.route('/users', users);
api.route('/posts', posts);
app.route('/api/v1', api);
```

---

## 3. Context Typing

```typescript
// Type the Hono variables for middleware-set values
type Variables = { userId: string; role: string };
const app = new Hono<{ Variables: Variables }>();

app.use('/protected/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  const payload = await verifyToken(token);
  c.set('userId', payload.sub as string);
  await next();
});

app.get('/protected/profile', (c) => {
  const userId = c.get('userId'); // typed as string
  return c.json({ userId });
});
```

---

## 4. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| Manual JSON parsing with `await req.json()` | Use `zValidator` middleware |
| `app.listen()` directly | Use `serve()` from `@hono/node-server` |
| Importing Hono from wrong package | `import { Hono } from 'hono'` (not hono/hono) |
