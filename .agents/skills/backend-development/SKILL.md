---
name: backend-development
description: Comprehensive guide for designing, implementing, securing, and testing backend services — covering Express 5, Fastify, modular architecture, RFC 9457 error handling, Zod/TypeBox validation, Redis rate limiting, and graceful shutdown.
refreshMode: full
lastResearched: 2026-09-28
sources:
  - https://fastify.dev/docs/latest/Reference/TypeScript/
  - https://fastify.dev/docs/latest/Guides/Plugins-Guide/
  - https://expressjs.com/en/guide/migrating-5.html
  - https://expressjs.com/en/guide/error-handling.html
  - https://www.rfc-editor.org/rfc/rfc9457.html
  - https://nodejs.org/docs/latest/api/process.html
  - https://github.com/express-rate-limit/express-rate-limit
  - https://getpino.io/
---

# Backend Development

## Overview
This skill provides production-grade architectural guidelines and actionable implementations for Node.js backend services using modern Express (v5+) and Fastify (v4/v5). It covers feature-based modular design, type-safe schema validation, centralized RFC 9457 error contracts, distributed Redis rate limiting, contextual Pino logging via `AsyncLocalStorage`, and zero-downtime graceful shutdown patterns.

---

## Key Patterns

### Pattern 1: Modular Application Architecture & Testable Server Factory
Separate application setup from network listener invocation. Maintain a feature-based structure rather than grouping files by type.

```
backend/
├── src/
│   ├── config/            # Validated environment config, database & cache clients
│   ├── middleware/        # Global middlewares (correlation, rate limit, error handler)
│   ├── modules/           # Domain feature modules
│   │   └── users/
│   │       ├── users.routes.ts
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       ├── users.repository.ts
│   │       └── users.schema.ts
│   ├── shared/            # Shared errors, utilities, types
│   ├── app.ts             # Express/Fastify factory (no .listen())
│   └── server.ts          # Process entrypoint (.listen() + graceful shutdown)
└── tests/
```

#### Express 5 Application Factory (`src/app.ts`):
```typescript
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errors.js';
import { usersRouter } from './modules/users/users.routes.js';

export function createApp(): Express {
  const app = express();

  // 1. Security & Context
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(correlationMiddleware);

  // 2. Parsing with strict limits
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: true, limit: '50kb' }));

  // 3. Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // 4. Feature Routes
  app.use('/api/v1/users', usersRouter);

  // 5. Fallthrough & Global Error Handler (MUST BE LAST)
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
```

---

### Pattern 2: Type-Safe Validation & RFC 9457 Error Response
Enforce strict request validation at the boundary. Use RFC 9457 Problem Details (`application/problem+json`) for standardized, machine-readable API error messages.

#### Domain Error Hierarchy & RFC 9457 Envelope (`src/shared/errors.ts`):
```typescript
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
  [key: string]: unknown;
}

export class AppError extends Error {
  constructor(
    public readonly title: string,
    public readonly statusCode: number,
    public readonly detail: string,
    public readonly type: string = 'about:blank',
    public readonly isOperational: boolean = true,
  ) {
    super(detail);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super('Resource Not Found', 404, `${resource} with id '${id}' was not found.`, 'https://api.example.com/errors/not-found');
  }
}
```

#### Express Validation Middleware with Zod (`src/middleware/validate.ts`):
```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateRequest = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) req.body = await schema.body.parseAsync(req.body);
      if (schema.query) req.query = await schema.query.parseAsync(req.query);
      if (schema.params) req.params = await schema.params.parseAsync(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.setHeader('Content-Type', 'application/problem+json');
        res.status(400).json({
          type: 'https://api.example.com/errors/validation-error',
          title: 'Invalid Request Parameters',
          status: 400,
          detail: 'One or more request parameters failed validation.',
          instance: req.originalUrl,
          invalidParams: err.issues.map((i) => ({
            name: i.path.join('.'),
            reason: i.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
};
```

#### Fastify Type Provider with TypeBox (`src/modules/users/users.fastify.ts`):
```typescript
import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const CreateUserSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  name: Type.String({ minLength: 2 }),
});

const UserResponseSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  createdAt: Type.String(),
});

export const fastifyUsersPlugin: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  server.post(
    '/',
    {
      schema: {
        body: CreateUserSchema,
        response: {
          201: UserResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // request.body is statically typed: { email: string; name: string }
      const newUser = {
        id: 'usr_123',
        email: request.body.email,
        name: request.body.name,
        createdAt: new Date().toISOString(),
      };
      return reply.code(201).send(newUser);
    }
  );
};
```

---

### Pattern 3: Async Error Handling in Express 5 vs Express 4
Express 5 natively handles rejected promises from async route handlers and forwards them directly to error-handling middleware. Express 4 requires `asyncHandler` wrappers.

