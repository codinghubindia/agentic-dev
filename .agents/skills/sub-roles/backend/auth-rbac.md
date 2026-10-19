# Backend Sub-Role: Authentication & Authorization (RBAC)

Consolidated from `auth-worker`.

## Responsibilities & Standards
- Secure user authentication (JWT, OAuth 2.0 / OIDC, session cookies) and role-based access control (RBAC).
- Enforce least-privilege access across all protected backend routes.

## Auth Checklist
- [ ] Password Hashing: Argon2id (preferred) or bcrypt (work factor >= 12). Zero plaintext passwords anywhere in database or logs.
- [ ] Token Strategy: Short-lived access tokens (15m) and cryptographically secure rotating refresh tokens stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies.
- [ ] JWT Verification: Validate issuer, audience, expiration (`exp`), and signature using asymmetric keys (RS256) or strong HMAC secrets (HS256).
- [ ] RBAC Middleware: Declarative role/permission guards (`requireRole(['admin', 'editor'])` or `requirePermission('articles:delete')`).
- [ ] Timing-Attack Defense: Use constant-time comparisons (`crypto.timingSafeEqual`) for sensitive tokens, API keys, and hashes.
- [ ] Session Invalidation: Provide explicit logout that revokes refresh tokens and invalidates server-side session caches.
