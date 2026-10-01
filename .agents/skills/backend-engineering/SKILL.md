---
name: backend-engineering
description: Production backend service architecture, Express/FastAPI modular patterns, Zod schema validation, JWT auth, RFC 9457 error standards, rate limiting, and Golden Arsenal package guide with deprecation-safe install commands.
lastResearched: 2026-10-01
---

# 🚀 Backend Engineering & API Standards

> [!IMPORTANT]
> All backend routes, controllers, and services must strictly conform to type-safe schema validation, standardized HTTP semantics, and stateless horizontal scalability.

---

## 0. Golden Arsenal — Package Install Protocol

> [!CAUTION]
> **MANDATORY PRE-INSTALL DEPRECATION CHECK**: Before every `npm install`, run:
> ```
> npm view <package-name> deprecated
> ```
> If output is non-empty, the package is deprecated — DO NOT install. Find the current successor.

### Approved Backend Packages (Current, Non-Deprecated)

| Package | Purpose | Install Command |
|---|---|---|
| `express` | HTTP server | `npm install express` + `npm install -D @types/express` |
| `fastify` | High-perf HTTP server (alternative to Express) | `npm install fastify` |
| `zod` | Schema validation + TypeScript inference | `npm install zod` |
| `jose` | JWT signing/verification (RFC-compliant, actively maintained) | `npm install jose` |
| `@prisma/client` + `prisma` | Type-safe ORM + migrations | `npm install @prisma/client` + `npm install -D prisma` |
| `drizzle-orm` + `drizzle-kit` | Lightweight SQL ORM (Prisma alternative) | `npm install drizzle-orm` + `npm install -D drizzle-kit` |
| `@hono/node-server` + `hono` | Ultra-lightweight framework (Edge/Bun-compatible) | `npm install hono @hono/node-server` |
| `ioredis` | Redis client (actively maintained) | `npm install ioredis` |
| `helmet` | Security headers middleware | `npm install helmet` |
| `@upstash/ratelimit` | Edge-compatible rate limiting | `npm install @upstash/ratelimit @upstash/redis` |

> [!WARNING]
> NEVER install: `jsonwebtoken` (use `jose` instead — `jsonwebtoken` has known CVEs), `express-jwt` (unmaintained), `passport` without careful version pinning, `mongoose` without checking current deprecation notices, `body-parser` (built into Express 4.16+). Always run `npm view <pkg> deprecated` first.

### CLI Scaffold Commands (Use These, NEVER manually create config files)
```bash
# Initialize Prisma (creates schema.prisma and .env)
npx prisma init

# Initialize Drizzle config
npx drizzle-kit init

# Generate Prisma client after schema changes
npx prisma generate

# Run Prisma migration in development
npx prisma migrate dev --name <migration-name>
```

---

## 1. RESTful Semantics & Status Codes

* **GET /resources:** 200 OK. Returns collection or filtered query.
* **POST /resources:** 201 Created with `Location` header or created object.
* **PUT /resources/:id:** 200 OK. Complete replacement.
* **PATCH /resources/:id:** 200 OK. Partial update.
* **DELETE /resources/:id:** 204 No Content.

---

## 2. Mandatory Input Validation (Zod)

Every incoming request body, query parameter, and route parameter MUST be validated:

```typescript
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  role: z.enum(['user', 'admin']).default('user')
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In route handler:
app.post('/users', async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json(formatZodError(result.error));
  }
  const user = await userService.create(result.data);
  res.status(201).json(user);
});
```

---

## 3. Standardized RFC 9457 Error Response Format

Never return unformatted string errors. All errors must follow RFC 9457:

```json
{
  "type": "https://api.example.com/errors/invalid-credentials",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "The email or password provided does not match our records.",
  "instance": "/api/v1/auth/login",
  "invalidParams": [
    { "name": "password", "reason": "Password must be at least 8 characters" }
  ]
}
```

---

## 4. JWT Authentication — Use `jose` (NOT `jsonwebtoken`)

```typescript
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ALGORITHM = 'HS256';

export async function signToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
}
```

> [!CAUTION]
> Use `httpOnly; Secure; SameSite=Strict` cookies for refresh tokens. NEVER store refresh tokens in localStorage.

---

## 5. Rate Limiting

```typescript
// Using native in-memory store (no extra packages)
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (record.count >= maxAttempts) return false; // blocked
  record.count++;
  return true;
}

// Usage on login route:
app.post('/auth/login', (req, res) => {
  const ip = req.ip ?? 'unknown';
  if (!rateLimit(ip, 5, 60_000)) {
    return res.status(429).json({ title: 'Too Many Requests', status: 429 });
  }
  // ... rest of handler
});
```

---

## 6. Modular Express Architecture Pattern

```
src/
  routes/
    auth.routes.ts      # Express Router — auth endpoints
    users.routes.ts     # Express Router — user CRUD
  controllers/
    auth.controller.ts  # Request parsing, response formatting
    users.controller.ts
  services/
    auth.service.ts     # Business logic, NO HTTP concerns
    users.service.ts
  middleware/
    validate.ts         # Zod validation middleware factory
    auth.ts             # JWT verification middleware
    error.ts            # Global error handler (RFC 9457)
  schemas/
    user.schema.ts      # Zod schemas + TypeScript types
  app.ts                # Express app factory (no listen)
  server.ts             # Entry point (calls app.listen)
```

---

## 7. Security Checklist

- [ ] All inputs validated with Zod before service layer
- [ ] JWT with `jose` (NOT `jsonwebtoken`)
- [ ] `helmet()` middleware applied globally
- [ ] Rate limiting on auth routes (≤5 req/min)
- [ ] Refresh tokens in `httpOnly; Secure; SameSite=Strict` cookies
- [ ] No secrets in source code — all via `process.env`
- [ ] SQL queries via ORM parameterization (never string interpolation)
- [ ] CORS configured to allowlist (not wildcard `*` in production)
