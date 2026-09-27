---
name: git-integration
description: Comprehensive guide for Git branching strategies, worktree isolation for parallel agent execution, merge conflict resolution, conventional commits, semantic versioning, CI gate enforcement, and safe integration protocols.
refreshMode: sections
lastResearched: 2026-09-27
refreshableSections:
  - "Tooling"
protectedSections:
  - "Branching strategy"
  - "Conventional commits"
---

# Git Integration Skill

Procedures for orchestrating multi-agent Git workflows safely and reproducibly.

---

## 1. Branching Strategy

Use **trunk-based development** for small teams, **GitFlow** for larger teams with release cycles:

### Trunk-Based (recommended for most projects)
```
main (protected)
  └── feature/backend-auth        ← backend-lead's work
  └── feature/frontend-login      ← frontend-lead's work
  └── feature/db-users-schema     ← data-lead's work
```
- Feature branches are short-lived (< 2 days)
- Merge via PR with CI green + review approval
- No direct commits to `main`

### Branch Naming Convention
```
feature/<agent>-<description>     → feature/backend-auth-jwt
fix/<agent>-<issue>               → fix/frontend-auth-redirect-loop
chore/<description>               → chore/update-dependencies
test/<description>                → test/add-auth-integration-tests
```

---

## 2. Worktree Isolation for Parallel Agent Execution

When multiple agents work simultaneously, use **Git worktrees** to give each agent an isolated working directory:

```bash
# Create separate worktrees for each parallel stream
git worktree add ../cook-backend feature/backend-api
git worktree add ../cook-frontend feature/frontend-ui
git worktree add ../cook-database feature/db-schema

# Each agent works in its own directory — no conflicts possible
# backend-lead → works in cook-backend/
# frontend-lead → works in cook-frontend/
# data-lead → works in cook-database/

# List worktrees
git worktree list

# Clean up after integration
git worktree remove ../cook-backend
```

**Benefits**: Each agent sees a clean working tree, changes don't interfere, merging is explicit.

---

## 3. Ownership Map Enforcement

Before committing, verify files changed match the agent's ownership map:

```bash
# Check what files have been changed
git diff --name-only HEAD

# Compare against ownership-map.json — each agent must only touch its paths
# backend-lead owns: backend/
# frontend-lead owns: frontend/
# data-lead owns: database/
```

If an agent has modified files outside its ownership boundary → revert and reassign.

---

## 4. Conventional Commits

All commits must follow Conventional Commits format:

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

**Types:**
| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Code change with no behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build/CI/tooling/dependency changes |
| `style` | Formatting, whitespace (no logic change) |
| `revert` | Revert a previous commit |

**Breaking changes**: Add `!` after type or add `BREAKING CHANGE:` in footer:
```
feat!: rename /users endpoint to /api/v1/users
# or:
feat(api): add pagination to users endpoint

BREAKING CHANGE: response shape changed from array to { data: [], meta: {} }
```

**Examples:**
```
feat(auth): implement JWT refresh token rotation
fix(frontend): resolve infinite redirect loop on logout
test(backend): add integration tests for user creation endpoint
chore: update express to 4.19.2
```

---

## 5. Pre-Merge Checklist

Before any branch is merged to `main`:

- [ ] CI pipeline passes (lint, typecheck, tests, build)
- [ ] All tests pass (unit + integration)
- [ ] Code review approved (no open Critical/Major findings)
- [ ] Ownership map respected (no files outside agent's boundary)
- [ ] No merge conflicts with target branch
- [ ] Branch is rebased/up-to-date with main
- [ ] No sensitive data added (secrets, credentials)

```bash
# Rebase before merge (keep history clean)
git fetch origin
git rebase origin/main
git push --force-with-lease origin feature/my-branch
```

---

## 6. Merge Conflict Resolution Protocol

1. **Identify the competing owners** via `ownership-map.json`
2. **Classify the conflict**:
   - **Syntactic**: two changes to the same line — usually auto-resolvable
   - **Semantic**: logic conflict — must be reviewed by both owners
3. **Resolve**:
   - Never arbitrarily discard either side's changes
   - Re-synchronize based on the architectural contract (`api-contract.json`)
   - If in doubt, call a three-way merge with both owners and `integration-manager`
4. **Verify after resolution**: run tests to confirm the merge is correct

```bash
# View conflict markers
git diff --check

# Use a three-way diff tool
git mergetool

# After resolving
git add <resolved-files>
git merge --continue
```

---

## 7. Semantic Versioning

Follow MAJOR.MINOR.PATCH:
- `PATCH` (1.0.X): Bug fixes, no API changes
- `MINOR` (1.X.0): New backward-compatible features
- `MAJOR` (X.0.0): Breaking changes

```bash
# Tag a release
git tag -a v1.2.0 -m "feat: add user profile editing"
git push origin v1.2.0
```

---

## 8. Git Hygiene

```bash
# Keep commits atomic — one logical change per commit
# Squash WIP commits before merging
git rebase -i origin/main

# Write meaningful commit messages — not "fix bug" or "wip"

# Never force-push to shared branches (main, develop)
# Only force-push to your own feature branches with --force-with-lease

# Don't commit: node_modules/, .env, build/, dist/, *.log
```
