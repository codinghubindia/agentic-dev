---
name: devops-practices
description: DevOps guide covering Docker multi-stage builds, GitHub Actions CI/CD pipelines, environment management, health checks, structured logging, container security, semantic versioning, and release automation.
refreshMode: full
lastResearched: 2024-01-01
---

# DevOps Practices Skill

Standards for building reliable, automated, and observable software delivery pipelines.

---

## 1. Docker — Multi-Stage Builds

Always use multi-stage builds to produce small, secure runtime images:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev            # install ALL deps for build
COPY . .
RUN npm run build                   # compile TypeScript → dist/

# Runtime stage — tiny image, no build tools
FROM node:20-alpine AS runtime
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
USER appuser

COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
RUN npm ci --omit=dev               # production deps only
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

**Rules:**
- Never use `:latest` tag — pin exact versions (`node:20.17.0-alpine`)
- Never run as root in containers
- Always add `HEALTHCHECK`
- Keep runtime image < 200MB

---

## 2. .dockerignore

```
node_modules/
dist/
.git/
.env
.env.local
*.test.ts
*.spec.ts
tests/
coverage/
.github/
README.md
```

---

## 3. docker-compose (Development)

```yaml
# docker-compose.yml
version: '3.9'
services:
  api:
    build:
      context: .
      target: builder          # use build stage for hot-reload
    volumes:
      - ./src:/app/src         # mount source for hot-reload
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
    env_file: .env
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: apppassword
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

---

## 4. GitHub Actions — CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test:unit -- --coverage

      - name: Integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb

      - name: Build
        run: npm run build

      - name: Security audit
        run: npm audit --audit-level=high

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
```

---

## 5. Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*.*.*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # full history for changelog

      - name: Build Docker image
        run: docker build -t ghcr.io/${{ github.repository }}:${{ github.ref_name }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

---

## 6. Environment Management

```bash
# .env.example — commit this (no real values)
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your-32-character-minimum-secret-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Rules:**
- Never commit `.env` — only `.env.example`
- Validate all env vars at startup (fail fast on missing config)
- Use GitHub Secrets / AWS Secrets Manager / Vault for production secrets
- Document every env var in `.env.example` with a comment explaining its purpose

---

## 7. Health Check Endpoint

Every service must expose `/health`:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: Math.floor(process.uptime()),
  });
});

// Readiness check (for k8s)
app.get('/readiness', async (req, res) => {
  try {
    await db.raw('SELECT 1');   // check DB connection
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready', reason: 'database_unavailable' });
  }
});
```

---

## 8. Structured Logging

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});

// Log with context — never log sensitive data
logger.info({ userId: user.id, action: 'login' }, 'User logged in');
logger.error({ err, requestId, path: req.path }, 'Request failed');

// NEVER log:
logger.info({ password, token, creditCard }); // VIOLATION
```
