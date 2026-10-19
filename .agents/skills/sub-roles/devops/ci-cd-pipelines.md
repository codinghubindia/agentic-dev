# DevOps Sub-Role: CI/CD Pipelines & Automation

Consolidated from `ci-pipeline-worker`.

## Responsibilities & Standards
- Build fast, deterministic GitHub Actions / GitLab CI workflow pipelines for continuous integration and automated deployment.

## CI/CD Checklist
- [ ] Shift-Left Gates: Run `.agents/bin/quality-gate.mjs` early in pipeline to catch lint, types, and git conflicts before running heavy test suites.
- [ ] Parallel Jobs: Run unit tests, linting, and build jobs concurrently to minimize pipeline duration (< 5 minutes).
- [ ] Dependency Caching: Cache package manager caches (`actions/cache` or `setup-node` caching).
- [ ] Branch Protection: Require pull request reviews and green CI status checks before merging to `main`.
- [ ] Safe Secrets: Deployment secrets injected strictly from environment secret stores, never hardcoded.
