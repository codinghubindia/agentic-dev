---
name: observability
description: Production observability guide covering the three pillars (logs, metrics, traces), Sentry error tracking for frontend and backend, Pino structured JSON logging with PII redaction, /health and /readiness endpoint design, Prometheus metrics with prom-client, request ID tracing middleware, alerting rules (critical vs warning), on-call runbook writing, and the observability-report.json sign-off format required before release.
refreshMode: sections
lastResearched: 2026-09-28
refreshableSections:
  - "Tool integrations"
protectedSections:
  - "Three pillars"
  - "Alert rules"
---

# Observability Skill

Standards for making production systems fully observable — every error captured, every log structured, health endpoints live, and alerts actionable.

---

## 1. The Three Pillars

```
LOGS    → What happened? (structured JSON, searchable, timestamped)
METRICS → How often? How fast? (request rate, latency, error rate, resource usage)
TRACES  → Where did it go? (request path across services, which step was slow)
ERROR TRACKING → What broke? (exception with stack trace, context, user impact)
```

**Observability stack choices:**

| Need | Tool Options |
|---|---|
| Error tracking | Sentry (recommended), Bugsnag, Rollbar |
| Structured logs | Pino (Node.js), Winston, structlog (Python) |
| Log aggregation | Datadog, Grafana Loki, AWS CloudWatch, Elastic |
| Metrics | Prometheus + Grafana, Datadog APM, New Relic |
| Distributed tracing | OpenTelemetry → Jaeger/Zipkin/Datadog |
| Uptime monitoring | Better Uptime, UptimeRobot, Pingdom |
| On-call alerting | PagerDuty, OpsGenie, Slack webhooks |

---

## 2. Sentry Error Tracking

### Backend (Node.js/Express)

**Critical:** Sentry must be the FIRST import in your entry file.

```typescript
// backend/src/instrument.ts — import this BEFORE everything else
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,               // from environment variable, never hardcoded
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.APP_VERSION ?? 'unknown',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,  // 10% in prod
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
  // Filter noise — don't fill Sentry with non-actionable errors
  ignoreErrors: [
    'ECONNRESET',
    'EPIPE',
    'AbortError',
    'Request aborted',
  ],
  beforeSend(event) {
    // Strip credentials from request data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }
    // Strip PII from request body
    if (event.request?.data) {
      const body = event.request.data as Record<string, unknown>;
      delete body.password;
      delete body.token;
      delete body.creditCard;
    }
    return event;
  },
});
```

```typescript
// backend/src/app.ts
import './instrument';  // ← MUST be first import
import express from 'express';
import * as Sentry from '@sentry/node';

const app = express();

app.use(Sentry.expressRequestHandler());   // ← FIRST middleware

// ... all your middleware and routes ...

app.use(Sentry.expressErrorHandler());     // ← LAST middleware, before your error handler

// Your global error handler comes after
app.use(globalErrorHandler);
```

### Frontend (React)

```typescript
// src/instrument.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,     // privacy: never record raw text
      blockAllMedia: true,   // privacy: never record images/video
    }),
  ],
  tracesSampleRate: 0.05,              // 5% of requests traced
  replaysSessionSampleRate: 0.01,      // 1% of sessions recorded
  replaysOnErrorSampleRate: 1.0,       // 100% of error sessions recorded
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
});
```

### Sentry Error Boundary (React)
```tsx
// src/components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; errorId?: string }
> {
  state = { hasError: false, errorId: undefined };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const errorId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ errorId });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return this.props.fallback ?? (
      <div role="alert" style={{ padding: 32, textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p>Our team has been notified. Please try refreshing.</p>
        {this.state.errorId && (
          <p style={{ fontSize: 12, color: '#999' }}>Ref: {this.state.errorId}</p>
        )}
        <button onClick={() => window.location.reload()}>Refresh</button>
      </div>
    );
  }
}
```

---

## 3. Structured JSON Logging (Pino)

```bash
npm install pino pino-http
npm install --save-dev pino-pretty  # dev only
```

```typescript
// backend/src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Pretty in dev, JSON in prod
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
  // Always-present fields on every log line
  base: {
    service: process.env.SERVICE_NAME ?? 'api',
    version: process.env.APP_VERSION ?? 'dev',
    env: process.env.NODE_ENV,
  },
  // Automatically redact sensitive fields — never log these
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      '*.password',
      '*.token',
      '*.secret',
      '*.creditCard',
      '*.ssn',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child loggers for context (request-scoped, service-scoped)
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
```

### HTTP Request Logging Middleware
```typescript
import pinoHttp from 'pino-http';

app.use(pinoHttp({
  logger,
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // Don't pollute logs with health check noise
    if (req.url === '/health' || req.url === '/readiness') return 'trace';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode} (${res.responseTime}ms)`,
}));
```

### Log Level Guide
```typescript
// ERROR: something broke, needs immediate attention
logger.error({ err, userId, requestId }, 'Database connection failed');

