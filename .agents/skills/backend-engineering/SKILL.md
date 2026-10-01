---
name: backend-engineering
description: Production backend service architecture, Express/FastAPI modular patterns, Zod schema validation, JWT auth, RFC 9457 error standards, and rate limiting.
lastResearched: 2026-10-01
---

# 🚀 Backend Engineering & API Standards

> [!IMPORTANT]
> All backend routes, controllers, and services must strictly conform to type-safe schema validation, standardized HTTP semantics, and stateless horizontal scalability.

---

## 1. RESTful Semantics & Status Codes

* **GET /resources:** 200 OK. Returns collection or filtered query.
* **POST /resources:** 201 Created with `Location` header or created object.
* **PUT /resources/:id:** 200 OK. Complete replacement.
* **PATCH /resources/:id:** 200 OK. Partial update.
* **DELETE /resources/:id:** 204 No Content.

---

## 2. Mandatory Input Validation (Zod / TypeBox)

Every incoming request body, query parameter, and route parameter MUST be validated before touching service logic:

```typescript
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  role: z.enum(["user", "admin"]).default("user")
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

---

## 3. Standardized RFC 9457 Error Response Format

Never return unformatted string errors or random structures. All errors must follow RFC 9457:

```json
{
  "type": "https://api.example.com/errors/invalid-credentials",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "The email or password provided does not match our records.",
  "instance": "/api/v1/auth/login",
  "invalidParams": [
    { "name": "password", "reason": "Password must be at least 8 characters" }
  ]
}
```

---

## 4. Stateless Security & Rate Limiting

* **Stateless Token Auth:** Use short-lived JWTs (15m–1h) with cryptographically secure refresh token rotation stored in `httpOnly, secure, sameSite=strict` cookies.
* **Rate Limiting:** Must implement IP + Token based rate limiting on sensitive routes (e.g. `/auth/login` capped at 5 attempts / minute) using Redis or memory stores.
