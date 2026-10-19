# Micro-Skill: Observability, Metrics & Telemetry

**Scope**: Structured JSON logging, health probes, Prometheus metrics, and distributed tracing.

## Rules & Checklists
1. **Structured JSON Logging**:
   - Emit single-line structured JSON logs in production using Pino.
   - Every log entry must include: `level`, `timestamp`, `reqId`, `service`, `message`, and sanitized `context`.
   - Never use unstructured `console.log()` in backend services.
2. **Correlation & Request ID Tracing**:
   - Attach or generate `x-request-id` (UUIDv7) on incoming HTTP requests.
   - Propagate `x-request-id` through service calls and include it on all associated logs and error responses.
3. **Liveness & Readiness Probes**:
   - `/health` (Liveness): Quick check verifying the server process is responsive (no heavy DB pings).
   - `/ready` (Readiness): Checks database connection pool, Redis ping, and critical dependencies. Return 503 if not ready.
4. **Prometheus Metrics**:
   - Expose standard Prometheus metrics: HTTP request duration histogram (p50/p95/p99), request rate, error counters.
   - Protect `/metrics` endpoint behind internal network access or basic auth.
5. **PII Redaction in Telemetry**:
   - Configure Pino redaction paths (`req.headers.authorization`, `body.password`, `body.creditCard`).
