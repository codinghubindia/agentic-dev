# Micro-Skill: Load Testing & Performance Benchmarking

**Scope**: Stress testing, latency budget verification, throughput benchmarks, and k6 scenarios.

## Rules & Checklists
1. **Latency Budgets & Thresholds**:
   - Enforce hard latency budgets in load test configurations:
     - p50 < 100ms
     - p95 < 300ms
     - p99 < 800ms
   - Require HTTP error rate < 0.1% under normal expected load.
2. **Scenario Profiles**:
   - Ramp-up: Progressively scale virtual users (VUs) to test connection pooling warm-up.
   - Steady-state: Hold peak expected concurrent users for sustained benchmark.
   - Spike test: Instantly 5x traffic to verify auto-scaling and rate-limit triggers.
3. **k6 Script Conventions**:
   - Tag all requests with metric tags (`endpoint`, `method`) for granular reporting.
   - Use checks (`check(res, { 'status is 200': (r) => r.status === 200 })`) and abort on threshold violation.
4. **Rate Limit Verification**:
   - Confirm that requests exceeding rate limits receive `429 Too Many Requests` with `Retry-After`.
5. **System Resource Monitoring**:
   - Monitor CPU, memory, and database active connection pool during the benchmark run.
