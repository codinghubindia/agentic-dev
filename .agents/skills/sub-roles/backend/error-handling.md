# Backend Sub-Role: Error Handling & Resilience

Consolidated from `error-handling-worker`.

## Responsibilities & Standards
- Standardize RFC 7807/9457 error responses, global exception handlers, custom AppError classes, and deterministic error codes.

## Error Handling Checklist
- [ ] Custom Domain Errors: Hierarchy of typed error classes (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ConflictError`) carrying HTTP status codes.
- [ ] Global Error Middleware: Centralized error catching middleware that formats all unhandled rejections into uniform RFC 9457 Problem Details JSON.
- [ ] Sensitive Information Redaction: Production error responses never leak stack traces, database internals, SQL queries, or file system paths.
- [ ] Structured Error Logging: Log all 5xx errors with stack trace, request ID, user ID (if authenticated), and request path using structured logger (Pino).
- [ ] Graceful Termination: Unhandled exceptions trigger clean server draining and shutdown (listening for `SIGTERM` and `SIGINT`).
