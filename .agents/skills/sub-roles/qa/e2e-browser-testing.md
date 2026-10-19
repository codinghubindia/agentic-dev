# QA Sub-Role: End-to-End (E2E) Browser Testing

Consolidated from `browser-e2e-tester`.

## Responsibilities & Standards
- Author automated E2E browser journeys using Playwright or Cypress covering critical user paths.

## E2E Checklist
- [ ] Critical Paths Covered: User registration, login, core transaction flow (e.g. checkout, create document), and logout.
- [ ] Resilient Locators: Use user-facing role locators (`getByRole('button', { name: /submit/i })`, `getByLabel('Email')`), never fragile CSS selectors.
- [ ] Cross-Browser & Viewports: Tests pass on Chromium, Firefox, WebKit, and mobile viewport (375x667).
- [ ] Zero Flakiness: Explicit web-first assertions (`expect(locator).toBeVisible()`) avoiding arbitrary `sleep()` or timeout waits.
- [ ] Artifacts on Failure: Capture screenshot, video, and trace file on test failure for immediate debugging.