// WARN: something unusual but recoverable — monitor
logger.warn({ userId, retryCount: 3 }, 'API retry limit approaching');

// INFO: key business events — what the system did
logger.info({ userId, action: 'login', method: 'google' }, 'User logged in');
logger.info({ orderId, amount }, 'Payment processed');

// DEBUG: detailed context for debugging — disabled in prod
logger.debug({ query, params, durationMs: 45 }, 'DB query executed');

// TRACE: very verbose — only for deep tracing
logger.trace({ headers }, 'Incoming request headers');

// ❌ NEVER log PII
logger.info({ email: user.email });     // ❌
logger.info({ password: body.password }); // ❌
logger.info({ token: apiToken });       // ❌
```

---

## 4. Health & Readiness Endpoints

Two separate endpoints with different purposes:

```
/health    → Liveness probe: "Is the process alive and responsive?"
             Answer: YES/NO based on process status only
             No DB checks — must respond in < 50ms always

/readiness → Readiness probe: "Are all dependencies healthy?"
             Answer: YES/NO based on DB, cache, queue checks
             Used by load balancer: 503 → don't route traffic here
```

```typescript
// backend/src/routes/health.route.ts
import { Router } from 'express';
import { db } from '../db';
import { redis } from '../cache';

const router = Router();

// Liveness — process is running
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME ?? 'api',
    version: process.env.APP_VERSION ?? 'unknown',
    uptime: Math.floor(process.uptime()),  // seconds
  });
});

// Readiness — dependencies are healthy
router.get('/readiness', async (req, res) => {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {};

  // Database
  const dbStart = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: 'error', error: String(err) };
    logger.error({ err }, 'Readiness check: database failed');
  }

  // Cache (if used)
  if (redis) {
    const cacheStart = Date.now();
    try {
      await redis.ping();
      checks.cache = { status: 'ok', latencyMs: Date.now() - cacheStart };
    } catch (err) {
      checks.cache = { status: 'error', error: String(err) };
    }
  }

  const ready = Object.values(checks).every(c => c.status === 'ok');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export { router as healthRouter };
```

**IMPORTANT: Register before auth middleware**
```typescript
// Health endpoints must be public — no auth required
app.use(healthRouter);       // ← before auth
app.use(authMiddleware);     // ← after health
app.use(apiRouter);
```

---

## 5. Request ID Tracing

Every log line for a single request must share the same `requestId` — essential for debugging in production.

```typescript
// backend/src/middleware/request-id.middleware.ts
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Honor incoming ID from upstream service (distributed tracing)
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  // Scope logger to this request — all logs in this request will include requestId
  req.log = logger.child({ requestId, userId: (req as any).user?.id });
  next();
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: import('pino').Logger;
    }
  }
}

// Register EARLY — before route handlers
app.use(requestIdMiddleware);
```

Usage in routes:
```typescript
router.get('/items', async (req, res) => {
  req.log.info({ filters: req.query }, 'Fetching items');  // includes requestId automatically
  const items = await itemService.list(req.query);
  req.log.info({ count: items.length }, 'Items fetched');
  res.json(items);
});
```

---

## 6. Prometheus Metrics

```bash
npm install prom-client
```

```typescript
// backend/src/middleware/metrics.middleware.ts
import { Counter, Histogram, Gauge, register } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

// Request count by method, route, status
const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP request count',
  labelNames: ['method', 'route', 'status_code'] as const,
});

// Request duration distribution
const httpDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route'] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

// Active connections gauge
const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  activeConnections.inc();

  res.on('finish', () => {
    activeConnections.dec();
    const route = req.route?.path ?? req.path ?? 'unknown';
    const labels = { method: req.method, route };
    httpRequests.inc({ ...labels, status_code: res.statusCode });
    httpDuration.observe(labels, Date.now() - start);
  });

  next();
}

// Expose metrics endpoint for Prometheus scraping
export function registerMetricsEndpoint(app: import('express').Application) {
  app.get('/metrics', async (req, res) => {
    // Protect in production — only allow internal/monitoring traffic
    const allowed = req.ip === '127.0.0.1' || req.headers['x-monitoring-token'] === process.env.METRICS_TOKEN;
    if (!allowed) return res.status(403).end();
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  });
}
```

---

## 7. Alerting Rules

Document these in `observability/alerting-rules.md`:

```markdown
## Alert Rules

