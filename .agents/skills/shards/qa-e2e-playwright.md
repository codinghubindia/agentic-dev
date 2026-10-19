# Micro-Skill: E2E Testing with Playwright

**Scope**: Playwright end-to-end testing, user locators, and resilient browser automation.

## Rules & Checklists
1. **Accessible User-Facing Locators**:
   - Locate elements using user-facing roles: `page.getByRole('button', { name: /submit/i })`, `getByLabel()`, `getByText()`.
   - Never use fragile CSS class selectors (e.g. `.css-1234`) or deep XPath hierarchies.
2. **Web-First Auto-Waiting Assertions**:
   - Always use `await expect(locator).toBeVisible()` or `await expect(locator).toHaveText()`.
   - Never use manual `page.waitForTimeout()` or arbitrary sleep calls.
3. **Isolated Test Environments**:
   - Run tests in fresh browser contexts (`browser.newContext()`) with isolated cookies and local storage.
   - Seed independent test records per test run or test worker to prevent shared state conflicts.
4. **Deterministic Network Mocking & Probing**:
   - Mock flaky third-party integrations (Stripe, Twilio) via `page.route()`.
   - Assert on visual UI changes rather than fragile network-idle heuristics.
5. **Trace & Artifact Capture**:
   - Retain Playwright traces, screenshots, and videos on test failure (`trace: 'retain-on-failure'`).
