---
name: backend-development
description: Comprehensive guide for designing, implementing, securing, and testing backend services — covering Express/Node.js patterns, REST API design, CORS, middleware, modular architecture, environment config, error handling, rate limiting, and validation.
---

# Backend Development Skill

Procedures for robust, testable, secure, and maintainable backend engineering in a multi-agent software company.

---

## 1. Project Structure — Modular Architecture

Always organise the backend in feature-based modules, not by type:

```
backend/
├── src/
│   ├── config/           # env config, db connection, cors options
│   ├── middleware/        # authenticate, authorize, rateLimiter, errorHandler
│   ├── modules/
│   │   ├── auth/          # auth.routes.ts, auth.controller.ts, auth.service.ts
│   │   ├── users/         # users.routes.ts, users.controller.ts, users.service.ts
│   │   └── products/      # ...
│   ├── shared/
│   │   ├── errors/        # AppError, ValidationError, NotFoundError ...
│   │   ├── utils/         # asyncHandler, paginate, hashPassword
│   │   └── types/         # shared TypeScript interfaces
│   ├── database/          # ORM config, migrations, seeds
│   └── app.ts             # Express app factory (no listen() here)
├── server.ts              # Only entry point: app.listen()
└── tests/
```

**Rule**: `server.ts` only calls `app.listen()`. `app.ts` creates and configures the Express app and exports it — this makes the app testable without starting a real server.

---

## 2. CORS — Configuration

Never use `cors()` with no config in production. Always configure explicitly:

```typescript
// config/cors.ts
import cors from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,                          // allow cookies / auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,                              // cache preflight for 24h
};
```

- **Development**: allow `localhost:3000`, `localhost:5173`, etc.
- **Production**: only allow the exact production frontend origin.
- **Never** use `origin: '*'` when `credentials: true` — browsers will block it.

---

## 3. Middleware Stack Order

The order of middleware registration in Express matters:

```typescript
// app.ts
app.use(helmet());                   // 1. Security headers first
app.use(cors(corsOptions));          // 2. CORS
app.use(express.json({ limit: '10kb' }));  // 3. Body parser with size limit
app.use(morgan('combined'));         // 4. Request logging
app.use('/api', rateLimiter);        // 5. Rate limiting on API routes
app.use('/api/v1', router);          // 6. Routes
app.use(notFoundHandler);            // 7. 404 catch-all
app.use(globalErrorHandler);         // 8. Error handler LAST
```

---

## 4. Environment Configuration

Use a config module — never access `process.env` directly in business code:

```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  ALLOWED_ORIGINS: z.string(),
});

export const env = envSchema.parse(process.env);
// If any variable is missing or invalid, this throws at startup — fail fast.
```

- Validate ALL env vars at startup with Zod or Joi
- Fail immediately if required vars are missing (never start with a broken config)
- Keep `.env.example` up to date with every new variable

---

## 5. Request Validation

Validate at the route layer using Zod schemas before the request reaches controllers:

```typescript
// middleware/validate.ts
import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.body = result.data;   // replace with parsed/coerced data
    next();
  };

// Route usage:
router.post('/users', validate(createUserSchema), usersController.create);
```

---

## 6. Rate Limiting

Apply rate limiting to all API routes. Use stricter limits on auth routes:

```typescript
import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,                    // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                     // only 10 auth attempts per 15 min
  skipSuccessfulRequests: true,
});
```

---

## 7. Async Error Handling

Wrap all async route handlers with `asyncHandler` to avoid uncaught promise rejections:

```typescript
// utils/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (fn: AsyncFn) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Usage:
router.get('/users', asyncHandler(async (req, res) => {
  const users = await userService.findAll();
  res.json({ data: users });
}));
```

---

## 8. API Contract Adherence

- Strictly follow `api-contract.json` for every route: method, path, request schema, response schema, status codes
- Response envelope: `{ data: T }` for success, `{ error: string, code: string, details?: any[] }` for errors
- HTTP status codes:
  - `200` GET success, `201` POST success (resource created), `204` DELETE success (no body)
  - `400` validation error, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict, `429` rate limited, `500` server error
- Never return `200` with an error in the body

---

## 9. Security Headers

Always use `helmet` for security headers:

```typescript
import helmet from 'helmet';
app.use(helmet());
// Adds: X-XSS-Protection, X-Frame-Options, X-Content-Type-Options,
//       Strict-Transport-Security, Content-Security-Policy, etc.
```

---

## 10. Verification Standards

- Unit tests for every service method (mock repositories)
- Integration tests for every API endpoint (supertest + test DB)
- Cover: happy path, validation rejection (400), auth failure (401/403), not-found (404)
- Minimum coverage: 85% service layer, 70% controllers

---

## Rate Limiting & Caching

1. **Express Rate Limiting** with Redis store:
```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from './redis';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  handler: (req, res) => res.status(429).json({ error: 'Too many requests', retryAfter: res.getHeader('Retry-After') }),
});

// Tiered limiting: authenticated users get higher limits
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, store: ... });
```

2. **Redis Caching Patterns**:
```javascript
// Cache-aside pattern
async function getCachedUser(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);
  const user = await userRepo.findById(userId);
  await redis.setex(`user:${userId}`, 300, JSON.stringify(user)); // 5 min TTL
  return user;
}

// Cache invalidation on update
async function updateUser(userId: string, data: UpdateUserDto) {
  const updated = await userRepo.update(userId, data);
  await redis.del(`user:${userId}`); // Invalidate
  return updated;
}
```

3. **HTTP Caching Headers**:
```javascript
// For public, cacheable resources
res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
// For authenticated user data
res.set('Cache-Control', 'private, no-cache');
// ETags for conditional requests
res.set('ETag', generateETag(data));
```

4. **In-memory caching** (node-cache for simple cases without Redis):
```javascript
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
```

5. **Rate limiting decision guide**: when to use IP-level vs user-level vs API-key-level rate limiting