#### Express 5 Centralized Error Handler (`src/middleware/errors.ts`):
```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'application/problem+json');
  res.status(404).json({
    type: 'https://api.example.com/errors/not-found',
    title: 'Route Not Found',
    status: 404,
    detail: `Cannot ${req.method} ${req.originalUrl}`,
    instance: req.originalUrl,
  });
}

// In Express, error middleware MUST have exactly 4 arguments (err, req, res, next)
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.headers['x-correlation-id'] as string;

  if (err instanceof AppError && err.isOperational) {
    res.setHeader('Content-Type', 'application/problem+json');
    res.status(err.statusCode).json({
      type: err.type,
      title: err.title,
      status: err.statusCode,
      detail: err.detail,
      instance: req.originalUrl,
    });
    return;
  }

  // Non-operational / unexpected bugs: log full trace, mask internal details in response
  logger.error({ err, correlationId, url: req.originalUrl }, 'Unhandled application error');

  res.setHeader('Content-Type', 'application/problem+json');
  res.status(500).json({
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected internal error occurred.',
    instance: req.originalUrl,
  });
}
```

---

### Pattern 4: Distributed Rate Limiting & Strict CORS Configuration
Protect backend resources from abuse using Redis-backed rate limiting with graceful fail-open resilience, combined with explicit CORS policies.

#### Strict Dynamic CORS (`src/config/cors.ts`):
```typescript
import { CorsOptions } from 'cors';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser agents (curl, server-to-server) without origin header
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin '${origin}' not permitted by CORS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'If-None-Match'],
  maxAge: 86400, // 24 hours preflight cache
};
```

#### Redis-Backed Rate Limiting with Fail-Open (`src/middleware/rateLimiter.ts`):
```typescript
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis.js';
import { logger } from '../shared/logger.js';

export const createApiRateLimiter = (options: { windowMs: number; max: number }) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: 'draft-7', // RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
    legacyHeaders: false,
    store: new RedisStore({
      // Send raw commands to node-redis v4+
      sendCommand: async (...args: string[]) => {
        try {
          return await redisClient.sendCommand(args);
        } catch (err) {
          logger.warn({ err }, 'Redis rate-limiter unavailable; failing open');
          // Fail open fallback: return null/neutral value to avoid blocking users
          return null;
        }
      },
    }),
    keyGenerator: (req) => {
      // Use authenticated user identifier when available; fallback to IP
      return (req as any).user?.id || req.ip || 'anonymous';
    },
    handler: (req, res) => {
      res.setHeader('Content-Type', 'application/problem+json');
      res.status(429).json({
        type: 'https://api.example.com/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Rate limit quota exceeded. Please wait before retrying.',
        instance: req.originalUrl,
      });
    },
  });
};

// Global API limiter: 100 requests per 15 minutes
export const standardApiLimiter = createApiRateLimiter({ windowMs: 15 * 60 * 1000, max: 100 });
// Sensitive Auth limiter: 5 attempts per 15 minutes
export const authEndpointLimiter = createApiRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
```

---

### Pattern 5: Contextual Structured Logging with `AsyncLocalStorage` & Pino
Track correlation IDs across asynchronous database calls, external requests, and business logic without passing logger instances through every function signature.

```typescript
// src/shared/context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  correlationId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// src/shared/logger.ts
import pino from 'pino';
import { requestContext } from './context.js';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const logger = new Proxy(baseLogger, {
  get(target, prop, receiver) {
    const store = requestContext.getStore();
    if (store && typeof target[prop as keyof typeof target] === 'function') {
      const child = target.child({ correlationId: store.correlationId, userId: store.userId });
      return child[prop as keyof typeof child].bind(child);
    }
    return Reflect.get(target, prop, receiver);
  },
});

// src/middleware/correlation.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext } from '../shared/context.js';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  res.setHeader('X-Correlation-ID', correlationId);

  requestContext.run({ correlationId }, () => {
    next();
  });
}
```

---

### Pattern 6: Zero-Downtime Graceful Shutdown & Resource Cleanup
When deploying containers or updating instances, services must handle termination signals (`SIGTERM`, `SIGINT`), stop accepting incoming HTTP requests, drain in-flight transactions, and gracefully close database connections.

```typescript
// src/server.ts
import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';
import { disconnectDb } from './config/database.js';
import { redisClient } from './config/redis.js';

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started successfully');
});

let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Termination signal received. Starting graceful shutdown.');

  // 1. Forceful shutdown timeout if cleanup hangs
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded (10s). Forcing process exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  // 2. Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
      process.exit(1);
    }
    logger.info('HTTP server closed. In-flight requests drained.');

    try {
      // 3. Close database and Redis pools
      await redisClient.quit();
      await disconnectDb();
      logger.info('Resource connections closed cleanly.');
      process.exit(0);
    } catch (cleanupError) {
      logger.error({ err: cleanupError }, 'Error during resource teardown');
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
```

---

### Pattern 7: Cache-Aside & HTTP Conditional Caching
Maximize backend throughput by layering distributed Redis cache-aside storage with HTTP conditional requests (`ETag` and `304 Not Modified`).

