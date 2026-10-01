---
name: devops-infrastructure
description: Production Dockerization, multi-stage Alpine builds, GitHub Actions CI/CD automation, structured JSON logging, and container health probes.
lastResearched: 2026-10-01
---

# 🐳 DevOps, CI/CD, & Production Infrastructure

> [!IMPORTANT]
> Infrastructure must be repeatable, minimal, secure by default, and fully automated via CI/CD.

---

## 1. Multi-Stage Dockerfile Standard

All containers must use 2-stage builds with non-root security:

```dockerfile
# Stage 1: Build & Compile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "dist/index.js"]
```

---

## 2. GitHub Actions CI/CD Standard

Every workflow must include:
* Dependency caching (`actions/setup-node` with `cache: 'npm'`).
* Deterministic lint and compilation checks (`tsc --noEmit`).
* Automated unit & integration test suites.
* Artifact build verification.

---

## 3. Observability & Health Probing Standard

* **Liveness Probe (`GET /health/live`):** Returns `200 OK` `{ "status": "live" }` if process is responding.
* **Readiness Probe (`GET /health/ready`):** Returns `200 OK` only if database connection pool and Redis caches are reachable. Returns `503 Service Unavailable` otherwise.
* **Structured Logging:** All logs must emit single-line JSON with timestamps, log level, request ID, and sanitized PII.
