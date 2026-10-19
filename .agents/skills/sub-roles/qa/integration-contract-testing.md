# QA Sub-Role: Integration & Contract Testing

Consolidated from `integration-test-worker` and `backend-test-worker`.

## Responsibilities & Standards
- Validate API endpoints against `contracts.ts` and test multi-service integration boundaries using Supertest, MSW, and testcontainers.

## Integration Testing Checklist
- [ ] Contract Verifications: Assert that actual API responses match expected TypeScript interfaces and Zod schemas.
- [ ] Status Code Coverage: Test 200/201 (success), 400 (validation error), 401 (unauthorized), 403 (forbidden), 404 (not found), and 409 (conflict).
- [ ] Isolated Test Database: Tests run against ephemeral database instances or transaction rollbacks to prevent dirty test state.
- [ ] Third-Party Mocking: External third-party payment gateways, AI APIs, and email providers mocked via MSW or wiremock.
