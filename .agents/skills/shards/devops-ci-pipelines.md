# Micro-Skill: CI/CD Automation & Pipeline Gates

**Scope**: GitHub Actions CI/CD workflows, build caching, and shift-left quality gates.

## Rules & Checklists
1. **Parallel Shift-Left Gates**:
   - Run type checking (`tsc --noEmit`), linting (`eslint`), and formatting checks in parallel early jobs.
   - Fail fast within 2 minutes before triggering heavier container builds or integration test suites.
2. **Aggressive Cache Strategies**:
   - Cache package manager stores (`pnpm`, `npm`, `pip`, `pub`) using hash-based keys: `${{ runner.os }}-store-${{ hashFiles('**/lock') }}`.
   - Cache compiler build outputs (`.next/cache`, `target/`) where supported.
3. **Strict Timeouts & Concurrency**:
   - Set `timeout-minutes: 15` on all GitHub Actions jobs to prevent hung runner billing.
   - Use `concurrency.cancel-in-progress: true` on PR branches to cancel superseded commits automatically.
4. **Zero Unmasked Secrets**:
   - Ingest secrets exclusively from encrypted repository secrets (`${{ secrets.* }}`).
   - Verify that test logs and build output mask all environment secrets.
5. **Deterministic Artifact Promotion**:
   - Build container image once in CI, scan for vulnerabilities (`trivy`), and promote the exact immutable digest to registry.
