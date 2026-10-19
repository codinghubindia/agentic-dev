# Backend Sub-Role: Server Analytics & Event Tracking

Consolidated from `analytics-worker`.

## Responsibilities & Standards
- Implement server-side product analytics, conversion funnel instrumentation, and event pipelines (PostHog, Segment, Mixpanel).

## Analytics Checklist
- [ ] Strongly Typed Events: Define an event taxonomy enum and schema for all domain events (`USER_REGISTERED`, `SUBSCRIPTION_STARTED`, `INVOICE_PAID`).
- [ ] PII Sanitization: Strip sensitive personally identifiable information (passwords, credit cards, SSNs) before dispatching events.
- [ ] Server-Side Dispatch: Fire analytics asynchronously from backend services or background worker queues to avoid slowing down HTTP response cycles.
- [ ] Correlation: Attach `userId`, `sessionId`, and `tenantId` to all event payloads for end-to-end user journey tracking.