### 🚨 Critical — PagerDuty / immediate on-call wake-up
| Condition | Threshold | Action |
|---|---|---|
| Error rate | > 5% over 5 min | Page on-call engineer |
| P99 latency | > 5s over 5 min | Page on-call engineer |
| /readiness 503 | > 2 min sustained | Page on-call engineer |
| Memory usage | > 90% for 10 min | Page on-call engineer |
| Disk usage | > 90% | Page on-call engineer |
| Sentry error spike | > 500 events/min | Page on-call engineer |

### ⚠️ Warning — Slack #alerts channel
| Condition | Threshold | Action |
|---|---|---|
| Error rate | > 1% over 15 min | Post to Slack |
| P95 latency | > 2s | Post to Slack |
| DB pool utilization | > 80% | Post to Slack |
| Sentry new issue | Any new issue type | Post to Slack |

### ℹ️ Info — Log only
| Condition | Action |
|---|---|
| Deployment detected (version change in /health) | Log |
| Scheduled job completed | Log |
| Rate limit threshold reached for a user | Log |
```

---

## 8. On-Call Runbook Template

Create `observability/runbook.md`:

```markdown
# On-Call Runbook

## Alert: High Error Rate (> 5%)

**Severity:** Critical
**Expected response time:** < 15 minutes

### Diagnosis Steps
1. Check Sentry for new error types in the last 30 minutes
2. Check `/readiness` endpoint — is DB/cache healthy?
3. Check recent deployments — was there a deploy in the last hour?
4. Check error logs: `grep "level":"error" logs/app.log | tail -100`

### Resolution
- If DB is down: [DB recovery runbook link]
- If after deploy: roll back with `git revert HEAD && deploy`
- If spike in a specific endpoint: apply rate limiting, investigate root cause

### Escalation
- If not resolved in 30 min: escalate to team lead
- If data loss suspected: escalate to CTO immediately

---

## Alert: /readiness 503

**Severity:** Critical

### Diagnosis Steps
1. Hit `/readiness` manually — check which dependency failed
2. If database: check DB server status, connection pool size
3. If cache: check Redis server status

### Resolution
- DB connection pool exhausted: restart app server (connections will re-establish)
- DB server down: execute failover to replica if configured
- Redis down: set `CACHE_ENABLED=false` and restart (graceful degradation)
```

---

## 9. Observability Report Format

The final deliverable that `devops-release-lead` requires before releasing:

```json
{
  "generatedAt": "2026-09-18T09:00:00.000Z",
  "generatedBy": "observability-worker",
  "status": "PASS",
  "checks": {
    "errorTracking": {
      "status": "PASS",
      "provider": "Sentry",
      "backendConfigured": true,
      "frontendConfigured": true,
      "piiScrubbing": true,
      "notes": "DSN from environment variable. PII fields stripped in beforeSend."
    },
    "structuredLogging": {
      "status": "PASS",
      "library": "pino",
      "sensitiveFieldsRedacted": true,
      "logLevelsConfigured": true,
      "notes": "Redacts: authorization, cookie, password, token, secret, creditCard"
    },
    "healthEndpoints": {
      "status": "PASS",
      "livenessEndpoint": "/health",
      "readinessEndpoint": "/readiness",
      "databaseCheck": true,
      "cacheCheck": true,
      "notes": "Health endpoints registered before auth middleware."
    },
    "requestTracing": {
      "status": "PASS",
      "requestIdMiddleware": true,
      "requestIdInLogs": true,
      "requestIdInResponseHeaders": true
    },
    "metrics": {
      "status": "PASS",
      "requestCounter": true,
      "latencyHistogram": true,
      "metricsEndpoint": "/metrics",
      "notes": "Protected with METRICS_TOKEN. Prometheus-compatible format."
    },
    "alerting": {
      "status": "PASS",
      "criticalAlertsDocumented": true,
      "warningAlertsDocumented": true,
      "onCallDestination": "PagerDuty",
      "runbookWritten": true
    }
  },
  "signedOff": true
}
```

---

## 10. Observability Checklist

- [ ] Sentry DSN from environment variable (never hardcoded)
- [ ] `import './instrument'` is FIRST import in entry file
- [ ] PII stripped in `beforeSend` (no emails, tokens, passwords in Sentry)
- [ ] React ErrorBoundary wraps app and reports to Sentry
- [ ] All logs are structured JSON in production (pino)
- [ ] Sensitive fields redacted in logs (authorization, cookie, password, token)
- [ ] Request ID middleware registered and propagated through all logs
- [ ] `/health` responds in < 50ms (no DB calls)
- [ ] `/readiness` returns 503 when any dependency is down
- [ ] Health endpoints registered before auth middleware
- [ ] Prometheus metrics endpoint live at `/metrics`
- [ ] Alert rules documented (critical + warning)
- [ ] On-call runbook written for each critical alert
- [ ] `observability-report.json` produced with `status: "PASS"`
