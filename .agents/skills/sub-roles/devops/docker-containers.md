# DevOps Sub-Role: Docker & Containerization

Consolidated from `docker-worker`.

## Responsibilities & Standards
- Author production-grade, secure, multi-stage Dockerfiles and docker-compose configurations.

## Docker Checklist
- [ ] Multi-Stage Builds: Separate build stage from minimal production runtime image (Alpine or Distroless).
- [ ] Non-Root User: Container processes run as non-root user (`USER node` or `USER nonroot`).
- [ ] Layer Caching: Copy package manifests (`package.json`, lockfiles) before copying source code to maximize Docker cache hits.
- [ ] Healthcheck Instruction: Explicit `HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:PORT/health || exit 1`.
- [ ] Docker Compose: Development environment with local database, Redis, and hot-reload volumes configured.
- [ ] .dockerignore: Exclude `.git`, `node_modules`, `dist`, `.env*`, and test artifacts.
