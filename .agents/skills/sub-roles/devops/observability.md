# DevOps Sub-Role: Observability, Metrics & Health Endpoints

Consolidated from `observability-worker`.

## Responsibilities & Standards
- Implement the three pillars of observability: structured logging, Prometheus metrics, and distributed error tracking (Sentry).

## Observability Checklist
- [ ] Structured JSON Logs: Use Pino or Winston to emit single-line JSON logs with `level`, `time`, `reqId`, `msg`, and error stack.
- [ ] Health & Readiness Probes:
  - `GET /health` (Liveness): Returns 200 if process is up.
  - `GET /ready` (Readiness): Checks database and Redis connectivity before accepting traffic.
- [ ] Distributed Tracing: Propagate `x-request-id` headers through incoming HTTP requests to outbound service calls and database query comments.
- [ ] Sentry / Error Reporting: Capture unhandled backend exceptions and frontend runtime errors with environment and release tags.
- [ ] Metrics Exporter: Expose Prometheus `/metrics` endpoint with memory usage, event loop lag, HTTP latency histograms, and status code counts.
