# QA Sub-Role: Load & Stress Testing

Consolidated from `stress-test-worker`.

## Responsibilities & Standards
- Author and execute load scenarios (k6 or Locust) to validate performance under sustained and peak concurrency.

## Load Testing Checklist
- [ ] Latency Budgets: p50 < 100ms, p95 < 300ms, p99 < 800ms under expected production concurrency.
- [ ] Error Rate: Total failed requests < 0.1% under normal load.
- [ ] Scenarios: Ramp-up, steady-state plateau, spike traffic, and soak testing for memory leaks.
- [ ] Rate Limit Verification: Verify that rate limiters trigger 429 status codes under abusive traffic spikes.
