---
name: api-design
description: REST API design guide covering resource naming, HTTP method semantics, status codes, pagination strategies, versioning, error response formats, idempotency, filtering, sorting, and OpenAPI documentation.
refreshMode: sections
lastResearched: 2026-09-28
refreshableSections:
  - "OpenAPI tooling sections"
protectedSections:
  - "REST naming conventions"
  - "HTTP status code semantics"
---

# API Design Skill

Standards for designing consistent, predictable, and developer-friendly REST APIs.

---

## 1. Resource Naming

- Use **nouns**, not verbs — the HTTP method conveys the action
- Use **plural** resource names: `/users`, not `/user`
- Use **kebab-case** for multi-word resources: `/user-profiles`, not `/userProfiles`
- Nest resources to express relationships (max 2 levels deep):

```
GET    /users                    → list users
POST   /users                    → create user
GET    /users/:id                → get user
PUT    /users/:id                → replace user (full update)
PATCH  /users/:id                → update user (partial update)
DELETE /users/:id                → delete user

GET    /users/:id/orders         → user's orders (nested, fine)
GET    /users/:id/orders/:oid    → specific order (max nesting)

# Avoid deeper nesting — flatten instead:
GET    /orders/:oid              → better than /users/:id/orders/:oid
```

---

## 2. HTTP Methods

| Method | Safe | Idempotent | Use for |
|---|---|---|---|
| GET | ✅ | ✅ | Read resource(s) |
| POST | ❌ | ❌ | Create resource, non-idempotent actions |
| PUT | ❌ | ✅ | Full resource replacement |
| PATCH | ❌ | ⚠️ | Partial update |
| DELETE | ❌ | ✅ | Remove resource |

---

## 3. HTTP Status Codes

```
200 OK                  → GET/PUT/PATCH success
201 Created             → POST success (include Location header with new resource URL)
204 No Content          → DELETE success, or PATCH with no response body

400 Bad Request         → Validation failure (always include field-level errors)
401 Unauthorized        → Missing or invalid authentication token
403 Forbidden           → Valid token but insufficient permissions
404 Not Found           → Resource does not exist
409 Conflict            → Duplicate resource (email already registered)
422 Unprocessable       → Valid JSON but semantic error (e.g. dates in wrong order)
429 Too Many Requests   → Rate limit exceeded (include Retry-After header)

500 Internal Server Error → Unhandled server error (log, return generic message)
503 Service Unavailable   → Server overloaded or maintenance
```

---

## 4. Response Envelopes

**Success:**
```json
// Single resource
{ "data": { "id": "123", "name": "Alice", "email": "alice@example.com" } }

// List with pagination
{
  "data": [{ "id": "1", "name": "Alice" }, { "id": "2", "name": "Bob" }],
  "meta": {
    "total": 142,
    "page": 1,
    "perPage": 20,
    "hasNextPage": true
  }
}
```

**Error:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "email", "message": "Must be a valid email address" },
    { "field": "password", "message": "Must be at least 8 characters" }
  ]
}
```

**Rules:**
- Never mix success and error formats
- Never return `{ success: false }` — use the correct HTTP status code
- Never expose stack traces, SQL errors, or internal details in error responses

---

## 5. Pagination

### Offset Pagination (simple, OK for < 10k records)
```
GET /posts?page=2&perPage=20

Response meta:
{ "total": 150, "page": 2, "perPage": 20, "totalPages": 8 }
```

### Cursor Pagination (scalable, for large/infinite datasets)
```
GET /posts?cursor=eyJpZCI6IjEyMyJ9&limit=20

Response meta:
{ "nextCursor": "eyJpZCI6IjE0MyJ9", "hasNextPage": true, "limit": 20 }
```

**Always enforce a max page size** (e.g., max 100 per page) — never allow unbounded queries.

---

## 6. Filtering & Sorting

```
# Filtering
GET /products?status=active&category=electronics&minPrice=100&maxPrice=500

# Sorting
GET /products?sortBy=price&sortOrder=asc     (ascending)
GET /products?sortBy=createdAt&sortOrder=desc  (newest first)

# Field selection (sparse fieldsets)
GET /users?fields=id,name,email

# Search
GET /products?q=laptop
```

---

## 7. API Versioning

- Prefix all routes with `/api/v1/`
- When introducing **breaking changes**, create `/api/v2/`
- Maintain old versions for a documented deprecation period (minimum 6 months)
- Add `Deprecation` header to old versions: `Deprecation: Sun, 01 Jan 2025 00:00:00 GMT`
- **Non-breaking changes** (new optional fields, new endpoints) do NOT require a new version

---

## 8. Idempotency

For operations that must be safe to retry (payment, order creation):
```
POST /payments
Idempotency-Key: <uuid-from-client>

# If the same key is sent again, return the original response without re-processing
```

---

## 9. Authentication Header

```
# Bearer token (JWT)
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 10. Naming Consistency

- Response fields: **camelCase** (`createdAt`, `userId`)
- Query params: **camelCase** or **snake_case** — pick one and be consistent
- Date format: **ISO 8601** (`2024-09-17T10:30:00Z`) — always UTC
- IDs: **string** UUIDs — not numeric (avoids enumeration attacks, easier to shard)
