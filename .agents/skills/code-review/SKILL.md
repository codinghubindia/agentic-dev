---
name: code-review
description: Systematic code audit guide covering correctness, contract compliance, security vulnerabilities, performance anti-patterns, test coverage gaps, naming quality, and maintainability — with severity classification for each finding.
refreshMode: protected
lastResearched: 2026-09-27
---

# Code Review Skill

Standards for thorough, impartial, and actionable code reviews.

---

## 1. Review Severity Classification

Every finding must be classified:

| Severity | Definition | Action Required |
|---|---|---|
| **Critical** | Security hole, data loss, logic error that breaks core functionality, broken API contract | Must fix before merge |
| **Major** | Missing test coverage, performance problem, design violation, missing error handling | Should fix before merge |
| **Minor** | Naming clarity, comment quality, minor style issue, code duplication | Nice to fix, can be backlog |
| **Suggestion** | Alternative approach worth considering, optional improvement | No action required |

---

## 2. Correctness & Logic Checklist

- [ ] Does the implementation match the acceptance criteria / task specification?
- [ ] Are all happy paths implemented correctly?
- [ ] Are all error paths handled and tested?
- [ ] Are edge cases handled: empty arrays, null/undefined, zero, max values, negative numbers?
- [ ] Is concurrency considered? Race conditions for DB writes? Idempotency?
- [ ] Are async operations awaited? No dangling promises?
- [ ] Is error propagation correct? Errors caught and forwarded vs swallowed?

---

## 3. API Contract Compliance

- [ ] Does every endpoint match `api-contract.json` exactly? (method, path, request schema, response schemas)
- [ ] Are all HTTP status codes correct? (201 for creation, 204 for deletion, not always 200)
- [ ] Is the response body shape correct? (data wrapper, error shape `{ error, code, details? }`)
- [ ] Is authentication required on all non-public endpoints?
- [ ] Are required fields validated with 400 + field-level error details?

---

## 4. Security Checklist

- [ ] No hardcoded credentials, API keys, tokens, or passwords
- [ ] All inputs validated and sanitized before use
- [ ] No SQL string interpolation (must use parameterized queries)
- [ ] No `eval()`, `exec()`, `spawn()` with user input
- [ ] No sensitive data exposed in API responses (passwords, internal IDs, tokens)
- [ ] No sensitive data logged to console or log files
- [ ] RBAC authorization checked in service layer, not just middleware
- [ ] No user-controllable data passed to `innerHTML` / `dangerouslySetInnerHTML`

---

## 5. Performance Checklist

- [ ] No N+1 query patterns — are related entities eagerly loaded?
- [ ] Paginated responses for list endpoints (no unbounded queries)
- [ ] Appropriate indexes exist for the query patterns used
- [ ] No synchronous blocking operations in async handlers
- [ ] No memory leaks — event listeners removed? Intervals cleared?
- [ ] Heavy computations moved off the request cycle (queued if needed)?

---

## 6. Test Coverage Checklist

- [ ] New functionality has unit tests (service layer)
- [ ] New API endpoints have integration tests
- [ ] Error paths are tested (not just happy paths)
- [ ] Tests are deterministic (no random data, no time-dependent tests without mocking)
- [ ] No skipped tests without documented reason
- [ ] Tests don't test implementation details (test behavior, not internals)

---

## 7. Code Quality Checklist

- [ ] Functions/methods have single responsibility (< 30 lines is a guide, not a rule)
- [ ] Variable and function names are descriptive (`getUserById` not `getU`)
- [ ] No magic numbers or strings — use named constants
- [ ] No deeply nested code (> 3 levels nesting → extract to functions)
- [ ] No commented-out code — remove dead code
- [ ] TypeScript: no `any` types, explicit return types on public functions
- [ ] DRY — no significant code duplication (≥ 3 uses → extract to utility)

---

## 8. Review Report Format

```markdown
## Code Review — <PR/Feature Name>

### Summary
Overall assessment in 1-2 sentences.

### Critical Findings (must fix before merge)
1. **[CRITICAL] `backend/src/routes/users.ts:45`** — SQL injection vulnerability
   User input `req.params.id` is concatenated directly into the SQL query.
   **Fix**: Use parameterized query: `db.query('SELECT * FROM users WHERE id = $1', [req.params.id])`

### Major Findings (should fix before merge)
1. **[MAJOR] `backend/src/services/auth.service.ts:23`** — Missing test coverage
   The `refreshToken()` method has no unit tests for the token expiry path.
   **Fix**: Add a test case that mocks a token with `exp` in the past.

### Minor Findings
1. **[MINOR] `frontend/src/components/UserCard.tsx:12`** — Magic number
   `height: 250` should be extracted to a design token.

### Approved With Changes
[ ] All Critical and Major findings resolved → approved to merge
```

---

## 9. What NOT to Do in a Review

- Do **not** silently fix issues — document them and return to the author
- Do **not** reject stylistic preferences that aren't project conventions
- Do **not** approve with "LGTM" — every finding must be explicitly addressed
- Do **not** review more than 400 lines at once — request smaller PRs
