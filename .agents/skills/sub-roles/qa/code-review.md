# QA Sub-Role: Impartial Code Review

Consolidated from `code-reviewer`.

## Responsibilities & Standards
- Perform rigorous git diff code reviews assessing contract compliance, edge cases, error recovery, maintainability, and architectural integrity.

## Code Review Checklist
- [ ] Contract Alignment: Do the implemented functions and schemas match `contracts.ts` exactly without ad-hoc mutations?
- [ ] Edge Cases: Are null/undefined values, empty lists, connection timeouts, and race conditions handled?
- [ ] Readability & Simplicity: Is the code clean, modular, and self-documenting? Are functions focused on a single responsibility?
- [ ] Test Coverage: Are unit and integration tests present for all new business logic and bug fixes?
- [ ] No Silent Failures: Are errors logged and propagated instead of swallowed in empty `catch {}` blocks?
