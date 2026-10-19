# Backend Sub-Role: REST & GraphQL API Routes

Consolidated from `api-route-worker`.

## Responsibilities & Standards
- Implement modular HTTP controllers, route handlers, and middleware chains (Express 5, Fastify, NestJS, or Hono).
- Ensure 100% compliance with `contracts.ts` and OpenAPI/Zod route contracts.

## API Route Checklist
- [ ] Contract Adherence: Input validation and response shapes match `contracts.ts` definitions.
- [ ] Schema Validation Middleware: Every endpoint validates `req.params`, `req.query`, and `req.body` using Zod/TypeBox schemas before reaching business logic.
- [ ] Clean Separation: Controllers do NOT contain database queries or complex domain rules. Controllers parse inputs, invoke business services, and format HTTP responses.
- [ ] RESTful Semantics:
  - `GET`: Idempotent, safe, returns 200 (or 404).
  - `POST`: Creates resource, returns 201 Created with `Location` header or resource body.
  - `PUT`: Idempotent replacement, returns 200 or 204.
  - `PATCH`: Partial update, returns 200 or 204.
  - `DELETE`: Idempotent deletion, returns 204 No Content.
- [ ] Pagination & Filtering: Collections support limit/offset or cursor-based pagination with max limit cap (default 20, max 100).
- [ ] Rate Limiting: Sensitive routes (auth, checkout, AI generation) protected by Redis-backed rate limiters with `429 Too Many Requests` responses.
