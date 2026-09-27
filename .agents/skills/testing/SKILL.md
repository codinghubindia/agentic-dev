---
name: testing
description: Comprehensive testing guide covering unit tests (Jest/Vitest), integration tests (Supertest), React Testing Library, MSW API mocking, E2E with Playwright, coverage thresholds, and test database management.
refreshMode: sections
lastResearched: 2026-09-28
refreshableSections:
  - "E2E tooling"
  - "Coverage tools"
protectedSections:
  - "Test pyramid"
  - "Testing philosophy"
---

# Testing Skill

Testing strategies and standards for a multi-agent software engineering company.

---

## 1. Testing Pyramid

```
          ╔══════════╗
          ║   E2E    ║  ← Few, slow, real browser
         ╔╩══════════╩╗
         ║Integration ║  ← Moderate, test DB, real HTTP
        ╔╩════════════╩╗
        ║     Unit     ║  ← Many, fast, isolated mocks
        ╚══════════════╝
```

- **Unit tests**: 70% of tests. Fast, isolated, mock all dependencies. Run in < 30s.
- **Integration tests**: 20% of tests. Test real DB + real HTTP. Run in < 3 min.
- **E2E tests**: 10% of tests. Real browser, full stack. Run in < 10 min. Cover critical paths only.

---

## 2. Unit Tests (Jest / Vitest)

### Structure — AAA Pattern
```typescript
describe('UserService.register', () => {
  it('should hash the password before saving', async () => {
    // ARRANGE
    const mockRepo = { create: jest.fn().mockResolvedValue({ id: '1', email: 'a@b.com' }) };
    const service = new UserService(mockRepo as any);

    // ACT
    await service.register({ email: 'a@b.com', password: 'plaintext' });

    // ASSERT
    const savedPassword = mockRepo.create.mock.calls[0][0].password;
    expect(savedPassword).not.toBe('plaintext');
    expect(savedPassword).toMatch(/^\$2[aby]\$/);  // bcrypt prefix
  });
});
```

### What to test per unit
- Happy path (expected input → expected output)
- Each error condition (missing field, duplicate, invalid format)
- Boundary values (empty string, zero, max length, negative numbers)
- All conditional branches

### Mocking
```typescript
// Mock modules
jest.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-secret' } }));

// Mock repository via dependency injection (preferred)
const mockUserRepo = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};
const service = new AuthService(mockUserRepo as unknown as UserRepository);
```

---

## 3. Backend Integration Tests (Supertest)

```typescript
// tests/integration/users.test.ts
import request from 'supertest';
import { app } from '@/app';
import { db } from '@/database';

beforeAll(async () => { await db.migrate.latest(); });
beforeEach(async () => { await db.seed.run(); });
afterAll(async () => { await db.destroy(); });

describe('POST /api/v1/users', () => {
  it('returns 201 with created user', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alice', email: 'alice@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'alice@test.com' });
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('returns 400 on invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alice', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details[0].field).toBe('email');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/users').send({ name: 'X', email: 'x@x.com' });
    expect(res.status).toBe(401);
  });
});
```

### Integration test rules
- Use a **dedicated test database** — never dev or prod
- Wrap each test in a transaction and rollback after (or truncate tables in `beforeEach`)
- Never share state between tests — each test is fully independent
- Test every API endpoint: success, 400 validation, 401 unauth, 403 forbidden, 404 not found

---

## 4. Frontend Unit Tests (React Testing Library)

```typescript
// components/ui/Button/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and calls onClick', () => {
    const handleClick = jest.fn();
    render(<Button variant="primary" onClick={handleClick}>Save</Button>);

    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button variant="primary" loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### RTL Rules
- Query by `role`, `labelText`, `text` — in that priority order
- Never query by `testId` for logic (only for elements with no accessible label)
- Never test implementation details (`useState`, `useRef`, internal functions)
- Use `userEvent` for realistic interactions (keyboard, typing) — not `fireEvent`

---

## 5. API Mocking with MSW

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/users', () =>
    HttpResponse.json({ data: [{ id: '1', name: 'Alice', email: 'alice@test.com' }] })
  ),
  http.post('/api/v1/users', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({ data: { id: '2', ...body } }, { status: 201 });
  }),
  http.get('/api/v1/users/:id', ({ params }) => {
    if (params.id === '999') return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({ data: { id: params.id, name: 'Alice' } });
  }),
];
```

---

## 6. E2E Tests (Playwright)

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can register, login, and access dashboard', async ({ page }) => {
  // Register
  await page.goto('/register');
  await page.getByLabel('Email').fill('e2e@test.com');
  await page.getByLabel('Password').fill('SecurePass123!');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL('/dashboard');

  // Logout
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/login');

  // Login again
  await page.getByLabel('Email').fill('e2e@test.com');
  await page.getByLabel('Password').fill('SecurePass123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

### E2E Rules
- Use `getByRole` and `getByLabel` — never CSS selectors or test IDs
- Tests must be fully independent (reset DB state between runs)
- Never use `page.waitForTimeout()` — use `waitForResponse`, `waitForURL`, `toBeVisible`
- Run against: Chromium (required), Firefox, WebKit (Safari)

---

## 7. Coverage Targets

| Layer | Target |
|---|---|
| Service layer (business logic) | ≥ 85% line coverage |
| Route controllers | ≥ 70% line coverage |
| React components | ≥ 80% line coverage |
| Custom hooks | ≥ 85% line coverage |
| Utility functions | ≥ 95% line coverage |

---

## 8. QA Report Format

All test runs must produce output conforming to `qa-report.schema.json`:
```json
{
  "status": "PASS",
  "coverage": { "statements": 87, "branches": 82, "functions": 91 },
  "tests": { "total": 143, "passed": 143, "failed": 0, "skipped": 2 },
  "defects": []
}
```
