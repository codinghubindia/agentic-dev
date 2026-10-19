# Micro-Skill: Backend API & Input Validation

**Scope**: REST API routing, request validation, and error contract formatting.

## Rules & Checklists
1. **HTTP Method & Status Semantics**:
   - `POST` creates resource (return `201 Created` with `Location` header or created entity).
   - `GET` reads resource (`200 OK`, `404 Not Found`). Never mutate state in GET.
   - `PUT` replaces resource; `PATCH` applies partial delta (`200 OK` with updated resource).
   - `DELETE` removes resource (`204 No Content` or `200 OK` with confirmation).
2. **Strict Schema Validation**:
   - Validate `params`, `query`, and `body` using Zod schemas before entering service logic.
   - Strip unknown fields or use `.strict()` to forbid unexpected payload injection.
   - Fail early with `400 Bad Request` or `422 Unprocessable Entity` on validation mismatch.
3. **RFC 9457 Error Response Standards**:
   - Return structured error JSON: `{ "type": "urn:problem:validation-error", "title": "Validation Error", "status": 400, "detail": "...", "invalidParams": [...] }`.
   - Never leak internal stack traces or raw database error strings to clients.
4. **Idempotency & Safe Mutation**:
   - Enforce `Idempotency-Key` header checking on critical billing, transfer, or creation mutations.
   - Return cached response on replayed `Idempotency-Key`.
5. **Content Negotiation**:
   - Always verify `Content-Type: application/json` on incoming mutation requests.
   - Explicitly specify `Content-Type: application/json; charset=utf-8` on API responses.