```typescript
// src/modules/products/products.service.ts
import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { redisClient } from '../../config/redis.js';
import { productRepository } from './products.repository.js';

export async function getProductById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const cacheKey = `product:${id}`;

  // 1. Try Cache
  let product = await redisClient.get(cacheKey).then((data) => (data ? JSON.parse(data) : null));

  // 2. On Cache Miss: Load from DB and store with 5m TTL
  if (!product) {
    product = await productRepository.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    await redisClient.set(cacheKey, JSON.stringify(product), { EX: 300 });
  }

  // 3. HTTP Conditional ETag check
  const entityBody = JSON.stringify(product);
  const etag = `"${crypto.createHash('md5').update(entityBody).digest('hex')}"`;

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.setHeader('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.status(200).json(product);
}

// Invalidate cache immediately on resource update
export async function updateProduct(id: string, data: any): Promise<void> {
  await productRepository.update(id, data);
  await redisClient.del(`product:${id}`);
}
```

---

## Common Pitfalls

- **Using In-Memory Rate Limiting in Production Containers**
  *Problem:* Default in-memory stores isolate counters per process. In multi-pod or load-balanced environments, attackers bypass limits across replicas.
  *Fix:* Use `RedisStore` (`rate-limit-redis`) with centralized Redis or Redis Cluster, configured with `failOpen` error handling.

- **Direct Property Mutation on Fastify Request/Reply**
  *Problem:* Assigning properties directly like `(request as any).user = user` de-optimizes V8 hidden classes and causes silent type inconsistencies.
  *Fix:* Declare decorators using `fastify.decorateRequest('user', null)` upfront during plugin registration and augment Fastify's TypeScript interfaces.

- **Missing Error Middleware 4-Parameter Arity in Express**
  *Problem:* Defining `(err, req, res)` without `next` causes Express to treat it as regular route middleware, causing hanging responses on errors.
  *Fix:* Always keep 4 parameters in error middleware signature: `(err: Error, req: Request, res: Response, next: NextFunction)`.

- **Permissive CORS with Credentials**
  *Problem:* Configuring `{ origin: '*', credentials: true }` violates the CORS specification; modern browsers will block the response.
  *Fix:* Use a dynamic origin callback function that compares incoming `req.headers.origin` against an explicit whitelist array.

- **Unchecked Dynamic `process.env` Calls**
  *Problem:* Reading `process.env.MY_VAR` scattered across modules causes hard-to-debug runtime crashes when environment variables are omitted.
  *Fix:* Parse and validate all required variables in a dedicated `config/env.ts` using `zod` at boot time. Throw immediately if validation fails.

- **Abrupt `process.exit(0)` on Shutdown Signals**
  *Problem:* Killing the process immediately terminates active database transactions and drops in-flight client connections mid-request.
  *Fix:* Intercept `SIGTERM`/`SIGINT`, stop server listener with `server.close()`, allow active requests to finish, await connection pool teardown, and enforce a 10s fallback kill timer.

---

## Quick Reference

| Requirement | Modern Standard | Recommended Tool / Implementation |
|---|---|---|
| Framework Engine | Express 5+ or Fastify v5 | `express` (broad ecosystem) or `fastify` (high throughput) |
| Request Validation | Schema-first with static TypeScript inference | Zod (`zod`) for Express; TypeBox (`@sinclair/typebox`) for Fastify |
| Error Representation | Standard Problem Details format | RFC 9457 (`application/problem+json`) with custom `AppError` |
| Security Headers | Baseline HTTP hardening headers | `helmet` or `@fastify/helmet` |
| Rate Limiting | Distributed sliding window with key generation | `express-rate-limit` + `rate-limit-redis` / `@fastify/rate-limit` |
| Logging & Context | Structured JSON logs + async trace propagation | `pino` with Node.js `node:async_hooks` (`AsyncLocalStorage`) |
| Process Lifecycle | Zero-downtime graceful drain and cleanup | `SIGTERM`/`SIGINT` interceptors + `server.close()` + pool `.end()` |
| Cache Strategy | Cache-aside with atomic invalidation + HTTP 304 | `redis` / `ioredis` + MD5/SHA256 `ETag` + `Cache-Control` |
| Contract Testing | HTTP boundary and contract validation | `supertest` + `vitest` / `jest` against unlistened `app` factory |

---

## Resources
- [Fastify TypeScript Guide](https://fastify.dev/docs/latest/Reference/TypeScript/) — Official documentation on Type Providers, type inference, and decoration patterns.
- [Express Migrating to 5.x](https://expressjs.com/en/guide/migrating-5.html) — Details on native async error handling and routing upgrades.
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF standard for machine-readable HTTP API error communication.
- [Node.js Process Lifecycle](https://nodejs.org/docs/latest/api/process.html) — Signal events (`SIGTERM`, `SIGINT`) and unhandled rejection handling.
- [Express Rate Limit & Redis Store](https://github.com/express-rate-limit/express-rate-limit) — Modern distributed rate limiting specifications.
- [Pino Structured Logging](https://getpino.io/) — Low-overhead JSON logging framework and best practices for Node.js.
