---
name: load-testing
description: Load and stress testing guide covering k6 and Locust test authoring, load scenario design (ramp-up, steady-state, spike, soak), rate limit validation, latency budgets (p50/p95/p99), throughput baselines, bottleneck identification, and stress-test-report.json format.
---

# Load Testing

1. **Tool Selection** — when to use k6 vs Locust vs artillery vs JMeter
2. **k6 script examples** — full working k6 scripts for:
   - REST API endpoint testing with auth headers
   - Ramp-up scenario (0 → 50 → 100 VUs)
   - Spike scenario (sudden traffic burst)
   - Soak scenario (sustained load over 30+ minutes)
3. **Rate limit validation** — how to confirm 429 responses are returned at correct thresholds
4. **Latency budgets**: p95 < 500ms = PASS, p95 500ms-1s = WARNING, p95 > 1s = FAIL
5. **Throughput targets**: how to set RPS targets
6. **Bottleneck identification checklist**: DB queries, N+1s, missing indexes, sync blocking calls
7. **stress-test-report.json format**:
```json
{
  "status": "PASS|FAIL|WARNING",
  "timestamp": "...",
  "scenarios": [...],
  "endpoints": [{"path": "/api/...", "p50": 45, "p95": 210, "p99": 450, "errorRate": 0.001}],
  "rateLimitValidation": {"threshold": 100, "testedAt": 110, "got429": true},
  "bottlenecks": [...],
  "recommendations": [...]
}
```
8. **Locust example** (Python) for teams that prefer Python
9. **CI integration**: how to run load tests in GitHub Actions with pass/fail thresholds
