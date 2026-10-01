---
name: express
description: Express v4 with TypeScript ESM — modular router patterns, middleware factory, error handling, and security setup.
category: backend
packages: [express]
workerRoles: [strike-worker-backend]
microTasks: [B2, B3]
currentVersion: 4.21.1
lastResearched: 2026-10-01
refreshIntervalDays: 90
status: stable
---

> [!NOTE]
> Express v5 is in beta. This skill covers stable v4. Check npm for v5 stable release.

> [!WARNING]
> **DO NOT use `npx express-generator`** — generates CommonJS. Use the ESM scaffold below.

# 🚂 Express v4 — ESM TypeScript Production Setup

## 0. ESM Scaffold (DO NOT use express-generator)
```bash
npm view express deprecated 2>/dev/null | grep -i deprecated
mkdir my-api && cd my-api
npm init -y
npm install express
npm install -D typescript @types/node @types/express tsx
npx tsc --init
# Then in tsconfig.json set:
# "module": "NodeNext", "moduleResolution": "NodeNext", "target": "ES2022"
# In package.json set: "type": "module"
# Add scripts: "dev": "tsx src/server.ts", "build": "tsc"
```

---

## 1. App Factory Pattern

```typescript
// src/app.ts — factory function, not singleton
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';

export function createApp() {
  const app = express();
  app.use(helmet()); // security headers
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use(errorHandler); // MUST be last
  return app;
}

// src/server.ts — entry point
const app = createApp();
app.listen(process.env.PORT ?? 3000);
```

---

## 2. Modular Router Pattern

```typescript
// src/routes/users.routes.ts
import { Router } from 'express';
import { getUsers, createUser, getUserById } from '../controllers/users.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { CreateUserSchema } from '../schemas/user.schema.js';

export const usersRouter = Router();

usersRouter
  .get('/', requireAuth, getUsers)
  .post('/', validate(CreateUserSchema), createUser)
  .get('/:id', requireAuth, getUserById);
```

---

## 3. Global Error Handler (RFC 9457)

```typescript
// src/middleware/error.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public type = 'https://api.example.com/errors/generic'
  ) { super(detail); }
}

// 4 params = error-handling middleware — Express detects automatically
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      type: err.type, title: err.title, status: err.status,
      detail: err.detail, instance: req.path,
    });
  }
  console.error('[Unhandled]', err);
  res.status(500).json({ type: 'about:blank', title: 'Internal Server Error', status: 500 });
}
```

---

## 4. Async Handler Wrapper

```typescript
// Express v4 doesn't catch async errors automatically (v5 does)
// Wrap all async route handlers
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler = (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// Usage:
usersRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) throw new AppError(404, 'Not Found', `User ${req.params.id} not found`);
  res.json(user);
}));
```

---

## 5. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| `app.use(bodyParser.json())` | Built into Express 4.16+: `express.json()` |
| Async route without `.catch(next)` | Wrap with `asyncHandler()` |
| Error handler with 3 params | Must have exactly 4 params: `(err, req, res, next)` |
| `require()` in ESM project | ESM uses `import` — set `"type": "module"` in package.json |
| `app.listen()` in app.ts | Keep in server.ts — app.ts exports factory for testing |
