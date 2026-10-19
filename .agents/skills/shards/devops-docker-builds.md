# Micro-Skill: Docker Containerization & Multi-Stage Builds

**Scope**: Production Dockerfile design, image minimization, and container security.

## Rules & Checklists
1. **Multi-Stage Architecture**:
   - Separate build environment (`FROM node:... AS builder`) from runtime environment (`FROM node:...-slim AS runner`).
   - Copy only built artifacts and production dependencies into the final stage to keep images small (<150MB).
2. **Layer Caching Optimization**:
   - Copy dependency manifests (`package.json`, `pnpm-lock.yaml`) and install dependencies BEFORE copying application source code.
   - Avoid invalidating expensive package installation layers on minor source code edits.
3. **Non-Root Execution**:
   - Create and switch to a non-privileged system user (`USER node` or `USER 10001`).
   - Never run container processes as `root` (UID 0) in production.
4. **Container Health Checks**:
   - Define a native `HEALTHCHECK` directive:
     `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1`.
5. **Clean Ignore Patterns**:
   - Maintain a comprehensive `.dockerignore` file excluding `.git`, `node_modules`, `.env*`, `.agents/cache/`, and test coverage directories.
