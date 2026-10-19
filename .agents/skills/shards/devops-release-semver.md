# Micro-Skill: Release Engineering & Semantic Versioning

**Scope**: Conventional commits, SemVer tagging, changelogs, and rollback strategies.

## Rules & Checklists
1. **Conventional Commits**:
   - Format all commits: `<type>(<scope>): <subject>` (e.g. `feat(auth): add refresh token rotation`).
   - Allowed types: `feat`, `fix`, `perf`, `refactor`, `test`, `chore`, `docs`, `ci`.
   - Indicate breaking changes with `BREAKING CHANGE:` in commit footer or `!` after type.
2. **Semantic Versioning Enforcement**:
   - `PATCH` (v1.0.X): Backwards-compatible bug fixes.
   - `MINOR` (v1.X.0): Backwards-compatible new features.
   - `MAJOR` (vX.0.0): Breaking API or schema changes.
3. **Automated Changelogs & Tags**:
   - Generate `CHANGELOG.md` automatically from commit history during release builds.
   - Tag releases with annotated git tags: `git tag -a v1.2.0 -m "Release v1.2.0"`.
4. **Zero-Downtime Rollback Strategy**:
   - Maintain backwards-compatible database migrations during release rollouts.
   - Ensure the previous container image can be redeployed immediately if health checks fail post-deployment.
5. **Release Artifact Verification**:
   - Verify build integrity, SHA-256 checksums, and package manifests before publishing.
